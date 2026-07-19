import axios from "axios";

// Base URL is intentionally empty in Phase 1 (frontend-first).
// To switch to a real backend later: set VITE_API_URL and remove/disable
// the mock adapter used by the service files under src/services/*.
export const API_URL =
  (import.meta.env.VITE_API_URL as string | undefined) ?? "";

export const http = axios.create({
  baseURL: API_URL,
  timeout: 15000,
  headers: { "Content-Type": "application/json" },
});

http.interceptors.request.use((config) => {
  if (typeof window !== "undefined") {
    const token = window.localStorage.getItem("cfm.token");
    if (token) config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

http.interceptors.response.use(
  (r) => r,
  (err) => Promise.reject(err),
);

// Simulated latency for mock adapter
export const delay = (ms = 250) => new Promise((r) => setTimeout(r, ms));