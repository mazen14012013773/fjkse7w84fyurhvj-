const express = require("express");
const app = express();
const http = require("http").createServer(app);
const io = require("socket.io")(http);
const QRCode = require("qrcode");
const os = require("os");

app.use(express.static("public"));

const PORT = Number(process.env.PORT) || 3000;
const FINISH = 10;
const ANSWER_TIME = 15;

function getIP() {
  const nets = os.networkInterfaces();
  for (const name of Object.keys(nets)) {
    for (const net of nets[name]) {
      if (net.family === "IPv4" && !net.internal) return net.address;
    }
  }
  return "localhost";
}

let timer = null;
let game = {
  open: true,
  contestName: "سباق الفرق",
  teams: [],
  order: [],
  current: null,
  winner: null,
  qr: ""
};

async function makeQR() {
  const url = `${getBaseUrl()}/join.html`;
  game.qr = await QRCode.toDataURL(url);
}
makeQR();

function getBaseUrl() {
  if (process.env.APP_URL) return process.env.APP_URL.replace(/\/$/, "");
  if (process.env.RAILWAY_PUBLIC_DOMAIN) return `https://${process.env.RAILWAY_PUBLIC_DOMAIN}`;
  return `http://${getIP()}:${PORT}`;
}

function shuffleTeams() {
  game.order = [...game.teams];
  for (let i = game.order.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [game.order[i], game.order[j]] = [game.order[j], game.order[i]];
  }
}

function clearTimer() {
  if (timer) { clearTimeout(timer); timer = null; }
}

function startTurn() {
  if (!game.teams.length || game.winner) return;
  if (game.current) return;
  if (game.order.length === 0) shuffleTeams();

  game.current = game.order.shift();
  io.to(game.current.id).emit("receiveDice", ANSWER_TIME);
  io.emit("state", game);

  clearTimer();
  timer = setTimeout(() => {
    if (game.current) {
      io.emit("noAnswer", game.current.name);
      game.current = null;
      startTurn(); // انتقال تلقائي عند انتهاء الوقت
    }
  }, ANSWER_TIME * 1000);
}

io.on("connection", socket => {
  socket.emit("state", game);

  socket.on("join", data => {
    if (!game.open || !data.name) return;
    game.teams.push({ name: data.name, id: socket.id, steps: 0 });
    io.emit("state", game);
  });

  socket.on("setContestName", (name) => {
    game.contestName = name;
    io.emit("state", game);
  });

  socket.on("lock", () => {
    game.open = false;
    shuffleTeams();
    io.emit("state", game);
  });

  socket.on("roll", () => {
    if (game.winner || game.current) return;
    startTurn();
  });

  socket.on("correct", () => {
    if (!game.current) return;
    clearTimer();
    game.current.steps++;
    if (game.current.steps >= FINISH) {
      game.winner = game.current.name;
      io.emit("winner", game.winner);
      return;
    }
    game.current = null; // توقف النرد ليرميه المنظم من جديد
    io.emit("state", game);
  });

  socket.on("wrong", () => {
    if (!game.current) return;
    clearTimer();
    game.current = null;
    startTurn(); // انتقال تلقائي عند الخطأ
  });

  socket.on("reset", async () => {
    clearTimer();
    game.open = true;
    game.teams = [];
    game.order = [];
    game.current = null;
    game.winner = null;
    await makeQR();
    io.emit("state", game);
  });
  // كود توليد الـ QR Code ليعمل على أي رابط
  socket.on("generateQR", (url) => {
    // نستخدم الرابط الذي يرسله المتصفح بدلاً من رابط ثابت
    QRCode.toDataURL(url, (err, qrUrl) => {
      if (!err) {
        socket.emit("qrCode", qrUrl);
      }
    });
  });
});

http.listen(PORT, () => {
  console.log(`Server listening on http://localhost:${PORT}`);
});
