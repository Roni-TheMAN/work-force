import { useEffect, useRef } from "react";
import { Check, ChevronLeft, ChevronRight } from "lucide-react";
import { motion, useReducedMotion } from "framer-motion";

import type { Plan, PlanId } from "@/data/onboarding";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

type PlanCarouselProps = {
  plans: Plan[];
  selectedPlanId: PlanId;
  onSelect: (planId: PlanId) => void;
};

type PlanChoiceCardProps = {
  plan: Plan;
  selected: boolean;
  onSelect: (planId: PlanId) => void;
  buttonRef?: (node: HTMLButtonElement | null) => void;
};

function PlanChoiceCard({ plan, selected, onSelect, buttonRef }: PlanChoiceCardProps) {
  const shouldReduceMotion = useReducedMotion();

  return (
    <motion.button
      ref={buttonRef}
      type="button"
      aria-pressed={selected}
      className="w-full text-left"
      whileHover={shouldReduceMotion ? undefined : { y: -1, scale: 1.01 }}
      transition={{ duration: 0.16, ease: "easeOut" }}
      onClick={() => onSelect(plan.id)}
    >
      <Card
        className={cn(
          "h-full min-h-[320px] transition-colors duration-150",
          selected ? "border-primary/40 bg-primary/5" : "hover:bg-muted/50",
          plan.recommended && !selected ? "border-primary/20" : undefined,
        )}
      >
        <CardContent className="flex h-full flex-col gap-5">
          <div className="space-y-4">
            <div className="flex items-start justify-between gap-3">
              <div className="space-y-1">
                <p className="text-lg font-semibold text-foreground">{plan.name}</p>
                <p className="text-sm text-muted-foreground">{plan.description}</p>
              </div>
              {plan.recommended ? <Badge className="rounded-full">Recommended</Badge> : null}
            </div>
            <div className="space-y-1">
              <p className="text-2xl font-semibold tracking-tight text-foreground">{plan.price}</p>
              <p className="text-sm text-muted-foreground">Billed monthly once your organization goes live.</p>
            </div>
          </div>

          <div className="space-y-3">
            {plan.features.map((feature) => (
              <div key={feature} className="flex items-start gap-2 text-sm text-muted-foreground">
                <Check className="mt-0.5 size-4 text-primary" />
                <span>{feature}</span>
              </div>
            ))}
          </div>

          <div
            className={cn(
              buttonVariants({ variant: selected ? "default" : "outline" }),
              "pointer-events-none mt-auto w-full justify-center",
            )}
          >
            {selected ? "Selected plan" : `Choose ${plan.name}`}
          </div>
        </CardContent>
      </Card>
    </motion.button>
  );
}

export function PlanCarousel({ plans, selectedPlanId, onSelect }: PlanCarouselProps) {
  const cardRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const selectedIndex = plans.findIndex((plan) => plan.id === selectedPlanId);

  useEffect(() => {
    cardRefs.current[selectedIndex]?.scrollIntoView({
      behavior: "smooth",
      block: "nearest",
      inline: "center",
    });
  }, [selectedIndex]);

  const handleStep = (direction: -1 | 1) => {
    const nextIndex = selectedIndex + direction;
    if (nextIndex < 0 || nextIndex >= plans.length) {
      return;
    }

    onSelect(plans[nextIndex].id);
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-4">
        <div className="space-y-1">
          <p className="text-lg font-semibold text-foreground">Choose the plan for this organization</p>
          <p className="text-sm text-muted-foreground">
            Start with a tier that fits the current rollout. You can change plans later when billing is connected.
          </p>
        </div>
        <div className="hidden items-center gap-2 sm:flex lg:hidden">
          <Button
            type="button"
            variant="outline"
            size="icon-sm"
            onClick={() => handleStep(-1)}
            disabled={selectedIndex <= 0}
            aria-label="Previous plan"
          >
            <ChevronLeft className="size-4" />
          </Button>
          <Button
            type="button"
            variant="outline"
            size="icon-sm"
            onClick={() => handleStep(1)}
            disabled={selectedIndex >= plans.length - 1}
            aria-label="Next plan"
          >
            <ChevronRight className="size-4" />
          </Button>
        </div>
      </div>

      <div className="lg:hidden">
        <ScrollArea className="w-full whitespace-nowrap">
          <div className="flex gap-4 pb-4">
            {plans.map((plan, index) => (
              <div key={plan.id} className="w-[290px] shrink-0">
                <PlanChoiceCard
                  plan={plan}
                  selected={plan.id === selectedPlanId}
                  onSelect={onSelect}
                  buttonRef={(node) => {
                    cardRefs.current[index] = node;
                  }}
                />
              </div>
            ))}
          </div>
          <ScrollBar orientation="horizontal" />
        </ScrollArea>
      </div>

      <div className="hidden gap-4 lg:grid lg:grid-cols-3">
        {plans.map((plan, index) => (
          <PlanChoiceCard
            key={plan.id}
            plan={plan}
            selected={plan.id === selectedPlanId}
            onSelect={onSelect}
            buttonRef={(node) => {
              cardRefs.current[index] = node;
            }}
          />
        ))}
      </div>
    </div>
  );
}
