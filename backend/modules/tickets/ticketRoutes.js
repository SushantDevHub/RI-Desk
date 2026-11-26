import express from 'express';
import { raiseTicketController } from './ticketController.js';
import { raiseTicketRateLimiter } from './rateLimiter.js';

const router = express.Router();

/**
 * Public route to raise a support ticket.
 * Accessible without login with validation and rate limiting.
 *
 * Endpoint: POST /api/tickets/raise
 */
router.post('/raise', raiseTicketRateLimiter, raiseTicketController);

export default router;
