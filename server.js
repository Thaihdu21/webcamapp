const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  // Cấu hình để tương thích tốt với mobile, giảm thời gian timeout
  pingTimeout: 60000,
  pingInterval: 25000,
  transports: ['websocket', 'polling']   // ưu tiên websocket
});

// Phục vụ file tĩnh trong thư mục public (chứa index.html)
app.use(express.static(path.join(__dirname, 'public')));

// Phòng mặc định (tất cả người dùng đều vào cùng một phòng, không cần mã)
const ROOM_NAME = 'global-room';

// Lưu danh sách socket id đang online trong phòng
let onlineUsers = new Set();

io.on('connection', (socket) => {
  console.log(`✅ User connected: ${socket.id}`);

  // Tham gia phòng chung
  socket.join(ROOM_NAME);
  onlineUsers.add(socket.id);

  // Gửi danh sách user hiện có (trừ chính mình) cho client vừa kết nối
  const otherUsers = Array.from(onlineUsers).filter(id => id !== socket.id);
  socket.emit('existing-users', otherUsers);
  console.log(`📢 existing-users sent to ${socket.id}:`, otherUsers);

  // Thông báo cho mọi người trong phòng (trừ chính mình) có người mới vào
  socket.broadcast.to(ROOM_NAME).emit('user-joined', socket.id);

  // ---- Xử lý tín hiệu WebRTC (offer, answer, ice) ----
  socket.on('offer', ({ target, offer }) => {
    console.log(`📡 Offer from ${socket.id} to ${target}`);
    io.to(target).emit('offer', { from: socket.id, offer });
  });

  socket.on('answer', ({ target, answer }) => {
    console.log(`📡 Answer from ${socket.id} to ${target}`);
    io.to(target).emit('answer', { from: socket.id, answer });
  });

  socket.on('ice-candidate', ({ target, candidate }) => {
    console.log(`🧊 ICE candidate from ${socket.id} to ${target}`);
    io.to(target).emit('ice-candidate', { from: socket.id, candidate });
  });

  // Trạng thái bật/tắt camera/mic (để hiển thị icon trên remote)
  socket.on('user-media-status', (data) => {
    socket.broadcast.to(ROOM_NAME).emit('peer-media-status', {
      userId: socket.id,
      videoEnabled: data.videoEnabled,
      audioEnabled: data.audioEnabled
    });
  });

  // Xử lý ngắt kết nối
  socket.on('disconnect', () => {
    console.log(`❌ User disconnected: ${socket.id}`);
    onlineUsers.delete(socket.id);
    socket.broadcast.to(ROOM_NAME).emit('user-left', socket.id);
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`🚀 Server running at http://localhost:${PORT}`);
  console.log(`📱 Optimized for mobile devices (Android/iOS low-end)`);
});
