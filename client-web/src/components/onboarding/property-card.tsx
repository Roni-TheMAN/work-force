import { Building2, Clock3, MapPin } from "lucide-react";
import { motion, useReducedMotion } from "framer-motion";

import type { Property } from "@/data/onboarding";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

type PropertyCardProps = {
  property: Property;
  selected: boolean;
  onSelect: (propertyId: string) => void;
};

export function PropertyCard({ property, selected, onSelect }: PropertyCardProps) {
  const shouldReduceMotion = useReducedMotion();
  const addressSummary =
    [property.city, property.stateRegion, property.countryCode].filter(Boolean).join(", ") ||
    property.addressLine1 ||
    "Address not set";

  return (
    <motion.button
      type="button"
      aria-pressed={selected}
      className="w-full text-left"
      whileHover={shouldReduceMotion ? undefined : { y: -1, scale: 1.01 }}
      transition={{ duration: 0.16, ease: "easeOut" }}
      onClick={() => onSelect(property.id)}
    >
      <Card
        size="sm"
        className={cn(
          "h-full transition-colors duration-150",
          selected ? "border-primary/40 bg-primary/5" : "hover:bg-muted/50",
        )}
      >
        <CardContent className="space-y-4">
          <div className="space-y-1">
            <p className="text-base font-semibold text-foreground">{property.name}</p>
            <p className="text-sm text-muted-foreground">
              {property.code ? `Code ${property.code}` : "No property code yet"}
            </p>
          </div>
          <div className="grid gap-2 text-xs text-muted-foreground sm:grid-cols-3">
            <span className="inline-flex items-center gap-1.5">
              <Building2 className="size-3.5" />
              {property.status}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <MapPin className="size-3.5" />
              {addressSummary}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Clock3 className="size-3.5" />
              {property.timezone}
            </span>
          </div>
        </CardContent>
      </Card>
    </motion.button>
  );
}
