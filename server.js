const WebSocket = require("ws");
const http = require("http");
const fs = require("fs");
const path = require("path");

const server = http.createServer((req, res) => {
  res.writeHead(200);
  res.end("Servidor de chat em tempo real rodando 🚀");
});

const wss = new WebSocket.Server({ server });

// Arquivos JSON
const usersFile = path.join(__dirname, "users.json");
const messagesFile = path.join(__dirname, "messages.json");

let usuarios = {};
let mensagens = [];

// Carregar usuários
if (fs.existsSync(usersFile)) {
  usuarios = JSON.parse(fs.readFileSync(usersFile, "utf8"));
}

// Carregar mensagens
if (fs.existsSync(messagesFile)) {
  mensagens = JSON.parse(fs.readFileSync(messagesFile, "utf8"));
}

// Salvar dados
function salvarUsuarios() {
  fs.writeFileSync(usersFile, JSON.stringify(usuarios, null, 2));
}

function salvarMensagens() {
  fs.writeFileSync(messagesFile, JSON.stringify(mensagens, null, 2));
}

let conectados = new Map();

wss.on("connection", (ws) => {
  console.log("Novo cliente conectado!");
  ws.send(JSON.stringify({ type: "login_required" }));

  ws.on("message", (data) => {
    let msg;
    try {
      msg = JSON.parse(data.toString());
    } catch {
      return;
    }

    // LOGIN
    if (msg.type === "login") {
      const { username, password, avatar } = msg;

      if (!username || username.length > 28) {
        return ws.send(JSON.stringify({ type: "error", text: "Nome inválido (máx 28 caracteres)" }));
      }

      if (usuarios[username] && usuarios[username].password !== password) {
        return ws.send(JSON.stringify({ type: "error", text: "Nome de usuário já está em uso!" }));
      }

      usuarios[username] = { password, avatar: avatar || null };
      salvarUsuarios();
      conectados.set(ws, username);

      ws.send(JSON.stringify({ type: "login_success", username }));

      mensagens.forEach((m) => ws.send(JSON.stringify({ type: "message", text: m.text, avatar: m.avatar })));
      return;
    }

    // BLOQUEIO sem login
    if (!conectados.has(ws)) {
      return ws.send(JSON.stringify({ type: "error", text: "Você precisa fazer login primeiro!" }));
    }

    // MENSAGENS
    if (msg.type === "message") {
      const username = conectados.get(ws);
      let texto = msg.text.trim();

      if (texto.length > 70) {
        return ws.send(JSON.stringify({ type: "error", text: "Mensagem muito longa (máx 70 caracteres)." }));
      }

      const avatar = usuarios[username]?.avatar || null;
      const mensagemFinal = { text: `${username}: ${texto}`, avatar };

      mensagens.push(mensagemFinal);
      salvarMensagens();

      wss.clients.forEach((client) => {
        if (client.readyState === WebSocket.OPEN) {
          client.send(JSON.stringify({ type: "message", text: mensagemFinal.text, avatar: mensagemFinal.avatar }));
        }
      });
    }
  });

  ws.on("close", () => {
    conectados.delete(ws);
    console.log("Cliente desconectado");
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
});
