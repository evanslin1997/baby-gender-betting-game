<template>
  <div class="join-game card">
    <h2>🎮 加入遊戲</h2>
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
        {{ gameStore.connected ? '加入遊戲' : '連線中...' }}
      </button>
    </form>

    <div class="game-info">
      <h3>🎯 遊戲規則</h3>
      <ul>
        <li>猜測寶寶是男生還是女生</li>
        <li>自訂下注金額</li>
        <li>猜對的玩家平分猜錯玩家的下注金額</li>
        <li>第一個加入的玩家成為主持人</li>
        <li>主持人負責開始遊戲和宣布結果</li>
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
</style>