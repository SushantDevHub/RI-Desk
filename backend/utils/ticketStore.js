import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { getPool } from '../config/db.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, '..', 'data');
const TICKETS_FILE = path.join(DATA_DIR, 'tickets.json');

let cachedTickets = [];

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

function parseJsonColumn(val, fallback = []) {
  if (Array.isArray(val)) return val;
  if (val && typeof val === 'object') return val;
  if (typeof val === 'string') {
    try {
      const parsed = JSON.parse(val);
      return parsed ?? fallback;
    } catch {
      return fallback;
    }
  }
  return fallback;
}

function parseResolutionTime(val) {
  if (val === null || val === undefined || val === '') return null;
  if (typeof val === 'number' || typeof val === 'object') return val;
  const str = String(val).trim();
  if ((str.startsWith('{') && str.endsWith('}')) || (str.startsWith('[') && str.endsWith(']'))) {
    try {
      return JSON.parse(str);
    } catch {
      return str;
    }
  }
  if (/^-?\d+(\.\d+)?$/.test(str)) {
    return Number(str);
  }
  return str;
}

function toIsoString(val, fallback = null) {
  if (!val) return fallback;
  if (val instanceof Date) return val.toISOString();
  return String(val);
}

function serializeJson(val, defaultVal = []) {
  if (val === null || val === undefined) return JSON.stringify(defaultVal);
  if (typeof val === 'string') return val;
  return JSON.stringify(val);
}

function computeIsUnassigned(ticket) {
  if (ticket.isUnassigned !== undefined && ticket.isUnassigned !== null) {
    return Boolean(ticket.isUnassigned);
  }
  const hasId =
    ticket.assignedToId !== null &&
    ticket.assignedToId !== undefined &&
    ticket.assignedToId !== '' &&
    ticket.assignedToId !== 0;
  const hasName =
    Boolean(ticket.assignedTo) &&
    String(ticket.assignedTo).trim().toLowerCase() !== 'unassigned' &&
    String(ticket.assignedTo).trim() !== '';
  return !hasId && !hasName;
}

function mapTicketRow(row) {
  if (!row) return null;
  return {
    id: String(row.id),
    subject: row.subject || '',
    category: row.category || '',
    description: row.description || '',
    priority: row.priority || 'medium',
    status: row.status || 'open',
    userType: row.userType || 'client',
    client: row.client || '',
    customer: row.customer || '',
    clientMobile: row.clientMobile || '',
    customerMobile: row.customerMobile || '',
    clientEmail: row.clientEmail || '',
    customerEmail: row.customerEmail || '',
    email: row.email || '',
    createdBy: row.createdBy || 'Client',
    createdById: row.createdById !== null && row.createdById !== undefined ? Number(row.createdById) : null,
    assignedTo: row.assignedTo ?? null,
    assignedToId: row.assignedToId !== null && row.assignedToId !== undefined ? Number(row.assignedToId) : null,
    assignedEmployeeId:
      row.assignedEmployeeId !== null && row.assignedEmployeeId !== undefined
        ? Number(row.assignedEmployeeId)
        : null,
    operator: row.operator ?? null,
    providerName: row.providerName ?? null,
    transactionId: row.transactionId ?? null,
    amount: row.amount !== null && row.amount !== undefined ? Number(row.amount) : null,
    screenshot: row.screenshot ?? null,
    source: row.source || 'self_service_portal',
    isUnassigned: Boolean(row.isUnassigned),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    resolvedAt: row.resolvedAt ?? null,
    resolution: row.resolution ?? null,
    resolutionTime: parseResolutionTime(row.resolutionTime),
    resolvedBy: row.resolvedBy ?? null,
    resolvedById: row.resolvedById !== null && row.resolvedById !== undefined ? Number(row.resolvedById) : null,
    lastTransferredAt: row.lastTransferredAt ?? null,
    lastTransferredBy: row.lastTransferredBy ?? null,
    transferNotes: row.transferNotes ?? null,
    logs: parseJsonColumn(row.logs, []),
    activityLog: parseJsonColumn(row.activityLog, []),
  };
}

function buildTicketDbParams(t) {
  const now = new Date().toISOString();
  return [
    String(t.id),
    String(t.subject || ''),
    String(t.category || ''),
    t.description ?? '',
    ['low', 'medium', 'high'].includes(String(t.priority)) ? String(t.priority) : 'medium',
    ['open', 'in-progress', 'resolved'].includes(String(t.status)) ? String(t.status) : 'open',
    String(t.userType || 'client'),
    String(t.client || ''),
    String(t.customer || ''),
    String(t.clientMobile || ''),
    String(t.customerMobile || ''),
    String(t.clientEmail || ''),
    String(t.customerEmail || ''),
    String(t.email || ''),
    String(t.createdBy || 'Client'),
    t.createdById !== undefined && t.createdById !== null ? Number(t.createdById) : null,
    t.assignedTo ?? null,
    t.assignedToId !== undefined && t.assignedToId !== null ? Number(t.assignedToId) : null,
    t.assignedEmployeeId !== undefined && t.assignedEmployeeId !== null ? Number(t.assignedEmployeeId) : null,
    t.operator ?? null,
    t.providerName ?? null,
    t.transactionId ?? null,
    t.amount !== undefined && t.amount !== null && t.amount !== '' ? Number(t.amount) : null,
    t.screenshot ?? null,
    String(t.source || 'self_service_portal'),
    computeIsUnassigned(t) ? 1 : 0,
    toIsoString(t.createdAt, now),
    toIsoString(t.updatedAt, now),
    toIsoString(t.resolvedAt, null),
    t.resolution ?? null,
    t.resolutionTime !== undefined && t.resolutionTime !== null
      ? typeof t.resolutionTime === 'object'
        ? JSON.stringify(t.resolutionTime)
        : String(t.resolutionTime)
      : null,
    t.resolvedBy ?? null,
    t.resolvedById !== undefined && t.resolvedById !== null ? Number(t.resolvedById) : null,
    toIsoString(t.lastTransferredAt, null),
    t.lastTransferredBy ?? null,
    t.transferNotes ?? null,
    serializeJson(t.logs, []),
    serializeJson(t.activityLog, []),
  ];
}

export function getAllTicketsSync() {
  if (cachedTickets.length > 0) {
    return cachedTickets;
  }
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

async function refreshTicketsBackup(pool) {
  try {
    const [rows] = await pool.query('SELECT * FROM tickets');
    const mapped = rows.map(mapTicketRow);
    syncJsonBackup(mapped);
    return mapped;
  } catch {
    return cachedTickets;
  }
}

/**
 * Retrieves all tickets from MySQL (or JSON fallback when DB is unavailable).
 */
export async function getAllTickets() {
  const pool = getPool();
  if (pool) {
    const [rows] = await pool.query('SELECT * FROM tickets');
    const mapped = rows.map(mapTicketRow);
    syncJsonBackup(mapped);
    return mapped;
  }

  return getAllTicketsSync();
}

/**
 * Saves all tickets using parameterized MySQL upsert and updates JSON backup.
 */
export async function saveAllTickets(tickets) {
  const pool = getPool();
  if (pool && Array.isArray(tickets)) {
    for (const t of tickets) {
      if (!t.id) continue;
      await pool.execute(
        `INSERT INTO tickets
          (id, subject, category, description, priority, status, userType,
           client, customer, clientMobile, customerMobile, clientEmail, customerEmail, email,
           createdBy, createdById, assignedTo, assignedToId, assignedEmployeeId,
           operator, providerName, transactionId, amount, screenshot, source, isUnassigned,
           createdAt, updatedAt, resolvedAt, resolution, resolutionTime, resolvedBy, resolvedById,
           lastTransferredAt, lastTransferredBy, transferNotes, logs, activityLog)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE
          subject = VALUES(subject),
          category = VALUES(category),
          description = VALUES(description),
          priority = VALUES(priority),
          status = VALUES(status),
          userType = VALUES(userType),
          client = VALUES(client),
          customer = VALUES(customer),
          clientMobile = VALUES(clientMobile),
          customerMobile = VALUES(customerMobile),
          clientEmail = VALUES(clientEmail),
          customerEmail = VALUES(customerEmail),
          email = VALUES(email),
          createdBy = VALUES(createdBy),
          createdById = VALUES(createdById),
          assignedTo = VALUES(assignedTo),
          assignedToId = VALUES(assignedToId),
          assignedEmployeeId = VALUES(assignedEmployeeId),
          operator = VALUES(operator),
          providerName = VALUES(providerName),
          transactionId = VALUES(transactionId),
          amount = VALUES(amount),
          screenshot = VALUES(screenshot),
          source = VALUES(source),
          isUnassigned = VALUES(isUnassigned),
          updatedAt = VALUES(updatedAt),
          resolvedAt = VALUES(resolvedAt),
          resolution = VALUES(resolution),
          resolutionTime = VALUES(resolutionTime),
          resolvedBy = VALUES(resolvedBy),
          resolvedById = VALUES(resolvedById),
          lastTransferredAt = VALUES(lastTransferredAt),
          lastTransferredBy = VALUES(lastTransferredBy),
          transferNotes = VALUES(transferNotes),
          logs = VALUES(logs),
          activityLog = VALUES(activityLog)`,
        buildTicketDbParams(t)
      );
    }
  }
  syncJsonBackup(tickets);
}

/**
 * Adds a new ticket via parameterized MySQL INSERT.
 */
export async function addTicket(ticketData) {
  const pool = getPool();
  if (pool) {
    await pool.execute(
      `INSERT INTO tickets
        (id, subject, category, description, priority, status, userType,
         client, customer, clientMobile, customerMobile, clientEmail, customerEmail, email,
         createdBy, createdById, assignedTo, assignedToId, assignedEmployeeId,
         operator, providerName, transactionId, amount, screenshot, source, isUnassigned,
         createdAt, updatedAt, resolvedAt, resolution, resolutionTime, resolvedBy, resolvedById,
         lastTransferredAt, lastTransferredBy, transferNotes, logs, activityLog)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      buildTicketDbParams(ticketData)
    );
    const created = await findTicketById(ticketData.id);
    await refreshTicketsBackup(pool);
    return created || ticketData;
  }

  const tickets = await getAllTickets();
  tickets.push(ticketData);
  syncJsonBackup(tickets);
  return ticketData;
}

/**
 * Finds ticket by ticket ID (e.g. TKT-1001) using parameterized MySQL SELECT.
 */
export async function findTicketById(id) {
  const pool = getPool();
  if (pool) {
    const [rows] = await pool.execute('SELECT * FROM tickets WHERE id = ? LIMIT 1', [String(id)]);
    return rows.length > 0 ? mapTicketRow(rows[0]) : null;
  }

  const tickets = await getAllTickets();
  return tickets.find((ticket) => String(ticket.id) === String(id)) || null;
}

const TICKET_UPDATABLE_COLUMNS = new Set([
  'subject',
  'category',
  'description',
  'priority',
  'status',
  'userType',
  'client',
  'customer',
  'clientMobile',
  'customerMobile',
  'clientEmail',
  'customerEmail',
  'email',
  'createdBy',
  'createdById',
  'assignedTo',
  'assignedToId',
  'assignedEmployeeId',
  'operator',
  'providerName',
  'transactionId',
  'amount',
  'screenshot',
  'source',
  'isUnassigned',
  'updatedAt',
  'resolvedAt',
  'resolution',
  'resolutionTime',
  'resolvedBy',
  'resolvedById',
  'lastTransferredAt',
  'lastTransferredBy',
  'transferNotes',
  'logs',
  'activityLog',
]);

/**
 * Updates a ticket by ticket ID via parameterized MySQL UPDATE.
 */
export async function updateTicket(id, updates) {
  const pool = getPool();
  const strId = String(id);

  if (pool) {
    const nextUpdates = { ...(updates || {}) };
    if (
      (nextUpdates.assignedToId !== undefined || nextUpdates.assignedTo !== undefined) &&
      nextUpdates.isUnassigned === undefined
    ) {
      const hasId =
        nextUpdates.assignedToId !== null &&
        nextUpdates.assignedToId !== undefined &&
        nextUpdates.assignedToId !== '' &&
        nextUpdates.assignedToId !== 0;
      const hasName =
        Boolean(nextUpdates.assignedTo) &&
        String(nextUpdates.assignedTo).trim().toLowerCase() !== 'unassigned' &&
        String(nextUpdates.assignedTo).trim() !== '';
      nextUpdates.isUnassigned = !hasId && !hasName;
    }

    const entries = Object.entries(nextUpdates).filter(([key]) =>
      TICKET_UPDATABLE_COLUMNS.has(key)
    );
    if (!entries.some(([key]) => key === 'updatedAt')) {
      entries.push(['updatedAt', new Date().toISOString()]);
    }

    if (entries.length === 0) {
      return await findTicketById(strId);
    }

    const setClauses = entries.map(([key]) => `\`${key}\` = ?`).join(', ');
    const values = entries.map(([key, val]) => {
      if (key === 'logs' || key === 'activityLog') {
        return serializeJson(val, []);
      }
      if (key === 'isUnassigned') {
        return val ? 1 : 0;
      }
      if (key === 'resolutionTime') {
        if (val === undefined || val === null) return null;
        return typeof val === 'object' ? JSON.stringify(val) : String(val);
      }
      if (
        key === 'createdById' ||
        key === 'assignedToId' ||
        key === 'assignedEmployeeId' ||
        key === 'resolvedById' ||
        key === 'amount'
      ) {
        return val !== undefined && val !== null && val !== '' ? Number(val) : null;
      }
      if (key === 'priority') {
        return ['low', 'medium', 'high'].includes(String(val)) ? String(val) : 'medium';
      }
      if (key === 'status') {
        return ['open', 'in-progress', 'resolved'].includes(String(val)) ? String(val) : 'open';
      }
      return val === undefined ? null : val;
    });
    values.push(strId);

    const [result] = await pool.execute(
      `UPDATE tickets SET ${setClauses} WHERE id = ?`,
      values
    );
    if (result.affectedRows === 0) {
      return null;
    }

    const updated = await findTicketById(strId);
    await refreshTicketsBackup(pool);
    return updated;
  }

  const tickets = await getAllTickets();
  const index = tickets.findIndex((ticket) => String(ticket.id) === strId);
  if (index === -1) return null;

  tickets[index] = {
    ...tickets[index],
    ...updates,
  };
  syncJsonBackup(tickets);
  return tickets[index];
}

/**
 * Deletes a ticket by ticket ID via parameterized MySQL DELETE.
 */
export async function deleteTicket(id) {
  const pool = getPool();
  const strId = String(id);

  if (pool) {
    const existing = await findTicketById(strId);
    if (!existing) return null;
    await pool.execute('DELETE FROM tickets WHERE id = ?', [strId]);
    await refreshTicketsBackup(pool);
    return existing;
  }

  const tickets = await getAllTickets();
  const ticketIndex = tickets.findIndex((ticket) => String(ticket.id) === strId);
  if (ticketIndex === -1) return null;

  const deleted = tickets[ticketIndex];
  tickets.splice(ticketIndex, 1);
  syncJsonBackup(tickets);
  return deleted;
}
