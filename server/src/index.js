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

// Basic middleware
app.use(
  cors({
    origin: [CLIENT_URL, 'http://localhost:5173', 'http://127.0.0.1:5173', 'https://studio.apollographql.com'],
    credentials: true,
  })
);
app.use(express.json());

// Health check endpoint
app.get('/health', (req, res) => {
  const dbStatus = mongoose.connection.readyState === 1 ? 'connected' : 'disconnected';
  res.status(200).json({
    status: 'ok',
    db: dbStatus,
    timestamp: new Date().toISOString(),
    version: '1.0.0',
  });
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
        console.log(`[Server] ExpenseFlow API running on http://localhost:${customPort}`);
        console.log(`[Server] GraphQL endpoint: http://localhost:${customPort}/graphql`);
        console.log(`[Server] Health check: http://localhost:${customPort}/health`);
        console.log(`[Server] CSV Exports: http://localhost:${customPort}/export/expenses`);
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
