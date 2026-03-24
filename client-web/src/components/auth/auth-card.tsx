import type { PropsWithChildren, ReactNode } from "react";

import { AppLogo } from "@/components/brand/app-logo";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

type AuthCardProps = PropsWithChildren<{
  title: string;
  description: string;
  footer?: ReactNode;
  className?: string;
}>;

export function AuthCard({ title, description, footer, className, children }: AuthCardProps) {
  return (
    <Card className={cn("w-full max-w-xl", className)}>
      <CardHeader className="space-y-5">
        <AppLogo compact />
        <div className="space-y-2">
          <CardTitle className="text-2xl font-semibold tracking-tight">{title}</CardTitle>
          <CardDescription>{description}</CardDescription>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">{children}</CardContent>
      {footer ? <CardFooter className="justify-center">{footer}</CardFooter> : null}
    </Card>
  );
}
