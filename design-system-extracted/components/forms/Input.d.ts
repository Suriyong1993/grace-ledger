export interface InputProps {
  label?: string;
  placeholder?: string;
  value?: string;
  onChange?: (value: string) => void;
  /** Error message — shows destructive border + helper text below */
  error?: string;
  disabled?: boolean;
  type?: string;
}
