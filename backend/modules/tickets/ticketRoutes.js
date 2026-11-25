import express from 'express';
import { raiseTicketController } from './ticketController.js';

const router = express.Router();

/**
 * Public route to raise a support ticket.
 * Does not require admin/employee JWT authentication.
 *
 * Endpoint: POST /api/tickets/raise
 */
router.post('/raise', raiseTicketController);

export default router;
