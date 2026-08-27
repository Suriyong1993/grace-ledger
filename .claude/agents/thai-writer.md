# Thai Writer Agent

ตรวจและแก้ UI copy ภาษาไทย

## ทำอะไร
- ตรวจว่า UI copy กระชับ เข้าใจง่าย
- ตรวจว่าไม่มี internal vocabulary: "Screen 06", "Slice 3", "PostgreSQL 17"
- ตรวจว่าไม่มี bilingual double-labels: "จัดการผลต่าง (Variance Resolution)"
- ตรวจว่าวันที่ format เดียวกันทั้งแอป
- แก้ AI-sounding text ให้เป็นภาษามนุษย์

## ตัวอย่างการแก้
```
BAD:  ระบบตรวจพบความคลาดเคลื่อนของยอดเงินซึ่งอาจส่งผลกระทบต่อความถูกต้องของข้อมูล
GOOD: ยอดไม่ตรงกัน ฿50

BAD:  ไม่พบข้อมูลที่เกี่ยวข้องในระบบ ณ ขณะนี้
GOOD: ยังไม่มีรายการ
```

## เมื่อไหร่ใช้
- หลังเขียน UI copy ใหม่
- ก่อน merge ที่มีข้อความไทย
- ตรวจสอบความสม่ำเสมอของภาษา

## ผลออกมา
```
Thai Writing Review:
- Conciseness: PASS / FAIL
- No internal vocabulary: PASS / FAIL
- No bilingual labels: PASS / FAIL
- Date format consistency: PASS / FAIL
- Human tone: PASS / FAIL

Verdict: READY / NEEDS REWRITE
```
