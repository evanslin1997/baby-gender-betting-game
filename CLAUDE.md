# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

### Full Application
- `npm run dev` - Start both backend and frontend concurrently
- `npm run install-all` - Install dependencies for both backend and client

### Backend (Node.js + Express + Socket.io)
- `npm run server` - Start backend server with nodemon (port 3001)
- `npm install` - Install backend dependencies

### Frontend (Vue 3 + TypeScript + Vite)
- `npm run client` - Start frontend dev server (port 5173)
- `cd client && npm run dev` - Alternative way to start frontend
- `cd client && npm run build` - Build for production
- `cd client && npm run type-check` - Run TypeScript type checking
- `cd client && npm install` - Install frontend dependencies

## Architecture Overview

This is a real-time multiplayer baby gender betting game with a client-server architecture:

### Backend (`server/index.js`)
- Express.js server with Socket.io for real-time communication
- Single game room supporting multiple players
- Game state management with betting logic and prize distribution
- WebSocket events: `join-game`, `start-betting`, `place-bet`, `announce-result`

### Frontend (`client/`)
- Vue 3 with TypeScript and Composition API
- Pinia for state management (`stores/game.ts`)
- Socket.io-client for real-time server communication
- Main components: `GameRoom.vue`, `JoinGame.vue`

### Game Flow
1. Players join with nicknames (first player becomes host)
2. Host starts betting phase
3. Players place bets on boy/girl with custom amounts
4. Host announces actual result
5. Winners split losers' total bet amounts proportionally
6. Host can start new rounds

### Key Data Structures
- Game state includes: status ('waiting'/'betting'/'ended'), players map, bets by choice, result, host
- Player object: id, name, isHost flag, balance
- Bet object: playerId, playerName, amount, choice ('boy'/'girl'), optional winAmount

### State Management
- Client-side state synchronized via Socket.io events
- Game store (`stores/game.ts`) handles all game state and socket communication
- Real-time updates for player joins/leaves, betting, and results

### Connection Details
- Backend runs on port 3001
- Frontend dev server on port 5173  
- CORS enabled for cross-origin requests
- Socket.io with wildcard origin for development