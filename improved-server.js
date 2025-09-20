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
  },
  allowEIO3: true
});

// 提供靜態文件
app.use(express.static(__dirname));

// 提供完整遊戲頁面
app.get('/', (req, res) => {
  console.log('📄 提供完整遊戲頁面');
  res.sendFile(path.join(__dirname, 'complete-game.html'));
});

// 調試頁面
app.get('/debug', (req, res) => {
  console.log('🔍 提供調試頁面');
  res.sendFile(path.join(__dirname, 'debug-test.html'));
});

// 遊戲狀態
let players = [];
let gameStatus = 'waiting';
let bets = { boy: [], girl: [] };
let gameResult = null;

console.log('🎮 遊戲服務器初始化...');

io.on('connection', (socket) => {
  console.log('🔗 用戶連接:', socket.id, '時間:', new Date().toLocaleTimeString());

  // 發送連接確認
  socket.emit('connected', { message: '連接成功！', socketId: socket.id });

  socket.on('join-game', (playerName) => {
    try {
      console.log(`👤 收到加入請求: ${playerName} (${socket.id})`);
      
      // 檢查玩家是否已經存在
      const existingPlayer = players.find(p => p.id === socket.id);
      if (existingPlayer) {
        console.log(`⚠️ 玩家 ${playerName} 已經在遊戲中`);
        socket.emit('error', { message: '您已經在遊戲中' });
        return;
      }

      const player = {
        id: socket.id,
        name: playerName,
        isHost: players.length === 0,
        joinTime: new Date().toLocaleTimeString()
      };
      
      players.push(player);
      console.log(`✅ 玩家加入成功: ${playerName}, 總人數: ${players.length}, 是否主持人: ${player.isHost}`);
      
      // 發送遊戲狀態給新玩家
      const gameState = {
        players: players,
        status: gameStatus,
        currentPlayer: player,
        totalPlayers: players.length,
        bets: bets,
        result: gameResult
      };
      
      console.log('📤 發送遊戲狀態給新玩家:', gameState);
      socket.emit('game-state', gameState);
      
      // 通知其他玩家
      console.log('📢 通知其他玩家新玩家加入');
      socket.broadcast.emit('player-joined', {
        player: player,
        totalPlayers: players.length
      });
      
      // 發送成功消息
      socket.emit('join-success', {
        message: `歡迎 ${playerName}！`,
        isHost: player.isHost,
        totalPlayers: players.length
      });

    } catch (error) {
      console.error('❌ 加入遊戲時發生錯誤:', error);
      socket.emit('error', { message: '加入遊戲失敗，請重試' });
    }
  });

  socket.on('start-betting', () => {
    const player = players.find(p => p.id === socket.id);
    if (player && player.isHost) {
      console.log('🎲 主持人開始投注階段');
      gameStatus = 'betting';
      bets = { boy: [], girl: [] };
      gameResult = null;
      
      io.emit('betting-started', {
        message: '投注開始！',
        status: gameStatus
      });
    }
  });

  socket.on('new-game', () => {
    console.log(`🔄 收到新遊戲請求，發送者: ${socket.id}`);
    const player = players.find(p => p.id === socket.id);
    
    if (!player) {
      console.log('❌ 玩家不存在');
      socket.emit('error', { message: '玩家不存在' });
      return;
    }
    
    if (!player.isHost) {
      console.log(`❌ ${player.name} 不是主持人，無法開始新遊戲`);
      socket.emit('error', { message: '只有主持人可以開始新遊戲' });
      return;
    }
    
    console.log(`🔄 主持人 ${player.name} 開始新一輪遊戲`);
    console.log(`📊 重置前狀態: ${gameStatus}, 投注數量: boy=${bets.boy.length}, girl=${bets.girl.length}`);
    
    gameStatus = 'waiting';
    bets = { boy: [], girl: [] };
    gameResult = null;
    
    console.log(`📊 重置後狀態: ${gameStatus}`);
    
    const newGameData = {
      message: '開始新一輪遊戲！',
      status: gameStatus,
      players: players,
      bets: bets,
      result: gameResult
    };
    
    console.log('📤 發送 new-game-started 事件給所有玩家');
    io.emit('new-game-started', newGameData);
    
    console.log('✅ 新遊戲已開始');
  });

  socket.on('place-bet', (betData) => {
    try {
      const player = players.find(p => p.id === socket.id);
      if (!player) {
        socket.emit('error', { message: '請先加入遊戲' });
        return;
      }

      if (gameStatus !== 'betting') {
        socket.emit('error', { message: '當前不是投注階段' });
        return;
      }

      console.log(`💰 收到投注: ${player.name} 選擇 ${betData.choice}, 金額 ${betData.amount}`);

      const bet = {
        playerId: socket.id,
        playerName: player.name,
        amount: betData.amount,
        choice: betData.choice,
        time: new Date().toLocaleTimeString()
      };

      // 移除玩家之前的投注
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

      console.log('📊 當前投注統計:', totalBets);

      io.emit('bet-placed', {
        bet: bet,
        totalBets: totalBets,
        allBets: bets
      });

    } catch (error) {
      console.error('❌ 投注時發生錯誤:', error);
      socket.emit('error', { message: '投注失敗，請重試' });
    }
  });

  socket.on('announce-result', (result) => {
    const player = players.find(p => p.id === socket.id);
    if (player && player.isHost && gameStatus === 'betting') {
      console.log(`🎉 主持人宣布結果: ${result}`);
      
      gameStatus = 'ended';
      gameResult = result;
      
      const winningBets = bets[result];
      const losingBets = bets[result === 'boy' ? 'girl' : 'boy'];
      
      const totalWinningAmount = winningBets.reduce((sum, bet) => sum + bet.amount, 0);
      const totalLosingAmount = losingBets.reduce((sum, bet) => sum + bet.amount, 0);
      
      const winnings = winningBets.map(bet => ({
        ...bet,
        winAmount: totalLosingAmount > 0 ? 
          Math.floor((bet.amount / totalWinningAmount) * totalLosingAmount) : 0
      }));

      console.log('🏆 計算獎金分配:', { winnings, losers: losingBets });

      io.emit('game-ended', {
        result: result,
        winners: winnings,
        losers: losingBets,
        totalPool: totalWinningAmount + totalLosingAmount,
        message: `結果是: ${result === 'boy' ? '男生' : '女生'}！`
      });
    }
  });

  socket.on('disconnect', (reason) => {
    console.log('🔌 用戶斷線:', socket.id, '原因:', reason);
    
    const playerIndex = players.findIndex(p => p.id === socket.id);
    if (playerIndex !== -1) {
      const disconnectedPlayer = players[playerIndex];
      players.splice(playerIndex, 1);
      
      console.log(`👋 玩家離開: ${disconnectedPlayer.name}, 剩餘人數: ${players.length}`);
      
      // 重新指定主持人
      if (disconnectedPlayer.isHost && players.length > 0) {
        players[0].isHost = true;
        console.log(`👑 新主持人: ${players[0].name}`);
      }
      
      // 移除玩家的投注
      bets.boy = bets.boy.filter(bet => bet.playerId !== socket.id);
      bets.girl = bets.girl.filter(bet => bet.playerId !== socket.id);
      
      socket.broadcast.emit('player-left', {
        playerId: socket.id,
        playerName: disconnectedPlayer.name,
        players: players,
        newHost: players.length > 0 ? players[0].id : null,
        totalPlayers: players.length
      });
    }
  });

  // 錯誤處理
  socket.on('error', (error) => {
    console.error('🚨 Socket錯誤:', error);
  });
});

const PORT = 3333;
server.listen(PORT, '127.0.0.1', (err) => {
  if (err) {
    console.error('❌ 服務器啟動失敗:', err);
    return;
  }
  console.log('🎮 遊戲服務器啟動成功！');
  console.log(`📱 請在瀏覽器中打開: http://localhost:${PORT}`);
  console.log(`🕐 啟動時間: ${new Date().toLocaleString()}`);
  console.log('📊 服務器狀態: 等待玩家加入...');
});