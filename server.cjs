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

// เก็บสถานะการถาม-ตอบของผู้ใช้
const userState = {};

async function notifySystemStatus(status) {
  try {
    await client.broadcast({
      messages: [{ type: 'text', text: `เห้ย!! ฟังให้ดี.. ระบบมัน ${status}` }]
    });
  } catch (err) { console.error('Notify error:', err); }
}

async function handleEvent(event) {
  if (event.type !== 'message' || event.message.type !== 'text') return null;
  const userId = event.source.userId;
  const userText = event.message.text.trim();
  let replyText = '';

  // --- 1. ระบบยกเลิก (Cancel) ---
  if (userText === 'ยกเลิก' || userText.toLowerCase() === 'cancel') {
    if (userState[userId]) {
      delete userState[userId];
      return client.replyMessage({
        replyToken: event.replyToken,
        messages: [{ type: 'text', text: 'โอเค ยกเลิกให้แล้ว! มีอะไรก็ว่ามาใหม่' }]
      });
    }
    return null;
  }

  // --- 2. เช็คว่าอยู่ในสถานะรอรายละเอียดงานหรือไม่ (State Management) ---
  if (userState[userId] && !userText.includes('|')) {
    const state = userState[userId];
    const subject = userText;
    const now = new Date();
    const today = `${String(now.getDate()).padStart(2, '0')}/${String(now.getMonth() + 1).padStart(2, '0')}/${now.getFullYear()}`;
    
    try {
      await axios.post(process.env.GOOGLE_SHEET_URL, { 
        type: state.type, 
        subject: subject, 
        description: "-", 
        date: today 
      });
      delete userState[userId]; // เคลียร์สถานะหลังบันทึกสำเร็จ
      replyText = `เรียบร้อย! พี่จด "${state.label}" เรื่อง: ${subject} ให้แล้วนะ!\nจดเข้าคัมภีร์เรียบร้อย!`;
    } catch (e) {
      replyText = "❌ ระบบบันทึกมีปัญหา ลองใหม่อีกทีนะ";
    }
  } 

  // --- 3. คำสั่ง Summary ---
  else if (userText.toLowerCase() === 'summary') {
    try {
      const response = await axios.get(process.env.GOOGLE_SHEET_URL);
      const rows = response.data;
      if (rows && rows.length > 0) {
        const groupedTasks = {};
        const now = new Date();
        const currentM = String(now.getMonth() + 1).padStart(2, '0');
        const currentY = String(now.getFullYear());

        rows.forEach(item => {
          const parts = String(item.date).split('/').map(p => p.trim());
          if (parts.length === 3) {
            const [d, m, y] = parts;
            if (m.padStart(2, '0') === currentM && y === currentY) {
              const formattedDate = `${d.padStart(2, '0')} / ${m.padStart(2, '0')} / ${y.slice(-2)}`;
              if (!groupedTasks[formattedDate]) groupedTasks[formattedDate] = [];
              groupedTasks[formattedDate].push(item);
            }
          }
        });

        const sortedDates = Object.keys(groupedTasks).sort();
        if (sortedDates.length > 0) {
          replyText = `📊 สรุปวีรกรรมเดือน ${parseInt(currentM)} / ${parseInt(currentY) + 543}:\n\n`;
          sortedDates.forEach((date, i) => {
            replyText += `${i + 1}. [${date}]\n`;
            groupedTasks[date].forEach(task => {
              replyText += `    ${task.type === 'Leave' ? '🚩' : '🔥'} ${task.subject}\n`;
            });
            replyText += `\n`;
          });
          replyText += `จบแค่นี้แหละเฟ้ย!`;
        } else { replyText = "📁 เดือนนี้ยังไม่มีวีรกรรมอะไรเลยเรอะ!?"; }
      } else { replyText = "📁 โล่งโจ้ง!! ยังไม่เคยบันทึกอะไรเลยสินะ"; }
    } catch (e) { replyText = "❌ ระบบพังเฉยเลยโว้ยย!!"; }
  } 
  
  // --- 4. ระบบบันทึก (รองรับทั้ง Rich Menu และ พิมพ์เอง) ---
  else {
    const regex = /^([^|#]+)(?:\|([^#]+))?(?:\s#(\d{2}\/\d{2}\/\d{4}))?$/;
    const match = userText.match(regex);

    if (match) {
      const inputHeader = match[1].trim();
      const description = match[2] ? match[2].trim() : "";

      // กรณีที่ 1: กดปุ่มจาก Rich Menu มา (ไม่มีรายละเอียดต่อท้าย)
      const menuActions = {
        'ลงงาน': { type: 'Work', label: 'ลงงาน' },
        'ลาป่วย': { type: 'Leave', label: 'ลาป่วย' },
        'ลากิจ': { type: 'Leave', label: 'ลากิจ' }
      };

      if (description === "" && menuActions[inputHeader]) {
        userState[userId] = menuActions[inputHeader];
        replyText = `โอเค! จะ ${inputHeader} เรื่องอะไรล่ะ? พิมพ์ชื่อเรื่องส่งมาเลย!!\n(หรือพิมพ์ 'ยกเลิก' เพื่อออก)`;
      } 
      // กรณีที่ 2: พิมพ์รูปแบบเดิม (มีรายละเอียดครบ)
      else if (userText.includes('|')) {
        const now = new Date();
        const today = `${String(now.getDate()).padStart(2, '0')}/${String(now.getMonth() + 1).padStart(2, '0')}/${now.getFullYear()}`;
        const finalDate = match[3] || today;
        const isLeave = inputHeader.includes('ลา');
        
        try {
          await axios.post(process.env.GOOGLE_SHEET_URL, { 
            type: isLeave ? 'Leave' : 'Work', 
            subject: inputHeader, 
            description, 
            date: finalDate 
          });
          replyText = `Oi! ไอน้อง!! พี่จดไว้ให้ละ!\n📌 เรื่อง: ${inputHeader}\n📅 วันที่: ${finalDate}\nจดเรียบร้อย!`;
        } catch (e) { replyText = "❌ บันทึกไม่ได้โว้ย!!"; }
      }
    }
  }

  if (replyText) {
    return client.replyMessage({
      replyToken: event.replyToken,
      messages: [{ type: 'text', text: replyText }]
    });
  }
}

app.post('/webhook', lineMiddleware(config), (req, res) => {
  Promise.all(req.body.events.map(handleEvent)).then((result) => res.json(result));
});

const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`Server running on port ${port}`);
  notifySystemStatus('ออนไลน์แล้วโว้ยย!!'); // เปิดใช้ถ้าต้องการ
});