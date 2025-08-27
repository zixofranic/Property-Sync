import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { EmailService } from './email.service';
import { ResendProvider } from './resend.provider';
import { EmailTemplateService } from './template.service';

@Module({
  imports: [ConfigModule],
  providers: [EmailService, ResendProvider, EmailTemplateService],
  exports: [EmailService, ResendProvider, EmailTemplateService],
})
export class EmailModule {}
