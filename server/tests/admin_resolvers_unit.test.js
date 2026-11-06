import { adminResolvers } from '../src/schema/resolvers/adminResolvers.js';
import { User, Organization, Company, Expense, Income, ActivityLog, ChatSession } from '../src/models/index.js';

async function runUnitTests() {
  console.log('\n======================================================');
  console.log('   RUNNING ADMIN RESOLVERS UNIT TESTS (OFFLINE)       ');
  console.log('======================================================\n');

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

  // 1. Test Authorization Guard for non-admins
  try {
    console.log('[Test 1] Testing non-admin role rejection...');
    let threw = false;
    try {
      await adminResolvers.Query.adminDashboard({}, {}, { userId: '123', orgId: 'org1', role: 'member' });
    } catch (err) {
      threw = true;
      assert(err.extensions?.code === 'FORBIDDEN', 'Member role correctly rejected with FORBIDDEN');
    }
    assert(threw, 'adminDashboard threw error for member role');
  } catch (e) {
    console.error(e);
    failCount++;
  }

  // 2. Test Authorization Guard for unauthenticated
  try {
    console.log('\n[Test 2] Testing unauthenticated rejection...');
    let threw = false;
    try {
      await adminResolvers.Query.adminDashboard({}, {}, {});
    } catch (err) {
      threw = true;
      assert(err.extensions?.code === 'UNAUTHENTICATED', 'Null context correctly rejected with UNAUTHENTICATED');
    }
    assert(threw, 'adminDashboard threw error for unauthenticated user');
  } catch (e) {
    console.error(e);
    failCount++;
  }

  // 3. Test Invalid Role in updateUserRole
  try {
    console.log('\n[Test 3] Testing invalid role parameter in updateUserRole...');
    let threw = false;
    try {
      await adminResolvers.Mutation.updateUserRole({}, { userId: '123', role: 'superhero' }, { userId: 'admin1', role: 'owner' });
    } catch (err) {
      threw = true;
      assert(err.extensions?.code === 'BAD_USER_INPUT', 'Invalid role name correctly rejected with BAD_USER_INPUT');
    }
    assert(threw, 'updateUserRole threw error for invalid role');
  } catch (e) {
    console.error(e);
    failCount++;
  }

  // 4. Test ActivityLog model schema & fields
  try {
    console.log('\n[Test 4] Verifying ActivityLog Mongoose model schema...');
    const paths = ActivityLog.schema.paths;
    assert(paths.action != null, 'ActivityLog has action field');
    assert(paths.description != null, 'ActivityLog has description field');
    assert(paths.userId != null, 'ActivityLog has userId field');
    assert(paths.orgId != null, 'ActivityLog has orgId field');
    assert(paths.createdAt != null, 'ActivityLog has createdAt timestamp');
  } catch (e) {
    console.error(e);
    failCount++;
  }

  console.log('\n======================================================');
  console.log(`UNIT TEST SUMMARY: ${passCount} Passed, ${failCount} Failed`);
  console.log('======================================================\n');

  if (failCount > 0) process.exit(1);
}

runUnitTests();

