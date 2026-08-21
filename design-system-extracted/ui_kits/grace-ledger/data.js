window.MOCK = {
  funds: [
    { id: "general", name: "กองทุนทั่วไป", balance: 482300 },
    { id: "mission", name: "กองทุนพันธกิจ", balance: 128450 },
    { id: "building", name: "กองทุนอาคาร", balance: 950000 },
  ],
  pending: [
    { id: "1", kind: "income", description: "เงินถวายอาทิตย์ที่ 3 ส.ค.", amount: 42500, meta: "โดย คุณสมชาย · 2 ชม. ที่แล้ว" },
    { id: "2", kind: "expense", description: "ค่าซ่อมเครื่องเสียง", amount: 8200, meta: "โดย คุณวิภา · เมื่อวาน" },
    { id: "3", kind: "expense", description: "ค่าไฟฟ้าเดือน ส.ค.", amount: 15300, meta: "โดย คุณวิภา · 2 วันที่แล้ว" },
  ],
  recent: [
    { date: "3 ส.ค. 2569", desc: "ถวายรวมนมัสการ", category: "เงินถวาย", amount: 42500, tone: "income", status: "approved" },
    { date: "2 ส.ค. 2569", desc: "ค่าไฟฟ้าเดือน ส.ค.", category: "ค่าใช้จ่ายอาคาร", amount: 15300, tone: "expense", status: "pending" },
    { date: "1 ส.ค. 2569", desc: "ถวายพันธกิจพิเศษ", category: "กองทุนพันธกิจ", amount: 12000, tone: "income", status: "approved" },
    { date: "30 ก.ค. 2569", desc: "ค่าซ่อมเครื่องเสียง", category: "อุปกรณ์", amount: 8200, tone: "expense", status: "pending" },
    { date: "28 ก.ค. 2569", desc: "ถวายสิบลด คุณสมชาย", category: "เงินถวาย", amount: 6000, tone: "income", status: "approved" },
  ],
};
