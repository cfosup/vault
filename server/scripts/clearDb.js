import mongoose from 'mongoose';
import dotenv from 'dotenv';
import dns from 'node:dns';

try {
  dns.setServers(['8.8.8.8', '1.1.1.1']);
} catch (e) {}

dotenv.config();

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

export async function clearDatabase() {
  console.log('----------------------------------------------------');
  console.log('           VAULT DATABASE RESET SCRIPT              ');
  console.log('----------------------------------------------------');
  console.log('[ClearDB] Connecting to database...');
  await connectDB();
  console.log(`[ClearDB] Connected! Database name: ${mongoose.connection.name}`);

  const collections = [
    { name: 'Expense', model: Expense },
    { name: 'Income', model: Income },
    { name: 'BudgetBucket', model: BudgetBucket },
    { name: 'ChatSession', model: ChatSession },
    { name: 'PaymentMethod', model: PaymentMethod },
    { name: 'Company', model: Company },
    { name: 'User', model: User },
    { name: 'Organization', model: Organization },
    { name: 'Category', model: Category },
  ];

  for (const item of collections) {
    try {
      const res = await item.model.deleteMany({});
      console.log(`[ClearDB] Cleared ${item.name}: ${res.deletedCount} documents removed.`);
    } catch (err) {
      console.warn(`[ClearDB] Could not clear ${item.name}:`, err.message);
    }
  }

  // Drop any remaining auxiliary collections
  try {
    const dbCollections = await mongoose.connection.db.listCollections().toArray();
    for (const c of dbCollections) {
      if (!collections.some(item => item.model.collection.name === c.name)) {
        await mongoose.connection.db.collection(c.name).drop().catch(() => {});
        console.log(`[ClearDB] Dropped custom collection: ${c.name}`);
      }
    }
  } catch (err) {
    console.warn('[ClearDB] Collection enumeration note:', err.message);
  }

  // Reseed fresh default categories
  console.log('[ClearDB] Reseeding standard core categories...');
  await seedCategories();

  console.log('----------------------------------------------------');
  console.log(' SUCCESS: Database wiped clean. Ready for new project! ');
  console.log('----------------------------------------------------');
}

if (process.argv[1] && process.argv[1].endsWith('clearDb.js')) {
  clearDatabase()
    .then(async () => {
      await disconnectDB();
      process.exit(0);
    })
    .catch(async (err) => {
      console.error('[ClearDB Error]:', err);
      await disconnectDB();
      process.exit(1);
    });
}

export default clearDatabase;
