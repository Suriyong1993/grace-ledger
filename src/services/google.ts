// src/services/google.ts
// Google Sheets & Drive integration via OAuth2

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID ?? "";
const SCOPES = [
  "https://www.googleapis.com/auth/spreadsheets",
  "https://www.googleapis.com/auth/drive.file",
].join(" ");

interface GoogleTokenClient {
  callback: (response: { access_token?: string; error?: string }) => void;
  requestAccessToken: (opts: { prompt: string }) => void;
}

let tokenClient: GoogleTokenClient | null = null;
let accessToken: string | null = null;

// Initialize Google Identity Services
async function initGis(): Promise<void> {
  if (tokenClient) return;
  // @ts-expect-error google is loaded from GIS script
  const google = window.google;
  if (!google?.accounts?.oauth2) {
    // Load GIS script dynamically
    await new Promise<void>((resolve, reject) => {
      const script = document.createElement("script");
      script.src = "https://accounts.google.com/gsi/client";
      script.onload = () => resolve();
      script.onerror = () => reject(new Error("Failed to load Google Identity Services"));
      document.head.appendChild(script);
    });
  }
  // @ts-expect-error google is loaded from GIS script
  tokenClient = window.google.accounts.oauth2.initTokenClient({
    client_id: GOOGLE_CLIENT_ID,
    scope: SCOPES,
    callback: (response: { access_token: string }) => {
      accessToken = response.access_token;
    },
  });
}

export async function getGoogleToken(): Promise<string> {
  if (accessToken) return accessToken;
  if (!GOOGLE_CLIENT_ID) throw new Error("VITE_GOOGLE_CLIENT_ID not configured");
  await initGis();
  return new Promise((resolve, reject) => {
  if (!tokenClient) throw new Error("Google token client not initialized");
  tokenClient.callback = (response: { access_token?: string; error?: string }) => {
      if (response.error) {
        reject(new Error(response.error));
        return;
      }
      accessToken = response.access_token!;
      resolve(accessToken);
    };
    tokenClient.requestAccessToken({ prompt: "consent" });
  });
}

export function clearGoogleToken() {
  accessToken = null;
}

// Append rows to a Google Sheet
export async function appendToSheet(
  sheetId: string,
  range: string,
  rows: (string | number)[][],
): Promise<void> {
  const token = await getGoogleToken();
  const res = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${encodeURIComponent(range)}:append?valueInputOption=USER_ENTERED`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ values: rows }),
    },
  );
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error?.message ?? `Sheets API error: ${res.status}`);
  }
}

// Upload a file to Google Drive
export async function uploadToDrive(
  fileName: string,
  content: Blob,
  mimeType: string,
  folderId?: string,
): Promise<string> {
  const token = await getGoogleToken();
  const metadata: Record<string, unknown> = { name: fileName, mimeType };
  if (folderId) metadata.parents = [folderId];

  const form = new FormData();
  form.append("metadata", new Blob([JSON.stringify(metadata)], { type: "application/json" }));
  form.append("file", content);

  const res = await fetch("https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: form,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error?.message ?? `Drive API error: ${res.status}`);
  }
  const data = await res.json();
  return data.id;
}
