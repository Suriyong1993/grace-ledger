export interface TabItem { value: string; label: string; }
export interface TabsProps {
  items: TabItem[];
  value: string;
  onChange: (value: string) => void;
}
