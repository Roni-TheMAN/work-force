import { useState } from "react";
import { ArrowLeft } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";

import { AppScreen } from "@/components/layout/app-screen";
import { PlanCarousel } from "@/components/onboarding/plan-carousel";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { organizationPlans, type PlanId } from "@/data/onboarding";
import { cn } from "@/lib/utils";

export function PlanSelectPage() {
  const navigate = useNavigate();
  const [selectedPlanId, setSelectedPlanId] = useState<PlanId>("pro");
  const selectedPlan = organizationPlans.find((plan) => plan.id === selectedPlanId);
  const isFreePlan = selectedPlanId === "free";

  return (
    <AppScreen
      title="Choose a plan"
      description="This standalone route reuses the same in-app plan selector as the organization creation flow so pricing stays consistent across onboarding surfaces."
      actions={
        <Link to="/onboarding/create-organization" className={cn(buttonVariants({ variant: "ghost" }))}>
          <ArrowLeft className="size-4" />
          Back to organization setup
        </Link>
      }
    >
      <Card>
        <CardHeader className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="space-y-1">
              <CardTitle>Plan selection</CardTitle>
              <CardDescription>Keep the layout product-native and restrained. This is onboarding, not a marketing page.</CardDescription>
            </div>
            {selectedPlan ? <Badge variant="secondary">{selectedPlan.name} selected</Badge> : null}
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <PlanCarousel plans={organizationPlans} selectedPlanId={selectedPlanId} onSelect={setSelectedPlanId} />
        </CardContent>
        <CardFooter className="justify-between gap-4">
          <div className="space-y-1">
            <p className="text-sm font-medium text-foreground">{selectedPlan?.name} is active in local state</p>
            <p className="text-sm text-muted-foreground">
              {isFreePlan
                ? "Free continues straight to the quick dash."
                : "Paid plans continue to billing so Stripe can be launched there."}
            </p>
          </div>
          <Button
            type="button"
            onClick={() => navigate(isFreePlan ? "/quick-dash" : `/onboarding/billing?plan=${selectedPlanId}`)}
          >
            {isFreePlan ? "Go to quick dash" : "Go to billing"}
          </Button>
        </CardFooter>
      </Card>
    </AppScreen>
  );
}
