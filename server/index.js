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

io.on('connection', (socket) => {
  console.log('用戶連接:', socket.id);

  socket.on('join-game', (data) => {
    const playerName = typeof data === 'string' ? data : data.playerName;
    const confirmRejoin = typeof data === 'object' ? data.confirmRejoin : false;
    
    // 檢查是否有相同名稱的玩家記錄
    const existingPlayerEntry = Array.from(gameState.players.entries())
      .find(([_, player]) => player.name === playerName);
    
    let isRejoining = false;
    
    if (existingPlayerEntry) {
      const [existingSocketId, existingPlayer] = existingPlayerEntry;
      
      // 檢查該玩家是否正在線上（通過檢查socket連接）
      const isPlayerOnline = io.sockets.sockets.has(existingSocketId);
      
      if (isPlayerOnline && existingSocketId !== socket.id) {
        // 如果有其他玩家正在線且使用這個名稱，拒絕加入
        socket.emit('join-error', {
          message: `暱稱 "${playerName}" 已被其他玩家使用，請選擇其他名稱`
        });
        return;
      }
      
      if (!isPlayerOnline && !confirmRejoin) {
        // 如果玩家離線且沒有確認重新加入，詢問用戶
        socket.emit('confirm-rejoin', {
          playerName: playerName,
          message: `暱稱 "${playerName}" 已存在記錄，是否要重新加入並修改選項？`
        });
        return;
      }
    }
    
    if (existingPlayerEntry && existingPlayerEntry[0] !== socket.id) {
      // 重新加入：移除舊的socket ID記錄，使用新的socket ID
      const [oldSocketId, existingPlayer] = existingPlayerEntry;
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
        gameState.host = socket.id;
      }
      
      isRejoining = true;
      console.log(`玩家 ${playerName} 重新加入遊戲，投注記錄已更新`);
    } else if (!gameState.players.has(socket.id)) {
      // 新玩家加入
      gameState.players.set(socket.id, {
        id: socket.id,
        name: playerName,
        isHost: false,
        balance: 0
      });

      if (gameState.players.size === 1) {
        gameState.players.get(socket.id).isHost = true;
        gameState.host = socket.id;
      }
      
      console.log(`新玩家 ${playerName} 加入遊戲`);
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
      
      if (winningBets.length > 0) {
        // 獲勝者平分所有獎金（包含失敗者的投注）
        const prizePerWinner = Math.floor(totalPool / winningBets.length);
        winners = winningBets.map(bet => ({
          ...bet,
          winAmount: prizePerWinner
        }));
      }
      
      // 失敗者列表
      losers = losingBets;

      io.emit('game-ended', {
        result,
        winners,
        losers,
        totalPool
      });
    }
  });

  socket.on('disconnect', () => {
    console.log('用戶斷線:', socket.id);
    
    const disconnectedPlayer = gameState.players.get(socket.id);
    if (!disconnectedPlayer) return;
    
    // 如果是主持人離開，轉移主持人權限給其他玩家
    if (gameState.host === socket.id && gameState.players.size > 1) {
      const remainingPlayers = Array.from(gameState.players.values())
        .filter(p => p.id !== socket.id);
      
      if (remainingPlayers.length > 0) {
        gameState.host = remainingPlayers[0].id;
        gameState.players.get(gameState.host).isHost = true;
        console.log(`主持人轉移給: ${remainingPlayers[0].name}`);
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
  });
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`服務器運行在端口 ${PORT}`);
});