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
const uploadsDir = path.join(__dirname, "uploads");

// Criar pasta uploads se não existir
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir);
}

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

    // LOGIN
    if (msg.type === "login") {
      const { username, password, avatar } = msg;

      if (!username || username.length > 28) {
        return ws.send(JSON.stringify({ type: "error", text: "Nome inválido (máx 28 caracteres)" }));
      }

      if (usuarios[username]) {
        // Usuário já existe -> validar senha
        if (usuarios[username].password !== password) {
          return ws.send(JSON.stringify({ type: "error", text: "Senha incorreta para este usuário!" }));
        }
      } else {
        // Criar novo usuário
        usuarios[username] = { 
          password, 
          avatar: avatar || "https://i.imgur.com/6VBx3io.png" 
        };
        salvarUsuarios();
      }

      conectados.set(ws, { username, avatar: usuarios[username].avatar });

      ws.send(JSON.stringify({ type: "login_success", username }));

      mensagens.forEach((m) => ws.send(JSON.stringify(m)));

      atualizarLista();
      return;
    }

    if (!conectados.has(ws)) {
      return ws.send(JSON.stringify({ type: "error", text: "Você precisa fazer login primeiro!" }));
    }

    // ENVIAR MENSAGEM
    if (msg.type === "message") {
      const { username, avatar } = conectados.get(ws);
      if (!msg.text || msg.text.length > 70) return;

      // Transformar links em clicáveis
      let texto = msg.text.replace(/(https?:\/\/[^\s]+)/g, '<a href="$1" target="_blank">$1</a>');

      const mensagem = { type: "message", text: `${username}: ${texto}`, avatar };
      mensagens.push(mensagem);
      salvarMensagens();

      wss.clients.forEach((client) => {
        if (client.readyState === WebSocket.OPEN) {
          client.send(JSON.stringify(mensagem));
        }
      });
    }

    // ENVIAR ARQUIVO
    if (msg.type === "file") {
      const { username, avatar } = conectados.get(ws);
      if (!msg.name || !msg.data) return;

      const filePath = path.join(uploadsDir, msg.name);
      fs.writeFileSync(filePath, Buffer.from(msg.data, "base64"));

      const fileUrl = `/uploads/${msg.name}`;
      const mensagem = { 
        type: "message", 
        text: `${username}: <a href="${fileUrl}" target="_blank">${msg.name}</a>`, 
        avatar 
      };
      mensagens.push(mensagem);
      salvarMensagens();

      wss.clients.forEach((client) => {
        if (client.readyState === WebSocket.OPEN) {
          client.send(JSON.stringify(mensagem));
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
