import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import User from '../models/User.js';
import Ticket from '../models/Ticket.js';
import Client from '../models/Client.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, '..', 'data');
const USERS_FILE = path.join(DATA_DIR, 'users.json');
const TICKETS_FILE = path.join(DATA_DIR, 'tickets.json');
const CLIENTS_FILE = path.join(DATA_DIR, 'clients.json');

/**
 * Migrates existing users and tickets from local JSON files into MongoDB Atlas
 * without creating duplicates. Preserves original JSON files as requested.
 *
 * @returns {Promise<{ usersMigrated: number, ticketsMigrated: number }>}
 */
export async function migrateFromJSON() {
  console.log('[Migration] Verifying existing data from JSON files for MongoDB...');

  let usersMigrated = 0;
  let usersSkipped = 0;
  let ticketsMigrated = 0;
  let ticketsSkipped = 0;

  // Clean up any known dummy/test records from MongoDB collections
  try {
    await Ticket.deleteMany({
      $or: [
        { client: 'Client One' },
        { client: 'Apex Solutions Pvt Ltd' },
        { client: 'sushant' },
        { subject: 'Payment Issue updated' },
        { subject: 'test1' },
        { subject: 'Electricity board payment pending credit' },
      ],
    });
    await User.deleteMany({
      $or: [
        { email: 'mongo.test@ridesk.com' },
        { email: 'test2@123' },
        { name: 'MongoDB Test Employee' },
        { name: 'asaas' },
      ],
    });
  } catch {
    // Non-critical cleanup
  }

  // 1. Migrate Users
  if (fs.existsSync(USERS_FILE)) {
    try {
      const raw = fs.readFileSync(USERS_FILE, 'utf-8');
      const users = JSON.parse(raw);

      if (Array.isArray(users) && users.length > 0) {
        for (const u of users) {
          if (!u || u.id === undefined) continue;

          // Prevent duplicates by checking both numeric ID and mobile number
          const existing = await User.findOne({
            $or: [{ id: Number(u.id) }, { mobileNumber: String(u.mobileNumber) }],
          });

          if (!existing) {
            await User.create({
              ...u,
              id: Number(u.id),
              mobileNumber: String(u.mobileNumber),
            });
            usersMigrated++;
          } else {
            usersSkipped++;
          }
        }
      }
    } catch (err) {
      console.error('[Migration] Warning: Could not migrate users.json:', err.message);
    }
  }

  // 2. Migrate Tickets
  if (fs.existsSync(TICKETS_FILE)) {
    try {
      const raw = fs.readFileSync(TICKETS_FILE, 'utf-8');
      const tickets = JSON.parse(raw);

      if (Array.isArray(tickets) && tickets.length > 0) {
        for (const t of tickets) {
          if (!t || !t.id) continue;

          // Prevent duplicates by checking unique ticket ID (e.g. TKT-1001)
          const existing = await Ticket.findOne({ id: String(t.id) });

          if (!existing) {
            await Ticket.create({
              ...t,
              id: String(t.id),
            });
            ticketsMigrated++;
          } else {
            ticketsSkipped++;
          }
        }
      }
    } catch (err) {
      console.error('[Migration] Warning: Could not migrate tickets.json:', err.message);
    }
  }

  // 3. Migrate Clients
  let clientsMigrated = 0;
  let clientsSkipped = 0;

  if (fs.existsSync(CLIENTS_FILE)) {
    try {
      const raw = fs.readFileSync(CLIENTS_FILE, 'utf-8');
      const clients = JSON.parse(raw);

      if (Array.isArray(clients) && clients.length > 0) {
        for (const c of clients) {
          if (!c || !c.id) continue;

          const normMob = String(c.mobileNumber || '').replace(/\D/g, '');
          const query = normMob
            ? { $or: [{ id: String(c.id) }, { mobileNumber: normMob }] }
            : { id: String(c.id) };

          const existing = await Client.findOne(query);
          if (!existing) {
            await Client.create({
              ...c,
              id: String(c.id),
            });
            clientsMigrated++;
          } else {
            clientsSkipped++;
          }
        }
      }
    } catch (err) {
      console.error('[Migration] Warning: Could not migrate clients.json:', err.message);
    }
  }

  console.log(
    `[Migration] Summary -> Users: ${usersMigrated} imported (${usersSkipped} existing) | Tickets: ${ticketsMigrated} imported (${ticketsSkipped} existing) | Clients: ${clientsMigrated} imported (${clientsSkipped} existing).`
  );

  return { usersMigrated, ticketsMigrated, clientsMigrated };
}
