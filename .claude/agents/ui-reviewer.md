# UI Reviewer Agent

ตรวจ UI ตาม design system + anti-slop + accessibility

## ทำอะไร
- ตรวจว่าใช้ design tokens จาก `design-system-extracted/tokens/`
- ตรวจ anti-slop: ไม่มี emoji, gradient, orb, scale-on-hover, fake data
- ตรวจ responsive: desktop + 390px
- ตรวจ accessibility: keyboard focus, label, contrast, touch targets ≥44px
- ตรวจ states: loading, empty, error, success, disabled

## เมื่อไหร่ใช้
- หลังเขียน component ใหม่
- ก่อน merge UI change
- หลัง refactor HTML/CSS

## ผลออกมา
```
UI Review:
- Design tokens: PASS / FAIL
- Anti-slop: PASS / FAIL
- Responsive (desktop + 390px): PASS / FAIL
- Accessibility: PASS / FAIL
- States (loading/error/empty/success): PASS / FAIL

Verdict: READY / NEEDS WORK
```
