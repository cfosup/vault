export function canWriteModule(user, moduleName) {
  if (!user) return false;
  const role = user.role || 'owner';
  if (role === 'owner' || role === 'superadmin') return true;
  if (role === 'admin' && !user.accessScope) return true;
  if (!user.accessScope) return false;
  if (user.accessScope === 'workspace') return true;
  return (user.modules || []).includes(moduleName);
}

export function canDeleteKind(user, moduleName) {
  if (!user) return false;
  const role = user.role || 'owner';
  if (role === 'owner' || role === 'superadmin') return true;
  if (role === 'admin' && !user.accessScope) return true;
  if (moduleName === 'expenses') return !!user.canDeleteExpenses && canWriteModule(user, 'expenses');
  return !!user.canDeleteIncome && canWriteModule(user, 'income');
}

export function canSee(user, area) {
  if (!user) return false;
  const role = user.role || 'owner';
  if (area === 'settings') return true;
  if (role === 'owner' || role === 'superadmin') return true;
  if (!user.accessScope || user.accessScope === 'workspace') return true;
  if (area === 'expenses' || area === 'income') return (user.modules || []).includes(area);
  return false;
}

export function isOwner(user) {
  const role = user?.role || 'owner';
  return role === 'owner' || role === 'superadmin';
}
