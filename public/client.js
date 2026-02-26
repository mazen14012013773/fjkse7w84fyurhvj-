const socket = io();

function roll() {
  socket.emit("roll");
}

function correct() {
  socket.emit("correct");
}

function wrong() {
  socket.emit("wrong");
}

function reset() {
  socket.emit("reset");
}

function lock() {
  socket.emit("lock");
}

socket.on("state", s => {
  const qr = document.getElementById("qr");
  if (qr && s.qr) {
    qr.src = s.qr;
  }

  const teamList = document.getElementById("teamList");
  if (teamList) {
    teamList.innerHTML = "";
    s.teams.forEach(t => {
      const li = document.createElement("li");
      li.textContent = t.name;
      teamList.appendChild(li);
    });
  }

  const board = document.getElementById("board");
  if (!board) return;

  board.innerHTML = "";

  s.teams.forEach(t => {
    board.innerHTML += `
      <div class="track">
        <div class="finish">🏁</div>
        <div class="start">🚩</div>
        <div class="team-name">${t.name}</div>
        <div class="icon" style="bottom:${t.steps * 15}%">🚗</div>
      </div>
    `;
  });
});

socket.on("winner", name => {
  alert("🏆 الفائز: " + name);
});

socket.on("noAnswer", teamName => {
  console.log("لم يجب الفريق:", teamName);
});
