import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
  {
    variants: {
      variant: {
        default: "border-border bg-secondary text-secondary-foreground hover:bg-secondary/80",
        secondary: "border-border bg-secondary/50 text-secondary-foreground hover:bg-secondary",
        destructive: "border-destructive text-destructive bg-transparent hover:bg-destructive/10",
        outline: "border-border text-foreground bg-transparent hover:bg-secondary",
        success: "border-success text-success bg-transparent hover:bg-success/10",
        warning: "border-warning text-warning bg-transparent hover:bg-warning/10",
        info: "border-info text-info bg-transparent hover:bg-info/10",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>, VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
