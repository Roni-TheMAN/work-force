import { ArrowLeft } from "lucide-react";
import { Link } from "react-router-dom";

import { AppScreen } from "@/components/layout/app-screen";
import { OrganizationCreationFlow } from "@/components/onboarding/organization-creation-flow";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function CreateOrganizationPage() {
  return (
    <AppScreen
      title="Create organization"
      description="Use a single multi-step container so organization details and plan selection stay connected before branching to quick dash or billing."
      actions={
        <Link to="/quick-dash" className={cn(buttonVariants({ variant: "ghost" }))}>
          <ArrowLeft className="size-4" />
          Back to quick dash
        </Link>
      }
      contentClassName="flex items-start"
    >
      <div className="w-full">
        <OrganizationCreationFlow onComplete={() => undefined} />
      </div>
    </AppScreen>
  );
}
