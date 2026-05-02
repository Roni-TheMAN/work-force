import { Bell, Menu } from "lucide-react";
import { Link } from "react-router-dom";

import { getInitials } from "@/components/dashboard/dashboard-formatters";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button, buttonVariants } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";

type PropertyOption = {
  id: string;
  name: string;
};

type TopbarProps = {
  organizationId: string;
  organizationName: string;
  propertyOptions: PropertyOption[];
  selectedPropertyId: string | null;
  onPropertyChange: (propertyId: string | null) => void;
  userName: string;
  userEmail: string;
  userAvatarUrl: string | null;
  onOpenSidebar: () => void;
};

export function Topbar({
  organizationId,
  organizationName,
  propertyOptions,
  selectedPropertyId,
  onPropertyChange,
  userName,
  userEmail,
  userAvatarUrl,
  onOpenSidebar,
}: TopbarProps) {
  const selectedPropertyLabel = selectedPropertyId
    ? propertyOptions.find((property) => property.id === selectedPropertyId)?.name
    : "All properties";

  return (
    <header className="mx-auto flex h-18 w-full max-w-[1400px] items-center gap-3 px-4 sm:px-6">
      <Button type="button" variant="ghost" size="icon-sm" className="lg:hidden" onClick={onOpenSidebar}>
        <Menu className="size-4" />
      </Button>

      <div className="min-w-0 flex-1">
        <p className="truncate text-lg font-semibold text-foreground">{organizationName}</p>
        <p className="truncate text-sm text-muted-foreground">Property-aware workforce dashboard</p>
      </div>

      <Select
        value={selectedPropertyId ?? "all-properties"}
        onValueChange={(value) => onPropertyChange(value === "all-properties" ? null : value)}
      >
        <SelectTrigger className="w-[180px] bg-card sm:w-[220px]">
          <SelectValue placeholder="Select property">{selectedPropertyLabel}</SelectValue>
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all-properties">All properties</SelectItem>
          {propertyOptions.map((property) => (
            <SelectItem key={property.id} value={property.id}>
              {property.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Link
        to={`/quick-dash?organization=${encodeURIComponent(organizationId)}`}
        className={cn(buttonVariants({ variant: "outline", size: "sm" }), "hidden sm:inline-flex")}
      >
        Quick Dash
      </Link>

      <Button type="button" variant="ghost" size="icon-sm" className="relative">
        <Bell className="size-4" />
        <span className="absolute top-2 right-2 size-2 rounded-full bg-primary" />
      </Button>

      <ThemeToggle />

      <div className="hidden items-center gap-3 rounded-2xl border border-border bg-card px-3 py-2 sm:flex">
        <Avatar className="size-10">
          <AvatarImage src={userAvatarUrl ?? undefined} alt={userName} />
          <AvatarFallback>{getInitials(userName)}</AvatarFallback>
        </Avatar>
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-foreground">{userName}</p>
          <p className="truncate text-sm text-muted-foreground">{userEmail}</p>
        </div>
      </div>
    </header>
  );
}
