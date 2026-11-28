import './config/env.js';
import express from 'express';
import cors from 'cors';
import {
  connectDB,
  isDatabaseConnected,
  getDbConfigInfo,
  closeDB,
} from './config/db.js';
import authRoutes from './routes/auth.js';
import ticketsRoutes from './routes/tickets.js';
import usersRoutes from './routes/users.js';
import designationsRoutes from './routes/designations.js';
import clientsRoutes from './routes/clients.js';
import announcementsRoutes from './routes/announcements.js';
import notificationsRoutes from './routes/notifications.js';
import raiseTicketRoutes from './modules/tickets/ticketRoutes.js';

const app = express();
app.disable('x-powered-by');
const PORT = process.env.PORT || 4000;

// Respect X-Forwarded-For behind reverse proxies (Nginx, Cloudflare, Render, etc.)
// so rateLimiter.js identifies real visitor IPs instead of the proxy IP.
app.set('trust proxy', 1);

const allowedOrigins = (
  process.env.ALLOWED_ORIGINS || 'http://localhost:5173,http://127.0.0.1:5173'
)
  .split(',')
  .map((origin) => origin.trim().replace(/\/+$/, ''))
  .filter(Boolean);

app.use(
  cors({
    origin(origin, callback) {
      // Allow requests without an Origin header (e.g. PHP server cURL, curl, health checks)
      // or explicitly listed browser origins.
      if (!origin || allowedOrigins.includes('*') || allowedOrigins.includes(origin.replace(/\/+$/, ''))) {
        return callback(null, true);
      }
      return callback(new Error(`Origin ${origin} not allowed by CORS`));
    },
    credentials: true,
  })
);
app.use(express.json({ limit: '10mb' }));
app.use('/api/tickets', raiseTicketRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/tickets', ticketsRoutes);
app.use('/api/users', usersRoutes);
app.use('/api/designations', designationsRoutes);
app.use('/api/clients', clientsRoutes);
app.use('/api/announcements', announcementsRoutes);
app.use('/api/notifications', notificationsRoutes);

// Health check endpoint with database status
app.get('/api/health', (req, res) => {
  const isDbConnected = isDatabaseConnected();
  const dbInfo = getDbConfigInfo();
  return res.json({
    status: 'ok',
    database: isDbConnected ? 'connected' : 'disconnected',
    databaseHost: isDbConnected ? `${dbInfo.host}:${dbInfo.port}` : null,
    databaseName: isDbConnected ? dbInfo.database : null,
    storageMode: isDbConnected ? 'mysql' : 'json-fallback',
    timestamp: new Date().toISOString(),
  });
});

/**
 * Connect to MySQL first, then start Express server.
 * Handles database connection errors properly.
 */
async function startServer() {
  try {
    console.log('[Startup] Initializing MySQL database connection...');
    await connectDB();
    const isDbConnected = isDatabaseConnected();
    console.log(
      `[Startup] Database initialized (${isDbConnected ? 'MySQL (ri_desk)' : 'Local JSON Fallback Mode'}).`
    );

    const server = app.listen(PORT, () => {
      console.log(`Auth API (JWT) listening on http://localhost:${PORT}`);
    });

    // Graceful shutdown
    process.on('SIGTERM', async () => {
      console.log('SIGTERM signal received. Closing HTTP server and MySQL pool...');
      server.close(async () => {
        await closeDB();
        console.log('Server closed.');
        process.exit(0);
      });
    });

    return server;
  } catch (error) {
    console.error(`\x1b[31m[Startup Fatal Error]\x1b[0m Failed during server startup.`);
    console.error(`Reason: ${error.message}`);
    process.exit(1);
  }
}

startServer();

export default app;
