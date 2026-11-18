import { getToken } from './authApi.js';

const API_BASE = 'http://localhost:4000/api/announcements';

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

// Get active announcements for current user
export async function getActiveAnnouncements() {
  const data = await req(API_BASE);
  return data.announcements || [];
}

// Get all announcements (Admin view, includes inactive/drafts)
export async function getAllAnnouncementsAdmin() {
  const data = await req(`${API_BASE}/admin`);
  return data.announcements || [];
}

// Create a new announcement (Admin only)
export async function createAnnouncement({
  title,
  category,
  audience,
  priority,
  content,
  status = 'Active',
}) {
  const data = await req(API_BASE, {
    method: 'POST',
    body: JSON.stringify({
      title,
      category,
      audience,
      priority,
      content,
      status,
    }),
  });
  return data.announcement;
}

// Update existing announcement (Admin only)
export async function updateAnnouncement(id, updates) {
  const data = await req(`${API_BASE}/${id}`, {
    method: 'PUT',
    body: JSON.stringify(updates),
  });
  return data.announcement;
}

// Toggle announcement status Active <-> Inactive
export async function toggleAnnouncementStatus(id) {
  const data = await req(`${API_BASE}/${id}/toggle-status`, {
    method: 'PATCH',
  });
  return data.announcement;
}

// Delete an announcement (Admin only)
export async function deleteAnnouncement(id) {
  return await req(`${API_BASE}/${id}`, {
    method: 'DELETE',
  });
}
