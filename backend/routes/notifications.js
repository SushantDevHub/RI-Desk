import express from 'express';
import jwt from 'jsonwebtoken';
import {
  getNotificationsForUser,
  getUnreadCountForUser,
  markNotificationRead,
  markAllNotificationsRead,
  deleteNotification,
  sendMobileNotification,
  getMobileNotificationsHistory,
  deleteMobileNotification,
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
    const userRole = req.user.role || 'employee';
    const notifications = getNotificationsForUser(userId, userRole);
    const unreadCount = getUnreadCountForUser(userId, userRole);

    return res.json({
      notifications,
      unreadCount,
    });
  } catch (error) {
    console.error('Fetch notifications error:', error);
    return res.status(500).json({ error: 'Failed to fetch notifications.' });
  }
});

// POST /api/notifications/send-mobile - Dispatch mobile push notification
router.post('/send-mobile', authenticate, (req, res) => {
  try {
    const {
      target = 'All Users',
      targetId = null,
      targetName = null,
      title = '',
      message = '',
      priority = 'Normal',
      ticketId = null,
      ticketNumber = null,
    } = req.body;

    if (!message || !String(message).trim()) {
      return res.status(400).json({ error: 'Notification message is required.' });
    }

    const senderId = req.user.id;
    const senderName = req.user.name || 'Admin User';
    const senderRole = req.user.role || 'admin';

    const result = sendMobileNotification({
      target,
      targetId,
      targetName,
      title,
      message,
      priority,
      senderId,
      senderName,
      senderRole,
      ticketId,
      ticketNumber,
    });

    const history = getMobileNotificationsHistory();

    return res.json({
      success: true,
      message: `Mobile push notification dispatched successfully to ${target}!`,
      notification: result.broadcast,
      inAppNotification: result.inAppNotification,
      history,
    });
  } catch (error) {
    console.error('Send mobile notification error:', error);
    return res.status(500).json({
      error: error.message || 'Failed to dispatch mobile notification.',
    });
  }
});

// GET /api/notifications/mobile-history - Fetch mobile notifications dispatch history
router.get('/mobile-history', authenticate, (req, res) => {
  try {
    const history = getMobileNotificationsHistory();
    return res.json({
      success: true,
      history,
    });
  } catch (error) {
    console.error('Fetch mobile history error:', error);
    return res.status(500).json({ error: 'Failed to load dispatch history.' });
  }
});

// DELETE /api/notifications/mobile-history/:id - Delete an entry from dispatch history
router.delete('/mobile-history/:id', authenticate, (req, res) => {
  try {
    const { id } = req.params;
    const deleted = deleteMobileNotification(id);
    if (!deleted) {
      return res.status(404).json({ error: 'Notification entry not found.' });
    }
    const history = getMobileNotificationsHistory();
    return res.json({
      success: true,
      message: 'Notification removed from dispatch history.',
      history,
    });
  } catch (error) {
    console.error('Delete mobile history error:', error);
    return res.status(500).json({ error: 'Failed to delete history item.' });
  }
});

// PATCH /api/notifications/:id/read - Mark single notification as read
router.patch('/:id/read', authenticate, (req, res) => {
  try {
    const userId = req.user.id;
    const userRole = req.user.role || 'employee';
    const notificationId = req.params.id;

    const updated = markNotificationRead(notificationId, userId);
    if (!updated) {
      return res.status(404).json({ error: 'Notification not found.' });
    }

    const unreadCount = getUnreadCountForUser(userId, userRole);
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
    const userRole = req.user.role || 'employee';
    const count = markAllNotificationsRead(userId, userRole);

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
    const userRole = req.user.role || 'employee';
    const notificationId = req.params.id;

    const deleted = deleteNotification(notificationId, userId);
    if (!deleted) {
      return res.status(404).json({ error: 'Notification not found.' });
    }

    const unreadCount = getUnreadCountForUser(userId, userRole);
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
