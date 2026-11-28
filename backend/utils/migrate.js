import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { getPool } from '../config/db.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, '..', 'data');
const USERS_FILE = path.join(DATA_DIR, 'users.json');
const TICKETS_FILE = path.join(DATA_DIR, 'tickets.json');
const CLIENTS_FILE = path.join(DATA_DIR, 'clients.json');

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

/**
 * Safely seeds missing records from local JSON backup files into MySQL
 * using parameterized INSERT IGNORE statements (preserves existing MySQL rows).
 */
export async function migrateFromJSON() {
  const pool = getPool();
  if (!pool) {
    return { usersMigrated: 0, ticketsMigrated: 0, clientsMigrated: 0 };
  }

  let usersMigrated = 0;
  let ticketsMigrated = 0;
  let clientsMigrated = 0;

  if (fs.existsSync(USERS_FILE)) {
    try {
      const users = JSON.parse(fs.readFileSync(USERS_FILE, 'utf-8'));
      if (Array.isArray(users)) {
        for (const u of users) {
          if (!u || u.id === undefined || !u.mobileNumber) continue;
          const [res] = await pool.execute(
            `INSERT IGNORE INTO users
              (id, name, email, mobileNumber, password, role, designation, status, createdAt, updatedAt)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              Number(u.id),
              String(u.name || ''),
              String(u.email || ''),
              String(u.mobileNumber),
              String(u.password || ''),
              ['admin', 'employee', 'client'].includes(String(u.role)) ? String(u.role) : 'employee',
              String(u.designation || ''),
              u.status === 'inactive' ? 'inactive' : 'active',
              toIsoString(u.createdAt, new Date().toISOString()),
              toIsoString(u.updatedAt, new Date().toISOString()),
            ]
          );
          if (res.affectedRows > 0) usersMigrated++;
        }
      }
    } catch (err) {
      console.error('[MySQL Migration] Warning reading users.json:', err.message);
    }
  }

  if (fs.existsSync(TICKETS_FILE)) {
    try {
      const tickets = JSON.parse(fs.readFileSync(TICKETS_FILE, 'utf-8'));
      if (Array.isArray(tickets)) {
        for (const t of tickets) {
          if (!t || !t.id) continue;
          const unassigned =
            t.isUnassigned !== undefined
              ? t.isUnassigned
              : !t.assignedToId && (!t.assignedTo || String(t.assignedTo).toLowerCase() === 'unassigned');

          const [res] = await pool.execute(
            `INSERT IGNORE INTO tickets
              (id, subject, category, description, priority, status, userType,
               client, customer, clientMobile, customerMobile, clientEmail, customerEmail, email,
               createdBy, createdById, assignedTo, assignedToId, assignedEmployeeId,
               operator, providerName, transactionId, amount, screenshot, source, isUnassigned,
               createdAt, updatedAt, resolvedAt, resolution, resolutionTime, resolvedBy, resolvedById,
               lastTransferredAt, lastTransferredBy, transferNotes, logs, activityLog)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
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
              unassigned ? 1 : 0,
              toIsoString(t.createdAt, new Date().toISOString()),
              toIsoString(t.updatedAt, new Date().toISOString()),
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
            ]
          );
          if (res.affectedRows > 0) ticketsMigrated++;
        }
      }
    } catch (err) {
      console.error('[MySQL Migration] Warning reading tickets.json:', err.message);
    }
  }

  if (fs.existsSync(CLIENTS_FILE)) {
    try {
      const clients = JSON.parse(fs.readFileSync(CLIENTS_FILE, 'utf-8'));
      if (Array.isArray(clients)) {
        for (const c of clients) {
          if (!c || !c.id) continue;
          const [res] = await pool.execute(
            `INSERT IGNORE INTO clients
              (id, name, companyName, address, website, mobileNumber, email, whatsappNumber,
               cityState, monthlyRental, services, features, servicesFeatures, status,
               createdBy, ticketCount, tickets, createdAt, updatedAt)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              String(c.id),
              String(c.name || ''),
              String(c.companyName || ''),
              c.address ?? '',
              String(c.website || ''),
              String(c.mobileNumber || ''),
              String(c.email || ''),
              String(c.whatsappNumber || ''),
              String(c.cityState || ''),
              Number.isFinite(Number(c.monthlyRental)) ? Number(c.monthlyRental) : 0,
              serializeJson(c.services, []),
              serializeJson(c.features, []),
              serializeJson(c.servicesFeatures, []),
              c.status === 'inactive' ? 'inactive' : 'active',
              String(c.createdBy || 'Admin User'),
              Number.isFinite(Number(c.ticketCount)) ? Number(c.ticketCount) : 0,
              serializeJson(c.tickets, []),
              toIsoString(c.createdAt, new Date().toISOString()),
              toIsoString(c.updatedAt, new Date().toISOString()),
            ]
          );
          if (res.affectedRows > 0) clientsMigrated++;
        }
      }
    } catch (err) {
      console.error('[MySQL Migration] Warning reading clients.json:', err.message);
    }
  }

  if (usersMigrated > 0 || ticketsMigrated > 0 || clientsMigrated > 0) {
    console.log(
      `[MySQL JSON Backfill] Added missing records -> Users: ${usersMigrated} | Tickets: ${ticketsMigrated} | Clients: ${clientsMigrated}`
    );
  }

  return { usersMigrated, ticketsMigrated, clientsMigrated };
}
