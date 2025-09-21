const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

const app = express();
const server = http.createServer(app);

const io = socketIo(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

app.use(cors());
app.use(express.json());

// 在生產環境中提供建置後的前端檔案
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, '..', 'client', 'dist')));
  app.get('/', (_, res) => {
    res.sendFile(path.join(__dirname, '..', 'client', 'dist', 'index.html'));
  });
} else {
  // 開發環境提供測試頁面
  app.use(express.static(path.join(__dirname, '..')));
  app.get('/', (_, res) => {
    res.sendFile(path.join(__dirname, '..', 'test.html'));
  });
}

let gameState = {
  id: null,
  status: 'waiting', // waiting, betting, ended
  players: new Map(),
  bets: {
    boy: [],
    girl: []
  },
  result: null,
  host: null
};

// 主持人狀態驗證和修正函數
function validateAndFixHostState() {
  const hostPlayers = Array.from(gameState.players.values()).filter(p => p.isHost);
  const currentHost = gameState.host ? gameState.players.get(gameState.host) : null;
  const isHostOnline = gameState.host ? io.sockets.sockets.has(gameState.host) : false;
  
  console.log(`[驗證] 主持人狀態檢查 - 標記為主持人的玩家數: ${hostPlayers.length}, 設定的主持人: ${gameState.host}, 主持人在線: ${isHostOnline}`);
  
  // 如果有多個主持人，強制修正
  if (hostPlayers.length > 1) {
    console.error(`[修正] 發現 ${hostPlayers.length} 個主持人，強制修正...`);
    gameState.players.forEach((player, playerId) => {
      player.isHost = (playerId === gameState.host);
    });
    
    // 廣播更新後的玩家狀態
    io.emit('players-updated', {
      players: Array.from(gameState.players.values())
    });
  }
  
  // 如果主持人離線，轉移給其他人
  if (gameState.host && (!currentHost || !isHostOnline)) {
    console.log(`[修正] 主持人離線，尋找新主持人...`);
    const onlinePlayers = Array.from(gameState.players.values())
      .filter(p => io.sockets.sockets.has(p.id));
    
    if (onlinePlayers.length > 0) {
      // 清除所有主持人狀態
      gameState.players.forEach((player, playerId) => {
        player.isHost = false;
      });
      
      // 設置新主持人
      const newHost = onlinePlayers[0];
      gameState.host = newHost.id;
      gameState.players.get(newHost.id).isHost = true;
      
      console.log(`[修正] 新主持人: ${newHost.name} (${newHost.id})`);
      
      // 廣播更新
      io.emit('players-updated', {
        players: Array.from(gameState.players.values())
      });
    } else {
      gameState.host = null;
      console.log(`[修正] 沒有在線玩家，清除主持人`);
    }
  }
}

// 每5秒檢查一次主持人狀態
setInterval(validateAndFixHostState, 5000);

io.on('connection', (socket) => {
  console.log('用戶連接:', socket.id);

  socket.on('join-game', (data) => {
    const playerName = typeof data === 'string' ? data : data.playerName;
    const confirmRejoin = typeof data === 'object' ? data.confirmRejoin : false;
    
    console.log(`=== JOIN-GAME 開始: ${playerName} (${socket.id}) ===`);
    console.log(`當前主持人: ${gameState.host}`);
    console.log(`當前玩家數量: ${gameState.players.size}`);
    
    // 檢查是否有相同名稱的玩家記錄
    const existingPlayerEntry = Array.from(gameState.players.entries())
      .find(([_, player]) => player.name === playerName);
    
    let isRejoining = false;
    
    if (existingPlayerEntry) {
      const [existingSocketId, existingPlayer] = existingPlayerEntry;
      
      // 檢查該玩家是否正在線上（通過檢查socket連接）
      const isPlayerOnline = io.sockets.sockets.has(existingSocketId);
      
      console.log(`找到同名玩家記錄: ${existingSocketId}, 是否在線: ${isPlayerOnline}`);
      
      if (isPlayerOnline && existingSocketId !== socket.id) {
        // 如果有其他玩家正在線且使用這個名稱，拒絕加入
        socket.emit('join-error', {
          message: `暱稱 "${playerName}" 已被其他玩家使用，請選擇其他名稱`
        });
        console.log(`拒絕加入: 名稱已被使用`);
        return;
      }
      
      if (!isPlayerOnline && !confirmRejoin) {
        // 如果玩家離線且沒有確認重新加入，詢問用戶
        socket.emit('confirm-rejoin', {
          playerName: playerName,
          message: `暱稱 "${playerName}" 已存在記錄，是否要重新加入並修改選項？`
        });
        console.log(`要求確認重新加入`);
        return;
      }
    }
    
    if (existingPlayerEntry && existingPlayerEntry[0] !== socket.id) {
      // 重新加入：移除舊的socket ID記錄，使用新的socket ID
      const [oldSocketId, existingPlayer] = existingPlayerEntry;
      console.log(`處理重新加入: 舊ID=${oldSocketId}, 新ID=${socket.id}, 是否為主持人=${existingPlayer.isHost}`);
      
      gameState.players.delete(oldSocketId);
      gameState.players.set(socket.id, {
        ...existingPlayer,
        id: socket.id
      });
      
      // 更新投注記錄中的 playerId
      ['boy', 'girl'].forEach(choice => {
        const betIndex = gameState.bets[choice].findIndex(bet => bet.playerId === oldSocketId);
        if (betIndex !== -1) {
          gameState.bets[choice][betIndex].playerId = socket.id;
        }
      });
      
      // 如果是主持人重新加入，更新主持人ID
      if (gameState.host === oldSocketId) {
        console.log(`主持人重新加入: 更新主持人ID從 ${oldSocketId} 到 ${socket.id}`);
        gameState.host = socket.id;
        
        // 先清除所有人的主持人狀態，再設置新的
        gameState.players.forEach((player, playerId) => {
          player.isHost = false;
        });
        gameState.players.get(socket.id).isHost = true;
        
        console.log(`主持人 ${playerName} 重新加入`);
      }
      
      isRejoining = true;
      console.log(`玩家 ${playerName} 重新加入遊戲，投注記錄已更新`);
    } else if (!gameState.players.has(socket.id)) {
      // 新玩家加入
      console.log(`新玩家加入: ${playerName}`);
      
      gameState.players.set(socket.id, {
        id: socket.id,
        name: playerName,
        isHost: false,
        balance: 0
      });

      // 檢查是否需要設為主持人：沒有現任主持人或現任主持人離線
      const currentHost = gameState.host ? gameState.players.get(gameState.host) : null;
      const isCurrentHostOnline = gameState.host ? io.sockets.sockets.has(gameState.host) : false;
      
      console.log(`主持人檢查 - 當前主持人存在: ${!!currentHost}, 主持人在線: ${isCurrentHostOnline}`);
      
      if (!currentHost || !isCurrentHostOnline) {
        // 先清除所有人的主持人狀態，避免重複主持人
        gameState.players.forEach((player, playerId) => {
          player.isHost = false;
        });
        
        // 設置新玩家為主持人
        gameState.players.get(socket.id).isHost = true;
        gameState.host = socket.id;
        console.log(`${playerName} 成為新主持人`);
      }
      
      console.log(`新玩家 ${playerName} 加入遊戲`);
    }
    
    // 驗證主持人狀態一致性
    const hostPlayers = Array.from(gameState.players.values()).filter(p => p.isHost);
    console.log(`加入完成後主持人數量: ${hostPlayers.length}, 主持人列表:`, hostPlayers.map(p => `${p.name}(${p.id})`));
    
    if (hostPlayers.length > 1) {
      console.error(`⚠️ 發現多個主持人！強制修正...`);
      // 強制修正：只保留 gameState.host 指定的主持人
      gameState.players.forEach((player, playerId) => {
        player.isHost = (playerId === gameState.host);
      });
    }

    // 發送完整遊戲狀態給新加入的玩家
    socket.emit('game-state', {
      ...gameState,
      players: Array.from(gameState.players.values()),
      bets: {
        boy: gameState.bets.boy,
        girl: gameState.bets.girl
      }
    });

    // 向所有其他玩家廣播玩家加入或重新加入
    if (isRejoining) {
      socket.broadcast.emit('player-rejoined', {
        player: gameState.players.get(socket.id),
        totalPlayers: gameState.players.size
      });
    } else {
      socket.broadcast.emit('player-joined', {
        player: gameState.players.get(socket.id),
        totalPlayers: gameState.players.size
      });
    }

    // 也發送完整的玩家列表給所有人，確保同步
    io.emit('players-updated', {
      players: Array.from(gameState.players.values())
    });
  });

  socket.on('start-betting', () => {
    if (gameState.players.get(socket.id)?.isHost) {
      gameState.status = 'betting';
      gameState.id = uuidv4();
      gameState.bets = { boy: [], girl: [] };
      gameState.result = null;
      
      io.emit('betting-started', {
        gameId: gameState.id,
        status: gameState.status
      });
    }
  });

  socket.on('place-bet', (betData) => {
    if (gameState.status !== 'betting') return;

    const player = gameState.players.get(socket.id);
    if (!player) return;

    const bet = {
      playerId: socket.id,
      playerName: player.name,
      amount: betData.amount,
      choice: betData.choice
    };

    const existingBetIndex = gameState.bets[betData.choice].findIndex(
      b => b.playerId === socket.id
    );

    if (existingBetIndex !== -1) {
      gameState.bets[betData.choice][existingBetIndex] = bet;
    } else {
      gameState.bets[betData.choice].push(bet);
    }

    const otherChoice = betData.choice === 'boy' ? 'girl' : 'boy';
    gameState.bets[otherChoice] = gameState.bets[otherChoice].filter(
      b => b.playerId !== socket.id
    );

    io.emit('bet-placed', {
      bet,
      totalBets: {
        boy: gameState.bets.boy.reduce((sum, b) => sum + b.amount, 0),
        girl: gameState.bets.girl.reduce((sum, b) => sum + b.amount, 0),
        boyCount: gameState.bets.boy.length,
        girlCount: gameState.bets.girl.length
      }
    });
  });

  socket.on('announce-result', (result) => {
    if (gameState.players.get(socket.id)?.isHost && gameState.status === 'betting') {
      gameState.result = result;
      gameState.status = 'ended';

      const winningBets = gameState.bets[result];
      const losingBets = gameState.bets[result === 'boy' ? 'girl' : 'boy'];
      
      const totalWinningAmount = winningBets.reduce((sum, bet) => sum + bet.amount, 0);
      const totalLosingAmount = losingBets.reduce((sum, bet) => sum + bet.amount, 0);
      const totalPool = totalWinningAmount + totalLosingAmount;
      
      let winners = [];
      let losers = [];
      let punished = [];
      
      // 隨機抽取3個獲勝者平分獎金
      if (winningBets.length > 0) {
        const shuffledWinners = [...winningBets].sort(() => Math.random() - 0.5);
        const selectedWinners = shuffledWinners.slice(0, Math.min(3, shuffledWinners.length));
        const prizePerWinner = Math.floor(totalPool / selectedWinners.length);
        
        winners = selectedWinners.map(bet => ({
          ...bet,
          winAmount: prizePerWinner
        }));
      }
      
      // 隨機抽取3個失敗者接受懲罰
      if (losingBets.length > 0) {
        const shuffledLosers = [...losingBets].sort(() => Math.random() - 0.5);
        punished = shuffledLosers.slice(0, Math.min(3, shuffledLosers.length));
      }
      
      // 所有失敗者列表
      losers = losingBets;

      io.emit('game-ended', {
        result,
        winners,
        losers,
        punished,
        totalPool,
        punishment: null // 主持人將另外宣布懲罰內容
      });
    }
  });

  // 主持人宣布懲罰內容
  socket.on('announce-punishment', (data) => {
    if (gameState.players.get(socket.id)?.isHost && gameState.status === 'ended') {
      io.emit('punishment-announced', {
        punishment: data.punishment,
        punishedPlayers: data.punishedPlayers || []
      });
    }
  });

  socket.on('disconnect', () => {
    console.log(`=== DISCONNECT 開始: ${socket.id} ===`);
    
    const disconnectedPlayer = gameState.players.get(socket.id);
    if (!disconnectedPlayer) {
      console.log('斷線的玩家不在記錄中');
      return;
    }
    
    console.log(`斷線玩家: ${disconnectedPlayer.name}, 是否為主持人: ${disconnectedPlayer.isHost}`);
    console.log(`當前主持人: ${gameState.host}`);
    
    // 如果是主持人離開，轉移主持人權限給其他玩家
    if (gameState.host === socket.id && gameState.players.size > 1) {
      console.log(`主持人離線，需要轉移權限`);
      
      const remainingPlayers = Array.from(gameState.players.values())
        .filter(p => p.id !== socket.id);
      
      console.log(`剩餘玩家數量: ${remainingPlayers.length}`);
      
      if (remainingPlayers.length > 0) {
        // 先清除所有人的主持人狀態
        gameState.players.forEach((player) => {
          player.isHost = false;
        });
        
        // 設置新主持人
        const newHost = remainingPlayers[0];
        gameState.host = newHost.id;
        gameState.players.get(newHost.id).isHost = true;
        
        console.log(`主持人轉移給: ${newHost.name} (${newHost.id})`);
        
        // 驗證主持人狀態
        const hostPlayers = Array.from(gameState.players.values()).filter(p => p.isHost);
        console.log(`轉移後主持人數量: ${hostPlayers.length}`);
      } else {
        console.log(`沒有其他玩家可以轉移主持人權限`);
        gameState.host = null;
      }
    }
    
    // 注意：我們不刪除玩家記錄和投注記錄，讓他們可以重新加入
    // 只是從當前連線的玩家列表中暫時移除，但保留在 gameState.players 中供重新加入
    console.log(`玩家 ${disconnectedPlayer.name} 離線，但記錄保留供重新加入`);

    // 通知其他玩家有人離線（但不從列表中移除）
    socket.broadcast.emit('player-disconnected', {
      playerId: socket.id,
      playerName: disconnectedPlayer.name,
      totalPlayers: gameState.players.size,
      newHost: gameState.host
    });
    
    console.log(`=== DISCONNECT 完成 ===`);
  });
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`服務器運行在端口 ${PORT}`);
});