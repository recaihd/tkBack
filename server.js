// server.js
const WebSocket = require("ws");
const http = require("http");

// Cria um servidor HTTP simples
const server = http.createServer((req, res) => {
  res.writeHead(200);
  res.end("Servidor de chat em tempo real rodando 🚀");
});

// Cria servidor WebSocket
const wss = new WebSocket.Server({ server });

wss.on("connection", (ws) => {
  console.log("Novo cliente conectado!");

  ws.on("message", (msg) => {
    console.log("Mensagem recebida:", msg.toString());

    // Reenvia a mensagem para todos os clientes conectados
    wss.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(msg.toString());
      }
    });
  });

  ws.on("close", () => {
    console.log("Cliente desconectado");
  });
});

// Porta (Render/Railway usam variável de ambiente PORT)
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
});
