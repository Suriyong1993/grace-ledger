export interface PageHeaderProps {
  /** Small uppercase label above the title, e.g. "ภาพรวม" */
  kicker?: string;
  title: string;
  description?: string;
  actions?: React.ReactNode;
}
