"use client";

import { AuthProvider } from "@/components/AuthProvider";
import { RoleProvider } from "@/lib/roleContext";

export function Providers({ children }) {
  return (
    <AuthProvider>
      <RoleProvider>{children}</RoleProvider>
    </AuthProvider>
  );
}
