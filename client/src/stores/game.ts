import { defineStore } from 'pinia'
import { io, type Socket } from 'socket.io-client'

export interface Player {
  id: string
  name: string
  isHost: boolean
  balance: number
}

export interface Bet {
  playerId: string
  playerName: string
  amount: number
  choice: 'boy' | 'girl'
  winAmount?: number
  penalty?: number
  rank?: number
}

export interface GameState {
  id: string | null
  status: 'waiting' | 'betting' | 'ended'
  players: Player[]
  bets: {
    boy: Bet[]
    girl: Bet[]
  }
  result: 'boy' | 'girl' | null
  host: string | null
}

export const useGameStore = defineStore('game', {
  state: () => ({
    socket: null as Socket | null,
    connected: false,
    currentPlayer: null as Player | null,
    gameState: {
      id: null,
      status: 'waiting',
      players: [],
      bets: { boy: [], girl: [] },
      result: null,
      host: null
    } as GameState,
    totalBets: {
      boy: 0,
      girl: 0,
      boyCount: 0,
      girlCount: 0
    },
    winners: [] as Bet[],
    losers: [] as Bet[],
    totalPool: 0,
    middlePlayers: [] as Bet[],
    totalPlayers: 0,
    gameType: 'classic' as 'classic' | 'ranking',
    joinError: null as string | null
  }),

  getters: {
    isHost: (state) => state.currentPlayer?.isHost || false,
    myBet: (state) => {
      if (!state.currentPlayer) return null
      const boyBet = state.gameState.bets.boy.find(bet => bet.playerId === state.currentPlayer!.id)
      const girlBet = state.gameState.bets.girl.find(bet => bet.playerId === state.currentPlayer!.id)
      return boyBet || girlBet || null
    }
  },

  actions: {
    connect() {
      if (this.socket) return

      // 自動偵測環境 - 生產環境使用當前網址，開發環境使用 localhost
      const serverUrl = import.meta.env.PROD 
        ? window.location.origin 
        : 'http://localhost:3001'
      
      this.socket = io(serverUrl)
      
      this.socket.on('connect', () => {
        this.connected = true
        console.log('連接成功')
      })

      this.socket.on('disconnect', () => {
        this.connected = false
        console.log('連接斷開')
      })

      this.socket.on('game-state', (state: GameState) => {
        this.gameState = state
        this.currentPlayer = state.players.find(p => p.id === this.socket?.id) || null
      })

      this.socket.on('player-joined', (data) => {
        // 檢查玩家是否已存在，避免重複添加
        const existingPlayer = this.gameState.players.find(p => p.id === data.player.id)
        if (!existingPlayer) {
          this.gameState.players.push(data.player)
        }
      })

      this.socket.on('players-updated', (data) => {
        this.gameState.players = data.players
      })

      this.socket.on('player-rejoined', (data) => {
        // 玩家重新加入時，更新玩家列表
        const existingPlayerIndex = this.gameState.players.findIndex(p => p.name === data.player.name)
        if (existingPlayerIndex !== -1) {
          this.gameState.players[existingPlayerIndex] = data.player
        } else {
          this.gameState.players.push(data.player)
        }
      })

      this.socket.on('player-left', (data) => {
        this.gameState.players = this.gameState.players.filter(p => p.id !== data.playerId)
        if (data.newHost) {
          const newHost = this.gameState.players.find(p => p.id === data.newHost)
          if (newHost) newHost.isHost = true
          this.gameState.host = data.newHost
        }
      })

      this.socket.on('betting-started', (data) => {
        this.gameState.status = data.status
        this.gameState.id = data.gameId
        this.gameState.result = null
        this.gameState.bets = { boy: [], girl: [] }
        this.winners = []
        this.losers = []
        this.totalPool = 0
      })

      this.socket.on('bet-placed', (data: { bet: Bet; totalBets: any }) => {
        const choice = data.bet.choice as 'boy' | 'girl'
        const otherChoice = choice === 'boy' ? 'girl' : 'boy'
        
        const existingBetIndex = this.gameState.bets[choice].findIndex(
          (bet: Bet) => bet.playerId === data.bet.playerId
        )
        
        if (existingBetIndex !== -1) {
          this.gameState.bets[choice][existingBetIndex] = data.bet
        } else {
          this.gameState.bets[choice].push(data.bet)
        }

        this.gameState.bets[otherChoice] = this.gameState.bets[otherChoice].filter(
          (bet: Bet) => bet.playerId !== data.bet.playerId
        )

        this.totalBets = data.totalBets
      })

      this.socket.on('game-ended', (data) => {
        this.gameState.status = 'ended'
        this.gameState.result = data.result
        this.winners = data.winners || []
        this.losers = data.losers || []
        this.totalPool = data.totalPool || 0
      })

      this.socket.on('join-error', (data) => {
        this.joinError = data.message
      })
    },

    joinGame(playerName: string) {
      if (this.socket) {
        this.joinError = null // 清除之前的錯誤
        this.socket.emit('join-game', playerName)
      }
    },

    startBetting() {
      if (this.socket && this.isHost) {
        this.socket.emit('start-betting')
      }
    },

    placeBet(amount: number, choice: 'boy' | 'girl') {
      if (this.socket && this.gameState.status === 'betting') {
        this.socket.emit('place-bet', { amount, choice })
      }
    },

    announceResult(result: 'boy' | 'girl') {
      if (this.socket && this.isHost && this.gameState.status === 'betting') {
        this.socket.emit('announce-result', result)
      }
    },

    disconnect() {
      if (this.socket) {
        this.socket.disconnect()
        this.socket = null
      }
      this.connected = false
      this.currentPlayer = null
    }
  }
})