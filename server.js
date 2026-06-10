const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*' },
  pingTimeout: 60000,
  pingInterval: 25000
});

app.use(express.static(path.join(__dirname, 'public')));

// Dùng một phòng chung duy nhất - không cần mã phòng
const ROOM = 'main';
const roomUsers = new Map(); // socketId -> { id, name }

io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  // Gửi danh sách người đang online cho người mới vào
  socket.on('join', (userData) => {
    roomUsers.set(socket.id, { id: socket.id, ...userData });
    socket.join(ROOM);

    // Gửi cho người mới biết ai đang có mặt
    const others = [];
    roomUsers.forEach((user, id) => {
      if (id !== socket.id) others.push(user);
    });
    socket.emit('existing-users', others);

    // Thông báo cho những người còn lại
    socket.to(ROOM).emit('user-joined', { id: socket.id, ...userData });
    console.log(`Room users: ${roomUsers.size}`);
  });

  // Relay WebRTC signaling
  socket.on('offer', ({ to, offer }) => {
    io.to(to).emit('offer', { from: socket.id, offer });
  });

  socket.on('answer', ({ to, answer }) => {
    io.to(to).emit('answer', { from: socket.id, answer });
  });

  socket.on('ice-candidate', ({ to, candidate }) => {
    io.to(to).emit('ice-candidate', { from: socket.id, candidate });
  });

  // Thông báo trạng thái mic/cam
  socket.on('media-state', (state) => {
    socket.to(ROOM).emit('user-media-state', { id: socket.id, ...state });
  });

  socket.on('disconnect', () => {
    roomUsers.delete(socket.id);
    io.to(ROOM).emit('user-left', socket.id);
    console.log('User disconnected:', socket.id);
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`✅ Server running at http://localhost:${PORT}`);
});
