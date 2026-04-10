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

// --- ฟังก์ชันแจ้งเตือนระบบ (สายบู๊) ---
async function notifySystemStatus(status) {
  try {
    await client.broadcast({
      messages: [{ type: 'text', text: `เห้ย!! ฟังให้ดี.. ระบบมัน ${status} แล้วนะเฟ้ย!!` }]
    });
  } catch (err) { console.error('Notify error:', err); }
}

async function handleEvent(event) {
  if (event.type !== 'message' || event.message.type !== 'text') return null;
  const userText = event.message.text.trim();
  let replyText = '';

  // 1. คำสั่ง Summary (รวมพลแก๊ง)
  if (userText.toLowerCase() === 'summary') {
    try {
      const response = await axios.get(process.env.GOOGLE_SHEET_URL);
      const rows = response.data; 

      if (rows.length > 0) {
        const groupedTasks = {};
        const now = new Date();
        const currentM = String(now.getMonth() + 1).padStart(2, '0');
        const currentY = String(now.getFullYear());

        rows.forEach(row => {
          let [dateStr, type, subject, desc] = row;
          const parts = String(dateStr).split('/');
          
          if (parts.length === 3) {
            const d = parts[0].padStart(2, '0');
            const m = parts[1].padStart(2, '0');
            const y = parts[2];

            // กรองเอาเฉพาะเดือนปัจจุบัน [cite: 10]
            if (m === currentM && y === currentY) {
              const formattedDate = `${d} / ${m} / ${y.slice(-2)}`;
              if (!groupedTasks[formattedDate]) groupedTasks[formattedDate] = [];
              groupedTasks[formattedDate].push({ type, subject, desc });
            }
          }
        });

        const thMonth = parseInt(currentM);
        const thYear = parseInt(currentY) + 543;

        replyText = `เอ้ออออ!! บัญชีหนังหมามาแล้ว!!\n📊 สรุปวีรกรรมประจำเดือน ${thMonth} / ${thYear}:\n\n`;

        const sortedDates = Object.keys(groupedTasks).sort();

        if (sortedDates.length > 0) {
          let count = 1;
          for (const date of sortedDates) {
            replyText += `${count}. [${date}]\n`;
            groupedTasks[date].forEach(item => {
              const icon = item.type === 'Leave' ? '🚩 [หนีเที่ยว]' : '🔥';
              replyText += `    ${icon} ${item.subject}\n`;
              if (item.desc && item.desc !== "-") replyText += `        > ${item.desc}\n`;
            });
            replyText += `\n`;
            count++;
          }
          replyText += `จบแค่นี้แหละเฟ้ย! แยกย้าย!!`;
        } else {
          replyText = "📁 เดือนนี้ยังไม่มีวีรกรรมอะไรเลยเรอะ!? กระจอกจริง!!";
        }
      } else { replyText = "📁 โล่งโจ้ง!! แกยังไม่เคยบันทึกอะไรเลยสินะ ห๊าา!?"; }
    } catch (e) { replyText = "❌ นะ นะ นะ นานี๊!!?? ระบบพังเฉยเลยโว้ยย!!"; }
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
      const isLeave = subject.includes('ลา');
      const recordType = isLeave ? 'Leave' : 'Work';

      try {
        await axios.post(process.env.GOOGLE_SHEET_URL, { 
          type: recordType, subject, description, date: finalDate 
        });
        replyText = `Oi! ไอน้อง!! พี่จด${isLeave ? 'การหนี' : 'งาน'}ไว้ให้ละ!\n📌 เรื่อง: ${subject}\n📝 รายละเอียด: ${description || '-'}\n📅 วันที่: ${finalDate}\nจดไว้ในคัมภีร์เรียบร้อย! อย่าลืมไปทำล่ะเฟ้ย!!`;
      } catch (e) { replyText = "❌ บันทึกไม่ได้โว้ย!! จะหาเรื่องกันรึไง!?"; }
    } else {
      replyText = "🤖 เห้ย!! พิมพ์ให้มันถูกหน่อยสิฟะ!\nรูปแบบ: หัวข้อ | รายละเอียด #วันที่\n\n💡 ตัวอย่างจัดหนัก:\nซัดกับหัวหน้า | ใช้ท่าไม้ตาย #15/04/2026";
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

// สัญญาณปิด/เปิด
process.on('SIGTERM', async () => { await notifySystemStatus('ขอไปงีบก่อน.. อย่ามากวนล่ะ!'); process.exit(0); });
process.on('SIGINT', async () => { await notifySystemStatus('ใครจะอยู่ก็อยู่.. ข้าไปล่ะ! ไกปูววว!!'); process.exit(0); });

const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`Server running on port ${port}`);
  notifySystemStatus('ออนไลน์แล้วโว้ยย!! ใครมีปัญหาอะไรก็เข้ามา!!');
});