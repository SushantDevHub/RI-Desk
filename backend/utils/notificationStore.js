import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { getAllUsers } from './userStore.js';
import { getAllClients } from './clientStore.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, '..', 'data');
const NOTIFICATIONS_FILE = path.join(DATA_DIR, 'notifications.json');
const MOBILE_NOTIFICATIONS_FILE = path.join(DATA_DIR, 'mobile_notifications.json');

function ensureFile() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }

  if (!fs.existsSync(NOTIFICATIONS_FILE)) {
    fs.writeFileSync(NOTIFICATIONS_FILE, '[]');
  }

  if (!fs.existsSync(MOBILE_NOTIFICATIONS_FILE)) {
    fs.writeFileSync(MOBILE_NOTIFICATIONS_FILE, '[]');
  }
}

export function getAllNotifications() {
  ensureFile();
  try {
    const raw = fs.readFileSync(NOTIFICATIONS_FILE, 'utf-8');
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveAllNotifications(items) {
  ensureFile();
  fs.writeFileSync(NOTIFICATIONS_FILE, JSON.stringify(items, null, 2));
}

export function getAllMobileNotifications() {
  ensureFile();
  try {
    const raw = fs.readFileSync(MOBILE_NOTIFICATIONS_FILE, 'utf-8');
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveAllMobileNotifications(items) {
  ensureFile();
  fs.writeFileSync(MOBILE_NOTIFICATIONS_FILE, JSON.stringify(items, null, 2));
}

export function getMobileNotificationsHistory() {
  const all = getAllMobileNotifications();
  return all.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

export function deleteMobileNotification(id) {
  const all = getAllMobileNotifications();
  const index = all.findIndex((m) => String(m.id) === String(id));
  if (index === -1) return false;
  all.splice(index, 1);
  saveAllMobileNotifications(all);
  return true;
}

/**
 * Check if a user is an intended recipient of a notification.
 */
function isUserRecipient(n, userId, userRole = 'employee') {
  const normUserId = String(userId);
  const normRole = String(userRole || '').toLowerCase();

  // If directly targeted by recipientId
  if (n.recipientId && String(n.recipientId) === normUserId) {
    return true;
  }

  // If specific targetId is set
  if (n.targetId && String(n.targetId) === normUserId) {
    return true;
  }

  // Broadcast mobile notifications
  if (n.type === 'mobile_notification') {
    const target = String(n.target || n.recipientType || '').toLowerCase();
    
    // "All Users" or "all" matches everyone
    if (target === 'all' || target === 'all users') {
      return true;
    }

    // Target employees
    if ((target === 'employees' || target === 'employee') && (normRole === 'employee' || normRole === 'admin')) {
      return true;
    }

    // Target clients
    if ((target === 'clients' || target === 'client') && (normRole === 'client' || normRole === 'admin')) {
      return true;
    }

    // Admin can supervise all mobile notifications
    if (normRole === 'admin') {
      return true;
    }
  }

  return false;
}

/**
 * Check if a notification is read by the specific user.
 */
function isNotificationReadByUser(n, userId) {
  if (n.read) return true;
  if (Array.isArray(n.readBy) && n.readBy.map(String).includes(String(userId))) {
    return true;
  }
  return false;
}

export function getNotificationsForUser(userId, userRole = 'employee') {
  const all = getAllNotifications();
  return all
    .filter((n) => isUserRecipient(n, userId, userRole))
    .map((n) => ({
      ...n,
      read: isNotificationReadByUser(n, userId),
    }))
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

export function getUnreadCountForUser(userId, userRole = 'employee') {
  const all = getAllNotifications();
  return all.filter((n) => isUserRecipient(n, userId, userRole) && !isNotificationReadByUser(n, userId)).length;
}

export function addNotification({
  recipientId,
  senderId,
  senderName,
  ticketId,
  ticketNumber,
  ticketSubject,
  workLeft,
  type = 'ticket_transferred',
}) {
  // Prevent sending notification to oneself if direct recipient
  if (recipientId && String(recipientId) === String(senderId)) {
    return null;
  }

  const all = getAllNotifications();
  const newNotif = {
    id: `notif_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    type,
    recipientId,
    senderId,
    senderName: senderName || 'A team member',
    ticketId,
    ticketNumber: ticketNumber || ticketId,
    ticketSubject: ticketSubject || 'Ticket',
    workLeft: workLeft || '',
    read: false,
    readBy: [],
    createdAt: new Date().toISOString(),
  };

  all.unshift(newNotif);
  saveAllNotifications(all);
  return newNotif;
}

/**
 * Dispatch Mobile Push Notification to Clients, Employees, All Users, or specific individual.
 */
export function sendMobileNotification({
  target = 'All Users',
  targetId = null,
  targetName = null,
  title = '',
  message = '',
  priority = 'Normal',
  senderId = 'admin',
  senderName = 'Admin User',
  senderRole = 'admin',
  ticketId = null,
  ticketNumber = null,
}) {
  ensureFile();

  const trimmedMessage = String(message || '').trim();
  if (!trimmedMessage) {
    throw new Error('Notification message is required.');
  }

  const cleanTitle = String(title || '').trim() ||
    (trimmedMessage.length > 50 ? `${trimmedMessage.slice(0, 47)}...` : trimmedMessage);

  // Calculate recipients
  const allUsers = getAllUsers();
  const allClients = getAllClients();
  const employees = allUsers.filter((u) => u.role === 'employee' && u.status !== 'inactive');

  let deliveredCount = 0;
  let recipientsSummary = '';
  const normTarget = String(target || 'All Users').trim();

  if (targetId) {
    // Specific client or employee
    deliveredCount = 1;
    recipientsSummary = targetName || `Specific Recipient (${targetId})`;
  } else if (normTarget.toLowerCase() === 'employees') {
    deliveredCount = employees.length;
    recipientsSummary = `${employees.length} Employee${employees.length === 1 ? '' : 's'}`;
  } else if (normTarget.toLowerCase() === 'clients') {
    deliveredCount = allClients.length;
    recipientsSummary = `${allClients.length} Client${allClients.length === 1 ? '' : 's'}`;
  } else {
    // All Users
    deliveredCount = employees.length + allClients.length;
    recipientsSummary = `All Users (${employees.length} Employees & ${allClients.length} Clients)`;
  }

  const timestamp = new Date().toISOString();
  const mobileNotifId = `mob_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

  // 1. Create Broadcast entry in mobile_notifications.json
  const mobileBroadcastEntry = {
    id: mobileNotifId,
    title: cleanTitle,
    message: trimmedMessage,
    target: normTarget,
    targetId: targetId || null,
    targetName: targetName || normTarget,
    priority: priority || 'Normal',
    senderId,
    senderName,
    senderRole,
    ticketId: ticketId || null,
    ticketNumber: ticketNumber || null,
    status: 'Delivered',
    channel: 'mobile_push',
    deliveredCount,
    recipientsSummary,
    time: 'Just now',
    createdAt: timestamp,
  };

  const mobileHistory = getAllMobileNotifications();
  mobileHistory.unshift(mobileBroadcastEntry);
  saveAllMobileNotifications(mobileHistory);

  // 2. Create in-app notification entry in notifications.json for active in-app delivery
  const inAppNotifEntry = {
    id: `notif_${mobileNotifId}`,
    type: 'mobile_notification',
    mobileNotifId,
    title: cleanTitle,
    message: trimmedMessage,
    target: normTarget,
    targetId: targetId || null,
    targetName: targetName || normTarget,
    priority: priority || 'Normal',
    recipientType: targetId
      ? 'individual'
      : normTarget.toLowerCase() === 'employees'
      ? 'employee'
      : normTarget.toLowerCase() === 'clients'
      ? 'client'
      : 'all',
    recipientId: targetId || (normTarget.toLowerCase() === 'employees' ? 'employees' : normTarget.toLowerCase() === 'clients' ? 'clients' : 'all'),
    senderId,
    senderName,
    senderRole,
    ticketId: ticketId || null,
    ticketNumber: ticketNumber || null,
    read: false,
    readBy: [],
    createdAt: timestamp,
  };

  const notifications = getAllNotifications();
  notifications.unshift(inAppNotifEntry);
  saveAllNotifications(notifications);

  return {
    broadcast: mobileBroadcastEntry,
    inAppNotification: inAppNotifEntry,
  };
}

export function markNotificationRead(notificationId, userId) {
  const all = getAllNotifications();
  const index = all.findIndex((n) => String(n.id) === String(notificationId));

  if (index === -1) return null;

  const item = all[index];
  const readBy = Array.isArray(item.readBy) ? [...item.readBy] : [];
  if (!readBy.map(String).includes(String(userId))) {
    readBy.push(String(userId));
  }

  all[index] = {
    ...item,
    read: true,
    readBy,
    readAt: new Date().toISOString(),
  };

  saveAllNotifications(all);
  return all[index];
}

export function markAllNotificationsRead(userId, userRole = 'employee') {
  const all = getAllNotifications();
  let updatedCount = 0;

  const updated = all.map((n) => {
    if (isUserRecipient(n, userId, userRole)) {
      const readBy = Array.isArray(n.readBy) ? [...n.readBy] : [];
      if (!readBy.map(String).includes(String(userId))) {
        readBy.push(String(userId));
        updatedCount += 1;
      }
      return {
        ...n,
        read: true,
        readBy,
        readAt: new Date().toISOString(),
      };
    }
    return n;
  });

  if (updatedCount > 0) {
    saveAllNotifications(updated);
  }

  return updatedCount;
}

export function deleteNotification(notificationId, userId) {
  const all = getAllNotifications();
  const index = all.findIndex((n) => String(n.id) === String(notificationId));

  if (index === -1) return false;

  all.splice(index, 1);
  saveAllNotifications(all);
  return true;
}
