import { Building2 } from "lucide-react";

import { cn } from "@/lib/utils";

type AppLogoProps = {
  compact?: boolean;
  className?: string;
};

export function AppLogo({ compact = false, className }: AppLogoProps) {
  return (
    <div className={cn("flex items-center gap-3", className)}>
      <div className="flex size-11 items-center justify-center rounded-xl bg-primary text-primary-foreground">
        <Building2 className="size-5" />
      </div>
      <div className="space-y-0.5">
        <p className="text-sm font-semibold tracking-tight text-foreground">Workforce</p>
        {!compact ? <p className="text-sm text-muted-foreground">Organization onboarding</p> : null}
      </div>
    </div>
  );
}
