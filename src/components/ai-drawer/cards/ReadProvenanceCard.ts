import { formatDateThai } from "../../../lib/format";
import { escapeHtml } from "../html";
import type { ReadMessageContent } from "../types";

/**
 * READ card — facts first, clearly-separated AI interpretation, and a
 * provenance footer (period, source tool, included/excluded counts, time).
 */
export function renderReadProvenanceCard(content: ReadMessageContent): string {
  const facts = content.facts
    .map(
      (fact) =>
        `<div class="gl-aid-fact"><span>${escapeHtml(fact.label)}</span><strong class="num-display">${escapeHtml(fact.value)}</strong></div>`
    )
    .join("");
  const excludedRow =
    content.provenance.excludedCount > 0
      ? `<div class="gl-aid-prov-row"><span>รายการที่ยกเว้น</span><span>${content.provenance.excludedCount} รายการ</span></div>`
      : "";
  return `
    <div class="gl-aid-card">
      <span class="gl-aid-card-label">${escapeHtml(content.title)}</span>
      <div class="gl-aid-facts">${facts}</div>
      ${content.analysis ? `<p class="gl-aid-note">${escapeHtml(content.analysis)}</p>` : ""}
      ${
        content.interpretation
          ? `<p class="gl-aid-note gl-aid-note--ai">การตีความของ AI: ${escapeHtml(content.interpretation)}</p>`
          : ""
      }
      <div class="gl-aid-provenance" aria-label="แหล่งที่มาของข้อมูล">
        <div class="gl-aid-prov-row"><span>ช่วงข้อมูล</span><span>${escapeHtml(content.provenance.period)}</span></div>
        <div class="gl-aid-prov-row"><span>เครื่องมือแหล่งข้อมูล</span><span>${escapeHtml(content.provenance.sourceTool)}</span></div>
        <div class="gl-aid-prov-row"><span>รายการที่นำมาคำนวณ</span><span>${content.provenance.includedCount} รายการ</span></div>
        ${excludedRow}
        <div class="gl-aid-prov-row"><span>คำนวณเมื่อ</span><span>${escapeHtml(formatDateThai(content.provenance.generatedAt))}</span></div>
      </div>
    </div>
  `;
}
