import crypto from 'crypto';
import { GraphQLError } from 'graphql';
import { User, Organization, Invite, Company, MonthLock, RecurringSchedule } from '../../models/index.js';
import { requireAuth, requireOwner } from '../../middleware/auth.js';
import { hashPassword, signToken } from '../../services/authService.js';
import { sendInviteEmail, sendWelcomeEmail } from '../../services/emailService.js';
import { vendorNames } from '../../services/scheduleService.js';
import { assertCompaniesInOrg } from '../../utils/tenant.js';
import { assertRead, assertWrite } from '../../utils/access.js';

const hashToken = (token) => crypto.createHash('sha256').update(token).digest('hex');

const cleanModules = (modules) => (modules || []).filter((item) => item === 'expenses' || item === 'income');

const accessSummary = ({ accessScope, modules, companyIds }) => {
  if (accessScope !== 'modules') return 'Whole workspace';
  const names = cleanModules(modules);
  return names.length ? `${names.join(' and ')} only` : 'No modules selected';
};

const memberShape = (user) => ({
  id: user._id.toString(),
  name: user.name,
  email: user.email,
  role: user.role,
  accessScope: user.accessScope || null,
  modules: user.modules || [],
  companyIds: (user.companyIds || []).map((id) => id.toString()),
  canDeleteExpenses: !!user.canDeleteExpenses,
  canDeleteIncome: !!user.canDeleteIncome,
});

async function checkedCompanies(companyIds, orgId) {
  const ids = (companyIds || []).filter(Boolean);
  if (!ids.length) return [];
  await assertCompaniesInOrg(ids, orgId);
  return ids;
}

export const featureResolvers = {
  User: {
    modules: (user) => user.modules || [],
    companyIds: (user) => (user.companyIds || []).map((id) => id.toString()),
    canDeleteExpenses: (user) => !!user.canDeleteExpenses,
    canDeleteIncome: (user) => !!user.canDeleteIncome,
    accessScope: (user) => user.accessScope || null,
  },

  Query: {
    orgMembers: async (_, __, context) => {
      requireOwner(context);
      const users = await User.find({ orgId: context.orgId, role: { $ne: 'superadmin' } }).sort({ createdAt: 1 });
      return users.map(memberShape);
    },

    pendingInvites: async (_, __, context) => {
      requireOwner(context);
      const invites = await Invite.find({
        orgId: context.orgId,
        acceptedAt: null,
        expiresAt: { $gt: new Date() },
      }).sort({ createdAt: -1 });
      return invites.map((invite) => ({
        id: invite._id.toString(),
        email: invite.email,
        accessScope: invite.accessScope,
        modules: invite.modules || [],
        companyIds: (invite.companyIds || []).map((id) => id.toString()),
        canDeleteExpenses: !!invite.canDeleteExpenses,
        canDeleteIncome: !!invite.canDeleteIncome,
        expiresAt: invite.expiresAt.toISOString(),
      }));
    },

    invitePreview: async (_, { token }) => {
      const invite = await Invite.findOne({
        tokenHash: hashToken(token || ''),
        acceptedAt: null,
        expiresAt: { $gt: new Date() },
      });
      if (!invite) {
        throw new GraphQLError('This invite link is invalid or has expired.', { extensions: { code: 'BAD_USER_INPUT' } });
      }
      const org = await Organization.findById(invite.orgId);
      return {
        orgName: org?.name || 'Vault',
        email: invite.email,
        accessSummary: accessSummary(invite),
        expiresAt: invite.expiresAt.toISOString(),
      };
    },

    vendorSuggestions: async (_, { categoryId, subcategory }, context) => {
      await assertRead(context, 'expenses');
      return vendorNames(context.orgId, categoryId, subcategory || '');
    },

    monthLocks: async (_, __, context) => {
      requireAuth(context);
      const locks = await MonthLock.find({ orgId: context.orgId }).sort({ year: -1, month: -1 });
      return locks.map((lock) => ({ id: lock._id.toString(), year: lock.year, month: lock.month }));
    },

    myRecurringSchedules: async (_, __, context) => {
      requireAuth(context);
      const rows = await RecurringSchedule.find({ orgId: context.orgId, active: true }).sort({ nextRunAt: 1 });
      return rows.map((row) => ({
        id: row._id.toString(),
        kind: row.kind,
        companyId: row.companyId.toString(),
        dayOfMonth: row.dayOfMonth,
        nextRunAt: row.nextRunAt.toISOString(),
        active: row.active,
        label: row.kind === 'income' ? row.payload?.source || 'Income' : row.payload?.vendor || row.payload?.categoryName || 'Expense',
      }));
    },
  },

  Mutation: {
    inviteMember: async (_, { input }, context) => {
      requireOwner(context);
      const email = (input.email || '').toLowerCase().trim();
      if (!email) throw new GraphQLError('Email is required.', { extensions: { code: 'BAD_USER_INPUT' } });
      const existing = await User.findOne({ email });
      if (existing) {
        throw new GraphQLError('That email already belongs to a Vault account. One email can belong to one organization.', {
          extensions: { code: 'BAD_USER_INPUT' },
        });
      }
      const companyIds = await checkedCompanies(input.companyIds, context.orgId);
      const rawToken = crypto.randomBytes(32).toString('hex');
      const invite = await Invite.create({
        orgId: context.orgId,
        email,
        tokenHash: hashToken(rawToken),
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        accessScope: input.accessScope === 'workspace' ? 'workspace' : 'modules',
        modules: cleanModules(input.modules),
        companyIds,
        canDeleteExpenses: !!input.canDeleteExpenses,
        canDeleteIncome: !!input.canDeleteIncome,
        invitedBy: context.userId,
      });
      const [org, inviter, companies] = await Promise.all([
        Organization.findById(context.orgId),
        User.findById(context.userId),
        Company.find({ _id: { $in: companyIds } }),
      ]);
      const companyLabel = companies.map((company) => company.name).join(', ');
      const summary = `${accessSummary(invite)}${companyLabel ? ` · ${companyLabel}` : ''}`;
      const joinUrl = `${process.env.CLIENT_URL || 'http://localhost:5173'}/join?token=${rawToken}`;
      sendInviteEmail({
        to: email,
        inviterName: inviter?.name,
        orgName: org?.name,
        accessSummary: summary,
        joinUrl,
      }).catch((err) => console.error('[Resend Error] Invite email error:', err.message));
      return { success: true, message: `Invitation sent to ${email}.`, messageId: null };
    },

    acceptInvite: async (_, { input }) => {
      const { token, name, password } = input;
      if (!token || !name || !password) {
        throw new GraphQLError('Name, password, and invite token are required.', { extensions: { code: 'BAD_USER_INPUT' } });
      }
      const invite = await Invite.findOne({
        tokenHash: hashToken(token),
        acceptedAt: null,
        expiresAt: { $gt: new Date() },
      });
      if (!invite) {
        throw new GraphQLError('This invite link is invalid or has expired.', { extensions: { code: 'BAD_USER_INPUT' } });
      }
      const existing = await User.findOne({ email: invite.email });
      if (existing) {
        throw new GraphQLError('That email already belongs to a Vault account.', { extensions: { code: 'BAD_USER_INPUT' } });
      }
      const user = await User.create({
        orgId: invite.orgId,
        name: name.trim(),
        email: invite.email,
        passwordHash: await hashPassword(password),
        role: 'member',
        accessScope: invite.accessScope,
        modules: invite.modules,
        companyIds: invite.companyIds,
        canDeleteExpenses: invite.canDeleteExpenses,
        canDeleteIncome: invite.canDeleteIncome,
        isEmailVerified: true,
        lastLogin: new Date(),
      });
      invite.acceptedAt = new Date();
      await invite.save();
      const org = await Organization.findById(invite.orgId);
      sendWelcomeEmail({ to: user.email, name: user.name, orgName: org?.name }).catch((err) =>
        console.error('[Resend Error] Invite welcome email error:', err.message)
      );
      return {
        token: signToken({ userId: user._id.toString(), orgId: invite.orgId.toString(), role: user.role }),
        user,
        org,
        message: 'Welcome to the organization.',
      };
    },

    updateMemberAccess: async (_, { userId, input }, context) => {
      requireOwner(context);
      const user = await User.findOne({ _id: userId, orgId: context.orgId });
      if (!user) throw new GraphQLError('Person not found.', { extensions: { code: 'NOT_FOUND' } });
      if (user.role === 'owner') throw new GraphQLError('The owner access cannot be reduced.', { extensions: { code: 'FORBIDDEN' } });
      user.accessScope = input.accessScope === 'workspace' ? 'workspace' : 'modules';
      user.modules = cleanModules(input.modules);
      user.companyIds = await checkedCompanies(input.companyIds, context.orgId);
      user.canDeleteExpenses = !!input.canDeleteExpenses;
      user.canDeleteIncome = !!input.canDeleteIncome;
      await user.save();
      return memberShape(user);
    },

    removeMember: async (_, { userId }, context) => {
      requireOwner(context);
      const user = await User.findOne({ _id: userId, orgId: context.orgId });
      if (!user) return false;
      if (user.role === 'owner') throw new GraphQLError('The owner cannot be removed.', { extensions: { code: 'FORBIDDEN' } });
      await User.deleteOne({ _id: user._id });
      return true;
    },

    lockMonth: async (_, { year, month }, context) => {
      requireOwner(context);
      if (month < 1 || month > 12) throw new GraphQLError('Month must be 1 to 12.', { extensions: { code: 'BAD_USER_INPUT' } });
      await MonthLock.updateOne(
        { orgId: context.orgId, year, month },
        { $setOnInsert: { lockedBy: context.userId } },
        { upsert: true }
      );
      return true;
    },

    unlockMonth: async (_, { year, month }, context) => {
      requireOwner(context);
      await MonthLock.deleteOne({ orgId: context.orgId, year, month });
      return true;
    },

    stopRecurring: async (_, { id }, context) => {
      const row = await RecurringSchedule.findOne({ _id: id, orgId: context.orgId, active: true });
      if (!row) return false;
      await assertWrite(context, row.kind === 'income' ? 'income' : 'expenses', row.companyId);
      row.active = false;
      await row.save();
      return true;
    },
  },
};

export default featureResolvers;
