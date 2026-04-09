const express = require('express');
const line = require('@line/bot-sdk');

const config = {
  channelAccessToken: process.env.LINE_ACCESS_TOKEN, 
  channelSecret: process.env.LINE_SECRET
};

const app = express();

app.post('/webhook', line.middleware(config), (req, res) => {
  // เมื่อคุณพิมพ์หา Bot ข้อมูลจะวิ่งมาที่นี่
  const event = req.body.events[0];
  if (event && event.type === 'message') {
    console.log('ได้รับข้อความ:', event.message.text);
  }
  res.sendStatus(200);
});

app.listen(3000, () => console.log('Server is running on port 3000'));