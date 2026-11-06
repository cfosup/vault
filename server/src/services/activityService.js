import { ActivityLog, User } from '../models/index.js';

/**
 * Asynchronously log a user or system activity.
 * Safe and non-blocking: catches errors internally so main mutation flows never fail.
 */
export const logActivity = async ({
  orgId = null,
  userId = null,
  userName = '',
  userEmail = '',
  action,
  entityType = '',
  entityId = null,
  companyId = null,
  companyName = '',
  description,
  metadata = {},
}) => {
  try {
    if (!action || !description) return null;

    let resolvedName = userName;
    let resolvedEmail = userEmail;

    // Retrieve user details if missing and userId is present
    if (userId && (!resolvedName || !resolvedEmail)) {
      try {
        const u = await User.findById(userId).select('name email');
        if (u) {
          resolvedName = resolvedName || u.name;
          resolvedEmail = resolvedEmail || u.email;
        }
      } catch {
        // Silently continue if user fetch fails
      }
    }

    const logEntry = await ActivityLog.create({
      orgId,
      userId,
      userName: resolvedName || 'System User',
      userEmail: resolvedEmail || '',
      action,
      entityType,
      entityId,
      companyId,
      companyName,
      description,
      metadata,
    });

    return logEntry;
  } catch (error) {
    console.error('[ActivityLog Error] Failed to persist activity:', error.message);
    return null;
  }
};

export default {
  logActivity,
};

