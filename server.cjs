const express = require('express');
const line = require('@line/bot-sdk').messagingApi; 
const lineMiddleware = require('@line/bot-sdk').middleware;

const config = {
  channelAccessToken: process.env.LINE_ACCESS_TOKEN,
  channelSecret: process.env.LINE_SECRET
};

const client = new line.MessagingApiClient({
  channelAccessToken: config.channelAccessToken
});

const app = express();

app.post('/webhook', lineMiddleware(config), (req, res) => {
  Promise.all(req.body.events.map(handleEvent))
    .then((result) => res.json(result))
    .catch((err) => {
      console.error(err);
      res.status(500).end();
    });
});

async function handleEvent(event) {
  if (event.type !== 'message' || event.message.type !== 'text') {
    return Promise.resolve(null);
  }

  const userText = event.message.text;
  console.log('ได้รับข้อความ:', userText);

  // รูปแบบคำสั่ง: "ชื่องาน #วว/ดด/ปปปป"
  // ตัวอย่าง: "ทำรีพอร์ท SAP #12/04/2026"
  const regex = /(.+)\s#(\d{2}\/\d{2}\/\d{4})/;
  const match = userText.match(regex);

  let replyText = '';

  if (match) {
    const title = match[1].trim();
    const date = match[2];
    replyText = `✅ บันทึกงาน: ${title}\n📅 วันที่: ${date}\nลงในระบบ Worker เรียบร้อยแล้ว!`;
  } else {
    replyText = `🤖 สวัสดีครับ! ผมคือบอท Worker\n\nหากต้องการบันทึกงาน กรุณาพิมพ์ในรูปแบบ:\nชื่องาน #วัน/เดือน/ปี\n\nตัวอย่าง: ประชุมงาน #15/04/2026`;
  }

  // แก้ส่วนการส่งข้อความตอบกลับครับ
  return client.replyMessage({
    replyToken: event.replyToken,
    messages: [{
      type: 'text',
      text: replyText
    }]
  });
}

const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});