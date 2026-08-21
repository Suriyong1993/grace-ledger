export interface MoneyTextProps {
  value: number;
  /** income = emerald with + prefix, expense = red with − prefix, default = plain foreground */
  tone?: "default" | "income" | "expense";
}
