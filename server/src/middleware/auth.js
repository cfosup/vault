import { GraphQLError } from 'graphql';
import { verifyToken } from '../services/authService.js';
import { User } from '../models/User.js';

export const getAuthContext = async ({ req }) => {
  const authHeader = req.headers.authorization || '';

  if (!authHeader.startsWith('Bearer ')) {
    return { user: null, userId: null, orgId: null, role: null };
  }

  const token = authHeader.replace('Bearer ', '').trim();
  const decoded = verifyToken(token);

  if (!decoded || !decoded.userId) {
    return { user: null, userId: null, orgId: null, role: null };
  }

  return {
    user: decoded,
    userId: decoded.userId,
    orgId: decoded.orgId,
    role: decoded.role,
  };
};

export const requireAuth = (context) => {
  if (!context || !context.userId || !context.orgId) {
    throw new GraphQLError('Authentication required. Please provide a valid Bearer token.', {
      extensions: {
        code: 'UNAUTHENTICATED',
        http: { status: 401 },
      },
    });
  }
  return context;
};

export default {
  getAuthContext,
  requireAuth,
};
