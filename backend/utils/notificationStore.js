import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, '..', 'data');
const NOTIFICATIONS_FILE = path.join(DATA_DIR, 'notifications.json');

function ensureFile() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }

  if (!fs.existsSync(NOTIFICATIONS_FILE)) {
    fs.writeFileSync(NOTIFICATIONS_FILE, '[]');
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

export function getNotificationsForUser(userId) {
  const all = getAllNotifications();
  return all
    .filter(
      (n) =>
        String(n.recipientId) === String(userId) &&
        String(n.senderId) !== String(userId)
    )
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

export function getUnreadCountForUser(userId) {
  const all = getAllNotifications();
  return all.filter(
    (n) =>
      String(n.recipientId) === String(userId) &&
      String(n.senderId) !== String(userId) &&
      !n.read
  ).length;
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
  // Prevent sending notification to oneself
  if (String(recipientId) === String(senderId)) {
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
    createdAt: new Date().toISOString(),
  };

  all.unshift(newNotif);
  saveAllNotifications(all);
  return newNotif;
}

export function markNotificationRead(notificationId, userId) {
  const all = getAllNotifications();
  const index = all.findIndex(
    (n) =>
      String(n.id) === String(notificationId) &&
      String(n.recipientId) === String(userId)
  );

  if (index === -1) return null;

  all[index] = {
    ...all[index],
    read: true,
    readAt: new Date().toISOString(),
  };

  saveAllNotifications(all);
  return all[index];
}

export function markAllNotificationsRead(userId) {
  const all = getAllNotifications();
  let updatedCount = 0;

  const updated = all.map((n) => {
    if (String(n.recipientId) === String(userId) && !n.read) {
      updatedCount += 1;
      return {
        ...n,
        read: true,
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
  const index = all.findIndex(
    (n) =>
      String(n.id) === String(notificationId) &&
      String(n.recipientId) === String(userId)
  );

  if (index === -1) return false;

  all.splice(index, 1);
  saveAllNotifications(all);
  return true;
}
