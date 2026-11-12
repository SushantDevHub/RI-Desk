import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, '..', 'data');
const DESIGNATIONS_FILE = path.join(DATA_DIR, 'designations.json');

function ensureFile() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }

  if (!fs.existsSync(DESIGNATIONS_FILE)) {
    fs.writeFileSync(DESIGNATIONS_FILE, '[]');
  }
}

export function getAllDesignations() {
  ensureFile();
  try {
    const raw = fs.readFileSync(DESIGNATIONS_FILE, 'utf-8');
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveAllDesignations(items) {
  ensureFile();
  fs.writeFileSync(DESIGNATIONS_FILE, JSON.stringify(items, null, 2));
}

export function findDesignationById(id) {
  const items = getAllDesignations();
  return items.find((item) => String(item.id) === String(id));
}

export function addDesignation(item) {
  const items = getAllDesignations();
  items.push(item);
  saveAllDesignations(items);
  return item;
}

export function updateDesignation(id, updates) {
  const items = getAllDesignations();
  const index = items.findIndex((item) => String(item.id) === String(id));
  if (index === -1) return null;

  items[index] = {
    ...items[index],
    ...updates,
  };
  saveAllDesignations(items);
  return items[index];
}

export function deleteDesignation(id) {
  const items = getAllDesignations();
  const index = items.findIndex((item) => String(item.id) === String(id));
  if (index === -1) return null;

  const [removed] = items.splice(index, 1);
  saveAllDesignations(items);
  return removed;
}
