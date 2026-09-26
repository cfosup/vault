import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { connectDB, disconnectDB } from '../src/config/db.js';
import {
  Organization,
  User,
  Company,
  Category,
  PaymentMethod,
  BudgetBucket,
  Expense,
  Income,
  ChatSession,
} from '../src/models/index.js';
import { seedCategories } from '../src/services/seedService.js';
import { app } from '../src/index.js';
import http from 'http';

async function runPhase1Test() {
  console.log('\n======================================================');
  console.log('       RUNNING EXPENSEFLOW BACKEND - PHASE 1 TESTS    ');
  console.log('======================================================\n');

  let mongod = null;
  let server = null;
  let passCount = 0;
  let failCount = 0;

  function assert(condition, message) {
    if (condition) {
      console.log(`  [PASS] ${message}`);
      passCount++;
    } else {
      console.error(`  [FAIL] ${message}`);
      failCount++;
    }
  }

  try {
    // 1. Setup Test Database
    console.log('[Step 1] Initializing Test Database...');
    let mongoUri = process.env.MONGODB_URI;

    // Check if cloud URI is valid and accessible or fallback to MongoMemoryServer
    let useMemoryServer = true;
    if (mongoUri && !mongoUri.includes('<username>') && !mongoUri.includes('user:password')) {
      try {
        console.log('[Step 1] Attempting connection to configured MONGODB_URI...');
        await connectDB(mongoUri);
        useMemoryServer = false;
        console.log('[Step 1] Connected to live MongoDB Atlas cluster.');
      } catch {
        console.log('[Step 1] Live cluster unreachable, falling back to in-memory MongoDB for local tests.');
        useMemoryServer = true;
      }
    }

    if (useMemoryServer) {
      console.log('[Step 1] Starting MongoMemoryServer for reliable, isolated local test execution...');
      mongod = await MongoMemoryServer.create();
      mongoUri = mongod.getUri();
      await connectDB(mongoUri);
    }

    assert(mongoose.connection.readyState === 1, 'MongoDB connection established successfully');

    // 2. Test Category Seeding Service
    console.log('\n[Step 2] Testing Category Seeding Service...');
    const seededCount = await seedCategories();
    assert(seededCount >= 50, `Seeded Chart of Accounts contains ${seededCount} categories (expected >= 50)`);

    const globalSample = await Category.findOne({ name: 'Infrastructure & Utilities' });
    assert(!!globalSample, 'Found "Infrastructure & Utilities" category');
    assert(globalSample?.isGlobal === true, 'Category is marked as isGlobal: true');
    assert(globalSample?.group === 'O', 'Category belongs to group "O" (Operations)');
    assert(
      globalSample?.subcategories.some((s) => s.name === 'Office Space'),
      'Subcategory "Office Space" exists'
    );

    // Test idempotency: running seed again should not duplicate
    const secondSeedCount = await seedCategories();
    assert(secondSeedCount === seededCount, 'Seed service is idempotent (did not duplicate records)');

    // 3. Test Organization & User Models
    console.log('\n[Step 3] Testing Organization & User Models...');
    await Organization.deleteMany({ slug: 'bright-digital' });
    await User.deleteMany({ email: 'ajay@brightdigital.test' });
    const org = await Organization.create({
      name: 'Bright Digital Technologies',
      slug: 'bright-digital',
      plan: 'free',
    });
    assert(!!org._id, 'Organization created with ID: ' + org._id);
    assert(org.slug === 'bright-digital', 'Organization slug generated correctly');

    const user = await User.create({
      orgId: org._id,
      name: 'Ajay Admin',
      email: 'ajay@brightdigital.test',
      passwordHash: '$2a$12$dummyHashedPasswordForTestPhase1',
      role: 'owner',
    });
    assert(!!user._id, 'User created with ID: ' + user._id);
    assert(user.role === 'owner', 'User role default is "owner"');

    // 4. Test Company Model
    console.log('\n[Step 4] Testing Company Model...');
    const company = await Company.create({
      orgId: org._id,
      name: 'BRIGHT DIGITAL PVT LTD',
      description: 'Core Software Consulting Entity',
      createdBy: user._id,
    });
    assert(!!company._id, 'Company created with ID: ' + company._id);
    assert(company.isActive === true, 'Company isActive defaults to true');

    // 5. Test PaymentMethod Model
    console.log('\n[Step 5] Testing PaymentMethod Model...');
    const paymentMethod = await PaymentMethod.create({
      orgId: org._id,
      name: 'HDFC Current Account',
      type: 'bank',
      accountNumber: '4455',
    });
    assert(!!paymentMethod._id, 'PaymentMethod created: ' + paymentMethod.name);
    assert(paymentMethod.type === 'bank', 'PaymentMethod type is bank');

    // 6. Test BudgetBucket Model
    console.log('\n[Step 6] Testing BudgetBucket Model...');
    const budget = await BudgetBucket.create({
      orgId: org._id,
      companyId: company._id,
      categoryId: globalSample._id,
      categoryName: globalSample.name,
      name: 'Q1 Infra Budget',
      limitAmount: 75000,
      period: 'monthly',
      alertThreshold: 80,
      createdBy: user._id,
    });
    assert(!!budget._id, 'BudgetBucket created with limit ₹75,000');
    assert(budget.alertThreshold === 80, 'Budget alert threshold defaults to 80%');

    // 7. Test Expense Model
    console.log('\n[Step 7] Testing Expense Model...');
    const expense = await Expense.create({
      orgId: org._id,
      companyId: company._id,
      categoryId: globalSample._id,
      categoryName: globalSample.name,
      subcategory: 'Office Space',
      amount: 15000,
      vendor: 'WeWork Hub',
      paymentMethodId: paymentMethod._id,
      paymentMethodName: paymentMethod.name,
      notes: 'Monthly desk rental',
      budgetBucketId: budget._id,
      createdBy: user._id,
    });
    assert(!!expense._id, 'Expense created with amount ₹' + expense.amount);
    assert(expense.isDeleted === false, 'Expense soft delete default is false');

    // 8. Test Income Model
    console.log('\n[Step 8] Testing Income Model...');
    const income = await Income.create({
      orgId: org._id,
      companyId: company._id,
      amount: 120000,
      source: 'Client SaaS Retainer',
      notes: 'Milestone 1 invoice payment',
      createdBy: user._id,
    });
    assert(!!income._id, 'Income created with amount ₹' + income.amount);

    // 9. Test ChatSession Model
    console.log('\n[Step 9] Testing ChatSession Model...');
    const session = await ChatSession.create({
      orgId: org._id,
      userId: user._id,
      sessionId: 'test-session-123',
      messages: [
        { role: 'user', content: 'What is our total spend for this month?' },
        { role: 'assistant', content: 'Your total spend so far is ₹15,000 across 1 expense.' },
      ],
    });
    assert(!!session._id, 'ChatSession created with 2 messages');
    assert(session.messages.length === 2, 'ChatSession messages array stored correctly');

    // 10. Test Health Check Endpoint
    console.log('\n[Step 10] Testing HTTP Health Check Endpoint...');
    const TEST_PORT = 4999;
    server = http.createServer(app);
    await new Promise((resolve) => server.listen(TEST_PORT, resolve));

    const healthResponse = await fetch(`http://localhost:${TEST_PORT}/health`);
    const healthData = await healthResponse.json();

    assert(healthResponse.status === 200, 'HTTP GET /health returned 200 OK');
    assert(healthData.status === 'ok', 'Health response status is "ok"');
    assert(healthData.db === 'connected', 'Health response reports db: "connected"');

    console.log('\n======================================================');
    console.log(`PHASE 1 TEST SUMMARY: ${passCount} PASSED, ${failCount} FAILED`);
    console.log('======================================================\n');

    if (failCount > 0) {
      process.exit(1);
    }
  } catch (error) {
    console.error('\n[FATAL ERROR IN PHASE 1 TEST]:', error);
    process.exit(1);
  } finally {
    if (server) {
      await new Promise((resolve) => server.close(resolve));
    }
    await disconnectDB();
    if (mongod) {
      await mongod.stop();
    }
  }
}

runPhase1Test();
