import dayjs from "dayjs";
import "dayjs/locale/th";
import buddhistEra from "dayjs/plugin/buddhistEra";

dayjs.locale("th");
dayjs.extend(buddhistEra);

export const thb = (n: number) =>
  new Intl.NumberFormat("th-TH", {
    style: "currency",
    currency: "THB",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number.isFinite(n) ? n : 0);

export const num = (n: number) => new Intl.NumberFormat("th-TH").format(Number.isFinite(n) ? n : 0);

export const fmtDate = (d: string | Date) => dayjs(d).format("D MMM BBBB");
export const fmtDateTime = (d: string | Date) => dayjs(d).format("D MMM BBBB HH:mm");
export const fmtMonth = (d: string | Date) => dayjs(d).format("MMMM BBBB");

export const today = () => dayjs().format("YYYY-MM-DD");
export const now = () => dayjs().toISOString();

export { dayjs };
