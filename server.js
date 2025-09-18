const WebSocket = require("ws");
const http = require("http");
const fs = require("fs");
const path = require("path");

const server = http.createServer((req, res) => {
  res.writeHead(200);
  res.end("Servidor de chat em tempo real rodando 🚀");
});

const wss = new WebSocket.Server({ server });

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

function salvarUsuarios() {
  fs.writeFileSync(usersFile, JSON.stringify(usuarios, null, 2));
}

function salvarMensagens() {
  fs.writeFileSync(messagesFile, JSON.stringify(mensagens, null, 2));
}

let conectados = new Map(); // ws -> {username, avatar}

function atualizarLista() {
  const lista = Array.from(conectados.values());
  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify({ type: "user_list", users: lista }));
    }
  });
}

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

    if (msg.type === "login") {
      const { username, password, avatar } = msg;

      if (!username || username.length > 28) {
        return ws.send(JSON.stringify({ type: "error", text: "Nome inválido (máx 28 caracteres)" }));
      }

      if (usuarios[username] && usuarios[username].password !== password) {
        return ws.send(JSON.stringify({ type: "error", text: "Senha incorreta!" }));
      }

      usuarios[username] = { password, avatar: avatar || "https://i.imgur.com/6VBx3io.png" };
      salvarUsuarios();
      conectados.set(ws, { username, avatar: usuarios[username].avatar });

      ws.send(JSON.stringify({ type: "login_success", username }));

      mensagens.forEach((m) => ws.send(JSON.stringify({ type: "message", text: m.text, avatar: m.avatar })));

      atualizarLista();
      return;
    }

    if (!conectados.has(ws)) {
      return ws.send(JSON.stringify({ type: "error", text: "Você precisa fazer login primeiro!" }));
    }

    if (msg.type === "message") {
      const { username, avatar } = conectados.get(ws);
      if (!msg.text || msg.text.length > 70) return;

      const texto = `${username}: ${msg.text}`;
      const mensagem = { text: texto, avatar };
      mensagens.push(mensagem);

      salvarMensagens();

      wss.clients.forEach((client) => {
        if (client.readyState === WebSocket.OPEN) {
          client.send(JSON.stringify({ type: "message", text: texto, avatar }));
        }
      });
    }
  });

  ws.on("close", () => {
    conectados.delete(ws);
    atualizarLista();
    console.log("Cliente desconectado");
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
});
