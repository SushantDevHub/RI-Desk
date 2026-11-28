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

// Clean up surrounding quotes and whitespace if present
if (typeof process.env.JWT_SECRET === 'string') {
  process.env.JWT_SECRET = process.env.JWT_SECRET.trim().replace(/^["']|["']$/g, '');
}

const cleanEnvStr = (val, fallback = '') =>
  typeof val === 'string' ? val.trim().replace(/^["']|["']$/g, '') : fallback;

const dbHost = cleanEnvStr(process.env.DB_HOST, '127.0.0.1') || '127.0.0.1';
const dbPort = Number(cleanEnvStr(process.env.DB_PORT, '3306')) || 3306;
const dbUser = cleanEnvStr(process.env.DB_USER, 'root') || 'root';
const dbPassword = cleanEnvStr(process.env.DB_PASSWORD, '');
const dbName = cleanEnvStr(process.env.DB_NAME, 'ri_desk') || 'ri_desk';

export const envConfig = {
  PORT: process.env.PORT || 4000,
  JWT_SECRET: process.env.JWT_SECRET || 'dev_only_change_this_before_deploying_anywhere_real',
  DB_HOST: dbHost,
  DB_PORT: dbPort,
  DB_USER: dbUser,
  DB_PASSWORD: dbPassword,
  DB_NAME: dbName,
  ALLOWED_ORIGINS: process.env.ALLOWED_ORIGINS || 'http://localhost:5173,http://127.0.0.1:5173',
  loadedPath,
};

export default envConfig;
