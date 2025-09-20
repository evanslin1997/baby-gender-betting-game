const http = require('http');

const server = http.createServer((req, res) => {
  res.writeHead(200, {'Content-Type': 'text/html; charset=utf-8'});
  res.end(`
    <html>
      <head><title>測試頁面</title></head>
      <body>
        <h1>🎮 服務器正常運行！</h1>
        <p>如果你看到這個頁面，說明服務器工作正常。</p>
        <p>時間: ${new Date().toLocaleString()}</p>
      </body>
    </html>
  `);
});

const PORT = 3333;
server.listen(PORT, '127.0.0.1', () => {
  console.log(`✅ 測試服務器啟動成功！端口: ${PORT}`);
  console.log(`🌐 請訪問: http://localhost:${PORT}`);
});