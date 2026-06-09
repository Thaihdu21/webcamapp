const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*", // Cho phép mọi nguồn (tùy chỉnh khi deploy)
    methods: ["GET", "POST"]
  }
});

// Phục vụ file tĩnh từ thư mục public
app.use(express.static('public'));

// Lưu trữ thông tin phòng: roomId -> Map(socketId -> { userName })
const rooms = new Map();

io.on('connection', (socket) => {
  console.log(`User connected: ${socket.id}`);

  socket.on('join-room', ({ room, userName }) => {
    socket.join(room);
    
    // Lưu user vào phòng
    if (!rooms.has(room)) {
      rooms.set(room, new Map());
    }
    const roomUsers = rooms.get(room);
    roomUsers.set(socket.id, { userName, socketId: socket.id });

    // Gửi danh sách user hiện tại (trừ chính mình) cho người vừa join
    const existingUsers = Array.from(roomUsers.values())
      .filter(user => user.socketId !== socket.id);
    socket.emit('existing-users', existingUsers);

    // Thông báo cho những người khác trong phòng có user mới
    socket.to(room).emit('user-connected', {
      socketId: socket.id,
      userName: userName
    });

    console.log(`${userName} joined room ${room}`);
  });

  // Xử lý offer WebRTC
  socket.on('offer', ({ target, offer, room, senderName }) => {
    socket.to(target).emit('offer', {
      from: socket.id,
      offer: offer,
      senderName: senderName
    });
  });

  // Xử lý answer
  socket.on('answer', ({ target, answer, room }) => {
    socket.to(target).emit('answer', {
      from: socket.id,
      answer: answer
    });
  });

  // Xử lý ICE candidate
  socket.on('ice-candidate', ({ target, candidate, room }) => {
    socket.to(target).emit('ice-candidate', {
      from: socket.id,
      candidate: candidate
    });
  });

  // Xử lý rời phòng
  socket.on('leave-room', ({ room }) => {
    if (rooms.has(room)) {
      const roomUsers = rooms.get(room);
      roomUsers.delete(socket.id);
      if (roomUsers.size === 0) {
        rooms.delete(room);
      }
    }
    socket.to(room).emit('user-disconnected', socket.id);
    socket.leave(room);
    console.log(`User ${socket.id} left room ${room}`);
  });

  socket.on('disconnect', () => {
    console.log(`User disconnected: ${socket.id}`);
    // Xóa user khỏi tất cả các phòng
    for (const [room, users] of rooms.entries()) {
      if (users.has(socket.id)) {
        users.delete(socket.id);
        socket.to(room).emit('user-disconnected', socket.id);
        if (users.size === 0) rooms.delete(room);
        break;
      }
    }
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
