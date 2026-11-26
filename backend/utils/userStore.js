import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import mongoose from 'mongoose';
import User from '../models/User.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, '..', 'data');
const USERS_FILE = path.join(DATA_DIR, 'users.json');

// Helper to keep JSON file backup safely preserved in sync without deleting it
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

let cachedUsers = [];

export function getAllUsersSync() {
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

/**
 * Returns all users using Mongoose User model queries.
 */
export async function getAllUsers() {
  if (mongoose.connection.readyState === 1) {
    const users = await User.find({}).lean();
    const mapped = users.map((u) => ({
      ...u,
      _id: u._id?.toString(),
    }));
    cachedUsers = mapped;
    return mapped;
  }

  return getAllUsersSync();
}

/**
 * Saves all users using Mongoose upsert and updates backup.
 */
export async function saveAllUsers(users) {
  if (mongoose.connection.readyState === 1 && Array.isArray(users)) {
    for (const u of users) {
      if (u.id === undefined) continue;
      await User.findOneAndUpdate(
        { id: Number(u.id) },
        { $set: u },
        { upsert: true, returnDocument: 'after' }
      );
    }
  }
  syncJsonBackup(users);
}

/**
 * Finds user by mobile number using Mongoose.
 */
export async function findUserByMobile(mobileNumber) {
  if (mongoose.connection.readyState === 1) {
    const user = await User.findOne({ mobileNumber: String(mobileNumber) }).lean();
    return user ? { ...user, _id: user._id?.toString() } : null;
  }

  const users = await getAllUsers();
  return (
    users.find((user) => String(user.mobileNumber) === String(mobileNumber)) || null
  );
}

/**
 * Finds user by email address (case-insensitive) using Mongoose.
 */
export async function findUserByEmail(email) {
  const norm = String(email || '').trim().toLowerCase();
  if (mongoose.connection.readyState === 1) {
    const user = await User.findOne({
      email: { $regex: new RegExp(`^${norm}$`, 'i') },
    }).lean();
    return user ? { ...user, _id: user._id?.toString() } : null;
  }

  const users = await getAllUsers();
  return (
    users.find((user) => String(user.email || '').trim().toLowerCase() === norm) || null
  );
}

/**
 * Finds user by numeric ID using Mongoose.
 */
export async function findUserById(id) {
  if (mongoose.connection.readyState === 1) {
    const user = await User.findOne({ id: Number(id) }).lean();
    return user ? { ...user, _id: user._id?.toString() } : null;
  }

  const users = await getAllUsers();
  return users.find((user) => Number(user.id) === Number(id)) || null;
}

/**
 * Adds a new user via Mongoose User model.
 */
export async function addUser(userData) {
  if (mongoose.connection.readyState === 1) {
    const created = await User.create(userData);
    const result = created.toObject();
    getAllUsers().then(syncJsonBackup).catch(() => {});
    return result;
  }

  const users = await getAllUsers();
  users.push(userData);
  syncJsonBackup(users);
  return userData;
}

/**
 * Updates user by ID via Mongoose.
 */
export async function updateUser(id, updates) {
  if (mongoose.connection.readyState === 1) {
    const updated = await User.findOneAndUpdate(
      { id: Number(id) },
      { $set: updates },
      { returnDocument: 'after' }
    ).lean();
    getAllUsers().then(syncJsonBackup).catch(() => {});
    return updated;
  }

  const users = await getAllUsers();
  const index = users.findIndex((user) => Number(user.id) === Number(id));
  if (index === -1) return null;

  users[index] = {
    ...users[index],
    ...updates,
  };
  syncJsonBackup(users);
  return users[index];
}

/**
 * Deletes user by numeric ID via Mongoose.
 */
export async function deleteUser(id) {
  if (mongoose.connection.readyState === 1) {
    const deleted = await User.findOneAndDelete({ id: Number(id) }).lean();
    getAllUsers().then(syncJsonBackup).catch(() => {});
    return deleted;
  }

  const users = await getAllUsers();
  const filteredUsers = users.filter((user) => Number(user.id) !== Number(id));
  syncJsonBackup(filteredUsers);
  return true;
}
