#!/usr/bin/env python3
"""
analyze-ui-reference.py — read a UI screenshot for an agent that cannot see it.

The agent working on this repo has no vision capability, so reference images
have to be converted into *text*: what the screen says, where the blocks sit,
and which colours/weights the design uses.

Usage:
    python3 scripts/analyze-ui-reference.py <image|glob> [<image|glob> ...]
    python3 scripts/analyze-ui-reference.py ../uploads/*.png --out docs/ui-reference.md

Output: a markdown report with, per image
  * dimensions + orientation (phone vs desktop)
  * dominant colour palette (hex + share of pixels)
  * OCR text grouped into visual rows (with y positions, so layout is readable)
  * detected horizontal bands (large blocks of near-uniform colour => cards)
Requires: pillow, rapidocr-onnxruntime (both installable from PyPI).
"""
from __future__ import annotations

import argparse
import glob
import os
import sys
from collections import Counter

from PIL import Image

PALETTE_N = 10
MIN_BLOCK_HEIGHT = 24


def load_ocr():
    try:
        from rapidocr_onnxruntime import RapidOCR
    except ImportError:  # pragma: no cover - dependency hint
        print(
            "! rapidocr-onnxruntime missing — install with:\n"
            "  pip install --break-system-packages pillow rapidocr-onnxruntime",
            file=sys.stderr,
        )
        return None
    return RapidOCR()


def human_size(w: int, h: int) -> str:
    if h > w:
        return f"{w}x{h} (แนวตั้ง — น่าจะมือถือ)"
    return f"{w}x{h} (แนวนอน — น่าจะเดสก์ท็อป/แท็บเล็ต)"


def palette(img: Image.Image, n: int = PALETTE_N):
    small = img.convert("RGB").resize((320, int(320 * img.height / img.width) or 1))
    quant = small.quantize(colors=n, method=Image.MEDIANCUT).convert("RGB")
    counts = Counter(quant.getdata())
    total = sum(counts.values())
    return [
        (f"#{r:02X}{g:02X}{b:02X}", round(count / total * 100, 1))
        for (r, g, b), count in counts.most_common(n)
    ]


def luminance(rgb) -> float:
    r, g, b = rgb
    return 0.2126 * r + 0.7152 * g + 0.0722 * b


def bands(img: Image.Image):
    """Detect horizontal bands of near-uniform colour (cards / sections)."""
    small = img.convert("RGB")
    w, h = small.size
    small = small.resize((1, h))  # collapse rows to their average colour
    px = list(small.getdata())
    out, start, prev = [], 0, px[0]
    for y in range(1, h):
        cur = px[y]
        if abs(luminance(cur) - luminance(prev)) > 6:
            if y - start >= MIN_BLOCK_HEIGHT:
                out.append((start, y, f"#{prev[0]:02X}{prev[1]:02X}{prev[2]:02X}"))
            start, prev = y, cur
        prev = cur
    if h - start >= MIN_BLOCK_HEIGHT:
        out.append((start, h, f"#{prev[0]:02X}{prev[1]:02X}{prev[2]:02X}"))
    return [b for b in out][:40]


def group_rows(results, tolerance: int = 14):
    """Group OCR boxes into visual rows by their vertical centre."""
    rows: list[list] = []
    for box, text, score in sorted(results, key=lambda r: (r[0][0][1], r[0][0][0])):
        ys = [p[1] for p in box]
        xs = [p[0] for p in box]
        cy = sum(ys) / len(ys)
        placed = False
        for row in rows:
            if abs(row["cy"] - cy) <= tolerance:
                row["items"].append((min(xs), text, score))
                row["sum"] += cy
                row["cy"] = row["sum"] / len(row["items"])
                placed = True
                break
        if not placed:
            rows.append({"cy": cy, "sum": cy, "items": [(min(xs), text, score)]})
    for row in rows:
        row["items"].sort()
        row.pop("sum", None)
    rows.sort(key=lambda r: r["cy"])
    return rows


def analyse(path: str, ocr) -> str:
    img = Image.open(path)
    w, h = img.size
    lines = [f"## {os.path.basename(path)}", "", f"- ขนาด: {human_size(w, h)}"]

    lines.append("")
    lines.append("### สีหลัก (palette)")
    lines.append("")
    lines.append("| สี | สัดส่วน |")
    lines.append("| :--- | ---: |")
    for hexv, pct in palette(img):
        lines.append(f"| `{hexv}` | {pct}% |")

    lines.append("")
    lines.append("### แถบแนวนอน (บล็อก/การ์ดที่ตรวจพบ)")
    lines.append("")
    lines.append("| จาก px | ถึง px | สีเฉลี่ย |")
    lines.append("| ---: | ---: | :--- |")
    for y0, y1, hexv in bands(img):
        lines.append(f"| {y0} | {y1} | `{hexv}` |")

    lines.append("")
    lines.append("### ข้อความในภาพ (OCR)")
    if ocr is None:
        lines.append("")
        lines.append("_OCR ไม่พร้อมใช้งาน (ติดตั้ง rapidocr-onnxruntime ก่อน)_")
    else:
        result, _ = ocr(path)
        if not result:
            lines.append("")
            lines.append("_ไม่พบข้อความ (อาจเป็นภาพที่ไม่มีตัวอักษร หรือ OCR อ่านไม่ออก)_")
        else:
            lines.append("")
            lines.append("| แถว (y) | ข้อความ |")
            lines.append("| ---: | :--- |")
            for row in group_rows(result):
                text = " · ".join(t for _, t, _ in row["items"])
                lines.append(f"| {int(row['cy'])} | {text} |")
    lines.append("")
    return "\n".join(lines)


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("inputs", nargs="+", help="image paths or globs")
    ap.add_argument("--out", default="docs/ui-reference.md")
    args = ap.parse_args()

    paths: list[str] = []
    for pattern in args.inputs:
        matches = sorted(glob.glob(pattern))
        paths.extend(matches if matches else [pattern])
    paths = [p for p in paths if os.path.exists(p)]
    if not paths:
        print("ไม่พบไฟล์ภาพที่ระบุ", file=sys.stderr)
        return 1

    ocr = load_ocr()
    report = [
        "# การวิเคราะห์ภาพอ้างอิง UI (auto-generated)",
        "",
        "สร้างโดย `scripts/analyze-ui-reference.py` — สำหรับเอเจนต์ที่มองเห็นภาพไม่ได้",
        "",
    ]
    for p in paths:
        print(f"· analysing {p}", file=sys.stderr)
        report.append(analyse(p, ocr))

    os.makedirs(os.path.dirname(args.out) or ".", exist_ok=True)
    with open(args.out, "w", encoding="utf-8") as fh:
        fh.write("\n".join(report))
    print(f"✓ เขียนรายงานที่ {args.out}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
