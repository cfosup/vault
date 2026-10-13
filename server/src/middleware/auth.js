import { GraphQLError } from 'graphql';
import { verifyToken } from '../services/authService.js';
import { User } from '../models/User.js';

export const getAuthContext = async ({ req }) => {
  const authHeader = req?.headers?.authorization || req?.headers?.Authorization || '';

  if (!authHeader.toLowerCase().startsWith('bearer ')) {
    return { user: null, userId: null, orgId: null, role: null };
  }

  const token = authHeader.replace(/^Bearer\s+/i, '').trim();
  if (!token || token === 'undefined' || token === 'null') {
    return { user: null, userId: null, orgId: null, role: null };
  }

  const decoded = verifyToken(token);

  if (!decoded || !decoded.userId) {
    return { user: null, userId: null, orgId: null, role: null };
  }

  let orgId = decoded.orgId;
  let role = decoded.role;

  // Fallback: If orgId is missing or undefined in decoded token, retrieve from User model
  if (!orgId) {
    try {
      const userDoc = await User.findById(decoded.userId).select('orgId role');
      if (userDoc) {
        orgId = userDoc.orgId?.toString();
        role = role || userDoc.role;
      }
    } catch {
      // User lookup failed, proceed with null orgId
    }
  }

  return {
    user: decoded,
    userId: decoded.userId,
    orgId: orgId || null,
    role: role || 'owner',
  };
};

export const requireAuth = (context) => {
  if (!context || !context.userId) {
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
