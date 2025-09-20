<template>
  <div class="game-room">
    <div class="game-header">
      <div class="player-info card">
        <h3>👤 玩家資訊</h3>
        <p><strong>暱稱:</strong> {{ gameStore.currentPlayer?.name }}</p>
        <p><strong>身份:</strong> {{ gameStore.isHost ? '主持人 🎪' : '玩家 🎮' }}</p>
        <p><strong>遊戲狀態:</strong> 
          <span :class="statusClass">{{ statusText }}</span>
        </p>
      </div>

      <div class="players-list card">
        <h3>🎭 玩家列表 ({{ gameStore.gameState.players.length }})</h3>
        <div class="players-grid">
          <div
            v-for="player in gameStore.gameState.players"
            :key="player.id"
            class="player-item"
            :class="{ 'is-host': player.isHost, 'is-current': player.id === gameStore.currentPlayer?.id }"
          >
            <span class="player-name">{{ player.name }}</span>
            <span v-if="player.isHost" class="host-badge">主持人</span>
            <span v-if="player.id === gameStore.currentPlayer?.id" class="current-badge">您</span>
          </div>
        </div>
      </div>
    </div>

    <!-- 等待開始 -->
    <div v-if="gameStore.gameState.status === 'waiting'" class="waiting-section">
      <div class="card text-center">
        <h2>🎲 準備開始遊戲</h2>
        <p v-if="gameStore.isHost" class="mb-2">您是主持人，可以開始遊戲</p>
        <p v-else class="mb-2">等待主持人開始遊戲...</p>
        
        <button
          v-if="gameStore.isHost"
          @click="gameStore.startBetting"
          class="btn btn-success"
          :disabled="gameStore.gameState.players.length < 2"
        >
          {{ gameStore.gameState.players.length < 2 ? '需要至少2位玩家' : '開始投注' }}
        </button>
      </div>
    </div>

    <!-- 投注階段 -->
    <div v-else-if="gameStore.gameState.status === 'betting'" class="betting-section">
      <div class="betting-stats card">
        <h3>📊 投注統計</h3>
        <div class="stats-grid">
          <div class="stat-item boy">
            <div class="stat-header">
              <span class="stat-icon">👦</span>
              <span class="stat-label">男生</span>
            </div>
            <div class="stat-value">{{ gameStore.totalBets.boyCount }}人</div>
            <div class="stat-amount">NT$ {{ gameStore.totalBets.boy.toLocaleString() }}</div>
          </div>
          <div class="stat-item girl">
            <div class="stat-header">
              <span class="stat-icon">👧</span>
              <span class="stat-label">女生</span>
            </div>
            <div class="stat-value">{{ gameStore.totalBets.girlCount }}人</div>
            <div class="stat-amount">NT$ {{ gameStore.totalBets.girl.toLocaleString() }}</div>
          </div>
        </div>
        <div class="total-pool">
          總獎金池: NT$ {{ (gameStore.totalBets.boy + gameStore.totalBets.girl).toLocaleString() }}
        </div>
      </div>

      <!-- 下注區域 -->
      <div class="betting-area card">
        <h3>💰 下注區域</h3>
        <div v-if="gameStore.myBet" class="current-bet">
          <p>您的投注: <strong>{{ gameStore.myBet.choice === 'boy' ? '👦 男生' : '👧 女生' }}</strong></p>
          <p>金額: <strong>NT$ {{ gameStore.myBet.amount.toLocaleString() }}</strong></p>
        </div>

        <form @submit.prevent="placeBet" class="bet-form">
          <div class="form-group">
            <label>選擇預測:</label>
            <div class="choice-buttons">
              <button
                type="button"
                class="choice-btn"
                :class="{ active: selectedChoice === 'boy' }"
                @click="selectedChoice = 'boy'"
              >
                👦 男生
              </button>
              <button
                type="button"
                class="choice-btn"
                :class="{ active: selectedChoice === 'girl' }"
                @click="selectedChoice = 'girl'"
              >
                👧 女生
              </button>
            </div>
          </div>

          <div class="form-group">
            <label for="betAmount">投注金額 (NT$):</label>
            <input
              id="betAmount"
              v-model.number="betAmount"
              type="number"
              class="input"
              min="100"
              max="100000"
              step="100"
              placeholder="請輸入投注金額"
              required
            />
          </div>

          <button
            type="submit"
            class="btn btn-primary"
            :disabled="!selectedChoice || !betAmount || betAmount < 100"
          >
            {{ gameStore.myBet ? '修改投注' : '確認投注' }}
          </button>
        </form>
      </div>

      <!-- 主持人控制區 -->
      <div v-if="gameStore.isHost" class="host-controls card">
        <h3>🎪 主持人控制</h3>
        <p class="mb-2">宣布結果:</p>
        <div class="result-buttons">
          <button
            @click="announceResult('boy')"
            class="btn btn-primary"
          >
            👦 是男生
          </button>
          <button
            @click="announceResult('girl')"
            class="btn btn-primary"
          >
            👧 是女生
          </button>
        </div>
      </div>
    </div>

    <!-- 遊戲結束 -->
    <div v-else-if="gameStore.gameState.status === 'ended'" class="results-section">
      <div class="results card">
        <h2>🎉 遊戲結果</h2>
        <div class="result-announcement">
          <div class="result-icon">
            {{ gameStore.gameState.result === 'boy' ? '👦' : '👧' }}
          </div>
          <div class="result-text">
            答案是: <strong>{{ gameStore.gameState.result === 'boy' ? '男生' : '女生' }}</strong>
          </div>
        </div>

        <div class="results-breakdown">
          <div v-if="gameStore.winners.length > 0" class="winners-section">
            <h3>🏆 恭喜中獎</h3>
            <div class="winner-list">
              <div
                v-for="winner in gameStore.winners"
                :key="winner.playerId"
                class="winner-item"
                :class="{ 'is-current-player': winner.playerId === gameStore.currentPlayer?.id }"
              >
                <span class="winner-name">{{ winner.playerName }}</span>
                <span class="winner-bet">投注: NT$ {{ winner.amount.toLocaleString() }}</span>
                <span class="winner-prize">獲得: NT$ {{ winner.winAmount?.toLocaleString() }}</span>
              </div>
            </div>
          </div>

          <div v-if="gameStore.losers.length > 0" class="losers-section">
            <h3>💸 未中獎</h3>
            <div class="loser-list">
              <div
                v-for="loser in gameStore.losers"
                :key="loser.playerId"
                class="loser-item"
                :class="{ 'is-current-player': loser.playerId === gameStore.currentPlayer?.id }"
              >
                <span class="loser-name">{{ loser.playerName }}</span>
                <span class="loser-bet">損失: NT$ {{ loser.amount.toLocaleString() }}</span>
              </div>
            </div>
          </div>
        </div>

        <div class="total-pool-final">
          總獎金池: NT$ {{ gameStore.totalPool.toLocaleString() }}
        </div>

        <button
          v-if="gameStore.isHost"
          @click="startNewGame"
          class="btn btn-success mt-3"
        >
          開始新一輪
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { useGameStore } from '../stores/game'

const gameStore = useGameStore()
const selectedChoice = ref<'boy' | 'girl'>('boy')
const betAmount = ref<number>(1000)

const statusClass = computed(() => {
  switch (gameStore.gameState.status) {
    case 'waiting': return 'status-waiting'
    case 'betting': return 'status-betting'
    case 'ended': return 'status-ended'
    default: return ''
  }
})

const statusText = computed(() => {
  switch (gameStore.gameState.status) {
    case 'waiting': return '等待開始'
    case 'betting': return '投注中'
    case 'ended': return '已結束'
    default: return '未知'
  }
})

const placeBet = () => {
  if (selectedChoice.value && betAmount.value >= 100) {
    gameStore.placeBet(betAmount.value, selectedChoice.value)
  }
}

const announceResult = (result: 'boy' | 'girl') => {
  gameStore.announceResult(result)
}

const startNewGame = () => {
  gameStore.startBetting()
}
</script>

<style scoped>
.game-room {
  max-width: 1200px;
  width: 100%;
}

.game-header {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 2rem;
  margin-bottom: 2rem;
}

.player-info h3,
.players-list h3 {
  margin-bottom: 1rem;
  color: #333;
}

.players-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}

.player-item {
  background: #f5f5f5;
  padding: 0.5rem 1rem;
  border-radius: 20px;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.9rem;
}

.player-item.is-host {
  background: linear-gradient(45deg, #ff9800, #f57f17);
  color: white;
}

.player-item.is-current {
  background: linear-gradient(45deg, #667eea, #764ba2);
  color: white;
}

.host-badge,
.current-badge {
  font-size: 0.7rem;
  background: rgba(255, 255, 255, 0.3);
  padding: 0.2rem 0.5rem;
  border-radius: 10px;
}

.status-waiting { color: #ff9800; }
.status-betting { color: #4caf50; }
.status-ended { color: #f44336; }

.waiting-section,
.betting-section,
.results-section {
  margin-top: 2rem;
}

.text-center { text-align: center; }
.mb-2 { margin-bottom: 1rem; }
.mt-3 { margin-top: 1.5rem; }

.betting-stats {
  margin-bottom: 2rem;
}

.stats-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1rem;
  margin-bottom: 1rem;
}

.stat-item {
  text-align: center;
  padding: 1rem;
  border-radius: 15px;
  background: linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%);
}

.stat-item.boy {
  background: linear-gradient(135deg, #a8edea 0%, #fed6e3 100%);
}

.stat-item.girl {
  background: linear-gradient(135deg, #ffecd2 0%, #fcb69f 100%);
}

.stat-header {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  margin-bottom: 0.5rem;
}

.stat-icon {
  font-size: 1.5rem;
}

.stat-value {
  font-size: 1.2rem;
  font-weight: bold;
  color: #333;
}

.stat-amount {
  font-size: 1rem;
  color: #666;
}

.total-pool {
  text-align: center;
  font-size: 1.2rem;
  font-weight: bold;
  color: #667eea;
  padding: 1rem;
  background: rgba(102, 126, 234, 0.1);
  border-radius: 10px;
}

.betting-area {
  margin-bottom: 2rem;
}

.current-bet {
  background: rgba(76, 175, 80, 0.1);
  padding: 1rem;
  border-radius: 10px;
  margin-bottom: 1rem;
  color: #4caf50;
}

.choice-buttons {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1rem;
  margin-bottom: 1rem;
}

.choice-btn {
  padding: 1rem;
  border: 2px solid #ddd;
  border-radius: 15px;
  background: white;
  cursor: pointer;
  font-size: 1.1rem;
  font-weight: bold;
  transition: all 0.3s ease;
}

.choice-btn:hover {
  border-color: #667eea;
}

.choice-btn.active {
  border-color: #667eea;
  background: linear-gradient(45deg, #667eea, #764ba2);
  color: white;
}

.result-buttons {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1rem;
}

.result-announcement {
  text-align: center;
  margin-bottom: 2rem;
}

.result-icon {
  font-size: 4rem;
  margin-bottom: 1rem;
}

.result-text {
  font-size: 1.5rem;
  color: #333;
}

.results-breakdown {
  display: grid;
  gap: 2rem;
  margin-bottom: 2rem;
}

.winners-section h3 {
  color: #4caf50;
  margin-bottom: 1rem;
}

.losers-section h3 {
  color: #f44336;
  margin-bottom: 1rem;
}

.winner-list,
.loser-list {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.winner-item,
.loser-item {
  display: grid;
  grid-template-columns: 1fr 1fr 1fr;
  gap: 1rem;
  padding: 0.75rem;
  border-radius: 10px;
  background: #f5f5f5;
}

.winner-item.is-current-player {
  background: rgba(76, 175, 80, 0.1);
  border: 2px solid #4caf50;
}

.loser-item.is-current-player {
  background: rgba(244, 67, 54, 0.1);
  border: 2px solid #f44336;
}

.winner-prize {
  font-weight: bold;
  color: #4caf50;
}

.loser-bet {
  color: #f44336;
}

.total-pool-final {
  text-align: center;
  font-size: 1.3rem;
  font-weight: bold;
  color: #667eea;
  padding: 1.5rem;
  background: rgba(102, 126, 234, 0.1);
  border-radius: 15px;
}

@media (max-width: 768px) {
  .game-room {
    padding: 1rem;
    max-width: 100%;
  }

  .game-header {
    grid-template-columns: 1fr;
    gap: 1rem;
    margin-bottom: 1rem;
  }
  
  .stats-grid {
    grid-template-columns: 1fr 1fr;
    gap: 0.5rem;
  }

  .choice-buttons,
  .result-buttons {
    grid-template-columns: 1fr;
    gap: 0.75rem;
  }

  .choice-btn {
    padding: 1.25rem;
    font-size: 1.2rem;
  }

  .card {
    padding: 1rem;
    margin-bottom: 1rem;
  }

  .player-item {
    font-size: 0.8rem;
    padding: 0.4rem 0.8rem;
  }

  .stat-item {
    padding: 0.75rem;
  }

  .stat-value {
    font-size: 1rem;
  }

  .stat-amount {
    font-size: 0.9rem;
  }

  .winner-item,
  .loser-item {
    grid-template-columns: 1fr;
    gap: 0.5rem;
    text-align: center;
  }

  .result-icon {
    font-size: 3rem;
  }

  .result-text {
    font-size: 1.2rem;
  }

  .betting-area input[type="number"] {
    font-size: 1.1rem;
    padding: 0.75rem;
  }

  .btn {
    padding: 0.75rem 1.5rem;
    font-size: 1rem;
  }

  .total-pool,
  .total-pool-final {
    font-size: 1rem;
    padding: 0.75rem;
  }
}

@media (max-width: 480px) {
  .game-room {
    padding: 0.5rem;
  }

  .card {
    padding: 0.75rem;
  }

  .game-header {
    gap: 0.75rem;
  }

  .stats-grid {
    grid-template-columns: 1fr;
    gap: 0.5rem;
  }

  .player-item {
    font-size: 0.75rem;
    padding: 0.3rem 0.6rem;
  }

  .choice-btn {
    padding: 1rem;
    font-size: 1.1rem;
  }

  .stat-item {
    padding: 0.5rem;
  }

  .result-icon {
    font-size: 2.5rem;
  }
}
</style>