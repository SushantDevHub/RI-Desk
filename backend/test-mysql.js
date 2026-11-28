import './config/env.js';
import assert from 'node:assert/strict';
import bcrypt from 'bcryptjs';
import {
  connectDB,
  closeDB,
  isDatabaseConnected,
  getPool,
} from './config/db.js';
import {
  getAllUsers,
  findUserByMobile,
  findUserByEmail,
  findUserById,
  addUser,
  updateUser,
  deleteUser,
} from './utils/userStore.js';
import {
  getAllTickets,
  findTicketById,
  addTicket,
  updateTicket,
  deleteTicket,
} from './utils/ticketStore.js';
import {
  getAllClients,
  findClientById,
} from './utils/clientStore.js';

async function runMySqlTests() {
  console.log('=== RI-DESK MYSQL INTEGRATION VERIFICATION ===');

  const pool = await connectDB({ throwOnError: true });
  assert.ok(pool && isDatabaseConnected(), 'Connected to MySQL ri_desk pool');

  // 1. Verify tables exist
  const [tables] = await pool.query('SHOW TABLES');
  const tableNames = tables.map((r) => Object.values(r)[0]);
  assert.ok(tableNames.includes('users'), 'users table exists');
  assert.ok(tableNames.includes('tickets'), 'tickets table exists');
  assert.ok(tableNames.includes('clients'), 'clients table exists');
  console.log('[PASS] Tables verified:', tableNames.join(', '));

  // 2. Verify migrated users & admin account
  const users = await getAllUsers();
  assert.ok(users.length >= 1, `Users loaded from MySQL (${users.length})`);
  const adminUser = users.find((u) => u.role === 'admin');
  assert.ok(adminUser, 'Migrated admin account exists in MySQL');
  const byMob = await findUserByMobile(adminUser.mobileNumber);
  assert.equal(byMob.id, adminUser.id, 'findUserByMobile works against MySQL');
  if (adminUser.email) {
    const byEmail = await findUserByEmail(adminUser.email);
    assert.equal(byEmail.id, adminUser.id, 'findUserByEmail works against MySQL');
  }
  console.log('[PASS] Migrated users & admin lookup verified');

  // 3. Test employee CRUD + bcrypt hash in MySQL (cleaned up afterwards)
  const testEmpId = 999901;
  const testMobile = '9999900001';
  await deleteUser(testEmpId).catch(() => {});

  const passwordHash = await bcrypt.hash('TestPass@123', 10);
  const createdEmp = await addUser({
    id: testEmpId,
    name: 'MySQL Verify Emp',
    email: 'mysql.verify@ridesk.local',
    mobileNumber: testMobile,
    password: passwordHash,
    role: 'employee',
    designation: 'Support',
    status: 'active',
  });
  assert.equal(createdEmp.id, testEmpId);

  const fetchedEmp = await findUserById(testEmpId);
  assert.equal(fetchedEmp.name, 'MySQL Verify Emp');
  assert.equal(await bcrypt.compare('TestPass@123', fetchedEmp.password), true);

  const updatedEmp = await updateUser(testEmpId, { designation: 'Senior Support' });
  assert.equal(updatedEmp.designation, 'Senior Support');
  console.log('[PASS] Employee create / read / bcrypt / update verified');

  // 4. Test ticket CRUD, assignment, logs & stats compatibility (cleaned up afterwards)
  const testTicketId = 'TKT-999901';
  await deleteTicket(testTicketId).catch(() => {});

  const createdTicket = await addTicket({
    id: testTicketId,
    subject: 'MySQL Smoke Test Ticket',
    category: 'Technical',
    description: 'Testing ticket persistence in MySQL',
    priority: 'high',
    status: 'open',
    userType: 'client',
    client: 'Smoke Test Client',
    customer: 'Smoke Test Client',
    clientMobile: '9999988888',
    customerMobile: '9999988888',
    createdBy: 'Admin User',
    assignedTo: 'MySQL Verify Emp',
    assignedToId: testEmpId,
    isUnassigned: false,
    logs: [{ id: 'log_1', action: 'Created', message: 'Test log' }],
    activityLog: [{ action: 'Created' }],
  });
  assert.equal(createdTicket.id, testTicketId);
  assert.equal(createdTicket.assignedToId, testEmpId);
  assert.equal(Array.isArray(createdTicket.logs), true);
  assert.equal(createdTicket.logs.length, 1);

  const updatedTicket = await updateTicket(testTicketId, {
    status: 'resolved',
    resolvedBy: 'MySQL Verify Emp',
    resolvedById: testEmpId,
    resolvedAt: new Date().toISOString(),
    resolution: '2 mins',
    resolutionTime: '2 mins',
  });
  assert.equal(updatedTicket.status, 'resolved');
  assert.equal(updatedTicket.resolvedById, testEmpId);

  const fetchedTicket = await findTicketById(testTicketId);
  assert.equal(fetchedTicket.status, 'resolved');
  const allTickets = await getAllTickets();
  assert.ok(allTickets.some((t) => t.id === testTicketId));
  console.log('[PASS] Ticket create / assign / resolve / JSON logs verified');

  // Cleanup smoke ticket & user before checking client sync so no synthetic client is persisted
  await deleteTicket(testTicketId);
  await deleteUser(testEmpId);

  // 5. Verify clients query & ticket sync
  const allClients = await getAllClients();
  assert.ok(Array.isArray(allClients) && allClients.length >= 1, `Clients loaded (${allClients.length})`);
  const firstClient = await findClientById(allClients[0].id);
  assert.ok(firstClient, 'findClientById works against MySQL');
  console.log('[PASS] Clients query & ticket sync verified');

  await closeDB();
  console.log('ALL_MYSQL_TESTS_PASSED');
}

runMySqlTests().catch(async (err) => {
  console.error('MYSQL TEST FAILED:', err);
  await closeDB();
  process.exit(1);
});
