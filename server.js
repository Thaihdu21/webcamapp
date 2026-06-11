const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*' },
  transports: ['websocket', 'polling']
});

app.use(express.static(path.join(__dirname, 'public')));

// Track all connected users
const users = {}; // socketId -> { id, name }

io.on('connection', (socket) => {
  console.log('[+] Connected:', socket.id);

  // New user joins — send them existing users, tell others about new user
  socket.on('join', (data) => {
    users[socket.id] = { id: socket.id, name: data.name || 'Guest' };

    // Send the new user the full list of existing peers
    const existingUsers = Object.values(users).filter(u => u.id !== socket.id);
    socket.emit('existing-users', existingUsers);

    // Tell all existing users about the new joiner
    socket.broadcast.emit('user-joined', { id: socket.id, name: users[socket.id].name });

    console.log(`Users online: ${Object.keys(users).length}`);
  });

  // Relay WebRTC signaling between peers
  socket.on('offer', ({ to, offer }) => {
    io.to(to).emit('offer', { from: socket.id, offer });
  });

  socket.on('answer', ({ to, answer }) => {
    io.to(to).emit('answer', { from: socket.id, answer });
  });

  socket.on('ice-candidate', ({ to, candidate }) => {
    io.to(to).emit('ice-candidate', { from: socket.id, candidate });
  });

  // Relay media state (mic/cam toggle)
  socket.on('media-state', ({ video, audio }) => {
    socket.broadcast.emit('peer-media-state', {
      id: socket.id,
      video,
      audio
    });
  });

  socket.on('disconnect', () => {
    console.log('[-] Disconnected:', socket.id);
    delete users[socket.id];
    io.emit('user-left', { id: socket.id });
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`✅ Server running at http://localhost:${PORT}`);
});
