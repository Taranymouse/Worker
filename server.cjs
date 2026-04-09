const express = require('express');
const line = require('@line/bot-sdk').messagingApi;
const lineMiddleware = require('@line/bot-sdk').middleware;
const axios = require('axios');

const config = {
  channelAccessToken: process.env.LINE_ACCESS_TOKEN,
  channelSecret: process.env.LINE_SECRET
};

const client = new line.MessagingApiClient({ channelAccessToken: config.channelAccessToken });
const app = express();

// --- ฟังก์ชันแจ้งเตือนระบบ ---
async function notifySystemStatus(status) {
  try {
    await client.broadcast({
      messages: [{ type: 'text', text: `📢 แจ้งเตือน: ระบบ WORKER ${status}` }]
    });
  } catch (err) { console.error('Notify error:', err); }
}

async function handleEvent(event) {
  if (event.type !== 'message' || event.message.type !== 'text') return null;

  const userText = event.message.text.trim();
  let replyText = '';

  // 1. คำสั่ง Summary
  if (userText.toLowerCase() === 'summary') {
    try {
      const response = await axios.get(process.env.GOOGLE_SHEET_URL);
      const rows = response.data; // [date, type, subject, desc]

      if (rows.length > 0) {
        const groupedTasks = {};
        rows.forEach(row => {
          const [date, type, subject, desc] = row;
          if (!groupedTasks[date]) groupedTasks[date] = [];
          groupedTasks[date].push({ type, subject, desc });
        });

        const now = new Date();
        replyText = `📊 สรุปรายงานประจำเดือน ${now.getMonth() + 1} / ${now.getFullYear() + 543}:\n\n`;

        let count = 1;
        for (const date in groupedTasks) {
          replyText += `${count}. [${date}]\n`;
          groupedTasks[date].forEach(item => {
            const icon = item.type === 'Leave' ? '🚩 [ลา]' : '🔹';
            replyText += `    ${icon} ${item.subject}\n`;
            if (item.desc && item.desc !== "-") replyText += `        > ${item.desc}\n`;
          });
          replyText += `\n`;
          count++;
        }
      } else { replyText = "📁 ยังไม่มีข้อมูลบันทึกครับ"; }
    } catch (e) { replyText = "❌ ดึงข้อมูลไม่สำเร็จ"; }
  } 
  
  // 2. ระบบบันทึก (Work/Leave)
  else {
    const regex = /^([^|#]+)(?:\|([^#]+))?(?:\s#(\d{2}\/\d{2}\/\d{4}))?$/;
    const match = userText.match(regex);

    if (match) {
      const subject = match[1].trim();
      const description = match[2] ? match[2].trim() : "";
      const now = new Date();
      const today = `${String(now.getDate()).padStart(2, '0')}/${String(now.getMonth() + 1).padStart(2, '0')}/${now.getFullYear()}`;
      const finalDate = match[3] || today;

      // ตรวจสอบว่าเป็นวันลาหรือไม่ (ถ้ามีคำว่า 'ลา' ในหัวข้อ)
      const isLeave = subject.includes('ลา');
      const recordType = isLeave ? 'Leave' : 'Work';

      try {
        await axios.post(process.env.GOOGLE_SHEET_URL, { 
          type: recordType,
          subject, 
          description, 
          date: finalDate 
        });
        replyText = `✅ บันทึก${isLeave ? 'วันลา' : 'งาน'}สำเร็จ!\n📌 หัวข้อ: ${subject}\n📝 รายละเอียด: ${description || '-'}\n📅 วันที่: ${finalDate}`;
      } catch (e) { replyText = "❌ บันทึกไม่สำเร็จ"; }
    } else {
      replyText = "🤖 รูปแบบ: หัวข้อ | รายละเอียด #วันที่\n\n💡 ตัวอย่างบันทึกงาน:\nประชุม SAP | คุยเรื่องงบ\n\n💡 ตัวอย่างบันทึกวันลา:\nลากิจ | ไปทำธุระที่อำเภอ #15/04/2026";
    }
  }

  return client.replyMessage({
    replyToken: event.replyToken,
    messages: [{ type: 'text', text: replyText }]
  });
}

app.post('/webhook', lineMiddleware(config), (req, res) => {
  Promise.all(req.body.events.map(handleEvent)).then((result) => res.json(result));
});

// ดักจับสัญญาณปิด/เปิด
process.on('SIGTERM', async () => { await notifySystemStatus('กำลังปิดตัวลง (Sleep)'); process.exit(0); });
process.on('SIGINT', async () => { await notifySystemStatus('หยุดทำงาน (Manual Stop)'); process.exit(0); });

const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`Server running on port ${port}`);
  notifySystemStatus('พร้อมใช้งานแล้ว (Online)');
});