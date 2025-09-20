#!/bin/bash

echo "🎮 啟動寶寶性別投注遊戲服務器"
echo "================================"

# 清理可能占用端口的進程
echo "🧹 清理端口 3333..."
lsof -ti:3333 | xargs kill -9 2>/dev/null || true
sleep 1

# 檢查 Node.js 是否可用
if ! command -v node &> /dev/null; then
    echo "❌ 錯誤: 未找到 Node.js"
    exit 1
fi

echo "✅ Node.js 版本: $(node --version)"

# 啟動服務器
echo "🚀 啟動遊戲服務器..."
cd "$(dirname "$0")"

node improved-server.js