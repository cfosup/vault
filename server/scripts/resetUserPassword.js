import dotenv from 'dotenv';
dotenv.config();

import { connectDB } from '../src/config/db.js';
import { User } from '../src/models/User.js';
import { hashPassword } from '../src/services/authService.js';

const email = process.argv[2] || 'cfosup@gmail.com';
const tempPassword = process.argv[3] || 'Welcome@2026!';

async function run() {
  try {
    console.log(`Connecting to MongoDB...`);
    await connectDB();

    console.log(`Hashing temporary password...`);
    const newHash = await hashPassword(tempPassword);

    console.log(`Updating user: ${email}...`);
    const result = await User.updateOne(
      { email },
      { $set: { passwordHash: newHash } }
    );

    if (result.matchedCount === 0) {
      console.log(`No user found with email: ${email}`);
    } else {
      console.log(`Successfully updated password for ${email}!`);
      console.log(`Modified count: ${result.modifiedCount}`);
    }

    process.exit(0);
  } catch (error) {
    console.error('Error resetting password:', error);
    process.exit(1);
  }
}

run();
