import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import mongoose from 'mongoose';
import Client from '../models/Client.js';
import { getAllTickets, getAllTicketsSync } from './ticketStore.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, '..', 'data');
const CLIENTS_FILE = path.join(DATA_DIR, 'clients.json');

let cachedClients = [];

function ensureFile() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }

  if (!fs.existsSync(CLIENTS_FILE)) {
    fs.writeFileSync(CLIENTS_FILE, '[]');
  }
}

function syncJsonBackup(clients) {
  try {
    ensureFile();
    cachedClients = Array.isArray(clients) ? [...clients] : [];
    fs.writeFileSync(CLIENTS_FILE, JSON.stringify(clients, null, 2));
  } catch {
    // Non-critical backup sync
  }
}

export function getAllClientsSync() {
  if (fs.existsSync(CLIENTS_FILE)) {
    try {
      const raw = fs.readFileSync(CLIENTS_FILE, 'utf-8');
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

function escapeRegExp(str) {
  return String(str).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Synchronizes client data with ticket customers, removing mock/dummy data.
 * Optionally merges onto a provided base client list (e.g. from MongoDB).
 */
export function syncClientsWithTickets(baseClients = null) {
  ensureFile();
  let existingClients = [];

  if (Array.isArray(baseClients)) {
    existingClients = [...baseClients];
  } else {
    existingClients = getAllClientsSync();
  }

  // Remove dummy/mock clients
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

  // Read tickets safely
  let tickets = [];
  try {
    const res = getAllTickets();
    if (res && typeof res.then === 'function') {
      tickets = getAllTicketsSync();
    } else if (Array.isArray(res)) {
      tickets = res;
    } else {
      tickets = getAllTicketsSync();
    }
  } catch {
    tickets = getAllTicketsSync();
  }

  // Group tickets by customer mobile or customer name
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

  mergedClients.forEach((c) => {
    const m = String(c.id || '').match(/^CLI-(\d+)$/i);
    if (m) {
      nextCliNumber = Math.max(nextCliNumber, Number(m[1]) + 1);
    }
  });

  const findExistingIndex = (group) => {
    const normMob = (group.mobileNumber || '').replace(/\D/g, '');
    const normName = (group.name || '').toLowerCase();
    return mergedClients.findIndex((c) => {
      const cMob = (c.mobileNumber || '').replace(/\D/g, '');
      const cName = (c.name || '').toLowerCase();
      const cComp = (c.companyName || '').toLowerCase();
      return (normMob && cMob && normMob === cMob) || (normName && (cName === normName || cComp === normName));
    });
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

export async function getAllClients() {
  if (mongoose.connection.readyState === 1) {
    const docs = await Client.find({}).lean();
    const mapped = docs.map((c) => ({
      ...c,
      _id: c._id?.toString(),
    }));
    const synced = syncClientsWithTickets(mapped);
    return sortClientsList(synced);
  }

  const clients = syncClientsWithTickets();
  return sortClientsList(clients);
}

export async function saveAllClients(items) {
  if (mongoose.connection.readyState === 1 && Array.isArray(items)) {
    for (const c of items) {
      if (!c.id) continue;
      await Client.findOneAndUpdate(
        { id: String(c.id) },
        { $set: c },
        { upsert: true, returnDocument: 'after' }
      );
    }
  }
  syncJsonBackup(items);
}

export async function findClientById(id) {
  if (mongoose.connection.readyState === 1) {
    const doc = await Client.findOne({
      id: { $regex: new RegExp(`^${escapeRegExp(id)}$`, 'i') },
    }).lean();
    if (doc) {
      return { ...doc, _id: doc._id?.toString() };
    }
  }

  const items = await getAllClients();
  return items.find((item) => String(item.id).toLowerCase() === String(id).toLowerCase()) || null;
}

export async function addClient(item) {
  if (mongoose.connection.readyState === 1) {
    const created = await Client.create(item);
    const result = created.toObject();
    const all = await Client.find({}).lean();
    syncJsonBackup(all.map((c) => ({ ...c, _id: c._id?.toString() })));
    return result;
  }

  const items = await getAllClients();
  items.unshift(item);
  syncJsonBackup(items);
  return item;
}

export async function updateClient(id, updates) {
  const stampedUpdates = {
    ...updates,
    updatedAt: new Date().toISOString(),
  };

  if (mongoose.connection.readyState === 1) {
    const updated = await Client.findOneAndUpdate(
      { id: { $regex: new RegExp(`^${escapeRegExp(id)}$`, 'i') } },
      { $set: stampedUpdates },
      { returnDocument: 'after' }
    ).lean();
    if (updated) {
      const all = await Client.find({}).lean();
      syncJsonBackup(all.map((c) => ({ ...c, _id: c._id?.toString() })));
      return { ...updated, _id: updated._id?.toString() };
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
  if (mongoose.connection.readyState === 1) {
    const removed = await Client.findOneAndDelete({
      id: { $regex: new RegExp(`^${escapeRegExp(id)}$`, 'i') },
    }).lean();
    if (removed) {
      const all = await Client.find({}).lean();
      syncJsonBackup(all.map((c) => ({ ...c, _id: c._id?.toString() })));
      return { ...removed, _id: removed._id?.toString() };
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
 * Bulk imports or updates multiple clients cleanly in one batch.
 * Persists to MongoDB via insertMany/bulkWrite when connected and updates JSON backup.
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

  if (mongoose.connection.readyState === 1) {
    if (toInsert.length > 0) {
      await Client.insertMany(toInsert, { ordered: false });
    }
    if (toUpdate.length > 0) {
      const bulkOps = toUpdate.map((doc) => {
        const { _id, ...fields } = doc;
        return {
          updateOne: {
            filter: { id: doc.id },
            update: { $set: fields },
            upsert: true,
          },
        };
      });
      await Client.bulkWrite(bulkOps);
    }
    const refreshed = await Client.find({}).lean();
    syncJsonBackup(refreshed.map((c) => ({ ...c, _id: c._id?.toString() })));
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
