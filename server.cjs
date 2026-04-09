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

async function handleEvent(event) {
  if (event.type !== 'message' || event.message.type !== 'text') return null;

  const userText = event.message.text.trim();
  let replyText = '';

  if (userText.toLowerCase() === 'summary') {
    try {
      const response = await axios.get(process.env.GOOGLE_SHEET_URL);
      const rows = response.data;
      if (rows.length > 0) {
        replyText = "📊 สรุปงานทั้งหมด:\n\n";
        rows.forEach((row, i) => {
          replyText += `${i+1}. [${row[0]}] ${row[1]}\n`;
        });
      } else {
        replyText = "📁 ยังไม่มีข้อมูลการบันทึกงาน";
      }
    } catch (e) { replyText = "❌ ไม่สามารถดึงข้อมูลได้"; }
  } else {
    // แยกชื่องาน และ วันที่ (ถ้ามี)
    const regex = /(.+?)(?:\s#(\d{2}\/\d{2}\/\d{4}))?$/;
    const match = userText.match(regex);

    if (match) {
      const title = match[1].trim();
      const now = new Date();
      const today = `${String(now.getDate()).padStart(2, '0')}/${String(now.getMonth() + 1).padStart(2, '0')}/${now.getFullYear()}`;
      const finalDate = match[2] || today;

      try {
        await axios.post(process.env.GOOGLE_SHEET_URL, { title, date: finalDate });
        replyText = `✅ บันทึกสำเร็จ!\n📝: ${title}\n📅: ${finalDate}\nแยกแผ่นงานให้แล้วครับ`;
      } catch (e) { replyText = "❌ บันทึกลง Sheet ไม่สำเร็จ"; }
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

const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`Server running on port ${port}`));