import { GraphQLError } from 'graphql';
import { Organization, User } from '../../models/index.js';
import { hashPassword, comparePassword, signToken } from '../../services/authService.js';
import { requireAuth } from '../../middleware/auth.js';

const slugify = (text) => {
  return text
    .toString()
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^\w-]+/g, '')
    .replace(/--+/g, '-');
};

export const authResolvers = {
  Query: {
    me: async (_, __, context) => {
      requireAuth(context);
      const user = await User.findById(context.userId);
      if (!user) {
        throw new GraphQLError('User not found', {
          extensions: { code: 'NOT_FOUND', http: { status: 404 } },
        });
      }
      return user;
    },
  },

  Mutation: {
    register: async (_, { input }) => {
      const { name, email, password, orgName } = input;

      if (!name || !email || !password || !orgName) {
        throw new GraphQLError('Name, email, password, and organization name are all required.', {
          extensions: { code: 'BAD_USER_INPUT' },
        });
      }

      const normalizedEmail = email.toLowerCase().trim();
      const existingUser = await User.findOne({ email: normalizedEmail });
      if (existingUser) {
        throw new GraphQLError('An account with this email address already exists.', {
          extensions: { code: 'EMAIL_ALREADY_EXISTS' },
        });
      }

      // Generate unique slug for the organization
      let baseSlug = slugify(orgName);
      if (!baseSlug) baseSlug = 'org';
      let slug = baseSlug;
      let counter = 1;
      while (await Organization.findOne({ slug })) {
        slug = `${baseSlug}-${counter}`;
        counter++;
      }

      const org = await Organization.create({
        name: orgName.trim(),
        slug,
        plan: 'free',
      });

      const passwordHash = await hashPassword(password);

      const user = await User.create({
        orgId: org._id,
        name: name.trim(),
        email: normalizedEmail,
        passwordHash,
        role: 'owner',
        isEmailVerified: true,
        lastLogin: new Date(),
      });

      const token = signToken({
        userId: user._id.toString(),
        orgId: org._id.toString(),
        role: user.role,
      });

      return {
        token,
        user,
        org,
        message: 'Registration successful! Welcome to Vault.',
      };
    },

    login: async (_, { email, password }) => {
      if (!email || !password) {
        throw new GraphQLError('Email and password are required.', {
          extensions: { code: 'BAD_USER_INPUT' },
        });
      }

      const normalizedEmail = email.toLowerCase().trim();
      const user = await User.findOne({ email: normalizedEmail });
      if (!user) {
        throw new GraphQLError('Invalid email or password.', {
          extensions: { code: 'INVALID_CREDENTIALS', http: { status: 401 } },
        });
      }

      const isMatch = await comparePassword(password, user.passwordHash);
      if (!isMatch) {
        throw new GraphQLError('Invalid email or password.', {
          extensions: { code: 'INVALID_CREDENTIALS', http: { status: 401 } },
        });
      }

      user.lastLogin = new Date();
      await user.save();

      const org = await Organization.findById(user.orgId);
      if (!org) {
        throw new GraphQLError('Associated organization not found.', {
          extensions: { code: 'NOT_FOUND' },
        });
      }

      const token = signToken({
        userId: user._id.toString(),
        orgId: org._id.toString(),
        role: user.role,
      });

      return {
        token,
        user,
        org,
      };
    },

  },
};

export default authResolvers;
