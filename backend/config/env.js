import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Explicitly resolve .env path relative to backend directory
const backendEnvPath = path.resolve(__dirname, '..', '.env');
const rootEnvPath = path.resolve(__dirname, '..', '..', '.env');

let loadedPath = null;

if (fs.existsSync(backendEnvPath)) {
  dotenv.config({ path: backendEnvPath });
  loadedPath = backendEnvPath;
} else if (fs.existsSync(rootEnvPath)) {
  dotenv.config({ path: rootEnvPath });
  loadedPath = rootEnvPath;
} else {
  dotenv.config();
  loadedPath = 'process.cwd()/.env';
}

// Normalize variable names (support MONGODB_URI, MONGO_URI, and MONGODB_URL)
if (!process.env.MONGODB_URI) {
  if (process.env.MONGO_URI) {
    process.env.MONGODB_URI = process.env.MONGO_URI;
  } else if (process.env.MONGODB_URL) {
    process.env.MONGODB_URI = process.env.MONGODB_URL;
  }
}

// Clean up surrounding quotes and whitespace if present
if (typeof process.env.MONGODB_URI === 'string') {
  process.env.MONGODB_URI = process.env.MONGODB_URI.trim().replace(/^["']|["']$/g, '');
}

if (typeof process.env.JWT_SECRET === 'string') {
  process.env.JWT_SECRET = process.env.JWT_SECRET.trim().replace(/^["']|["']$/g, '');
}

export const envConfig = {
  PORT: process.env.PORT || 4000,
  JWT_SECRET: process.env.JWT_SECRET || 'dev_only_change_this_before_deploying_anywhere_real',
  MONGODB_URI: process.env.MONGODB_URI || '',
  loadedPath,
};

export default envConfig;
