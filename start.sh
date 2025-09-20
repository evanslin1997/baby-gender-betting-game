#!/bin/bash

echo "🥛 林豆漿有沒有GG啟動腳本"
echo "==============================="

# 檢查 Node.js 是否安裝
if ! command -v node &> /dev/null; then
    echo "❌ 錯誤: 未找到 Node.js"
    echo "請先安裝 Node.js: https://nodejs.org/"
    exit 1
fi

echo "✅ Node.js 版本: $(node --version)"

# 修復 npm 權限 (如果需要)
echo "🔧 檢查並修復 npm 權限..."
if [ -d "$HOME/.npm" ]; then
    sudo chown -R $(whoami) "$HOME/.npm" 2>/dev/null || echo "⚠️  無法修復 npm 權限，可能需要手動執行: sudo chown -R \$(whoami) ~/.npm"
fi

# 安裝後端依賴
echo "📦 安裝後端依賴..."
if [ ! -d "node_modules" ]; then
    npm install || {
        echo "❌ 後端依賴安裝失敗"
        echo "請手動執行: npm install"
        exit 1
    }
else
    echo "✅ 後端依賴已安裝"
fi

# 安裝前端依賴
echo "📦 安裝前端依賴..."
cd client
if [ ! -d "node_modules" ]; then
    npm install || {
        echo "❌ 前端依賴安裝失敗"
        echo "請進入 client 目錄手動執行: npm install"
        exit 1
    }
else
    echo "✅ 前端依賴已安裝"
fi
cd ..

echo ""
echo "🚀 準備啟動應用..."
echo "後端服務將在 http://localhost:3001 啟動"
echo "前端服務將在 http://localhost:5173 啟動"
echo ""
echo "按 Ctrl+C 停止服務"
echo ""

# 啟動應用
npm run dev