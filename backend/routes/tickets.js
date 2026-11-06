
import express from 'express';
import jwt from 'jsonwebtoken';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

import {
  getAllTickets,
  addTicket,
  updateTicket,
} from '../utils/ticketStore.js';

import { getAllUsers } from '../utils/userStore.js';

const router = express.Router();

// --------------------------------------------------
// Ticket storage path
// --------------------------------------------------

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const ticketsFile = path.join(
  __dirname,
  '..',
  'data',
  'tickets.json'
);

// --------------------------------------------------
// Authenticate user using JWT
// --------------------------------------------------

function authenticate(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ')
    ? header.slice(7)
    : null;

  if (!token) {
    return res.status(401).json({
      error: 'Authentication required.',
    });
  }

  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET);
    next();
  } catch (error) {
    return res.status(401).json({
      error: 'Invalid or expired token.',
    });
  }
}

const PRIORITY_ORDER = {
  high: 1,
  medium: 2,
  low: 3,
};

// --------------------------------------------------
// Allow only admins
// --------------------------------------------------

function requireAdmin(req, res, next) {
  if (req.user?.role !== 'admin') {
    return res.status(403).json({
      error: 'Admin access required.',
    });
  }

  next();
}

// --------------------------------------------------
// GET /api/tickets
// List tickets and statistics
// --------------------------------------------------

router.get('/', authenticate, (req, res) => {
  try {
    const tickets = getAllTickets();

    const openTickets = tickets.filter(
      (ticket) => ticket.status !== 'resolved'
    );

    const stats = {
      open: openTickets.length,
      high: openTickets.filter(
        (ticket) => ticket.priority === 'high'
      ).length,
      medium: openTickets.filter(
        (ticket) => ticket.priority === 'medium'
      ).length,
      low: openTickets.filter(
        (ticket) => ticket.priority === 'low'
      ).length,
    };

    const sortedTickets = [...tickets].sort((a, b) => {
      const pA = PRIORITY_ORDER[String(a.priority).toLowerCase()] || 4;
      const pB = PRIORITY_ORDER[String(b.priority).toLowerCase()] || 4;
      if (pA !== pB) {
        return pA - pB;
      }

      const timeA = new Date(a.createdAt || 0).getTime();
      const timeB = new Date(b.createdAt || 0).getTime();
      if (!isNaN(timeA) && !isNaN(timeB) && timeB !== timeA) {
        return timeB - timeA;
      }
      return String(b.id || '').localeCompare(String(a.id || ''), undefined, {
        numeric: true,
      });
    });

    return res.json({ tickets: sortedTickets, stats });
  } catch (error) {
    console.error('Get tickets error:', error);

    return res.status(500).json({
      error: 'Failed to load tickets.',
    });
  }
});

// --------------------------------------------------
// GET /api/tickets/employees
// Fetch all employees for assignment dropdown (admin and employee)
// --------------------------------------------------

router.get('/employees', authenticate, (req, res) => {
  try {
    const users = getAllUsers();
    const employees = users
      .filter((user) => user.role === 'employee')
      .map((user) => ({
        id: user.id,
        name: user.name,
        email: user.email || '',
        mobileNumber: user.mobileNumber,
        role: user.role,
      }));

    return res.json({ employees });
  } catch (error) {
    console.error('Get ticket employees error:', error);
    return res.status(500).json({ error: 'Failed to load employees.' });
  }
});

// --------------------------------------------------
// POST /api/tickets
// Create a ticket
// --------------------------------------------------

router.post('/', authenticate, (req, res) => {
  try {
    const {
      subject,
      description,
      priority = 'medium',
      userType = 'admin',
      customer = '',
      customerMobile = '',
      category = 'recharge',
      status = 'open',
      assignedToId,
    } = req.body;

    // Validate required fields
    if (
      typeof subject !== 'string' ||
      !subject.trim() ||
      typeof description !== 'string' ||
      !description.trim()
    ) {
      return res.status(400).json({
        error: 'Subject and description are required.',
      });
    }

    // Validate category (up to 75 characters)
    const cleanedCategory = String(category || 'recharge').trim();
    if (!cleanedCategory) {
      return res.status(400).json({
        error: 'Category is required.',
      });
    }
    if (cleanedCategory.length > 75) {
      return res.status(400).json({
        error: 'Category cannot exceed 75 characters.',
      });
    }

    // Validate priority
    if (!['low', 'medium', 'high'].includes(priority)) {
      return res.status(400).json({
        error: 'Priority must be low, medium, or high.',
      });
    }

    // Validate status
    if (!['open', 'in-progress', 'resolved'].includes(status)) {
      return res.status(400).json({
        error: 'Invalid status.',
      });
    }

    // Find the selected employee
    let employee = null;

    if (
      assignedToId !== undefined &&
      assignedToId !== null &&
      String(assignedToId).trim() !== ''
    ) {
      employee = getAllUsers().find(
        (user) =>
          String(user.id) === String(assignedToId) &&
          user.role === 'employee'
      );

      if (!employee) {
        return res.status(400).json({
          error: 'Selected employee was not found.',
        });
      }
    }

    // Generate the next ticket ID
    const tickets = getAllTickets();

    const nextNumber =
      tickets.reduce((max, ticket) => {
        const match = String(ticket.id).match(/^TKT-(\d+)$/);

        return match
          ? Math.max(max, Number(match[1]))
          : max;
      }, 1000) + 1;

    // Create the ticket with its employee assignment
    const ticket = {
      id: `TKT-${nextNumber}`,
      subject: subject.trim(),
      userType,
      customer: String(customer).trim(),
      customerMobile: String(customerMobile).trim(),
      category: cleanedCategory,
      description: description.trim(),
      priority,
      status,
      createdBy: req.user.name || String(req.user.id),
      createdById: req.user.id,

      // Save both the employee ID and employee name
      assignedTo: employee ? employee.name : null,
      assignedToId: employee ? employee.id : null,

      createdAt: new Date().toISOString(),
    };

    addTicket(ticket);

    return res.status(201).json({
      message: 'Ticket created successfully.',
      ticket,
    });
  } catch (error) {
    console.error('Create ticket error:', error);

    return res.status(500).json({
      error: 'Failed to create ticket.',
    });
  }
});



// --------------------------------------------------
// PATCH /api/tickets/:id/assign
// Assign a ticket to an employee (admin only)
// --------------------------------------------------

router.patch(
  '/:id/assign',
  authenticate,
  requireAdmin,
  (req, res) => {
    try {
      const { employeeId } = req.body;

      if (employeeId === undefined || employeeId === null) {
        return res.status(400).json({
          error: 'Employee ID is required.',
        });
      }

      const employee = getAllUsers().find(
        (user) =>
          String(user.id) === String(employeeId) &&
          user.role === 'employee'
      );

      if (!employee) {
        return res.status(404).json({
          error: 'Employee not found.',
        });
      }

      const updated = updateTicket(req.params.id, {
        assignedTo: employee.name,
        assignedToId: employee.id,
        updatedAt: new Date().toISOString(),
      });

      if (!updated) {
        return res.status(404).json({
          error: 'Ticket not found.',
        });
      }

      return res.json({
        message: 'Ticket assigned successfully.',
        ticket: updated,
      });
    } catch (error) {
      console.error('Assign ticket error:', error);

      return res.status(500).json({
        error: 'Failed to assign ticket.',
      });
    }
  }
);

function calculateResolutionTime(createdAt, resolvedAt) {
  if (!createdAt) return '< 1 min';
  const start = new Date(createdAt).getTime();
  const end = new Date(resolvedAt || new Date()).getTime();
  if (isNaN(start) || isNaN(end) || end <= start) {
    return '< 1 min';
  }
  const diffMs = end - start;
  const diffSecs = Math.floor(diffMs / 1000);
  const diffMins = Math.floor(diffSecs / 60);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffDays > 0) {
    const remHours = diffHours % 24;
    return remHours > 0 ? `${diffDays}d ${remHours}h` : `${diffDays}d`;
  }
  if (diffHours > 0) {
    const remMins = diffMins % 60;
    return remMins > 0 ? `${diffHours}h ${remMins}m` : `${diffHours}h`;
  }
  if (diffMins > 0) {
    return `${diffMins} min${diffMins > 1 ? 's' : ''}`;
  }
  return '< 1 min';
}

// --------------------------------------------------
// PATCH /api/tickets/:id
// Update ticket status, priority, or category
// (Admins and employees)
// --------------------------------------------------

router.patch('/:id', authenticate, (req, res) => {
  try {
    const tickets = getAllTickets();
    const existing = tickets.find(
      (ticket) => String(ticket.id) === String(req.params.id)
    );

    if (!existing) {
      return res.status(404).json({
        error: 'Ticket not found.',
      });
    }

    const { status, priority, category } = req.body;
    const updates = {};

    if (category !== undefined) {
      const cleanedCategory = String(category || '').trim();
      if (!cleanedCategory) {
        return res.status(400).json({
          error: 'Category is required.',
        });
      }
      if (cleanedCategory.length > 75) {
        return res.status(400).json({
          error: 'Category cannot exceed 75 characters.',
        });
      }
      updates.category = cleanedCategory;
    }

    if (status !== undefined) {
      if (!['open', 'in-progress', 'resolved'].includes(status)) {
        return res.status(400).json({
          error: 'Invalid status.',
        });
      }

      updates.status = status;

      if (status === 'resolved') {
        const resolvedAt = new Date().toISOString();
        const duration = calculateResolutionTime(existing.createdAt, resolvedAt);
        updates.resolvedAt = resolvedAt;
        updates.resolution = duration;
        updates.resolutionTime = duration;
        updates.resolvedBy = req.user.name || existing.assignedTo || 'Employee';
        updates.resolvedById = req.user.id;
      } else {
        updates.resolvedAt = null;
        updates.resolution = null;
        updates.resolutionTime = null;
        updates.resolvedBy = null;
        updates.resolvedById = null;
      }
    }

    if (priority !== undefined) {
      if (!['low', 'medium', 'high'].includes(priority)) {
        return res.status(400).json({
          error: 'Invalid priority.',
        });
      }

      updates.priority = priority;
    }

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({
        error: 'Provide a status, priority, or category to update.',
      });
    }

    updates.updatedAt = new Date().toISOString();

    const updated = updateTicket(req.params.id, updates);

    return res.json({
      message: 'Ticket updated successfully.',
      ticket: updated,
    });
  } catch (error) {
    console.error('Update ticket error:', error);

    return res.status(500).json({
      error: 'Failed to update ticket.',
    });
  }
});

// --------------------------------------------------
// PUT /api/tickets/:id
// Edit all ticket details (admin and employee)
// --------------------------------------------------
router.put('/:id', authenticate, (req, res) => {
  try {
    const {
      subject, userType, customer, customerMobile,
      category, priority, description, assignedToId, status,
    } = req.body;

    if (
      typeof subject !== 'string' || !subject.trim() ||
      typeof description !== 'string' || !description.trim()
    ) {
      return res.status(400).json({ error: 'Subject and description are required.' });
    }
    if (!['low', 'medium', 'high'].includes(priority)) {
      return res.status(400).json({ error: 'Invalid priority.' });
    }
    if (!['open', 'in-progress', 'resolved'].includes(status)) {
      return res.status(400).json({ error: 'Invalid status.' });
    }

    const cleanedCategory = String(category || 'recharge').trim();
    if (!cleanedCategory) {
      return res.status(400).json({ error: 'Category is required.' });
    }
    if (cleanedCategory.length > 75) {
      return res.status(400).json({ error: 'Category cannot exceed 75 characters.' });
    }

    let employee = null;
    if (
      assignedToId !== undefined &&
      assignedToId !== null &&
      String(assignedToId).trim() !== ''
    ) {
      employee = getAllUsers().find(
        (user) =>
          String(user.id) === String(assignedToId) &&
          user.role === 'employee'
      );
      if (!employee) {
        return res.status(400).json({ error: 'Selected employee was not found.' });
      }
    }

    const existing = getAllTickets().find((t) => String(t.id) === String(req.params.id));
    let resolvedAt = existing?.resolvedAt || null;
    let resolution = existing?.resolution || null;
    let resolvedBy = existing?.resolvedBy || null;
    let resolvedById = existing?.resolvedById || null;

    if (status === 'resolved') {
      if (!resolvedAt) {
        resolvedAt = new Date().toISOString();
        resolution = calculateResolutionTime(existing?.createdAt, resolvedAt);
        resolvedBy = employee ? employee.name : (existing?.assignedTo || req.user.name);
        resolvedById = employee ? employee.id : (existing?.assignedToId || req.user.id);
      }
    } else {
      resolvedAt = null;
      resolution = null;
      resolvedBy = null;
      resolvedById = null;
    }

    const updated = updateTicket(req.params.id, {
      subject: subject.trim(),
      userType,
      customer: String(customer ?? '').trim(),
      customerMobile: String(customerMobile ?? '').trim(),
      category: cleanedCategory,
      priority,
      description: description.trim(),
      assignedToId: employee ? employee.id : null,
      assignedTo: employee ? employee.name : null,
      status,
      resolvedAt,
      resolution,
      resolutionTime: resolution,
      resolvedBy,
      resolvedById,
      updatedAt: new Date().toISOString(),
    });

    if (!updated) {
      return res.status(404).json({ error: 'Ticket not found.' });
    }

    return res.json({ message: 'Ticket updated successfully.', ticket: updated });
  } catch (error) {
    console.error('Update ticket error:', error);
    return res.status(500).json({ error: 'Failed to update ticket.' });
  }
});


// --------------------------------------------------
// DELETE /api/tickets/:id
// Delete a ticket (admin and employee)
// --------------------------------------------------

router.delete('/:id', authenticate, (req, res) => {
  try {
    if (!fs.existsSync(ticketsFile)) {
      return res.status(404).json({
        error: 'Ticket storage file not found.',
      });
    }

    const tickets = JSON.parse(
      fs.readFileSync(ticketsFile, 'utf8')
    );

    const ticketIndex = tickets.findIndex(
      (ticket) => String(ticket.id) === String(req.params.id)
    );

    if (ticketIndex === -1) {
      return res.status(404).json({
        error: 'Ticket not found.',
      });
    }

    const deletedTicket = tickets[ticketIndex];

    tickets.splice(ticketIndex, 1);

    fs.writeFileSync(
      ticketsFile,
      JSON.stringify(tickets, null, 2),
      'utf8'
    );

    return res.json({
      message: 'Ticket deleted successfully.',
      ticket: deletedTicket,
    });
  } catch (error) {
    console.error('Delete ticket error:', error);

    return res.status(500).json({
      error: 'Failed to delete ticket.',
    });
  }
});

export default router;
