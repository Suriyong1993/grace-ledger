// src/services/fireworksAiService.ts
// Fireworks AI — Serverless OpenAI-Compatible API Client
// Model: accounts/fireworks/models/kimi-k3 (Vision + Long-context)

const FIREWORKS_API_KEY = import.meta.env.VITE_FIREWORKS_API_KEY ?? "";
const FIREWORKS_BASE_URL = "https://api.fireworks.ai/inference/v1";
export const FIREWORKS_MODEL = "accounts/fireworks/models/kimi-k3";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type MessageRole = "system" | "user" | "assistant";

export interface TextContent {
  type: "text";
  text: string;
}

export interface ImageUrlContent {
  type: "image_url";
  image_url: { url: string };
}

export type MessageContent = string | Array<TextContent | ImageUrlContent>;

export interface ChatMessage {
  role: MessageRole;
  content: MessageContent;
}

export interface FireworksChatOptions {
  model?: string;
  max_tokens?: number;
  temperature?: number;
  top_k?: number;
  top_p?: number;
  presence_penalty?: number;
  frequency_penalty?: number;
}

export interface FireworksChatResponse {
  id: string;
  object: string;
  model: string;
  choices: Array<{
    index: number;
    message: { role: string; content: string };
    finish_reason: string;
  }>;
  usage: { prompt_tokens: number; completion_tokens: number; total_tokens: number };
}

// ---------------------------------------------------------------------------
// Core chat completion call
// ---------------------------------------------------------------------------

export async function fireworksChat(
  messages: ChatMessage[],
  options: FireworksChatOptions = {},
): Promise<string> {
  if (!FIREWORKS_API_KEY) {
    throw new Error("VITE_FIREWORKS_API_KEY is not configured.");
  }

  const payload = {
    model: options.model ?? FIREWORKS_MODEL,
    max_tokens: options.max_tokens ?? 4096,
    temperature: options.temperature ?? 0.1,
    top_k: options.top_k ?? 40,
    presence_penalty: options.presence_penalty ?? 0,
    frequency_penalty: options.frequency_penalty ?? 0,
    messages,
  };

  const res = await fetch(`${FIREWORKS_BASE_URL}/chat/completions`, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      Authorization: `Bearer ${FIREWORKS_API_KEY}`,
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => res.statusText);
    throw new Error(`Fireworks AI API error ${res.status}: ${errText}`);
  }

  const json = (await res.json()) as FireworksChatResponse;
  return json.choices?.[0]?.message?.content ?? "";
}

// ---------------------------------------------------------------------------
// Vision helper — converts a File to a data-URL and builds image_url message
// ---------------------------------------------------------------------------

export function fileToDataURL(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = (err) => reject(err);
  });
}

export async function fireworksVisionChat(
  file: File,
  textPrompt: string,
  options: FireworksChatOptions = {},
): Promise<string> {
  const dataUrl = await fileToDataURL(file);

  const messages: ChatMessage[] = [
    {
      role: "user",
      content: [
        { type: "image_url", image_url: { url: dataUrl } },
        { type: "text", text: textPrompt },
      ],
    },
  ];

  return fireworksChat(messages, { max_tokens: 2048, ...options });
}

// ---------------------------------------------------------------------------
// Utility: strip markdown code fences from LLM JSON output
// ---------------------------------------------------------------------------

export function extractJsonFromLLMResponse(raw: string): string {
  return raw
    .replace(/```json\s*/gi, "")
    .replace(/```\s*/g, "")
    .trim();
}

// ---------------------------------------------------------------------------
// Quick connectivity check (can be called from settings/debug pages)
// ---------------------------------------------------------------------------

export async function testFireworksConnection(): Promise<{
  ok: boolean;
  model: string;
  latencyMs: number;
}> {
  const start = Date.now();
  const response = await fireworksChat([{ role: "user", content: "Reply with exactly: OK" }], {
    model: FIREWORKS_MODEL,
    max_tokens: 8,
  });
  return {
    ok: response.trim().toUpperCase().includes("OK"),
    model: FIREWORKS_MODEL,
    latencyMs: Date.now() - start,
  };
}
