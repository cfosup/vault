import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import rateLimit from 'express-rate-limit';
import { ApolloServer } from '@apollo/server';
import { expressMiddleware } from '@apollo/server/express4';
import { connectDB } from './config/db.js';
import { seedCategories } from './services/seedService.js';
import { typeDefs } from './schema/typeDefs/index.js';
import { resolvers } from './schema/resolvers/index.js';
import { getAuthContext } from './middleware/auth.js';
import { exportExpensesCSV, exportIncomeCSV, exportCategoriesCSV } from './controllers/exportController.js';
import { initKeepAlive } from './services/keepAliveService.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 4000;
const CLIENT_URL = process.env.CLIENT_URL || 'http://localhost:5173';

// Rate Limiting
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 2000,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again later.' },
});
app.use(globalLimiter);

// Flexible CORS (supports Vercel production + preview subdomains, localhost, and custom domain)
app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin) return callback(null, true);
      if (
        origin === CLIENT_URL ||
        origin.endsWith('.vercel.app') ||
        origin.includes('localhost') ||
        origin.includes('127.0.0.1') ||
        origin === 'https://studio.apollographql.com'
      ) {
        return callback(null, true);
      }
      return callback(null, true);
    },
    credentials: true,
  })
);
app.use(express.json());

// Health check endpoint (used by keep-alive triggers and monitoring)
app.get('/health', (req, res) => {
  const dbStatus = mongoose.connection.readyState === 1 ? 'connected' : 'disconnected';
  res.status(200).json({
    status: 'ok',
    service: 'Vault API',
    db: dbStatus,
    timestamp: new Date().toISOString(),
    version: '1.0.0',
  });
});

// Admin Reset Database Endpoint (Clean slate for new project)
app.post('/api/admin/reset-database', async (req, res) => {
  try {
    const {
      Organization,
      User,
      Company,
      Category,
      PaymentMethod,
      BudgetBucket,
      Expense,
      Income,
      ChatSession,
    } = await import('./models/index.js');
    const { seedCategories } = await import('./services/seedService.js');

    await Promise.all([
      Expense.deleteMany({}),
      Income.deleteMany({}),
      BudgetBucket.deleteMany({}),
      ChatSession.deleteMany({}),
      PaymentMethod.deleteMany({}),
      Company.deleteMany({}),
      User.deleteMany({}),
      Organization.deleteMany({}),
      Category.deleteMany({}),
    ]);

    await seedCategories();
    res.status(200).json({
      success: true,
      message: 'Database completely wiped and reset to a clean slate.',
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// REST CSV Data Export Endpoints
app.get('/export/expenses', exportExpensesCSV);
app.get('/export/income', exportIncomeCSV);
app.get('/export/categories', exportCategoriesCSV);

let server = null;
let apolloServer = null;

export const createApolloServer = () => {
  return new ApolloServer({
    typeDefs,
    resolvers,
    formatError: (formattedError) => {
      console.error('[GraphQL Error]:', formattedError.message);
      return formattedError;
    },
  });
};

export const startServer = async (customPort = PORT, customUri = process.env.MONGODB_URI) => {
  try {
    if (customUri) {
      await connectDB(customUri);
      await seedCategories();
    }

    if (!apolloServer) {
      apolloServer = createApolloServer();
      await apolloServer.start();

      app.use(
        '/graphql',
        expressMiddleware(apolloServer, {
          context: getAuthContext,
        })
      );
    }

    return new Promise((resolve) => {
      server = app.listen(customPort, () => {
        console.log(`[Server] Vault API running on http://localhost:${customPort}`);
        console.log(`[Server] GraphQL endpoint: http://localhost:${customPort}/graphql`);
        console.log(`[Server] Health check: http://localhost:${customPort}/health`);
        console.log(`[Server] CSV Exports: http://localhost:${customPort}/export/expenses`);
        initKeepAlive();
        resolve({ app, server, apolloServer });
      });
    });
  } catch (error) {
    console.error(`[Server] Failed to start: ${error.message}`);
    throw error;
  }
};

export const stopServer = async () => {
  if (apolloServer) {
    await apolloServer.stop();
    apolloServer = null;
  }
  if (server) {
    await new Promise((resolve) => server.close(resolve));
    server = null;
  }
};

// Start automatically if executed directly
if (process.argv[1] && (process.argv[1].endsWith('index.js') || process.argv[1].endsWith('src\\index.js'))) {
  startServer().catch((err) => {
    console.error('Fatal startup error:', err);
  });
}

export { app, server, apolloServer };
export default app;
