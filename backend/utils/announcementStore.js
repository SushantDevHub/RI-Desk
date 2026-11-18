import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, '..', 'data');
const ANNOUNCEMENTS_FILE = path.join(DATA_DIR, 'announcements.json');

function ensureFile() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }

  if (!fs.existsSync(ANNOUNCEMENTS_FILE)) {
    fs.writeFileSync(ANNOUNCEMENTS_FILE, '[]');
  }
}

export function getAllAnnouncements() {
  ensureFile();
  try {
    const raw = fs.readFileSync(ANNOUNCEMENTS_FILE, 'utf-8');
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveAllAnnouncements(items) {
  ensureFile();
  fs.writeFileSync(ANNOUNCEMENTS_FILE, JSON.stringify(items, null, 2));
}

export function findAnnouncementById(id) {
  const items = getAllAnnouncements();
  return items.find((item) => String(item.id) === String(id));
}

export function addAnnouncement(item) {
  const items = getAllAnnouncements();
  items.unshift(item); // Most recent first
  saveAllAnnouncements(items);
  return item;
}

export function updateAnnouncement(id, updates) {
  const items = getAllAnnouncements();
  const index = items.findIndex((item) => String(item.id) === String(id));
  if (index === -1) return null;

  items[index] = {
    ...items[index],
    ...updates,
    updatedAt: new Date().toISOString(),
  };
  saveAllAnnouncements(items);
  return items[index];
}

export function deleteAnnouncement(id) {
  const items = getAllAnnouncements();
  const index = items.findIndex((item) => String(item.id) === String(id));
  if (index === -1) return false;

  items.splice(index, 1);
  saveAllAnnouncements(items);
  return true;
}
