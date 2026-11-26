import express from 'express';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';

import {
  getAllUsers,
  findUserByMobile,
  findUserById,
  addUser,
  updateUser,
  deleteUser,
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
      status = 'active',
    } = req.body;

    if (!name || !email || !mobileNumber || !password) {
      return res.status(400).json({
        error:
          'Name, email, mobile number and password are required.',
      });
    }

    const existingUser = await findUserByMobile(mobileNumber);

    if (existingUser) {
      return res.status(409).json({
        error:
          'An account with this mobile number already exists.',
      });
    }

    const users = await getAllUsers();

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
      status: status === 'inactive' ? 'inactive' : 'active',
    };

    await addUser(employee);

    return res.status(201).json({
      message: 'Employee created successfully.',
      user: {
        id: employee.id,
        name: employee.name,
        email: employee.email,
        mobileNumber: employee.mobileNumber,
        role: employee.role,
        designation: employee.designation || '',
        status: employee.status || 'active',
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

router.get('/', authenticate, async (req, res) => {
  try {
    const users = await getAllUsers();

    const employees = users
      .filter((user) => user.role === 'employee')
      .map((user) => ({
        id: user.id,
        name: user.name,
        email: user.email || '',
        mobileNumber: user.mobileNumber,
        role: user.role,
        designation: user.designation || '',
        status: user.status === 'inactive' ? 'inactive' : 'active',
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

router.delete('/:id', requireAdmin, async (req, res) => {
  try {
    const employeeId = Number(req.params.id);

    if (!Number.isInteger(employeeId)) {
      return res.status(400).json({
        error: 'Invalid employee ID.',
      });
    }

    const employee = await findUserById(employeeId);

    if (!employee || employee.role !== 'employee') {
      return res.status(404).json({
        error: 'Employee not found.',
      });
    }

    await deleteUser(employeeId);

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
    const { name, email, mobileNumber, password, designation, status } = req.body;

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

    const users = await getAllUsers();

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

    const updates = {
      name: name.trim(),
      email: email.trim(),
      mobileNumber: String(mobileNumber),
      designation:
        designation !== undefined
          ? String(designation).trim()
          : (employee.designation || ''),
      status:
        status !== undefined
          ? (status === 'inactive' ? 'inactive' : 'active')
          : (employee.status || 'active'),
    };

    if (password && typeof password === 'string' && password.trim()) {
      if (password.length < 8) {
        return res.status(400).json({
          error: 'Password must be at least 8 characters long.',
        });
      }
      updates.password = await bcrypt.hash(String(password), 10);
    }

    const updatedEmployee = await updateUser(employeeId, updates);

    return res.json({
      message: 'Employee updated successfully.',
      employee: {
        id: updatedEmployee.id,
        name: updatedEmployee.name,
        email: updatedEmployee.email,
        mobileNumber: updatedEmployee.mobileNumber,
        role: updatedEmployee.role,
        designation: updatedEmployee.designation || '',
        status: updatedEmployee.status || 'active',
      },
    });
  } catch (error) {
    console.error('Update employee error:', error);

    return res.status(500).json({
      error: 'Failed to update employee.',
    });
  }
});

/* ─────────────────────────────────────────────
   Partial update employee (e.g. status)
───────────────────────────────────────────── */

router.patch('/:id', requireAdmin, async (req, res) => {
  try {
    const employeeId = Number(req.params.id);
    const { status, designation, name, email } = req.body;

    if (!Number.isInteger(employeeId)) {
      return res.status(400).json({ error: 'Invalid employee ID.' });
    }

    const users = await getAllUsers();
    const employee = users.find(
      (user) => Number(user.id) === employeeId && user.role === 'employee'
    );

    if (!employee) {
      return res.status(404).json({ error: 'Employee not found.' });
    }

    const updates = {};
    if (status !== undefined) {
      updates.status = status === 'inactive' ? 'inactive' : 'active';
    }
    if (designation !== undefined) {
      updates.designation = String(designation).trim();
    }
    if (name !== undefined && name.trim()) {
      updates.name = name.trim();
    }
    if (email !== undefined && email.trim()) {
      updates.email = email.trim();
    }

    const updatedEmployee = await updateUser(employeeId, updates);

    return res.json({
      message: 'Employee updated successfully.',
      employee: {
        id: updatedEmployee.id,
        name: updatedEmployee.name,
        email: updatedEmployee.email,
        mobileNumber: updatedEmployee.mobileNumber,
        role: updatedEmployee.role,
        designation: updatedEmployee.designation || '',
        status: updatedEmployee.status || 'active',
      },
    });
  } catch (error) {
    console.error('Patch employee error:', error);
    return res.status(500).json({ error: 'Failed to update employee.' });
  }
});

export default router;