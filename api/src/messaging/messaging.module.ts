import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { MessagingController } from './messaging.controller';
import { MessagingService } from './messaging.service';
// V1 messaging gateway disabled in favor of V2
// import { MessagingGateway } from './messaging.gateway';
import { ConversationsV2Controller } from './conversations-v2.controller';
import { ConversationV2Service } from './conversation-v2.service';
import { MessageV2Service } from './message-v2.service';
import { WebSocketV2Gateway } from './websocket-v2.gateway';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [
    PrismaModule,
    JwtModule.register({
      secret: process.env.JWT_SECRET || 'fallback-secret-for-development',
      signOptions: { expiresIn: '7d' },
    }),
  ],
  controllers: [MessagingController, ConversationsV2Controller],
  providers: [
    MessagingService,
    // MessagingGateway, // V1 gateway disabled in favor of V2
    ConversationV2Service,
    MessageV2Service,
    WebSocketV2Gateway,
  ],
  exports: [MessagingService, ConversationV2Service, MessageV2Service],
})
export class MessagingModule {}