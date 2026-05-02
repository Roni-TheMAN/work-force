import {
  BarChart3,
  Building2,
  CalendarDays,
  CreditCard,
  FileSignature,
  LayoutDashboard,
  LogOut,
  Receipt,
  Settings,
  UserPlus,
  Users,
} from "lucide-react";

import { AppLogo } from "@/components/brand/app-logo";
import { buttonVariants } from "@/components/ui/button";
import { useAuth } from "@/providers/auth-provider";
import { cn } from "@/lib/utils";

export const workspaceSections = [
  "dashboard",
  "properties",
  "employees",
  "documents",
  "users",
  "scheduling",
  "payroll",
  "analytics",
  "billing",
  "settings",
] as const;

export type WorkspaceSection = (typeof workspaceSections)[number];

const navigationItems: Array<{
  label: string;
  value: WorkspaceSection;
  icon: typeof LayoutDashboard;
}> = [
  { label: "Dashboard", value: "dashboard", icon: LayoutDashboard },
  { label: "Properties", value: "properties", icon: Building2 },
  { label: "Employees", value: "employees", icon: Users },
  { label: "Documents", value: "documents", icon: FileSignature },
  { label: "Users", value: "users", icon: UserPlus },
  { label: "Scheduling", value: "scheduling", icon: CalendarDays },
  { label: "Payroll", value: "payroll", icon: Receipt },
  { label: "Analytics", value: "analytics", icon: BarChart3 },
  { label: "Billing", value: "billing", icon: CreditCard },
  { label: "Settings", value: "settings", icon: Settings },
];

type SidebarProps = {
  availableSections?: readonly WorkspaceSection[];
  organizationName: string;
  currentSection: WorkspaceSection;
  onSectionChange: (section: WorkspaceSection) => void;
  onNavigate?: () => void;
};

export function Sidebar({
  availableSections = workspaceSections,
  organizationName,
  currentSection,
  onSectionChange,
  onNavigate,
}: SidebarProps) {
  const { signOut } = useAuth();

  return (
    <aside className="flex h-full flex-col px-4 py-5">
      <div className="border-b border-border pb-5">
        <AppLogo compact />
        <div className="mt-4 rounded-2xl border border-border bg-background px-4 py-3">
          <p className="text-sm font-medium text-foreground">{organizationName}</p>
          <p className="mt-1 text-sm text-muted-foreground">Operations workspace</p>
        </div>
      </div>

      <nav className="mt-6 flex-1 space-y-1">
        {navigationItems
          .filter((item) => availableSections.includes(item.value))
          .map((item) => {
            const Icon = item.icon;
            const isActive = currentSection === item.value;

            return (
              <button
                key={item.label}
                type="button"
                aria-current={isActive ? "page" : undefined}
                onClick={() => {
                  onSectionChange(item.value);
                  onNavigate?.();
                }}
                className={cn(
                  buttonVariants({ variant: isActive ? "secondary" : "ghost", size: "default" }),
                  "h-10 w-full justify-start gap-3 px-3",
                  isActive && "border border-border bg-secondary text-foreground",
                )}
              >
                <Icon className="size-4" />
                <span>{item.label}</span>
              </button>
            );
          })}
      </nav>

      <div className="mt-4 border-t border-border pt-4">
        <button
          type="button"
          onClick={() => {
            onNavigate?.();
            void signOut();
          }}
          className={cn(
            buttonVariants({ variant: "ghost", size: "default" }),
            "h-10 w-full justify-start gap-3 px-3 text-muted-foreground hover:text-foreground",
          )}
        >
          <LogOut className="size-4" />
          <span>Sign out</span>
        </button>
      </div>
    </aside>
  );
}
