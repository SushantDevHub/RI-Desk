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

// Get user notifications and unread count
export async function getNotifications() {
  const data = await req(API_BASE);
  return {
    notifications: Array.isArray(data.notifications) ? data.notifications : [],
    unreadCount: typeof data.unreadCount === 'number' ? data.unreadCount : 0,
  };
}

// Mark single notification as read
export async function markNotificationRead(id) {
  return await req(`${API_BASE}/${id}/read`, {
    method: 'PATCH',
  });
}

// Mark all user notifications as read
export async function markAllNotificationsRead() {
  return await req(`${API_BASE}/mark-all-read`, {
    method: 'POST',
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
