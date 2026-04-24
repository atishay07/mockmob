"use client";

import React, { createContext, useContext, useMemo } from 'react';
import { useAuth } from '@/components/AuthProvider';

const RoleContext = createContext(null);

export function RoleProvider({ children }) {
  const { user } = useAuth();
  const role = user?.role === 'moderator' ? 'moderator' : 'student';

  const value = useMemo(() => ({
    role,
    setRole: () => {},
    isModerator: role === 'moderator',
  }), [role]);

  return (
    <RoleContext.Provider value={value}>{children}</RoleContext.Provider>
  );
}

export function useRole() {
  const ctx = useContext(RoleContext);
  if (!ctx) throw new Error('useRole must be inside <RoleProvider>');
  return ctx;
}
