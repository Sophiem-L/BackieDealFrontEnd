import { clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

// shadcn's class helper: clsx resolves conditionals, twMerge then drops earlier
// Tailwind classes that a later one overrides, so a `class` prop passed by a
// caller beats the component's own defaults instead of fighting them on
// specificity.
export function cn(...inputs) {
  return twMerge(clsx(inputs))
}
