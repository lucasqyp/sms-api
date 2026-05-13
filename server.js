const express = require("express");
const fs = require("fs");

const app = express();

app.use(express.json({ limit: "2mb" }));
app.use(express.urlencoded({ extended: true }));

const PORT = process.env.PORT || 8080;

// 你的查询密钥
const API_TOKEN = "abc123";

// 本地保存短信文件
const DB_FILE = "./messages.json";

function readMessages() {
  if (!fs.existsSync(DB_FILE)) return [];
  try {
    const data = fs.readFileSync(DB_FILE, "utf8");
    return data ? JSON.parse(data) : [];
  } catch (e) {
    return [];
  }
}

function saveMessages(messages) {
  fs.writeFileSync(DB_FILE, JSON.stringify(messages, null, 2));
}

function normalizeNumber(num) {
  if (!num) return "";
  return String(num).replace(/\D/g, "");
}

function extractCode(text) {
  if (!text) return "";
  const match = String(text).match(/\b\d{4,8}\b/);
  return match ? match[0] : "";
}

// 首页测试
app.get("/", (req, res) => {
  res.send("SMS API is running.");
});

// 给浏览器测试用，防止 GET /telnyx-webhook 显示404
app.get("/telnyx-webhook", (req, res) => {
  res.status(200).send("Telnyx webhook is ready.");
});

// Telnyx 真正推送短信的入口
app.post("/telnyx-webhook", (req, res) => {
  const body = req.body || {};
  console.log("Incoming Telnyx webhook:", JSON.stringify(body));

  const payload = body.data && body.data.payload ? body.data.payload : body;

  let to = "";
  let from = "";
  let text = "";

  if (payload.to && Array.isArray(payload.to) && payload.to.length > 0) {
    to = payload.to[0].phone_number || "";
  } else if (payload.to && typeof payload.to === "string") {
    to = payload.to;
  } else if (payload.to_number) {
    to = payload.to_number;
  }

  if (payload.from && typeof payload.from === "object") {
    from = payload.from.phone_number || "";
  } else if (payload.from && typeof payload.from === "string") {
    from = payload.from;
  } else if (payload.from_number) {
    from = payload.from_number;
  }

  text =
    payload.text ||
    payload.body ||
    payload.message ||
    payload.content ||
    "";

  const record = {
    to: normalizeNumber(to),
    from: normalizeNumber(from),
    message: text,
    code: extractCode(text),
    raw: body,
    time: new Date().toISOString()
  };

  const messages = readMessages();
  messages.unshift(record);
  saveMessages(messages.slice(0, 1000));

  res.status(200).json({ ok: true });
});

// 查询某个号码最新验证码
app.get("/api/record", (req, res) => {
  const token = req.query.token;
  const number = normalizeNumber(req.query.number);

  if (token !== API_TOKEN) {
    return res.status(401).json({ error: "Invalid token" });
  }

  if (!number) {
    return res.status(400).json({ error: "Missing number" });
  }

  const messages = readMessages();

  const found = messages.find((m) => {
    const to = normalizeNumber(m.to);
    return to.endsWith(number) || number.endsWith(to);
  });

  if (!found) {
    return res.json({
      number,
      status: "waiting",
      code: "",
      message: ""
    });
  }

  res.json({
    number,
    status: "received",
    code: found.code,
    message: found.message,
    from: found.from,
    time: found.time
  });
});

// 查看全部短信，测试用
app.get("/api/all", (req, res) => {
  const token = req.query.token;

  if (token !== API_TOKEN) {
    return res.status(401).json({ error: "Invalid token" });
  }

  res.json(readMessages());
});

app.listen(PORT, () => {
  console.log(`SMS API running on port ${PORT}`);
});
