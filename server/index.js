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

    // 發送完整遊戲狀態給新加入的玩家
    socket.emit('game-state', {
      ...gameState,
      players: Array.from(gameState.players.values()),
      bets: {
        boy: gameState.bets.boy,
        girl: gameState.bets.girl
      }
    });

    // 向所有其他玩家廣播新玩家加入
    socket.broadcast.emit('player-joined', {
      player: gameState.players.get(socket.id),
      totalPlayers: gameState.players.size
    });

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
      
      const winnings = winningBets.map(bet => ({
        ...bet,
        winAmount: totalLosingAmount > 0 ? 
          Math.floor((bet.amount / totalWinningAmount) * totalLosingAmount) : 0
      }));

      io.emit('game-ended', {
        result,
        winners: winnings,
        losers: losingBets,
        totalPool: totalWinningAmount + totalLosingAmount
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