import { Router } from 'express';
import { getAllTickets, addTicket, saveAllTickets } from '../utils/ticketStore.js';
import verifyToken from '../middleware/verifyToken.js';

const router = Router();

// All ticket routes require a valid JWT
router.use(verifyToken);

/**
 * GET /api/tickets
 * Returns all tickets with computed stats.
 */
router.get('/', (req, res) => {
  const tickets = getAllTickets();

  const stats = {
    open:   tickets.filter(t => t.status === 'open').length,
    high:   tickets.filter(t => t.priority === 'high'   && t.status === 'open').length,
    medium: tickets.filter(t => t.priority === 'medium' && t.status === 'open').length,
    low:    tickets.filter(t => t.priority === 'low'    && t.status === 'open').length,
  };

  res.json({ tickets, stats });
});

/**
 * POST /api/tickets
 * Create a new ticket.
 * body: { subject, priority, resolution }
 */
router.post('/', (req, res) => {
  const { subject, priority, resolution } = req.body || {};

  if (!subject?.trim() || !priority) {
    return res.status(400).json({ error: 'Subject and priority are required.' });
  }
  if (!['high', 'medium', 'low'].includes(priority)) {
    return res.status(400).json({ error: 'Priority must be high, medium, or low.' });
  }

  const ticket = {
    id:         'TKT-' + Date.now(),
    subject:    subject.trim(),
    priority,
    status:     'open',
    resolution: resolution || '—',
    createdAt:  new Date().toISOString(),
    createdBy:  req.user.username,
  };

  addTicket(ticket);
  res.status(201).json({ ticket });
});

/**
 * PATCH /api/tickets/:id
 * Update ticket status (open → resolved).
 * body: { status }
 */
router.patch('/:id', (req, res) => {
  const { status } = req.body || {};
  const tickets = getAllTickets();
  const idx = tickets.findIndex(t => t.id === req.params.id);

  if (idx === -1) return res.status(404).json({ error: 'Ticket not found.' });
  if (!['open', 'resolved'].includes(status)) {
    return res.status(400).json({ error: 'Status must be open or resolved.' });
  }

  tickets[idx] = { ...tickets[idx], status };
  saveAllTickets(tickets);
  res.json({ ticket: tickets[idx] });
});

export default router;