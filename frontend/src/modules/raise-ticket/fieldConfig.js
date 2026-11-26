/**
 * Field configuration and helper options for the Raise Ticket module.
 */

export const CATEGORIES = [
  'Mobile Recharge',
  'DTH Recharge',
  'Gateway / Payment',
  'Electricity Bill',
  'Wallet',
  'Technical Issue',
  'Fastag',
  'Account & Profile',
  'Other',
];

/**
 * Returns the provider category key ('mobile', 'dth', 'payment', 'electricity')
 * if the selected category requires a dependent searchable provider dropdown.
 * Supports flexible case matching and historical category variants.
 *
 * @param {string} category
 * @returns {'mobile' | 'dth' | 'payment' | 'electricity' | null}
 */
export function getCategoryProviderType(category = '') {
  if (!category) return null;
  const norm = String(category).trim().toLowerCase();

  // Mobile Recharge
  if (norm.includes('mobile') || norm === 'recharge' || norm.includes('phone recharge')) {
    return 'mobile';
  }

  // DTH Recharge
  if (norm.includes('dth')) {
    return 'dth';
  }

  // Gateway / Payment
  if (norm.includes('gateway') || norm.includes('payment')) {
    return 'payment';
  }

  // Electricity Bill
  if (norm.includes('electric') || norm.includes('power board') || norm.includes('bijli')) {
    return 'electricity';
  }

  return null;
}

/**
 * Provider / Board options definitions per category type.
 */
export const CATEGORY_PROVIDERS = {
  mobile: {
    label: 'Mobile Operator',
    searchPlaceholder: 'Search mobile operator (e.g. Jio, Airtel, Vi)...',
    options: ['Jio', 'Airtel', 'Vi', 'BSNL', 'Other'],
  },
  dth: {
    label: 'DTH Service Provider',
    searchPlaceholder: 'Search DTH provider (e.g. Tata Play, Airtel Digital TV)...',
    options: ['Tata Play', 'Airtel Digital TV', 'Dish TV', 'Sun Direct', 'd2h', 'Other'],
  },
  payment: {
    label: 'Payment Gateway / App',
    searchPlaceholder: 'Search payment gateway (e.g. PhonePe, Google Pay)...',
    options: ['PhonePe', 'Google Pay', 'BharatPe', 'HDFC Vyapar', 'Other'],
  },
  electricity: {
    label: 'Electricity Board / Provider',
    searchPlaceholder: 'Search electricity board (e.g. Adani, Tata Power, BESCOM, Mahavitaran)...',
    options: [
      'Adani Electricity Mumbai',
      'Tata Power (Mumbai / Delhi)',
      'BSES Rajdhani (Delhi)',
      'BSES Yamuna (Delhi)',
      'Mahavitaran (MSEDCL - Maharashtra)',
      'BEST Undertaking (Mumbai)',
      'Torrent Power (Gujarat / Maharashtra / UP)',
      'BESCOM (Bangalore, Karnataka)',
      'HESCOM (Hubli, Karnataka)',
      'GESCOM (Gulbarga, Karnataka)',
      'MESCOM (Mangalore, Karnataka)',
      'CESC (Mysore, Karnataka)',
      'TANGEDCO (Tamil Nadu)',
      'WBSEDCL (West Bengal)',
      'CESC (Kolkata)',
      'UPPCL (Uttar Pradesh - Urban / Rural)',
      'PSPCL (Punjab)',
      'DHBVN (Haryana)',
      'UHBVN (Haryana)',
      'JVVNL (Jaipur, Rajasthan)',
      'AVVNL (Ajmer, Rajasthan)',
      'JDVVNL (Jodhpur, Rajasthan)',
      'APEPDCL (Andhra Pradesh)',
      'APSPDCL (Andhra Pradesh)',
      'TSSPDCL (Telangana)',
      'TSNPDCL (Telangana)',
      'SBPDCL (South Bihar)',
      'NBPDCL (North Bihar)',
      'DGVCL (Gujarat)',
      'MGVCL (Gujarat)',
      'PGVCL (Gujarat)',
      'UGVCL (Gujarat)',
      'MPPKVVCL (Madhya Pradesh)',
      'CSPDCL (Chhattisgarh)',
      'KSEB (Kerala)',
      'JBVNL (Jharkhand)',
      'TPCODL (Odisha)',
      'Other',
    ],
  },
};

export const DESCRIPTION_MAX_LENGTH = 250;

/**
 * Fallback operator list for non-provider transaction categories.
 */
export const OPERATORS = [
  'Jio',
  'Airtel',
  'Vi',
  'BSNL',
  'Tata Play',
  'Airtel Digital TV',
  'Dish TV',
  'Sun Direct',
  'd2h',
  'PhonePe',
  'Google Pay',
  'BharatPe',
  'HDFC Vyapar',
  'Paytm',
  'Other',
];

/**
 * Checks if the selected category is transaction/payment-related
 * so transaction fields (Transaction ID, Amount) should be shown.
 */
export function isTransactionCategory(category = '') {
  if (!category) return false;
  const normalized = category.trim().toLowerCase();
  return (
    normalized.includes('recharge') ||
    normalized.includes('payment') ||
    normalized.includes('gateway') ||
    normalized.includes('wallet') ||
    normalized.includes('dth') ||
    normalized.includes('electric') ||
    normalized.includes('fastag')
  );
}

/**
 * Initial empty form values for Clients.
 */
export const INITIAL_FORM_VALUES = {
  name: '',
  mobileNumber: '',
  email: '',
  userType: 'client',
  category: 'Mobile Recharge',
  provider: '',
  customProvider: '',
  subject: '',
  description: '',
  transactionId: '',
  amount: '',
  operator: '',
  screenshot: null,
};
