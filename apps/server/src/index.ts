import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import { env } from './config/env';

const app = express();
app.use(cors({ origin: env.webOrigin, credentials: true }));
app.use(express.json());

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok' });
});

const httpServer = createServer(app);
const io = new SocketIOServer(httpServer, {
  cors: { origin: env.webOrigin, credentials: true },
});

io.on('connection', (socket) => {
  socket.on('disconnect', () => {
    // Room presence handling lands in Phase 2.
  });
});

httpServer.listen(env.port, () => {
  console.log(`bahjah server listening on :${env.port}`);
});
