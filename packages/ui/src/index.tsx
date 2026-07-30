import type { ComponentPropsWithoutRef, ReactNode } from "react";

export interface BrandMarkProps {
  compact?: boolean;
  logoSrc?: string;
}

export function BrandMark({ compact = false, logoSrc }: BrandMarkProps) {
  return (
    <span aria-label="Terrativa" className="brand-mark" role="img">
      {logoSrc ? (
        <img alt="" aria-hidden="true" className="brand-mark__image" src={logoSrc} />
      ) : (
        <span aria-hidden="true" className="brand-mark__symbol">
          T
        </span>
      )}
      {!compact && !logoSrc && <span className="brand-mark__name">Terrativa</span>}
    </span>
  );
}

export interface ActionButtonProps extends ComponentPropsWithoutRef<"button"> {
  children: ReactNode;
  tone?: "primary" | "quiet";
}

export function ActionButton({
  children,
  className = "",
  tone = "primary",
  type = "button",
  ...props
}: ActionButtonProps) {
  return (
    <button
      className={`action-button action-button--${tone} ${className}`.trim()}
      type={type}
      {...props}
    >
      {children}
    </button>
  );
}
