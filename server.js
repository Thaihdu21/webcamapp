const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*' },
  pingTimeout: 60000,
  pingInterval: 25000,
});

app.use(express.static('public'));

// Lưu danh sách users trong phòng chung
const users = new Map(); // socketId -> { id, joinedAt }

io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  // Gửi danh sách peer hiện có cho người mới
  const existingUsers = [...users.keys()];
  socket.emit('existing-users', existingUsers);

  // Thêm user mới vào danh sách
  users.set(socket.id, { id: socket.id, joinedAt: Date.now() });

  // Thông báo cho tất cả người khác có user mới vào
  socket.broadcast.emit('user-joined', socket.id);

  // Relay signaling: offer
  socket.on('offer', ({ to, offer }) => {
    io.to(to).emit('offer', { from: socket.id, offer });
  });

  // Relay signaling: answer
  socket.on('answer', ({ to, answer }) => {
    io.to(to).emit('answer', { from: socket.id, answer });
  });

  // Relay signaling: ICE candidate
  socket.on('ice-candidate', ({ to, candidate }) => {
    io.to(to).emit('ice-candidate', { from: socket.id, candidate });
  });

  // User rời phòng
  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
    users.delete(socket.id);
    io.emit('user-left', socket.id);
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
