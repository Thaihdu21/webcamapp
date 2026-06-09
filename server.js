const express = require('express');
const http = require('http');
const socketIo = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: "*", // Cho phép mọi nguồn (có thể thay bằng domain của bạn)
    methods: ["GET", "POST"]
  }
});

// Phục vụ file tĩnh (HTML, CSS, JS) từ thư mục public
app.use(express.static('public'));

// Lưu trữ danh sách phòng và người dùng trong phòng
// rooms: { roomName: Set(socketIds) }
const rooms = new Map();

io.on('connection', (socket) => {
  console.log(`✅ Client connected: ${socket.id}`);

  // Khi client yêu cầu tham gia phòng
  socket.on('join-room', (roomName) => {
    // Rời khỏi phòng cũ nếu có
    const previousRooms = Array.from(socket.rooms).filter(r => r !== socket.id);
    previousRooms.forEach(prevRoom => {
      socket.leave(prevRoom);
      if (rooms.has(prevRoom)) {
        rooms.get(prevRoom).delete(socket.id);
        if (rooms.get(prevRoom).size === 0) rooms.delete(prevRoom);
      }
    });

    // Tham gia phòng mới
    socket.join(roomName);
    if (!rooms.has(roomName)) {
      rooms.set(roomName, new Set());
    }
    rooms.get(roomName).add(socket.id);

    console.log(`📌 ${socket.id} joined room: ${roomName}`);
    
    // Lấy danh sách các client khác trong phòng (không bao gồm chính mình)
    const otherUsers = Array.from(rooms.get(roomName)).filter(id => id !== socket.id);
    
    // Gửi danh sách người dùng hiện tại cho client vừa join
    socket.emit('existing-users', otherUsers);
    
    // Thông báo cho các client khác biết có người mới vào phòng
    socket.to(roomName).emit('user-connected', socket.id);
  });

  // Xử lý tín hiệu WebRTC (offer, answer, ICE candidate)
  socket.on('signal', (data) => {
    const { to, signal } = data;
    // Gửi tín hiệu đến đúng người dùng đích
    io.to(to).emit('signal', {
      from: socket.id,
      signal: signal
    });
  });

  // Khi client ngắt kết nối
  socket.on('disconnect', () => {
    console.log(`❌ Client disconnected: ${socket.id}`);
    // Tìm phòng chứa socket này và thông báo cho mọi người trong phòng
    for (let [roomName, userSet] of rooms.entries()) {
      if (userSet.has(socket.id)) {
        userSet.delete(socket.id);
        if (userSet.size === 0) {
          rooms.delete(roomName);
        } else {
          // Thông báo cho các client khác trong phòng rằng user này đã rời
          socket.to(roomName).emit('user-disconnected', socket.id);
        }
        break;
      }
    }
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`🚀 Server đang chạy tại http://localhost:${PORT}`);
  console.log(`📡 WebRTC signaling sẵn sàng, hãy mở nhiều tab trình duyệt để test!`);
});
