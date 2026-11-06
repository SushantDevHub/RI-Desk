import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const DATA_DIR = path.join(__dirname, '..', 'data');
const USERS_FILE = path.join(DATA_DIR, 'users.json');

function ensureFile() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }

  if (!fs.existsSync(USERS_FILE)) {
    fs.writeFileSync(USERS_FILE, '[]');
  }
}

export function getAllUsers() {
  ensureFile();

  return JSON.parse(
    fs.readFileSync(USERS_FILE, 'utf-8')
  );
}

export function saveAllUsers(users) {
  ensureFile();

  fs.writeFileSync(
    USERS_FILE,
    JSON.stringify(users, null, 2)
  );
}

export function findUserByMobile(mobileNumber) {
  const users = getAllUsers();

  return users.find(
    (user) =>
      String(user.mobileNumber) === String(mobileNumber)
  );
}

export function findUserByEmail(email) {
  const users = getAllUsers();
  const normalized = String(email || '').trim().toLowerCase();

  return users.find(
    (user) =>
      String(user.email || '').trim().toLowerCase() === normalized
  );
}

export function findUserById(id) {
  const users = getAllUsers();

  return users.find(
    (user) => String(user.id) === String(id)
  );
}

export function addUser(user) {
  const users = getAllUsers();

  users.push(user);

  saveAllUsers(users);

  return user;
}

export function updateUser(id, updates) {
  const users = getAllUsers();

  const index = users.findIndex(
    (user) => String(user.id) === String(id)
  );

  if (index === -1) {
    return null;
  }

  users[index] = {
    ...users[index],
    ...updates,
  };

  saveAllUsers(users);

  return users[index];
}

export function deleteUser(id) {
  const users = getAllUsers();

  const filteredUsers = users.filter(
    (user) => String(user.id) !== String(id)
  );

  if (filteredUsers.length === users.length) {
    return false;
  }

  saveAllUsers(filteredUsers);

  return true;
}