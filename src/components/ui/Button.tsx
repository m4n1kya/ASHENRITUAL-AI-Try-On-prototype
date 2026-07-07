import { ButtonHTMLAttributes, ReactNode, forwardRef } from "react";
import { cn } from "@/utils/cn";

type ButtonVariant = "primary" | "secondary";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  children: ReactNode;
  variant?: ButtonVariant;
  icon?: ReactNode;
}

const base =
  "inline-flex items-center justify-center gap-2 rounded-3xl px-8 py-3.5 " +
  "font-body text-sm font-medium tracking-wide2 transition-all duration-300 ease-out " +
  "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-white/40 focus-visible:ring-offset-2 focus-visible:ring-offset-void " +
  "disabled:cursor-not-allowed disabled:opacity-40";

const variants: Record<ButtonVariant, string> = {
  // Matte black, white border, white text — soft glow only on hover.
  primary:
    "border border-white/70 bg-black text-white hover:bg-white hover:text-black hover:shadow-glow active:scale-[0.98]",
  // Transparent glass, thin border, no fill.
  secondary:
    "border border-white/[0.14] bg-white/[0.03] text-fog backdrop-blur-md hover:border-white/30 hover:bg-white/[0.06] hover:text-white active:scale-[0.98]",
};

/**
 * Primary interactive control for the prototype. `primary` carries the one
 * action we want taken (matte black, inverts to white with a soft glow on
 * hover); `secondary` is quiet glass for everything else.
 */
const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ children, variant = "primary", icon, className, ...rest }, ref) => {
    return (
      <button ref={ref} className={cn(base, variants[variant], className)} {...rest}>
        {children}
        {icon}
      </button>
    );
  }
);

Button.displayName = "Button";

export default Button;
