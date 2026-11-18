import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, '..', 'data');
const CLIENTS_FILE = path.join(DATA_DIR, 'clients.json');

function ensureFile() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }

  if (!fs.existsSync(CLIENTS_FILE)) {
    fs.writeFileSync(CLIENTS_FILE, '[]');
  }
}

export function getAllClients() {
  ensureFile();
  try {
    const raw = fs.readFileSync(CLIENTS_FILE, 'utf-8');
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveAllClients(items) {
  ensureFile();
  fs.writeFileSync(CLIENTS_FILE, JSON.stringify(items, null, 2));
}

export function findClientById(id) {
  const items = getAllClients();
  return items.find((item) => String(item.id).toLowerCase() === String(id).toLowerCase());
}

export function addClient(item) {
  const items = getAllClients();
  items.unshift(item); // Newest on top
  saveAllClients(items);
  return item;
}

export function updateClient(id, updates) {
  const items = getAllClients();
  const index = items.findIndex(
    (item) => String(item.id).toLowerCase() === String(id).toLowerCase()
  );
  if (index === -1) return null;

  items[index] = {
    ...items[index],
    ...updates,
    updatedAt: new Date().toISOString(),
  };
  saveAllClients(items);
  return items[index];
}

export function deleteClient(id) {
  const items = getAllClients();
  const index = items.findIndex(
    (item) => String(item.id).toLowerCase() === String(id).toLowerCase()
  );
  if (index === -1) return null;

  const [removed] = items.splice(index, 1);
  saveAllClients(items);
  return removed;
}
