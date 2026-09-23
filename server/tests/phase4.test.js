import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { disconnectDB } from '../src/config/db.js';
import { startServer, stopServer } from '../src/index.js';

async function runPhase4Test() {
  console.log('\n======================================================');
  console.log('       RUNNING EXPENSEFLOW BACKEND - PHASE 4 TESTS    ');
  console.log('======================================================\n');

  let mongod = null;
  let passCount = 0;
  let failCount = 0;
  const TEST_PORT = 4004;
  const GRAPHQL_URL = `http://localhost:${TEST_PORT}/graphql`;

  function assert(condition, message) {
    if (condition) {
      console.log(`  [PASS] ${message}`);
      passCount++;
    } else {
      console.error(`  [FAIL] ${message}`);
      failCount++;
    }
  }

  async function gql(query, variables = {}, token = null) {
    const headers = { 'Content-Type': 'application/json' };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const res = await fetch(GRAPHQL_URL, {
      method: 'POST',
      headers,
      body: JSON.stringify({ query, variables }),
    });

    return res.json();
  }

  try {
    // 1. Initialize Server & DB
    console.log('[Step 1] Initializing Test Database & Apollo Server...');
    mongod = await MongoMemoryServer.create();
    const mongoUri = mongod.getUri();
    await startServer(TEST_PORT, mongoUri);

    // 2. Register Org & Seed Sample Data
    console.log('\n[Step 2] Setting up Org and Financial Data for AI Context...');
    const regRes = await gql(`
      mutation RegisterOrg($input: RegisterInput!) {
        register(input: $input) {
          token
          org { id }
        }
      }
    `, {
      input: {
        name: 'Chat Tester',
        email: 'chat@tester.test',
        password: 'securePassword123',
        orgName: 'AI Flow Inc',
      },
    });

    const token = regRes.data?.register?.token;
    assert(!!token, 'Registered test organization');

    const compRes = await gql(`
      mutation CreateComp($input: CompanyInput!) {
        createCompany(input: $input) { id }
      }
    `, { input: { name: 'AI Flow Software' } }, token);
    const companyId = compRes.data?.createCompany?.id;

    const catRes = await gql(`query GetCats { categories { id name } }`, {}, token);
    const infraCat = catRes.data?.categories?.find((c) => c.name === 'Infrastructure & Utilities');

    // Add ₹45,000 in expenses
    await gql(`
      mutation SeedExp($inputs: [ExpenseInput!]!) {
        createExpenses(inputs: $inputs) { id }
      }
    `, {
      inputs: [
        {
          companyId,
          categoryId: infraCat.id,
          categoryName: infraCat.name,
          subcategory: 'Office Space',
          amount: 45000,
          vendor: 'HQ Offices',
        },
      ],
    }, token);

    // Add ₹120,000 in income
    await gql(`
      mutation SeedInc($inputs: [IncomeInput!]!) {
        createIncomes(inputs: $inputs) { id }
      }
    `, {
      inputs: [
        {
          companyId,
          amount: 120000,
          source: 'Enterprise License',
        },
      ],
    }, token);

    // 3. Test sendChatMessage (Total Expenses Query)
    console.log('\n[Step 3] Testing sendChatMessage for Total Spend...');
    const SESSION_ID = 'test-session-finance-001';

    const msg1Res = await gql(`
      mutation SendMsg1($sessionId: String!, $message: String!) {
        sendChatMessage(sessionId: $sessionId, message: $message) {
          role
          content
          timestamp
        }
      }
    `, {
      sessionId: SESSION_ID,
      message: 'What are my total expenses recorded so far?',
    }, token);

    const reply1 = msg1Res.data?.sendChatMessage;
    assert(!msg1Res.errors, 'sendChatMessage executed without GraphQL errors');
    assert(reply1?.role === 'assistant', 'AI assistant replied with role "assistant"');
    assert(reply1?.content.includes('₹') || reply1?.content.includes('45,000') || reply1?.content.includes('45000'), 'AI response accurately cited ₹45,000 expenses');
    console.log(`     Assistant Reply: "${reply1?.content}"`);

    // 4. Test sendChatMessage (Net Balance Query)
    console.log('\n[Step 4] Testing sendChatMessage for Net Balance...');
    const msg2Res = await gql(`
      mutation SendMsg2($sessionId: String!, $message: String!) {
        sendChatMessage(sessionId: $sessionId, message: $message) {
          role
          content
          timestamp
        }
      }
    `, {
      sessionId: SESSION_ID,
      message: 'What is my current net balance?',
    }, token);

    const reply2 = msg2Res.data?.sendChatMessage;
    assert(!msg2Res.errors, 'Net balance question executed without errors');
    assert(reply2?.content.includes('₹') || reply2?.content.includes('75,000') || reply2?.content.includes('75000'), 'AI response cited net balance (₹75,000)');
    console.log(`     Assistant Reply: "${reply2?.content}"`);

    // 5. Query chatSession and verify conversation memory
    console.log('\n[Step 5] Testing chatSession Persistence & History...');
    const sessionRes = await gql(`
      query GetSession($sessionId: String!) {
        chatSession(sessionId: $sessionId) {
          id
          sessionId
          messages { role content timestamp }
        }
      }
    `, { sessionId: SESSION_ID }, token);

    const session = sessionRes.data?.chatSession;
    assert(session?.sessionId === SESSION_ID, 'Retrieved session by sessionId');
    assert(session?.messages?.length === 4, `Persisted all 4 messages (2 user, 2 assistant, got ${session?.messages?.length})`);
    assert(session?.messages[0]?.role === 'user', 'First message is user prompt');
    assert(session?.messages[1]?.role === 'assistant', 'Second message is assistant reply');

    // 6. Test clearChatSession
    console.log('\n[Step 6] Testing clearChatSession...');
    const clearRes = await gql(`
      mutation ClearSession($sessionId: String!) {
        clearChatSession(sessionId: $sessionId)
      }
    `, { sessionId: SESSION_ID }, token);

    assert(clearRes.data?.clearChatSession === true, 'clearChatSession returned true');

    const verifyClearedRes = await gql(`
      query VerifyCleared($sessionId: String!) {
        chatSession(sessionId: $sessionId) { id }
      }
    `, { sessionId: SESSION_ID }, token);
    assert(verifyClearedRes.data?.chatSession === null, 'Session is now null in database after clearing');

    // 7. Multi-tenant privacy on Chat
    console.log('\n[Step 7] Testing Chat Multi-Tenant Isolation...');
    // Create new session in Org A
    await gql(`
      mutation NewSessionA($sessionId: String!, $message: String!) {
        sendChatMessage(sessionId: $sessionId, message: $message) { content }
      }
    `, { sessionId: 'org-a-secret-session', message: 'Hello' }, token);

    // Register Org B
    const regBRes = await gql(`
      mutation RegB($input: RegisterInput!) {
        register(input: $input) { token }
      }
    `, {
      input: {
        name: 'Spy User',
        email: 'spy@orgb.test',
        password: 'password123',
        orgName: 'Spy Corp',
      },
    });
    const orgBToken = regBRes.data?.register?.token;

    // Org B queries Org A's session: must return null
    const spyRes = await gql(`
      query SpyQuery($sessionId: String!) {
        chatSession(sessionId: $sessionId) { id messages { content } }
      }
    `, { sessionId: 'org-a-secret-session' }, orgBToken);
    assert(spyRes.data?.chatSession === null, 'Org B cannot view Org A chat sessions (multi-tenant isolated)');

    console.log('\n======================================================');
    console.log(`PHASE 4 TEST SUMMARY: ${passCount} PASSED, ${failCount} FAILED`);
    console.log('======================================================\n');

    if (failCount > 0) {
      process.exit(1);
    }
  } catch (error) {
    console.error('\n[FATAL ERROR IN PHASE 4 TEST]:', error);
    process.exit(1);
  } finally {
    await stopServer();
    await disconnectDB();
    if (mongod) {
      await mongod.stop();
    }
  }
}

runPhase4Test();
