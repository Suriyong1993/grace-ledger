export interface CardProps {
  variant?: "default" | "interactive";
  title?: string;
  description?: string;
  footer?: React.ReactNode;
  children?: React.ReactNode;
}
