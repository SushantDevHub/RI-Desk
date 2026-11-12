import express from 'express';
import jwt from 'jsonwebtoken';
import {
  getAllDesignations,
  addDesignation,
  updateDesignation,
  deleteDesignation,
  findDesignationById,
} from '../utils/designationStore.js';

const router = express.Router();

function authenticate(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;

  if (!token) {
    return res.status(401).json({ error: 'Authentication required.' });
  }

  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET);
    next();
  } catch (error) {
    return res.status(401).json({ error: 'Invalid or expired token.' });
  }
}

function requireAdmin(req, res, next) {
  authenticate(req, res, () => {
    if (req.user?.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required.' });
    }
    next();
  });
}

// GET /api/designations - list all designations
router.get('/', authenticate, (req, res) => {
  try {
    const designations = getAllDesignations();
    return res.json({ designations });
  } catch (error) {
    console.error('Get designations error:', error);
    return res.status(500).json({ error: 'Failed to load designations.' });
  }
});

// POST /api/designations - create a new designation (admin only)
router.post('/', requireAdmin, (req, res) => {
  try {
    const { title, code, department, description, status } = req.body;

    const trimmedTitle = String(title || '').trim();
    if (!trimmedTitle) {
      return res.status(400).json({ error: 'Designation title is required.' });
    }

    const designations = getAllDesignations();
    const nextId =
      designations.length > 0
        ? Math.max(...designations.map((d) => Number(d.id) || 0)) + 1
        : 1;

    const autoCode =
      String(code || '').trim().toUpperCase() ||
      trimmedTitle.slice(0, 3).toUpperCase();

    const newDesignation = {
      id: nextId,
      title: trimmedTitle,
      code: autoCode,
      department: String(department || 'Support').trim(),
      description: String(description || '').trim(),
      status: status === 'inactive' ? 'inactive' : 'active',
      createdAt: new Date().toISOString(),
      createdBy: req.user?.name || 'Admin',
    };

    addDesignation(newDesignation);

    return res.status(201).json({
      message: 'Designation created successfully.',
      designation: newDesignation,
    });
  } catch (error) {
    console.error('Create designation error:', error);
    return res.status(500).json({ error: 'Failed to create designation.' });
  }
});

// PUT /api/designations/:id - update a designation (admin only)
router.put('/:id', requireAdmin, (req, res) => {
  try {
    const { id } = req.params;
    const existing = findDesignationById(id);
    if (!existing) {
      return res.status(404).json({ error: 'Designation not found.' });
    }

    const { title, code, department, description, status } = req.body;
    const trimmedTitle = title !== undefined ? String(title).trim() : existing.title;
    if (!trimmedTitle) {
      return res.status(400).json({ error: 'Designation title cannot be empty.' });
    }

    const updates = {
      title: trimmedTitle,
      code:
        code !== undefined
          ? String(code).trim().toUpperCase() || trimmedTitle.slice(0, 3).toUpperCase()
          : existing.code,
      department:
        department !== undefined
          ? String(department).trim()
          : existing.department,
      description:
        description !== undefined
          ? String(description).trim()
          : existing.description,
      status:
        status !== undefined
          ? status === 'inactive' ? 'inactive' : 'active'
          : existing.status,
      updatedAt: new Date().toISOString(),
    };

    const updated = updateDesignation(id, updates);

    return res.json({
      message: 'Designation updated successfully.',
      designation: updated,
    });
  } catch (error) {
    console.error('Update designation error:', error);
    return res.status(500).json({ error: 'Failed to update designation.' });
  }
});

// DELETE /api/designations/:id - delete a designation (admin only)
router.delete('/:id', requireAdmin, (req, res) => {
  try {
    const { id } = req.params;
    const existing = findDesignationById(id);
    if (!existing) {
      return res.status(404).json({ error: 'Designation not found.' });
    }

    deleteDesignation(id);
    return res.json({ message: 'Designation deleted successfully.' });
  } catch (error) {
    console.error('Delete designation error:', error);
    return res.status(500).json({ error: 'Failed to delete designation.' });
  }
});

export default router;
