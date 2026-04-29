import 'server-only';
import { auth } from '@/lib/auth';

export const ADMIN_EMAIL = 'atishay07jain@gmail.com';

export function isAdminEmail(email) {
  return typeof email === 'string'
    && email.trim().toLowerCase() === ADMIN_EMAIL;
}

export function isAdmin(user) {
  if (!user) return false;
  return (
    isAdminEmail(user.email) ||
    user?.role === 'admin'
  );
}

/**
 * If passed a user, return that user when they are admin, otherwise null.
 * If called without args, keep the existing async route-guard shape used by
 * API handlers. Both paths are non-throwing for authorization failures.
 */
export function requireAdmin(user) {
  if (arguments.length > 0) {
    return isAdmin(user) ? user : null;
  }

  return requireAdminSession();
}

export async function requireAdminSession() {
  const session = await auth();
  if (!session?.user) return { ok: false, status: 401, reason: 'unauthenticated' };

  const user = session.user;
  if (!isAdmin(user)) return { ok: false, status: 404, reason: 'not_admin' };

  return { ok: true, session };
}

export async function requireCreator() {
  const session = await auth();
  if (!session?.user) return { ok: false, status: 401, reason: 'unauthenticated' };
  if ((session.user?.role ?? 'student') !== 'creator') {
    return { ok: false, status: 404, reason: 'not_creator' };
  }
  return { ok: true, session };
}

export async function requireUser() {
  const session = await auth();
  if (!session?.user) return { ok: false, status: 401, reason: 'unauthenticated' };
  return { ok: true, session };
}
