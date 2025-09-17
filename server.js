const WebSocket = require("ws");
const http = require("http");

const server = http.createServer((req, res) => {
  res.writeHead(200);
  res.end("Servidor de chat em tempo real rodando 🚀");
});

const wss = new WebSocket.Server({ server });

let mensagens = []; // histórico em memória

wss.on("connection", (ws) => {
  console.log("Novo cliente conectado!");

  // Envia o histórico para quem acabou de entrar
  mensagens.forEach((msg) => ws.send(msg));

  ws.on("message", (msg) => {
    const texto = msg.toString();
    console.log("Mensagem recebida:", texto);

    mensagens.push(texto); // salva no histórico

    // Reenvia para todos os clientes conectados
    wss.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(texto);
      }
    });
  });

  ws.on("close", () => {
    console.log("Cliente desconectado");
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
});
