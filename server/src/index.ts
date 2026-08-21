import { createServer } from "./app";

const PORT = Number(process.env.PORT ?? 8080);

createServer().listen(PORT, () => {
  console.log(`Servidor escuchando en http://localhost:${PORT}`);
});
