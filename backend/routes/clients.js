import express from 'express';
import jwt from 'jsonwebtoken';
import {
  getAllClients,
  findClientById,
  addClient,
  updateClient,
  deleteClient,
} from '../utils/clientStore.js';

const router = express.Router();

function authenticate(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;

  if (!token) {
    return res.status(401).json({ error: 'Authentication required.' });
  }

  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET);
    next();
  } catch (error) {
    return res.status(401).json({ error: 'Invalid or expired token.' });
  }
}

// --------------------------------------------------
// GET /api/clients - list all clients
// --------------------------------------------------
router.get('/', authenticate, (req, res) => {
  try {
    const rawClients = getAllClients();
    const clients = rawClients.map((client) => {
      const services = Array.isArray(client.services)
        ? client.services
        : Array.isArray(client.servicesFeatures)
        ? client.servicesFeatures.filter((s) => !isCommonFeature(s))
        : [];

      const features = Array.isArray(client.features)
        ? client.features
        : Array.isArray(client.servicesFeatures)
        ? client.servicesFeatures.filter((s) => isCommonFeature(s))
        : [];

      return {
        ...client,
        services,
        features,
        servicesFeatures: Array.from(new Set([...(client.servicesFeatures || []), ...services, ...features])),
      };
    });
    return res.json({ clients });
  } catch (error) {
    console.error('Get clients error:', error);
    return res.status(500).json({ error: 'Failed to load clients.' });
  }
});

function isCommonFeature(str = '') {
  const s = String(str).toLowerCase();
  return (
    s.includes('support') ||
    s.includes('backup') ||
    s.includes('ssl') ||
    s.includes('portal') ||
    s.includes('api') ||
    s.includes('monitoring') ||
    s.includes('ivr') ||
    s.includes('recording') ||
    s.includes('security')
  );
}

// --------------------------------------------------
// POST /api/clients - create a new client
// --------------------------------------------------
router.post('/', authenticate, (req, res) => {
  try {
    const {
      name,
      companyName,
      address = '',
      website = '',
      mobileNumber,
      email = '',
      whatsappNumber = '',
      cityState = '',
      monthlyRental = 0,
      services = [],
      features = [],
      servicesFeatures = [],
      status = 'active',
    } = req.body;

    const trimmedName = String(name || '').trim();
    if (!trimmedName) {
      return res.status(400).json({ error: 'Client contact person name is required.' });
    }

    const trimmedCompany = String(companyName || '').trim();
    if (!trimmedCompany) {
      return res.status(400).json({ error: 'Company name is required.' });
    }

    const trimmedMobile = String(mobileNumber || '').trim();
    if (!trimmedMobile) {
      return res.status(400).json({ error: 'Mobile number is required.' });
    }

    // Clean services array
    const cleanedServices = Array.isArray(services)
      ? Array.from(
          new Set(
            services
              .map((s) => String(s || '').trim())
              .filter(Boolean)
          )
        )
      : [];

    // Clean features array
    const cleanedFeatures = Array.isArray(features)
      ? Array.from(
          new Set(
            features
              .map((f) => String(f || '').trim())
              .filter(Boolean)
          )
        )
      : [];

    const mergedAll = Array.from(
      new Set([
        ...cleanedServices,
        ...cleanedFeatures,
        ...(Array.isArray(servicesFeatures) ? servicesFeatures.map((x) => String(x || '').trim()) : []),
      ])
    ).filter(Boolean);

    const clients = getAllClients();
    const nextNumber =
      clients.reduce((max, client) => {
        const match = String(client.id || '').match(/^CLI-(\d+)$/i);
        return match ? Math.max(max, Number(match[1])) : max;
      }, 1000) + 1;

    const newClient = {
      id: `CLI-${nextNumber}`,
      name: trimmedName,
      companyName: trimmedCompany,
      address: String(address || '').trim(),
      website: String(website || '').trim(),
      mobileNumber: trimmedMobile,
      email: String(email || '').trim(),
      whatsappNumber: String(whatsappNumber || '').trim() || trimmedMobile,
      cityState: String(cityState || '').trim(),
      monthlyRental: Number(monthlyRental) || 0,
      services: cleanedServices,
      features: cleanedFeatures,
      servicesFeatures: mergedAll,
      status: status === 'inactive' ? 'inactive' : 'active',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      createdBy: req.user?.name || 'Admin User',
    };

    addClient(newClient);

    return res.status(201).json({
      message: 'Client created successfully.',
      client: newClient,
    });
  } catch (error) {
    console.error('Create client error:', error);
    return res.status(500).json({ error: 'Failed to create client.' });
  }
});

// --------------------------------------------------
// PUT /api/clients/:id - update an existing client
// --------------------------------------------------
router.put('/:id', authenticate, (req, res) => {
  try {
    const existing = findClientById(req.params.id);
    if (!existing) {
      return res.status(404).json({ error: 'Client not found.' });
    }

    const {
      name,
      companyName,
      address,
      website,
      mobileNumber,
      email,
      whatsappNumber,
      cityState,
      monthlyRental,
      services,
      features,
      servicesFeatures,
      status,
    } = req.body;

    const updates = {};

    if (name !== undefined) {
      const trimmed = String(name || '').trim();
      if (!trimmed) {
        return res.status(400).json({ error: 'Client contact person name cannot be empty.' });
      }
      updates.name = trimmed;
    }

    if (companyName !== undefined) {
      const trimmed = String(companyName || '').trim();
      if (!trimmed) {
        return res.status(400).json({ error: 'Company name cannot be empty.' });
      }
      updates.companyName = trimmed;
    }

    if (mobileNumber !== undefined) {
      const trimmed = String(mobileNumber || '').trim();
      if (!trimmed) {
        return res.status(400).json({ error: 'Mobile number cannot be empty.' });
      }
      updates.mobileNumber = trimmed;
    }

    if (address !== undefined) updates.address = String(address || '').trim();
    if (website !== undefined) updates.website = String(website || '').trim();
    if (email !== undefined) updates.email = String(email || '').trim();
    if (whatsappNumber !== undefined) updates.whatsappNumber = String(whatsappNumber || '').trim();
    if (cityState !== undefined) updates.cityState = String(cityState || '').trim();
    if (monthlyRental !== undefined) updates.monthlyRental = Number(monthlyRental) || 0;
    if (status !== undefined) updates.status = status === 'inactive' ? 'inactive' : 'active';

    if (services !== undefined) {
      updates.services = Array.isArray(services)
        ? Array.from(
            new Set(
              services
                .map((s) => String(s || '').trim())
                .filter(Boolean)
            )
          )
        : [];
    }

    if (features !== undefined) {
      updates.features = Array.isArray(features)
        ? Array.from(
            new Set(
              features
                .map((f) => String(f || '').trim())
                .filter(Boolean)
            )
          )
        : [];
    }

    const currentServices = updates.services !== undefined ? updates.services : (existing.services || []);
    const currentFeatures = updates.features !== undefined ? updates.features : (existing.features || []);

    updates.servicesFeatures = Array.from(
      new Set([
        ...currentServices,
        ...currentFeatures,
        ...(Array.isArray(servicesFeatures) ? servicesFeatures : []),
      ])
    ).filter(Boolean);

    const updated = updateClient(req.params.id, updates);

    return res.json({
      message: 'Client updated successfully.',
      client: updated,
    });
  } catch (error) {
    console.error('Update client error:', error);
    return res.status(500).json({ error: 'Failed to update client.' });
  }
});

// --------------------------------------------------
// DELETE /api/clients/:id - delete a client
// --------------------------------------------------
router.delete('/:id', authenticate, (req, res) => {
  try {
    const existing = findClientById(req.params.id);
    if (!existing) {
      return res.status(404).json({ error: 'Client not found.' });
    }

    deleteClient(req.params.id);

    return res.json({
      message: `Client "${existing.name}" (${existing.companyName}) deleted successfully.`,
      deletedId: req.params.id,
    });
  } catch (error) {
    console.error('Delete client error:', error);
    return res.status(500).json({ error: 'Failed to delete client.' });
  }
});

export default router;
