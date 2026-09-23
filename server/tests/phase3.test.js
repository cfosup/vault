import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { disconnectDB } from '../src/config/db.js';
import { startServer, stopServer } from '../src/index.js';

async function runPhase3Test() {
  console.log('\n======================================================');
  console.log('       RUNNING EXPENSEFLOW BACKEND - PHASE 3 TESTS    ');
  console.log('======================================================\n');

  let mongod = null;
  let passCount = 0;
  let failCount = 0;
  const TEST_PORT = 4003;
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

    // 2. Register Org & Setup Company + Payment Method
    console.log('\n[Step 2] Setting up Organization, Company, and Payment Method...');
    const regRes = await gql(`
      mutation RegisterOrg($input: RegisterInput!) {
        register(input: $input) {
          token
          org { id }
        }
      }
    `, {
      input: {
        name: 'Finance Manager',
        email: 'finance@analytics.test',
        password: 'securePassword123',
        orgName: 'Apex Financials',
      },
    });

    const token = regRes.data?.register?.token;
    assert(!!token, 'Registered test organization');

    const compRes = await gql(`
      mutation CreateComp($input: CompanyInput!) {
        createCompany(input: $input) { id name }
      }
    `, { input: { name: 'Apex Tech Solutions' } }, token);
    const companyId = compRes.data?.createCompany?.id;

    const pmRes = await gql(`
      mutation CreatePM($input: PaymentMethodInput!) {
        createPaymentMethod(input: $input) { id name }
      }
    `, { input: { name: 'HDFC Corporate Card', type: 'card' } }, token);
    const pmId = pmRes.data?.createPaymentMethod?.id;

    // Get categories
    const catRes = await gql(`query GetCats { categories { id name } }`, {}, token);
    const categories = catRes.data?.categories || [];
    const infraCat = categories.find((c) => c.name === 'Infrastructure & Utilities');
    const marketingCat = categories.find((c) => c.name === 'Paid Acquisition');
    const hrCat = categories.find((c) => c.name === 'Salaries & Wages');

    // 3. Seed Multiple Expenses & Incomes
    console.log('\n[Step 3] Seeding Multi-Category Expenses and Incomes...');
    await gql(`
      mutation BulkExpenses($inputs: [ExpenseInput!]!) {
        createExpenses(inputs: $inputs) { id }
      }
    `, {
      inputs: [
        {
          companyId,
          categoryId: infraCat.id,
          categoryName: infraCat.name,
          subcategory: 'Office Space',
          amount: 30000,
          vendor: 'WeWork Real Estate',
          paymentMethodId: pmId,
          paymentMethodName: 'HDFC Corporate Card',
        },
        {
          companyId,
          categoryId: infraCat.id,
          categoryName: infraCat.name,
          subcategory: 'Digital Infrastructure',
          amount: 10000,
          vendor: 'Amazon Web Services',
          paymentMethodId: pmId,
          paymentMethodName: 'HDFC Corporate Card',
        },
        {
          companyId,
          categoryId: marketingCat.id,
          categoryName: marketingCat.name,
          subcategory: 'Google Ads',
          amount: 15000,
          vendor: 'Google India',
          paymentMethodId: pmId,
          paymentMethodName: 'HDFC Corporate Card',
        },
        {
          companyId,
          categoryId: hrCat.id,
          categoryName: hrCat.name,
          subcategory: 'Full-time employee salaries',
          amount: 45000,
          vendor: 'Payroll Disbursal',
          paymentMethodId: pmId,
          paymentMethodName: 'HDFC Corporate Card',
        },
      ],
    }, token);

    await gql(`
      mutation BulkIncomes($inputs: [IncomeInput!]!) {
        createIncomes(inputs: $inputs) { id }
      }
    `, {
      inputs: [
        {
          companyId,
          amount: 180000,
          source: 'Client SaaS Contract',
        },
        {
          companyId,
          amount: 40000,
          source: 'Consulting Retainer',
        },
      ],
    }, token);

    // 4. Test Dashboard Summary Aggregation
    console.log('\n[Step 4] Testing Dashboard Summary Aggregation...');
    const dashSummaryRes = await gql(`
      query DashSummary($filter: DashFilter) {
        dashboardSummary(filter: $filter) {
          totalExpenses
          totalIncome
          netBalance
          expenseCount
          incomeCount
          topCategory
          topVendor
        }
      }
    `, { filter: { companyId } }, token);

    const summary = dashSummaryRes.data?.dashboardSummary;
    assert(!dashSummaryRes.errors, 'dashboardSummary executed without errors');
    assert(summary?.totalExpenses === 100000, `totalExpenses is ₹100,000 (got ${summary?.totalExpenses})`);
    assert(summary?.totalIncome === 220000, `totalIncome is ₹220,000 (got ${summary?.totalIncome})`);
    assert(summary?.netBalance === 120000, `netBalance is ₹120,000 (got ${summary?.netBalance})`);
    assert(summary?.expenseCount === 4, 'expenseCount is 4');
    assert(summary?.incomeCount === 2, 'incomeCount is 2');
    assert(summary?.topCategory === 'Salaries & Wages', 'topCategory is "Salaries & Wages" (₹45,000)');
    assert(summary?.topVendor === 'Payroll Disbursal', 'topVendor is "Payroll Disbursal"');

    // 5. Test Category Breakdown Aggregation
    console.log('\n[Step 5] Testing Category Breakdown Aggregation...');
    const catBreakdownRes = await gql(`
      query CatBreakdown($filter: DashFilter) {
        categoryBreakdown(filter: $filter) {
          categoryName
          amount
          count
          percentage
        }
      }
    `, { filter: { companyId } }, token);

    const breakdown = catBreakdownRes.data?.categoryBreakdown || [];
    assert(breakdown.length === 3, 'categoryBreakdown returned 3 distinct categories');

    const totalPercentage = breakdown.reduce((sum, item) => sum + item.percentage, 0);
    assert(Math.round(totalPercentage) === 100, `Percentage sum is ~100% (got ${totalPercentage}%)`);

    // 6. Test Monthly Trends & Comparisons
    console.log('\n[Step 6] Testing Monthly Trend & Income vs Expense Aggregations...');
    const trendRes = await gql(`
      query Trends {
        monthlyTrend(months: 6) { month year amount }
        incomeVsExpenseTrend(months: 6) { month year expenses income net }
      }
    `, {}, token);

    const monthlyTrend = trendRes.data?.monthlyTrend || [];
    const compTrend = trendRes.data?.incomeVsExpenseTrend || [];

    assert(monthlyTrend.length >= 1, 'monthlyTrend returned monthly records');
    assert(monthlyTrend[0].amount === 100000, 'Monthly trend amount matches total expenses (₹100,000)');
    assert(compTrend.length >= 1, 'incomeVsExpenseTrend returned monthly comparison');
    assert(compTrend[0].expenses === 100000 && compTrend[0].income === 220000, 'Income vs expense matches ₹220k vs ₹100k');
    assert(compTrend[0].net === 120000, 'Net balance matches ₹120,000');

    // 7. Test Top Vendors & Payment Method Breakdown
    console.log('\n[Step 7] Testing Top Vendors and Payment Method Breakdown...');
    const vendorRes = await gql(`
      query TopVendors {
        topVendors(limit: 3) { vendor amount count }
        paymentMethodBreakdown { paymentMethodName amount count }
      }
    `, {}, token);

    const topVendors = vendorRes.data?.topVendors || [];
    assert(topVendors.length >= 3, 'topVendors returned top 3 vendors');
    assert(topVendors[0].vendor === 'Payroll Disbursal', 'Top vendor is Payroll Disbursal');

    const pmBreakdown = vendorRes.data?.paymentMethodBreakdown || [];
    assert(pmBreakdown.length === 1, 'paymentMethodBreakdown returned 1 payment method');
    assert(pmBreakdown[0].amount === 100000, 'Payment method accounted for ₹100,000');

    // 8. Test Budget Buckets & Usage Tracking Logic
    console.log('\n[Step 8] Testing Budget Buckets & Dynamic Spend Calculations...');
    // Create Budget Bucket: ₹50,000 Limit, 80% Alert Threshold for Infrastructure & Utilities
    const createBucketRes = await gql(`
      mutation CreateBucket($input: BudgetBucketInput!) {
        createBudgetBucket(input: $input) {
          id
          name
          limitAmount
          alertThreshold
          categoryName
        }
      }
    `, {
      input: {
        companyId,
        categoryId: infraCat.id,
        categoryName: infraCat.name,
        name: 'Q1 Infrastructure Budget',
        limitAmount: 50000,
        period: 'monthly',
        alertThreshold: 80,
      },
    }, token);

    const bucketId = createBucketRes.data?.createBudgetBucket?.id;
    assert(!!bucketId, 'Created BudgetBucket with ID: ' + bucketId);

    // Current spend in Infrastructure is ₹30,000 + ₹10,000 = ₹40,000 (exactly 80%!)
    const usage1Res = await gql(`
      query GetUsage($bucketId: ID!) {
        budgetUsage(bucketId: $bucketId) {
          usedAmount
          remainingAmount
          percentUsed
          isNearLimit
          isOverBudget
        }
      }
    `, { bucketId }, token);

    const usage1 = usage1Res.data?.budgetUsage;
    assert(usage1?.usedAmount === 40000, `usedAmount is ₹40,000 (got ${usage1?.usedAmount})`);
    assert(usage1?.remainingAmount === 10000, `remainingAmount is ₹10,000 (got ${usage1?.remainingAmount})`);
    assert(usage1?.percentUsed === 80, `percentUsed is 80% (got ${usage1?.percentUsed}%)`);
    assert(usage1?.isNearLimit === true, 'isNearLimit is TRUE at 80% threshold');
    assert(usage1?.isOverBudget === false, 'isOverBudget is FALSE at 80%');

    // Now add another expense of ₹15,000 to Infrastructure -> Total spend = ₹55,000 (110%, OVER BUDGET!)
    await gql(`
      mutation AddOverBudgetExpense($inputs: [ExpenseInput!]!) {
        createExpenses(inputs: $inputs) { id }
      }
    `, {
      inputs: [
        {
          companyId,
          categoryId: infraCat.id,
          categoryName: infraCat.name,
          subcategory: 'Office Space',
          amount: 15000,
          vendor: 'WeWork Meeting Room',
          paymentMethodId: pmId,
        },
      ],
    }, token);

    const usage2Res = await gql(`
      query GetUsageAfterOverSpend($bucketId: ID!) {
        budgetUsage(bucketId: $bucketId) {
          usedAmount
          remainingAmount
          percentUsed
          isNearLimit
          isOverBudget
        }
      }
    `, { bucketId }, token);

    const usage2 = usage2Res.data?.budgetUsage;
    assert(usage2?.usedAmount === 55000, `usedAmount is ₹55,000 (got ${usage2?.usedAmount})`);
    assert(usage2?.remainingAmount === 0, `remainingAmount clamped to 0 when over budget`);
    assert(usage2?.percentUsed === 110, `percentUsed is 110%`);
    assert(usage2?.isOverBudget === true, 'isOverBudget is TRUE when spend > limit');

    // Test allBudgetUsages for company
    const allUsagesRes = await gql(`
      query GetAllUsages($companyId: ID) {
        allBudgetUsages(companyId: $companyId) {
          bucket { id name limitAmount }
          usedAmount
          percentUsed
          isOverBudget
        }
      }
    `, { companyId }, token);

    const allUsages = allUsagesRes.data?.allBudgetUsages || [];
    assert(allUsages.length === 1, 'allBudgetUsages returned 1 bucket usage entry');
    assert(allUsages[0].isOverBudget === true, 'allBudgetUsages reports correct over-budget status');

    console.log('\n======================================================');
    console.log(`PHASE 3 TEST SUMMARY: ${passCount} PASSED, ${failCount} FAILED`);
    console.log('======================================================\n');

    if (failCount > 0) {
      process.exit(1);
    }
  } catch (error) {
    console.error('\n[FATAL ERROR IN PHASE 3 TEST]:', error);
    process.exit(1);
  } finally {
    await stopServer();
    await disconnectDB();
    if (mongod) {
      await mongod.stop();
    }
  }
}

runPhase3Test();
