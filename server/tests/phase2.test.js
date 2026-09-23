import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { connectDB, disconnectDB } from '../src/config/db.js';
import { seedCategories } from '../src/services/seedService.js';
import { startServer, stopServer } from '../src/index.js';

async function runPhase2Test() {
  console.log('\n======================================================');
  console.log('       RUNNING EXPENSEFLOW BACKEND - PHASE 2 TESTS    ');
  console.log('======================================================\n');

  let mongod = null;
  let passCount = 0;
  let failCount = 0;
  const TEST_PORT = 4002;
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
    // 1. Initialize Test Database
    console.log('[Step 1] Initializing Test Database & Apollo Server...');
    mongod = await MongoMemoryServer.create();
    const mongoUri = mongod.getUri();

    await startServer(TEST_PORT, mongoUri);
    assert(mongoose.connection.readyState === 1, 'Connected to test MongoDB and Apollo Server running');

    // 2. Auth Tests: Registration & Login
    console.log('\n[Step 2] Testing Authentication (Register, Login, Me)...');
    const registerRes = await gql(`
      mutation RegisterOrg($input: RegisterInput!) {
        register(input: $input) {
          token
          user { id name email role }
          org { id name slug plan }
        }
      }
    `, {
      input: {
        name: 'John Founder',
        email: 'john@acme.com',
        password: 'securePassword123',
        orgName: 'Acme Enterprise',
      },
    });

    assert(!registerRes.errors, 'Register mutation executed without GraphQL errors');
    const orgAToken = registerRes.data?.register?.token;
    const orgAId = registerRes.data?.register?.org?.id;
    const userAId = registerRes.data?.register?.user?.id;
    assert(!!orgAToken, 'Received valid JWT token on register');
    assert(registerRes.data?.register?.org?.slug === 'acme-enterprise', 'Org slug generated: acme-enterprise');

    // Test duplicate registration rejection
    const duplicateRes = await gql(`
      mutation RegisterDup($input: RegisterInput!) {
        register(input: $input) { token }
      }
    `, {
      input: {
        name: 'John Duplicate',
        email: 'john@acme.com',
        password: 'anotherPassword',
        orgName: 'Acme Two',
      },
    });
    assert(!!duplicateRes.errors, 'Duplicate email registration was correctly rejected');

    // Test Login
    const loginRes = await gql(`
      mutation LoginUser($email: String!, $password: String!) {
        login(email: $email, password: $password) {
          token
          user { email name }
        }
      }
    `, {
      email: 'john@acme.com',
      password: 'securePassword123',
    });
    assert(!!loginRes.data?.login?.token, 'Login returned valid JWT token');

    // Test Login with wrong password
    const badLoginRes = await gql(`
      mutation BadLogin($email: String!, $password: String!) {
        login(email: $email, password: $password) { token }
      }
    `, {
      email: 'john@acme.com',
      password: 'wrongPassword',
    });
    assert(!!badLoginRes.errors, 'Login with invalid password correctly rejected');

    // Test `me` query (authenticated)
    const meRes = await gql(`
      query GetMe {
        me { id name email role }
      }
    `, {}, orgAToken);
    assert(meRes.data?.me?.email === 'john@acme.com', 'Query me returned authenticated user profile');

    // Test unauthenticated access rejection
    const unauthRes = await gql(`
      query GetMeUnauth {
        me { id name }
      }
    `);
    assert(!!unauthRes.errors, 'Protected query without token rejected with UNAUTHENTICATED');

    // 3. Companies CRUD
    console.log('\n[Step 3] Testing Company CRUD...');
    const createCompRes = await gql(`
      mutation CreateComp($input: CompanyInput!) {
        createCompany(input: $input) {
          id name description isActive
        }
      }
    `, {
      input: {
        name: 'BRIGHT DIGITAL PVT LTD',
        description: 'Tech entity',
        isActive: true,
      },
    }, orgAToken);

    const companyAId = createCompRes.data?.createCompany?.id;
    assert(!!companyAId, 'Created company with ID: ' + companyAId);

    const getCompaniesRes = await gql(`
      query GetCompanies {
        companies { id name description }
      }
    `, {}, orgAToken);
    assert(getCompaniesRes.data?.companies?.length === 1, 'Fetched companies list contains 1 company');

    // Update Company
    const updateCompRes = await gql(`
      mutation UpdateComp($id: ID!, $input: CompanyInput!) {
        updateCompany(id: $id, input: $input) {
          id name description
        }
      }
    `, {
      id: companyAId,
      input: { name: 'BRIGHT DIGITAL GLOBAL LTD', description: 'Updated global entity' },
    }, orgAToken);
    assert(updateCompRes.data?.updateCompany?.name === 'BRIGHT DIGITAL GLOBAL LTD', 'Company successfully updated');

    // 4. Categories & Subcategories
    console.log('\n[Step 4] Testing Categories & Subcategories...');
    const getCatsRes = await gql(`
      query GetCategories {
        categories { id name group groupLabel isGlobal subcategories { name items } }
      }
    `, {}, orgAToken);

    const allCategories = getCatsRes.data?.categories || [];
    assert(allCategories.length >= 50, `Seeded categories accessible via GraphQL (found ${allCategories.length})`);

    const infraCat = allCategories.find((c) => c.name === 'Infrastructure & Utilities');
    assert(!!infraCat, 'Found "Infrastructure & Utilities" category');

    // Add subcategory
    const addSubRes = await gql(`
      mutation AddSub($categoryId: ID!, $subcategoryName: String!, $items: [String!]) {
        addSubcategory(categoryId: $categoryId, subcategoryName: $subcategoryName, items: $items) {
          id name subcategories { name items }
        }
      }
    `, {
      categoryId: infraCat.id,
      subcategoryName: 'Co-Working Pods',
      items: ['Desk A', 'Desk B'],
    }, orgAToken);

    const hasNewSub = addSubRes.data?.addSubcategory?.subcategories.some(
      (s) => s.name === 'Co-Working Pods'
    );
    assert(hasNewSub, 'Successfully added new subcategory "Co-Working Pods"');

    // 5. Payment Methods CRUD
    console.log('\n[Step 5] Testing Payment Methods CRUD...');
    const createPmRes = await gql(`
      mutation CreatePM($input: PaymentMethodInput!) {
        createPaymentMethod(input: $input) {
          id name type accountNumber isActive
        }
      }
    `, {
      input: {
        name: 'HDFC Corporate Current A/c',
        type: 'bank',
        accountNumber: '9988',
        isActive: true,
      },
    }, orgAToken);

    const pmId = createPmRes.data?.createPaymentMethod?.id;
    assert(!!pmId, 'Created payment method with ID: ' + pmId);

    const getPmRes = await gql(`
      query GetPMs {
        paymentMethods { id name type accountNumber }
      }
    `, {}, orgAToken);
    assert(getPmRes.data?.paymentMethods?.length === 1, 'Fetched payment methods returns 1 method');

    // 6. Expenses Bulk Creation & Filtering
    console.log('\n[Step 6] Testing Bulk Expense Creation & Filtered Pagination...');
    const bulkExpensesRes = await gql(`
      mutation CreateBulkExpenses($inputs: [ExpenseInput!]!) {
        createExpenses(inputs: $inputs) {
          id amount vendor categoryName subcategory
        }
      }
    `, {
      inputs: [
        {
          companyId: companyAId,
          categoryId: infraCat.id,
          categoryName: infraCat.name,
          subcategory: 'Digital Infrastructure',
          amount: 8500,
          vendor: 'Amazon Web Services',
          paymentMethodId: pmId,
          paymentMethodName: 'HDFC Corporate Current A/c',
          notes: 'Production cloud hosting',
        },
        {
          companyId: companyAId,
          categoryId: infraCat.id,
          categoryName: infraCat.name,
          subcategory: 'Office Space',
          amount: 25000,
          vendor: 'WeWork Coworking',
          paymentMethodId: pmId,
          paymentMethodName: 'HDFC Corporate Current A/c',
          notes: 'HQ Office rent',
        },
        {
          companyId: companyAId,
          categoryId: infraCat.id,
          categoryName: infraCat.name,
          subcategory: 'Office Supplies',
          amount: 2200,
          vendor: 'Staples India',
          paymentMethodId: pmId,
          paymentMethodName: 'HDFC Corporate Current A/c',
          notes: 'Stationery and pantry items',
        },
      ],
    }, orgAToken);

    assert(bulkExpensesRes.data?.createExpenses?.length === 3, 'Bulk created 3 expenses simultaneously');

    const exp1Id = bulkExpensesRes.data?.createExpenses[0]?.id;
    const exp3Id = bulkExpensesRes.data?.createExpenses[2]?.id;

    // Query expenses list with pagination
    const listExpRes = await gql(`
      query ListExpenses($filter: ExpenseFilter, $page: Int, $limit: Int) {
        expenses(filter: $filter, page: $page, limit: $limit) {
          totalCount
          page
          totalPages
          expenses { id amount vendor subcategory }
        }
      }
    `, {
      filter: { companyId: companyAId },
      page: 1,
      limit: 10,
    }, orgAToken);

    assert(listExpRes.data?.expenses?.totalCount === 3, 'Query expenses totalCount is 3');

    // Query with search filter
    const searchExpRes = await gql(`
      query SearchExpenses($filter: ExpenseFilter) {
        expenses(filter: $filter) {
          totalCount
          expenses { vendor amount }
        }
      }
    `, {
      filter: { search: 'Amazon' },
    }, orgAToken);

    assert(searchExpRes.data?.expenses?.totalCount === 1, 'Search filter "Amazon" found 1 matching expense');
    assert(searchExpRes.data?.expenses?.expenses[0]?.vendor === 'Amazon Web Services', 'Matched Amazon Web Services');

    // Update expense
    const updateExpRes = await gql(`
      mutation UpdateExpense($id: ID!, $input: ExpenseInput!) {
        updateExpense(id: $id, input: $input) {
          id amount notes
        }
      }
    `, {
      id: exp1Id,
      input: {
        companyId: companyAId,
        categoryId: infraCat.id,
        amount: 9200,
        notes: 'Updated AWS bill with tax',
      },
    }, orgAToken);
    assert(updateExpRes.data?.updateExpense?.amount === 9200, 'Expense amount successfully updated to ₹9,200');

    // Soft delete expense
    const deleteExpRes = await gql(`
      mutation DeleteExpense($id: ID!) {
        deleteExpense(id: $id)
      }
    `, { id: exp3Id }, orgAToken);
    assert(deleteExpRes.data?.deleteExpense === true, 'Soft-deleted third expense');

    const verifyActiveExpRes = await gql(`
      query VerifyActiveExp {
        expenses { totalCount }
      }
    `, {}, orgAToken);
    assert(verifyActiveExpRes.data?.expenses?.totalCount === 2, 'Active expenses count is now 2 after soft delete');

    // 7. Income Bulk Creation & Filtering
    console.log('\n[Step 7] Testing Bulk Income Creation & Pagination...');
    const bulkIncomeRes = await gql(`
      mutation CreateIncomes($inputs: [IncomeInput!]!) {
        createIncomes(inputs: $inputs) {
          id amount source notes
        }
      }
    `, {
      inputs: [
        {
          companyId: companyAId,
          amount: 150000,
          source: 'Client Alpha SaaS Subscription',
          notes: 'Quarterly payment',
        },
        {
          companyId: companyAId,
          amount: 75000,
          source: 'Consulting Advisory Retainer',
          notes: 'Monthly billing',
        },
      ],
    }, orgAToken);

    assert(bulkIncomeRes.data?.createIncomes?.length === 2, 'Bulk created 2 income records');

    const listIncomeRes = await gql(`
      query ListIncomes {
        incomes {
          totalCount
          incomes { id amount source }
        }
      }
    `, {}, orgAToken);
    assert(listIncomeRes.data?.incomes?.totalCount === 2, 'Total active incomes is 2');

    // 8. Multi-Tenancy Data Isolation Test
    console.log('\n[Step 8] Testing Multi-Tenant Data Isolation...');
    // Register Organization B
    const regBRes = await gql(`
      mutation RegisterOrgB($input: RegisterInput!) {
        register(input: $input) {
          token
          org { id name }
        }
      }
    `, {
      input: {
        name: 'Jane Competitor',
        email: 'jane@betacorp.test',
        password: 'securePasswordB',
        orgName: 'Beta Corp',
      },
    });

    const orgBToken = regBRes.data?.register?.token;
    assert(!!orgBToken, 'Registered Org B and acquired JWT token');

    // Org B queries companies: should NOT see Org A's company
    const orgBCompanies = await gql(`
      query OrgBCompanies {
        companies { id name }
      }
    `, {}, orgBToken);
    assert(orgBCompanies.data?.companies?.length === 0, 'Org B has 0 companies (cannot see Org A company)');

    // Org B queries expenses: should NOT see Org A's expenses
    const orgBExpenses = await gql(`
      query OrgBExpenses {
        expenses { totalCount expenses { id } }
      }
    `, {}, orgBToken);
    assert(orgBExpenses.data?.expenses?.totalCount === 0, 'Org B has 0 expenses (cannot see Org A expenses)');

    // Org B queries incomes: should NOT see Org A's incomes
    const orgBIncomes = await gql(`
      query OrgBIncomes {
        incomes { totalCount incomes { id } }
      }
    `, {}, orgBToken);
    assert(orgBIncomes.data?.incomes?.totalCount === 0, 'Org B has 0 incomes (cannot see Org A incomes)');

    // Org B attempts to fetch Org A's expense by ID: must fail with NOT_FOUND
    const crossOrgAccess = await gql(`
      query HackExpense($id: ID!) {
        expense(id: $id) { id amount }
      }
    `, { id: exp1Id }, orgBToken);
    assert(!!crossOrgAccess.errors, 'Cross-tenant access attempt to Org A expense is blocked with error');

    console.log('\n======================================================');
    console.log(`PHASE 2 TEST SUMMARY: ${passCount} PASSED, ${failCount} FAILED`);
    console.log('======================================================\n');

    if (failCount > 0) {
      process.exit(1);
    }
  } catch (error) {
    console.error('\n[FATAL ERROR IN PHASE 2 TEST]:', error);
    process.exit(1);
  } finally {
    await stopServer();
    await disconnectDB();
    if (mongod) {
      await mongod.stop();
    }
  }
}

runPhase2Test();
