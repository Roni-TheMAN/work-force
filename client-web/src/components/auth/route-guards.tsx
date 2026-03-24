import type { PropsWithChildren } from "react";
import { Navigate } from "react-router-dom";

import { useAuth } from "@/providers/auth-provider";

function AuthGateFallback() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-6 text-center">
      <p className="text-sm text-muted-foreground">Loading authentication...</p>
    </div>
  );
}

export function ProtectedRoute({ children }: PropsWithChildren) {
  const { isAuthReady, session } = useAuth();

  if (!isAuthReady) {
    return <AuthGateFallback />;
  }

  if (!session) {
    return <Navigate to="/sign-in" replace />;
  }

  return <>{children}</>;
}

export function GuestOnlyRoute({ children }: PropsWithChildren) {
  const { isAuthReady, session } = useAuth();

  if (!isAuthReady) {
    return <AuthGateFallback />;
  }

  if (session) {
    return <Navigate to="/quick-dash" replace />;
  }

  return <>{children}</>;
}
