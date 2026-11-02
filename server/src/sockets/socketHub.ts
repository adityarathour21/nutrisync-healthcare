import { Server as HttpServer } from 'node:http';
import { Server as SocketServer } from 'socket.io';
import jwt from 'jsonwebtoken';
import { dbStore, UserRole } from '../config/store.js';

const JWT_SECRET = process.env.JWT_SECRET || 'nutrisync_dev_jwt_secret_change_in_prod_2026';

let ioInstance: SocketServer | null = null;

export function initSocketHub(httpServer: HttpServer): SocketServer {
  const io = new SocketServer(httpServer, {
    cors: {
      origin: true,
      credentials: true,
    },
  });

  io.use((socket, next) => {
    const token =
      socket.handshake.auth?.token ||
      socket.handshake.headers.cookie
        ?.split(';')
        .map((c) => c.trim())
        .find((c) => c.startsWith('nutrisync_token='))
        ?.split('=')[1];

    if (!token) {
      return next();
    }

    try {
      const decoded = jwt.verify(decodeURIComponent(token), JWT_SECRET) as {
        sub: string;
        role: UserRole;
      };
      const user = dbStore.data.users.find((u) => u.id === decoded.sub && u.isActive);
      if (user) {
        socket.data.userId = user.id;
        socket.data.role = user.role;
      }
    } catch {
      // Unauthenticated socket remains outside protected rooms
    }
    next();
  });

  io.on('connection', (socket) => {
    const userId = socket.data.userId as string | undefined;
    const role = socket.data.role as UserRole | undefined;

    if (userId && role) {
      socket.join(`user:${userId}`);
      socket.join(`role:${role}`);
      socket.emit('session:connected', { userId, role, connectedAt: new Date().toISOString() });
    }
  });

  ioInstance = io;
  return io;
}

export function emitToUser(userId: string, event: string, payload: unknown): void {
  ioInstance?.to(`user:${userId}`).emit(event, payload);
}

export function emitToRole(role: UserRole, event: string, payload: unknown): void {
  ioInstance?.to(`role:${role}`).emit(event, payload);
}
