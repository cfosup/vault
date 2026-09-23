import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { disconnectDB } from '../src/config/db.js';
import { startServer, stopServer } from '../src/index.js';

async function runEnhancementsTest() {
  console.log('\n======================================================');
  console.log('   RUNNING EXPENSEFLOW - PHASE 1 ENHANCEMENTS TESTS   ');
  console.log('======================================================\n');

  let mongod = null;
  let passCount = 0;
  let failCount = 0;
  const TEST_PORT = 4005;
  const GRAPHQL_URL = `http://localhost:${TEST_PORT}/graphql`;
  const BASE_URL = `http://localhost:${TEST_PORT}`;

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

    // 2. Register Organization
    console.log('\n[Step 2] Registering Test Organization...');
    const regRes = await gql(`
      mutation RegisterOrg($input: RegisterInput!) {
        register(input: $input) {
          token
          user { id name email }
          org { id name slug }
        }
      }
    `, {
      input: {
        name: 'Enterprise CFO',
        email: 'cfo@corebright.corp',
        password: 'Password123!',
        orgName: 'Core Bright Holdings',
      },
    });

    const token = regRes.data.register.token;
    assert(!!token, 'Acquired JWT token for CFO user');

    // 3. Create Standard Company (Un-customized)
    console.log('\n[Step 3] Testing Standard Company Creation & Category Fallback...');
    const comp1Res = await gql(`
      mutation CreateComp($input: CompanyInput!) {
        createCompany(input: $input) {
          id
          name
          isCoreBranch
        }
      }
    `, {
      input: {
        name: 'Alpha Standard Branch',
        isCoreBranch: false,
      },
    }, token);

    const comp1 = comp1Res.data.createCompany;
    assert(comp1.name === 'Alpha Standard Branch', 'Created Alpha Standard Branch');
    assert(comp1.isCoreBranch === false, 'isCoreBranch is false');

    // Query categories for comp1 - should fallback to 51 global categories
    const catFallbackRes = await gql(`
      query GetCats($companyId: ID) {
        categories(companyId: $companyId) {
          id
          name
          group
          groupLabel
        }
      }
    `, { companyId: comp1.id }, token);

    const fallbackCats = catFallbackRes.data.categories;
    assert(fallbackCats.length === 51, `Categories query gracefully fell back to global templates (got ${fallbackCats.length})`);

    // 4. Create Core Branch Company (isCoreBranch = true)
    console.log('\n[Step 4] Testing Core Branch Provisioning (51 CORE BRIGHT Categories)...');
    const comp2Res = await gql(`
      mutation CreateComp($input: CompanyInput!) {
        createCompany(input: $input) {
          id
          name
          isCoreBranch
        }
      }
    `, {
      input: {
        name: 'Beta Core Operations Ltd',
        isCoreBranch: true,
      },
    }, token);

    const comp2 = comp2Res.data.createCompany;
    assert(comp2.isCoreBranch === true, 'Created Beta Core Operations with isCoreBranch = true');

    // Query categories for comp2 - should return company-owned categories
    const catCoreRes = await gql(`
      query GetCats($companyId: ID) {
        categories(companyId: $companyId) {
          id
          companyId
          name
          group
          groupLabel
        }
      }
    `, { companyId: comp2.id }, token);

    const coreCats = catCoreRes.data.categories;
    assert(coreCats.length === 51, `Core Branch was auto-provisioned with 51 company categories (got ${coreCats.length})`);
    assert(coreCats.every((c) => c.companyId === comp2.id), 'All 51 categories are scoped to Beta Core Operations');

    // 5. In-flight Category Creation Scoped to Company
    console.log('\n[Step 5] Testing In-flight Category & Subcategory Creation...');
    const createCatRes = await gql(`
      mutation CreateCat($input: CategoryInput!) {
        createCategory(input: $input) {
          id
          companyId
          name
          group
          groupLabel
          subcategories {
            name
          }
        }
      }
    `, {
      input: {
        companyId: comp1.id,
        name: 'Quantum AI Research Labs',
        group: 'R',
        groupLabel: 'R — R&D / Innovation',
        subcategories: [{ name: 'GPU Cluster Compute' }],
      },
    }, token);

    const newCat = createCatRes.data.createCategory;
    assert(newCat.name === 'Quantum AI Research Labs', 'Created in-flight custom category for Alpha Branch');
    assert(newCat.companyId === comp1.id, 'New category is strictly scoped to comp1');
    assert(newCat.subcategories[0].name === 'GPU Cluster Compute', 'Initial subcategory was created in-flight');

    // Add subcategory to newly created category
    const addSubRes = await gql(`
      mutation AddSub($categoryId: ID!, $subcategoryName: String!) {
        addSubcategory(categoryId: $categoryId, subcategoryName: $subcategoryName) {
          id
          subcategories {
            name
          }
        }
      }
    `, {
      categoryId: newCat.id,
      subcategoryName: 'Model Fine-Tuning Storage',
    }, token);

    const updatedSubcats = addSubRes.data.addSubcategory.subcategories;
    assert(updatedSubcats.some((s) => s.name === 'Model Fine-Tuning Storage'), 'Added second subcategory in-flight');

    // 6. Section Deletion and Reset to Core Template
    console.log('\n[Step 6] Testing Section Deletion and Core Template Reset...');
    const delSecRes = await gql(`
      mutation DelSection($companyId: ID!, $group: String!) {
        deleteCategorySection(companyId: $companyId, group: $group)
      }
    `, {
      companyId: comp2.id,
      group: 'T', // Tours & Events
    }, token);

    assert(delSecRes.data.deleteCategorySection === true, 'Successfully deleted Section T from Beta Core');

    const afterDelCats = (await gql(`query GetCats($companyId: ID) { categories(companyId: $companyId) { id group } }`, { companyId: comp2.id }, token)).data.categories;
    assert(!afterDelCats.some((c) => c.group === 'T'), 'Section T categories confirmed deleted');

    // Reset company back to full core template
    const resetRes = await gql(`
      mutation ResetCore($companyId: ID!) {
        resetCompanyCategoriesToCore(companyId: $companyId) {
          id
          name
        }
      }
    `, { companyId: comp2.id }, token);

    assert(resetRes.data.resetCompanyCategoriesToCore.length === 51, 'Company categories successfully reset back to all 51 CORE categories');

    // 7. Budget Buckets with Sub-category Budgets
    console.log('\n[Step 7] Testing Budget Buckets with Optional Sub-category Budgets...');
    const targetCat = coreCats.find((c) => c.name.includes('Infrastructure') || c.name.includes('Legal')) || coreCats[0];

    const budgetRes = await gql(`
      mutation CreateBudget($input: BudgetBucketInput!) {
        createBudgetBucket(input: $input) {
          id
          name
          limitAmount
          subcatBudgets {
            subcategory
            limitAmount
          }
        }
      }
    `, {
      input: {
        companyId: comp2.id,
        categoryId: targetCat.id,
        categoryName: targetCat.name,
        name: `${targetCat.name} FY26 Budget`,
        limitAmount: 100000,
        period: 'yearly',
        alertThreshold: 80,
        subcatBudgets: [
          { subcategory: 'Office Rent & Maintenance', limitAmount: 60000 },
          { subcategory: 'Electricity & Water', limitAmount: 20000 },
        ],
      },
    }, token);

    const bucket = budgetRes.data.createBudgetBucket;
    assert(bucket.limitAmount === 100000, 'Created budget bucket with limit ₹100,000');
    assert(bucket.subcatBudgets.length === 2, 'Configured 2 optional subcategory budgets');

    // Add expenses to test subcategory budget calculation
    await gql(`
      mutation CreateExps($inputs: [ExpenseInput!]!) {
        createExpenses(inputs: $inputs) {
          id
        }
      }
    `, {
      inputs: [
        {
          companyId: comp2.id,
          date: new Date().toISOString().split('T')[0],
          categoryId: targetCat.id,
          categoryName: targetCat.name,
          subcategory: 'Office Rent & Maintenance',
          amount: 50000,
        },
        {
          companyId: comp2.id,
          date: new Date().toISOString().split('T')[0],
          categoryId: targetCat.id,
          categoryName: targetCat.name,
          subcategory: 'Electricity & Water',
          amount: 25000, // exceeds 20000 limit
        },
      ],
    }, token);

    // Query budget usage
    const usageRes = await gql(`
      query GetUsages($companyId: ID) {
        allBudgetUsages(companyId: $companyId) {
          usedAmount
          remainingAmount
          percentUsed
          isNearLimit
          subcatUsages {
            subcategory
            limitAmount
            usedAmount
            remainingAmount
            percentUsed
            isOverBudget
          }
        }
      }
    `, { companyId: comp2.id }, token);

    const usage = usageRes.data.allBudgetUsages[0];
    assert(usage.usedAmount === 75000, `Total bucket usage is ₹75,000 (got ${usage.usedAmount})`);
    assert(usage.percentUsed === 75, `Bucket percent used is 75%`);
    assert(usage.subcatUsages.length === 2, 'subcatUsages returned data for both subcategories');

    const rentUsage = usage.subcatUsages.find((s) => s.subcategory === 'Office Rent & Maintenance');
    const utilUsage = usage.subcatUsages.find((s) => s.subcategory === 'Electricity & Water');

    assert(rentUsage.usedAmount === 50000, 'Rent subcategory used ₹50,000');
    assert(rentUsage.isOverBudget === false, 'Rent is within budget');
    assert(utilUsage.usedAmount === 25000, 'Utility subcategory used ₹25,000');
    assert(utilUsage.isOverBudget === true, 'Utility subcategory correctly flagged as over-budget (25k > 20k)');

    // 8. Multi-Company Dashboard Analytics
    console.log('\n[Step 8] Testing Multi-Company Dashboard Analytics Query...');
    // Add income for comp2
    await gql(`
      mutation CreateInc($inputs: [IncomeInput!]!) {
        createIncomes(inputs: $inputs) {
          id
        }
      }
    `, {
      inputs: [
        {
          companyId: comp2.id,
          date: new Date().toISOString().split('T')[0],
          amount: 150000,
          source: 'Enterprise Licensing',
        },
      ],
    }, token);

    const dashRes = await gql(`
      query GetDashSpend($filter: DashFilter) {
        companySpendBreakdown(filter: $filter) {
          companyId
          companyName
          expenses
          income
          netBalance
          expenseCount
        }
      }
    `, {}, token);

    const breakdown = dashRes.data.companySpendBreakdown;
    assert(breakdown.length >= 1, `companySpendBreakdown returned ${breakdown.length} companies`);
    const comp2Breakdown = breakdown.find((b) => b.companyId === comp2.id);
    assert(comp2Breakdown.expenses === 75000, `Beta Core expenses aggregated to ₹75,000 (got ${comp2Breakdown.expenses})`);
    assert(comp2Breakdown.income === 150000, `Beta Core income aggregated to ₹150,000 (got ${comp2Breakdown.income})`);
    assert(comp2Breakdown.netBalance === 75000, `Beta Core net balance is ₹75,000 (got ${comp2Breakdown.netBalance})`);

    // 9. REST CSV Export Endpoints
    console.log('\n[Step 9] Testing REST CSV Export Endpoints...');
    const expExportRes = await fetch(`${BASE_URL}/export/expenses?token=${token}`);
    assert(expExportRes.status === 200, 'GET /export/expenses returned HTTP 200');
    const expCsv = await expExportRes.text();
    assert(expCsv.includes('Office Rent & Maintenance'), 'Expenses CSV contains recorded expense record');

    const incExportRes = await fetch(`${BASE_URL}/export/income?token=${token}`);
    assert(incExportRes.status === 200, 'GET /export/income returned HTTP 200');
    const incCsv = await incExportRes.text();
    assert(incCsv.includes('Enterprise Licensing'), 'Income CSV contains recorded income record');

    const catExportRes = await fetch(`${BASE_URL}/export/categories?token=${token}`);
    assert(catExportRes.status === 200, 'GET /export/categories returned HTTP 200');
    const catCsv = await catExportRes.text();
    assert(catCsv.includes('Section Letter') && catCsv.includes('Quantum AI Research Labs'), 'Categories CSV contains Chart of Accounts hierarchy');

  } catch (err) {
    console.error('Test Execution Error:', err);
    failCount++;
  } finally {
    console.log('\n======================================================');
    console.log(`ENHANCEMENTS TEST SUMMARY: ${passCount} PASSED, ${failCount} FAILED`);
    console.log('======================================================\n');

    await stopServer();
    await disconnectDB();
    if (mongod) await mongod.stop();

    if (failCount > 0) {
      process.exit(1);
    }
  }
}

runEnhancementsTest();
