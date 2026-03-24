import type { PropsWithChildren, ReactNode } from "react";

import { PageTransition } from "@/components/layout/page-transition";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { cn } from "@/lib/utils";

type AppScreenProps = PropsWithChildren<{
  title: string;
  description: string;
  actions?: ReactNode;
  className?: string;
  contentClassName?: string;
}>;

export function AppScreen({
  title,
  description,
  actions,
  className,
  contentClassName,
  children,
}: AppScreenProps) {
  return (
    <PageTransition className={cn("bg-background", className)}>
      <div className="mx-auto flex min-h-screen w-full max-w-7xl flex-col px-4 py-8 sm:px-6 lg:px-8 lg:py-10">
        <header className="flex flex-col gap-4 border-b border-border pb-6 sm:flex-row sm:items-end sm:justify-between">
          <div className="space-y-2">
            <h1 className="text-2xl font-semibold tracking-tight text-foreground">{title}</h1>
            <p className="max-w-2xl text-sm text-muted-foreground">{description}</p>
          </div>
          <div className="flex items-center gap-3">
            <ThemeToggle />
            {actions}
          </div>
        </header>
        <div className={cn("flex-1 py-6", contentClassName)}>{children}</div>
      </div>
    </PageTransition>
  );
}
