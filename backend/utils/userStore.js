import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { getPool } from '../config/db.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, '..', 'data');
const USERS_FILE = path.join(DATA_DIR, 'users.json');

let cachedUsers = [];

function syncJsonBackup(users) {
  try {
    cachedUsers = Array.isArray(users) ? [...users] : [];
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2), 'utf-8');
  } catch {
    // Non-critical background sync
  }
}

function mapUserRow(row) {
  if (!row) return null;
  return {
    id: Number(row.id),
    name: row.name || '',
    email: row.email || '',
    mobileNumber: row.mobileNumber || '',
    password: row.password || '',
    role: row.role || 'employee',
    designation: row.designation || '',
    status: row.status || 'active',
    createdAt: row.createdAt || null,
    updatedAt: row.updatedAt || null,
  };
}

function toIsoString(val, fallback = null) {
  if (!val) return fallback;
  if (val instanceof Date) return val.toISOString();
  return String(val);
}

export function getAllUsersSync() {
  if (cachedUsers.length > 0) {
    return cachedUsers;
  }
  if (fs.existsSync(USERS_FILE)) {
    try {
      cachedUsers = JSON.parse(fs.readFileSync(USERS_FILE, 'utf-8'));
      return cachedUsers;
    } catch {
      return [];
    }
  }
  return [];
}

async function refreshUsersBackup(pool) {
  try {
    const [rows] = await pool.query('SELECT * FROM users ORDER BY id ASC');
    const mapped = rows.map(mapUserRow);
    syncJsonBackup(mapped);
    return mapped;
  } catch {
    return cachedUsers;
  }
}

/**
 * Returns all users from MySQL (or JSON fallback when DB is unavailable).
 */
export async function getAllUsers() {
  const pool = getPool();
  if (pool) {
    const [rows] = await pool.query('SELECT * FROM users ORDER BY id ASC');
    const mapped = rows.map(mapUserRow);
    syncJsonBackup(mapped);
    return mapped;
  }

  return getAllUsersSync();
}

/**
 * Saves all users using parameterized MySQL upsert and updates JSON backup.
 */
export async function saveAllUsers(users) {
  const pool = getPool();
  if (pool && Array.isArray(users)) {
    for (const u of users) {
      if (u.id === undefined) continue;
      const now = new Date().toISOString();
      await pool.execute(
        `INSERT INTO users
          (id, name, email, mobileNumber, password, role, designation, status, createdAt, updatedAt)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE
          name = VALUES(name),
          email = VALUES(email),
          mobileNumber = VALUES(mobileNumber),
          password = VALUES(password),
          role = VALUES(role),
          designation = VALUES(designation),
          status = VALUES(status),
          updatedAt = VALUES(updatedAt)`,
        [
          Number(u.id),
          String(u.name || ''),
          String(u.email || ''),
          String(u.mobileNumber || ''),
          String(u.password || ''),
          ['admin', 'employee', 'client'].includes(String(u.role)) ? String(u.role) : 'employee',
          String(u.designation || ''),
          u.status === 'inactive' ? 'inactive' : 'active',
          toIsoString(u.createdAt, now),
          toIsoString(u.updatedAt, now),
        ]
      );
    }
  }
  syncJsonBackup(users);
}

/**
 * Finds user by mobile number using parameterized MySQL query.
 */
export async function findUserByMobile(mobileNumber) {
  const pool = getPool();
  if (pool) {
    const [rows] = await pool.execute(
      'SELECT * FROM users WHERE mobileNumber = ? LIMIT 1',
      [String(mobileNumber)]
    );
    return rows.length > 0 ? mapUserRow(rows[0]) : null;
  }

  const users = await getAllUsers();
  return users.find((user) => String(user.mobileNumber) === String(mobileNumber)) || null;
}

/**
 * Finds user by email address (case-insensitive) using parameterized MySQL query.
 */
export async function findUserByEmail(email) {
  const norm = String(email || '').trim().toLowerCase();
  if (!norm) return null;

  const pool = getPool();
  if (pool) {
    const [rows] = await pool.execute(
      'SELECT * FROM users WHERE LOWER(TRIM(email)) = ? LIMIT 1',
      [norm]
    );
    return rows.length > 0 ? mapUserRow(rows[0]) : null;
  }

  const users = await getAllUsers();
  return users.find((user) => String(user.email || '').trim().toLowerCase() === norm) || null;
}

/**
 * Finds user by numeric ID using parameterized MySQL query.
 */
export async function findUserById(id) {
  const numId = Number(id);
  if (!Number.isFinite(numId)) return null;

  const pool = getPool();
  if (pool) {
    const [rows] = await pool.execute('SELECT * FROM users WHERE id = ? LIMIT 1', [numId]);
    return rows.length > 0 ? mapUserRow(rows[0]) : null;
  }

  const users = await getAllUsers();
  return users.find((user) => Number(user.id) === numId) || null;
}

/**
 * Adds a new user via parameterized MySQL INSERT.
 */
export async function addUser(userData) {
  const now = new Date().toISOString();
  const normalized = {
    id: Number(userData.id),
    name: String(userData.name || ''),
    email: String(userData.email || ''),
    mobileNumber: String(userData.mobileNumber || ''),
    password: String(userData.password || ''),
    role: ['admin', 'employee', 'client'].includes(String(userData.role))
      ? String(userData.role)
      : 'employee',
    designation: String(userData.designation || ''),
    status: userData.status === 'inactive' ? 'inactive' : 'active',
    createdAt: toIsoString(userData.createdAt, now),
    updatedAt: toIsoString(userData.updatedAt, now),
  };

  const pool = getPool();
  if (pool) {
    await pool.execute(
      `INSERT INTO users
        (id, name, email, mobileNumber, password, role, designation, status, createdAt, updatedAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        normalized.id,
        normalized.name,
        normalized.email,
        normalized.mobileNumber,
        normalized.password,
        normalized.role,
        normalized.designation,
        normalized.status,
        normalized.createdAt,
        normalized.updatedAt,
      ]
    );
    await refreshUsersBackup(pool);
    return normalized;
  }

  const users = await getAllUsers();
  users.push(normalized);
  syncJsonBackup(users);
  return normalized;
}

const USER_UPDATABLE_COLUMNS = new Set([
  'name',
  'email',
  'mobileNumber',
  'password',
  'role',
  'designation',
  'status',
  'updatedAt',
]);

/**
 * Updates user by ID via parameterized MySQL UPDATE.
 */
export async function updateUser(id, updates) {
  const numId = Number(id);
  const pool = getPool();

  if (pool) {
    const entries = Object.entries(updates || {}).filter(([key]) =>
      USER_UPDATABLE_COLUMNS.has(key)
    );
    if (!entries.some(([key]) => key === 'updatedAt')) {
      entries.push(['updatedAt', new Date().toISOString()]);
    }

    if (entries.length === 0) {
      return await findUserById(numId);
    }

    const setClauses = entries.map(([key]) => `\`${key}\` = ?`).join(', ');
    const values = entries.map(([key, val]) => {
      if (key === 'role') {
        return ['admin', 'employee', 'client'].includes(String(val)) ? String(val) : 'employee';
      }
      if (key === 'status') {
        return val === 'inactive' ? 'inactive' : 'active';
      }
      return val === undefined ? null : val;
    });
    values.push(numId);

    const [result] = await pool.execute(
      `UPDATE users SET ${setClauses} WHERE id = ?`,
      values
    );
    if (result.affectedRows === 0) {
      return null;
    }

    const updated = await findUserById(numId);
    await refreshUsersBackup(pool);
    return updated;
  }

  const users = await getAllUsers();
  const index = users.findIndex((user) => Number(user.id) === numId);
  if (index === -1) return null;

  users[index] = {
    ...users[index],
    ...updates,
    updatedAt: new Date().toISOString(),
  };
  syncJsonBackup(users);
  return users[index];
}

/**
 * Deletes user by ID via parameterized MySQL DELETE.
 */
export async function deleteUser(id) {
  const numId = Number(id);
  const pool = getPool();

  if (pool) {
    const existing = await findUserById(numId);
    if (!existing) return null;
    await pool.execute('DELETE FROM users WHERE id = ?', [numId]);
    await refreshUsersBackup(pool);
    return existing;
  }

  const users = await getAllUsers();
  const index = users.findIndex((user) => Number(user.id) === numId);
  if (index === -1) return null;

  const deleted = users[index];
  users.splice(index, 1);
  syncJsonBackup(users);
  return deleted;
}
