import type { PropsWithChildren, ReactNode } from "react";
import { ArrowRight, Building2, Layers3, ShieldCheck } from "lucide-react";
import { Link } from "react-router-dom";

import { AuthCard } from "@/components/auth/auth-card";
import { AppLogo } from "@/components/brand/app-logo";
import { PageTransition } from "@/components/layout/page-transition";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type AuthLayoutProps = PropsWithChildren<{
  title: string;
  description: string;
  footer: ReactNode;
}>;

const authHighlights = [
  {
    title: "Tenant-aware access",
    description: "Keep sign-in scoped to the right organization and property from the first session.",
    icon: ShieldCheck,
  },
  {
    title: "Fast property switching",
    description: "Move between organizations and locations without rebuilding the working context.",
    icon: Layers3,
  },
  {
    title: "Operational structure",
    description: "Map users to organizations, then properties, with a setup flow that is ready for backend wiring.",
    icon: Building2,
  },
];

export function AuthLayout({ title, description, footer, children }: AuthLayoutProps) {
  return (
    <PageTransition className="bg-background">
      <div className="mx-auto flex min-h-screen w-full max-w-7xl items-center px-4 py-6 sm:px-6 lg:px-8">
        <div className="grid w-full items-stretch gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(360px,440px)]">
          <section className="hidden rounded-2xl border border-border bg-muted/60 p-8 lg:flex lg:flex-col lg:justify-between">
            <div className="space-y-8">
              <div className="space-y-4">
                <Badge variant="secondary" className="rounded-full">
                  Workforce access
                </Badge>
                <AppLogo />
                <div className="space-y-2">
                  <h1 className="text-2xl font-semibold tracking-tight text-foreground">{title}</h1>
                  <p className="max-w-xl text-sm text-muted-foreground">{description}</p>
                </div>
              </div>
              <div className="space-y-4">
                {authHighlights.map(({ title: itemTitle, description: itemDescription, icon: Icon }, index) => (
                  <div key={itemTitle} className="space-y-4">
                    <div className="flex items-start gap-4">
                      <div className="mt-0.5 flex size-10 items-center justify-center rounded-xl border border-border bg-background">
                        <Icon className="size-4 text-foreground" />
                      </div>
                      <div className="space-y-1">
                        <p className="text-sm font-medium text-foreground">{itemTitle}</p>
                        <p className="text-sm leading-6 text-muted-foreground">{itemDescription}</p>
                      </div>
                    </div>
                    {index < authHighlights.length - 1 ? <Separator /> : null}
                  </div>
                ))}
              </div>
            </div>
            <div className="rounded-2xl border border-border bg-card p-6">
              <p className="text-sm font-medium text-foreground">New organization?</p>
              <p className="mt-2 text-sm text-muted-foreground">
                Start with account access now, then create the organization and its first property in the onboarding flow.
              </p>
              <Link
                to="/onboarding/create-organization"
                className={cn(buttonVariants({ variant: "outline" }), "mt-5 w-full justify-between")}
              >
                Create an organization
                <ArrowRight className="size-4" />
              </Link>
            </div>
          </section>

          <section className="flex items-center justify-center">
            <div className="w-full max-w-xl space-y-4">
              <div className="flex justify-end">
                <ThemeToggle />
              </div>
              <AuthCard title={title} description={description} footer={footer}>
                {children}
              </AuthCard>
            </div>
          </section>
        </div>
      </div>
    </PageTransition>
  );
}
