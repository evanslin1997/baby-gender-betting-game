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

// 主頁
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'complete-game.html'));
});

// 遊戲狀態
let players = [];
let gameStatus = 'waiting';
let bets = { boy: [], girl: [] };
let gameResult = null;
let lastGameResults = null; // 保存上一輪的結果數據

console.log('🎮 遊戲服務器初始化...');

io.on('connection', (socket) => {
  console.log('🔗 用戶連接:', socket.id);

  socket.on('join-game', (playerName) => {
    const player = {
      id: socket.id,
      name: playerName,
      isHost: players.length === 0
    };
    
    players.push(player);
    console.log(`👤 玩家加入: ${playerName}, 總人數: ${players.length}, 主持人: ${player.isHost}`);
    
    socket.emit('game-state', {
      players: players,
      status: gameStatus,
      currentPlayer: player,
      bets: bets,
      result: gameResult,
      lastResults: lastGameResults
    });
    
    socket.broadcast.emit('player-joined', { player, totalPlayers: players.length });
  });

  socket.on('start-betting', () => {
    const player = players.find(p => p.id === socket.id);
    if (player && player.isHost) {
      console.log('🎲 開始投注');
      gameStatus = 'betting';
      bets = { boy: [], girl: [] };
      
      io.emit('betting-started', { status: gameStatus });
    }
  });

  socket.on('place-bet', (betData) => {
    const player = players.find(p => p.id === socket.id);
    if (!player || gameStatus !== 'betting') return;

    console.log(`💰 ${player.name} 投注: ${betData.choice} - NT$${betData.amount}`);

    const bet = {
      playerId: socket.id,
      playerName: player.name,
      amount: betData.amount,
      choice: betData.choice
    };

    // 移除舊投注
    bets.boy = bets.boy.filter(b => b.playerId !== socket.id);
    bets.girl = bets.girl.filter(b => b.playerId !== socket.id);
    
    // 添加新投注
    bets[betData.choice].push(bet);

    const totalBets = {
      boy: bets.boy.reduce((sum, b) => sum + b.amount, 0),
      girl: bets.girl.reduce((sum, b) => sum + b.amount, 0),
      boyCount: bets.boy.length,
      girlCount: bets.girl.length
    };

    io.emit('bet-placed', { bet, totalBets });
  });

  socket.on('announce-result', (result) => {
    const player = players.find(p => p.id === socket.id);
    if (!player || !player.isHost || gameStatus !== 'betting') return;

    console.log(`🎉 宣布結果: ${result}`);
    gameStatus = 'ended';
    gameResult = result;

    const winningBets = bets[result];
    const losingBets = bets[result === 'boy' ? 'girl' : 'boy'];
    
    const totalWinningAmount = winningBets.reduce((sum, bet) => sum + bet.amount, 0);
    const totalLosingAmount = losingBets.reduce((sum, bet) => sum + bet.amount, 0);
    
    const winners = winningBets.map(bet => ({
      ...bet,
      winAmount: totalLosingAmount > 0 ? Math.floor((bet.amount / totalWinningAmount) * totalLosingAmount) : 0
    }));

    // 保存結果數據
    lastGameResults = {
      result,
      winners,
      losers: losingBets,
      totalPool: totalWinningAmount + totalLosingAmount
    };

    io.emit('game-ended', lastGameResults);
  });

  socket.on('new-game', () => {
    const player = players.find(p => p.id === socket.id);
    if (!player || !player.isHost) return;

    console.log('🔄 開始新一輪');
    gameStatus = 'waiting';
    bets = { boy: [], girl: [] };
    gameResult = null;
    lastGameResults = null; // 清除上一輪結果

    io.emit('new-game-started', {
      status: gameStatus,
      message: '新一輪開始！'
    });
  });

  socket.on('disconnect', () => {
    console.log('👋 用戶斷線:', socket.id);
    
    const playerIndex = players.findIndex(p => p.id === socket.id);
    if (playerIndex !== -1) {
      const disconnectedPlayer = players[playerIndex];
      players.splice(playerIndex, 1);
      
      // 重新指定主持人
      if (disconnectedPlayer.isHost && players.length > 0) {
        players[0].isHost = true;
      }
      
      // 移除投注
      bets.boy = bets.boy.filter(bet => bet.playerId !== socket.id);
      bets.girl = bets.girl.filter(bet => bet.playerId !== socket.id);
      
      socket.broadcast.emit('player-left', {
        playerId: socket.id,
        players: players,
        totalPlayers: players.length
      });
    }
  });
});

const PORT = 8888;
const HOST = '0.0.0.0'; // 綁定所有網絡接口，允許外部訪問

server.listen(PORT, HOST, (err) => {
  if (err) {
    console.error('❌ 啟動失敗:', err);
    process.exit(1);
  }
  
  console.log('🎮 遊戲服務器啟動成功！');
  console.log(`📱 本地訪問: http://localhost:${PORT}`);
  console.log(`🌐 網絡訪問: http://0.0.0.0:${PORT}`);
  console.log(`🚀 ngrok 準備就緒: 可以使用 ngrok http ${PORT}`);
  console.log(`🕐 時間: ${new Date().toLocaleString()}`);
  
  // 測試服務器是否正常
  setTimeout(() => {
    console.log('✅ 服務器運行正常，等待玩家連接...');
  }, 1000);
});