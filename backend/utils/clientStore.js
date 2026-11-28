import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { getPool } from '../config/db.js';
import { getAllTickets, getAllTicketsSync } from './ticketStore.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, '..', 'data');
const CLIENTS_FILE = path.join(DATA_DIR, 'clients.json');

let cachedClients = [];
let lastWrittenClientsJson = null;

function ensureFile() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }

  if (!fs.existsSync(CLIENTS_FILE)) {
    fs.writeFileSync(CLIENTS_FILE, '[]');
    lastWrittenClientsJson = '[]';
  }
}

function syncJsonBackup(clients) {
  try {
    ensureFile();
    cachedClients = Array.isArray(clients) ? [...clients] : [];
    const serialized = JSON.stringify(clients, null, 2);
    if (serialized === lastWrittenClientsJson) {
      return;
    }
    fs.writeFileSync(CLIENTS_FILE, serialized);
    lastWrittenClientsJson = serialized;
  } catch {
    // Non-critical backup sync
  }
}

function parseJsonColumn(val, fallback = []) {
  if (Array.isArray(val)) return val;
  if (typeof val === 'string') {
    try {
      const parsed = JSON.parse(val);
      return Array.isArray(parsed) ? parsed : fallback;
    } catch {
      return fallback;
    }
  }
  return fallback;
}

function serializeJson(val, defaultVal = []) {
  if (val === null || val === undefined) return JSON.stringify(defaultVal);
  if (typeof val === 'string') return val;
  return JSON.stringify(val);
}

function toIsoString(val, fallback = null) {
  if (!val) return fallback;
  if (val instanceof Date) return val.toISOString();
  return String(val);
}

function mapClientRow(row) {
  if (!row) return null;
  return {
    id: String(row.id),
    name: row.name || '',
    companyName: row.companyName || '',
    address: row.address || '',
    website: row.website || '',
    mobileNumber: row.mobileNumber || '',
    email: row.email || '',
    whatsappNumber: row.whatsappNumber || '',
    cityState: row.cityState || '',
    monthlyRental: Number.isFinite(Number(row.monthlyRental)) ? Number(row.monthlyRental) : 0,
    services: parseJsonColumn(row.services, []),
    features: parseJsonColumn(row.features, []),
    servicesFeatures: parseJsonColumn(row.servicesFeatures, []),
    status: row.status === 'inactive' ? 'inactive' : 'active',
    createdBy: row.createdBy || 'Admin User',
    ticketCount: Number.isFinite(Number(row.ticketCount)) ? Number(row.ticketCount) : 0,
    tickets: parseJsonColumn(row.tickets, []),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function buildClientDbParams(c) {
  const now = new Date().toISOString();
  return [
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
    toIsoString(c.createdAt, now),
    toIsoString(c.updatedAt, now),
  ];
}

export function getAllClientsSync() {
  if (cachedClients.length > 0) {
    return cachedClients;
  }
  if (fs.existsSync(CLIENTS_FILE)) {
    try {
      const raw = fs.readFileSync(CLIENTS_FILE, 'utf-8');
      lastWrittenClientsJson = raw;
      const parsed = JSON.parse(raw);
      cachedClients = Array.isArray(parsed) ? parsed : [];
      return cachedClients;
    } catch {
      return [];
    }
  }
  return [];
}

function sortClientsList(clients) {
  return clients.slice().sort((a, b) => {
    const timeA = new Date(a.createdAt || 0).getTime();
    const timeB = new Date(b.createdAt || 0).getTime();
    if (!isNaN(timeA) && !isNaN(timeB) && timeB !== timeA) {
      return timeB - timeA;
    }
    return String(b.id || '').localeCompare(String(a.id || ''), undefined, {
      numeric: true,
    });
  });
}

function cleanStringArray(arr) {
  if (Array.isArray(arr)) {
    return Array.from(
      new Set(
        arr
          .map((item) => String(item || '').trim())
          .filter(Boolean)
      )
    );
  }
  if (typeof arr === 'string') {
    return Array.from(
      new Set(
        arr
          .split(/[,;|]/)
          .map((item) => item.trim())
          .filter(Boolean)
      )
    );
  }
  return [];
}

/**
 * Synchronizes client data with ticket customers, removing mock/dummy data.
 * Optionally merges onto a provided base client list and base ticket list (from MySQL).
 */
export function syncClientsWithTickets(baseClients = null, baseTickets = null) {
  ensureFile();
  let existingClients = [];

  if (Array.isArray(baseClients)) {
    existingClients = [...baseClients];
  } else {
    existingClients = getAllClientsSync();
  }

  const dummyNames = [
    'amitabh sharma',
    'priya nair',
    'vikram malhotra',
    'apex technologies pvt ltd',
    'finedge solutions',
    'v-logistics global',
  ];
  existingClients = existingClients.filter((c) => {
    const name = String(c.name || '').trim().toLowerCase();
    const comp = String(c.companyName || '').trim().toLowerCase();
    return !dummyNames.includes(name) && !dummyNames.includes(comp);
  });

  let tickets = [];
  if (Array.isArray(baseTickets)) {
    tickets = baseTickets;
  } else {
    try {
      const res = getAllTicketsSync();
      tickets = Array.isArray(res) ? res : [];
    } catch {
      tickets = [];
    }
  }

  const customerMap = new Map();

  tickets.forEach((ticket) => {
    const customer = String(ticket.customer || ticket.client || '').trim();
    const mobile = String(ticket.customerMobile || ticket.clientMobile || '').trim();
    const email = String(ticket.email || ticket.clientEmail || ticket.customerEmail || '').trim();
    if (!customer && !mobile) return;

    const key = mobile.replace(/\D/g, '') || customer.toLowerCase();

    if (!customerMap.has(key)) {
      customerMap.set(key, {
        name: customer,
        mobileNumber: mobile,
        email: email,
        tickets: [],
        categories: new Set(),
        earliestCreatedAt: ticket.createdAt,
        latestUpdatedAt: ticket.updatedAt || ticket.createdAt,
      });
    }

    const group = customerMap.get(key);
    if (customer && !group.name) group.name = customer;
    if (mobile && !group.mobileNumber) group.mobileNumber = mobile;
    if (email && !group.email) group.email = email;

    const cat = String(ticket.category || '').trim();
    if (cat) {
      const capCat = cat.charAt(0).toUpperCase() + cat.slice(1).toLowerCase();
      group.categories.add(capCat);
    }

    group.tickets.push({
      id: ticket.id,
      subject: ticket.subject || '',
      category: cat ? cat.charAt(0).toUpperCase() + cat.slice(1).toLowerCase() : 'General',
      priority: ticket.priority || 'medium',
      status: ticket.status || 'open',
      createdAt: ticket.createdAt,
      updatedAt: ticket.updatedAt || ticket.createdAt,
    });

    if (ticket.createdAt && (!group.earliestCreatedAt || new Date(ticket.createdAt) < new Date(group.earliestCreatedAt))) {
      group.earliestCreatedAt = ticket.createdAt;
    }
    if (ticket.updatedAt && (!group.latestUpdatedAt || new Date(ticket.updatedAt) > new Date(group.latestUpdatedAt))) {
      group.latestUpdatedAt = ticket.updatedAt;
    }
  });

  let nextCliNumber = 1001;
  const mergedClients = [...existingClients];
  const indexByMobile = new Map();
  const indexByName = new Map();

  mergedClients.forEach((c, idx) => {
    const m = String(c.id || '').match(/^CLI-(\d+)$/i);
    if (m) {
      nextCliNumber = Math.max(nextCliNumber, Number(m[1]) + 1);
    }
    const cMob = String(c.mobileNumber || '').replace(/\D/g, '');
    if (cMob && !indexByMobile.has(cMob)) {
      indexByMobile.set(cMob, idx);
    }
    const cName = String(c.name || '').trim().toLowerCase();
    if (cName && !indexByName.has(cName)) {
      indexByName.set(cName, idx);
    }
    const cComp = String(c.companyName || '').trim().toLowerCase();
    if (cComp && !indexByName.has(cComp)) {
      indexByName.set(cComp, idx);
    }
  });

  const findExistingIndex = (group) => {
    const normMob = (group.mobileNumber || '').replace(/\D/g, '');
    if (normMob && indexByMobile.has(normMob)) {
      return indexByMobile.get(normMob);
    }
    const normName = (group.name || '').trim().toLowerCase();
    if (normName && indexByName.has(normName)) {
      return indexByName.get(normName);
    }
    return -1;
  };

  customerMap.forEach((group) => {
    const existingIndex = findExistingIndex(group);
    const servicesFromTickets = Array.from(group.categories);

    if (existingIndex !== -1) {
      const existing = mergedClients[existingIndex];
      const mergedServices = Array.from(new Set([...(existing.services || []), ...servicesFromTickets]));
      const features = (Array.isArray(existing.features) && existing.features.length > 0
        ? existing.features
        : ['WhatsApp', 'Email']
      ).filter((f) => f !== 'SMS');

      mergedClients[existingIndex] = {
        ...existing,
        name: existing.name || group.name,
        companyName: existing.companyName || group.name,
        mobileNumber: existing.mobileNumber || group.mobileNumber,
        email: existing.email || group.email || '',
        whatsappNumber: existing.whatsappNumber || existing.mobileNumber || group.mobileNumber,
        services: mergedServices,
        features,
        servicesFeatures: Array.from(new Set([...mergedServices, ...features])),
        ticketCount: group.tickets.length,
        tickets: group.tickets,
        updatedAt: group.latestUpdatedAt || existing.updatedAt,
      };
    } else {
      const features = ['WhatsApp', 'Email'];
      const newClient = {
        id: `CLI-${nextCliNumber++}`,
        name: group.name || 'Client',
        companyName: group.name || 'Client Company',
        address: '',
        website: '',
        mobileNumber: group.mobileNumber || '',
        email: group.email || '',
        whatsappNumber: group.mobileNumber || '',
        cityState: '',
        monthlyRental: 0,
        services: servicesFromTickets.length > 0 ? servicesFromTickets : ['Recharge'],
        features,
        servicesFeatures: Array.from(new Set([...servicesFromTickets, ...features])),
        status: 'active',
        createdAt: group.earliestCreatedAt || new Date().toISOString(),
        updatedAt: group.latestUpdatedAt || new Date().toISOString(),
        createdBy: 'Ticket Sync',
        ticketCount: group.tickets.length,
        tickets: group.tickets,
      };
      mergedClients.push(newClient);
    }
  });

  mergedClients.forEach((client) => {
    if (!client.ticketCount && !client.tickets) {
      const normMob = (client.mobileNumber || '').replace(/\D/g, '');
      const normName = (client.name || '').toLowerCase();
      const matchedGroup = Array.from(customerMap.values()).find((g) => {
        const gMob = (g.mobileNumber || '').replace(/\D/g, '');
        const gName = (g.name || '').toLowerCase();
        return (normMob && gMob && normMob === gMob) || (normName && gName === normName);
      });
      if (matchedGroup) {
        client.ticketCount = matchedGroup.tickets.length;
        client.tickets = matchedGroup.tickets;
      } else {
        client.ticketCount = client.ticketCount || 0;
        client.tickets = client.tickets || [];
      }
    }
  });

  mergedClients.forEach((client) => {
    if (Array.isArray(client.features)) {
      client.features = client.features.filter((f) => f !== 'SMS');
    }
    if (Array.isArray(client.servicesFeatures)) {
      client.servicesFeatures = client.servicesFeatures.filter((f) => f !== 'SMS');
    }
  });

  syncJsonBackup(mergedClients);
  return mergedClients;
}

const CLIENT_UPSERT_SQL = `
  INSERT INTO clients
    (id, name, companyName, address, website, mobileNumber, email, whatsappNumber,
     cityState, monthlyRental, services, features, servicesFeatures, status,
     createdBy, ticketCount, tickets, createdAt, updatedAt)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  ON DUPLICATE KEY UPDATE
    name = VALUES(name),
    companyName = VALUES(companyName),
    address = VALUES(address),
    website = VALUES(website),
    mobileNumber = VALUES(mobileNumber),
    email = VALUES(email),
    whatsappNumber = VALUES(whatsappNumber),
    cityState = VALUES(cityState),
    monthlyRental = VALUES(monthlyRental),
    services = VALUES(services),
    features = VALUES(features),
    servicesFeatures = VALUES(servicesFeatures),
    status = VALUES(status),
    ticketCount = VALUES(ticketCount),
    tickets = VALUES(tickets),
    updatedAt = VALUES(updatedAt)
`;

async function refreshClientsBackup(pool) {
  try {
    const [rows] = await pool.query('SELECT * FROM clients');
    const mapped = rows.map(mapClientRow);
    syncJsonBackup(mapped);
    return mapped;
  } catch {
    return cachedClients;
  }
}

export async function getAllClients() {
  const pool = getPool();
  if (pool) {
    const [[rows], allTickets] = await Promise.all([
      pool.query('SELECT * FROM clients'),
      getAllTickets(),
    ]);
    const mapped = rows.map(mapClientRow);
    const synced = syncClientsWithTickets(mapped, allTickets);
    return sortClientsList(synced);
  }

  const allTickets = await getAllTickets();
  const clients = syncClientsWithTickets(null, allTickets);
  return sortClientsList(clients);
}

export async function saveAllClients(items) {
  const pool = getPool();
  if (pool && Array.isArray(items)) {
    for (const c of items) {
      if (!c.id) continue;
      await pool.execute(CLIENT_UPSERT_SQL, buildClientDbParams(c));
    }
  }
  syncJsonBackup(items);
}

export async function findClientById(id) {
  const pool = getPool();
  if (pool) {
    const [rows] = await pool.execute(
      'SELECT * FROM clients WHERE LOWER(id) = LOWER(?) LIMIT 1',
      [String(id)]
    );
    if (rows.length > 0) {
      return mapClientRow(rows[0]);
    }
  }

  const items = await getAllClients();
  return items.find((item) => String(item.id).toLowerCase() === String(id).toLowerCase()) || null;
}

export async function addClient(item) {
  const pool = getPool();
  if (pool) {
    await pool.execute(CLIENT_UPSERT_SQL, buildClientDbParams(item));
    const created = await findClientById(item.id);
    await refreshClientsBackup(pool);
    return created || item;
  }

  const items = await getAllClients();
  items.unshift(item);
  syncJsonBackup(items);
  return item;
}

const CLIENT_UPDATABLE_COLUMNS = new Set([
  'name',
  'companyName',
  'address',
  'website',
  'mobileNumber',
  'email',
  'whatsappNumber',
  'cityState',
  'monthlyRental',
  'services',
  'features',
  'servicesFeatures',
  'status',
  'createdBy',
  'ticketCount',
  'tickets',
  'updatedAt',
]);

export async function updateClient(id, updates) {
  const stampedUpdates = {
    ...updates,
    updatedAt: new Date().toISOString(),
  };

  const pool = getPool();
  if (pool) {
    const entries = Object.entries(stampedUpdates).filter(([key]) =>
      CLIENT_UPDATABLE_COLUMNS.has(key)
    );
    const setClauses = entries.map(([key]) => `\`${key}\` = ?`).join(', ');
    const values = entries.map(([key, val]) => {
      if (key === 'services' || key === 'features' || key === 'servicesFeatures' || key === 'tickets') {
        return serializeJson(val, []);
      }
      if (key === 'monthlyRental') {
        return Number.isFinite(Number(val)) ? Number(val) : 0;
      }
      if (key === 'ticketCount') {
        return Number.isFinite(Number(val)) ? Number(val) : 0;
      }
      if (key === 'status') {
        return val === 'inactive' ? 'inactive' : 'active';
      }
      return val === undefined ? null : val;
    });
    values.push(String(id));

    const [result] = await pool.execute(
      `UPDATE clients SET ${setClauses} WHERE LOWER(id) = LOWER(?)`,
      values
    );
    if (result.affectedRows > 0) {
      const updated = await findClientById(id);
      await refreshClientsBackup(pool);
      return updated;
    }
  }

  const items = await getAllClients();
  const index = items.findIndex(
    (item) => String(item.id).toLowerCase() === String(id).toLowerCase()
  );
  if (index === -1) return null;

  items[index] = {
    ...items[index],
    ...stampedUpdates,
  };
  syncJsonBackup(items);
  return items[index];
}

export async function deleteClient(id) {
  const pool = getPool();
  if (pool) {
    const existing = await findClientById(id);
    if (existing) {
      await pool.execute('DELETE FROM clients WHERE LOWER(id) = LOWER(?)', [String(id)]);
      await refreshClientsBackup(pool);
      return existing;
    }
  }

  const items = await getAllClients();
  const index = items.findIndex(
    (item) => String(item.id).toLowerCase() === String(id).toLowerCase()
  );
  if (index === -1) return null;

  const [removed] = items.splice(index, 1);
  syncJsonBackup(items);
  return removed;
}

/**
 * Bulk imports or updates multiple clients cleanly in one transaction.
 * Persists to MySQL via parameterized queries when connected and updates JSON backup.
 */
export async function bulkUpsertClients(
  rawRows = [],
  { duplicateMode = 'skip', createdBy = 'Bulk Import' } = {}
) {
  const existingClients = await getAllClients();
  const byMobile = new Map();
  let nextNumber = 1001;

  existingClients.forEach((client) => {
    const match = String(client.id || '').match(/^CLI-(\d+)$/i);
    if (match) {
      nextNumber = Math.max(nextNumber, Number(match[1]) + 1);
    }
    const normMob = String(client.mobileNumber || '').replace(/\D/g, '');
    if (normMob) {
      byMobile.set(normMob, client);
    }
  });

  const toInsert = [];
  const toUpdate = [];
  const errors = [];
  let skippedCount = 0;
  const now = new Date().toISOString();

  rawRows.forEach((raw, idx) => {
    const rowNumber = raw._rowNumber || idx + 2;
    const trimmedName = String(raw.name || '').trim();
    const trimmedCompany = String(raw.companyName || '').trim();
    const rawMobile = String(raw.mobileNumber || '').trim();
    const digitsMobile = rawMobile.replace(/\D/g, '');

    if (!trimmedName) {
      errors.push({ row: rowNumber, reason: 'Contact person name is required.' });
      return;
    }
    if (!trimmedCompany) {
      errors.push({ row: rowNumber, reason: 'Company name is required.' });
      return;
    }
    if (!digitsMobile || digitsMobile.length < 7) {
      errors.push({ row: rowNumber, reason: 'Valid mobile number is required.' });
      return;
    }

    const cleanedServices = cleanStringArray(raw.services);
    const cleanedFeatures = cleanStringArray(raw.features).filter((f) => f !== 'SMS');
    const mergedServicesFeatures = Array.from(
      new Set([
        ...cleanedServices,
        ...cleanedFeatures,
        ...cleanStringArray(raw.servicesFeatures).filter((f) => f !== 'SMS'),
      ])
    );

    const parsedRental = Number(String(raw.monthlyRental ?? 0).replace(/[^0-9.-]/g, ''));
    const monthlyRental = Number.isFinite(parsedRental) && parsedRental >= 0 ? parsedRental : 0;
    const rawStatus = String(raw.status || 'active').trim().toLowerCase();
    const status = rawStatus === 'inactive' ? 'inactive' : 'active';
    const whatsapp = String(raw.whatsappNumber || '').replace(/\D/g, '') || digitsMobile;

    const existing = byMobile.get(digitsMobile);
    if (existing) {
      if (duplicateMode === 'update') {
        const updatedRecord = {
          ...existing,
          name: trimmedName,
          companyName: trimmedCompany,
          address: raw.address !== undefined ? String(raw.address).trim() : existing.address || '',
          website: raw.website !== undefined ? String(raw.website).trim() : existing.website || '',
          mobileNumber: digitsMobile,
          email: raw.email !== undefined ? String(raw.email).trim() : existing.email || '',
          whatsappNumber: whatsapp,
          cityState: raw.cityState !== undefined ? String(raw.cityState).trim() : existing.cityState || '',
          monthlyRental: raw.monthlyRental !== undefined && raw.monthlyRental !== '' ? monthlyRental : existing.monthlyRental || 0,
          services: cleanedServices.length > 0 ? cleanedServices : existing.services || [],
          features: cleanedFeatures.length > 0 ? cleanedFeatures : existing.features || [],
          servicesFeatures:
            mergedServicesFeatures.length > 0
              ? mergedServicesFeatures
              : existing.servicesFeatures || [],
          status,
          updatedAt: now,
        };
        toUpdate.push(updatedRecord);
        byMobile.set(digitsMobile, updatedRecord);
      } else {
        skippedCount++;
      }
      return;
    }

    const newClient = {
      id: `CLI-${nextNumber++}`,
      name: trimmedName,
      companyName: trimmedCompany,
      address: String(raw.address || '').trim(),
      website: String(raw.website || '').trim(),
      mobileNumber: digitsMobile,
      email: String(raw.email || '').trim(),
      whatsappNumber: whatsapp,
      cityState: String(raw.cityState || '').trim(),
      monthlyRental,
      services: cleanedServices,
      features: cleanedFeatures,
      servicesFeatures: mergedServicesFeatures,
      status,
      createdAt: now,
      updatedAt: now,
      createdBy,
      ticketCount: 0,
      tickets: [],
    };

    toInsert.push(newClient);
    byMobile.set(digitsMobile, newClient);
  });

  const pool = getPool();
  if (pool) {
    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();
      for (const doc of [...toInsert, ...toUpdate]) {
        await conn.execute(CLIENT_UPSERT_SQL, buildClientDbParams(doc));
      }
      await conn.commit();
    } catch (txErr) {
      await conn.rollback();
      throw txErr;
    } finally {
      conn.release();
    }
    await refreshClientsBackup(pool);
  } else {
    const updateMap = new Map(toUpdate.map((u) => [u.id, u]));
    const updatedList = existingClients.map((c) => updateMap.get(c.id) || c);
    const finalClients = [...toInsert.reverse(), ...updatedList];
    syncJsonBackup(finalClients);
  }

  return {
    importedCount: toInsert.length,
    updatedCount: toUpdate.length,
    skippedCount,
    errorCount: errors.length,
    errors,
    importedClients: toInsert,
    updatedClients: toUpdate,
  };
}
