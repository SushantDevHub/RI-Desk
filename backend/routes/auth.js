import express from 'express';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';

import {
  findUserByMobile,
  findUserByEmail,
  findUserById,
  updateUser,
} from '../utils/userStore.js';
const router = express.Router();


// ==============================
// LOGIN
// ==============================

router.post('/login', async (req, res) => {
  try {
    const { mobileNumber, password, remember = true } = req.body;

    // Check required fields
    if (!mobileNumber || !password) {
      return res.status(400).json({
        error: 'Mobile number and password are required.',
      });
    }

    // Find user by mobile number
    const user = findUserByMobile(mobileNumber);

    // User doesn't exist
    if (!user) {
      return res.status(401).json({
        error: 'Invalid mobile number or password.',
      });
    }

    // Check password (supports bcrypt hash or legacy plain text fallback)
    const isBcrypt = user.password && (user.password.startsWith('$2a$') || user.password.startsWith('$2b$'));
    const isPasswordValid = isBcrypt
      ? await bcrypt.compare(password, user.password)
      : password === user.password;

    if (!isPasswordValid) {
      return res.status(401).json({
        error: 'Invalid mobile number or password.',
      });
    }

    // Auto-migrate legacy plain text password to bcrypt hash on successful login
    if (!isBcrypt && user.password) {
      const newHash = await bcrypt.hash(password, 10);
      updateUser(user.id, { password: newHash });
    }
    // Create JWT - 30 days if remember me is checked, 1 day if not
    const token = jwt.sign(
      {
        id: user.id,
        mobileNumber: user.mobileNumber,
        name: user.name,
        role: user.role,
      },
      process.env.JWT_SECRET,
      {
        expiresIn: remember ? '30d' : '1d',
      }
    );

    // Send login response
    return res.json({
      message: 'Login successful.',
      token,
      user: {
        id: user.id,
        name: user.name,
        mobileNumber: user.mobileNumber,
        role: user.role,
      },
    });

  } catch (error) {
    console.error('Login error:', error);

    return res.status(500).json({
      error: 'Server error.',
    });
  }
});


// ==============================
// GET CURRENT USER
// ==============================

router.get('/me', (req, res) => {
  const header = req.headers.authorization || '';

  const token = header.startsWith('Bearer ')
    ? header.slice(7)
    : null;

  if (!token) {
    return res.status(401).json({
      error: 'No token provided.',
    });
  }

  try {
    const decoded = jwt.verify(
      token,
      process.env.JWT_SECRET
    );

    return res.json({
      user: {
        id: decoded.id,
        name: decoded.name,
        mobileNumber: decoded.mobileNumber,
        role: decoded.role,
      },
    });

  } catch (error) {
    return res.status(401).json({
      error: 'Invalid or expired token.',
    });
  }
});


// ==============================
// FORGOT PASSWORD
// ==============================

router.post('/forgot-password', async (req, res) => {
  try {
    const { email, newPassword } = req.body;

    if (!email || !String(email).trim()) {
      return res.status(400).json({
        error: 'Email address is required.',
      });
    }

    if (!newPassword || String(newPassword).length < 4) {
      return res.status(400).json({
        error: 'Password must be at least 4 characters.',
      });
    }

    const user = findUserByEmail(String(email).trim());

    if (!user) {
      return res.status(404).json({
        error: 'No account found with this email address.',
      });
    }

    // Hash the new password before storing
    const hashedPassword = await bcrypt.hash(String(newPassword), 10);

    // Update the user's password
    updateUser(user.id, {
      password: hashedPassword,
    });

    return res.json({
      message: 'Password reset successful. You can now log in with your new password.',
    });
  } catch (error) {
    console.error('Forgot password error:', error);

    return res.status(500).json({
      error: 'Failed to reset password.',
    });
  }
});

// ==============================
// CHANGE PASSWORD
// ==============================

router.post('/change-password', async (req, res) => {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;

  if (!token) {
    return res.status(401).json({
      error: 'Authentication required.',
    });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const { currentPassword, newPassword } = req.body;

    if (!newPassword || String(newPassword).length < 8) {
      return res.status(400).json({
        error: 'New password must be at least 8 characters long.',
      });
    }

    const user = findUserById(decoded.id);
    if (!user) {
      return res.status(404).json({
        error: 'User not found.',
      });
    }

    // If currentPassword is provided, verify it against existing password
    if (currentPassword && typeof currentPassword === 'string' && currentPassword.trim()) {
      const isBcrypt = user.password && (user.password.startsWith('$2a$') || user.password.startsWith('$2b$'));
      const isCurrentValid = isBcrypt
        ? await bcrypt.compare(currentPassword, user.password)
        : currentPassword === user.password;

      if (!isCurrentValid) {
        return res.status(400).json({
          error: 'Current password is incorrect.',
        });
      }
    }

    const hashedPassword = await bcrypt.hash(String(newPassword), 10);
    updateUser(user.id, {
      password: hashedPassword,
    });

    return res.json({
      message: 'Password changed successfully.',
    });
  } catch (error) {
    if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError') {
      return res.status(401).json({
        error: 'Invalid or expired token.',
      });
    }
    console.error('Change password error:', error);
    return res.status(500).json({
      error: 'Failed to change password.',
    });
  }
});

export default router;