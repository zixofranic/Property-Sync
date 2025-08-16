import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { EmailService } from './email.service';
import { ResendProvider } from './resend.provider';

@Module({
  imports: [ConfigModule],
  providers: [
    EmailService,
    ResendProvider,
  ],
  exports: [
    EmailService,
    ResendProvider,
  ],
})
export class EmailModule {}