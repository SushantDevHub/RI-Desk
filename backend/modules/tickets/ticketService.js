import { getAllTickets, addTicket } from '../../utils/ticketStore.js';
import { syncClientsWithTickets } from '../../utils/clientStore.js';

/**
 * Creates and saves a new public ticket using existing ticket storage.
 *
 * @param {object} ticketData - Sanitized data from validateRaiseTicket
 * @returns {object} The saved ticket object
 */
export function raiseNewTicket(ticketData) {
  const tickets = getAllTickets();

  // Generate next sequential ticket ID matching #TKT-xxxx format
  const nextNumber =
    tickets.reduce((max, ticket) => {
      const match = String(ticket.id).match(/^TKT-(\d+)$/i);
      return match ? Math.max(max, Number(match[1])) : max;
    }, 1000) + 1;

  const ticketId = `TKT-${nextNumber}`;
  const now = new Date().toISOString();
  const priority = 'medium';
  const status = 'open';

  // Capitalize category cleanly (e.g. recharge -> Recharge)
  const rawCat = ticketData.category.trim();
  const formattedCategory = rawCat.charAt(0).toUpperCase() + rawCat.slice(1);

  // Generate initial creation audit log (exclusively for clients)
  const initialLog = {
    id: `log_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    timestamp: now,
    performedBy: ticketData.name || 'Client',
    performedByRole: 'client',
    action: 'Ticket Raised',
    message: `Ticket raised by Client "${ticketData.name}" via Support Portal with Priority: "Medium", Status: "Open", Category: "${formattedCategory}"`,
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
      new: null,
      oldAssigned: false,
      newAssigned: false,
    },
    changes: [
      {
        field: 'Priority',
        oldValue: 'None',
        newValue: 'Medium',
      },
      {
        field: 'Status',
        oldValue: 'None',
        newValue: 'Open',
      },
      {
        field: 'Assignment',
        oldValue: 'None',
        newValue: 'Not Assigned (Unassigned)',
        isAssigned: false,
      },
      {
        field: 'Description',
        oldValue: 'None',
        newValue: ticketData.description,
      },
    ],
  };

  if (ticketData.transactionId) {
    initialLog.changes.push({
      field: 'Transaction ID',
      oldValue: 'None',
      newValue: ticketData.transactionId,
    });
  }
  if (ticketData.amount) {
    initialLog.changes.push({
      field: 'Amount',
      oldValue: 'None',
      newValue: `₹${ticketData.amount}`,
    });
  }

  // Construct complete ticket matching existing database schema (strictly for clients)
  const newTicket = {
    id: ticketId,
    subject: ticketData.subject,
    userType: 'client',
    client: ticketData.name,
    customer: ticketData.name,
    clientMobile: ticketData.mobileNumber,
    customerMobile: ticketData.mobileNumber,
    clientEmail: ticketData.email || '',
    customerEmail: ticketData.email || '',
    email: ticketData.email || '',
    category: formattedCategory,
    description: ticketData.description,
    priority,
    status,
    createdBy: ticketData.name,
    createdById: null,
    source: 'self_service_portal',

    // Conditional transaction fields
    transactionId: ticketData.transactionId || null,
    amount: ticketData.amount || null,
    operator: ticketData.operator || null,
    screenshot: ticketData.screenshot || null,

    // Initial assignment status (Unassigned by default, will appear in admin/employee dashboard)
    assignedTo: null,
    assignedToId: null,

    createdAt: now,
    updatedAt: now,
    resolvedAt: null,
    resolution: null,
    resolutionTime: null,
    resolvedBy: null,
    resolvedById: null,

    logs: [initialLog],
  };

  // Persist ticket to existing tickets.json
  addTicket(newTicket);

  // Sync with client list so customer profile is indexed if applicable
  try {
    syncClientsWithTickets();
  } catch (syncErr) {
    console.warn('Client sync warning during raise ticket:', syncErr.message);
  }

  return newTicket;
}
