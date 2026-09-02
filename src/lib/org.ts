/**
 * Church identity for official documents (giving certificates, annual
 * reports, expense vouchers). The live value is the `churches.name` row
 * carried in the session; this fallback covers sessions that could not
 * resolve it, so a printed document is never left with a placeholder.
 */
export const CHURCH_NAME_TH = "คริสตจักรชีวิตสุขสันต์กาฬสินธุ์";
