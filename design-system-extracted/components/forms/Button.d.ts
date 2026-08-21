export interface ButtonProps {
  /** Visual style. default = orange fill (brand CTA); ghost/outline for secondary actions; destructive for irreversible actions. */
  variant?: "default" | "secondary" | "outline" | "ghost" | "destructive";
  /** default 44px, sm 36px (table row actions only), lg 48px, icon = square 44px */
  size?: "default" | "sm" | "lg" | "icon";
  disabled?: boolean;
  /** Optional leading icon element (e.g. a Lucide icon) */
  icon?: React.ReactNode;
  children?: React.ReactNode;
  onClick?: () => void;
}
