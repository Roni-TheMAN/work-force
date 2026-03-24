import { useCallback } from "react";
import { ArrowLeft } from "lucide-react";
import { EmbeddedCheckout, EmbeddedCheckoutProvider } from "@stripe/react-stripe-js";
import { loadStripe } from "@stripe/stripe-js";
import { Link, Navigate, useSearchParams } from "react-router-dom";

import { AppScreen } from "@/components/layout/app-screen";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { organizationPlans, type PlanId } from "@/data/onboarding";
import { createCheckoutSession, type PaidPlanId } from "@/lib/api";
import { env } from "@/lib/env";
import { cn } from "@/lib/utils";

function isPlanId(value: string | null): value is PlanId {
  return value === "free" || value === "pro" || value === "enterprise";
}

const stripePromise = env.stripePublishableKey ? loadStripe(env.stripePublishableKey) : null;

export function BillingPage() {
  const [searchParams] = useSearchParams();
  const planId = isPlanId(searchParams.get("plan")) ? searchParams.get("plan") : "pro";

  if (planId === "free") {
    return <Navigate to="/quick-dash" replace />;
  }

  const selectedPlan = organizationPlans.find((plan) => plan.id === planId) ?? organizationPlans[1];
  const fetchClientSecret = useCallback(() => createCheckoutSession(planId as PaidPlanId).then((data) => data.clientSecret), [planId]);

  return (
    <AppScreen
      title="Billing"
      description="Complete Stripe checkout for the selected paid plan. The return URL lands on the quick dash."
      actions={
        <Link to="/onboarding/create-organization" className={cn(buttonVariants({ variant: "ghost" }))}>
          <ArrowLeft className="size-4" />
          Back to setup
        </Link>
      }
      contentClassName="flex items-start"
    >
      <Card className="w-full">
        <CardHeader className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="space-y-1">
              <CardTitle>Billing setup for {selectedPlan.name}</CardTitle>
              <CardDescription>Paid plans stop here until payment is connected.</CardDescription>
            </div>
            <Badge variant="secondary">{selectedPlan.price}</Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <p className="max-w-2xl text-sm text-muted-foreground">
            The backend creates an authenticated embedded checkout session for {selectedPlan.name}. When Stripe finishes,
            it returns to the quick dash.
          </p>
          {!stripePromise ? (
            <div className="rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
              Missing `VITE_STRIPE_PUBLISHABLE_KEY` in the client-web environment.
            </div>
          ) : (
            <div className="overflow-hidden rounded-2xl border border-border bg-background">
              <EmbeddedCheckoutProvider stripe={stripePromise} options={{ fetchClientSecret }}>
                <EmbeddedCheckout />
              </EmbeddedCheckoutProvider>
            </div>
          )}
        </CardContent>
      </Card>
    </AppScreen>
  );
}
