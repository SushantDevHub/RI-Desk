import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR   = path.join(__dirname, '..', 'data');
const TICKETS_FILE = path.join(DATA_DIR, 'tickets.json');

function ensureFile() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(TICKETS_FILE)) fs.writeFileSync(TICKETS_FILE, '[]');
}

export function getAllTickets() {
  ensureFile();
  return JSON.parse(fs.readFileSync(TICKETS_FILE, 'utf-8'));
}

export function saveAllTickets(tickets) {
  ensureFile();
  fs.writeFileSync(TICKETS_FILE, JSON.stringify(tickets, null, 2));
}

export function addTicket(ticket) {
  const tickets = getAllTickets();
  tickets.push(ticket);
  saveAllTickets(tickets);
  return ticket;
}