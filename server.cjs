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
      const rows = response.data; // [date, subject, description, status]

      if (rows.length > 0) {
        const groupedTasks = {};
        rows.forEach(row => {
          const [date, subject, desc] = row;
          if (!groupedTasks[date]) groupedTasks[date] = [];
          groupedTasks[date].push({ subject, desc });
        });

        const now = new Date();
        replyText = `📊 สรุปงานทั้งหมด ประจำเดือน ${now.getMonth() + 1} / ${now.getFullYear() + 543}:\n\n`;

        let count = 1;
        for (const date in groupedTasks) {
          replyText += `${count}. [${date}]\n`;
          groupedTasks[date].forEach(item => {
            replyText += `    - ${item.subject}\n`;
            if (item.desc && item.desc !== "-") replyText += `        > ${item.desc}\n`;
          });
          replyText += `\n`;
          count++;
        }
      } else {
        replyText = "📁 ยังไม่มีข้อมูลการบันทึกงานครับ";
      }
    } catch (e) { replyText = "❌ ดึงข้อมูลไม่สำเร็จ"; }
  } else {
    // Regex แยก Subject | Description #Date
    const regex = /^([^|#]+)(?:\|([^#]+))?(?:\s#(\d{2}\/\d{2}\/\d{4}))?$/;
    const match = userText.match(regex);

    if (match) {
      const subject = match[1].trim();
      const description = match[2] ? match[2].trim() : "";
      const now = new Date();
      const today = `${String(now.getDate()).padStart(2, '0')}/${String(now.getMonth() + 1).padStart(2, '0')}/${now.getFullYear()}`;
      const finalDate = match[3] || today;

      try {
        await axios.post(process.env.GOOGLE_SHEET_URL, { 
          subject, 
          description, 
          date: finalDate 
        });
        replyText = `✅ บันทึกงานเรียบร้อย!\n📌 หัวข้อ: ${subject}\n📝 รายละเอียด: ${description || '-'}\n📅 วันที่: ${finalDate}`;
      } catch (e) { replyText = "❌ บันทึกลง Sheet ไม่สำเร็จ"; }
    } else {
      replyText = "🤖 รูปแบบ: หัวข้อ | รายละเอียด #วันที่\nตัวอย่าง: ประชุม SAP | คุยเรื่องงบ #09/04/2026";
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