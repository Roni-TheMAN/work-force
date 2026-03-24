import { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { useNavigate } from "react-router-dom";

import {
  organizationPlans,
  timezoneOptions,
  type PlanId,
} from "@/data/onboarding";
import { PlanCarousel } from "@/components/onboarding/plan-carousel";
import { StepHeader } from "@/components/onboarding/step-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createOrganization } from "@/lib/api";
import { clientOrganizationsQueryKeyBase } from "@/lib/query-keys";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

type OrganizationCreationState = {
  legalName: string;
  name: string;
  planId: PlanId;
  slug: string;
  timezone: string;
};

type OrganizationCreationFlowProps = {
  onComplete?: (state: OrganizationCreationState) => void;
};

const initialState: OrganizationCreationState = {
  legalName: "",
  name: "",
  planId: "pro",
  slug: "",
  timezone: "",
};

function slugify(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function OrganizationCreationFlow({ onComplete }: OrganizationCreationFlowProps) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const shouldReduceMotion = useReducedMotion();
  const [currentStep, setCurrentStep] = useState(1);
  const [state, setState] = useState<OrganizationCreationState>(initialState);
  const [hasEditedSlug, setHasEditedSlug] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const isFreePlan = state.planId === "free";
  const finalStepLabel = isFreePlan ? "Finished" : "Billing";
  const creationSteps = useMemo(
    () => ["Organization details", "Plan selection", finalStepLabel],
    [finalStepLabel],
  );

  const stepMeta = useMemo(
    () => ({
      1: {
        title: "Tell us about the organization",
        description: "Use the organization schema fields directly so the tenant root can be created cleanly before billing or quick-dash access.",
      },
      2: {
        title: "Select a plan",
        description: "The organization is created before branching. Free continues to the quick dash and paid plans continue to billing.",
      },
    }),
    [],
  );

  const isCurrentStepValid = useMemo(() => {
    if (currentStep === 1) {
      return Boolean(state.name.trim() && state.slug.trim() && state.timezone);
    }

    if (currentStep === 2) {
      return Boolean(state.planId);
    }

    return false;
  }, [currentStep, state]);

  const updateState = <Key extends keyof OrganizationCreationState>(key: Key, value: OrganizationCreationState[Key]) => {
    setState((previous) => ({
      ...previous,
      [key]: value,
    }));
  };

  const handleNameChange = (value: string) => {
    updateState("name", value);

    if (!hasEditedSlug) {
      updateState("slug", slugify(value));
    }
  };

  const handleSlugChange = (value: string) => {
    setHasEditedSlug(true);
    updateState("slug", slugify(value));
  };

  const handleNext = async () => {
    setErrorMessage(null);

    if (currentStep === 1) {
      setCurrentStep(2);
      return;
    }

    if (currentStep === 2) {
      setIsSubmitting(true);

      try {
        const organization = await createOrganization({
          name: state.name.trim(),
          slug: state.slug.trim(),
          legalName: state.legalName.trim() || null,
          timezone: state.timezone,
          planId: state.planId,
        });

        await queryClient.invalidateQueries({ queryKey: clientOrganizationsQueryKeyBase });
        onComplete?.(state);
        navigate(
          isFreePlan
            ? `/quick-dash?organization=${organization.id}`
            : `/onboarding/billing?plan=${state.planId}&organization=${organization.id}`
        );
      } catch (error) {
        setErrorMessage(error instanceof Error ? error.message : "Unable to create organization.");
      } finally {
        setIsSubmitting(false);
      }

      return;
    }
  };

  const stepContent = (
    <>
      {currentStep === 1 ? (
        <div className="grid gap-5 md:grid-cols-2">
          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="organization-name">Organization name</Label>
            <Input
              id="organization-name"
              placeholder="Northstar Hospitality"
              value={state.name}
              onChange={(event) => handleNameChange(event.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="organization-slug">Organization slug</Label>
            <Input
              id="organization-slug"
              placeholder="northstar-hospitality"
              value={state.slug}
              onChange={(event) => handleSlugChange(event.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="organization-timezone">Organization timezone</Label>
            <Select value={state.timezone} onValueChange={(value) => updateState("timezone", value ?? "")}>
              <SelectTrigger id="organization-timezone" className="w-full">
                <SelectValue placeholder="Select timezone" />
              </SelectTrigger>
              <SelectContent>
                {timezoneOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="organization-legal-name">Legal name</Label>
            <Input
              id="organization-legal-name"
              placeholder="Optional legal or billing name"
              value={state.legalName}
              onChange={(event) => updateState("legalName", event.target.value)}
            />
          </div>
        </div>
      ) : null}

      {currentStep === 2 ? (
        <PlanCarousel
          plans={organizationPlans}
          selectedPlanId={state.planId}
          onSelect={(planId) => updateState("planId", planId)}
        />
      ) : null}
    </>
  );

  return (
    <Card className="overflow-visible">
      <CardContent className="space-y-8">
        <StepHeader
          currentStep={currentStep}
          totalSteps={creationSteps.length}
          title={stepMeta[currentStep as keyof typeof stepMeta].title}
          description={stepMeta[currentStep as keyof typeof stepMeta].description}
          steps={creationSteps}
        />

        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={currentStep}
            initial={{ opacity: 0, y: shouldReduceMotion ? 0 : 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: shouldReduceMotion ? 0 : -8 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className="space-y-5"
          >
            {stepContent}
          </motion.div>
        </AnimatePresence>
      </CardContent>

      <CardFooter className="justify-between gap-4">
        <div className="space-y-1 text-sm">
          <p className="font-medium text-foreground">Selected plan: {organizationPlans.find((plan) => plan.id === state.planId)?.name}</p>
          <p className="text-muted-foreground">
            {isFreePlan
              ? "The organization and owner membership are created before continuing to the quick dash."
              : "The organization and owner membership are created before continuing to billing."}
          </p>
          {errorMessage ? <p className="text-destructive">{errorMessage}</p> : null}
        </div>
        <div className="flex items-center gap-3">
          <Button
            type="button"
            variant="outline"
            onClick={() => setCurrentStep((previous) => Math.max(1, previous - 1))}
            disabled={currentStep === 1}
          >
            <ArrowLeft className="size-4" />
            Back
          </Button>
          <Button type="button" onClick={() => void handleNext()} disabled={!isCurrentStepValid || isSubmitting}>
            {currentStep === 1
              ? "Next"
              : isSubmitting
                ? "Creating organization..."
                : isFreePlan
                  ? "Go to quick dash"
                  : "Go to billing"}
            <ArrowRight className="size-4" />
          </Button>
        </div>
      </CardFooter>
    </Card>
  );
}
