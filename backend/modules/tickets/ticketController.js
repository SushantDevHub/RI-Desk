import { validateRaiseTicket } from './ticketValidation.js';
import { raiseNewTicket } from './ticketService.js';

/**
 * Controller handler for raising a public ticket.
 * POST /api/tickets/raise
 */
export async function raiseTicketController(req, res) {
  try {
    const { isValid, errors, data } = validateRaiseTicket(req.body);

    if (!isValid) {
      return res.status(400).json({
        success: false,
        error: 'Please fix the errors below before submitting.',
        errors,
      });
    }

    const ticket = await raiseNewTicket(data);

    return res.status(201).json({
      success: true,
      message: `Ticket raised successfully! Your Ticket ID is #${ticket.id}.`,
      ticketId: ticket.id,
      ticket,
    });
  } catch (error) {
    console.error('Error in raiseTicketController:', error);
    return res.status(500).json({
      success: false,
      error: 'An internal error occurred while raising the ticket. Please try again.',
      details: error.message,
    });
  }
}
