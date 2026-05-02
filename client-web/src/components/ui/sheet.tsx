import * as React from "react";
import { Dialog } from "@base-ui/react/dialog";
import { X } from "lucide-react";

import { cn } from "@/lib/utils";

const Sheet = Dialog.Root;
const SheetTrigger = Dialog.Trigger;
const SheetClose = Dialog.Close;

function SheetPortal(props: React.ComponentProps<typeof Dialog.Portal>) {
  return <Dialog.Portal data-slot="sheet-portal" {...props} />;
}

function SheetOverlay({ className, ...props }: React.ComponentProps<typeof Dialog.Backdrop>) {
  return (
    <Dialog.Backdrop
      data-slot="sheet-overlay"
      className={cn(
        "fixed inset-0 z-50 bg-foreground/20 backdrop-blur-[1px] transition-opacity duration-200 data-[ending-style]:opacity-0 data-[starting-style]:opacity-0",
        className
      )}
      {...props}
    />
  );
}

function SheetContent({ className, children, ...props }: React.ComponentProps<typeof Dialog.Popup>) {
  return (
    <SheetPortal>
      <SheetOverlay />
      <Dialog.Popup
        data-slot="sheet-content"
        className={cn(
          "fixed inset-y-0 right-0 z-50 flex h-full w-full max-w-[420px] flex-col border-l border-border bg-card text-card-foreground shadow-xl outline-none transition-transform duration-200 ease-out data-[ending-style]:translate-x-6 data-[starting-style]:translate-x-6 sm:max-w-[480px]",
          className
        )}
        {...props}
      >
        {children}
        <Dialog.Close
          data-slot="sheet-close"
          className="absolute top-4 right-4 inline-flex size-9 items-center justify-center rounded-xl border border-border bg-background text-muted-foreground transition-colors hover:text-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          <X className="size-4" />
          <span className="sr-only">Close</span>
        </Dialog.Close>
      </Dialog.Popup>
    </SheetPortal>
  );
}

function SheetHeader({ className, ...props }: React.ComponentProps<"div">) {
  return <div data-slot="sheet-header" className={cn("space-y-2 border-b border-border px-6 py-5", className)} {...props} />;
}

function SheetBody({ className, ...props }: React.ComponentProps<"div">) {
  return <div data-slot="sheet-body" className={cn("flex-1 overflow-y-auto px-6 py-5", className)} {...props} />;
}

function SheetFooter({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="sheet-footer"
      className={cn("flex flex-col-reverse gap-3 border-t border-border px-6 py-5 sm:flex-row sm:justify-end", className)}
      {...props}
    />
  );
}

function SheetTitle({ className, ...props }: React.ComponentProps<typeof Dialog.Title>) {
  return (
    <Dialog.Title
      data-slot="sheet-title"
      className={cn("text-lg font-semibold tracking-tight text-foreground", className)}
      {...props}
    />
  );
}

function SheetDescription({ className, ...props }: React.ComponentProps<typeof Dialog.Description>) {
  return (
    <Dialog.Description
      data-slot="sheet-description"
      className={cn("text-sm text-muted-foreground", className)}
      {...props}
    />
  );
}

export {
  Sheet,
  SheetBody,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetPortal,
  SheetTitle,
  SheetTrigger,
};
