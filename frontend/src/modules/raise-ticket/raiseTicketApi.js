/**
 * API integration for raising tickets from the public / standalone module.
 */

import { API_BASE } from '../../config/api.js';

const BASE_URL = `${API_BASE}/tickets/raise`;

/**
 * Submits a newly raised ticket to the backend.
 *
 * @param {object} ticketData
 * @returns {Promise<{ success: boolean, message: string, ticketId: string, ticket: object }>}
 */
export async function submitRaiseTicket(ticketData) {
  const response = await fetch(BASE_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(ticketData),
  });

  let data;
  try {
    data = await response.json();
  } catch (err) {
    throw new Error(`Server returned an invalid response (${response.status}).`);
  }

  if (!response.ok) {
    // If backend returned validation errors object
    if (data.errors && typeof data.errors === 'object') {
      const errorMsg = Object.values(data.errors).join(' ');
      const err = new Error(errorMsg || data.error || 'Validation failed.');
      err.fieldErrors = data.errors;
      throw err;
    }
    throw new Error(data.error || 'Failed to submit ticket. Please try again.');
  }

  return data;
}
