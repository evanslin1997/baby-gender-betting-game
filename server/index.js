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

  socket.on('join-game', (playerName) => {
    // 檢查是否已有相同名稱的玩家存在
    const existingPlayerEntry = Array.from(gameState.players.entries())
      .find(([_, player]) => player.name === playerName);
    
    let isRejoining = false;
    
    if (existingPlayerEntry) {
      // 如果找到相同名稱的玩家，更新他們的socket ID
      const [oldSocketId, existingPlayer] = existingPlayerEntry;
      gameState.players.delete(oldSocketId);
      gameState.players.set(socket.id, {
        ...existingPlayer,
        id: socket.id
      });
      
      // 如果是主持人重新加入，更新主持人ID
      if (gameState.host === oldSocketId) {
        gameState.host = socket.id;
      }
      
      isRejoining = true;
      console.log(`玩家 ${playerName} 重新加入遊戲`);
    } else {
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

      // 合併所有投注並按金額排序（高到低）
      const allBets = [...gameState.bets.boy, ...gameState.bets.girl];
      const sortedBets = allBets.sort((a, b) => b.amount - a.amount);
      
      const totalPool = allBets.reduce((sum, bet) => sum + bet.amount, 0);
      const totalPlayers = sortedBets.length;
      
      let winners = [];
      let losers = [];
      let middlePlayers = [];
      
      if (totalPlayers >= 6) {
        // 6人以上：前三名平分獎金，後三名懲罰
        const top3 = sortedBets.slice(0, 3);
        const bottom3 = sortedBets.slice(-3);
        const middle = sortedBets.slice(3, -3);
        
        // 前三名平分所有獎金
        const prizePerWinner = Math.floor(totalPool / 3);
        winners = top3.map(bet => ({
          ...bet,
          winAmount: prizePerWinner,
          rank: top3.indexOf(bet) + 1
        }));
        
        // 後三名懲罰（額外支付投注金額的50%）
        losers = bottom3.map(bet => ({
          ...bet,
          penalty: Math.floor(bet.amount * 0.5),
          rank: totalPlayers - (bottom3.length - bottom3.indexOf(bet) - 1)
        }));
        
        // 中間玩家不輸不贏
        middlePlayers = middle.map(bet => ({
          ...bet,
          winAmount: 0,
          rank: sortedBets.indexOf(bet) + 1
        }));
        
      } else if (totalPlayers >= 3) {
        // 3-5人：第一名拿70%，第二名拿30%，其他人懲罰
        const winner1 = sortedBets[0];
        const winner2 = sortedBets[1];
        const otherPlayers = sortedBets.slice(2);
        
        winners = [
          { ...winner1, winAmount: Math.floor(totalPool * 0.7), rank: 1 },
          { ...winner2, winAmount: Math.floor(totalPool * 0.3), rank: 2 }
        ];
        
        losers = otherPlayers.map((bet, index) => ({
          ...bet,
          penalty: Math.floor(bet.amount * 0.3),
          rank: index + 3
        }));
        
      } else {
        // 少於3人：第一名拿全部
        winners = [{
          ...sortedBets[0],
          winAmount: totalPool,
          rank: 1
        }];
        
        losers = sortedBets.slice(1).map((bet, index) => ({
          ...bet,
          penalty: Math.floor(bet.amount * 0.2),
          rank: index + 2
        }));
      }

      io.emit('game-ended', {
        result,
        winners,
        losers,
        middlePlayers,
        totalPool,
        totalPlayers,
        gameType: 'ranking' // 新增遊戲類型標識
      });
    }
  });

  socket.on('disconnect', () => {
    console.log('用戶斷線:', socket.id);
    
    if (gameState.host === socket.id && gameState.players.size > 1) {
      const remainingPlayers = Array.from(gameState.players.values())
        .filter(p => p.id !== socket.id);
      
      if (remainingPlayers.length > 0) {
        gameState.host = remainingPlayers[0].id;
        gameState.players.get(gameState.host).isHost = true;
      }
    }
    
    gameState.players.delete(socket.id);
    
    ['boy', 'girl'].forEach(choice => {
      gameState.bets[choice] = gameState.bets[choice].filter(
        bet => bet.playerId !== socket.id
      );
    });

    socket.broadcast.emit('player-left', {
      playerId: socket.id,
      totalPlayers: gameState.players.size,
      newHost: gameState.host
    });
  });
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`服務器運行在端口 ${PORT}`);
});