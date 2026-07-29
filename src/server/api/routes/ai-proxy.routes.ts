/**
 * Grace Ledger v2 — AI Proxy Route
 *
 * Server-side proxy for AI document parsing (Fireworks AI, Gemini).
 * Keeps API keys secure on the server instead of exposing them to the client.
 * The client sends the file/image data, and the server handles the AI API call.
 */

import { wrapError, jsonResponse, errorResponse } from "@/server/api/middleware";
import type { RouteDefinition } from "@/server/api/routes";

const FIREWORKS_API_KEY = process.env.FIREWORKS_API_KEY ?? process.env.VITE_FIREWORKS_API_KEY ?? "";
const GEMINI_API_KEY =
  process.env.GEMINI_API_KEY ??
  process.env.AI_API_KEY ??
  process.env.VITE_AI_API_KEY ??
  process.env.VITE_GEMINI_API_KEY ??
  "";

const FIREWORKS_MODEL = "accounts/fireworks/models/kimi-k3";
const FIREWORKS_BASE_URL = "https://api.fireworks.ai/inference/v1";
const GEMINI_MODEL = "gemini-2.0-flash";

// ============================================================================
// Full prompt for receipt / tax-invoice / bank-slip / e-commerce OCR
// (mirrors the prompt in src/services/aiReceiptService.ts)
// ============================================================================
const RECEIPT_SCHEMA_PROMPT = `You are an expert AI Document OCR Parser for Thai Receipts, Tax Invoices (ใบกำกับภาษี), Bank Slips (สลิปโอนเงิน), Handwritten Bills (บิลเขียนมือ), and E-commerce Screenshots (Shopee/Lazada/TikTok).

Analyze the document image and extract fields in STRICT JSON format ONLY (no markdown, no explanation):
{
  "docType": "tax_invoice|receipt|bank_slip|handwritten|ecommerce_screenshot",
  "docTypeName": "ใบกำกับภาษี|ใบเสร็จรับเงิน|สลิปโอนเงิน|บิลเงินสดเขียนมือ|ภาพคำสั่งซื้อ E-commerce",
  "merchantName": "string",
  "taxId": "13-digit Thai Tax ID or null",
  "date": "YYYY-MM-DD",
  "amount": number,
  "subtotal": number or null,
  "vatAmount": number or null,
  "category": "อาหาร|เดินทาง|สำนักงาน|สาธารณูปโภค|การตลาด|ค่าเช่า|บริจาค|อื่นๆ",
  "description": "string summary of items purchased",
  "platform": "Shopee|Lazada|TikTok Shop|Bank Transfer|General",
  "confidence": 0.0 to 1.0,
  "items": [{"name":"string", "price":number, "qty":number}]
}`;

// ============================================================================
// Full prompt for handwritten church-form OCR (offering worksheet / disbursement voucher)
// (mirrors the CHURCH_PROMPT constant in src/services/churchVoucherAiService.ts)
// ============================================================================
const CHURCH_PROMPT = `You are a specialist AI OCR for Thai Church Handwritten Records, specifically "คริสตจักรชีวิตสุขสันต์กาฬสินธุ์".

Determine if the image is a "ใบตรวจนับเงินแยกรายการ" (Offering Worksheet) or "ใบเบิกเงิน คริสตจักร" (Disbursement Voucher).

If it is a "ใบตรวจนับเงินแยกรายการ" (Offering Worksheet), extract in JSON:
{
  "docType": "offering_worksheet",
  "churchName": "คริสตจักรชีวิตสุขสันต์กาฬสินธุ์",
  "date": "YYYY-MM-DD or 26/07/2567",
  "sheetNo": "1",
  "members": [
    {"no": 1, "memberName": "ชื่อสมาชิก", "tithe": 1000, "mission": 50, "special": 60, "total": 1110}
  ],
  "totals": {
    "titheTotal": 4440,
    "rentTotal": 0,
    "memorialTotal": 50,
    "missionTotal": 60,
    "specialTotal": 325,
    "landTotal": 0,
    "partyTotal": 0,
    "grandTotal": 4875
  }
}

If it is a "ใบเบิกเงิน คริสตจักร" (Disbursement Voucher), extract each voucher block in JSON:
{
  "docType": "disbursement_voucher",
  "churchName": "คริสตจักรชีวิตสุขสันต์กาฬสินธุ์",
  "date": "26/07/2567",
  "vouchers": [
    {
      "date": "26/07/2567",
      "applicant": "สุทารัตน์ จิณเซ็ง",
      "purpose": "ค่าไฟฟ้าคริสตจักร",
      "amount": 1212,
      "payee": "สุทารัตน์ จิณเซ็ง",
      "category": "สาธารณูปโภค"
    }
  ],
  "totalAmount": 1212
}

Respond with STRICT JSON only — no markdown fences, no explanation.`;

/**
 * Server-side: parse a document image using Fireworks AI (primary).
 */
async function parseWithFireworks(
  imageBase64: string,
  mimeType: string,
  prompt: string,
): Promise<string | null> {
  if (!FIREWORKS_API_KEY) return null;

  const dataUrl = imageBase64.startsWith("data:")
    ? imageBase64
    : `data:${mimeType};base64,${imageBase64}`;

  const res = await fetch(`${FIREWORKS_BASE_URL}/chat/completions`, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      Authorization: `Bearer ${FIREWORKS_API_KEY}`,
    },
    body: JSON.stringify({
      model: FIREWORKS_MODEL,
      max_tokens: 2048,
      temperature: 0.1,
      top_k: 40,
      presence_penalty: 0,
      frequency_penalty: 0,
      messages: [
        {
          role: "user",
          content: [
            { type: "image_url", image_url: { url: dataUrl } },
            { type: "text", text: prompt },
          ],
        },
      ],
    }),
  });

  if (!res.ok) return null;
  const json = await res.json();
  return json.choices?.[0]?.message?.content ?? null;
}

/**
 * Server-side: parse a document image using Google Gemini (fallback).
 */
async function parseWithGemini(
  imageBase64: string,
  mimeType: string,
  prompt: string,
): Promise<string | null> {
  if (!GEMINI_API_KEY) return null;

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [
          {
            parts: [{ inlineData: { mimeType, data: imageBase64 } }, { text: prompt }],
          },
        ],
        generationConfig: { temperature: 0.1, maxOutputTokens: 1200 },
      }),
    },
  );

  if (!res.ok) return null;
  const json = await res.json();
  return json.candidates?.[0]?.content?.parts?.[0]?.text ?? null;
}

function route(method: "POST", path: string, handler: RouteDefinition["handler"]): RouteDefinition {
  return { method, path, handler };
}

export const aiProxyRoutes: RouteDefinition[] = [
  /**
   * POST /api/ai/parse-document
   * Server-side proxy for AI document parsing (receipts, tax invoices, bank slips, etc).
   * Body: { image: string (base64 or data-url), mimeType: string }
   * Response: { raw: string, provider: string } with the AI response
   */
  route("POST", "/ai/parse-document", async (request, _params, _query) => {
    return wrapError(async () => {
      const body = await request.json();
      const { image, mimeType } = body as { image: string; mimeType: string };

      if (!image || !mimeType) {
        return errorResponse(400, "MISSING_FIELDS", "image and mimeType are required");
      }

      // Strip data:... prefix if present for Gemini
      const base64Data = image.includes(",") ? (image.split(",")[1] ?? image) : image;

      // Try Fireworks AI first
      let raw = await parseWithFireworks(image, mimeType, RECEIPT_SCHEMA_PROMPT);
      let provider = "fireworks";

      // Fallback to Gemini
      if (!raw) {
        raw = await parseWithGemini(base64Data, mimeType, RECEIPT_SCHEMA_PROMPT);
        provider = "gemini";
      }

      if (!raw) {
        return errorResponse(503, "AI_UNAVAILABLE", "No AI provider available");
      }

      return jsonResponse({ raw, provider });
    });
  }),

  /**
   * POST /api/ai/parse-church-form
   * Specialized proxy for parsing handwritten church forms (offering worksheets, disbursement vouchers).
   * Body: { image: string (base64 or data-url), mimeType: string }
   * Response: { raw: string, provider: string } with the AI response
   */
  route("POST", "/ai/parse-church-form", async (request, _params, _query) => {
    return wrapError(async () => {
      const body = await request.json();
      const { image, mimeType } = body as { image: string; mimeType: string };

      if (!image || !mimeType) {
        return errorResponse(400, "MISSING_FIELDS", "image and mimeType are required");
      }

      const base64Data = image.includes(",") ? (image.split(",")[1] ?? image) : image;

      // Try Fireworks AI first
      let raw = await parseWithFireworks(image, mimeType, CHURCH_PROMPT);
      let provider = "fireworks";

      // Fallback to Gemini
      if (!raw) {
        raw = await parseWithGemini(base64Data, mimeType, CHURCH_PROMPT);
        provider = "gemini";
      }

      if (!raw) {
        return errorResponse(503, "AI_UNAVAILABLE", "No AI provider available");
      }

      return jsonResponse({ raw, provider });
    });
  }),
];
