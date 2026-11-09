import { GraphQLError } from 'graphql';
import { User, Organization, Company, Expense, Income, ChatSession, ActivityLog } from '../../models/index.js';
import { requireAuth } from '../../middleware/auth.js';
import { signToken, comparePassword } from '../../services/authService.js';
import { logActivity } from '../../services/activityService.js';
import { apiMetrics } from '../../services/apiMetricsService.js';

const checkAdminAuth = (context) => {
  requireAuth(context);
  const role = (context.role || '').toLowerCase();
  const isSuper = context.user?.isSuperAdmin === true || role === 'superadmin';
  if (!isSuper) {
    throw new GraphQLError('Access denied. Administrator privileges required.', {
      extensions: { code: 'FORBIDDEN', http: { status: 403 } },
    });
  }
};

export const adminResolvers = {
  Query: {
    adminDashboard: async (_, { search = '', role = '' }, context) => {
      checkAdminAuth(context);

      // 1. Compute Global / Platform Overview Statistics
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

      const [
        totalUsers,
        totalOrganizations,
        totalCompanies,
        totalIncomeCount,
        totalExpenseCount,
        activityLogCount,
        allChatSessions,
        activeUsersCount,
      ] = await Promise.all([
        User.countDocuments({ role: { $ne: 'superadmin' } }),
        Organization.countDocuments({ slug: { $ne: 'vault-master-admin' } }),
        Company.countDocuments({}),
        Income.countDocuments({ isDeleted: { $ne: true } }),
        Expense.countDocuments({ isDeleted: { $ne: true } }),
        ActivityLog.countDocuments({}),
        ChatSession.find({}).select('userId messages updatedAt'),
        User.countDocuments({
          role: { $ne: 'superadmin' },
          $or: [
            { lastLogin: { $gte: sevenDaysAgo } },
            { updatedAt: { $gte: sevenDaysAgo } },
          ],
        }),
      ]);

      let totalChatMessages = 0;
      const userChatCountMap = new Map();
      const userChatSessionsMap = new Map();
      const userLastChatMap = new Map();

      for (const sess of allChatSessions) {
        const uId = sess.userId?.toString();
        const msgCount = sess.messages?.length || 0;
        totalChatMessages += msgCount;

        if (uId) {
          userChatCountMap.set(uId, (userChatCountMap.get(uId) || 0) + msgCount);
          userChatSessionsMap.set(uId, (userChatSessionsMap.get(uId) || 0) + 1);

          const existingLast = userLastChatMap.get(uId);
          const sessDate = sess.updatedAt ? new Date(sess.updatedAt) : null;
          if (sessDate && (!existingLast || sessDate > new Date(existingLast))) {
            userLastChatMap.set(uId, sessDate.toISOString());
          }
        }
      }

      const totalInteractions = Math.max(
        activityLogCount,
        totalIncomeCount + totalExpenseCount + totalUsers + totalChatMessages
      );

      // 2. Build User Query Filter (filter out internal superadmin from customer list)
      const userFilter = { role: { $ne: 'superadmin' } };
      if (role && role !== 'all') {
        userFilter.role = role.toLowerCase();
      }
      if (search && search.trim()) {
        const queryRegex = new RegExp(search.trim(), 'i');
        const matchedCompanies = await Company.find({ name: queryRegex }).select('orgId');
        const matchedOrgIds = matchedCompanies.map((c) => c.orgId);
        userFilter.$or = [
          { name: queryRegex },
          { email: queryRegex },
          ...(matchedOrgIds.length > 0 ? [{ orgId: { $in: matchedOrgIds } }] : []),
        ];
      }

      const usersList = await User.find(userFilter).sort({ createdAt: -1 });

      // Preload Organizations and Companies in bulk
      const orgIds = [...new Set(usersList.map((u) => u.orgId?.toString()).filter(Boolean))];
      const [allOrgs, allCompanies] = await Promise.all([
        Organization.find({ _id: { $in: orgIds } }).select('_id name'),
        Company.find({ orgId: { $in: orgIds } }),
      ]);

      const orgMap = new Map(allOrgs.map((o) => [o._id.toString(), o.name]));
      const compByOrg = new Map();
      for (const comp of allCompanies) {
        const oId = comp.orgId.toString();
        if (!compByOrg.has(oId)) compByOrg.set(oId, []);
        compByOrg.get(oId).push(comp);
      }

      // Precompute expense & income counts per company (COUNTS ONLY - PRIVACY SAFE)
      const [expenseCountsByComp, incomeCountsByComp] = await Promise.all([
        Expense.aggregate([
          { $match: { isDeleted: { $ne: true } } },
          { $group: { _id: '$companyId', count: { $sum: 1 } } },
        ]),
        Income.aggregate([
          { $match: { isDeleted: { $ne: true } } },
          { $group: { _id: '$companyId', count: { $sum: 1 } } },
        ]),
      ]);

      const compExpenseMap = new Map(
        expenseCountsByComp.map((e) => [e._id?.toString(), e.count])
      );
      const compIncomeMap = new Map(
        incomeCountsByComp.map((i) => [i._id?.toString(), i.count])
      );

      // Precompute expense & income counts per user (COUNTS ONLY)
      const [expenseCountsByUser, incomeCountsByUser] = await Promise.all([
        Expense.aggregate([
          { $match: { isDeleted: { $ne: true } } },
          { $group: { _id: '$createdBy', count: { $sum: 1 } } },
        ]),
        Income.aggregate([
          { $match: { isDeleted: { $ne: true } } },
          { $group: { _id: '$createdBy', count: { $sum: 1 } } },
        ]),
      ]);

      const userExpenseMap = new Map(
        expenseCountsByUser.map((e) => [e._id?.toString(), e.count])
      );
      const userIncomeMap = new Map(
        incomeCountsByUser.map((i) => [i._id?.toString(), i.count])
      );

      // Format customer users with privacy-preserving numbers
      const formattedUsers = usersList.map((u) => {
        const oId = u.orgId?.toString();
        const orgName = orgMap.get(oId) || 'Main Workspace';
        const companiesForUser = compByOrg.get(oId) || [];

        const userCompanies = companiesForUser.map((comp) => {
          const cId = comp._id.toString();
          return {
            id: cId,
            name: comp.name,
            isActive: !!comp.isActive,
            isCoreBranch: !!comp.isCoreBranch,
            expenseCount: compExpenseMap.get(cId) || 0,
            incomeCount: compIncomeMap.get(cId) || 0,
            createdAt: comp.createdAt ? comp.createdAt.toISOString() : new Date().toISOString(),
          };
        });

        const userIdStr = u._id.toString();
        const userExpenses = userExpenseMap.get(userIdStr) || 0;
        const userIncomes = userIncomeMap.get(userIdStr) || 0;
        const chatInteractions = userChatCountMap.get(userIdStr) || 0;
        const totalTransactions = userExpenses + userIncomes;

        // Interaction score: login + expenses added + incomes logged + AI chats
        const totalUserInteractions =
          (u.lastLogin ? 1 : 0) + userExpenses + userIncomes + chatInteractions;

        // Last active determination
        let lastActiveAt = u.lastLogin ? u.lastLogin.toISOString() : u.createdAt.toISOString();

        return {
          id: userIdStr,
          name: u.name,
          email: u.email,
          role: u.role || 'member',
          authProvider: u.authProvider || 'local',
          avatarUrl: u.avatarUrl || null,
          isEmailVerified: !!u.isEmailVerified,
          lastLogin: u.lastLogin ? u.lastLogin.toISOString() : null,
          createdAt: u.createdAt ? u.createdAt.toISOString() : new Date().toISOString(),
          orgId: oId || '',
          orgName,
          companies: userCompanies,
          companyCount: userCompanies.length,
          expenseCount: userExpenses,
          incomeCount: userIncomes,
          totalTransactionsCount: totalTransactions,
          chatInteractionsCount: chatInteractions,
          interactionCount: totalUserInteractions,
          lastActiveAt,
        };
      });

      // 3. Customer Chatbot Usage Breakdown
      const chatbotUsage = usersList.map((u) => {
        const uId = u._id.toString();
        return {
          userId: uId,
          userName: u.name,
          userEmail: u.email,
          sessionCount: userChatSessionsMap.get(uId) || 0,
          totalMessagesCount: userChatCountMap.get(uId) || 0,
          lastChatAt: userLastChatMap.get(uId) || null,
        };
      });

      // 4. Recent Activities
      let recentActivities = await ActivityLog.find({})
        .sort({ createdAt: -1 })
        .limit(40);

      const formattedActivities = recentActivities.map((log) => ({
        id: log._id.toString(),
        userId: log.userId ? log.userId.toString() : null,
        userName: log.userName || 'Customer User',
        userEmail: log.userEmail || '',
        action: log.action,
        entityType: log.entityType || '',
        description: log.description,
        companyName: log.companyName || '',
        createdAt: log.createdAt ? log.createdAt.toISOString() : new Date().toISOString(),
      }));

      // 5. API Metrics
      const apiMetricsData = await apiMetrics.getMetrics();

      return {
        stats: {
          totalUsers,
          totalOrganizations,
          totalCompanies,
          totalIncomeCount,
          totalExpenseCount,
          totalInteractions,
          totalChatMessages,
          activeUsersCount,
        },
        users: formattedUsers,
        recentActivities: formattedActivities,
        apiMetrics: apiMetricsData,
        chatbotUsage,
      };
    },

    adminApiMetrics: async (_, __, context) => {
      checkAdminAuth(context);
      return await apiMetrics.getMetrics();
    },

    adminChatbotUsage: async (_, __, context) => {
      checkAdminAuth(context);
      const chatSessions = await ChatSession.find({}).populate('userId', 'name email');
      const userMap = new Map();

      for (const sess of chatSessions) {
        const user = sess.userId;
        if (!user) continue;
        const uId = user._id ? user._id.toString() : user.toString();
        const existing = userMap.get(uId) || {
          userId: uId,
          userName: user.name || 'User',
          userEmail: user.email || '',
          sessionCount: 0,
          totalMessagesCount: 0,
          lastChatAt: null,
        };

        existing.sessionCount++;
        existing.totalMessagesCount += sess.messages?.length || 0;
        if (!existing.lastChatAt || (sess.updatedAt && new Date(sess.updatedAt) > new Date(existing.lastChatAt))) {
          existing.lastChatAt = sess.updatedAt ? sess.updatedAt.toISOString() : null;
        }

        userMap.set(uId, existing);
      }

      return Array.from(userMap.values()).sort(
        (a, b) => b.totalMessagesCount - a.totalMessagesCount
      );
    },

    adminActivityLogs: async (_, { limit = 50 }, context) => {
      checkAdminAuth(context);
      const logs = await ActivityLog.find({})
        .sort({ createdAt: -1 })
        .limit(Math.min(limit, 100));

      return logs.map((log) => ({
        id: log._id.toString(),
        userId: log.userId ? log.userId.toString() : null,
        userName: log.userName || 'Customer User',
        userEmail: log.userEmail || '',
        action: log.action,
        entityType: log.entityType || '',
        description: log.description,
        companyName: log.companyName || '',
        createdAt: log.createdAt ? log.createdAt.toISOString() : new Date().toISOString(),
      }));
    },
  },

  Mutation: {
    adminLogin: async (_, { email, password }) => {
      if (!email || !password) {
        throw new GraphQLError('Email and password are required.', {
          extensions: { code: 'BAD_USER_INPUT' },
        });
      }

      const normalizedEmail = email.toLowerCase().trim();
      const adminUser = await User.findOne({ email: normalizedEmail, role: 'superadmin' });
      const isMatch = adminUser ? await comparePassword(password, adminUser.passwordHash) : false;

      if (!adminUser || !isMatch) {
        throw new GraphQLError('Invalid Super Admin credentials. Access denied.', {
          extensions: { code: 'INVALID_CREDENTIALS', http: { status: 401 } },
        });
      }

      adminUser.lastLogin = new Date();
      await adminUser.save();

      const token = signToken({
        userId: adminUser._id.toString(),
        orgId: adminUser.orgId?.toString() || '',
        role: 'superadmin',
        isSuperAdmin: true,
      });

      logActivity({
        orgId: adminUser.orgId,
        userId: adminUser._id,
        userName: adminUser.name,
        userEmail: adminUser.email,
        action: 'USER_LOGIN',
        entityType: 'User',
        description: `Super admin ${adminUser.name} signed in to the administration portal`,
      });

      return {
        token,
        admin: adminUser,
        message: 'Super Admin Portal authenticated successfully.',
      };
    },

    updateUserRole: async (_, { userId, role }, context) => {
      checkAdminAuth(context);

      const validRoles = ['owner', 'admin', 'member'];
      const normalizedRole = (role || '').toLowerCase();
      if (!validRoles.includes(normalizedRole)) {
        throw new GraphQLError(`Invalid role. Allowed roles: ${validRoles.join(', ')}`, {
          extensions: { code: 'BAD_USER_INPUT' },
        });
      }

      const user = await User.findByIdAndUpdate(
        userId,
        { $set: { role: normalizedRole } },
        { new: true }
      );

      if (!user) {
        throw new GraphQLError('User not found', {
          extensions: { code: 'NOT_FOUND', http: { status: 404 } },
        });
      }

      logActivity({
        orgId: user.orgId,
        userId: context.userId,
        action: 'UPDATE_USER_ROLE',
        entityType: 'User',
        entityId: user._id,
        description: `Super Admin updated role of user "${user.name}" to ${normalizedRole}`,
      });

      return user;
    },
  },
};

export default adminResolvers;
