import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { disconnectDB } from '../src/config/db.js';
import { startServer, stopServer } from '../src/index.js';

async function runPhase5Test() {
  console.log('\n======================================================');
  console.log('   RUNNING EXPENSEFLOW - PHASE 5 INCOME LINKING & USAGE TESTS');
  console.log('======================================================\n');

  let mongod = null;
  let passCount = 0;
  let failCount = 0;
  const TEST_PORT = 4006;
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
    assert(true, 'Test Apollo Server up and running on port ' + TEST_PORT);

    // 2. Register Test Org A
    console.log('\n[Step 2] Registering Test Organization A...');
    const regResA = await gql(`
      mutation RegisterOrg($input: RegisterInput!) {
        register(input: $input) {
          token
          org { id }
        }
      }
    `, {
      input: {
        name: 'Finance Controller',
        email: 'controller@company-a.test',
        password: 'securePassword123',
        orgName: 'Enterprise Org A',
      },
    });

    const tokenA = regResA.data?.register?.token;
    assert(!!tokenA, 'Acquired JWT token for Org A');

    // Create Company 1 and Company 2 under Org A
    const comp1Res = await gql(`
      mutation CreateComp($input: CompanyInput!) {
        createCompany(input: $input) { id name }
      }
    `, { input: { name: 'Acme Logistics' } }, tokenA);
    const company1Id = comp1Res.data?.createCompany?.id;
    assert(!!company1Id, 'Created Company 1: Acme Logistics');

    const comp2Res = await gql(`
      mutation CreateComp($input: CompanyInput!) {
        createCompany(input: $input) { id name }
      }
    `, { input: { name: 'Acme Cloud' } }, tokenA);
    const company2Id = comp2Res.data?.createCompany?.id;
    assert(!!company2Id, 'Created Company 2: Acme Cloud');

    // Fetch category
    const catRes = await gql(`query GetCats { categories { id name } }`, {}, tokenA);
    const sampleCategory = catRes.data?.categories[0];
    assert(!!sampleCategory, 'Found sample category: ' + sampleCategory.name);

    // 3. Seed Income entries for Company 1
    // Income 1 (Example 1): ₹50,000 "Client Retainer Alpha"
    // Income 2 (Example 2): ₹50,000 "Project Milestone Beta"
    // Income 3 (Zero income): ₹0 "Donation Grant"
    console.log('\n[Step 3] Seeding Income Entries for Company 1 (Acme Logistics)...');
    const incRes = await gql(`
      mutation SeedIncomes($inputs: [IncomeInput!]!) {
        createIncomes(inputs: $inputs) {
          id
          source
          amount
          companyId
        }
      }
    `, {
      inputs: [
        {
          companyId: company1Id,
          source: 'Client Retainer Alpha',
          amount: 50000,
          notes: 'Contract Q1 retainer',
        },
        {
          companyId: company1Id,
          source: 'Project Milestone Beta',
          amount: 50000,
          notes: 'Delivery Phase 1',
        },
        {
          companyId: company1Id,
          source: 'Zero Grant Charlie',
          amount: 0,
          notes: 'Unfunded research grant',
        },
      ],
    }, tokenA);

    const createdIncomes = incRes.data?.createIncomes || [];
    assert(createdIncomes.length === 3, 'Created 3 Income entries');
    const incomeAlpha = createdIncomes.find((i) => i.source === 'Client Retainer Alpha');
    const incomeBeta = createdIncomes.find((i) => i.source === 'Project Milestone Beta');
    const incomeZero = createdIncomes.find((i) => i.source === 'Zero Grant Charlie');

    // Seed Income for Company 2
    const incComp2Res = await gql(`
      mutation SeedIncomesComp2($inputs: [IncomeInput!]!) {
        createIncomes(inputs: $inputs) { id source }
      }
    `, {
      inputs: [{ companyId: company2Id, source: 'Cloud Services Contract', amount: 80000 }],
    }, tokenA);
    const incomeComp2 = incComp2Res.data?.createIncomes[0];
    assert(!!incomeComp2, 'Created Income entry for Company 2: Cloud Services Contract');

    // 4. Test Expense-Income Linking & Validation
    console.log('\n[Step 4] Testing Expense-Income Linking & Security Validation...');

    // 4a. Cross-company linking support: Verify creating an expense for Company 1 linked to Company 2's income succeeds
    const crossCompRes = await gql(`
      mutation CreateCrossCompExpense($inputs: [ExpenseInput!]!) {
        createExpenses(inputs: $inputs) { id companyId incomeId }
      }
    `, {
      inputs: [
        {
          companyId: company1Id,
          categoryId: sampleCategory.id,
          categoryName: sampleCategory.name,
          amount: 10000,
          incomeId: incomeComp2.id, // belongs to Company 2!
        },
      ],
    }, tokenA);

    assert(
      !crossCompRes.errors && crossCompRes.data?.createExpenses?.length === 1,
      'Supported cross-company income linking (Expense Company 1 with Income Company 2)'
    );
    // Delete this temporary cross-company expense so step 6 company usage math remains intact
    const crossExpId = crossCompRes.data?.createExpenses[0]?.id;
    if (crossExpId) {
      await gql(`mutation DelExp($id: ID!) { deleteExpense(id: $id) }`, { id: crossExpId }, tokenA);
    }

    // 4b. Successfully link expense to Company 1's income (Example 1: ₹35,000 linked to Income Alpha)
    const exp1Res = await gql(`
      mutation CreateLinkedExpense1($inputs: [ExpenseInput!]!) {
        createExpenses(inputs: $inputs) {
          id
          amount
          incomeId
          income { id source amount }
        }
      }
    `, {
      inputs: [
        {
          companyId: company1Id,
          categoryId: sampleCategory.id,
          categoryName: sampleCategory.name,
          subcategory: 'Retainer Services',
          amount: 35000,
          vendor: 'Vendor Alpha Delivery',
          incomeId: incomeAlpha.id,
        },
      ],
    }, tokenA);

    assert(!exp1Res.errors, 'Created expense linked to Income Alpha without errors');
    const exp1 = exp1Res.data?.createExpenses[0];
    assert(exp1?.incomeId === incomeAlpha.id, 'Expense correctly persisted incomeId');
    assert(exp1?.income?.source === 'Client Retainer Alpha', 'Resolved Expense.income GraphQL relation');

    // 4c. Create linked expenses for Example 2: ₹55,000 linked to Income Beta (two expenses: 30k + 25k = 55k)
    const exp2Res = await gql(`
      mutation CreateLinkedExpenses2($inputs: [ExpenseInput!]!) {
        createExpenses(inputs: $inputs) { id amount incomeId }
      }
    `, {
      inputs: [
        {
          companyId: company1Id,
          categoryId: sampleCategory.id,
          categoryName: sampleCategory.name,
          amount: 30000,
          vendor: 'Hardware Subcontractor',
          incomeId: incomeBeta.id,
        },
        {
          companyId: company1Id,
          categoryId: sampleCategory.id,
          categoryName: sampleCategory.name,
          amount: 25000,
          vendor: 'Software License',
          incomeId: incomeBeta.id,
        },
      ],
    }, tokenA);
    assert(!exp2Res.errors && exp2Res.data?.createExpenses?.length === 2, 'Created 2 expenses totaling ₹55,000 linked to Income Beta');

    // 4d. Create an unlinked expense (₹12,000 with NO incomeId)
    const unlinkedRes = await gql(`
      mutation CreateUnlinkedExpense($inputs: [ExpenseInput!]!) {
        createExpenses(inputs: $inputs) { id amount incomeId }
      }
    `, {
      inputs: [
        {
          companyId: company1Id,
          categoryId: sampleCategory.id,
          categoryName: sampleCategory.name,
          amount: 12000,
          vendor: 'General Office Supplies',
          incomeId: null, // explicit null
        },
      ],
    }, tokenA);
    assert(!unlinkedRes.errors, 'Created optional unlinked expense (incomeId: null)');

    // 5. Test expensesByIncome query
    console.log('\n[Step 5] Testing expensesByIncome Query...');
    const byIncRes = await gql(`
      query GetExpensesByIncome($incomeId: ID!) {
        expensesByIncome(incomeId: $incomeId) {
          id
          amount
          vendor
        }
      }
    `, { incomeId: incomeBeta.id }, tokenA);
    assert(byIncRes.data?.expensesByIncome?.length === 2, 'expensesByIncome returned both expenses linked to Income Beta');

    // 6. Test Company Income Usage Calculations
    console.log('\n[Step 6] Testing Company Income Usage Aggregation & Exact Formulas...');
    const usageRes = await gql(`
      query GetUsage($companyId: ID!) {
        companyIncomeUsage(companyId: $companyId) {
          companyId
          companyName
          totalIncome
          totalUtilized
          remainingBalance
          totalExcessSpending
          utilizationPercentage
          unlinkedExpensesTotal
          unlinkedExpenseCount
          incomeEntries {
            id
            source
            amount
            totalUtilized
            remainingBalance
            excessSpending
            utilizationPercentage
            linkedExpenseCount
          }
        }
      }
    `, { companyId: company1Id }, tokenA);

    assert(!usageRes.errors, 'companyIncomeUsage query executed successfully');
    const report = usageRes.data?.companyIncomeUsage;

    // Company level metrics check:
    // Total income = 50,000 + 50,000 + 0 = 100,000
    // Total linked utilized = 35,000 + 55,000 = 90,000
    // Remaining balance = max(100,000 - 90,000, 0) = 10,000
    // Excess spending = max(90,000 - 100,000, 0) = 0
    // Utilization % = (90,000 / 100,000) * 100 = 90%
    assert(report.totalIncome === 100000, 'Company totalIncome is ₹100,000 (got ' + report.totalIncome + ')');
    assert(report.totalUtilized === 90000, 'Company totalUtilized is ₹90,000 (got ' + report.totalUtilized + ')');
    assert(report.remainingBalance === 10000, 'Company remainingBalance is ₹10,000 (got ' + report.remainingBalance + ')');
    assert(report.totalExcessSpending === 0, 'Company totalExcessSpending is ₹0 (got ' + report.totalExcessSpending + ')');
    assert(report.utilizationPercentage === 90, 'Company utilizationPercentage is 90% (got ' + report.utilizationPercentage + '%)');

    // Unlinked expenses check:
    assert(report.unlinkedExpensesTotal === 12000, 'Unlinked expenses total is ₹12,000 (not counted against income entries)');
    assert(report.unlinkedExpenseCount === 1, 'Unlinked expense count is 1');

    // Income Alpha check (Example 1):
    // Income: ₹50,000, Linked: ₹35,000, Remaining: ₹15,000, Excess: ₹0, Util: 70%
    const alphaItem = report.incomeEntries.find((i) => i.source === 'Client Retainer Alpha');
    assert(alphaItem?.totalUtilized === 35000, 'Example 1: Alpha totalUtilized is ₹35,000');
    assert(alphaItem?.remainingBalance === 15000, 'Example 1: Alpha remainingBalance is ₹15,000');
    assert(alphaItem?.excessSpending === 0, 'Example 1: Alpha excessSpending is ₹0');
    assert(alphaItem?.utilizationPercentage === 70, 'Example 1: Alpha utilizationPercentage is 70%');

    // Income Beta check (Example 2):
    // Income: ₹50,000, Linked: ₹55,000, Remaining: ₹0, Excess: ₹5,000, Util: 110%
    const betaItem = report.incomeEntries.find((i) => i.source === 'Project Milestone Beta');
    assert(betaItem?.totalUtilized === 55000, 'Example 2: Beta totalUtilized is ₹55,000');
    assert(betaItem?.remainingBalance === 0, 'Example 2: Beta remainingBalance is ₹0 (clamped to 0)');
    assert(betaItem?.excessSpending === 5000, 'Example 2: Beta excessSpending is ₹5,000');
    assert(betaItem?.utilizationPercentage === 110, 'Example 2: Beta utilizationPercentage is 110%');

    // Zero Grant Charlie check (Zero income division safety):
    const zeroItem = report.incomeEntries.find((i) => i.source === 'Zero Grant Charlie');
    assert(zeroItem?.amount === 0, 'Zero Grant amount is 0');
    assert(zeroItem?.utilizationPercentage === 0, 'Zero income handled safely without division by zero (0%)');

    // 7. Test Updating / Reassigning an Expense
    console.log('\n[Step 7] Testing Expense Reassignment & Dynamic Recalculation...');
    // Reassign expense from Alpha to Beta (moving ₹35,000 from Alpha to Beta)
    // Beta will now have 55k + 35k = 90k, excess = 40k
    // Alpha will now have 0k utilized, remaining = 50k
    const updateRes = await gql(`
      mutation ReassignExpense($id: ID!, $input: ExpenseInput!) {
        updateExpense(id: $id, input: $input) {
          id
          incomeId
        }
      }
    `, {
      id: exp1.id,
      input: {
        companyId: company1Id,
        categoryId: sampleCategory.id,
        amount: 35000,
        incomeId: incomeBeta.id,
      },
    }, tokenA);
    assert(!updateRes.errors, 'Reassigned expense to Income Beta');

    const updatedUsageRes = await gql(`
      query GetUpdatedUsage($companyId: ID!) {
        companyIncomeUsage(companyId: $companyId) {
          incomeEntries {
            source
            totalUtilized
            remainingBalance
            excessSpending
          }
        }
      }
    `, { companyId: company1Id }, tokenA);

    const updatedAlpha = updatedUsageRes.data?.companyIncomeUsage?.incomeEntries.find(
      (i) => i.source === 'Client Retainer Alpha'
    );
    const updatedBeta = updatedUsageRes.data?.companyIncomeUsage?.incomeEntries.find(
      (i) => i.source === 'Project Milestone Beta'
    );

    assert(updatedAlpha?.totalUtilized === 0, 'Alpha now has ₹0 utilized after unlinking');
    assert(updatedAlpha?.remainingBalance === 50000, 'Alpha restored to ₹50,000 full remaining balance');
    assert(updatedBeta?.totalUtilized === 90000, 'Beta now reflects ₹90,000 utilized');
    assert(updatedBeta?.excessSpending === 40000, 'Beta dynamically updated excess spending to ₹40,000');

    // Restore exp1 back to incomeAlpha for Chatbot testing
    await gql(`
      mutation RestoreExpense($id: ID!, $input: ExpenseInput!) {
        updateExpense(id: $id, input: $input) { id }
      }
    `, {
      id: exp1.id,
      input: {
        companyId: company1Id,
        categoryId: sampleCategory.id,
        amount: 35000,
        incomeId: incomeAlpha.id,
      },
    }, tokenA);

    // 8. Test Chatbot Answering Questions
    console.log('\n[Step 8] Testing AI Chatbot Answering Income Usage Questions...');
    const CHAT_SESSION = 'chat-test-session-phase5';

    const cleanText = (str) => (str || '').replace(/\s+/g, ' ');

    // Q1: "How much income has Acme Logistics received?"
    const q1Res = await gql(`
      mutation SendChat($sessionId: String!, $message: String!) {
        sendChatMessage(sessionId: $sessionId, message: $message) { content }
      }
    `, { sessionId: CHAT_SESSION, message: 'How much income has Acme Logistics received?' }, tokenA);
    const reply1 = q1Res.data?.sendChatMessage?.content;
    assert(
      cleanText(reply1).includes('1,00,000') || cleanText(reply1).includes('100,000'),
      'Chatbot accurately answered company income received (₹1,00,000)'
    );

    // Q2: "How much of Acme Logistics\'s income has been utilized?"
    const q2Res = await gql(`
      mutation SendChat($sessionId: String!, $message: String!) {
        sendChatMessage(sessionId: $sessionId, message: $message) { content }
      }
    `, { sessionId: CHAT_SESSION, message: "How much of Acme Logistics's income has been utilized?" }, tokenA);
    const reply2 = q2Res.data?.sendChatMessage?.content;
    assert(
      cleanText(reply2).includes('90,000') || cleanText(reply2).includes('90'),
      'Chatbot accurately answered company income utilized (₹90,000 / 90%)'
    );

    // Q3: "How much money remains from Client Retainer Alpha?"
    const q3Res = await gql(`
      mutation SendChat($sessionId: String!, $message: String!) {
        sendChatMessage(sessionId: $sessionId, message: $message) { content }
      }
    `, { sessionId: CHAT_SESSION, message: 'How much money remains from Client Retainer Alpha?' }, tokenA);
    const reply3 = q3Res.data?.sendChatMessage?.content;
    assert(
      cleanText(reply3).includes('15,000'),
      'Chatbot accurately answered remaining balance for Client Retainer Alpha (₹15,000)'
    );

    // Q4: "Which expenses are linked to Project Milestone Beta?"
    const q4Res = await gql(`
      mutation SendChat($sessionId: String!, $message: String!) {
        sendChatMessage(sessionId: $sessionId, message: $message) { content }
      }
    `, { sessionId: CHAT_SESSION, message: 'Which expenses are linked to Project Milestone Beta?' }, tokenA);
    const reply4 = q4Res.data?.sendChatMessage?.content;
    assert(
      cleanText(reply4).includes('Hardware Subcontractor') && cleanText(reply4).includes('Software License'),
      'Chatbot listed linked expenses for Project Milestone Beta'
    );

    // Q5: "Which income entries have excess spending?"
    const q5Res = await gql(`
      mutation SendChat($sessionId: String!, $message: String!) {
        sendChatMessage(sessionId: $sessionId, message: $message) { content }
      }
    `, { sessionId: CHAT_SESSION, message: 'Which income entries have excess spending?' }, tokenA);
    const reply5 = q5Res.data?.sendChatMessage?.content;
    assert(
      cleanText(reply5).includes('Project Milestone Beta') && cleanText(reply5).includes('5,000'),
      'Chatbot identified Project Milestone Beta with ₹5,000 excess spending'
    );

    // Q6: "How much excess spending do I have across all my income entries?"
    const q6Res = await gql(`
      mutation SendChat($sessionId: String!, $message: String!) {
        sendChatMessage(sessionId: $sessionId, message: $message) { content }
      }
    `, { sessionId: CHAT_SESSION, message: 'How much excess spending do I have across all my income entries?' }, tokenA);
    const reply6 = q6Res.data?.sendChatMessage?.content;
    assert(
      cleanText(reply6).includes('5,000'),
      'Chatbot stated total excess spending across all income entries is ₹5,000'
    );

    // Q7: "Which company has the highest linked expense utilization?"
    const q7Res = await gql(`
      mutation SendChat($sessionId: String!, $message: String!) {
        sendChatMessage(sessionId: $sessionId, message: $message) { content }
      }
    `, { sessionId: CHAT_SESSION, message: 'Which company has the highest linked expense utilization?' }, tokenA);
    const reply7 = q7Res.data?.sendChatMessage?.content;
    assert(
      cleanText(reply7).includes('Acme Logistics'),
      'Chatbot identified Acme Logistics as highest utilization company (90% vs 0%)'
    );

    // 9. Test Multi-Tenant Isolation: Org B cannot see Org A data
    console.log('\n[Step 9] Testing Multi-Tenant Isolation for Org B...');
    const regResB = await gql(`
      mutation RegisterOrgB($input: RegisterInput!) {
        register(input: $input) { token }
      }
    `, {
      input: {
        name: 'Org B Admin',
        email: 'admin@org-b.test',
        password: 'securePassword123',
        orgName: 'Enterprise Org B',
      },
    });
    const tokenB = regResB.data?.register?.token;

    const crossOrgUsageRes = await gql(`
      query GetCrossOrgUsage($companyId: ID!) {
        companyIncomeUsage(companyId: $companyId) { totalIncome }
      }
    `, { companyId: company1Id }, tokenB);
    assert(
      !!crossOrgUsageRes.errors && crossOrgUsageRes.errors.length > 0,
      'Org B is completely blocked from accessing Org A company income usage'
    );

    // 10. Test Multi-Income Split Allocations & Sum Validation
    console.log('\n[Step 10] Testing Multi-Income Split Allocations & Sum Validation...');
    // Create two new incomes for Company 2
    const incSplitA = await gql(`
      mutation CreateSplitIncomeA($inputs: [IncomeInput!]!) {
        createIncomes(inputs: $inputs) { id amount source }
      }
    `, {
      inputs: [{
        companyId: company2Id,
        amount: 40000,
        source: 'Sponsorship Grant Delta',
      }],
    }, tokenA);
    const splitA = incSplitA.data?.createIncomes[0];

    const incSplitB = await gql(`
      mutation CreateSplitIncomeB($inputs: [IncomeInput!]!) {
        createIncomes(inputs: $inputs) { id amount source }
      }
    `, {
      inputs: [{
        companyId: company2Id,
        amount: 60000,
        source: 'Consulting Contract Echo',
      }],
    }, tokenA);
    const splitB = incSplitB.data?.createIncomes[0];

    // Attempt to create expense with mismatched allocation sum:
    // Expense amount = ₹50,000, but allocations = ₹30,000 + ₹10,000 = ₹40,000 (mismatch!)
    const invalidSplitRes = await gql(`
      mutation CreateInvalidSplitExpense($inputs: [ExpenseInput!]!) {
        createExpenses(inputs: $inputs) { id amount }
      }
    `, {
      inputs: [{
        companyId: company2Id,
        categoryId: sampleCategory.id,
        categoryName: sampleCategory.name,
        amount: 50000,
        vendor: 'Data Center Co',
        incomeAllocations: [
          { incomeId: splitA.id, amount: 30000 },
          { incomeId: splitB.id, amount: 10000 },
        ],
      }],
    }, tokenA);
    assert(
      !!invalidSplitRes.errors && invalidSplitRes.errors[0]?.message.includes('must equal the total expense amount'),
      'Blocked multi-income expense creation when allocation sum (₹40,000) does not match expense amount (₹50,000)'
    );

    // Create valid multi-income expense with exact matching allocation:
    // Expense amount = ₹50,000: ₹20,000 from splitA + ₹30,000 from splitB
    const validSplitRes = await gql(`
      mutation CreateValidSplitExpense($inputs: [ExpenseInput!]!) {
        createExpenses(inputs: $inputs) {
          id
          amount
          incomeIds
          incomeAllocations {
            incomeId
            amount
          }
        }
      }
    `, {
      inputs: [{
        companyId: company2Id,
        categoryId: sampleCategory.id,
        categoryName: sampleCategory.name,
        amount: 50000,
        vendor: 'Data Center Co',
        incomeAllocations: [
          { incomeId: splitA.id, amount: 20000 },
          { incomeId: splitB.id, amount: 30000 },
        ],
      }],
    }, tokenA);
    assert(!validSplitRes.errors, 'Successfully created multi-income expense with matching allocation sum');
    const createdSplitExp = validSplitRes.data?.createExpenses[0];
    assert(createdSplitExp?.incomeAllocations?.length === 2, 'Persisted both incomeAllocations on expense');
    assert(createdSplitExp?.incomeIds?.length === 2, 'Synchronized incomeIds array with allocated incomes');

    // Verify company income usage for Company 2 accurately reflects exact allocated amounts:
    // splitA (₹40k) has ₹20k utilized -> remaining ₹20k (50%)
    // splitB (₹60k) has ₹30k utilized -> remaining ₹30k (50%)
    const splitUsageRes = await gql(`
      query GetSplitUsage($companyId: ID!) {
        companyIncomeUsage(companyId: $companyId) {
          totalIncome
          totalUtilized
          remainingBalance
          incomeEntries {
            id
            source
            amount
            totalUtilized
            remainingBalance
            utilizationPercentage
          }
        }
      }
    `, { companyId: company2Id }, tokenA);

    const comp2Usage = splitUsageRes.data?.companyIncomeUsage;
    const splitAUsage = comp2Usage?.incomeEntries.find((i) => i.id === splitA.id);
    const splitBUsage = comp2Usage?.incomeEntries.find((i) => i.id === splitB.id);

    assert(splitAUsage?.totalUtilized === 20000, 'Split Income A totalUtilized is exactly ₹20,000 (got ' + splitAUsage?.totalUtilized + ')');
    assert(splitAUsage?.remainingBalance === 20000, 'Split Income A remainingBalance is ₹20,000 (got ' + splitAUsage?.remainingBalance + ')');
    assert(splitBUsage?.totalUtilized === 30000, 'Split Income B totalUtilized is exactly ₹30,000 (got ' + splitBUsage?.totalUtilized + ')');
    assert(splitBUsage?.remainingBalance === 30000, 'Split Income B remainingBalance is ₹30,000 (got ' + splitBUsage?.remainingBalance + ')');

    console.log('\n======================================================');
    console.log(`PHASE 5 TEST SUMMARY: ${passCount} PASSED, ${failCount} FAILED`);
    console.log('======================================================\n');
  } catch (err) {
    console.error('Fatal error in Phase 5 tests:', err);
    failCount++;
  } finally {
    await stopServer();
    if (mongod) {
      await disconnectDB();
      await mongod.stop();
    }
  }

  if (failCount > 0) {
    process.exit(1);
  }
}

runPhase5Test();
