"use client";

import { AuthProvider } from "@/components/AuthProvider";
import { ToastProvider } from "@/components/ToastProvider";
import { RoleProvider } from "@/lib/roleContext";

export function Providers({ children }) {
  return (
    <AuthProvider>
      <ToastProvider>
        <RoleProvider>{children}</RoleProvider>
      </ToastProvider>
    </AuthProvider>
  );
}
