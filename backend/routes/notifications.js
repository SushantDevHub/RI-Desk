import express from 'express';
import jwt from 'jsonwebtoken';
import {
  getNotificationsForUser,
  getUnreadCountForUser,
  getChannelNotificationsForAdmin,
  getChannelUnreadCountForAdmin,
  createChannelNotification,
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
    const isAdminUser = String(userRole).toLowerCase() === 'admin';
    const notifications = getNotificationsForUser(userId, userRole);
    const unreadCount = getUnreadCountForUser(userId, userRole);

    const whatsappNotifications = isAdminUser
      ? getChannelNotificationsForAdmin(userId, 'whatsapp')
      : [];
    const whatsappUnreadCount = isAdminUser
      ? getChannelUnreadCountForAdmin(userId, 'whatsapp')
      : 0;
    const emailNotifications = isAdminUser
      ? getChannelNotificationsForAdmin(userId, 'email')
      : [];
    const emailUnreadCount = isAdminUser
      ? getChannelUnreadCountForAdmin(userId, 'email')
      : 0;

    return res.json({
      notifications,
      unreadCount,
      whatsappNotifications,
      whatsappUnreadCount,
      emailNotifications,
      emailUnreadCount,
    });
  } catch (error) {
    console.error('Fetch notifications error:', error);
    return res.status(500).json({ error: 'Failed to fetch notifications.' });
  }
});

// POST /api/notifications/channel - Log a WhatsApp or Email notification for Admin
router.post('/channel', authenticate, (req, res) => {
  try {
    const {
      channel,
      ticketId = null,
      ticketNumber = null,
      ticketSubject = '',
      title = '',
      message = '',
      contactInfo = '',
      clientName = '',
      recipientId = null,
      recipientName = 'Admin',
    } = req.body || {};

    const normChannel = String(channel || '').trim().toLowerCase();
    if (normChannel !== 'whatsapp' && normChannel !== 'email') {
      return res.status(400).json({ error: 'Valid channel ("whatsapp" or "email") is required.' });
    }

    const notification = createChannelNotification({
      channel: normChannel,
      senderId: req.user.id,
      senderName: req.user.name || 'Team Member',
      senderRole: req.user.role || 'employee',
      recipientId,
      recipientName,
      ticketId,
      ticketNumber,
      ticketSubject,
      title,
      message,
      contactInfo,
      clientName,
    });

    return res.status(201).json({
      success: true,
      notification,
    });
  } catch (error) {
    console.error('Create channel notification error:', error);
    return res.status(500).json({ error: error.message || 'Failed to record notification.' });
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
    const isAdminUser = String(userRole).toLowerCase() === 'admin';
    const notificationId = req.params.id;

    const updated = markNotificationRead(notificationId, userId);
    if (!updated) {
      return res.status(404).json({ error: 'Notification not found.' });
    }

    const unreadCount = getUnreadCountForUser(userId, userRole);
    const whatsappUnreadCount = isAdminUser ? getChannelUnreadCountForAdmin(userId, 'whatsapp') : 0;
    const emailUnreadCount = isAdminUser ? getChannelUnreadCountForAdmin(userId, 'email') : 0;

    return res.json({
      success: true,
      notification: updated,
      unreadCount,
      whatsappUnreadCount,
      emailUnreadCount,
    });
  } catch (error) {
    console.error('Mark notification read error:', error);
    return res.status(500).json({ error: 'Failed to mark notification read.' });
  }
});

// POST /api/notifications/mark-all-read - Mark all notifications (or a channel) as read
router.post('/mark-all-read', authenticate, (req, res) => {
  try {
    const userId = req.user.id;
    const userRole = req.user.role || 'employee';
    const isAdminUser = String(userRole).toLowerCase() === 'admin';
    const rawChannel = req.body?.channel || req.query?.channel || null;
    const channel =
      rawChannel && ['whatsapp', 'email'].includes(String(rawChannel).toLowerCase())
        ? String(rawChannel).toLowerCase()
        : null;

    const count = markAllNotificationsRead(userId, userRole, channel);
    const unreadCount = getUnreadCountForUser(userId, userRole);
    const whatsappUnreadCount = isAdminUser ? getChannelUnreadCountForAdmin(userId, 'whatsapp') : 0;
    const emailUnreadCount = isAdminUser ? getChannelUnreadCountForAdmin(userId, 'email') : 0;

    return res.json({
      success: true,
      markedCount: count,
      unreadCount,
      whatsappUnreadCount,
      emailUnreadCount,
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
    const isAdminUser = String(userRole).toLowerCase() === 'admin';
    const notificationId = req.params.id;

    const deleted = deleteNotification(notificationId, userId);
    if (!deleted) {
      return res.status(404).json({ error: 'Notification not found.' });
    }

    const unreadCount = getUnreadCountForUser(userId, userRole);
    const whatsappUnreadCount = isAdminUser ? getChannelUnreadCountForAdmin(userId, 'whatsapp') : 0;
    const emailUnreadCount = isAdminUser ? getChannelUnreadCountForAdmin(userId, 'email') : 0;

    return res.json({
      success: true,
      unreadCount,
      whatsappUnreadCount,
      emailUnreadCount,
    });
  } catch (error) {
    console.error('Delete notification error:', error);
    return res.status(500).json({ error: 'Failed to delete notification.' });
  }
});

export default router;
