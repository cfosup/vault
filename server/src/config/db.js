import mongoose from 'mongoose';
import dns from 'node:dns';
import dotenv from 'dotenv';

dotenv.config();

// Ensure SRV records for MongoDB Atlas resolve reliably across local Windows DNS resolvers
try {
  dns.setServers(['8.8.8.8', '1.1.1.1']);
} catch {
  // Ignore in restricted environments
}

let isConnected = false;
let memoryServer = null;

export const connectDB = async (uri = process.env.MONGODB_URI) => {
  if (isConnected && mongoose.connection.readyState === 1) {
    return mongoose.connection;
  }

  // Try the provided URI first
  if (uri) {
    try {
      const conn = await mongoose.connect(uri, {
        serverSelectionTimeoutMS: 5000,
      });
      isConnected = true;
      console.log(`[MongoDB] Connected to database: ${conn.connection.host}/${conn.connection.name}`);
      return conn.connection;
    } catch (error) {
      console.error(`[MongoDB] Connection error: ${error.message}`);
      // In development, fallback to in-memory MongoDB
      if (process.env.NODE_ENV !== 'production') {
        console.log('[MongoDB] Atlas unreachable. Falling back to in-memory MongoDB for development...');
      } else {
        throw error;
      }
    }
  }

  // Fallback: use mongodb-memory-server for local development
  try {
    const { MongoMemoryServer } = await import('mongodb-memory-server');
    memoryServer = await MongoMemoryServer.create();
    const memUri = memoryServer.getUri();
    const conn = await mongoose.connect(memUri);
    isConnected = true;
    console.log(`[MongoDB] Connected to in-memory database (development mode)`);
    console.log(`[MongoDB] ⚠ Data will NOT persist across restarts. Configure MONGODB_URI for persistence.`);
    return conn.connection;
  } catch (fallbackError) {
    console.error(`[MongoDB] In-memory fallback also failed: ${fallbackError.message}`);
    throw fallbackError;
  }
};

export const disconnectDB = async () => {
  if (isConnected) {
    await mongoose.disconnect();
    isConnected = false;
    console.log('[MongoDB] Disconnected successfully');
  }
  if (memoryServer) {
    await memoryServer.stop();
    memoryServer = null;
  }
};

export default connectDB;
