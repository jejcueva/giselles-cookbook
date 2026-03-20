import type { ComponentPropsWithoutRef } from "react";
import { cn } from "@/lib/cn";

export type InputProps = ComponentPropsWithoutRef<"input"> & {
  /** Extra classes merged with default form styling */
  inputClassName?: string;
};

/**
 * Text input using global `.form-input` styles. For search bars / special cases, pass `className` to override.
 */
export function Input({ className, inputClassName, ...props }: InputProps) {
  return <input className={cn("form-input", inputClassName, className)} {...props} />;
}
