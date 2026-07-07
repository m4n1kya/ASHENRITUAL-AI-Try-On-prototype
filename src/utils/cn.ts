/**
 * Lightweight class-name combiner.
 * Filters out falsy values so conditional Tailwind classes stay readable,
 * e.g. cn("btn", isActive && "btn-active", className)
 */
export function cn(...classes: Array<string | false | null | undefined>): string {
  return classes.filter(Boolean).join(" ");
}
