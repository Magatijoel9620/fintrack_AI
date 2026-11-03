import * as React from "react"

import { cn } from "@/lib/utils"

const Card = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, onPointerMove, onPointerLeave, ...props }, ref) => (
  <div
    ref={ref}
    data-finai-card="true"
    onPointerMove={(event) => {
      if (event.pointerType === "mouse" || event.pointerType === "pen") {
        const bounds = event.currentTarget.getBoundingClientRect();
        event.currentTarget.style.setProperty("--finai-pointer-x", `${event.clientX - bounds.left}px`);
        event.currentTarget.style.setProperty("--finai-pointer-y", `${event.clientY - bounds.top}px`);
        const magnetX = ((event.clientX - bounds.left) / Math.max(1, bounds.width) - 0.5) * 2.4;
        const magnetY = ((event.clientY - bounds.top) / Math.max(1, bounds.height) - 0.5) * 2.4;
        event.currentTarget.style.setProperty("--finai-magnet-x", `${magnetX.toFixed(2)}px`);
        event.currentTarget.style.setProperty("--finai-magnet-y", `${magnetY.toFixed(2)}px`);
      }
      onPointerMove?.(event);
    }}
    onPointerLeave={(event) => {
      event.currentTarget.style.removeProperty("--finai-pointer-x");
      event.currentTarget.style.removeProperty("--finai-pointer-y");
      event.currentTarget.style.removeProperty("--finai-magnet-x");
      event.currentTarget.style.removeProperty("--finai-magnet-y");
      onPointerLeave?.(event);
    }}
    className={cn(
      "finai-card-surface rounded-lg border bg-card text-card-foreground shadow-sm",
      className
    )}
    {...props}
  />
))
Card.displayName = "Card"

const CardHeader = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("flex flex-col space-y-1.5 p-6", className)}
    {...props}
  />
))
CardHeader.displayName = "CardHeader"

const CardTitle = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn(
      "text-2xl font-semibold leading-none tracking-tight",
      className
    )}
    {...props}
  />
))
CardTitle.displayName = "CardTitle"

const CardDescription = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("text-sm text-muted-foreground", className)}
    {...props}
  />
))
CardDescription.displayName = "CardDescription"

const CardContent = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn("p-6 pt-0", className)} {...props} />
))
CardContent.displayName = "CardContent"

const CardFooter = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("flex items-center p-6 pt-0", className)}
    {...props}
  />
))
CardFooter.displayName = "CardFooter"

export { Card, CardHeader, CardFooter, CardTitle, CardDescription, CardContent }
