import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import mongoose from 'mongoose';
import Ticket from '../models/Ticket.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, '..', 'data');
const TICKETS_FILE = path.join(DATA_DIR, 'tickets.json');

// Helper to keep JSON file backup safely preserved in sync without deleting it
function syncJsonBackup(tickets) {
  try {
    cachedTickets = Array.isArray(tickets) ? [...tickets] : [];
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    fs.writeFileSync(TICKETS_FILE, JSON.stringify(tickets, null, 2), 'utf-8');
  } catch {
    // Non-critical background sync
  }
}

let cachedTickets = [];

export function getAllTicketsSync() {
  if (fs.existsSync(TICKETS_FILE)) {
    try {
      cachedTickets = JSON.parse(fs.readFileSync(TICKETS_FILE, 'utf-8'));
      return cachedTickets;
    } catch {
      return [];
    }
  }
  return [];
}

/**
 * Retrieves all tickets using Mongoose Ticket model queries.
 */
export async function getAllTickets() {
  if (mongoose.connection.readyState === 1) {
    const tickets = await Ticket.find({}).lean();
    const mapped = tickets.map((t) => ({
      ...t,
      _id: t._id?.toString(),
    }));
    cachedTickets = mapped;
    return mapped;
  }

  return getAllTicketsSync();
}

/**
 * Saves all tickets using Mongoose upsert and updates backup.
 */
export async function saveAllTickets(tickets) {
  if (mongoose.connection.readyState === 1 && Array.isArray(tickets)) {
    for (const t of tickets) {
      if (!t.id) continue;
      await Ticket.findOneAndUpdate(
        { id: String(t.id) },
        { $set: t },
        { upsert: true, returnDocument: 'after' }
      );
    }
  }
  syncJsonBackup(tickets);
}

/**
 * Adds a new ticket via Mongoose Ticket model.
 */
export async function addTicket(ticketData) {
  if (mongoose.connection.readyState === 1) {
    const created = await Ticket.create(ticketData);
    const result = created.toObject();
    getAllTickets().then(syncJsonBackup).catch(() => {});
    return result;
  }

  const tickets = await getAllTickets();
  tickets.push(ticketData);
  syncJsonBackup(tickets);
  return ticketData;
}

/**
 * Finds ticket by ticket ID (e.g. TKT-1001) using Mongoose.
 */
export async function findTicketById(id) {
  if (mongoose.connection.readyState === 1) {
    const ticket = await Ticket.findOne({ id: String(id) }).lean();
    return ticket ? { ...ticket, _id: ticket._id?.toString() } : null;
  }

  const tickets = await getAllTickets();
  return tickets.find((ticket) => String(ticket.id) === String(id)) || null;
}

/**
 * Updates a ticket by ticket ID via Mongoose.
 */
export async function updateTicket(id, updates) {
  if (mongoose.connection.readyState === 1) {
    const updated = await Ticket.findOneAndUpdate(
      { id: String(id) },
      { $set: updates },
      { returnDocument: 'after' }
    ).lean();
    getAllTickets().then(syncJsonBackup).catch(() => {});
    return updated;
  }

  const tickets = await getAllTickets();
  const index = tickets.findIndex((ticket) => String(ticket.id) === String(id));
  if (index === -1) return null;

  tickets[index] = {
    ...tickets[index],
    ...updates,
  };
  syncJsonBackup(tickets);
  return tickets[index];
}

/**
 * Deletes a ticket by ticket ID via Mongoose.
 */
export async function deleteTicket(id) {
  if (mongoose.connection.readyState === 1) {
    const deleted = await Ticket.findOneAndDelete({ id: String(id) }).lean();
    getAllTickets().then(syncJsonBackup).catch(() => {});
    return deleted;
  }

  const tickets = await getAllTickets();
  const ticketIndex = tickets.findIndex((ticket) => String(ticket.id) === String(id));
  if (ticketIndex === -1) return null;

  const deleted = tickets[ticketIndex];
  tickets.splice(ticketIndex, 1);
  syncJsonBackup(tickets);
  return deleted;
}
