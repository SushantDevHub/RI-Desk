import express from 'express';
import jwt from 'jsonwebtoken';
import {
  getNotificationsForUser,
  getUnreadCountForUser,
  markNotificationRead,
  markAllNotificationsRead,
  deleteNotification,
} from '../utils/notificationStore.js';

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

// GET /api/notifications - List notifications for current user + unread count
router.get('/', authenticate, (req, res) => {
  try {
    const userId = req.user.id;
    const notifications = getNotificationsForUser(userId);
    const unreadCount = getUnreadCountForUser(userId);

    return res.json({
      notifications,
      unreadCount,
    });
  } catch (error) {
    console.error('Fetch notifications error:', error);
    return res.status(500).json({ error: 'Failed to fetch notifications.' });
  }
});

// PATCH /api/notifications/:id/read - Mark single notification as read
router.patch('/:id/read', authenticate, (req, res) => {
  try {
    const userId = req.user.id;
    const notificationId = req.params.id;

    const updated = markNotificationRead(notificationId, userId);
    if (!updated) {
      return res.status(404).json({ error: 'Notification not found.' });
    }

    const unreadCount = getUnreadCountForUser(userId);
    return res.json({
      success: true,
      notification: updated,
      unreadCount,
    });
  } catch (error) {
    console.error('Mark notification read error:', error);
    return res.status(500).json({ error: 'Failed to mark notification read.' });
  }
});

// POST /api/notifications/mark-all-read - Mark all notifications as read
router.post('/mark-all-read', authenticate, (req, res) => {
  try {
    const userId = req.user.id;
    const count = markAllNotificationsRead(userId);

    return res.json({
      success: true,
      markedCount: count,
      unreadCount: 0,
    });
  } catch (error) {
    console.error('Mark all read error:', error);
    return res.status(500).json({ error: 'Failed to mark all as read.' });
  }
});

// DELETE /api/notifications/:id - Delete single notification
router.delete('/:id', authenticate, (req, res) => {
  try {
    const userId = req.user.id;
    const notificationId = req.params.id;

    const deleted = deleteNotification(notificationId, userId);
    if (!deleted) {
      return res.status(404).json({ error: 'Notification not found.' });
    }

    const unreadCount = getUnreadCountForUser(userId);
    return res.json({
      success: true,
      unreadCount,
    });
  } catch (error) {
    console.error('Delete notification error:', error);
    return res.status(500).json({ error: 'Failed to delete notification.' });
  }
});

export default router;
