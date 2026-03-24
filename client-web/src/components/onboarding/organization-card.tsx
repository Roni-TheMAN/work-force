import { Clock3, Hotel, MapPinned } from "lucide-react";
import { motion, useReducedMotion } from "framer-motion";

import type { Organization } from "@/data/onboarding";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

type OrganizationCardProps = {
  organization: Organization;
  selected: boolean;
  onSelect: (organizationId: string) => void;
};

export function OrganizationCard({ organization, selected, onSelect }: OrganizationCardProps) {
  const shouldReduceMotion = useReducedMotion();
  const primaryPropertyLocation =
    organization.properties
      .map((property) => [property.city, property.stateRegion].filter(Boolean).join(", "))
      .find((location) => location.length > 0) ?? "No properties yet";

  return (
    <motion.button
      type="button"
      aria-pressed={selected}
      className="w-full text-left"
      whileHover={shouldReduceMotion ? undefined : { y: -1, scale: 1.01 }}
      transition={{ duration: 0.16, ease: "easeOut" }}
      onClick={() => onSelect(organization.id)}
    >
      <Card
        size="sm"
        className={cn(
          "h-full transition-colors duration-150",
          selected ? "border-primary/40 bg-primary/5" : "hover:bg-muted/50",
        )}
      >
        <CardContent className="space-y-4">
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-1">
              <p className="text-base font-semibold text-foreground">{organization.name}</p>
              <p className="text-sm text-muted-foreground">Access is scoped by organization first, then property.</p>
            </div>
            <Badge variant={selected ? "default" : "secondary"}>{organization.role}</Badge>
          </div>
          <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1.5">
              <Hotel className="size-3.5" />
              {organization.properties.length} properties
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Clock3 className="size-3.5" />
              {organization.status}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <MapPinned className="size-3.5" />
              {primaryPropertyLocation}
            </span>
          </div>
        </CardContent>
      </Card>
    </motion.button>
  );
}
