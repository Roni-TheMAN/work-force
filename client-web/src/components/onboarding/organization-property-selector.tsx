import { useMemo, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { ArrowLeft, ArrowRight, Building2, Plus } from "lucide-react";
import { Link } from "react-router-dom";

import type { Organization } from "@/data/onboarding";
import { OrganizationCard } from "@/components/onboarding/organization-card";
import { PropertyCreationForm } from "@/components/onboarding/property-creation-form";
import { PropertyCard } from "@/components/onboarding/property-card";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";

type OrganizationPropertySelectorProps = {
  organizations: Organization[];
  onContinue?: (selection: { organizationId: string; propertyId: string }) => void;
};

export function OrganizationPropertySelector({
  organizations,
  onContinue,
}: OrganizationPropertySelectorProps) {
  const shouldReduceMotion = useReducedMotion();
  const [selectedOrganizationId, setSelectedOrganizationId] = useState<string | null>(null);
  const [selectedPropertyId, setSelectedPropertyId] = useState<string | null>(null);
  const [isCreatingProperty, setIsCreatingProperty] = useState(false);

  const selectedOrganization = useMemo(
    () => organizations.find((organization) => organization.id === selectedOrganizationId) ?? null,
    [organizations, selectedOrganizationId],
  );
  const selectedProperty = selectedOrganization?.properties.find((property) => property.id === selectedPropertyId) ?? null;

  const handleOrganizationSelect = (organizationId: string) => {
    setSelectedOrganizationId(organizationId);
    setSelectedPropertyId(null);
    setIsCreatingProperty(false);
  };

  const handleBack = () => {
    setSelectedOrganizationId(null);
    setSelectedPropertyId(null);
    setIsCreatingProperty(false);
  };

  const handleContinue = () => {
    if (!selectedOrganization || !selectedProperty) {
      return;
    }

    onContinue?.({
      organizationId: selectedOrganization.id,
      propertyId: selectedProperty.id,
    });
  };

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
      <Card className={cn("min-h-[560px]", selectedOrganization ? "hidden lg:flex" : "flex")}>
        <CardHeader className="space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="space-y-1">
              <CardTitle>Select an organization</CardTitle>
              <CardDescription>Choose the tenant you want to enter before selecting the property workspace.</CardDescription>
            </div>
            <Link to="/onboarding/create-organization" className={cn(buttonVariants({ variant: "outline", size: "sm" }), "shrink-0")}>
              <Plus className="size-4" />
              Create organization
            </Link>
          </div>
          <Separator />
        </CardHeader>
        <CardContent className="flex-1">
          <ScrollArea className="h-[420px] pr-4">
            <div className="space-y-3">
              {organizations.map((organization) => (
                <OrganizationCard
                  key={organization.id}
                  organization={organization}
                  selected={organization.id === selectedOrganizationId}
                  onSelect={handleOrganizationSelect}
                />
              ))}
            </div>
          </ScrollArea>
        </CardContent>
        <CardFooter className="justify-between gap-4">
          <p className="text-sm text-muted-foreground">Need a new workspace first? Start with organization creation.</p>
          <Link to="/onboarding/create-organization" className={cn(buttonVariants({ variant: "secondary" }))}>
            New organization
          </Link>
        </CardFooter>
      </Card>

      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={selectedOrganization?.id ?? "empty-state"}
          initial={{ opacity: 0, x: shouldReduceMotion ? 0 : 10 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: shouldReduceMotion ? 0 : -10 }}
          transition={{ duration: 0.2, ease: "easeOut" }}
          className={cn(selectedOrganization ? "block" : "hidden lg:block")}
        >
          {selectedOrganization ? (
            <Card className="min-h-[560px]">
              <CardHeader className="space-y-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <Button type="button" variant="ghost" size="sm" onClick={handleBack} className="w-fit">
                    <ArrowLeft className="size-4" />
                    Back
                  </Button>
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary">{selectedOrganization.role}</Badge>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setIsCreatingProperty((previous) => !previous)}
                    >
                      <Plus className="size-4" />
                      {isCreatingProperty ? "Hide form" : "Add property"}
                    </Button>
                  </div>
                </div>
                <div className="space-y-2">
                  <CardTitle className="text-xl">{selectedOrganization.name}</CardTitle>
                  <CardDescription>
                    Choose the property where this user should land after authentication, or add a new one directly here.
                  </CardDescription>
                </div>
                <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
                  <span>{selectedOrganization.properties.length} properties</span>
                  <span>{selectedOrganization.status}</span>
                  <span>{selectedOrganization.timezone}</span>
                </div>
                <Separator />
              </CardHeader>
              <CardContent className="flex-1 space-y-4">
                {isCreatingProperty ? (
                  <PropertyCreationForm
                    organizationId={selectedOrganization.id}
                    defaultTimezone={selectedOrganization.timezone}
                    onCancel={() => setIsCreatingProperty(false)}
                    onCreated={(property) => {
                      setSelectedPropertyId(property.id);
                      setIsCreatingProperty(false);
                    }}
                  />
                ) : null}
                <ScrollArea className="h-[360px] pr-4">
                  <div className="space-y-3">
                    {selectedOrganization.properties.length > 0 ? (
                      selectedOrganization.properties.map((property) => (
                        <PropertyCard
                          key={property.id}
                          property={property}
                          selected={property.id === selectedPropertyId}
                          onSelect={setSelectedPropertyId}
                        />
                      ))
                    ) : (
                      <Card size="sm" className="border-dashed">
                        <CardContent className="space-y-2 py-8 text-center">
                          <p className="font-medium text-foreground">No properties yet</p>
                          <p className="text-sm text-muted-foreground">
                            Add the first operational location for this organization before continuing.
                          </p>
                          <div>
                            <Button type="button" variant="secondary" onClick={() => setIsCreatingProperty(true)}>
                              <Plus className="size-4" />
                              Add property
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    )}
                  </div>
                </ScrollArea>
              </CardContent>
              <CardFooter className="justify-between gap-4">
                <div className="space-y-1">
                  <p className="text-sm font-medium text-foreground">
                    {selectedProperty ? `${selectedProperty.name} selected` : "Choose a property to continue"}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Property records now come from the backend and stay scoped to the selected organization.
                  </p>
                </div>
                <Button type="button" onClick={handleContinue} disabled={!selectedProperty}>
                  Continue
                  <ArrowRight className="size-4" />
                </Button>
              </CardFooter>
            </Card>
          ) : (
            <Card className="min-h-[560px] justify-center">
              <CardContent className="flex h-full flex-col items-center justify-center gap-4 text-center">
                <div className="flex size-14 items-center justify-center rounded-2xl border border-border bg-muted/60">
                  <Building2 className="size-6 text-foreground" />
                </div>
                <div className="space-y-2">
                  <p className="text-lg font-semibold text-foreground">Property selection appears here</p>
                  <p className="max-w-md text-sm text-muted-foreground">
                    Start with an organization on the left. The property panel will transition in without leaving this screen.
                  </p>
                </div>
                <Link to="/onboarding/create-organization" className={cn(buttonVariants({ variant: "outline" }))}>
                  Create organization
                </Link>
              </CardContent>
            </Card>
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
