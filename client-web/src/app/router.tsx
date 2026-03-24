import { Suspense, lazy } from "react";
import { AnimatePresence } from "framer-motion";
import { Navigate, Route, Routes, useLocation } from "react-router-dom";

import { BillingPage } from "@/app/onboarding/billing/page";
import { CreateOrganizationPage } from "@/app/onboarding/create-organization/page";
import { PlanSelectPage } from "@/app/onboarding/plan-select/page";
import { SignInPage } from "@/app/sign-in/page";
import { SignUpPage } from "@/app/sign-up/page";
import { GuestOnlyRoute, ProtectedRoute } from "@/components/auth/route-guards";

const QuickDashPage = lazy(() =>
  import("@/app/quick-dash/page").then((module) => ({
    default: module.QuickDashPage,
  })),
);

const DashboardPage = lazy(() =>
  import("@/app/dashboard/page").then((module) => ({
    default: module.DashboardPage,
  })),
);

export function AppRouter() {
  const location = useLocation();

  return (
    <AnimatePresence mode="wait" initial={false}>
      <Routes location={location} key={location.pathname}>
        <Route path="/" element={<Navigate to="/sign-in" replace />} />
        <Route
          path="/sign-in"
          element={
            <GuestOnlyRoute>
              <SignInPage />
            </GuestOnlyRoute>
          }
        />
        <Route
          path="/sign-up"
          element={
            <GuestOnlyRoute>
              <SignUpPage />
            </GuestOnlyRoute>
          }
        />
        <Route
          path="/quick-dash"
          element={
            <ProtectedRoute>
              <Suspense fallback={<div className="min-h-screen bg-background" />}>
                <QuickDashPage />
              </Suspense>
            </ProtectedRoute>
          }
        />
        <Route
          path="/dashboard"
          element={
            <ProtectedRoute>
              <Suspense fallback={<div className="min-h-screen bg-background" />}>
                <DashboardPage />
              </Suspense>
            </ProtectedRoute>
          }
        />
        <Route
          path="/onboarding/create-organization"
          element={
            <ProtectedRoute>
              <CreateOrganizationPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/onboarding/plan-select"
          element={
            <ProtectedRoute>
              <PlanSelectPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/onboarding/billing"
          element={
            <ProtectedRoute>
              <BillingPage />
            </ProtectedRoute>
          }
        />
      </Routes>
    </AnimatePresence>
  );
}
