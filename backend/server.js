import './config/env.js';
import express from 'express';
import cors from 'cors';
import mongoose from 'mongoose';
import { connectDB } from './config/db.js';
import authRoutes from './routes/auth.js';
import ticketsRoutes from './routes/tickets.js';
import usersRoutes from './routes/users.js';
import designationsRoutes from './routes/designations.js';
import clientsRoutes from './routes/clients.js';
import announcementsRoutes from './routes/announcements.js';
import notificationsRoutes from './routes/notifications.js';
import raiseTicketRoutes from './modules/tickets/ticketRoutes.js';

const app = express();
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
  const isDbConnected = Boolean(mongoose.connection && mongoose.connection.readyState === 1);
  return res.json({
    status: 'ok',
    database: isDbConnected ? 'connected' : 'disconnected',
    databaseHost: isDbConnected ? mongoose.connection.host : null,
    databaseName: isDbConnected ? mongoose.connection.name : null,
    storageMode: isDbConnected ? 'mongodb' : 'json-fallback',
    timestamp: new Date().toISOString(),
  });
});

/**
 * Connect to MongoDB Atlas first, then start Express server.
 * Handles database connection errors properly.
 */
async function startServer() {
  try {
    console.log('[Startup] Initializing database connection...');
    const conn = await connectDB();
    const isDbConnected = Boolean(conn && mongoose.connection.readyState === 1);
    console.log(
      `[Startup] Database initialized (${isDbConnected ? 'MongoDB Atlas' : 'Local Data Mode'}).`
    );

    const server = app.listen(PORT, () => {
      console.log(`Auth API (JWT) listening on http://localhost:${PORT}`);
    });

    // Graceful shutdown
    process.on('SIGTERM', async () => {
      console.log('SIGTERM signal received. Closing HTTP server and database connection...');
      server.close(async () => {
        if (mongoose.connection && mongoose.connection.readyState === 1) {
          await mongoose.connection.close(false);
        }
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
 