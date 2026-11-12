import express from 'express';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';

import {
  getAllUsers,
  findUserByMobile,
  addUser,
  saveAllUsers,
} from '../utils/userStore.js';

const router = express.Router();

/* ─────────────────────────────────────────────
   Authentication middleware
───────────────────────────────────────────── */

function authenticate(req, res, next) {
  const header = req.headers.authorization || '';

  const token = header.startsWith('Bearer ')
    ? header.slice(7)
    : null;

  if (!token) {
    return res.status(401).json({
      error: 'Authentication required.',
    });
  }

  try {
    const decoded = jwt.verify(
      token,
      process.env.JWT_SECRET
    );

    req.user = decoded;

    next();
  } catch (error) {
    return res.status(401).json({
      error: 'Invalid or expired token.',
    });
  }
}

function requireAdmin(req, res, next) {
  authenticate(req, res, () => {
    if (req.user?.role !== 'admin') {
      return res.status(403).json({
        error: 'Admin access required.',
      });
    }

    next();
  });
}

/* ─────────────────────────────────────────────
   Create employee
───────────────────────────────────────────── */

router.post('/', requireAdmin, async (req, res) => {
  try {
    const {
      name,
      email,
      mobileNumber,
      password,
      designation = '',
    } = req.body;

    if (!name || !email || !mobileNumber || !password) {
      return res.status(400).json({
        error:
          'Name, email, mobile number and password are required.',
      });
    }

    const existingUser =
      findUserByMobile(mobileNumber);

    if (existingUser) {
      return res.status(409).json({
        error:
          'An account with this mobile number already exists.',
      });
    }

    const users = getAllUsers();

    const nextId =
      users.length > 0
        ? Math.max(
            ...users.map((user) => Number(user.id) || 0)
          ) + 1
        : 1;

    const hashedPassword = await bcrypt.hash(String(password), 10);

    const employee = {
      id: nextId,
      name,
      email,
      mobileNumber: String(mobileNumber),
      password: hashedPassword,
      role: 'employee',
      designation: String(designation || '').trim(),
    };

    addUser(employee);

    return res.status(201).json({
      message: 'Employee created successfully.',
      user: {
        id: employee.id,
        name: employee.name,
        email: employee.email,
        mobileNumber: employee.mobileNumber,
        role: employee.role,
        designation: employee.designation || '',
      },
    });
  } catch (error) {
    console.error(
      'Create employee error:',
      error
    );

    return res.status(500).json({
      error: 'Server error.',
    });
  }
});

/* ─────────────────────────────────────────────
   Get employees
───────────────────────────────────────────── */

router.get('/', authenticate, (req, res) => {
  try {
    const users = getAllUsers();

    const employees = users
      .filter((user) => user.role === 'employee')
      .map((user) => ({
        id: user.id,
        name: user.name,
        email: user.email || '',
        mobileNumber: user.mobileNumber,
        role: user.role,
        designation: user.designation || '',
      }));

    return res.json({
      employees,
    });
  } catch (error) {
    console.error(
      'Get employees error:',
      error
    );

    return res.status(500).json({
      error: 'Server error.',
    });
  }
});
/* ─────────────────────────────────────────────
   Delete employee
───────────────────────────────────────────── */

router.delete('/:id', requireAdmin, (req, res) => {
  try {
    const employeeId = Number(req.params.id);

    if (!Number.isInteger(employeeId)) {
      return res.status(400).json({
        error: 'Invalid employee ID.',
      });
    }

    const users = getAllUsers();

    const employee = users.find(
      (user) =>
        Number(user.id) === employeeId &&
        user.role === 'employee'
    );

    if (!employee) {
      return res.status(404).json({
        error: 'Employee not found.',
      });
    }

    const updatedUsers = users.filter(
      (user) => Number(user.id) !== employeeId
    );

    saveAllUsers(updatedUsers);

    return res.json({
      message: 'Employee deleted successfully.',
    });
  } catch (error) {
    console.error('Delete employee error:', error);

    return res.status(500).json({
      error: 'Failed to delete employee.',
    });
  }
});

/* ─────────────────────────────────────────────
   Update employee
───────────────────────────────────────────── */

router.put('/:id', requireAdmin, async (req, res) => {
  try {
    const employeeId = Number(req.params.id);
    const { name, email, mobileNumber, password, designation } = req.body;

    if (!Number.isInteger(employeeId)) {
      return res.status(400).json({
        error: 'Invalid employee ID.',
      });
    }

    if (!name?.trim() || !email?.trim() || !mobileNumber) {
      return res.status(400).json({
        error: 'Name, email and mobile number are required.',
      });
    }

    if (!/^\d{10}$/.test(String(mobileNumber))) {
      return res.status(400).json({
        error: 'Mobile number must contain exactly 10 digits.',
      });
    }

    const users = getAllUsers();

    const employeeIndex = users.findIndex(
      (user) =>
        Number(user.id) === employeeId &&
        user.role === 'employee'
    );

    if (employeeIndex === -1) {
      return res.status(404).json({
        error: 'Employee not found.',
      });
    }

    const duplicateMobile = users.find(
      (user) =>
        String(user.mobileNumber) === String(mobileNumber) &&
        Number(user.id) !== employeeId
    );

    if (duplicateMobile) {
      return res.status(409).json({
        error: 'This mobile number is already in use.',
      });
    }

    users[employeeIndex] = {
      ...users[employeeIndex],
      name: name.trim(),
      email: email.trim(),
      mobileNumber: String(mobileNumber),
      designation:
        designation !== undefined
          ? String(designation).trim()
          : (users[employeeIndex].designation || ''),
    };

    if (password && typeof password === 'string' && password.trim()) {
      if (password.length < 8) {
        return res.status(400).json({
          error: 'Password must be at least 8 characters long.',
        });
      }
      users[employeeIndex].password = await bcrypt.hash(String(password), 10);
    }

    saveAllUsers(users);

    return res.json({
      message: 'Employee updated successfully.',
      employee: {
        id: users[employeeIndex].id,
        name: users[employeeIndex].name,
        email: users[employeeIndex].email,
        mobileNumber: users[employeeIndex].mobileNumber,
        role: users[employeeIndex].role,
        designation: users[employeeIndex].designation || '',
      },
    });
  } catch (error) {
    console.error('Update employee error:', error);

    return res.status(500).json({
      error: 'Failed to update employee.',
    });
  }
});

export default router;