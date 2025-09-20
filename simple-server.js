const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);

const io = socketIo(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

// 提供靜態文件
app.use(express.static(__dirname));

// 提供測試頁面
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'test.html'));
});

// 遊戲狀態
let players = [];
let gameStatus = 'waiting';

io.on('connection', (socket) => {
  console.log('用戶連接:', socket.id);

  socket.on('join-game', (playerName) => {
    const player = {
      id: socket.id,
      name: playerName,
      isHost: players.length === 0
    };
    
    players.push(player);
    console.log(`玩家加入: ${playerName}, 總人數: ${players.length}`);
    
    socket.emit('game-state', {
      players: players,
      status: gameStatus,
      currentPlayer: player
    });
    
    socket.broadcast.emit('player-joined', player);
  });

  socket.on('disconnect', () => {
    console.log('用戶斷線:', socket.id);
    players = players.filter(p => p.id !== socket.id);
    
    // 重新指定主持人
    if (players.length > 0) {
      players[0].isHost = true;
    }
    
    socket.broadcast.emit('player-left', {
      playerId: socket.id,
      players: players
    });
  });
});

const PORT = 3333;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`🎮 遊戲服務器啟動成功！`);
  console.log(`📱 請在瀏覽器中打開: http://localhost:${PORT}`);
  console.log(`🌐 或使用網絡地址: http://192.168.x.x:${PORT}`);
});