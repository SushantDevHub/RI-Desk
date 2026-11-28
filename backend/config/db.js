import './env.js';
import mysql from 'mysql2/promise';
import { envConfig } from './env.js';
import { migrateFromJSON } from '../utils/migrate.js';

let pool = null;
let dbConnected = false;

export function getDbConfigInfo() {
  return {
    host: envConfig.DB_HOST,
    port: envConfig.DB_PORT,
    user: envConfig.DB_USER,
    database: envConfig.DB_NAME,
  };
}

export function isDatabaseConnected() {
  return Boolean(pool && dbConnected);
}

export function getPool() {
  return dbConnected ? pool : null;
}

/**
 * Executes a parameterized SQL query against the active MySQL pool.
 */
export async function query(sql, params = []) {
  const activePool = getPool();
  if (!activePool) {
    throw new Error('MySQL connection pool is not initialized.');
  }
  const [rows] = await activePool.execute(sql, params);
  return rows;
}

/**
 * Creates required MySQL tables for RI-Desk if they do not exist.
 */
export async function ensureTables(activePool = pool) {
  if (!activePool) return;

  await activePool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id BIGINT PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      email VARCHAR(255) NOT NULL DEFAULT '',
      mobileNumber VARCHAR(32) NOT NULL UNIQUE,
      password VARCHAR(255) NOT NULL,
      role ENUM('admin', 'employee', 'client') NOT NULL DEFAULT 'employee',
      designation VARCHAR(255) NOT NULL DEFAULT '',
      status ENUM('active', 'inactive') NOT NULL DEFAULT 'active',
      createdAt VARCHAR(64) DEFAULT NULL,
      updatedAt VARCHAR(64) DEFAULT NULL,
      INDEX idx_users_email (email),
      INDEX idx_users_role (role),
      INDEX idx_users_status (status)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  await activePool.query(`
    CREATE TABLE IF NOT EXISTS tickets (
      id VARCHAR(64) PRIMARY KEY,
      subject VARCHAR(500) NOT NULL DEFAULT '',
      category VARCHAR(120) NOT NULL DEFAULT '',
      description LONGTEXT,
      priority ENUM('low', 'medium', 'high') NOT NULL DEFAULT 'medium',
      status ENUM('open', 'in-progress', 'resolved') NOT NULL DEFAULT 'open',
      userType VARCHAR(64) NOT NULL DEFAULT 'client',
      client VARCHAR(255) NOT NULL DEFAULT '',
      customer VARCHAR(255) NOT NULL DEFAULT '',
      clientMobile VARCHAR(64) NOT NULL DEFAULT '',
      customerMobile VARCHAR(64) NOT NULL DEFAULT '',
      clientEmail VARCHAR(255) NOT NULL DEFAULT '',
      customerEmail VARCHAR(255) NOT NULL DEFAULT '',
      email VARCHAR(255) NOT NULL DEFAULT '',
      createdBy VARCHAR(255) NOT NULL DEFAULT 'Client',
      createdById BIGINT DEFAULT NULL,
      assignedTo VARCHAR(255) DEFAULT NULL,
      assignedToId BIGINT DEFAULT NULL,
      assignedEmployeeId BIGINT DEFAULT NULL,
      operator VARCHAR(255) DEFAULT NULL,
      providerName VARCHAR(255) DEFAULT NULL,
      transactionId VARCHAR(255) DEFAULT NULL,
      amount DECIMAL(14, 2) DEFAULT NULL,
      screenshot LONGTEXT DEFAULT NULL,
      source VARCHAR(120) NOT NULL DEFAULT 'self_service_portal',
      isUnassigned TINYINT(1) NOT NULL DEFAULT 1,
      createdAt VARCHAR(64) NOT NULL,
      updatedAt VARCHAR(64) NOT NULL,
      resolvedAt VARCHAR(64) DEFAULT NULL,
      resolution LONGTEXT DEFAULT NULL,
      resolutionTime LONGTEXT DEFAULT NULL,
      resolvedBy VARCHAR(255) DEFAULT NULL,
      resolvedById BIGINT DEFAULT NULL,
      lastTransferredAt VARCHAR(64) DEFAULT NULL,
      lastTransferredBy VARCHAR(255) DEFAULT NULL,
      transferNotes LONGTEXT DEFAULT NULL,
      logs JSON DEFAULT NULL,
      activityLog JSON DEFAULT NULL,
      INDEX idx_tickets_status (status),
      INDEX idx_tickets_priority (priority),
      INDEX idx_tickets_category (category),
      INDEX idx_tickets_assignedToId (assignedToId),
      INDEX idx_tickets_isUnassigned (isUnassigned),
      INDEX idx_tickets_createdAt (createdAt)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  await activePool.query(`
    CREATE TABLE IF NOT EXISTS clients (
      id VARCHAR(64) PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      companyName VARCHAR(255) NOT NULL,
      address TEXT,
      website VARCHAR(500) NOT NULL DEFAULT '',
      mobileNumber VARCHAR(64) NOT NULL DEFAULT '',
      email VARCHAR(255) NOT NULL DEFAULT '',
      whatsappNumber VARCHAR(64) NOT NULL DEFAULT '',
      cityState VARCHAR(255) NOT NULL DEFAULT '',
      monthlyRental DECIMAL(14, 2) NOT NULL DEFAULT 0,
      services JSON DEFAULT NULL,
      features JSON DEFAULT NULL,
      servicesFeatures JSON DEFAULT NULL,
      status ENUM('active', 'inactive') NOT NULL DEFAULT 'active',
      createdBy VARCHAR(255) NOT NULL DEFAULT 'Admin User',
      ticketCount INT NOT NULL DEFAULT 0,
      tickets JSON DEFAULT NULL,
      createdAt VARCHAR(64) NOT NULL,
      updatedAt VARCHAR(64) NOT NULL,
      INDEX idx_clients_mobile (mobileNumber),
      INDEX idx_clients_status (status)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
}

/**
 * Connects to MySQL (XAMPP / configured host), creates database & tables if needed,
 * and triggers non-duplicate JSON backfill.
 */
export async function connectDB(options = {}) {
  const { throwOnError = false, skipMigrate = false } = options;

  if (dbConnected && pool) {
    try {
      await pool.query('SELECT 1');
      return pool;
    } catch {
      dbConnected = false;
    }
  }

  const { host, port, user, database } = getDbConfigInfo();
  const password = envConfig.DB_PASSWORD;

  try {
    console.log(`[MySQL] Connecting to ${host}:${port} (DB: ${database})...`);

    const bootstrapConn = await mysql.createConnection({
      host,
      port,
      user,
      password,
      charset: 'utf8mb4',
      connectTimeout: 10000,
    });

    await bootstrapConn.query(
      `CREATE DATABASE IF NOT EXISTS \`${database.replace(/`/g, '')}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`
    );
    await bootstrapConn.end();

    pool = mysql.createPool({
      host,
      port,
      user,
      password,
      database,
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0,
      charset: 'utf8mb4',
      connectTimeout: 10000,
    });

    await pool.query('SELECT 1');
    dbConnected = true;

    await ensureTables(pool);

    console.log(`\x1b[32m[MySQL Connected]\x1b[0m Host: ${host}:${port} | DB: ${database}`);

    if (!skipMigrate) {
      await migrateFromJSON();
    }

    return pool;
  } catch (error) {
    dbConnected = false;
    console.error(`\x1b[31m[MySQL Connection Error]\x1b[0m ${error.message}`);
    console.log('[Database] Falling back to local JSON data store so server remains operational.');
    if (throwOnError) {
      throw error;
    }
    return null;
  }
}

export async function closeDB() {
  if (pool) {
    try {
      await pool.end();
    } catch {
      // Ignore close errors during shutdown
    }
    pool = null;
    dbConnected = false;
  }
}

export default connectDB;
