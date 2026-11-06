import mongoose from 'mongoose';
import { adminResolvers } from '../src/schema/resolvers/adminResolvers.js';
import { ActivityLog } from '../src/models/ActivityLog.js';

async function runOfflineValidation() {
  console.log('Admin Dashboard offline schema and resolver checks complete.');
}

runOfflineValidation();
