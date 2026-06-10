const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*' },
  transports: ['websocket', 'polling'],
  pingTimeout: 60000,
  pingInterval: 25000,
});

app.use(express.static(path.join(__dirname, 'public')));

// Lưu danh sách users trong 1 phòng chung
const users = new Map(); // socketId -> { id, joinedAt }

io.on('connection', (socket) => {
  console.log(`[+] Connected: ${socket.id} | Total: ${io.engine.clientsCount}`);

  // Khi user vào phòng
  socket.on('join', () => {
    // Lấy danh sách user hiện tại trước khi thêm
    const existingUsers = Array.from(users.keys()).filter(id => id !== socket.id);

    // Thêm user mới vào danh sách
    users.set(socket.id, { id: socket.id, joinedAt: Date.now() });

    // Gửi cho user mới biết ai đang online
    socket.emit('existing-users', existingUsers);

    // Thông báo cho tất cả user cũ biết có người mới
    socket.broadcast.emit('user-joined', socket.id);

    console.log(`[JOIN] ${socket.id} | Users: [${Array.from(users.keys()).join(', ')}]`);
  });

  // Relay ICE candidate
  socket.on('ice-candidate', ({ to, candidate }) => {
    if (users.has(to)) {
      io.to(to).emit('ice-candidate', {
        from: socket.id,
        candidate,
      });
    }
  });

  // Relay SDP offer
  socket.on('offer', ({ to, offer }) => {
    if (users.has(to)) {
      io.to(to).emit('offer', {
        from: socket.id,
        offer,
      });
    }
  });

  // Relay SDP answer
  socket.on('answer', ({ to, answer }) => {
    if (users.has(to)) {
      io.to(to).emit('answer', {
        from: socket.id,
        answer,
      });
    }
  });

  // Media state thay đổi (cam/mic on/off)
  socket.on('media-state', ({ video, audio }) => {
    socket.broadcast.emit('peer-media-state', {
      from: socket.id,
      video,
      audio,
    });
  });

  // Disconnect
  socket.on('disconnect', (reason) => {
    users.delete(socket.id);
    io.emit('user-left', socket.id);
    console.log(`[-] Disconnected: ${socket.id} (${reason}) | Remaining: ${users.size}`);
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`\n🚀 WebRTC Server running at http://localhost:${PORT}\n`);
});
