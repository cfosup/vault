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
    role: role || null,
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

const roleOf = (context) => (context?.role || '').toLowerCase();

const forbid = () => {
  throw new GraphQLError('You do not have permission to change these records.', {
    extensions: { code: 'FORBIDDEN', http: { status: 403 } },
  });
};

export const requireWriter = (context) => {
  requireAuth(context);
  const role = roleOf(context);
  if (role === 'owner' || role === 'admin' || role === 'superadmin') return context;
  forbid();
};

export const requireOwner = (context) => {
  requireAuth(context);
  const role = roleOf(context);
  if (role === 'owner' || role === 'superadmin') return context;
  forbid();
};

export default {
  getAuthContext,
  requireAuth,
  requireWriter,
  requireOwner,
};
