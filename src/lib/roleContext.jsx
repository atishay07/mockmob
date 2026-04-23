"use client";

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';

const STORAGE_KEY = 'mm_role';
const VALID_ROLES = ['student', 'moderator'];

const RoleContext = createContext(null);

export function RoleProvider({ children }) {
  const [role, setRoleState] = useState('student');
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored && VALID_ROLES.includes(stored)) setRoleState(stored);
    } catch {}
    setLoaded(true);
  }, []);

  const setRole = useCallback((r) => {
    if (!VALID_ROLES.includes(r)) return;
    setRoleState(r);
    try { localStorage.setItem(STORAGE_KEY, r); } catch {}
  }, []);

  if (!loaded) return null; // avoid SSR flash

  return (
    <RoleContext.Provider value={{ role, setRole, isModerator: role === 'moderator' }}>
      {children}
    </RoleContext.Provider>
  );
}

export function useRole() {
  const ctx = useContext(RoleContext);
  if (!ctx) throw new Error('useRole must be inside <RoleProvider>');
  return ctx;
}
