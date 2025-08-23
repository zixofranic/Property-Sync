// Replace your existing resend.provider.ts with this fixed version

import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Resend } from 'resend';

export interface TimelineEmailData {
  to: string;
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
export class ResendProvider {
  private readonly logger = new Logger(ResendProvider.name);
  private resend: Resend | null;
  private fromEmail: string;
  private isDevelopment: boolean;

  constructor(private configService: ConfigService) {
    const apiKey = this.configService.get<string>('RESEND_API_KEY');
    this.isDevelopment = process.env.NODE_ENV === 'development';

    if (!apiKey) {
      this.logger.warn('RESEND_API_KEY not found - email functionality disabled');
      this.resend = null;
      this.fromEmail = '';
      return;
    }

    this.resend = new Resend(apiKey);
    this.fromEmail = 'Property Sync <onboarding@resend.dev>';

    if (this.isDevelopment) {
      this.logger.warn(
        'DEVELOPMENT MODE: Emails will be redirected to Resend test addresses',
      );
      this.logger.log(
        'Test addresses will simulate real delivery without domain verification',
      );
    }
  }

  // FIXED: Redirect to test addresses in development
  private redirectEmailForDevelopment(
    originalEmail: string,
    emailType: string = 'delivered',
  ): string {
    if (!this.isDevelopment) {
      return originalEmail;
    }

    // Create a labeled test address for tracking
    const emailPrefix = originalEmail
      .split('@')[0]
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '');
    const testAddress = `${emailType}+${emailPrefix}@resend.dev`;

    this.logger.warn(
      `DEV MODE: Redirecting ${originalEmail} -> ${testAddress}`,
    );
    return testAddress;
  }

  async sendTimelineEmail(data: TimelineEmailData) {
    if (!this.resend) {
      this.logger.warn('Email service not configured - skipping timeline email');
      return { success: false, error: 'Email service not configured' };
    }
    // Redirect emails in development mode
    const redirectedTo = this.redirectEmailForDevelopment(data.to, 'delivered');
    const redirectedSpouseEmail = data.spouseEmail
      ? this.redirectEmailForDevelopment(data.spouseEmail, 'delivered')
      : undefined;

    this.logger.log(`Sending timeline email via Resend to ${redirectedTo}`);

    const htmlContent = this.generateTimelineEmailHtml({
      ...data,
      to: redirectedTo,
      spouseEmail: redirectedSpouseEmail,
      // Add development indicator to content
      clientName: this.isDevelopment
        ? `${data.clientName} [DEV TEST]`
        : data.clientName,
    });

    const textContent = this.generateTimelineEmailText({
      ...data,
      to: redirectedTo,
      spouseEmail: redirectedSpouseEmail,
      clientName: this.isDevelopment
        ? `${data.clientName} [DEV TEST]`
        : data.clientName,
    });

    try {
      if (!this.resend) {
        throw new Error('Resend service not configured');
      }
      const result = await this.resend.emails.send({
        from: this.fromEmail,
        to: redirectedTo,
        subject: `${this.isDevelopment ? '[DEV TEST] ' : ''}Your Property Timeline from ${data.agentName}`,
        html: htmlContent,
        text: textContent,
        headers: {
          'X-Entity-Ref-ID': `timeline-${Date.now()}`,
          ...(this.isDevelopment && { 'X-Original-Recipient': data.to }),
        },
      });

      if (result.error) {
        this.logger.error('Resend API returned error:', result.error);
        throw new Error(`Resend API error: ${JSON.stringify(result.error)}`);
      }

      if (result.data?.id) {
        this.logger.log(
          `Timeline email sent successfully via Resend: ${result.data.id}`,
        );

        if (this.isDevelopment) {
          this.logger.log(`Original recipient: ${data.to}`);
          this.logger.log(
            'Check Resend dashboard at https://resend.com/emails for delivery status',
          );
        }

        // Send to spouse if provided
        if (redirectedSpouseEmail) {
          if (!this.resend) {
            throw new Error('Resend service not configured');
          }
          const spouseResult = await this.resend.emails.send({
            from: this.fromEmail,
            to: redirectedSpouseEmail,
            subject: `${this.isDevelopment ? '[DEV TEST] ' : ''}Property Timeline for ${data.clientName} from ${data.agentName}`,
            html: htmlContent.replace(
              new RegExp(data.clientName, 'g'),
              `${data.clientName} and you`,
            ),
            text: textContent.replace(
              new RegExp(data.clientName, 'g'),
              `${data.clientName} and you`,
            ),
            headers: {
              'X-Entity-Ref-ID': `timeline-spouse-${Date.now()}`,
              ...(this.isDevelopment && {
                'X-Original-Recipient': data.spouseEmail,
              }),
            },
          });

          if (spouseResult.data?.id) {
            this.logger.log(
              `Spouse timeline email sent successfully via Resend: ${spouseResult.data.id}`,
            );
          }
        }
      } else {
        throw new Error('Resend returned no message ID');
      }

      return result;
    } catch (error) {
      this.logger.error('Resend timeline email failed:', error.message);
      throw error;
    }
  }

  async sendPropertyNotification(data: PropertyNotificationData) {
    // Redirect emails in development mode
    const redirectedEmail = this.redirectEmailForDevelopment(
      data.clientEmail,
      'delivered',
    );
    const redirectedSpouseEmail = data.spouseEmail
      ? this.redirectEmailForDevelopment(data.spouseEmail, 'delivered')
      : undefined;

    this.logger.log(
      `Sending property notification via Resend to ${redirectedEmail}`,
    );

    const modifiedData = {
      ...data,
      clientEmail: redirectedEmail,
      spouseEmail: redirectedSpouseEmail,
      clientName: this.isDevelopment
        ? `${data.clientName} [DEV TEST]`
        : data.clientName,
    };

    const htmlContent = this.generatePropertyNotificationHtml(modifiedData);
    const textContent = `New Property Added!\n\n${data.agentName} has added a new property to your timeline:\n\n${data.propertyAddress}\nPrice: $${data.propertyPrice.toLocaleString()}\n\n${data.propertyDescription}\n\nView your timeline: ${data.timelineUrl}`;

    try {
      if (!this.resend) {
        throw new Error('Resend service not configured');
      }
      const result = await this.resend.emails.send({
        from: this.fromEmail,
        to: redirectedEmail,
        subject: `${this.isDevelopment ? '[DEV TEST] ' : ''}New Property Added: ${data.propertyAddress}`,
        html: htmlContent,
        text: textContent,
        headers: {
          'X-Entity-Ref-ID': `property-notification-${Date.now()}`,
          ...(this.isDevelopment && {
            'X-Original-Recipient': data.clientEmail,
          }),
        },
      });

      this.logger.log(
        `Property notification sent successfully via Resend: ${result.data?.id}`,
      );

      // Send to spouse if provided
      if (redirectedSpouseEmail && this.resend) {
        await this.resend.emails.send({
          from: this.fromEmail,
          to: redirectedSpouseEmail,
          subject: `${this.isDevelopment ? '[DEV TEST] ' : ''}New Property Added: ${data.propertyAddress}`,
          html: htmlContent,
          text: textContent,
          headers: {
            'X-Entity-Ref-ID': `property-notification-spouse-${Date.now()}`,
            ...(this.isDevelopment && {
              'X-Original-Recipient': data.spouseEmail,
            }),
          },
        });
        this.logger.log(
          `Spouse property notification sent successfully via Resend`,
        );
      }

      return result;
    } catch (error) {
      this.logger.error('Resend property notification failed:', {
        error: error.message,
        to: redirectedEmail,
        from: this.fromEmail,
        statusCode: error.statusCode,
      });
      throw error;
    }
  }

  async sendFeedbackReminder(data: FeedbackReminderData) {
    const redirectedEmail = this.redirectEmailForDevelopment(
      data.clientEmail,
      'delivered',
    );

    this.logger.log(
      `Sending feedback reminder via Resend to ${redirectedEmail}`,
    );

    const modifiedData = {
      ...data,
      clientEmail: redirectedEmail,
      clientName: this.isDevelopment
        ? `${data.clientName} [DEV TEST]`
        : data.clientName,
    };

    const htmlContent = this.generateFeedbackReminderHtml(modifiedData);
    const textContent = `Hi ${data.clientName}!\n\nYou have ${data.pendingPropertiesCount} properties waiting for your feedback from ${data.agentName}.\n\nIt's been ${data.daysSinceLastActivity} days since your last activity. Your input helps us find you the perfect home!\n\nView your timeline: ${data.timelineUrl}`;

    try {
      if (!this.resend) {
        throw new Error('Resend service not configured');
      }
      const result = await this.resend.emails.send({
        from: this.fromEmail,
        to: redirectedEmail,
        subject: `${this.isDevelopment ? '[DEV TEST] ' : ''}Feedback Requested: ${data.pendingPropertiesCount} Properties Await Your Response`,
        html: htmlContent,
        text: textContent,
        headers: {
          'X-Entity-Ref-ID': `feedback-reminder-${Date.now()}`,
          ...(this.isDevelopment && {
            'X-Original-Recipient': data.clientEmail,
          }),
        },
      });

      this.logger.log(
        `Feedback reminder sent successfully via Resend: ${result.data?.id}`,
      );
      return result;
    } catch (error) {
      this.logger.error('Resend feedback reminder failed:', {
        error: error.message,
        to: redirectedEmail,
        from: this.fromEmail,
        statusCode: error.statusCode,
      });
      throw error;
    }
  }

  async sendVerificationEmail(
    email: string,
    firstName: string,
    verificationToken: string,
  ) {
    if (!this.resend) {
      this.logger.warn('Email service not configured - skipping verification email');
      return { success: false, error: 'Email service not configured' };
    }
    const redirectedEmail = this.redirectEmailForDevelopment(
      email,
      'delivered',
    );

    this.logger.log(
      `Sending verification email via Resend to ${redirectedEmail}`,
    );

    const verificationUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/verify-email?token=${verificationToken}`;
    const htmlContent = this.getVerificationEmailTemplate(
      firstName,
      verificationUrl,
    );
    const textContent = `Hi ${firstName},\n\nWelcome to Property Sync! Please verify your email address by clicking the link below:\n${verificationUrl}\n\nThis link will expire in 24 hours.\n\nBest regards,\nThe Property Sync Team`;

    try {
      if (!this.resend) {
        throw new Error('Resend service not configured');
      }
      const result = await this.resend.emails.send({
        from: this.fromEmail,
        to: redirectedEmail,
        subject: `${this.isDevelopment ? '[DEV TEST] ' : ''}Welcome to Property Sync - Verify Your Email`,
        html: htmlContent,
        text: textContent,
        headers: {
          'X-Entity-Ref-ID': `verification-${Date.now()}`,
          ...(this.isDevelopment && { 'X-Original-Recipient': email }),
        },
      });

      this.logger.log(
        `Verification email sent successfully via Resend: ${result.data?.id}`,
      );
      return result;
    } catch (error) {
      this.logger.error('Resend verification email failed:', {
        error: error.message,
        to: redirectedEmail,
        from: this.fromEmail,
        statusCode: error.statusCode,
      });
      throw error;
    }
  }

  async sendWelcomeEmail(email: string, firstName: string) {
    if (!this.resend) {
      this.logger.warn('Email service not configured - skipping welcome email');
      return { success: false, error: 'Email service not configured' };
    }
    const redirectedEmail = this.redirectEmailForDevelopment(
      email,
      'delivered',
    );

    this.logger.log(`Sending welcome email via Resend to ${redirectedEmail}`);

    const dashboardUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/dashboard`;
    const htmlContent = this.getWelcomeEmailTemplate(firstName, dashboardUrl);
    const textContent = `Hi ${firstName},\n\nYour Property Sync account is now verified and ready to use!\n\nGet started: ${dashboardUrl}\n\nBest regards,\nThe Property Sync Team`;

    try {
      if (!this.resend) {
        throw new Error('Resend service not configured');
      }
      const result = await this.resend.emails.send({
        from: this.fromEmail,
        to: redirectedEmail,
        subject: `${this.isDevelopment ? '[DEV TEST] ' : ''}Welcome to Property Sync - Your Account is Ready!`,
        html: htmlContent,
        text: textContent,
        headers: {
          'X-Entity-Ref-ID': `welcome-${Date.now()}`,
          ...(this.isDevelopment && { 'X-Original-Recipient': email }),
        },
      });

      this.logger.log(
        `Welcome email sent successfully via Resend: ${result.data?.id}`,
      );
      return result;
    } catch (error) {
      this.logger.error('Resend welcome email failed:', {
        error: error.message,
        to: redirectedEmail,
        from: this.fromEmail,
        statusCode: error.statusCode,
      });
      throw error;
    }
  }

  // Keep all your existing template methods exactly as they are
  private generateTimelineEmailHtml(data: TimelineEmailData): string {
    const templateStyle = data.templateStyle || 'modern';
    const brandColor = data.brandColor || '#3b82f6';

    if (templateStyle === 'classical') {
      return this.getClassicalTimelineTemplate(data, brandColor);
    } else {
      return this.getModernTimelineTemplate(data, brandColor);
    }
  }

  private generateTimelineEmailText(data: TimelineEmailData): string {
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

  // ... keep all your existing template methods unchanged ...
  // (generatePropertyNotificationHtml, generateFeedbackReminderHtml, getModernTimelineTemplate, etc.)

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
    <h2 style="color: #1e293b;">Hi ${data.clientName}!</h2>
    <p>I've added a new property to your timeline that I think you'll love:</p>
    
    <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 20px; margin: 20px 0;">
      <img src="${data.propertyImageUrl}" alt="${data.propertyAddress}" style="width: 100%; height: 200px; object-fit: cover; border-radius: 8px; margin-bottom: 15px;">
      <h3 style="margin: 0 0 10px 0; color: #1e293b;">${data.propertyAddress}</h3>
      <p style="font-size: 24px; font-weight: bold; color: #059669; margin: 0 0 10px 0;">$${data.propertyPrice.toLocaleString()}</p>
      <p style="color: #64748b; margin: 0;">${data.propertyDescription}</p>
    </div>
    
    <div style="background: linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%); padding: 30px; border-radius: 12px; text-align: center; margin: 30px 0;">
      <h3 style="color: white; margin: 0 0 20px 0;">View Your Timeline</h3>
      <a href="${data.timelineUrl}" style="display: inline-block; background: white; color: #3b82f6; padding: 15px 30px; border-radius: 8px; text-decoration: none; font-weight: bold;">See All Properties</a>
    </div>
  </div>
  
  <div style="border-top: 2px solid #e2e8f0; padding: 20px; background: #f8fafc; text-align: center;">
    <p style="margin: 0; color: #64748b; font-size: 12px;">Powered by Property Sync</p>
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
    <h2 style="color: #1e293b;">Hi ${data.clientName}!</h2>
    <p>You have <strong>${data.pendingPropertiesCount} properties</strong> waiting for your feedback.</p>
    <p>It's been ${data.daysSinceLastActivity} days since your last activity. Your input helps me find you the perfect home!</p>
    
    <div style="background: linear-gradient(135deg, #f59e0b 0%, #f97316 100%); padding: 30px; border-radius: 12px; text-align: center; margin: 30px 0;">
      <h3 style="color: white; margin: 0 0 20px 0;">Share Your Thoughts</h3>
      <a href="${data.timelineUrl}" style="display: inline-block; background: white; color: #f59e0b; padding: 15px 30px; border-radius: 8px; text-decoration: none; font-weight: bold;">Review Properties</a>
    </div>
    
    <div style="background: #fef3c7; padding: 20px; border-radius: 8px; border-left: 4px solid #f59e0b;">
      <p style="margin: 0; color: #92400e;"><strong>Quick Reminder:</strong> Use the Love, Let's Talk, or Not for Me buttons to let me know your thoughts on each property.</p>
    </div>
  </div>
  
  <div style="border-top: 2px solid #e2e8f0; padding: 20px; background: #f8fafc; text-align: center;">
    <p style="margin: 0; color: #64748b; font-size: 12px;">Powered by Property Sync</p>
  </div>
</body>
</html>`;
  }


  private getVerificationEmailTemplate(
    firstName: string,
    verificationUrl: string,
  ): string {
    // Your existing implementation
    return `<!-- Your existing verification template HTML -->`;
  }

  async sendBatchImportNotification(data: BatchImportNotificationData) {
    const redirectedEmail = this.redirectEmailForDevelopment(
      data.clientEmail,
      'delivered',
    );
    const redirectedSpouseEmail = data.spouseEmail
      ? this.redirectEmailForDevelopment(data.spouseEmail, 'delivered')
      : undefined;

    this.logger.log(
      `Sending batch import notification via Resend to ${redirectedEmail}`,
    );

    const modifiedData = {
      ...data,
      clientEmail: redirectedEmail,
      spouseEmail: redirectedSpouseEmail,
      clientName: this.isDevelopment
        ? `${data.clientName} [DEV TEST]`
        : data.clientName,
    };

    const htmlContent = this.generateBatchImportNotificationHtml(modifiedData);
    const textContent = `New Properties Added!\n\n${data.agentName} has added ${data.propertyCount} new properties to your timeline:\n\n${data.propertyAddresses.join('\n')}\n\nView your timeline: ${data.timelineUrl}`;

    try {
      if (!this.resend) {
        throw new Error('Resend service not configured');
      }
      const result = await this.resend.emails.send({
        from: this.fromEmail,
        to: redirectedEmail,
        subject: `${this.isDevelopment ? '[DEV TEST] ' : ''}${data.propertyCount} New Properties Added to Your Timeline`,
        html: htmlContent,
        text: textContent,
        headers: {
          'X-Entity-Ref-ID': `batch-import-${Date.now()}`,
          ...(this.isDevelopment && {
            'X-Original-Recipient': data.clientEmail,
          }),
        },
      });

      this.logger.log(
        `Batch import notification sent successfully via Resend: ${result.data?.id}`,
      );

      // Send to spouse if provided
      if (redirectedSpouseEmail && this.resend) {
        await this.resend.emails.send({
          from: this.fromEmail,
          to: redirectedSpouseEmail,
          subject: `${this.isDevelopment ? '[DEV TEST] ' : ''}${data.propertyCount} New Properties Added to Your Timeline`,
          html: htmlContent,
          text: textContent,
          headers: {
            'X-Entity-Ref-ID': `batch-import-spouse-${Date.now()}`,
            ...(this.isDevelopment && {
              'X-Original-Recipient': data.spouseEmail,
            }),
          },
        });
        this.logger.log(
          `Spouse batch import notification sent successfully via Resend`,
        );
      }

      return result;
    } catch (error) {
      this.logger.error('Resend batch import notification failed:', {
        error: error.message,
        to: redirectedEmail,
        from: this.fromEmail,
        statusCode: error.statusCode,
      });
      throw error;
    }
  }

  private generateBatchImportNotificationHtml(
    data: BatchImportNotificationData,
  ): string {
    const propertyList = data.propertyAddresses
      .map(
        (address) =>
          `<li style="padding: 8px 0; border-bottom: 1px solid #e2e8f0;">${address}</li>`,
      )
      .join('');

    return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>New Properties Added</title></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="text-align: center; padding: 30px 0; border-bottom: 3px solid #10b981;">
    <h1 style="color: #1e293b; margin: 0;">${data.propertyCount} New Properties Added!</h1>
    <p style="color: #64748b; margin: 10px 0 0 0;">From ${data.agentName}</p>
  </div>
  
  <div style="padding: 40px 20px;">
    <h2 style="color: #1e293b;">Hi ${data.clientName}!</h2>
    <p>I've added <strong>${data.propertyCount} new properties</strong> to your timeline that I think you'll love:</p>
    
    <div style="background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 12px; padding: 20px; margin: 20px 0;">
      <h3 style="margin: 0 0 15px 0; color: #166534;">New Properties:</h3>
      <ul style="margin: 0; padding: 0; list-style: none;">
        ${propertyList}
      </ul>
    </div>
    
    <div style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); padding: 30px; border-radius: 12px; text-align: center; margin: 30px 0;">
      <h3 style="color: white; margin: 0 0 20px 0;">Review Your New Properties</h3>
      <a href="${data.timelineUrl}" style="display: inline-block; background: white; color: #10b981; padding: 15px 30px; border-radius: 8px; text-decoration: none; font-weight: bold;">View Timeline</a>
    </div>
    
    <div style="background: #ecfdf5; padding: 20px; border-radius: 8px; border-left: 4px solid #10b981;">
      <p style="margin: 0; color: #166534;"><strong>What's Next:</strong> Browse each property, leave feedback using the Love, Let's Talk, or Not for Me buttons, and add your personal notes.</p>
    </div>
  </div>
  
  <div style="border-top: 2px solid #e2e8f0; padding: 20px; background: #f8fafc; text-align: center;">
    <p style="margin: 0; color: #64748b; font-size: 12px;">Powered by Property Sync</p>
  </div>
</body>
</html>`;
  }

  private getWelcomeEmailTemplate(
    firstName: string,
    dashboardUrl: string,
  ): string {
    // Your existing implementation
    return `<!-- Your existing welcome template HTML -->`;
  }

  private getModernTimelineTemplate(data: TimelineEmailData, brandColor: string): string {
    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Your Property Timeline</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
  </style>
</head>
<body style="font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #334155; max-width: 600px; margin: 0 auto; padding: 0; background: #f8fafc;">
  <div style="background: linear-gradient(135deg, ${brandColor} 0%, #8b5cf6 100%); padding: 40px 20px; text-align: center; border-radius: 16px 16px 0 0;">
    ${data.agentPhoto ? `<img src="${data.agentPhoto}" alt="${data.agentName}" style="width: 80px; height: 80px; border-radius: 50%; border: 4px solid white; margin-bottom: 20px; object-fit: cover;">` : ''}
    <h1 style="color: white; margin: 0 0 10px 0; font-size: 28px; font-weight: 700; text-shadow: 0 2px 4px rgba(0,0,0,0.1);">Your Property Timeline</h1>
    <p style="color: rgba(255,255,255,0.9); margin: 0; font-size: 16px; font-weight: 500;">From ${data.agentName} at ${data.agentCompany}</p>
  </div>
  
  <div style="background: white; padding: 40px 30px; box-shadow: 0 10px 25px rgba(0,0,0,0.05);">
    <h2 style="color: #1e293b; font-size: 22px; font-weight: 600; margin: 0 0 20px 0;">Hi ${data.clientName}! 👋</h2>
    <p style="font-size: 16px; line-height: 1.7; margin: 0 0 25px 0;">I've carefully curated <strong style="color: ${brandColor};">${data.propertyCount} properties</strong> that match your criteria and preferences. Each property has been selected specifically with you in mind.</p>
    
    <div style="background: linear-gradient(135deg, ${brandColor}15 0%, #8b5cf615 100%); padding: 30px; border-radius: 16px; text-align: center; margin: 30px 0; border: 1px solid ${brandColor}20;">
      <h3 style="color: #1e293b; margin: 0 0 20px 0; font-size: 20px; font-weight: 600;">Ready to explore?</h3>
      <a href="${data.timelineUrl}" style="display: inline-block; background: linear-gradient(135deg, ${brandColor} 0%, #8b5cf6 100%); color: white; padding: 16px 32px; border-radius: 12px; text-decoration: none; font-weight: 600; font-size: 16px; box-shadow: 0 4px 15px ${brandColor}40; transition: all 0.3s ease;">View Your Timeline →</a>
    </div>
    
    <div style="background: #f1f5f9; padding: 25px; border-radius: 12px; border-left: 4px solid ${brandColor};">
      <h4 style="margin: 0 0 15px 0; color: #1e293b; font-weight: 600;">How it works:</h4>
      <ul style="margin: 0; padding-left: 20px; color: #475569;">
        <li style="margin-bottom: 8px;">Browse each property at your own pace</li>
        <li style="margin-bottom: 8px;">Use the <strong>Love It! ❤️</strong>, <strong>Let's Talk 💬</strong>, or <strong>Not for Me ❌</strong> buttons</li>
        <li>Add your personal notes and thoughts</li>
      </ul>
    </div>
  </div>
  
  <div style="background: #1e293b; padding: 30px 20px; text-align: center; border-radius: 0 0 16px 16px; color: white;">
    <p style="margin: 0 0 15px 0; font-size: 16px; font-weight: 500;">Best regards,</p>
    <p style="margin: 0 0 5px 0; font-size: 18px; font-weight: 600;">${data.agentName}</p>
    <p style="margin: 0 0 20px 0; color: #94a3b8; font-size: 14px;">${data.agentCompany}</p>
    <p style="margin: 0; color: #64748b; font-size: 12px;">Powered by Property Sync</p>
  </div>
</body>
</html>`;
  }

  private getClassicalTimelineTemplate(data: TimelineEmailData, brandColor: string): string {
    const classicalColor = '#34495e';
    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Your Property Timeline</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Georgia:wght@400;700&display=swap');
  </style>
</head>
<body style="font-family: Georgia, 'Times New Roman', serif; line-height: 1.8; color: #2c3e50; max-width: 600px; margin: 0 auto; padding: 0; background: #fafafa;">
  <div style="background: ${classicalColor}; padding: 40px 30px; text-align: center; border-bottom: 3px double #bdc3c7;">
    ${data.agentPhoto ? `<img src="${data.agentPhoto}" alt="${data.agentName}" style="width: 90px; height: 90px; border-radius: 50%; border: 3px solid #ecf0f1; margin-bottom: 25px; object-fit: cover;">` : ''}
    <h1 style="color: #ecf0f1; margin: 0 0 15px 0; font-size: 32px; font-weight: 700; letter-spacing: 1px;">Property Timeline</h1>
    <p style="color: #bdc3c7; margin: 0; font-size: 16px; font-style: italic;">Presented by ${data.agentName}</p>
    <p style="color: #95a5a6; margin: 5px 0 0 0; font-size: 14px;">${data.agentCompany}</p>
  </div>
  
  <div style="background: #ffffff; padding: 50px 40px; border-left: 5px solid ${classicalColor}; border-right: 5px solid ${classicalColor};">
    <div style="text-align: center; margin-bottom: 30px;">
      <h2 style="color: #2c3e50; font-size: 24px; font-weight: 700; margin: 0 0 10px 0; letter-spacing: 0.5px;">Dear ${data.clientName},</h2>
      <div style="width: 60px; height: 2px; background: ${classicalColor}; margin: 0 auto;"></div>
    </div>
    
    <p style="font-size: 17px; line-height: 1.9; margin: 0 0 30px 0; text-align: justify; text-indent: 30px;">It is my distinct pleasure to present to you a carefully curated selection of <strong>${data.propertyCount} exceptional properties</strong> that have been thoughtfully chosen to align with your specific requirements and preferences.</p>
    
    <div style="background: #ecf0f1; padding: 35px; border: 2px solid #bdc3c7; text-align: center; margin: 40px 0;">
      <h3 style="color: #2c3e50; margin: 0 0 25px 0; font-size: 20px; font-weight: 700; letter-spacing: 0.5px;">Your Property Portfolio</h3>
      <a href="${data.timelineUrl}" style="display: inline-block; background: ${classicalColor}; color: #ecf0f1; padding: 15px 40px; border: 2px solid ${classicalColor}; text-decoration: none; font-weight: 700; font-size: 16px; letter-spacing: 1px; transition: all 0.3s ease;">VIEW TIMELINE</a>
    </div>
    
    <div style="background: #f8f9fa; padding: 30px; border: 1px solid #dee2e6; margin: 30px 0;">
      <h4 style="margin: 0 0 20px 0; color: #2c3e50; font-weight: 700; font-size: 18px; text-align: center;">Instructions for Review</h4>
      <ol style="margin: 0; padding-left: 25px; color: #34495e; font-size: 16px;">
        <li style="margin-bottom: 12px;">Examine each property with careful consideration</li>
        <li style="margin-bottom: 12px;">Provide feedback using the designated response options</li>
        <li>Record any observations or inquiries for future discussion</li>
      </ol>
    </div>
    
    <div style="text-align: center; margin-top: 40px; padding-top: 30px; border-top: 1px solid #bdc3c7;">
      <p style="font-size: 18px; font-style: italic; margin: 0 0 20px 0; color: #2c3e50;">With professional regards,</p>
      <p style="margin: 0 0 8px 0; font-size: 22px; font-weight: 700; color: #2c3e50;">${data.agentName}</p>
      <p style="margin: 0; color: #7f8c8d; font-size: 16px; font-style: italic;">${data.agentCompany}</p>
    </div>
  </div>
  
  <div style="background: #2c3e50; padding: 25px 20px; text-align: center; color: #bdc3c7; font-size: 12px; border-top: 3px double #34495e;">
    <p style="margin: 0;">This correspondence was generated by Property Sync</p>
  </div>
</body>
</html>`;
  }
}
