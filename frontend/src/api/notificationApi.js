import { getToken } from './authApi.js';
import { API_BASE as API_ROOT_BASE } from '../config/api.js';

const API_BASE = `${API_ROOT_BASE}/notifications`;

async function req(url, options = {}) {
  const token = getToken();
  const headers = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(options.headers || {}),
  };

  const res = await fetch(url, { ...options, headers });
  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    throw new Error(data.error || data.message || `Request failed with status ${res.status}`);
  }

  return data;
}

// Get user notifications and unread count (plus WhatsApp & Email counts for admin)
export async function getNotifications() {
  const data = await req(API_BASE);
  return {
    notifications: Array.isArray(data.notifications) ? data.notifications : [],
    unreadCount: typeof data.unreadCount === 'number' ? data.unreadCount : 0,
    whatsappNotifications: Array.isArray(data.whatsappNotifications) ? data.whatsappNotifications : [],
    whatsappUnreadCount: typeof data.whatsappUnreadCount === 'number' ? data.whatsappUnreadCount : 0,
    emailNotifications: Array.isArray(data.emailNotifications) ? data.emailNotifications : [],
    emailUnreadCount: typeof data.emailUnreadCount === 'number' ? data.emailUnreadCount : 0,
  };
}

// Mark single notification as read
export async function markNotificationRead(id) {
  return await req(`${API_BASE}/${id}/read`, {
    method: 'PATCH',
  });
}

// Mark all user notifications as read (optionally scoped to 'whatsapp' or 'email')
export async function markAllNotificationsRead(channel = null) {
  return await req(`${API_BASE}/mark-all-read`, {
    method: 'POST',
    body: JSON.stringify(channel ? { channel } : {}),
  });
}

// Create a WhatsApp or Email notification for Admin
export async function sendChannelNotification({
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
}) {
  return await req(`${API_BASE}/channel`, {
    method: 'POST',
    body: JSON.stringify({
      channel,
      ticketId,
      ticketNumber,
      ticketSubject,
      title,
      message,
      contactInfo,
      clientName,
      recipientId,
      recipientName,
    }),
  });
}

// Delete a single notification
export async function deleteNotification(id) {
  return await req(`${API_BASE}/${id}`, {
    method: 'DELETE',
  });
}

// Send mobile notification to Clients, Employees, All Users, or specific individual
export async function sendMobileNotification({
  target = 'All Users',
  targetId = null,
  targetName = null,
  title = '',
  message = '',
  priority = 'Normal',
  ticketId = null,
  ticketNumber = null,
}) {
  return await req(`${API_BASE}/send-mobile`, {
    method: 'POST',
    body: JSON.stringify({
      target,
      targetId,
      targetName,
      title,
      message,
      priority,
      ticketId,
      ticketNumber,
    }),
  });
}

// Fetch mobile notification dispatch history
export async function getMobileNotificationsHistory() {
  const data = await req(`${API_BASE}/mobile-history`);
  return Array.isArray(data.history) ? data.history : [];
}

// Delete an item from dispatch history
export async function deleteMobileNotificationHistory(id) {
  return await req(`${API_BASE}/mobile-history/${id}`, {
    method: 'DELETE',
  });
}
