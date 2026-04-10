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
      messages: [{ type: 'text', text: `เห้ยย!! ตอนนี้ ${status}` }]
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
      const rows = response.data; 

      if (rows.length > 0) {
        const groupedTasks = {};
        const now = new Date();
        const currentMonth = now.getMonth(); // 0-11
        const currentYear = now.getFullYear();

        rows.forEach(row => {
          let [rawDate, type, subject, desc] = row;
          
          // แปลง rawDate จาก Sheet ให้เป็น String เสมอ
          const dateStr = String(rawDate); 
          
          // ดึงค่า วัน/เดือน/ปี จาก String (รูปแบบ 10/04/2026)
          const parts = dateStr.split('/');
          
          if (parts.length === 3) {
            const d = parts[0].padStart(2, '0');
            const m = parts[1].padStart(2, '0');
            const y = parts[2]; // 2026
            
            const now = new Date();
            const currentMonth = String(now.getMonth() + 1).padStart(2, '0');
            const currentYear = String(now.getFullYear());

            // ตรวจสอบว่า เดือน และ ปี ตรงกับปัจจุบันหรือไม่ 
            if (m === currentMonth && y === currentYear) {
              // จัดรูปแบบเป็น dd / mm / yy ตามที่คุณต้องการ [cite: 9]
              const formattedDate = `${d} / ${m} / ${y.slice(-2)}`;

              if (!groupedTasks[formattedDate]) groupedTasks[formattedDate] = [];
              groupedTasks[formattedDate].push({ type, subject, desc });
            }
          }
        });

        const thMonth = currentMonth + 1;
        const thYear = currentYear + 543;

        replyText = `เอ้อออ มา!! เอาไปดู\n📊 สรุปงานทั้งหมด ประจำเดือน ${thMonth} / ${thYear}:\n\n`;

        const sortedDates = Object.keys(groupedTasks).sort((a, b) => {
           // เรียงตามวันที่ในเดือนเดียวกัน
           return a.localeCompare(b);
        });

        if (sortedDates.length > 0) {
          let count = 1;
          for (const date of sortedDates) {
            replyText += `${count}. [${date}]\n`;
            groupedTasks[date].forEach(item => {
              const icon = item.type === 'Leave' ? '🚩 [ลา]' : '🔹';
              replyText += `    ${icon} ${item.subject}\n`;
              if (item.desc && item.desc !== "-") replyText += `        > ${item.desc}\n`;
            });
            replyText += `\n`;
            count++;
          }
        } else {
          replyText += "📁 ยังไม่มีข้อมูลโว้ย หาไม่เจอ!";
        }
      } else { replyText = "📁 แกบันทึกข้อมูลยัง!? ห๊า"; }
    } catch (e) { replyText = "❌ นะ นะ นะ นานี๊!!??"; }
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
        replyText = `Oi! ไอน้อง พี่จดไว้ให้ละ \n✅ บันทึก${isLeave ? 'วันลา' : 'งาน'}เรียบร้อย!\n📌 หัวข้อ: ${subject}\n📝 รายละเอียด: ${description || '-'}\n📅 วันที่: ${finalDate}\nจัดปายไอน้อง~~~`;
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
process.on('SIGTERM', async () => { await notifySystemStatus('ขอพักสักแปป..'); process.exit(0); });
process.on('SIGINT', async () => { await notifySystemStatus('ใครจะอยู่ก็อยู่ ไกปูวว'); process.exit(0); });

const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`Server running on port ${port}`);
  notifySystemStatus('มาเว้ยย เลสโก้ววว!!');
});