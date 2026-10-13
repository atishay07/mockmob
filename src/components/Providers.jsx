"use client";

import { AuthProvider } from "@/components/AuthProvider";
import { ToastProvider } from "@/components/ToastProvider";
import { RoleProvider } from "@/lib/roleContext";
import VisitorSync from "@/components/VisitorSync";

export function Providers({ children }) {
  return (
    <AuthProvider>
      <VisitorSync />
      <ToastProvider>
        <RoleProvider>{children}</RoleProvider>
      </ToastProvider>
    </AuthProvider>
  );
}
