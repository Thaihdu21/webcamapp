const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const path = require("path");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static(path.join(__dirname, "public")));

// Lưu danh sách socket đang online
const peers = new Set();

io.on("connection", (socket) => {
  console.log("✅ New peer connected:", socket.id);
  peers.add(socket.id);

  // Gửi cho người mới danh sách tất cả peer đang có
  const otherPeers = [...peers].filter((id) => id !== socket.id);
  socket.emit("all-peers", otherPeers);

  // Báo cho tất cả peer cũ biết có người mới
  socket.broadcast.emit("peer-joined", socket.id);

  // Relay signaling: offer, answer, ice-candidate
  socket.on("offer", ({ to, offer }) => {
    io.to(to).emit("offer", { from: socket.id, offer });
  });

  socket.on("answer", ({ to, answer }) => {
    io.to(to).emit("answer", { from: socket.id, answer });
  });

  socket.on("ice-candidate", ({ to, candidate }) => {
    io.to(to).emit("ice-candidate", { from: socket.id, candidate });
  });

  socket.on("disconnect", () => {
    console.log("❌ Peer disconnected:", socket.id);
    peers.delete(socket.id);
    io.emit("peer-left", socket.id);
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`🚀 Server running at http://localhost:${PORT}`);
});
