const express = require('express');
const app = express();
const server = require('http').createServer(app);
const io = require('socket.io')(server, {
    cors: { origin: "*" }
});

app.use(express.static('public'));

// Lưu trữ danh sách user đang online
let activeUsers = {};

io.on('connection', (socket) => {
    console.log(`User kết nối: ${socket.id}`);

    // Gửi danh sách các user hiện tại cho user mới (loại trừ chính họ)
    socket.emit('all-users', Object.keys(activeUsers));
    activeUsers[socket.id] = true;

    // Chuyển tiếp tín hiệu WebRTC (Offer, Answer, ICE Candidate)
    socket.on('relay-sdp', ({ peerId, sdp }) => {
        io.to(peerId).emit('sdp', { peerId: socket.id, sdp });
    });

    socket.on('relay-ice', ({ peerId, iceCandidate }) => {
        io.to(peerId).emit('ice', { peerId: socket.id, iceCandidate });
    });

    // Xử lý khi user ngắt kết nối
    socket.on('disconnect', () => {
        console.log(`User ngắt kết nối: ${socket.id}`);
        delete activeUsers[socket.id];
        socket.broadcast.emit('user-disconnected', socket.id);
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server đang chạy tại http://localhost:${PORT}`);
});
