import type { ComponentPropsWithoutRef } from "react";
import { cn } from "@/lib/cn";

export type CardProps = ComponentPropsWithoutRef<"div">;

/** Generic elevated surface; pairs with `.ui-card` in globals.css */
export function Card({ className, ...props }: CardProps) {
  return <div className={cn("ui-card", className)} {...props} />;
}
