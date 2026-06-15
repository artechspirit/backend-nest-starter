import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { Logger } from '@nestjs/common';

@WebSocketGateway({
  cors: {
    origin: '*', // Adjust for production
  },
  namespace: 'notifications',
})
export class NotificationGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server!: Server;

  private readonly logger = new Logger(NotificationGateway.name);

  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  async handleConnection(socket: Socket) {
    try {
      const token =
        socket.handshake.auth?.token ||
        (socket.handshake.query?.token as string | undefined);

      if (!token) {
        socket.disconnect();
        return;
      }

      const secret = this.configService.getOrThrow<string>('JWT_ACCESS_SECRET');
      const decoded = await this.jwtService.verifyAsync(token, { secret });

      socket.data.user = decoded;
      const roomName = `user_${decoded.sub}`;
      await socket.join(roomName);

      this.logger.debug(
        `Client connected to WebSocket: user ${decoded.sub} (Socket ${socket.id})`,
      );
    } catch (err) {
      this.logger.warn(`WebSocket connection unauthorized: ${err}`);
      socket.disconnect();
    }
  }

  handleDisconnect(socket: Socket) {
    this.logger.debug(`Client disconnected from WebSocket: ${socket.id}`);
  }

  sendToUser(userId: string, event: string, payload: any) {
    const roomName = `user_${userId}`;
    this.server.to(roomName).emit(event, payload);
  }
}
