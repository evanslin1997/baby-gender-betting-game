<template>
  <div class="join-game card">
    <h2>🥛 林豆漿有沒有GG</h2>
    <form @submit.prevent="joinGame" class="join-form">
      <div class="form-group">
        <label for="playerName">玩家暱稱</label>
        <input
          id="playerName"
          v-model="playerName"
          type="text"
          class="input"
          placeholder="請輸入您的暱稱"
          maxlength="20"
          required
        />
      </div>
      <button
        type="submit"
        class="btn btn-primary"
        :disabled="!playerName.trim() || !gameStore.connected"
      >
        {{ gameStore.connected ? '加入/重新進入遊戲' : '連線中...' }}
      </button>
    </form>

    <div class="game-info">
      <h3>🎯 遊戲規則</h3>
      <ul>
        <li>猜測林豆漿是男生還是女生</li>
        <li>自訂投注金額，金額越高排名越前</li>
        <li>📊 排名規則：</li>
        <li>• 6人以上：前3名平分獎金，後3名懲罰</li>
        <li>• 3-5人：1st拿70%，2nd拿30%，其他懲罰</li>
        <li>• 少於3人：第1名拿全部，其他懲罰</li>
        <li>第一個加入的玩家成為主持人</li>
        <li>💡 使用相同暱稱可重新進入遊戲修改選項</li>
      </ul>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useGameStore } from '../stores/game'

const gameStore = useGameStore()
const playerName = ref('')

const joinGame = () => {
  if (playerName.value.trim() && gameStore.connected) {
    gameStore.joinGame(playerName.value.trim())
  }
}
</script>

<style scoped>
.join-game {
  max-width: 500px;
  width: 100%;
  text-align: center;
}

.join-game h2 {
  margin-bottom: 2rem;
  color: #333;
  font-size: 2rem;
}

.join-form {
  margin-bottom: 2rem;
}

.form-group {
  margin-bottom: 1.5rem;
  text-align: left;
}

.form-group label {
  display: block;
  margin-bottom: 0.5rem;
  color: #555;
  font-weight: bold;
}

.game-info {
  background: rgba(102, 126, 234, 0.1);
  border-radius: 15px;
  padding: 1.5rem;
  text-align: left;
}

.game-info h3 {
  margin-bottom: 1rem;
  color: #667eea;
  font-size: 1.2rem;
}

.game-info ul {
  list-style: none;
  color: #666;
}

.game-info li {
  margin-bottom: 0.5rem;
  padding-left: 1.5rem;
  position: relative;
}

.game-info li::before {
  content: '•';
  color: #667eea;
  font-weight: bold;
  position: absolute;
  left: 0;
}

@media (max-width: 768px) {
  .join-game {
    max-width: 100%;
    padding: 1rem;
  }

  .join-game h2 {
    font-size: 1.5rem;
    margin-bottom: 1.5rem;
  }

  .game-info {
    padding: 1rem;
  }

  .game-info h3 {
    font-size: 1.1rem;
  }

  .game-info li {
    font-size: 0.9rem;
    margin-bottom: 0.75rem;
  }
}

@media (max-width: 480px) {
  .join-game {
    padding: 0.75rem;
  }

  .join-game h2 {
    font-size: 1.3rem;
    margin-bottom: 1rem;
  }

  .form-group {
    margin-bottom: 1rem;
  }

  .join-form {
    margin-bottom: 1.5rem;
  }

  .game-info {
    padding: 0.75rem;
  }

  .game-info li {
    font-size: 0.85rem;
  }
}
</style>