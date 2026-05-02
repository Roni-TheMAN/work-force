import { type ReactNode } from "react";

import { PageTransition } from "@/components/layout/page-transition";
import { cn } from "@/lib/utils";

type AppLayoutProps = {
  sidebar: ReactNode;
  topbar: ReactNode;
  isSidebarOpen: boolean;
  onSidebarOpenChange: (open: boolean) => void;
  children: ReactNode;
};

export function AppLayout({
  sidebar,
  topbar,
  isSidebarOpen,
  onSidebarOpenChange,
  children,
}: AppLayoutProps) {
  return (
    <PageTransition className="bg-background">
      <div className="min-h-screen bg-background">
        <div className="fixed inset-y-0 left-0 z-30 hidden w-[240px] border-r border-border bg-card lg:block">
          {sidebar}
        </div>

        <button
          type="button"
          aria-label="Close navigation"
          aria-hidden={!isSidebarOpen}
          className={cn(
            "fixed inset-0 z-40 bg-background/80 opacity-0 transition-opacity duration-200 lg:hidden",
            isSidebarOpen && "opacity-100 backdrop-blur-sm",
            !isSidebarOpen && "pointer-events-none",
          )}
          onClick={() => onSidebarOpenChange(false)}
        />

        <div
          className={cn(
            "fixed inset-y-0 left-0 z-50 w-[240px] border-r border-border bg-card transition-transform duration-200 lg:hidden",
            isSidebarOpen ? "translate-x-0" : "-translate-x-full",
          )}
        >
          {sidebar}
        </div>

        <div className="lg:pl-[240px]">
          <div className="sticky top-0 z-20 border-b border-border bg-background/95 backdrop-blur-sm">
            {topbar}
          </div>
          <main>{children}</main>
        </div>
      </div>
    </PageTransition>
  );
}
