"use client";

import { SessionProvider } from "next-auth/react";
import { AuthProvider } from "@/components/AuthProvider";
import { RoleProvider } from "@/lib/roleContext";

export function Providers({ children }) {
  return (
    <SessionProvider>
      <AuthProvider>
        <RoleProvider>{children}</RoleProvider>
      </AuthProvider>
    </SessionProvider>
  );
}
