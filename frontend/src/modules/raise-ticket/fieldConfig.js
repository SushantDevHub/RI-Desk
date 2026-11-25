/**
 * Field configuration and helper options for the Raise Ticket module.
 */

export const CATEGORIES = [
  'Recharge',
  'Payment',
  'Wallet',
  'Technical Issue',
  'DTH',
  'Electricity',
  'Fastag',
  'Account & Profile',
  'Other',
];

export const OPERATORS = [
  'Airtel',
  'Jio',
  'Vodafone Idea (Vi)',
  'BSNL',
  'Google Pay',
  'PhonePe',
  'Paytm',
  'BHIM UPI',
  'Bank Transfer (IMPS/NEFT)',
  'Other',
];

export const DESCRIPTION_MAX_LENGTH = 250;

/**
 * Checks if the selected category is transaction/payment-related
 * so transaction fields (Transaction ID, Amount, Operator) should be shown.
 */
export function isTransactionCategory(category = '') {
  if (!category) return false;
  const normalized = category.trim().toLowerCase();
  return (
    normalized.includes('recharge') ||
    normalized.includes('payment') ||
    normalized.includes('wallet') ||
    normalized.includes('dth') ||
    normalized.includes('electricity') ||
    normalized.includes('fastag')
  );
}

/**
 * Initial empty form values for Clients.
 */
export const INITIAL_FORM_VALUES = {
  name: '',
  mobileNumber: '',
  userType: 'client',
  category: 'Recharge',
  subject: '',
  description: '',
  transactionId: '',
  amount: '',
  operator: 'Airtel',
  screenshot: null,
};
