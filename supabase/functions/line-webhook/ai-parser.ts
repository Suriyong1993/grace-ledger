// supabase/functions/line-webhook/ai-parser.ts
// Parses Thai expense/income text or receipt images into structured transactions.
// Uses AI Vision API with regex fallback for common Thai formats.

export interface ParsedTransaction {
  type: "income" | "expense";
  amount: number;
  category: string;
  description: string;
  merchant?: string;
  date: string;
  confidence: number;
}

const AI_API_KEY = Deno.env.get("AI_API_KEY") ?? "";
const AI_MODEL = Deno.env.get("AI_MODEL") ?? "gemini-2.0-flash";

// Category keywords mapping
const CATEGORY_KEYWORDS: Record<string, string[]> = {
  อาหาร: ["ข้าว", "อาหาร", "กิน", "ร้านอาหาร", "กาแฟ", "น้ำ", "ขนม"],
  เดินทาง: ["น้ำมัน", "รถ", "แท็กซี่", "grab", "เดินทาง", "ทางด่วน", "จอดรถ"],
  สำนักงาน: ["กระดาษ", "ปากกา", "อุปกรณ์", "สำนักงาน", "ปริ้น"],
  สาธารณูปโภค: ["ค่าไฟ", "ค่าน้ำ", "ค่าเน็ต", "อินเทอร์เน็ต", "โทรศัพท์", "ไฟฟ้า"],
  การตลาด: ["โฆษณา", "โปรโมท", "marketing", "facebook", "google ads"],
  เงินเดือน: ["เงินเดือน", "ค่าแรง", "salary", "โบนัส"],
  บริจาค: ["บริจาค", "ทำบุญ", "donation", "ถวาย"],
  ค่าเช่า: ["ค่าเช่า", "เช่า", "rent"],
  อื่นๆ: [],
};

function guessCategory(text: string): string {
  const lower = text.toLowerCase();
  for (const [cat, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
    if (keywords.some((kw) => lower.includes(kw))) return cat;
  }
  return "อื่นๆ";
}

// Regex fallback parser for common Thai formats
function regexParse(text: string): ParsedTransaction | null {
  // Patterns: "จ่าย 200 ข้าว", "รายจ่าย 500", "ค่าน้ำมัน 850", "รับเงิน 3500"
  const amountMatch = text.match(/(\d[\d,]*\.?\d*)/);
  if (!amountMatch) return null;

  const amount = parseFloat(amountMatch[1].replace(/,/g, ""));
  if (isNaN(amount) || amount <= 0) return null;

  const lower = text.toLowerCase();
  const isIncome = /รับ|รายรับ|income|รับเงิน|ขายได้/.test(lower);
  const isExpense = /จ่าย|รายจ่าย|expense|ซื้อ|ค่า/.test(lower);

  const type = isIncome && !isExpense ? "income" : "expense";
  const category = guessCategory(text);

  // Remove amount from text for description
  const description =
    text
      .replace(amountMatch[0], "")
      .replace(/^[จ่ายรับซื้อค่า]+\s*/, "")
      .trim() || category;

  return {
    type,
    amount,
    category,
    description,
    date: new Date().toISOString().split("T")[0],
    confidence: 0.75, // regex is less confident
  };
}

// AI-powered parser (Gemini API)
async function aiParse(text: string, imageBase64?: string): Promise<ParsedTransaction | null> {
  if (!AI_API_KEY) return null;

  try {
    const systemPrompt = `You are a Thai expense tracker AI. Extract transaction info from text or receipt images.
Respond in JSON format ONLY (no markdown, no code blocks):
{"type":"income|expense","amount":number,"category":"string","description":"string","merchant":"string or null","date":"YYYY-MM-DD","confidence":0.0-1.0}

Categories: อาหาร, เดินทาง, สำนักงาน, สาธารณูปโภค, การตลาด, เงินเดือน, บริจาค, ค่าเช่า, อื่นๆ
If today's date is unknown, use today. Confidence should reflect how certain you are.`;

    // Build Gemini parts
    const parts: Array<Record<string, unknown>> = [];

    if (imageBase64) {
      parts.push({
        inlineData: { mimeType: "image/jpeg", data: imageBase64 },
      });
      parts.push({ text: "Extract transaction from this receipt image. " + systemPrompt });
    } else {
      parts.push({ text: `${systemPrompt}\n\nUser input: "${text}"` });
    }

    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${AI_MODEL}:generateContent?key=${AI_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts }],
          generationConfig: { temperature: 0.1, maxOutputTokens: 300 },
        }),
      },
    );

    if (!res.ok) {
      console.error("Gemini API error:", res.status, await res.text());
      return null;
    }

    const data = await res.json();
    const raw = data.candidates?.[0]?.content?.parts?.[0]?.text ?? "";

    // Extract JSON from response
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return null;

    const parsed = JSON.parse(jsonMatch[0]);
    return {
      type: parsed.type === "income" ? "income" : "expense",
      amount: Number(parsed.amount) || 0,
      category: parsed.category || "อื่นๆ",
      description: parsed.description || "",
      merchant: parsed.merchant || undefined,
      date: parsed.date || new Date().toISOString().split("T")[0],
      confidence: Number(parsed.confidence) || 0.5,
    };
  } catch (err) {
    console.error("AI parse error:", err);
    return null;
  }
}

// Main entry point
export async function parseTransaction(
  text: string,
  imageBase64?: string,
): Promise<ParsedTransaction> {
  // Try AI first (handles images + complex text)
  const aiResult = await aiParse(text, imageBase64);
  if (aiResult && aiResult.amount > 0) return aiResult;

  // Fallback to regex for simple text
  const regexResult = regexParse(text);
  if (regexResult) return regexResult;

  // Last resort: unknown
  return {
    type: "expense",
    amount: 0,
    category: "อื่นๆ",
    description: text,
    date: new Date().toISOString().split("T")[0],
    confidence: 0.1,
  };
}
