const express = require("express");
const http = require("http");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: "*" },
});

app.use(express.static("public"));

// Lưu danh sách user đang online
const users = new Map(); // socketId -> { id, joinedAt }

io.on("connection", (socket) => {
  console.log(`[+] Connected: ${socket.id}`);

  // Khi user join: gửi danh sách peer hiện tại cho user mới
  // và thông báo cho tất cả peer cũ biết có user mới
  socket.on("join", () => {
    const existingUsers = [...users.keys()];

    // Đăng ký user mới
    users.set(socket.id, { id: socket.id, joinedAt: Date.now() });

    console.log(`[join] ${socket.id} | Total: ${users.size}`);

    // Gửi danh sách peer hiện có cho user mới (để user mới initiate)
    socket.emit("existing-users", existingUsers);

    // Báo cho các peer cũ biết có người mới (để họ chờ offer)
    socket.broadcast.emit("user-joined", { userId: socket.id });
  });

  // ---------- Signaling relay ----------

  // Relay offer từ user mới -> peer cũ
  socket.on("offer", ({ to, offer }) => {
    console.log(`[offer] ${socket.id} -> ${to}`);
    io.to(to).emit("offer", { from: socket.id, offer });
  });

  // Relay answer từ peer cũ -> user mới
  socket.on("answer", ({ to, answer }) => {
    console.log(`[answer] ${socket.id} -> ${to}`);
    io.to(to).emit("answer", { from: socket.id, answer });
  });

  // Relay ICE candidate
  socket.on("ice-candidate", ({ to, candidate }) => {
    io.to(to).emit("ice-candidate", { from: socket.id, candidate });
  });

  // ---------- Disconnect ----------
  socket.on("disconnect", () => {
    users.delete(socket.id);
    console.log(`[-] Disconnected: ${socket.id} | Total: ${users.size}`);
    // Báo cho tất cả biết người này đã rời
    socket.broadcast.emit("user-left", { userId: socket.id });
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
