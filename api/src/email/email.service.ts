import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ResendProvider } from './resend.provider';
import * as nodemailer from 'nodemailer';

export interface TimelineEmailData {
  clientEmail: string;
  clientName: string;
  agentName: string;
  agentCompany: string;
  timelineUrl: string;
  propertyCount: number;
  spouseEmail?: string;
  agentPhoto?: string;
  brandColor?: string;
  templateStyle?: 'modern' | 'classical';
}

export interface PropertyNotificationData {
  clientEmail: string;
  clientName: string;
  agentName: string;
  propertyAddress: string;
  propertyPrice: number;
  propertyDescription: string;
  propertyImageUrl: string;
  timelineUrl: string;
  spouseEmail?: string;
}

export interface FeedbackReminderData {
  clientEmail: string;
  clientName: string;
  agentName: string;
  pendingPropertiesCount: number;
  timelineUrl: string;
  daysSinceLastActivity: number;
}

export interface BatchImportNotificationData {
  clientEmail: string;
  clientName: string;
  agentName: string;
  propertyCount: number;
  timelineUrl: string;
  spouseEmail?: string;
  propertyAddresses: string[];
}

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private transporter: nodemailer.Transporter;

  constructor(
    private configService: ConfigService,
    private resendProvider: ResendProvider,
  ) {
    this.initializeTransporter();
  }

  private async initializeTransporter() {
    if (process.env.NODE_ENV === 'production') {
      // Production email setup
      this.transporter = nodemailer.createTransport({
        host: this.configService.get('SMTP_HOST'),
        port: 587,
        secure: false,
        auth: {
          user: this.configService.get('SMTP_USER'),
          pass: this.configService.get('SMTP_PASS'),
        },
      });
    } else {
      // Development: Use Ethereal Email (fake SMTP for testing)
      const testAccount = await nodemailer.createTestAccount();

      this.transporter = nodemailer.createTransport({
        host: 'smtp.ethereal.email',
        port: 587,
        secure: false,
        auth: {
          user: testAccount.user,
          pass: testAccount.pass,
        },
      });
    }
  }

  // ENHANCED: Timeline Email with Resend Primary + Nodemailer Fallback
  async sendTimelineEmail(data: TimelineEmailData): Promise<{
    success: boolean;
    messageId?: string;
    provider?: string;
    error?: string;
  }> {
    this.logger.log(
      `Sending timeline email to ${data.clientEmail} via ${data.agentName}`,
    );

    // Try Resend first
    try {
      const resendResult = await this.resendProvider.sendTimelineEmail({
        to: data.clientEmail,
        clientName: data.clientName,
        agentName: data.agentName,
        agentCompany: data.agentCompany,
        timelineUrl: data.timelineUrl,
        propertyCount: data.propertyCount,
        spouseEmail: data.spouseEmail,
        agentPhoto: data.agentPhoto,
        brandColor: data.brandColor || '#3b82f6',
        templateStyle: data.templateStyle || 'modern',
      });

      if (resendResult.error) {
        this.logger.error(`Resend email failed: ${JSON.stringify(resendResult.error)}`);
        
        // Special handling for configuration errors
        if (resendResult.error.includes('RESEND_API_KEY')) {
          return {
            success: false,
            error: `Configuration Error: ${resendResult.error}`,
          };
        }
        
        return {
          success: false,
          error: JSON.stringify(resendResult.error),
        };
      }

      if ('data' in resendResult && resendResult.data?.id) {
        this.logger.log(
          `Timeline email sent successfully via Resend: ${resendResult.data.id}`,
        );
        return {
          success: true,
          messageId: resendResult.data.id,
          provider: 'resend',
        };
      }
    } catch (error) {
      this.logger.warn(`Resend failed for timeline email: ${error.message}`);

      // Check if we should fallback (network, rate limit, auth errors)
      if (this.shouldFallbackToNodemailer(error)) {
        this.logger.log('Attempting nodemailer fallback for timeline email...');
        return await this.sendTimelineEmailViaNodemailer(data);
      } else {
        // If it's a non-recoverable error, don't fallback
        return {
          success: false,
          error: `Resend failed: ${error.message}`,
        };
      }
    }

    // If Resend didn't return data but didn't throw, try fallback
    this.logger.warn(
      'Resend returned no data, attempting nodemailer fallback...',
    );
    return await this.sendTimelineEmailViaNodemailer(data);
  }

  // NEW: Property Update Notification
  async sendPropertyNotification(
    data: PropertyNotificationData,
  ): Promise<{ success: boolean; messageId?: string; provider?: string }> {
    this.logger.log(
      `Sending property notification to ${data.clientEmail} for ${data.propertyAddress}`,
    );

    try {
      const resendResult =
        await this.resendProvider.sendPropertyNotification(data);

      if (resendResult.data?.id) {
        this.logger.log(
          `Property notification sent via Resend: ${resendResult.data.id}`,
        );
        return {
          success: true,
          messageId: resendResult.data.id,
          provider: 'resend',
        };
      }
    } catch (error) {
      this.logger.warn(
        `Resend failed for property notification: ${error.message}`,
      );

      if (this.shouldFallbackToNodemailer(error)) {
        return await this.sendPropertyNotificationViaNodemailer(data);
      }
    }

    return { success: false };
  }

  // NEW: Feedback Reminder Email
  async sendFeedbackReminder(
    data: FeedbackReminderData,
  ): Promise<{ success: boolean; messageId?: string; provider?: string }> {
    this.logger.log(`Sending feedback reminder to ${data.clientEmail}`);

    try {
      const resendResult = await this.resendProvider.sendFeedbackReminder(data);

      if (resendResult.data?.id) {
        this.logger.log(
          `Feedback reminder sent via Resend: ${resendResult.data.id}`,
        );
        return {
          success: true,
          messageId: resendResult.data.id,
          provider: 'resend',
        };
      }
    } catch (error) {
      this.logger.warn(`Resend failed for feedback reminder: ${error.message}`);

      if (this.shouldFallbackToNodemailer(error)) {
        return await this.sendFeedbackReminderViaNodemailer(data);
      }
    }

    return { success: false };
  }

  // NEW: Batch Import Notification Email
  async sendBatchImportNotification(
    data: BatchImportNotificationData,
  ): Promise<{ success: boolean; messageId?: string; provider?: string }> {
    this.logger.log(
      `Sending batch import notification to ${data.clientEmail} for ${data.propertyCount} properties`,
    );

    try {
      const resendResult =
        await this.resendProvider.sendBatchImportNotification(data);

      if (resendResult.data?.id) {
        this.logger.log(
          `Batch import notification sent via Resend: ${resendResult.data.id}`,
        );
        return {
          success: true,
          messageId: resendResult.data.id,
          provider: 'resend',
        };
      }
    } catch (error) {
      this.logger.warn(
        `Resend failed for batch import notification: ${error.message}`,
      );

      if (this.shouldFallbackToNodemailer(error)) {
        return await this.sendBatchImportNotificationViaNodemailer(data);
      }
    }

    return { success: false };
  }

  // ENHANCED: Verification Email with Fallback
  async sendVerificationEmail(
    email: string,
    firstName: string,
    verificationToken: string,
  ): Promise<{ success: boolean; messageId?: string; provider?: string; error?: string }> {
    this.logger.log(`Sending verification email to ${email}`);

    // Try Resend first
    try {
      const resendResult = await this.resendProvider.sendVerificationEmail(
        email,
        firstName,
        verificationToken,
      );

      if (resendResult.error) {
        this.logger.error(`Resend verification email failed: ${JSON.stringify(resendResult.error)}`);
        return {
          success: false,
          error: JSON.stringify(resendResult.error),
        };
      }

      if ('data' in resendResult && resendResult.data?.id) {
        this.logger.log(
          `Verification email sent via Resend: ${resendResult.data.id}`,
        );
        return {
          success: true,
          messageId: resendResult.data.id,
          provider: 'resend',
        };
      }
    } catch (error) {
      this.logger.warn(
        `Resend failed for verification email: ${error.message}`,
      );

      if (this.shouldFallbackToNodemailer(error)) {
        return await this.sendVerificationEmailViaNodemailer(
          email,
          firstName,
          verificationToken,
        );
      }
    }

    return { success: false };
  }

  // ENHANCED: Welcome Email with Fallback
  async sendWelcomeEmail(
    email: string,
    firstName: string,
  ): Promise<{ success: boolean; messageId?: string; provider?: string; error?: string }> {
    this.logger.log(`Sending welcome email to ${email}`);

    // Try Resend first
    try {
      const resendResult = await this.resendProvider.sendWelcomeEmail(
        email,
        firstName,
      );

      if (resendResult.error) {
        this.logger.error(`Resend welcome email failed: ${JSON.stringify(resendResult.error)}`);
        return {
          success: false,
          error: JSON.stringify(resendResult.error),
        };
      }

      if ('data' in resendResult && resendResult.data?.id) {
        this.logger.log(
          `Welcome email sent via Resend: ${resendResult.data.id}`,
        );
        return {
          success: true,
          messageId: resendResult.data.id,
          provider: 'resend',
        };
      }
    } catch (error) {
      this.logger.warn(`Resend failed for welcome email: ${error.message}`);

      if (this.shouldFallbackToNodemailer(error)) {
        return await this.sendWelcomeEmailViaNodemailer(email, firstName);
      }
    }

    return { success: false };
  }

  // PRIVATE: Fallback Logic
  private shouldFallbackToNodemailer(error: any): boolean {
    const errorMessage = error?.message?.toLowerCase() || '';
    const errorCode = error?.code;

    // Network errors
    if (
      errorMessage.includes('network') ||
      errorMessage.includes('timeout') ||
      errorMessage.includes('connection') ||
      errorCode === 'ENOTFOUND' ||
      errorCode === 'ECONNREFUSED'
    ) {
      return true;
    }

    // Rate limiting
    if (
      errorMessage.includes('rate limit') ||
      errorMessage.includes('too many requests') ||
      error?.statusCode === 429
    ) {
      return true;
    }

    // Authentication issues
    if (
      errorMessage.includes('unauthorized') ||
      errorMessage.includes('invalid api key') ||
      errorMessage.includes('authentication') ||
      error?.statusCode === 401 ||
      error?.statusCode === 403
    ) {
      return true;
    }

    // Service unavailable
    if (error?.statusCode >= 500) {
      return true;
    }

    return false;
  }

  // PRIVATE: Nodemailer Fallback Methods
  private async sendTimelineEmailViaNodemailer(
    data: TimelineEmailData,
  ): Promise<{
    success: boolean;
    messageId?: string;
    provider?: string;
    error?: string;
  }> {
    try {
      const mailOptions = {
        from: 'Acme <onboarding@resend.dev>', // this the production send email'"Property Sync" <noreply@propertysync.com>',
        to: data.clientEmail,
        subject: `Your Property Timeline from ${data.agentName}`,
        html: this.generateTimelineEmailHtmlNodemailer(data),
        text: this.generateTimelineEmailTextNodemailer(data),
      };

      const info = await this.transporter.sendMail(mailOptions);

      if (process.env.NODE_ENV !== 'production') {
        this.logger.log(
          'Nodemailer Preview URL: %s',
          nodemailer.getTestMessageUrl(info),
        );
      }

      return {
        success: true,
        messageId: info.messageId,
        provider: 'nodemailer',
      };
    } catch (error) {
      this.logger.error('Nodemailer fallback failed:', error);
      return {
        success: false,
        error: error.message,
        provider: 'nodemailer',
      };
    }
  }

  private async sendPropertyNotificationViaNodemailer(
    data: PropertyNotificationData,
  ): Promise<{ success: boolean; messageId?: string; provider?: string }> {
    try {
      const mailOptions = {
        from: '"Property Sync" <noreply@propertysync.com>',
        to: data.clientEmail,
        subject: `New Property Added: ${data.propertyAddress}`,
        html: this.generatePropertyNotificationHtml(data),
        text: `New Property Added!\n\n${data.agentName} has added a new property to your timeline:\n\n${data.propertyAddress}\nPrice: $${data.propertyPrice.toLocaleString()}\n\n${data.propertyDescription}\n\nView your timeline: ${data.timelineUrl}`,
      };

      const info = await this.transporter.sendMail(mailOptions);
      return {
        success: true,
        messageId: info.messageId,
        provider: 'nodemailer',
      };
    } catch (error) {
      this.logger.error(
        'Property notification nodemailer fallback failed:',
        error,
      );
      return { success: false };
    }
  }

  private async sendFeedbackReminderViaNodemailer(
    data: FeedbackReminderData,
  ): Promise<{ success: boolean; messageId?: string; provider?: string }> {
    try {
      const mailOptions = {
        from: '"Property Sync" <noreply@propertysync.com>',
        to: data.clientEmail,
        subject: `Feedback Requested: ${data.pendingPropertiesCount} Properties Await Your Response`,
        html: this.generateFeedbackReminderHtml(data),
        text: `Hi ${data.clientName}!\n\nYou have ${data.pendingPropertiesCount} properties waiting for your feedback from ${data.agentName}.\n\nIt's been ${data.daysSinceLastActivity} days since your last activity. Your input helps us find you the perfect home!\n\nView your timeline: ${data.timelineUrl}`,
      };

      const info = await this.transporter.sendMail(mailOptions);
      return {
        success: true,
        messageId: info.messageId,
        provider: 'nodemailer',
      };
    } catch (error) {
      this.logger.error('Feedback reminder nodemailer fallback failed:', error);
      return { success: false };
    }
  }

  private async sendBatchImportNotificationViaNodemailer(
    data: BatchImportNotificationData,
  ): Promise<{ success: boolean; messageId?: string; provider?: string }> {
    try {
      const mailOptions = {
        from: '"Property Sync" <noreply@propertysync.com>',
        to: data.clientEmail,
        subject: `${data.propertyCount} New Properties Added to Your Timeline`,
        html: this.generateBatchImportNotificationHtml(data),
        text: `Hi ${data.clientName}!\n\n${data.agentName} has added ${data.propertyCount} new properties to your timeline:\n\n${data.propertyAddresses.map((addr, i) => `${i + 1}. ${addr}`).join('\n')}\n\nView your updated timeline: ${data.timelineUrl}`,
      };

      const info = await this.transporter.sendMail(mailOptions);
      return {
        success: true,
        messageId: info.messageId,
        provider: 'nodemailer',
      };
    } catch (error) {
      this.logger.error(
        'Batch import notification nodemailer fallback failed:',
        error,
      );
      return { success: false };
    }
  }

  private async sendVerificationEmailViaNodemailer(
    email: string,
    firstName: string,
    verificationToken: string,
  ): Promise<{ success: boolean; messageId?: string; provider?: string }> {
    const verificationUrl = `${this.configService.get('FRONTEND_URL') || 'http://localhost:3000'}/verify-email?token=${verificationToken}`;

    const mailOptions = {
      from: '"Property Sync" <noreply@propertysync.com>',
      to: email,
      subject: 'Welcome to Property Sync - Verify Your Email',
      html: this.getVerificationEmailTemplate(firstName, verificationUrl),
      text: `Hi ${firstName},\n\nWelcome to Property Sync! Please verify your email address by clicking the link below:\n${verificationUrl}\n\nThis link will expire in 24 hours.\n\nBest regards,\nThe Property Sync Team`,
    };

    try {
      const info = await this.transporter.sendMail(mailOptions);

      if (process.env.NODE_ENV !== 'production') {
        this.logger.log(
          'Verification Email Preview URL: %s',
          nodemailer.getTestMessageUrl(info),
        );
      }

      return {
        success: true,
        messageId: info.messageId,
        provider: 'nodemailer',
      };
    } catch (error) {
      this.logger.error(
        'Verification email nodemailer fallback failed:',
        error,
      );
      return { success: false };
    }
  }

  private async sendWelcomeEmailViaNodemailer(
    email: string,
    firstName: string,
  ): Promise<{ success: boolean; messageId?: string; provider?: string }> {
    const dashboardUrl = `${this.configService.get('FRONTEND_URL') || 'http://localhost:3000'}/dashboard`;

    const mailOptions = {
      from: '"Property Sync" <noreply@propertysync.com>',
      to: email,
      subject: '🎉 Welcome to Property Sync - Your Account is Ready!',
      html: this.getWelcomeEmailTemplate(firstName, dashboardUrl),
      text: `Hi ${firstName},\n\nYour Property Sync account is now verified and ready to use!\n\nGet started: ${dashboardUrl}\n\nBest regards,\nThe Property Sync Team`,
    };

    try {
      const info = await this.transporter.sendMail(mailOptions);

      if (process.env.NODE_ENV !== 'production') {
        this.logger.log(
          'Welcome Email Preview URL: %s',
          nodemailer.getTestMessageUrl(info),
        );
      }

      return {
        success: true,
        messageId: info.messageId,
        provider: 'nodemailer',
      };
    } catch (error) {
      this.logger.error('Welcome email nodemailer fallback failed:', error);
      return { success: false };
    }
  }

  // PRIVATE: HTML Template Generators (Nodemailer versions)
  private generateTimelineEmailHtmlNodemailer(data: TimelineEmailData): string {
    const templateStyle = data.templateStyle || 'modern';
    const brandColor = data.brandColor || '#3b82f6';

    if (templateStyle === 'classical') {
      return this.getClassicalTimelineTemplate(data, brandColor);
    } else {
      return this.getModernTimelineTemplate(data, brandColor);
    }
  }

  private generateTimelineEmailTextNodemailer(data: TimelineEmailData): string {
    return `
      Hi ${data.clientName}!

      ${data.agentName} from ${data.agentCompany} has created a personalized property timeline just for you.

      I've carefully selected ${data.propertyCount} properties that match your criteria.

      View Your Properties: ${data.timelineUrl}

      How it works:
      - Browse each property at your own pace
      - Leave feedback using the Love, Let's Talk, or Not for Me buttons
      - Add your personal notes

      Best regards,
      ${data.agentName}
      ${data.agentCompany}

      Powered by Property Sync
    `.trim();
  }

  private generatePropertyNotificationHtml(
    data: PropertyNotificationData,
  ): string {
    return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>New Property Added</title></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="text-align: center; padding: 30px 0; border-bottom: 3px solid #3b82f6;">
    <h1 style="color: #1e293b; margin: 0;">New Property Added!</h1>
    <p style="color: #64748b; margin: 10px 0 0 0;">From ${data.agentName}</p>
  </div>
  
  <div style="padding: 40px 20px;">
    <h2 style="color: #1e293b;">Hi ${data.clientName}! 🏡</h2>
    <p>I've added a new property to your timeline that I think you'll love:</p>
    
    <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 20px; margin: 20px 0;">
      <img src="${data.propertyImageUrl}" alt="${data.propertyAddress}" style="width: 100%; height: 200px; object-fit: cover; border-radius: 8px; margin-bottom: 15px;">
      <h3 style="margin: 0 0 10px 0; color: #1e293b;">${data.propertyAddress}</h3>
      <p style="font-size: 24px; font-weight: bold; color: #059669; margin: 0 0 10px 0;">$${data.propertyPrice.toLocaleString()}</p>
      <p style="color: #64748b; margin: 0;">${data.propertyDescription}</p>
    </div>
    
    <div style="background: linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%); padding: 30px; border-radius: 12px; text-align: center; margin: 30px 0;">
      <h3 style="color: white; margin: 0 0 20px 0;">View Your Timeline</h3>
      <a href="${data.timelineUrl}" style="display: inline-block; background: white; color: #3b82f6; padding: 15px 30px; border-radius: 8px; text-decoration: none; font-weight: bold;">See All Properties →</a>
    </div>
  </div>
</body>
</html>`;
  }

  private generateFeedbackReminderHtml(data: FeedbackReminderData): string {
    return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>Feedback Requested</title></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="text-align: center; padding: 30px 0; border-bottom: 3px solid #f59e0b;">
    <h1 style="color: #1e293b; margin: 0;">Your Feedback Awaited</h1>
    <p style="color: #64748b; margin: 10px 0 0 0;">From ${data.agentName}</p>
  </div>
  
  <div style="padding: 40px 20px;">
    <h2 style="color: #1e293b;">Hi ${data.clientName}! 💭</h2>
    <p>You have <strong>${data.pendingPropertiesCount} properties</strong> waiting for your feedback.</p>
    <p>It's been ${data.daysSinceLastActivity} days since your last activity. Your input helps me find you the perfect home!</p>
    
    <div style="background: linear-gradient(135deg, #f59e0b 0%, #f97316 100%); padding: 30px; border-radius: 12px; text-align: center; margin: 30px 0;">
      <h3 style="color: white; margin: 0 0 20px 0;">Share Your Thoughts</h3>
      <a href="${data.timelineUrl}" style="display: inline-block; background: white; color: #f59e0b; padding: 15px 30px; border-radius: 8px; text-decoration: none; font-weight: bold;">Review Properties →</a>
    </div>
    
    <div style="background: #fef3c7; padding: 20px; border-radius: 8px; border-left: 4px solid #f59e0b;">
      <p style="margin: 0; color: #92400e;"><strong>Quick Reminder:</strong> Use the ❤️ Love, 💬 Let's Talk, or ❌ Not for Me buttons to let me know your thoughts on each property.</p>
    </div>
  </div>
</body>
</html>`;
  }

  private generateBatchImportNotificationHtml(
    data: BatchImportNotificationData,
  ): string {
    return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>New Properties Added</title></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="text-align: center; padding: 30px 0; border-bottom: 3px solid #22c55e;">
    <h1 style="color: #1e293b; margin: 0;">${data.propertyCount} New Properties Added!</h1>
    <p style="color: #64748b; margin: 10px 0 0 0;">From ${data.agentName}</p>
  </div>
  
  <div style="padding: 40px 20px;">
    <h2 style="color: #1e293b;">Hi ${data.clientName}! 🏡</h2>
    <p>Great news! I've added <strong>${data.propertyCount} new properties</strong> to your timeline that I think you'll love:</p>
    
    <div style="background: #f0fdf4; border: 1px solid #22c55e; border-radius: 12px; padding: 20px; margin: 20px 0;">
      <h3 style="margin: 0 0 15px 0; color: #1e293b;">New Property Addresses:</h3>
      <ul style="margin: 0; padding-left: 20px; color: #374151;">
        ${data.propertyAddresses.map((address) => `<li style="margin: 5px 0;">${address}</li>`).join('')}
      </ul>
    </div>
    
    <div style="background: linear-gradient(135deg, #22c55e 0%, #16a34a 100%); padding: 30px; border-radius: 12px; text-align: center; margin: 30px 0;">
      <h3 style="color: white; margin: 0 0 20px 0;">View Your Updated Timeline</h3>
      <a href="${data.timelineUrl}" style="display: inline-block; background: white; color: #22c55e; padding: 15px 30px; border-radius: 8px; text-decoration: none; font-weight: bold;">See All Properties →</a>
    </div>
    
    <div style="background: #ecfdf5; padding: 20px; border-radius: 8px; border-left: 4px solid #22c55e;">
      <p style="margin: 0; color: #166534;"><strong>Next Steps:</strong> Browse each property and share your thoughts using the ❤️ Love, 💬 Let's Talk, or ❌ Not for Me buttons. Your feedback helps me find you the perfect home!</p>
    </div>
  </div>
</body>
</html>`;
  }

  private getModernTimelineTemplate(
    data: TimelineEmailData,
    brandColor: string,
  ): string {
    return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>Your Property Timeline</title></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="text-align: center; padding: 40px 0; background: linear-gradient(135deg, ${brandColor} 0%, #8b5cf6 100%); border-radius: 16px; margin-bottom: 30px;">
    ${data.agentPhoto ? `<img src="${data.agentPhoto}" alt="${data.agentName}" style="width: 80px; height: 80px; border-radius: 50%; border: 4px solid white; margin-bottom: 20px;">` : ''}
    <h1 style="color: white; margin: 0; font-size: 2.2em; font-weight: 900;">Your Property Timeline</h1>
    <p style="color: rgba(255,255,255,0.9); margin: 10px 0 0 0; font-size: 1.1em;">Curated by ${data.agentName}</p>
  </div>
  
  <div style="padding: 40px 20px;">
    <h2 style="color: #1e293b;">Hi ${data.clientName}! 👋</h2>
    <p>I've created a personalized property timeline just for you. I've carefully selected <strong>${data.propertyCount} properties</strong> that match your criteria and preferences.</p>
    
    <div style="background: linear-gradient(135deg, ${brandColor} 0%, #8b5cf6 100%); padding: 35px; border-radius: 16px; text-align: center; margin: 35px 0; box-shadow: 0 10px 25px rgba(0,0,0,0.1);">
      <h3 style="color: white; margin: 0 0 25px 0; font-size: 1.4em;">View Your Properties</h3>
      <a href="${data.timelineUrl}" style="display: inline-block; background: white; color: ${brandColor}; padding: 18px 35px; border-radius: 12px; text-decoration: none; font-weight: bold; font-size: 1.1em; box-shadow: 0 4px 12px rgba(0,0,0,0.1);">Open Timeline →</a>
    </div>
    
    <div style="background: linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%); padding: 30px; border-radius: 12px; border-left: 6px solid #22c55e;">
      <h4 style="margin: 0 0 15px 0; color: #1e293b;">💡 How it works:</h4>
      <ul style="margin: 0; padding-left: 20px; color: #475569;">
        <li>Browse each property at your own pace</li>
        <li>Leave feedback using the ❤️ Love, 💬 Let's Talk, or ❌ Not for Me buttons</li>
        <li>Add your personal notes and questions</li>
        <li>I'll get instant notifications of your preferences</li>
      </ul>
    </div>
  </div>
  
  <div style="border-top: 2px solid #e2e8f0; padding: 30px 20px; background: #f8fafc; text-align: center; border-radius: 0 0 16px 16px;">
    <h4 style="margin: 0; color: #1e293b; font-size: 1.2em;">${data.agentName}</h4>
    <p style="margin: 5px 0; color: #64748b;">${data.agentCompany}</p>
    <div style="margin: 15px 0;">
      <span style="display: inline-block; background: ${brandColor}; color: white; padding: 6px 12px; border-radius: 20px; font-size: 0.9em;">Your Dedicated Agent</span>
    </div>
    <p style="margin: 15px 0; color: #94a3b8; font-size: 12px;">Powered by Property Sync - Mission Control for Real Estate</p>
  </div>
</body>
</html>`;
  }

  private getClassicalTimelineTemplate(
    data: TimelineEmailData,
    brandColor: string,
  ): string {
    return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>Your Property Timeline</title></head>
<body style="font-family: Georgia, 'Times New Roman', serif; line-height: 1.7; color: #2c3e50; max-width: 600px; margin: 0 auto; padding: 20px; background: #f9f9f9;">
  <div style="background: white; padding: 0; border-radius: 8px; box-shadow: 0 4px 12px rgba(0,0,0,0.1); overflow: hidden;">
    <div style="text-align: center; padding: 30px; background: #34495e; color: white;">
      ${data.agentPhoto ? `<img src="${data.agentPhoto}" alt="${data.agentName}" style="width: 70px; height: 70px; border-radius: 50%; border: 3px solid white; margin-bottom: 15px;">` : ''}
      <h1 style="margin: 0; font-size: 1.8em; font-weight: normal;">Property Selection</h1>
      <p style="margin: 8px 0 0 0; opacity: 0.9;">Presented by ${data.agentName}</p>
    </div>
    
    <div style="padding: 35px;">
      <p style="font-size: 1.1em; margin-bottom: 0;">Dear ${data.clientName},</p>
      
      <p>I am pleased to present you with a carefully curated selection of <strong>${data.propertyCount} properties</strong> that align with your requirements and preferences.</p>
      
      <div style="background: #ecf0f1; padding: 25px; border-radius: 6px; margin: 25px 0; border-left: 4px solid ${brandColor};">
        <h3 style="margin: 0 0 15px 0; color: #2c3e50; font-size: 1.2em;">Review Your Properties</h3>
        <p style="margin: 0 0 20px 0; color: #7f8c8d;">Each property has been selected based on your specific criteria. Please take your time to review each option.</p>
        <div style="text-align: center; margin: 20px 0;">
          <a href="${data.timelineUrl}" style="display: inline-block; background: ${brandColor}; color: white; padding: 12px 30px; border-radius: 4px; text-decoration: none; font-weight: normal;">View Properties</a>
        </div>
      </div>
      
      <div style="background: #fff; padding: 20px; border: 1px solid #bdc3c7; border-radius: 4px; margin: 20px 0;">
        <h4 style="margin: 0 0 12px 0; color: #2c3e50; font-size: 1em;">Instructions for Review:</h4>
        <ul style="margin: 0; padding-left: 25px; color: #7f8c8d;">
          <li>Browse each property thoroughly</li>
          <li>Provide feedback using the available options</li>
          <li>Include any questions or comments</li>
        </ul>
      </div>
      
      <p>I look forward to your thoughts and am available to discuss any questions you may have.</p>
      
      <p style="margin-top: 30px;">Respectfully yours,</p>
      <p style="margin: 5px 0; font-weight: bold;">${data.agentName}</p>
      <p style="margin: 0; color: #7f8c8d; font-style: italic;">${data.agentCompany}</p>
    </div>
    
    <div style="background: #ecf0f1; padding: 20px; text-align: center; border-top: 1px solid #bdc3c7;">
      <p style="margin: 0; color: #95a5a6; font-size: 11px;">Professional real estate services powered by Property Sync</p>
    </div>
  </div>
</body>
</html>`;
  }

  // Existing template methods remain the same
  private getVerificationEmailTemplate(
    firstName: string,
    verificationUrl: string,
  ): string {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Verify Your Email - Property Sync</title>
      </head>
      <body style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="text-align: center; padding: 40px 0; background: linear-gradient(135deg, #0ea5e9, #3b82f6); border-radius: 10px; margin-bottom: 30px;">
          <h1 style="color: white; margin: 0; font-size: 2.5em; font-weight: 900;">Property Sync</h1>
          <p style="color: #e0f2fe; margin: 10px 0 0 0; font-size: 1.1em;">Mission Control for Real Estate</p>
        </div>
        
        <div style="padding: 30px; background: #f8fafc; border-radius: 10px; border-left: 5px solid #0ea5e9;">
          <h2 style="color: #0ea5e9; margin-top: 0;">Welcome aboard, ${firstName}!</h2>
          <p style="font-size: 1.1em; margin: 20px 0;">You're just one click away from accessing your Mission Control dashboard for real estate client management.</p>
          
          <div style="text-align: center; margin: 30px 0;">
            <a href="${verificationUrl}" style="background: #0ea5e9; color: white; padding: 15px 30px; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 1.1em; display: inline-block; box-shadow: 0 4px 6px rgba(14, 165, 233, 0.3);">
              Verify Email Address
            </a>
          </div>
          
          <div style="background: white; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <h3 style="color: #334155; margin-top: 0;">What's Next?</h3>
            <ul style="color: #64748b; padding-left: 20px;">
              <li>Set up your agent profile and branding</li>
              <li>Create your first client timeline</li>
              <li>Add properties and share with clients</li>
              <li>Watch the feedback roll in!</li>
            </ul>
          </div>
          
          <p style="color: #64748b; font-size: 0.9em; margin-top: 30px;">
            This verification link expires in 24 hours. If you didn't create this account, you can safely ignore this email.
          </p>
        </div>
        
        <div style="text-align: center; margin-top: 30px; padding: 20px; color: #94a3b8; font-size: 0.9em;">
          <p>Need help? Contact us at support@propertysync.com</p>
          <p style="margin: 5px 0;">Property Sync - Making Real Estate Simple</p>
        </div>
      </body>
      </html>
    `;
  }

  private getWelcomeEmailTemplate(
    firstName: string,
    dashboardUrl: string,
  ): string {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Welcome to Property Sync!</title>
      </head>
      <body style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="text-align: center; padding: 40px 0; background: linear-gradient(135deg, #10b981, #059669); border-radius: 10px; margin-bottom: 30px;">
          <h1 style="color: white; margin: 0; font-size: 2.5em;">🎉</h1>
          <h2 style="color: white; margin: 10px 0; font-size: 1.8em;">You're All Set!</h2>
        </div>
        
        <div style="padding: 30px; background: #f0fdf4; border-radius: 10px; border-left: 5px solid #10b981;">
          <h2 style="color: #059669; margin-top: 0;">Welcome to Property Sync, ${firstName}!</h2>
          <p style="font-size: 1.1em;">Your email has been verified and your account is ready to go. Time to revolutionize how you manage your real estate clients!</p>
          
          <div style="text-align: center; margin: 30px 0;">
            <a href="${dashboardUrl}" style="background: #10b981; color: white; padding: 15px 30px; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 1.1em; display: inline-block; box-shadow: 0 4px 6px rgba(16, 185, 129, 0.3);">
              Launch Mission Control
            </a>
          </div>
          
          <div style="background: white; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <h3 style="color: #334155; margin-top: 0;">Quick Start Guide:</h3>
            <ol style="color: #64748b; padding-left: 20px;">
              <li><strong>Customize your profile</strong> - Add your branding and company info</li>
              <li><strong>Create your first client</strong> - We'll automatically generate their timeline</li>
              <li><strong>Add properties</strong> - Upload property details and images</li>
              <li><strong>Share the timeline</strong> - Send the simple login link to your client</li>
              <li><strong>Get feedback</strong> - Watch as clients love, like, or pass on properties</li>
            </ol>
          </div>
        </div>
        
        <div style="text-align: center; margin-top: 30px; padding: 20px; color: #94a3b8; font-size: 0.9em;">
          <p>Questions? We're here to help at support@propertysync.com</p>
        </div>
      </body>
      </html>
    `;
  }
}
