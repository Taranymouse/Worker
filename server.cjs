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

// เก็บสถานะการพิมพ์ของผู้ใช้
const userState = {};

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
        messages: [{ type: 'text', text: 'โอเคไอน้อง! ยกเลิกให้ละ มีอะไรก็ว่ามาใหม่!!' }]
      });
    }
    return null;
  }

  // --- 2. เช็คว่าอยู่ในสถานะรอคำตอบหรือไม่ (Conversational State) ---
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
      
      delete userState[userId]; // บันทึกเสร็จแล้วเคลียร์สถานะ
      replyText = `เรียบร้อย! พี่จด "${state.label}" เรื่อง: ${subject} ให้แล้วนะเฟ้ย!!\nจัดไปไอน้อง~~~`;
    } catch (e) {
      replyText = "❌ บันทึกไม่ได้โว้ย!! ระบบมันมีปัญหา!!";
    }
  } 

  // --- 3. คำสั่ง Summary ---
  else if (userText.toLowerCase() === 'summary') {
    try {
      const response = await axios.get(process.env.GOOGLE_SHEET_URL);
      const rows = response.data; 

      if (rows.length > 0) {
        const now = new Date();
        const currentMonth = now.getMonth();
        const currentYear = now.getFullYear();

        const filteredRows = rows.filter(row => {
          if (!row.date) return false;
          const [d, m, y] = row.date.split('/');
          return parseInt(m) - 1 === currentMonth && parseInt(y) === currentYear;
        });

        if (filteredRows.length === 0) {
          replyText = "📅 เดือนนี้ยังไม่มีวีรกรรมอะไรเลยนะไอน้อง! ไปทำงานซะ!!";
        } else {
          let summary = `📊 สรุปวีรกรรมเดือน ${now.toLocaleString('default', { month: 'long' })}:\n`;
          filteredRows.forEach((row, index) => {
            summary += `${index + 1}. [${row.date}] ${row.type}: ${row.subject}\n`;
          });
          replyText = summary;
        }
      } else {
        replyText = "ไม่มีข้อมูลในระบบเลยว่ะ!";
      }
    } catch (e) { replyText = "ดึงข้อมูลไม่ได้โว้ย!!"; }
  }

  // --- 4. ตรวจสอบการบันทึก (ทั้งแบบพิมพ์ตรงและแบบกดปุ่ม) ---
  else {
    const match = userText.match(/^([^|#]+)(?:\|([^#]*))?(?:#(.+))?$/);
    
    if (match) {
      const subject = match[1].trim();
      const description = match[2] ? match[2].trim() : "";
      
      // กรณีที่ 1: กดปุ่มจาก Rich Menu มาแค่คำสั่ง (ไม่มีรายละเอียดต่อท้าย)
      if (description === "" && (subject === "ลงงาน" || subject === "ลาป่วย" || subject === "ลากิจ")) {
        const typeMap = { 'ลงงาน': 'Work', 'ลาป่วย': 'Leave', 'ลากิจ': 'Leave' };
        userState[userId] = { type: typeMap[subject], label: subject };
        replyText = `จะ ${subject} เรื่องอะไรล่ะ? พิมพ์ส่งมาเลย!!\n(หรือพิมพ์ 'ยกเลิก' เพื่อออก)`;
      } 
      // กรณีที่ 2: พิมพ์รูปแบบเดิม (มีรายละเอียดครบ)
      else if (userText.includes('|')) {
        const now = new Date();
        const today = `${String(now.getDate()).padStart(2, '0')}/${String(now.getMonth() + 1).padStart(2, '0')}/${now.getFullYear()}`;
        const finalDate = match[3] ? match[3].trim() : today;
        const isLeave = subject.includes('ลา');
        const recordType = isLeave ? 'Leave' : 'Work';

        try {
          await axios.post(process.env.GOOGLE_SHEET_URL, { 
            type: recordType, subject, description, date: finalDate 
          });
          replyText = `Oi! ไอน้อง!! พี่จด${isLeave ? 'การหนี' : 'งาน'}ไว้ให้ละ!\\n📌 เรื่อง: ${subject}\\n📝 รายละเอียด: ${description || '-'}\\n📅 วันที่: ${finalDate}\\nจดเรียบร้อย! อย่าลืมไปทำล่ะเฟ้ย!!`;
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
  // ปิด notifySystemStatus เพื่อความสะอาดของแชท
});