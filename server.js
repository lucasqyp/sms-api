const express = require("express");
const fs = require("fs");

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3000;

// 修改成你自己的密钥
const API_TOKEN = "abc123";

// 保存短信的文件
const DB_FILE = "./messages.json";

function readMessages() {
  if (!fs.existsSync(DB_FILE)) return [];
  return JSON.parse(fs.readFileSync(DB_FILE));
}

function saveMessages(messages) {
  fs.writeFileSync(DB_FILE, JSON.stringify(messages, null, 2));
}

// 首页测试
app.get("/", (req, res) => {
  res.send("SMS API is running.");
});

// Telnyx webhook
app.post("/telnyx-webhook", (req, res) => {
  const body = req.body;

  const text =
    body?.data?.payload?.text || "";

  const to =
    body?.data?.payload?.to?.[0]?.phone_number || "";

  const codeMatch = text.match(/\d{4,8}/);

  const record = {
    number: to,
    message: text,
    code: codeMatch ? codeMatch[0] : "",
    time: new Date().toISOString()
  };

  const messages = readMessages();

  messages.unshift(record);

  saveMessages(messages.slice(0, 1000));

  res.sendStatus(200);
});

// API查询验证码
app.get("/api/record", (req, res) => {
  const token = req.query.token;
  const number = req.query.number;

  if (token !== API_TOKEN) {
    return res.status(401).json({
      error: "Invalid token"
    });
  }

  const messages = readMessages();

  const msg = messages.find(
    m => m.number.includes(number)
  );

  if (!msg) {
    return res.json({
      status: "waiting"
    });
  }

  res.json(msg);
});

app.listen(PORT, () => {
  console.log(`Running on ${PORT}`);
});