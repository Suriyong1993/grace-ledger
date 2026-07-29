// supabase/functions/line-webhook/index.ts
// LINE Messaging API webhook — receives messages, parses transactions via AI,
// inserts into expenses/incomes, and replies with confirmation.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { parseTransaction } from "./ai-parser.ts";

const LINE_CHANNEL_SECRET = Deno.env.get("LINE_CHANNEL_SECRET")!;
const LINE_CHANNEL_ACCESS_TOKEN = Deno.env.get("LINE_CHANNEL_ACCESS_TOKEN")!;

// Verify LINE signature (HMAC-SHA256)
async function verifySignature(body: string, signature: string): Promise<boolean> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(LINE_CHANNEL_SECRET),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(body));
  const expected = btoa(String.fromCharCode(...new Uint8Array(sig)));
  return expected === signature;
}

// Send reply message via LINE API
async function replyMessage(replyToken: string, messages: Array<{ type: string; text: string }>) {
  await fetch("https://api.line.me/v2/bot/message/reply", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${LINE_CHANNEL_ACCESS_TOKEN}`,
    },
    body: JSON.stringify({ replyToken, messages }),
  });
}

serve(async (req) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  const body = await req.text();
  const signature = req.headers.get("x-line-signature") ?? "";

  // Verify signature
  if (!(await verifySignature(body, signature))) {
    return new Response("Invalid signature", { status: 401 });
  }

  // ACK immediately to avoid LINE timeout
  const { events } = JSON.parse(body);

  // Process events asynchronously
  (async () => {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { autoRefreshToken: false, persistSession: false } },
    );

    for (const event of events) {
      try {
        if (event.type !== "message") continue;
        const { replyToken, source, message } = event;
        const lineUserId = source?.userId;
        if (!lineUserId) continue;

        // Look up linked user
        const { data: lineUser } = await supabase
          .from("line_users")
          .select("church_id, user_id")
          .eq("line_user_id", lineUserId)
          .single();

        if (!lineUser) {
          await replyMessage(replyToken, [
            {
              type: "text",
              text: "❌ ยังไม่ได้เชื่อมต่อบัญชี LINE\nกรุณาเชื่อมต่อผ่านหน้าตั้งค่าในระบบก่อน",
            },
          ]);
          continue;
        }

        let text = "";
        let imageBase64: string | undefined;

        if (message.type === "text") {
          text = message.text;
        } else if (message.type === "image") {
          // Download image content from LINE
          const contentRes = await fetch(
            `https://api-data.line.me/v2/bot/message/${message.id}/content`,
            { headers: { Authorization: `Bearer ${LINE_CHANNEL_ACCESS_TOKEN}` } },
          );
          if (contentRes.ok) {
            const buf = await contentRes.arrayBuffer();
            imageBase64 = btoa(String.fromCharCode(...new Uint8Array(buf)));
          }
          text = "[receipt image]";
        } else {
          await replyMessage(replyToken, [
            { type: "text", text: "รองรับเฉพาะข้อความและรูปใบเสร็จครับ" },
          ]);
          continue;
        }

        // AI parse
        const result = await parseTransaction(text, imageBase64);

        if (result.confidence < 0.9) {
          await replyMessage(replyToken, [
            {
              type: "text",
              text: `🤔 ไม่แน่ใจว่าเข้าใจถูกต้อง:\n\nประเภท: ${result.type === "income" ? "รายรับ" : "รายจ่าย"}\nจำนวน: ฿${result.amount.toLocaleString()}\nหมวด: ${result.category}\nหมายเหตุ: ${result.description}\n\nพิมพ์ "ยืนยัน" เพื่อบันทึก หรือพิมพ์แก้ไข`,
            },
          ]);
          continue;
        }

        // Insert transaction
        const table = result.type === "income" ? "incomes" : "expenses";
        const insertData: Record<string, unknown> = {
          church_id: lineUser.church_id,
          date: result.date,
          amount: result.amount,
          description: result.description,
          created_by: lineUser.user_id ?? "line-bot",
          status: "pending",
          source: "line",
          line_message_id: message.id,
        };

        if (result.type === "expense") {
          insertData.vendor = result.merchant ?? "";
        }

        const { error: insertError } = await supabase.from(table).insert(insertData);

        if (insertError) {
          await replyMessage(replyToken, [
            { type: "text", text: `❌ บันทึกไม่สำเร็จ: ${insertError.message}` },
          ]);
          continue;
        }

        const emoji = result.type === "income" ? "💰" : "💸";
        await replyMessage(replyToken, [
          {
            type: "text",
            text: `${emoji} บันทึกแล้ว!\n\n${result.type === "income" ? "รายรับ" : "รายจ่าย"}: ฿${result.amount.toLocaleString()}\nหมวด: ${result.category}\n${result.description}\nวันที่: ${result.date}`,
          },
        ]);
      } catch (err) {
        console.error("LINE webhook event error:", err);
      }
    }
  })();

  // Return 200 immediately
  return new Response("OK", { status: 200 });
});
