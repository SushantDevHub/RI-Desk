import './env.js';
import mongoose from 'mongoose';
import { migrateFromJSON } from '../utils/migrate.js';

let isConnected = false;

/**
 * Connects to MongoDB Atlas using the connection string configured in backend/.env.
 * Handles database connection errors properly, triggers automatic non-duplicate migration,
 * and supports graceful fallback when credentials are not yet configured.
 *
 * @param {object} options
 * @param {boolean} [options.throwOnError=false] - Whether to throw an error if connection fails
 * @returns {Promise<typeof mongoose | null>}
 */
export async function connectDB(options = {}) {
  const { throwOnError = false } = options;
  const rawUri = process.env.MONGODB_URI || process.env.MONGO_URI;
  const uri = typeof rawUri === 'string' ? rawUri.trim().replace(/^["']|["']$/g, '') : '';

  if (!uri || uri.includes('<username>') || uri.includes('<password>') || uri.includes('<db_password>')) {
    const errorMsg =
      'MONGODB_URI is not configured in backend/.env (or still contains placeholder <db_password>).\n' +
      'Please replace <db_password> with your actual database user password in backend/.env:\n' +
      'MONGODB_URI=mongodb+srv://webdevop005_db_user:YOUR_ACTUAL_PASSWORD@cluster0.zzwrza6.mongodb.net/ridesk?retryWrites=true&w=majority';
    console.warn(`\x1b[33m[MongoDB Atlas Notice]\x1b[0m ${errorMsg}`);
    console.log('[Database] Running with JSON fallback mode so existing authentication, APIs, and dashboard work seamlessly.');
    if (throwOnError) {
      throw new Error(errorMsg);
    }
    return null;
  }

  // If already connected, return existing connection
  if (isConnected && mongoose.connection.readyState === 1) {
    return mongoose;
  }

  try {
    console.log('[MongoDB] Connecting to MongoDB Atlas...');

    const connectionOptions = {
      serverSelectionTimeoutMS: 10000, // 10s connection timeout
      autoIndex: true,
    };

    const conn = await mongoose.connect(uri, connectionOptions);
    isConnected = true;

    console.log(
      `\x1b[32m[MongoDB Atlas Connected]\x1b[0m Host: ${conn.connection.host} | DB: ${conn.connection.name}`
    );

    // Run non-duplicate migration from existing JSON files into MongoDB
    await migrateFromJSON();

    return conn;
  } catch (error) {
    isConnected = false;
    console.error(`\x1b[31m[MongoDB Atlas Connection Error]\x1b[0m ${error.message}`);
    console.log('[Database] Falling back to local data store so server remains operational.');
    if (throwOnError) {
      throw error;
    }
    return null;
  }
}

// Connection lifecycle event listeners
mongoose.connection.on('disconnected', () => {
  isConnected = false;
  console.warn('[MongoDB] Connection to database lost.');
});

mongoose.connection.on('error', (err) => {
  console.error('[MongoDB Error]', err.message);
});

export default connectDB;
