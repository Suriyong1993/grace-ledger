// src/services/llm.ts
// Server-side LLM integration via OpenRouter API for Grace Ledger
// This file runs only on the server (browser never sees the API key)
// Usage: import { llmChat } from '@/services/llm' (server context only)

const OPENROUTER_API = "https://openrouter.ai/api/v1";

interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface ChatOptions {
  model?: string;
  messages: ChatMessage[];
  temperature?: number;
  maxTokens?: number;
}

const getModel = (): string => {
  if (typeof process !== "undefined" && process.env?.OPENROUTER_MODEL) {
    return process.env.OPENROUTER_MODEL;
  }
  return "inclusionai/ling-3.0-flash:free";
};

export async function llmChat(options: ChatOptions): Promise<string> {
  const model = options.model ?? getModel();
  const apiKey = process.env.OPENROUTER_API_KEY;

  if (!apiKey) {
    throw new Error("OPENROUTER_API_KEY is not set. Add it to Vercel environment variables.");
  }

  const res = await fetch(`${OPENROUTER_API}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "HTTP-Referer": process.env.OPENROUTER_SITE_URL ?? "https://grace-ledger-pearl.vercel.app",
      "X-Title": process.env.OPENROUTER_APP_NAME ?? "Grace Ledger",
    },
    body: JSON.stringify({
      model,
      messages: options.messages,
      temperature: options.temperature ?? 0.7,
      max_tokens: options.maxTokens ?? 4096,
      stream: false,
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`OpenRouter error ${res.status}: ${body}`);
  }

  const data = (await res.json()) as {
    choices: Array<{ message: { content: string } }>;
  };
  return data.choices[0]?.message?.content ?? "";
}
