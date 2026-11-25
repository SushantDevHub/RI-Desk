
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

import { syncClientsWithTickets } from '../utils/clientStore.js';
import { getAllUsers } from '../utils/userStore.js';
import { addNotification } from '../utils/notificationStore.js';

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

function capitalize(str = '') {
  if (!str) return '';
  return String(str).charAt(0).toUpperCase() + String(str).slice(1);
}

function formatStatus(status = '') {
  if (status === 'in-progress') return 'In Progress';
  if (status === 'resolved') return 'Resolved';
  if (status === 'open') return 'Open';
  return capitalize(status);
}

function buildChangeSentence(change) {
  const fieldName = change.field === 'Assignment' ? 'Assigned Status' : change.field;
  const oldVal = change.oldValue || 'None';
  const newVal = change.newValue || 'None';
  return `${fieldName} changed from "${oldVal}" to "${newVal}"`;
}

function buildLogMessage(changes = [], action = '') {
  if (!changes || changes.length === 0) return action || 'Ticket updated';
  if (action === 'Ticket Created') {
    return `Ticket created with ${changes
      .map((c) => `${c.field === 'Assignment' ? 'Assigned Status' : c.field}: "${c.newValue}"`)
      .join(', ')}`;
  }
  return changes.map(buildChangeSentence).join(' • ');
}

function createLogEntry({
  performedBy = 'Admin User',
  performedByRole = 'admin',
  action = 'Updated',
  changes = [],
  priority = null,
  status = null,
  assignment = null,
  transferDetails = null,
  message = null,
}) {
  const generatedMessage = message || buildLogMessage(changes, action);
  return {
    id: `log_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    timestamp: new Date().toISOString(),
    performedBy,
    performedByRole,
    action,
    message: generatedMessage,
    priority,
    status,
    assignment,
    transferDetails,
    changes,
  };
}

function getOrSynthesizeLogs(ticket) {
  if (!ticket) return [];

  const isAssigned = Boolean(ticket.assignedTo || ticket.assignedToId);
  const employeeName = ticket.assignedTo || null;
  const actualAssignmentText = isAssigned
    ? `Assigned (${employeeName})`
    : 'Not Assigned (Unassigned)';
  const actualPriority = capitalize(ticket.priority || 'medium');
  const actualStatus = formatStatus(ticket.status || 'open');
  const actualDescription = (ticket.description || '').trim();
  const actualCategory = capitalize(ticket.category || 'Recharge');
  const actualSubject = (ticket.subject || '').trim();

  let logs = [];
  if (Array.isArray(ticket.logs) && ticket.logs.length > 0) {
    logs = ticket.logs.map((log) => ({ ...log }));
  } else {
    // Initial creation log
    const initialLog = {
      id: `log_init_${ticket.id || Date.now()}`,
      timestamp: ticket.createdAt || new Date().toISOString(),
      performedBy: ticket.createdBy || 'Admin User',
      performedByRole: 'admin',
      action: 'Ticket Created',
      priority: {
        old: null,
        new: ticket.priority || 'medium',
      },
      status: {
        old: null,
        new: ticket.status || 'open',
      },
      assignment: {
        old: null,
        new: employeeName,
        oldAssigned: false,
        newAssigned: isAssigned,
      },
      changes: [
        {
          field: 'Priority',
          oldValue: 'None',
          newValue: actualPriority,
        },
        {
          field: 'Status',
          oldValue: 'None',
          newValue: actualStatus,
        },
        {
          field: 'Assignment',
          oldValue: 'None',
          newValue: actualAssignmentText,
          isAssigned,
        },
        {
          field: 'Description',
          oldValue: 'None',
          newValue: actualDescription || 'No description provided',
        },
      ],
      message: `Ticket created with Priority: "${actualPriority}", Status: "${actualStatus}", Assignment: "${actualAssignmentText}"`,
    };

    logs = [initialLog];
  }

  // Track the latest logged state across all logs in chronological order
  const lastLoggedState = {
    priority: null,
    status: null,
    assignment: null,
    isAssigned: null,
    description: null,
    category: null,
    subject: null,
  };

  logs.forEach((log) => {
    if (log.priority && log.priority.new !== undefined && log.priority.new !== null) {
      lastLoggedState.priority = capitalize(log.priority.new);
    }
    if (log.status && log.status.new !== undefined && log.status.new !== null) {
      lastLoggedState.status = formatStatus(log.status.new);
    }
    if (log.assignment) {
      if (log.assignment.newAssigned !== undefined) {
        lastLoggedState.isAssigned = Boolean(log.assignment.newAssigned);
      }
      if (log.assignment.new !== undefined && log.assignment.new !== null) {
        lastLoggedState.assignment = log.assignment.newAssigned
          ? `Assigned (${log.assignment.new})`
          : 'Not Assigned (Unassigned)';
      }
    }
    if (Array.isArray(log.changes)) {
      log.changes.forEach((c) => {
        if (!c || !c.field) return;
        const f = String(c.field).toLowerCase();
        if (f === 'priority') lastLoggedState.priority = capitalize(c.newValue);
        if (f === 'status') lastLoggedState.status = formatStatus(c.newValue);
        if (f === 'assignment') {
          lastLoggedState.assignment = c.newValue;
          lastLoggedState.isAssigned =
            c.newAssigned ?? c.isAssigned ?? (c.newValue && !c.newValue.includes('Not Assigned'));
        }
        if (f === 'description') lastLoggedState.description = c.newValue;
        if (f === 'category') lastLoggedState.category = capitalize(c.newValue);
        if (f === 'subject') lastLoggedState.subject = c.newValue;
      });
    }
  });

  // Reconcile any divergence between the last logged state and the current ticket state
  const missingChanges = [];

  if (lastLoggedState.priority && lastLoggedState.priority !== actualPriority) {
    missingChanges.push({
      field: 'Priority',
      oldValue: lastLoggedState.priority,
      newValue: actualPriority,
    });
  }

  if (lastLoggedState.status && lastLoggedState.status !== actualStatus) {
    missingChanges.push({
      field: 'Status',
      oldValue: lastLoggedState.status,
      newValue: actualStatus,
    });
  }

  if (lastLoggedState.assignment && lastLoggedState.assignment !== actualAssignmentText) {
    missingChanges.push({
      field: 'Assignment',
      oldValue: lastLoggedState.assignment,
      newValue: actualAssignmentText,
      oldAssigned: Boolean(lastLoggedState.isAssigned),
      newAssigned: actualIsAssigned,
    });
  }

  if (
    lastLoggedState.description !== null &&
    actualDescription &&
    lastLoggedState.description.trim() !== actualDescription
  ) {
    missingChanges.push({
      field: 'Description',
      oldValue: lastLoggedState.description || 'None',
      newValue: actualDescription || 'None',
    });
  }

  if (lastLoggedState.category && lastLoggedState.category !== actualCategory) {
    missingChanges.push({
      field: 'Category',
      oldValue: lastLoggedState.category,
      newValue: actualCategory,
    });
  }

  if (lastLoggedState.subject && actualSubject && lastLoggedState.subject !== actualSubject) {
    missingChanges.push({
      field: 'Subject',
      oldValue: lastLoggedState.subject,
      newValue: actualSubject,
    });
  }

  if (missingChanges.length > 0) {
    const reconciledLog = createLogEntry({
      performedBy: ticket.resolvedBy || 'Admin User',
      performedByRole: ticket.resolvedBy ? 'admin' : 'employee',
      action: missingChanges
        .map((c) => `${c.field === 'Assignment' ? 'Assignment' : c.field} Changed`)
        .join(', '),
      priority: {
        old: lastLoggedState.priority || actualPriority,
        new: actualPriority,
      },
      status: {
        old: lastLoggedState.status || actualStatus,
        new: actualStatus,
      },
      assignment: {
        old: lastLoggedState.assignment || 'Not Assigned (Unassigned)',
        new: actualAssignmentText,
        oldAssigned: Boolean(lastLoggedState.isAssigned),
        newAssigned: actualIsAssigned,
      },
      changes: missingChanges,
      timestamp: ticket.updatedAt || new Date().toISOString(),
    });
    logs.push(reconciledLog);
  }

  return logs;
}

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

    const sortedTickets = [...tickets].map((t) => ({
      ...t,
      logs: getOrSynthesizeLogs(t),
    })).sort((a, b) => {
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
        status: user.status === 'inactive' ? 'inactive' : 'active',
      }));

    return res.json({ employees });
  } catch (error) {
    console.error('Get ticket employees error:', error);
    return res.status(500).json({ error: 'Failed to load employees.' });
  }
});

// --------------------------------------------------
// GET /api/tickets/admin-contact
// Fetch admin contact details for employee help/query
// --------------------------------------------------

router.get('/admin-contact', authenticate, (req, res) => {
  try {
    const allUsers = getAllUsers();
    const admin = allUsers.find((u) => u.role === 'admin') || {
      id: 1,
      name: 'Admin User',
      email: 'admin@ridesk.com',
      mobileNumber: '9876543210',
    };

    return res.json({
      admin: {
        id: admin.id,
        name: admin.name || 'Admin User',
        email: admin.email || 'admin@ridesk.com',
        mobileNumber: admin.mobileNumber || '9876543210',
      },
    });
  } catch (error) {
    console.error('Get admin contact error:', error);
    return res.status(500).json({ error: 'Failed to load admin contact.' });
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
      userType = 'client',
      client = '',
      customer = '',
      clientMobile = '',
      customerMobile = '',
      clientEmail = '',
      customerEmail = '',
      email = '',
      category = 'recharge',
      status = 'open',
      assignedToId,
    } = req.body;

    // Validate required fields
    if (typeof description !== 'string' || !description.trim()) {
      return res.status(400).json({
        error: 'Description is required.',
      });
    }
    if (description.trim().length > 250) {
      return res.status(400).json({
        error: 'Description cannot exceed 250 characters.',
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
    const isAssigned = Boolean(employee);
    const employeeName = employee ? employee.name : null;
    const createdAt = new Date().toISOString();

    const initialLog = createLogEntry({
      performedBy: req.user.name || 'Admin User',
      performedByRole: req.user.role || 'admin',
      action: 'Ticket Created',
      priority: {
        old: null,
        new: priority,
      },
      status: {
        old: null,
        new: status,
      },
      assignment: {
        old: null,
        new: employeeName,
        oldAssigned: false,
        newAssigned: isAssigned,
      },
      changes: [
        {
          field: 'Priority',
          oldValue: 'None',
          newValue: capitalize(priority),
        },
        {
          field: 'Status',
          oldValue: 'None',
          newValue: formatStatus(status),
        },
        {
          field: 'Assignment',
          oldValue: 'None',
          newValue: isAssigned ? `Assigned (${employeeName})` : 'Not Assigned (Unassigned)',
          isAssigned,
        },
        {
          field: 'Description',
          oldValue: 'None',
          newValue: description.trim() || 'No description provided',
        },
      ],
    });

    const finalClient = String(client || customer || '').trim();
    const finalClientMobile = String(clientMobile || customerMobile || '').trim();
    const finalEmail = String(clientEmail || customerEmail || email || '').trim();

    const ticket = {
      id: `TKT-${nextNumber}`,
      subject: typeof subject === 'string' ? subject.trim() : '',
      userType,
      client: finalClient,
      customer: finalClient,
      clientMobile: finalClientMobile,
      customerMobile: finalClientMobile,
      clientEmail: finalEmail,
      customerEmail: finalEmail,
      email: finalEmail,
      category: cleanedCategory,
      description: description.trim(),
      priority,
      status,
      createdBy: req.user.name || String(req.user.id),
      createdById: req.user.id,

      // Save both the employee ID and employee name
      assignedTo: employee ? employee.name : null,
      assignedToId: employee ? employee.id : null,

      createdAt,
      logs: [initialLog],
    };

    addTicket(ticket);
    try {
      syncClientsWithTickets();
    } catch (syncErr) {
      console.warn('Ticket client sync error:', syncErr.message);
    }

    let createdNotification = null;
    if (employee) {
      try {
        createdNotification = addNotification({
          recipientId: employee.id,
          recipientName: employee.name,
          senderId: req.user.id,
          senderName: req.user.name || 'Admin User',
          ticketId: ticket.id,
          ticketNumber: ticket.ticketNumber || ticket.id,
          ticketSubject: ticket.subject || ticket.category || 'Ticket',
          type: 'ticket_assigned',
        });
      } catch (notifErr) {
        console.error('Failed to create assignment notification on create:', notifErr);
      }
    }

    return res.status(201).json({
      message: 'Ticket created successfully.',
      ticket,
      notification: createdNotification,
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

      const existing = getAllTickets().find(
        (t) => String(t.id) === String(req.params.id)
      );

      if (!existing) {
        return res.status(404).json({
          error: 'Ticket not found.',
        });
      }

      const oldEmployeeName = existing.assignedTo || null;
      const oldIsAssigned = Boolean(existing.assignedTo || existing.assignedToId);
      const newEmployeeName = employee ? employee.name : null;
      const newIsAssigned = Boolean(employee);

      const assignLog = createLogEntry({
        performedBy: req.user.name || 'Admin User',
        performedByRole: req.user.role || 'admin',
        action: 'Assignment Updated',
        priority: {
          old: existing.priority || 'medium',
          new: existing.priority || 'medium',
        },
        status: {
          old: existing.status || 'open',
          new: existing.status || 'open',
        },
        assignment: {
          old: oldEmployeeName,
          new: newEmployeeName,
          oldAssigned: oldIsAssigned,
          newAssigned: newIsAssigned,
        },
        changes: [
          {
            field: 'Assignment',
            oldValue: oldIsAssigned
              ? `Assigned (${oldEmployeeName})`
              : 'Not Assigned (Unassigned)',
            newValue: newIsAssigned
              ? `Assigned (${newEmployeeName})`
              : 'Not Assigned (Unassigned)',
            oldAssigned: oldIsAssigned,
            newAssigned: newIsAssigned,
          },
        ],
      });

      const currentLogs = getOrSynthesizeLogs(existing);

      const updated = updateTicket(req.params.id, {
        assignedTo: employee.name,
        assignedToId: employee.id,
        logs: [...currentLogs, assignLog],
        updatedAt: new Date().toISOString(),
      });

      if (!updated) {
        return res.status(404).json({
          error: 'Ticket not found.',
        });
      }

      let createdNotification = null;
      try {
        createdNotification = addNotification({
          recipientId: employee.id,
          recipientName: employee.name,
          senderId: req.user.id,
          senderName: req.user.name || 'Admin User',
          ticketId: updated.id,
          ticketNumber: updated.ticketNumber || updated.id,
          ticketSubject: updated.subject || updated.category || 'Ticket',
          type: 'ticket_assigned',
        });
      } catch (notifErr) {
        console.error('Failed to create assignment notification on assign route:', notifErr);
      }

      return res.json({
        message: 'Ticket assigned successfully.',
        ticket: updated,
        notification: createdNotification,
      });
    } catch (error) {
      console.error('Assign ticket error:', error);

      return res.status(500).json({
        error: 'Failed to assign ticket.',
      });
    }
  }
);

// --------------------------------------------------
// POST /api/tickets/:id/transfer
// Transfer a ticket to another employee with work left description
// Accessible by BOTH Admin and Employees!
// --------------------------------------------------

router.post('/:id/transfer', authenticate, (req, res) => {
  try {
    const { transferToId, workLeftDescription } = req.body;

    if (!transferToId) {
      return res.status(400).json({ error: 'Please select an employee to transfer to.' });
    }

    const trimmedNotes = String(workLeftDescription || '').trim();
    if (!trimmedNotes) {
      return res.status(400).json({ error: 'Please describe the work done or work left on this ticket.' });
    }

    if (trimmedNotes.length > 250) {
      return res.status(400).json({ error: 'Work left description cannot exceed 250 characters.' });
    }

    const allUsers = getAllUsers();
    const targetEmployee = allUsers.find(
      (user) =>
        String(user.id) === String(transferToId) &&
        user.role === 'employee'
    );

    if (!targetEmployee) {
      return res.status(404).json({ error: 'Target employee not found.' });
    }

    if (targetEmployee.status === 'inactive') {
      return res.status(400).json({ error: 'Cannot transfer ticket to an inactive employee.' });
    }

    const existing = getAllTickets().find(
      (t) => String(t.id) === String(req.params.id)
    );

    if (!existing) {
      return res.status(404).json({ error: 'Ticket not found.' });
    }

    const oldEmployeeName = existing.assignedTo || null;
    const oldIsAssigned = Boolean(existing.assignedTo || existing.assignedToId);
    const newEmployeeName = targetEmployee.name;

    if (existing.assignedToId && String(existing.assignedToId) === String(targetEmployee.id)) {
      return res.status(400).json({ error: `Ticket is already assigned to ${newEmployeeName}.` });
    }

    if (String(req.user.id) === String(targetEmployee.id)) {
      return res.status(400).json({
        error: 'You cannot transfer a ticket to yourself. Please select another employee.',
      });
    }

    const performerName = req.user.name || (req.user.role === 'admin' ? 'Admin User' : 'Employee');
    const performerRole = req.user.role || 'employee';

    const transferLog = createLogEntry({
      performedBy: performerName,
      performedByRole: performerRole,
      action: 'Ticket Transferred',
      priority: {
        old: existing.priority || 'medium',
        new: existing.priority || 'medium',
      },
      status: {
        old: existing.status || 'open',
        new: existing.status || 'open',
      },
      assignment: {
        old: oldEmployeeName,
        new: newEmployeeName,
        oldAssigned: oldIsAssigned,
        newAssigned: true,
      },
      transferDetails: {
        from: oldEmployeeName || 'Unassigned',
        to: newEmployeeName,
        workLeft: trimmedNotes,
        transferredBy: performerName,
        transferredByRole: performerRole,
      },
      changes: [
        {
          field: 'Assignment',
          oldValue: oldIsAssigned
            ? `Assigned (${oldEmployeeName})`
            : 'Not Assigned (Unassigned)',
          newValue: `Assigned (${newEmployeeName})`,
          oldAssigned: oldIsAssigned,
          newAssigned: true,
        },
        {
          field: 'Work Left / Transfer Note',
          oldValue: existing.transferNotes || '—',
          newValue: trimmedNotes,
        },
      ],
      message: `Ticket transferred from "${oldEmployeeName || 'Unassigned'}" to "${newEmployeeName}" by ${performerName}. Work Left: "${trimmedNotes}"`,
    });

    const currentLogs = getOrSynthesizeLogs(existing);

    const updated = updateTicket(req.params.id, {
      assignedTo: newEmployeeName,
      assignedToId: targetEmployee.id,
      transferNotes: trimmedNotes,
      lastTransferredAt: new Date().toISOString(),
      lastTransferredBy: performerName,
      logs: [...currentLogs, transferLog],
      updatedAt: new Date().toISOString(),
    });

    if (!updated) {
      return res.status(404).json({ error: 'Ticket not found.' });
    }

    let createdNotification = null;
    try {
      createdNotification = addNotification({
        recipientId: targetEmployee.id,
        recipientName: newEmployeeName,
        senderId: req.user.id,
        senderName: performerName,
        ticketId: existing.id,
        ticketNumber: existing.ticketNumber || existing.id,
        ticketSubject: existing.subject || existing.category || 'Ticket',
        workLeft: trimmedNotes,
        type: 'ticket_transferred',
      });
    } catch (notifErr) {
      console.error('Failed to create transfer notification:', notifErr);
    }

    return res.json({
      message: `Ticket successfully transferred to ${newEmployeeName}.`,
      ticket: updated,
      log: transferLog,
      notification: createdNotification,
    });
  } catch (error) {
    console.error('Transfer ticket error:', error);
    return res.status(500).json({ error: 'Failed to transfer ticket.' });
  }
});

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

    const {
      status,
      priority,
      category,
      description,
      subject,
      assignedToId,
      client,
      customer,
      clientMobile,
      customerMobile,
      clientEmail,
      customerEmail,
      email,
      userType,
    } = req.body;
    const updates = {};
    const changes = [];

    const oldPriority = existing.priority || 'medium';
    let newPriority = oldPriority;

    const oldStatus = existing.status || 'open';
    let newStatus = oldStatus;

    const isAssigned = Boolean(existing.assignedTo || existing.assignedToId);
    const employeeName = existing.assignedTo || null;
    let newAssignedTo = employeeName;
    let newIsAssigned = isAssigned;

    // Client Name updates
    if (client !== undefined || customer !== undefined) {
      const incomingClient = client !== undefined ? client : customer;
      const oldClient = (existing.client || existing.customer || '').trim();
      const newClient = incomingClient !== undefined ? String(incomingClient).trim() : oldClient;
      if (oldClient !== newClient) {
        changes.push({
          field: 'Client',
          oldValue: oldClient || 'None',
          newValue: newClient || 'None',
        });
      }
      updates.client = newClient;
      updates.customer = newClient;
    }

    // Client Mobile updates
    if (clientMobile !== undefined || customerMobile !== undefined) {
      const incomingMobile = clientMobile !== undefined ? clientMobile : customerMobile;
      const oldMobile = (existing.clientMobile || existing.customerMobile || '').trim();
      const newMobile = incomingMobile !== undefined ? String(incomingMobile).trim() : oldMobile;
      if (oldMobile !== newMobile) {
        changes.push({
          field: 'Mobile',
          oldValue: oldMobile || 'None',
          newValue: newMobile || 'None',
        });
      }
      updates.clientMobile = newMobile;
      updates.customerMobile = newMobile;
    }

    // Client Email updates
    if (clientEmail !== undefined || customerEmail !== undefined || email !== undefined) {
      const incomingEmail = clientEmail !== undefined ? clientEmail : customerEmail !== undefined ? customerEmail : email;
      const oldEmail = (existing.clientEmail || existing.customerEmail || existing.email || '').trim();
      const newEmail = incomingEmail !== undefined ? String(incomingEmail).trim() : oldEmail;
      if (oldEmail !== newEmail) {
        changes.push({
          field: 'Email',
          oldValue: oldEmail || 'None',
          newValue: newEmail || 'None',
        });
      }
      updates.clientEmail = newEmail;
      updates.customerEmail = newEmail;
      updates.email = newEmail;
    }

    if (userType !== undefined) {
      updates.userType = userType;
    }

    if (assignedToId !== undefined) {
      if (
        assignedToId === null ||
        assignedToId === '' ||
        assignedToId === 0 ||
        String(assignedToId).trim().toLowerCase() === 'unassigned'
      ) {
        updates.assignedToId = null;
        updates.assignedTo = null;
        newAssignedTo = null;
        newIsAssigned = false;
      } else {
        const emp = getAllUsers().find(
          (u) => String(u.id) === String(assignedToId) && u.role === 'employee'
        );
        if (emp) {
          updates.assignedToId = emp.id;
          updates.assignedTo = emp.name;
          newAssignedTo = emp.name;
          newIsAssigned = true;
        }
      }

      if (newAssignedTo !== employeeName || newIsAssigned !== isAssigned) {
        changes.push({
          field: 'Assignment',
          oldValue: isAssigned
            ? `Assigned (${employeeName})`
            : 'Not Assigned (Unassigned)',
          newValue: newIsAssigned
            ? `Assigned (${newAssignedTo})`
            : 'Not Assigned (Unassigned)',
          oldAssigned: isAssigned,
          newAssigned: newIsAssigned,
        });
      }
    }

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
      if (cleanedCategory !== existing.category) {
        changes.push({
          field: 'Category',
          oldValue: capitalize(existing.category || 'Custom'),
          newValue: capitalize(cleanedCategory),
        });
      }
      updates.category = cleanedCategory;
    }

    if (subject !== undefined) {
      const trimmedSubject = String(subject || '').trim();
      const oldSubject = (existing.subject || '').trim();
      if (oldSubject !== trimmedSubject) {
        changes.push({
          field: 'Subject',
          oldValue: oldSubject || 'None',
          newValue: trimmedSubject || 'None',
        });
      }
      updates.subject = trimmedSubject;
    }

    if (description !== undefined) {
      const trimmedDesc = String(description || '').trim();
      if (!trimmedDesc) {
        return res.status(400).json({
          error: 'Description cannot be empty.',
        });
      }
      if (trimmedDesc.length > 250) {
        return res.status(400).json({
          error: 'Description cannot exceed 250 characters.',
        });
      }
      const oldDesc = (existing.description || '').trim();
      if (oldDesc !== trimmedDesc) {
        changes.push({
          field: 'Description',
          oldValue: oldDesc || 'None',
          newValue: trimmedDesc || 'None',
        });
      }
      updates.description = trimmedDesc;
    }

    if (status !== undefined) {
      if (!['open', 'in-progress', 'resolved'].includes(status)) {
        return res.status(400).json({
          error: 'Invalid status.',
        });
      }

      // Security constraint: Once a ticket is resolved, only admins can change its status
      if (
        existing.status === 'resolved' &&
        status !== 'resolved' &&
        req.user.role !== 'admin'
      ) {
        return res.status(403).json({
          error: 'Only administrators can re-open or change the status of a resolved ticket.',
        });
      }

      newStatus = status;
      if (status !== existing.status) {
        changes.push({
          field: 'Status',
          oldValue: formatStatus(existing.status),
          newValue: formatStatus(status),
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

      newPriority = priority;
      if (priority !== existing.priority) {
        changes.push({
          field: 'Priority',
          oldValue: capitalize(existing.priority),
          newValue: capitalize(priority),
        });
      }

      updates.priority = priority;
    }

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({
        error: 'Provide a status, priority, or category to update.',
      });
    }

    const currentLogs = getOrSynthesizeLogs(existing);
    if (changes.length > 0) {
      const logEntry = createLogEntry({
        performedBy: req.user.name || 'User',
        performedByRole: req.user.role || 'user',
        action: changes.map((c) => `${c.field} Changed`).join(', '),
        priority: {
          old: oldPriority,
          new: newPriority,
        },
        status: {
          old: oldStatus,
          new: newStatus,
        },
        assignment: {
          old: employeeName,
          new: newAssignedTo,
          oldAssigned: isAssigned,
          newAssigned: newIsAssigned,
        },
        changes,
      });
      updates.logs = [...currentLogs, logEntry];
    }

    updates.updatedAt = new Date().toISOString();

    const updated = updateTicket(req.params.id, updates);

    let createdNotification = null;
    if (
      updates.assignedToId &&
      String(updates.assignedToId) !== String(existing.assignedToId)
    ) {
      try {
        createdNotification = addNotification({
          recipientId: updates.assignedToId,
          recipientName: updates.assignedTo,
          senderId: req.user.id,
          senderName: req.user.name || 'Admin User',
          ticketId: updated.id,
          ticketNumber: updated.ticketNumber || updated.id,
          ticketSubject: updated.subject || updated.category || 'Ticket',
          type: 'ticket_assigned',
        });
      } catch (notifErr) {
        console.error('Failed to create assignment notification on inline update:', notifErr);
      }
    }

    return res.json({
      message:
        changes.length > 0
          ? buildLogMessage(changes, 'Ticket Updated')
          : 'Ticket updated successfully.',
      ticket: updated,
      notification: createdNotification,
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
      subject, userType, client, customer, clientMobile, customerMobile,
      clientEmail, customerEmail, email,
      category, priority, description, assignedToId, status,
    } = req.body;

    if (typeof description !== 'string' || !description.trim()) {
      return res.status(400).json({ error: 'Description is required.' });
    }
    if (description.trim().length > 250) {
      return res.status(400).json({ error: 'Description cannot exceed 250 characters.' });
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
    if (!existing) {
      return res.status(404).json({ error: 'Ticket not found.' });
    }

    // Security constraint: Once a ticket is resolved, only admins can change its status
    if (
      existing.status === 'resolved' &&
      status !== 'resolved' &&
      req.user.role !== 'admin'
    ) {
      return res.status(403).json({
        error: 'Only administrators can re-open or change the status of a resolved ticket.',
      });
    }

    const oldPriority = existing.priority || 'medium';
    const newPriority = priority;
    const oldStatus = existing.status || 'open';
    const newStatus = status;

    const oldAssignedTo = existing.assignedTo || null;
    const oldIsAssigned = Boolean(existing.assignedTo || existing.assignedToId);
    const newAssignedTo = employee ? employee.name : null;
    const newIsAssigned = Boolean(employee);

    const changes = [];
    if (oldPriority !== newPriority) {
      changes.push({
        field: 'Priority',
        oldValue: capitalize(oldPriority),
        newValue: capitalize(newPriority),
      });
    }
    if (oldStatus !== newStatus) {
      changes.push({
        field: 'Status',
        oldValue: formatStatus(oldStatus),
        newValue: formatStatus(newStatus),
      });
    }
    if (oldAssignedTo !== newAssignedTo || oldIsAssigned !== newIsAssigned) {
      changes.push({
        field: 'Assignment',
        oldValue: oldIsAssigned
          ? `Assigned (${oldAssignedTo})`
          : 'Not Assigned (Unassigned)',
        newValue: newIsAssigned
          ? `Assigned (${newAssignedTo})`
          : 'Not Assigned (Unassigned)',
        oldAssigned: oldIsAssigned,
        newAssigned: newIsAssigned,
      });
    }
    if (existing.category !== cleanedCategory) {
      changes.push({
        field: 'Category',
        oldValue: capitalize(existing.category || 'Custom'),
        newValue: capitalize(cleanedCategory),
      });
    }
    const finalSubject = typeof subject === 'string' ? subject.trim() : (existing.subject || '');
    if ((existing.subject || '') !== finalSubject && finalSubject) {
      changes.push({
        field: 'Subject',
        oldValue: existing.subject || '',
        newValue: finalSubject,
      });
    }
    const oldDescription = (existing.description || '').trim();
    const newDescription = description.trim();
    if (oldDescription !== newDescription) {
      changes.push({
        field: 'Description',
        oldValue: oldDescription || 'None',
        newValue: newDescription || 'None',
      });
    }
    const incomingClient = client !== undefined ? client : customer;
    const oldClient = (existing.client || existing.customer || '').trim();
    const newClient = incomingClient !== undefined ? String(incomingClient).trim() : oldClient;
    if (oldClient !== newClient) {
      changes.push({
        field: 'Client',
        oldValue: oldClient || 'None',
        newValue: newClient || 'None',
      });
    }

    const incomingMobile = clientMobile !== undefined ? clientMobile : customerMobile;
    const oldMobile = (existing.clientMobile || existing.customerMobile || '').trim();
    const newMobile = incomingMobile !== undefined ? String(incomingMobile).trim() : oldMobile;
    if (oldMobile !== newMobile) {
      changes.push({
        field: 'Mobile',
        oldValue: oldMobile || 'None',
        newValue: newMobile || 'None',
      });
    }

    const incomingEmail = clientEmail !== undefined ? clientEmail : customerEmail !== undefined ? customerEmail : email;
    const oldEmail = (existing.clientEmail || existing.customerEmail || existing.email || '').trim();
    const newEmail = incomingEmail !== undefined ? String(incomingEmail).trim() : oldEmail;
    if (oldEmail !== newEmail) {
      changes.push({
        field: 'Email',
        oldValue: oldEmail || 'None',
        newValue: newEmail || 'None',
      });
    }

    const currentLogs = getOrSynthesizeLogs(existing);
    let updatedLogs = currentLogs;
    if (changes.length > 0) {
      const logEntry = createLogEntry({
        performedBy: req.user.name || 'User',
        performedByRole: req.user.role || 'user',
        action: changes.map((c) => `${c.field} Changed`).join(', '),
        priority: {
          old: oldPriority,
          new: newPriority,
        },
        status: {
          old: oldStatus,
          new: newStatus,
        },
        assignment: {
          old: oldAssignedTo,
          new: newAssignedTo,
          oldAssigned: oldIsAssigned,
          newAssigned: newIsAssigned,
        },
        changes,
      });
      updatedLogs = [...currentLogs, logEntry];
    }

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
      subject: typeof subject === 'string' ? subject.trim() : (existing.subject || ''),
      userType,
      client: newClient,
      customer: newClient,
      clientMobile: newMobile,
      customerMobile: newMobile,
      clientEmail: newEmail,
      customerEmail: newEmail,
      email: newEmail,
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
      logs: updatedLogs,
      updatedAt: new Date().toISOString(),
    });

    if (!updated) {
      return res.status(404).json({ error: 'Ticket not found.' });
    }

    let createdNotification = null;
    if (employee && String(employee.id) !== String(existing.assignedToId)) {
      try {
        createdNotification = addNotification({
          recipientId: employee.id,
          recipientName: employee.name,
          senderId: req.user.id,
          senderName: req.user.name || 'Admin User',
          ticketId: updated.id,
          ticketNumber: updated.ticketNumber || updated.id,
          ticketSubject: updated.subject || updated.category || 'Ticket',
          type: 'ticket_assigned',
        });
      } catch (notifErr) {
        console.error('Failed to create assignment notification on ticket edit:', notifErr);
      }
    }

    return res.json({
      message:
        changes.length > 0
          ? buildLogMessage(changes, 'Ticket Updated')
          : 'Ticket updated successfully.',
      ticket: updated,
      notification: createdNotification,
    });
  } catch (error) {
    console.error('Update ticket error:', error);
    return res.status(500).json({ error: 'Failed to update ticket.' });
  }
});

// --------------------------------------------------
// GET /api/tickets/:id
// Get single ticket by ID
// --------------------------------------------------

router.get('/:id', authenticate, (req, res) => {
  try {
    const ticket = getAllTickets().find(
      (t) => String(t.id) === String(req.params.id)
    );

    if (!ticket) {
      return res.status(404).json({ error: 'Ticket not found.' });
    }

    const logs = getOrSynthesizeLogs(ticket);
    return res.json({
      ticket: { ...ticket, logs },
    });
  } catch (error) {
    console.error('Get single ticket error:', error);
    return res.status(500).json({ error: 'Failed to fetch ticket.' });
  }
});

// --------------------------------------------------
// GET /api/tickets/:id/logs
// Get ticket logs / audit history
// --------------------------------------------------

router.get('/:id/logs', authenticate, (req, res) => {
  try {
    const ticket = getAllTickets().find(
      (t) => String(t.id) === String(req.params.id)
    );

    if (!ticket) {
      return res.status(404).json({ error: 'Ticket not found.' });
    }

    const logs = getOrSynthesizeLogs(ticket);

    // If reconciled logs have added missing entries, persist to store
    if (!ticket.logs || ticket.logs.length !== logs.length) {
      updateTicket(ticket.id, { logs });
    }

    return res.json({
      ticketId: ticket.id,
      ticket: { ...ticket, logs },
      logs,
    });
  } catch (error) {
    console.error('Get ticket logs error:', error);
    return res.status(500).json({ error: 'Failed to fetch ticket logs.' });
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
