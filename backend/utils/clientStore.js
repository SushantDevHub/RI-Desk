import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { getAllTickets } from './ticketStore.js';

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

/**
 * Synchronizes client data with real ticket customers, removing mock/dummy data.
 */
export function syncClientsWithTickets() {
  ensureFile();
  let existingClients = [];
  try {
    const raw = fs.readFileSync(CLIENTS_FILE, 'utf-8');
    const parsed = JSON.parse(raw);
    existingClients = Array.isArray(parsed) ? parsed : [];
  } catch {
    existingClients = [];
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

  // Read all tickets
  const tickets = getAllTickets();

  // Group tickets by customer mobile or customer name
  const customerMap = new Map();

  tickets.forEach((ticket) => {
    const customer = String(ticket.customer || ticket.client || '').trim();
    const mobile = String(ticket.customerMobile || ticket.clientMobile || '').trim();
    const email = String(ticket.email || ticket.clientEmail || ticket.customerEmail || '').trim();
    if (!customer && !mobile) return;

    // Use normalized mobile or customer name as key
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

  // Find highest existing CLI-xxx ID
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

  // Merge ticket customers into clients list
  customerMap.forEach((group) => {
    const existingIndex = findExistingIndex(group);
    const servicesFromTickets = Array.from(group.categories);

    if (existingIndex !== -1) {
      const existing = mergedClients[existingIndex];
      const mergedServices = Array.from(new Set([...(existing.services || []), ...servicesFromTickets]));
      const features = Array.isArray(existing.features) && existing.features.length > 0 ? existing.features : ['WhatsApp', 'SMS'];

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
      const features = ['WhatsApp', 'SMS'];
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

  // Attach ticket metadata to any remaining clients
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

  fs.writeFileSync(CLIENTS_FILE, JSON.stringify(mergedClients, null, 2));
  return mergedClients;
}

export function getAllClients() {
  const clients = syncClientsWithTickets();
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
