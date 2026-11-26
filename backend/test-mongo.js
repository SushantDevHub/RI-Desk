import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import path from 'path';
import { fileURLToPath } from 'url';
import User from './models/User.js';
import Ticket from './models/Ticket.js';
import { migrateFromJSON } from './utils/migrate.js';
import { getAllUsers, findUserByMobile, findUserById, addUser, updateUser } from './utils/userStore.js';
import { getAllTickets, findTicketById, addTicket, updateTicket, deleteTicket } from './utils/ticketStore.js';
import { raiseNewTicket } from './modules/tickets/ticketService.js';
import { connectDB } from './config/db.js';

async function runMongoDBTests() {
  console.log('====================================================');
  console.log('   STARTING MONGODB ATLAS INTEGRATION TEST SUITE    ');
  console.log('====================================================\n');

  let passedTests = 0;
  let totalTests = 0;

  function assert(condition, testName) {
    totalTests++;
    if (condition) {
      console.log(`[PASS] ${testName}`);
      passedTests++;
    } else {
      console.error(`[FAIL] ${testName}`);
    }
  }

  // ----------------------------------------------------
  // TEST 1: Database connection error handling when URI is missing
  // ----------------------------------------------------
  console.log('--- Test 1: Missing / Invalid MONGODB_URI Error Handling ---');
  const originalUri = process.env.MONGODB_URI;
  delete process.env.MONGODB_URI;
  delete process.env.MONGO_URI;

  let caughtError = null;
  try {
    await connectDB({ throwOnError: true });
  } catch (err) {
    caughtError = err;
  }
  assert(caughtError !== null, 'Properly threw error when MONGODB_URI was missing');
  assert(
    caughtError && caughtError.message.includes('MONGODB_URI is not configured in backend/.env'),
    'Helpful error message explains missing MONGODB_URI in backend/.env'
  );

  // ----------------------------------------------------
  // TEST 2: Start MongoDB Instance & Connect
  // ----------------------------------------------------
  console.log('\n--- Test 2: Connecting to MongoDB via Mongoose ---');
  const __dirname = path.dirname(fileURLToPath(import.meta.url));

  const mongoServer = await MongoMemoryServer.create({
    binary: {
      downloadDir: path.join(__dirname, '.mongo-bin'),
    },
  });
  const testUri = mongoServer.getUri();
  process.env.MONGODB_URI = testUri;

  const conn = await connectDB();
  assert(mongoose.connection.readyState === 1, 'Mongoose successfully connected to MongoDB');
  assert(conn.connection.readyState === 1, 'Connection state is ready (state = 1)');

  // ----------------------------------------------------
  // TEST 3: Migration of existing users and tickets from JSON
  // ----------------------------------------------------
  console.log('\n--- Test 3: Migration of existing JSON data without duplicates ---');
  const initialUsers = await User.find({}).lean();
  const initialTickets = await Ticket.find({}).lean();

  assert(initialUsers.length > 0, `Users migrated from users.json: ${initialUsers.length} users in MongoDB`);
  assert(Array.isArray(initialTickets), `Tickets collection verified in MongoDB (${initialTickets.length} tickets)`);

  // Verify Admin user exists in MongoDB
  const adminUser = await User.findOne({ role: 'admin' }).lean();
  assert(adminUser !== null && adminUser.name === 'Admin User', 'Admin user found in MongoDB with role: admin');

  // Test Deduplication by re-running migration
  console.log('\n--- Test 4: Re-running migration to verify zero duplicates ---');
  const migrationResult2 = await migrateFromJSON();
  assert(migrationResult2.usersMigrated === 0, 'Re-run migrated 0 users (zero duplicate users created)');
  assert(migrationResult2.ticketsMigrated === 0, 'Re-run migrated 0 tickets (zero duplicate tickets created)');

  const userCountAfter = await User.countDocuments();
  const ticketCountAfter = await Ticket.countDocuments();
  assert(userCountAfter === initialUsers.length, `User count unchanged (${userCountAfter})`);
  assert(ticketCountAfter === initialTickets.length, `Ticket count unchanged (${ticketCountAfter})`);

  // ----------------------------------------------------
  // TEST 5: User Authentication & Login Verification
  // ----------------------------------------------------
  console.log('\n--- Test 5: Authentication & User queries in MongoDB ---');
  const foundUser = await findUserByMobile(adminUser.mobileNumber);
  assert(foundUser !== null, 'findUserByMobile successfully retrieved user from MongoDB');
  assert(foundUser.id === adminUser.id, 'Retrieved correct user ID from MongoDB');

  // Verify password comparison with bcrypt works on migrated record
  // Default password in dev for admin is 'admin123' or bcrypt hash
  const isValidHash = foundUser.password.startsWith('$2a$') || foundUser.password.startsWith('$2b$');
  assert(isValidHash, 'User password in MongoDB is properly hashed with bcrypt');

  // ----------------------------------------------------
  // TEST 6: Employee Creation in MongoDB
  // ----------------------------------------------------
  console.log('\n--- Test 6: Creating a new Employee in MongoDB ---');
  const allUsers = await getAllUsers();
  const nextEmployeeId = Math.max(...allUsers.map((u) => Number(u.id) || 0)) + 1;

  const newEmployee = {
    id: nextEmployeeId,
    name: 'MongoDB Test Employee',
    email: 'mongo.test@ridesk.com',
    mobileNumber: '9988112233',
    password: await bcrypt.hash('SecretPass123', 10),
    role: 'employee',
    designation: 'Database Engineer',
    status: 'active',
  };

  const createdEmployee = await addUser(newEmployee);
  assert(createdEmployee !== null, 'Employee added successfully');

  const employeeInDb = await findUserById(nextEmployeeId);
  assert(employeeInDb !== null && employeeInDb.name === 'MongoDB Test Employee', 'Employee fetched from MongoDB by ID');
  assert(employeeInDb.designation === 'Database Engineer', 'Employee designation stored correctly');

  // ----------------------------------------------------
  // TEST 7: Public Raise Ticket in MongoDB
  // ----------------------------------------------------
  console.log('\n--- Test 7: Public Raise Ticket via Service in MongoDB ---');
  const newTicketData = {
    name: 'Apex Solutions Pvt Ltd',
    mobileNumber: '9876500000',
    email: 'apex@solutions.com',
    userType: 'client',
    category: 'Electricity Bill',
    subject: 'Electricity board payment pending credit',
    description: 'Payment was made through support portal for BESCOM but receipt is pending.',
    transactionId: 'TXN_BESCOM_9901',
    amount: 3250,
    operator: 'BESCOM (Bangalore, Karnataka)',
    providerName: 'BESCOM (Bangalore, Karnataka)',
    screenshot: null,
  };

  const raisedTicket = await raiseNewTicket(newTicketData);
  assert(raisedTicket !== null && raisedTicket.id.startsWith('TKT-'), `Public ticket raised with ID: ${raisedTicket.id}`);

  const ticketInDb = await findTicketById(raisedTicket.id);
  assert(ticketInDb !== null, 'Ticket retrieved from MongoDB by ID');
  assert(ticketInDb.client === 'Apex Solutions Pvt Ltd', 'Ticket client name saved in MongoDB');
  assert(ticketInDb.providerName === 'BESCOM (Bangalore, Karnataka)', 'Ticket providerName saved in MongoDB');
  assert(ticketInDb.operator === 'BESCOM (Bangalore, Karnataka)', 'Ticket operator saved in MongoDB');
  assert(ticketInDb.isUnassigned === true, 'Ticket isUnassigned flag set to true');
  assert(Array.isArray(ticketInDb.activityLog), 'Ticket activityLog array stored in MongoDB');

  // ----------------------------------------------------
  // TEST 8: Ticket Update & Resolution in MongoDB
  // ----------------------------------------------------
  console.log('\n--- Test 8: Ticket Update & Status Management in MongoDB ---');
  const updatedTicket = await updateTicket(raisedTicket.id, {
    status: 'in-progress',
    assignedTo: 'MongoDB Test Employee',
    assignedToId: nextEmployeeId,
  });
  assert(updatedTicket.status === 'in-progress', 'Ticket status updated to in-progress in MongoDB');
  assert(updatedTicket.assignedTo === 'MongoDB Test Employee', 'Ticket assignment updated in MongoDB');

  // Cleanup test employee & ticket
  await deleteTicket(raisedTicket.id);
  const ticketAfterDelete = await findTicketById(raisedTicket.id);
  assert(ticketAfterDelete === null, 'Ticket deleted successfully from MongoDB');

  await User.findOneAndDelete({ id: nextEmployeeId });
  const employeeAfterDelete = await findUserById(nextEmployeeId);
  assert(employeeAfterDelete === null, 'Test employee deleted successfully from MongoDB');

  // Keep backup JSON files clean of test artifacts
  const fsModule = await import('fs');
  fsModule.writeFileSync(path.resolve(__dirname, 'data', 'tickets.json'), '[]\n');
  const cleanUsers = (await getAllUsers()).filter((u) => Number(u.id) !== nextEmployeeId);
  fsModule.writeFileSync(path.resolve(__dirname, 'data', 'users.json'), JSON.stringify(cleanUsers, null, 2) + '\n');

  // Close MongoDB memory server
  await mongoose.disconnect();
  await mongoServer.stop();

  // Restore process.env
  if (originalUri) {
    process.env.MONGODB_URI = originalUri;
  } else {
    delete process.env.MONGODB_URI;
  }

  console.log('\n====================================================');
  console.log(`   TEST RESULTS: ${passedTests} / ${totalTests} TESTS PASSED`);
  console.log('====================================================\n');

  if (passedTests === totalTests) {
    console.log('All tests passed successfully with zero failures!');
    process.exit(0);
  } else {
    console.error(`Failed ${totalTests - passedTests} tests.`);
    process.exit(1);
  }
}

runMongoDBTests().catch((err) => {
  console.error('Unhandled test suite error:', err);
  process.exit(1);
});
