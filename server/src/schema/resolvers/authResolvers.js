import { GraphQLError } from 'graphql';
import { Organization, User } from '../../models/index.js';
import { hashPassword, comparePassword, signToken } from '../../services/authService.js';
import { requireAuth } from '../../middleware/auth.js';
import { sendWelcomeEmail, sendTestEmail } from '../../services/emailService.js';

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

      // Send Welcome Email to customer via Resend asynchronously
      sendWelcomeEmail({
        to: user.email,
        name: user.name,
        orgName: org.name,
      }).catch((err) => console.error('[Resend Error] Registration welcome email error:', err.message));

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

    firebaseOAuth: async (_, { input }) => {
      const { email, name, avatarUrl, uid, orgName } = input;
      if (!email) {
        throw new GraphQLError('Email address is required for Firebase OAuth.', {
          extensions: { code: 'BAD_USER_INPUT' },
        });
      }

      const normalizedEmail = email.toLowerCase().trim();
      let user = await User.findOne({ email: normalizedEmail });
      let org;
      let isNewUser = false;

      if (user) {
        // Link Firebase UID and update avatar if provided
        if (uid && !user.firebaseUid) user.firebaseUid = uid;
        if (avatarUrl && !user.avatarUrl) user.avatarUrl = avatarUrl;
        if (!user.authProvider || user.authProvider === 'local') user.authProvider = 'google';
        user.lastLogin = new Date();
        await user.save();

        org = await Organization.findById(user.orgId);
        if (!org) {
          throw new GraphQLError('Associated organization not found.', {
            extensions: { code: 'NOT_FOUND' },
          });
        }
      } else {
        // New user signing up via Firebase OAuth
        isNewUser = true;
        const resolvedOrgName = (orgName && orgName.trim()) || (name ? `${name.trim()}'s Workspace` : 'Vault Organization');

        let baseSlug = slugify(resolvedOrgName);
        if (!baseSlug) baseSlug = 'org';
        let slug = baseSlug;
        let counter = 1;
        while (await Organization.findOne({ slug })) {
          slug = `${baseSlug}-${counter}`;
          counter++;
        }

        org = await Organization.create({
          name: resolvedOrgName,
          slug,
          plan: 'free',
        });

        user = await User.create({
          orgId: org._id,
          name: (name && name.trim()) || normalizedEmail.split('@')[0],
          email: normalizedEmail,
          firebaseUid: uid || null,
          authProvider: 'google',
          avatarUrl: avatarUrl || null,
          role: 'owner',
          isEmailVerified: true,
          lastLogin: new Date(),
        });

        // Send Welcome Email to customer via Resend asynchronously
        sendWelcomeEmail({
          to: user.email,
          name: user.name,
          orgName: org.name,
        }).catch((err) => console.error('[Resend Error] OAuth welcome email error:', err.message));
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
        message: isNewUser
          ? 'Welcome to Vault! Your account has been created via Google OAuth.'
          : 'Signed in successfully via Google OAuth.',
      };
    },

    sendTestEmail: async (_, { email }, context) => {
      requireAuth(context);
      const user = await User.findById(context.userId);
      const targetEmail = (email && email.trim()) || user?.email;
      if (!targetEmail) {
        throw new GraphQLError('Target email is required.', {
          extensions: { code: 'BAD_USER_INPUT' },
        });
      }

      const result = await sendTestEmail({
        to: targetEmail,
        userName: user?.name || 'Valued Customer',
      });

      if (!result.success) {
        return {
          success: false,
          message: result.error || 'Failed to deliver test email via Resend.',
          messageId: null,
        };
      }

      return {
        success: true,
        message: `Test email successfully dispatched to ${targetEmail} via Resend!`,
        messageId: result.messageId || null,
      };
    },
  },
};

export default authResolvers;
