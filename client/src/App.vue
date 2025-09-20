<template>
  <div id="app">
    <header class="app-header">
      <h1>👶 寶寶性別猜猜樂</h1>
      <div v-if="gameStore.connected" class="connection-status connected">
        ✅ 已連線
      </div>
      <div v-else class="connection-status disconnected">
        ❌ 未連線
      </div>
    </header>

    <main class="app-main">
      <JoinGame v-if="!gameStore.currentPlayer" />
      <GameRoom v-else />
    </main>
  </div>
</template>

<script setup lang="ts">
import { onMounted, onUnmounted } from 'vue'
import { useGameStore } from './stores/game'
import JoinGame from './components/JoinGame.vue'
import GameRoom from './components/GameRoom.vue'

const gameStore = useGameStore()

onMounted(() => {
  gameStore.connect()
})

onUnmounted(() => {
  gameStore.disconnect()
})
</script>

<style>
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  font-family: 'Arial', sans-serif;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  min-height: 100vh;
}

#app {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
}

.app-header {
  background: rgba(255, 255, 255, 0.1);
  backdrop-filter: blur(10px);
  border-bottom: 1px solid rgba(255, 255, 255, 0.2);
  padding: 1rem 2rem;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.app-header h1 {
  color: white;
  font-size: 2rem;
  text-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
}

.connection-status {
  padding: 0.5rem 1rem;
  border-radius: 20px;
  font-weight: bold;
  font-size: 0.9rem;
}

.connected {
  background: rgba(76, 175, 80, 0.8);
  color: white;
}

.disconnected {
  background: rgba(244, 67, 54, 0.8);
  color: white;
}

.app-main {
  flex: 1;
  padding: 2rem;
  display: flex;
  justify-content: center;
  align-items: flex-start;
}

.card {
  background: rgba(255, 255, 255, 0.95);
  border-radius: 20px;
  padding: 2rem;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1);
  backdrop-filter: blur(10px);
  border: 1px solid rgba(255, 255, 255, 0.2);
}

.btn {
  padding: 0.75rem 1.5rem;
  border: none;
  border-radius: 10px;
  font-size: 1rem;
  font-weight: bold;
  cursor: pointer;
  transition: all 0.3s ease;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.btn-primary {
  background: linear-gradient(45deg, #667eea, #764ba2);
  color: white;
}

.btn-primary:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 15px rgba(102, 126, 234, 0.4);
}

.btn-success {
  background: linear-gradient(45deg, #4caf50, #45a049);
  color: white;
}

.btn-success:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 15px rgba(76, 175, 80, 0.4);
}

.btn-danger {
  background: linear-gradient(45deg, #f44336, #da190b);
  color: white;
}

.btn-danger:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 15px rgba(244, 67, 54, 0.4);
}

.btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
  transform: none;
}

.input {
  padding: 0.75rem;
  border: 2px solid #ddd;
  border-radius: 10px;
  font-size: 1rem;
  width: 100%;
  transition: border-color 0.3s ease;
}

.input:focus {
  outline: none;
  border-color: #667eea;
  box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
}
</style>