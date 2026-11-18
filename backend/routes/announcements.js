import express from 'express';
import jwt from 'jsonwebtoken';
import {
  getAllAnnouncements,
  findAnnouncementById,
  addAnnouncement,
  updateAnnouncement,
  deleteAnnouncement,
} from '../utils/announcementStore.js';

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

// -------------------------------------------------------------
// GET /api/announcements - Get active announcements for current user
// -------------------------------------------------------------
router.get('/', authenticate, (req, res) => {
  try {
    const all = getAllAnnouncements();
    const userRole = (req.user?.role || '').toLowerCase();

    // Filter to active announcements relevant to the user's audience
    const announcements = all.filter((item) => {
      if (item.status && item.status.toLowerCase() === 'inactive') {
        return false;
      }

      const aud = (item.audience || 'all').toLowerCase();
      if (userRole === 'admin') return true;
      if (aud === 'all') return true;
      if (userRole === 'employee' && (aud === 'employees' || aud === 'internal')) return true;
      if (userRole === 'client' && aud === 'clients') return true;
      return false;
    });

    return res.json({ announcements });
  } catch (error) {
    console.error('Get announcements error:', error);
    return res.status(500).json({ error: 'Failed to load announcements.' });
  }
});

// -------------------------------------------------------------
// GET /api/announcements/admin - Admin view of all announcements
// -------------------------------------------------------------
router.get('/admin', requireAdmin, (req, res) => {
  try {
    const announcements = getAllAnnouncements();
    return res.json({ announcements });
  } catch (error) {
    console.error('Admin get announcements error:', error);
    return res.status(500).json({ error: 'Failed to load announcements.' });
  }
});

// -------------------------------------------------------------
// POST /api/announcements - Publish a new announcement (Admin only)
// -------------------------------------------------------------
router.post('/', requireAdmin, (req, res) => {
  try {
    const { title, category, audience, priority, content, status } = req.body;

    const trimmedTitle = String(title || '').trim();
    const trimmedContent = String(content || '').trim();

    if (!trimmedTitle) {
      return res.status(400).json({ error: 'Announcement title is required.' });
    }
    if (!trimmedContent) {
      return res.status(400).json({ error: 'Announcement content is required.' });
    }

    const newAnnouncement = {
      id: Date.now(),
      title: trimmedTitle,
      category: category || 'General',
      audience: audience || 'All',
      priority: priority || 'Normal',
      content: trimmedContent,
      status: status || 'Active',
      author: req.user?.name || req.user?.mobileNumber || 'Admin',
      authorRole: req.user?.role || 'admin',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const saved = addAnnouncement(newAnnouncement);
    return res.status(201).json({
      message: 'Announcement published successfully.',
      announcement: saved,
    });
  } catch (error) {
    console.error('Create announcement error:', error);
    return res.status(500).json({ error: 'Failed to publish announcement.' });
  }
});

// -------------------------------------------------------------
// PUT /api/announcements/:id - Update an announcement (Admin only)
// -------------------------------------------------------------
router.put('/:id', requireAdmin, (req, res) => {
  try {
    const { id } = req.params;
    const existing = findAnnouncementById(id);
    if (!existing) {
      return res.status(404).json({ error: 'Announcement not found.' });
    }

    const { title, category, audience, priority, content, status } = req.body;

    const updates = {};
    if (title !== undefined) updates.title = String(title).trim();
    if (category !== undefined) updates.category = category;
    if (audience !== undefined) updates.audience = audience;
    if (priority !== undefined) updates.priority = priority;
    if (content !== undefined) updates.content = String(content).trim();
    if (status !== undefined) updates.status = status;

    const updated = updateAnnouncement(id, updates);
    return res.json({
      message: 'Announcement updated successfully.',
      announcement: updated,
    });
  } catch (error) {
    console.error('Update announcement error:', error);
    return res.status(500).json({ error: 'Failed to update announcement.' });
  }
});

// -------------------------------------------------------------
// PATCH /api/announcements/:id/toggle-status - Toggle Active / Inactive
// -------------------------------------------------------------
router.patch('/:id/toggle-status', requireAdmin, (req, res) => {
  try {
    const { id } = req.params;
    const existing = findAnnouncementById(id);
    if (!existing) {
      return res.status(404).json({ error: 'Announcement not found.' });
    }

    const nextStatus = existing.status === 'Active' ? 'Inactive' : 'Active';
    const updated = updateAnnouncement(id, { status: nextStatus });

    return res.json({
      message: `Announcement marked as ${nextStatus}.`,
      announcement: updated,
    });
  } catch (error) {
    console.error('Toggle announcement status error:', error);
    return res.status(500).json({ error: 'Failed to toggle status.' });
  }
});

// -------------------------------------------------------------
// DELETE /api/announcements/:id - Delete an announcement (Admin only)
// -------------------------------------------------------------
router.delete('/:id', requireAdmin, (req, res) => {
  try {
    const { id } = req.params;
    const existing = findAnnouncementById(id);
    if (!existing) {
      return res.status(404).json({ error: 'Announcement not found.' });
    }

    deleteAnnouncement(id);
    return res.json({ message: 'Announcement deleted successfully.' });
  } catch (error) {
    console.error('Delete announcement error:', error);
    return res.status(500).json({ error: 'Failed to delete announcement.' });
  }
});

export default router;
