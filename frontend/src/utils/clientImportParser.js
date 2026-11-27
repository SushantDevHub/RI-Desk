import * as XLSX from 'xlsx';

const HEADER_ALIASES = {
  name: [
    'name',
    'clientname',
    'contactname',
    'contactperson',
    'contactpersonname',
    'personname',
    'fullname',
    'customername',
    'ownername',
  ],
  companyName: [
    'companyname',
    'company',
    'businessname',
    'firmname',
    'organization',
    'org',
    'shopname',
    'agencyname',
  ],
  mobileNumber: [
    'mobilenumber',
    'mobile',
    'phone',
    'phonenumber',
    'contactnumber',
    'contactno',
    'mobileno',
    'cell',
    'tel',
  ],
  email: ['email', 'emailid', 'emailaddress', 'mail'],
  whatsappNumber: ['whatsappnumber', 'whatsapp', 'whatsappno', 'wa'],
  cityState: ['citystate', 'city', 'state', 'location', 'cityandstate'],
  address: ['address', 'fulladdress', 'streetaddress', 'officeaddress'],
  website: ['website', 'web', 'url', 'site', 'domain'],
  monthlyRental: ['monthlyrental', 'rental', 'rent', 'monthlyrent', 'amount', 'planamount', 'fee'],
  services: ['services', 'service', 'subscribedservices', 'categories', 'category'],
  features: ['features', 'feature', 'activefeatures'],
  status: ['status', 'clientstatus', 'accountstatus'],
};

function normalizeHeaderKey(key) {
  return String(key || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
}

function resolveCanonicalField(rawHeader) {
  const norm = normalizeHeaderKey(rawHeader);
  if (!norm) return null;
  for (const [field, aliases] of Object.entries(HEADER_ALIASES)) {
    if (aliases.includes(norm)) {
      return field;
    }
  }
  return null;
}

function splitListField(value) {
  if (Array.isArray(value)) {
    return Array.from(new Set(value.map((v) => String(v || '').trim()).filter(Boolean)));
  }
  return Array.from(
    new Set(
      String(value || '')
        .split(/[,;|]/)
        .map((v) => v.trim())
        .filter((v) => v && v.toLowerCase() !== 'sms')
    )
  );
}

/**
 * Parses an uploaded .csv, .xlsx, or .xls file into validated client rows.
 */
export async function parseClientSpreadsheet(file) {
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: 'array' });

  const firstSheetName = workbook.SheetNames[0];
  if (!firstSheetName) {
    throw new Error('The uploaded file contains no worksheets.');
  }

  const sheet = workbook.Sheets[firstSheetName];
  const rawObjects = XLSX.utils.sheet_to_json(sheet, { defval: '' });

  if (!Array.isArray(rawObjects) || rawObjects.length === 0) {
    throw new Error('The uploaded spreadsheet is empty or missing data rows.');
  }

  const parsedRows = [];

  rawObjects.forEach((rawRow, idx) => {
    const mapped = {
      _rowNumber: idx + 2,
      name: '',
      companyName: '',
      mobileNumber: '',
      email: '',
      whatsappNumber: '',
      cityState: '',
      address: '',
      website: '',
      monthlyRental: 0,
      services: [],
      features: [],
      status: 'active',
    };

    let hasAnyValue = false;

    for (const [rawKey, rawVal] of Object.entries(rawRow)) {
      const valStr = String(rawVal ?? '').trim();
      if (valStr !== '') hasAnyValue = true;

      const canonical = resolveCanonicalField(rawKey);
      if (!canonical) continue;

      if (canonical === 'services' || canonical === 'features') {
        mapped[canonical] = splitListField(valStr);
      } else if (canonical === 'monthlyRental') {
        const cleaned = Number(valStr.replace(/[^0-9.-]/g, ''));
        mapped.monthlyRental = Number.isFinite(cleaned) && cleaned >= 0 ? cleaned : 0;
      } else if (canonical === 'mobileNumber' || canonical === 'whatsappNumber') {
        mapped[canonical] = valStr.replace(/\D/g, '');
      } else if (canonical === 'status') {
        mapped.status = valStr.toLowerCase() === 'inactive' ? 'inactive' : 'active';
      } else {
        mapped[canonical] = valStr;
      }
    }

    if (!hasAnyValue) return;

    if (!mapped.whatsappNumber && mapped.mobileNumber) {
      mapped.whatsappNumber = mapped.mobileNumber;
    }

    // Validate required fields
    let validationError = '';
    if (!mapped.name) {
      validationError = 'Missing Name';
    } else if (!mapped.companyName) {
      validationError = 'Missing Company Name';
    } else if (!mapped.mobileNumber || mapped.mobileNumber.length < 7) {
      validationError = 'Invalid/Missing Mobile Number';
    }

    parsedRows.push({
      ...mapped,
      _validationError: validationError,
    });
  });

  if (parsedRows.length === 0) {
    throw new Error('No non-empty client rows were found in the file.');
  }

  return parsedRows;
}

/**
 * Generates and triggers a download for a sample CSV or Excel template.
 */
export function downloadClientTemplate(format = 'xlsx') {
  const sampleRows = [
    {
      name: 'Rajesh Sharma',
      companyName: 'Sharma Recharge Hub',
      mobileNumber: '9876543210',
      email: 'rajesh@example.com',
      whatsappNumber: '9876543210',
      cityState: 'Ahmedabad, Gujarat',
      address: '102 Sunrise Complex, CG Road',
      website: 'https://sharmarecharge.in',
      monthlyRental: 1500,
      services: 'Recharge, DTH, Electricity',
      features: 'WhatsApp, Email',
      status: 'active',
    },
  ];

  const worksheet = XLSX.utils.json_to_sheet(sampleRows);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Clients');

  if (format === 'csv') {
    XLSX.writeFile(workbook, 'RI-Desk-Clients-Template.csv', { bookType: 'csv' });
  } else {
    XLSX.writeFile(workbook, 'RI-Desk-Clients-Template.xlsx', { bookType: 'xlsx' });
  }
}

/**
 * Exports an array of client objects to an Excel (.xlsx) or CSV (.csv) file.
 */
export function exportClientsSpreadsheet(clientsList = [], format = 'xlsx') {
  if (!Array.isArray(clientsList) || clientsList.length === 0) {
    throw new Error('No clients available to download.');
  }

  const rows = clientsList.map((client) => ({
    id: client.id || '',
    name: client.name || '',
    companyName: client.companyName || '',
    mobileNumber: client.mobileNumber || '',
    email: client.email || '',
    whatsappNumber: client.whatsappNumber || client.mobileNumber || '',
    cityState: client.cityState || '',
    address: client.address || '',
    website: client.website || '',
    monthlyRental: Number(client.monthlyRental) || 0,
    services: Array.isArray(client.services) ? client.services.join(', ') : '',
    features: Array.isArray(client.features) ? client.features.join(', ') : '',
    status: client.status || 'active',
  }));

  const worksheet = XLSX.utils.json_to_sheet(rows);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Clients');

  const dateTag = new Date().toISOString().slice(0, 10);

  if (format === 'csv') {
    XLSX.writeFile(workbook, `RI-Desk-Clients-${dateTag}.csv`, { bookType: 'csv' });
  } else {
    XLSX.writeFile(workbook, `RI-Desk-Clients-${dateTag}.xlsx`, { bookType: 'xlsx' });
  }
}
