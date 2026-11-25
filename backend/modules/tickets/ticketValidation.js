/**
 * Validation rules for the Public/Standalone Raise Ticket module.
 */

// Categories that typically involve financial or operator transactions
export const TRANSACTION_CATEGORIES = [
  'recharge',
  'payment',
  'wallet',
  'dth',
  'electricity',
  'fastag',
  'bill payment',
];

export function isTransactionCategory(category = '') {
  const norm = String(category || '').trim().toLowerCase();
  return TRANSACTION_CATEGORIES.some((cat) => norm.includes(cat));
}

/**
 * Validates the payload for raising a new ticket.
 *
 * @param {object} body - Request body
 * @returns {{ isValid: boolean, errors: Record<string, string>, data: object }}
 */
export function validateRaiseTicket(body = {}) {
  const errors = {};

  const name = typeof body.name === 'string' ? body.name.trim() : '';
  const mobileNumber = typeof body.mobileNumber === 'string'
    ? body.mobileNumber.replace(/\D/g, '')
    : typeof body.mobileNumber === 'number'
    ? String(body.mobileNumber)
    : '';

  const userType = typeof body.userType === 'string' && body.userType.trim()
    ? body.userType.trim()
    : 'Customer';

  const category = typeof body.category === 'string' ? body.category.trim() : '';
  const subject = typeof body.subject === 'string' ? body.subject.trim() : '';
  const description = typeof body.description === 'string' ? body.description.trim() : '';

  const transactionId = typeof body.transactionId === 'string' ? body.transactionId.trim() : '';
  const amount = body.amount !== undefined && body.amount !== null && String(body.amount).trim() !== ''
    ? Number(String(body.amount).replace(/[^0-9.]/g, ''))
    : null;
  const operator = typeof body.operator === 'string' ? body.operator.trim() : '';
  const screenshot = typeof body.screenshot === 'string' && body.screenshot.trim()
    ? body.screenshot.trim()
    : null;

  // Name validation
  if (!name) {
    errors.name = 'Full name is required.';
  } else if (name.length < 2 || name.length > 100) {
    errors.name = 'Name must be between 2 and 100 characters.';
  }

  // Mobile number validation (standard 10-digit Indian mobile number)
  if (!mobileNumber) {
    errors.mobileNumber = 'Mobile number is required.';
  } else if (!/^[0-9]{10}$/.test(mobileNumber)) {
    errors.mobileNumber = 'Please enter a valid 10-digit mobile number.';
  }

  // Category validation
  if (!category) {
    errors.category = 'Please select a category.';
  } else if (category.length > 75) {
    errors.category = 'Category cannot exceed 75 characters.';
  }

  // Subject validation
  if (!subject) {
    errors.subject = 'Subject is required.';
  } else if (subject.length < 3 || subject.length > 150) {
    errors.subject = 'Subject must be between 3 and 150 characters.';
  }

  // Description validation (enforces 250 characters rule)
  if (!description) {
    errors.description = 'Description is required.';
  } else if (description.length > 250) {
    errors.description = 'Description cannot exceed 250 characters.';
  }

  // Conditional transaction fields validation
  const requiresTxn = isTransactionCategory(category);
  if (requiresTxn) {
    if (!transactionId) {
      errors.transactionId = 'Transaction ID / UTR is required for transaction issues.';
    }
    if (amount === null || isNaN(amount) || amount <= 0) {
      errors.amount = 'Please enter a valid transaction amount greater than ₹0.';
    }
  }

  // Screenshot validation (if provided as base64 string, limit to roughly 5MB)
  if (screenshot && screenshot.length > 7 * 1024 * 1024) {
    errors.screenshot = 'Screenshot file size exceeds 5MB limit.';
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors,
    data: {
      name,
      mobileNumber,
      userType,
      category,
      subject,
      description,
      transactionId: transactionId || null,
      amount: amount && !isNaN(amount) ? amount : null,
      operator: operator || null,
      screenshot: screenshot || null,
    },
  };
}
