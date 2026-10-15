"use client";

import { AuthProvider } from "@/components/AuthProvider";
import { ToastProvider } from "@/components/ToastProvider";
import { RoleProvider } from "@/lib/roleContext";
import ArenaEntry from "@/components/arena/ArenaEntry";

export function Providers({ children }) {
  return (
    <AuthProvider>
      <ToastProvider>
        <RoleProvider>
          <ArenaEntry />
          {children}
        </RoleProvider>
      </ToastProvider>
    </AuthProvider>
  );
}
