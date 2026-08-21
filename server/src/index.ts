import http from "node:http";
import express from "express";

const PORT = Number(process.env.PORT ?? 8080);

const app = express();

app.get("/health", (_req, res) => {
  res.json({ ok: true });
});

const server = http.createServer(app);

server.listen(PORT, () => {
  console.log(`Servidor escuchando en http://localhost:${PORT}`);
});
