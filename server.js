const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: { origin: '*' },
  pingTimeout: 60000,
  pingInterval: 25000,
  transports: ['websocket', 'polling'],
});

app.use(express.static(path.join(__dirname, 'public')));
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Track all connected users: socketId -> { id, joinedAt }
const users = new Map();

io.on('connection', (socket) => {
  console.log(`[+] Connected: ${socket.id} | Total: ${users.size + 1}`);

  // Send existing users to new peer
  const existingUsers = Array.from(users.keys());
  socket.emit('existing-users', existingUsers);

  // Register user
  users.set(socket.id, { id: socket.id, joinedAt: Date.now() });

  // Notify everyone else that a new peer joined
  socket.broadcast.emit('user-joined', socket.id);

  // ---- Signaling relay ----
  // Offer: A -> server -> B
  socket.on('offer', ({ to, offer }) => {
    if (users.has(to)) {
      io.to(to).emit('offer', { from: socket.id, offer });
    }
  });

  // Answer: B -> server -> A
  socket.on('answer', ({ to, answer }) => {
    if (users.has(to)) {
      io.to(to).emit('answer', { from: socket.id, answer });
    }
  });

  // ICE candidate relay
  socket.on('ice-candidate', ({ to, candidate }) => {
    if (users.has(to)) {
      io.to(to).emit('ice-candidate', { from: socket.id, candidate });
    }
  });

  // Media state change (cam/mic toggle)
  socket.on('media-state', ({ video, audio }) => {
    socket.broadcast.emit('peer-media-state', {
      from: socket.id,
      video,
      audio,
    });
  });

  // Handle disconnect
  socket.on('disconnect', (reason) => {
    console.log(`[-] Disconnected: ${socket.id} | Reason: ${reason}`);
    users.delete(socket.id);
    io.emit('user-left', socket.id);
  });

  socket.on('error', (err) => {
    console.error(`Socket error [${socket.id}]:`, err);
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`✅ Server running at http://localhost:${PORT}`);
});
