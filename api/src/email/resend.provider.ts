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

@Injectable()
export class ResendProvider {
  private readonly logger = new Logger(ResendProvider.name);
  private resend: Resend;
  private fromEmail: string;
  private isDevelopment: boolean;

  constructor(private configService: ConfigService) {
    const apiKey = this.configService.get<string>('RESEND_API_KEY');
    this.isDevelopment = process.env.NODE_ENV === 'development';
    
    if (!apiKey) {
      this.logger.error('RESEND_API_KEY not found in environment variables');
      throw new Error('RESEND_API_KEY is required');
    }

    this.resend = new Resend(apiKey);
    this.fromEmail = 'Property Sync <onboarding@resend.dev>';
    
    if (this.isDevelopment) {
      this.logger.warn('DEVELOPMENT MODE: Emails will be redirected to Resend test addresses');
      this.logger.log('Test addresses will simulate real delivery without domain verification');
    }
  }

  // FIXED: Redirect to test addresses in development
  private redirectEmailForDevelopment(originalEmail: string, emailType: string = 'delivered'): string {
    if (!this.isDevelopment) {
      return originalEmail;
    }

    // Create a labeled test address for tracking
    const emailPrefix = originalEmail.split('@')[0].toLowerCase().replace(/[^a-z0-9]/g, '');
    const testAddress = `${emailType}+${emailPrefix}@resend.dev`;
    
    this.logger.warn(`DEV MODE: Redirecting ${originalEmail} -> ${testAddress}`);
    return testAddress;
  }

  async sendTimelineEmail(data: TimelineEmailData) {
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
      clientName: this.isDevelopment ? `${data.clientName} [DEV TEST]` : data.clientName
    });
    
    const textContent = this.generateTimelineEmailText({
      ...data,
      to: redirectedTo,
      spouseEmail: redirectedSpouseEmail,
      clientName: this.isDevelopment ? `${data.clientName} [DEV TEST]` : data.clientName
    });

    try {
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
        this.logger.log(`Timeline email sent successfully via Resend: ${result.data.id}`);
        
        if (this.isDevelopment) {
          this.logger.log(`Original recipient: ${data.to}`);
          this.logger.log('Check Resend dashboard at https://resend.com/emails for delivery status');
        }
        
        // Send to spouse if provided
        if (redirectedSpouseEmail) {
          const spouseResult = await this.resend.emails.send({
            from: this.fromEmail,
            to: redirectedSpouseEmail,
            subject: `${this.isDevelopment ? '[DEV TEST] ' : ''}Property Timeline for ${data.clientName} from ${data.agentName}`,
            html: htmlContent.replace(new RegExp(data.clientName, 'g'), `${data.clientName} and you`),
            text: textContent.replace(new RegExp(data.clientName, 'g'), `${data.clientName} and you`),
            headers: {
              'X-Entity-Ref-ID': `timeline-spouse-${Date.now()}`,
              ...(this.isDevelopment && { 'X-Original-Recipient': data.spouseEmail }),
            },
          });
          
          if (spouseResult.data?.id) {
            this.logger.log(`Spouse timeline email sent successfully via Resend: ${spouseResult.data.id}`);
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
    const redirectedEmail = this.redirectEmailForDevelopment(data.clientEmail, 'delivered');
    const redirectedSpouseEmail = data.spouseEmail 
      ? this.redirectEmailForDevelopment(data.spouseEmail, 'delivered') 
      : undefined;

    this.logger.log(`Sending property notification via Resend to ${redirectedEmail}`);

    const modifiedData = {
      ...data,
      clientEmail: redirectedEmail,
      spouseEmail: redirectedSpouseEmail,
      clientName: this.isDevelopment ? `${data.clientName} [DEV TEST]` : data.clientName
    };

    const htmlContent = this.generatePropertyNotificationHtml(modifiedData);
    const textContent = `New Property Added!\n\n${data.agentName} has added a new property to your timeline:\n\n${data.propertyAddress}\nPrice: $${data.propertyPrice.toLocaleString()}\n\n${data.propertyDescription}\n\nView your timeline: ${data.timelineUrl}`;

    try {
      const result = await this.resend.emails.send({
        from: this.fromEmail,
        to: redirectedEmail,
        subject: `${this.isDevelopment ? '[DEV TEST] ' : ''}New Property Added: ${data.propertyAddress}`,
        html: htmlContent,
        text: textContent,
        headers: {
          'X-Entity-Ref-ID': `property-notification-${Date.now()}`,
          ...(this.isDevelopment && { 'X-Original-Recipient': data.clientEmail }),
        },
      });

      this.logger.log(`Property notification sent successfully via Resend: ${result.data?.id}`);

      // Send to spouse if provided
      if (redirectedSpouseEmail) {
        await this.resend.emails.send({
          from: this.fromEmail,
          to: redirectedSpouseEmail,
          subject: `${this.isDevelopment ? '[DEV TEST] ' : ''}New Property Added: ${data.propertyAddress}`,
          html: htmlContent,
          text: textContent,
          headers: {
            'X-Entity-Ref-ID': `property-notification-spouse-${Date.now()}`,
            ...(this.isDevelopment && { 'X-Original-Recipient': data.spouseEmail }),
          },
        });
        this.logger.log(`Spouse property notification sent successfully via Resend`);
      }

      return result;
    } catch (error) {
      this.logger.error('Resend property notification failed:', {
        error: error.message,
        to: redirectedEmail,
        from: this.fromEmail,
        statusCode: error.statusCode
      });
      throw error;
    }
  }

  async sendFeedbackReminder(data: FeedbackReminderData) {
    const redirectedEmail = this.redirectEmailForDevelopment(data.clientEmail, 'delivered');
    
    this.logger.log(`Sending feedback reminder via Resend to ${redirectedEmail}`);

    const modifiedData = {
      ...data,
      clientEmail: redirectedEmail,
      clientName: this.isDevelopment ? `${data.clientName} [DEV TEST]` : data.clientName
    };

    const htmlContent = this.generateFeedbackReminderHtml(modifiedData);
    const textContent = `Hi ${data.clientName}!\n\nYou have ${data.pendingPropertiesCount} properties waiting for your feedback from ${data.agentName}.\n\nIt's been ${data.daysSinceLastActivity} days since your last activity. Your input helps us find you the perfect home!\n\nView your timeline: ${data.timelineUrl}`;

    try {
      const result = await this.resend.emails.send({
        from: this.fromEmail,
        to: redirectedEmail,
        subject: `${this.isDevelopment ? '[DEV TEST] ' : ''}Feedback Requested: ${data.pendingPropertiesCount} Properties Await Your Response`,
        html: htmlContent,
        text: textContent,
        headers: {
          'X-Entity-Ref-ID': `feedback-reminder-${Date.now()}`,
          ...(this.isDevelopment && { 'X-Original-Recipient': data.clientEmail }),
        },
      });

      this.logger.log(`Feedback reminder sent successfully via Resend: ${result.data?.id}`);
      return result;
    } catch (error) {
      this.logger.error('Resend feedback reminder failed:', {
        error: error.message,
        to: redirectedEmail,
        from: this.fromEmail,
        statusCode: error.statusCode
      });
      throw error;
    }
  }

  async sendVerificationEmail(email: string, firstName: string, verificationToken: string) {
    const redirectedEmail = this.redirectEmailForDevelopment(email, 'delivered');
    
    this.logger.log(`Sending verification email via Resend to ${redirectedEmail}`);

    const verificationUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/verify-email?token=${verificationToken}`;
    const htmlContent = this.getVerificationEmailTemplate(firstName, verificationUrl);
    const textContent = `Hi ${firstName},\n\nWelcome to Property Sync! Please verify your email address by clicking the link below:\n${verificationUrl}\n\nThis link will expire in 24 hours.\n\nBest regards,\nThe Property Sync Team`;

    try {
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

      this.logger.log(`Verification email sent successfully via Resend: ${result.data?.id}`);
      return result;
    } catch (error) {
      this.logger.error('Resend verification email failed:', {
        error: error.message,
        to: redirectedEmail,
        from: this.fromEmail,
        statusCode: error.statusCode
      });
      throw error;
    }
  }

  async sendWelcomeEmail(email: string, firstName: string) {
    const redirectedEmail = this.redirectEmailForDevelopment(email, 'delivered');
    
    this.logger.log(`Sending welcome email via Resend to ${redirectedEmail}`);

    const dashboardUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/dashboard`;
    const htmlContent = this.getWelcomeEmailTemplate(firstName, dashboardUrl);
    const textContent = `Hi ${firstName},\n\nYour Property Sync account is now verified and ready to use!\n\nGet started: ${dashboardUrl}\n\nBest regards,\nThe Property Sync Team`;

    try {
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

      this.logger.log(`Welcome email sent successfully via Resend: ${result.data?.id}`);
      return result;
    } catch (error) {
      this.logger.error('Resend welcome email failed:', {
        error: error.message,
        to: redirectedEmail,
        from: this.fromEmail,
        statusCode: error.statusCode
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
  
  private generatePropertyNotificationHtml(data: PropertyNotificationData): string {
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

  // Keep all your other template methods exactly as they are...
  private getModernTimelineTemplate(data: TimelineEmailData, brandColor: string): string {
    // Your existing implementation
    return `<!-- Your existing modern template HTML -->`;
  }

  private getClassicalTimelineTemplate(data: TimelineEmailData, brandColor: string): string {
    // Your existing implementation  
    return `<!-- Your existing classical template HTML -->`;
  }

  private getVerificationEmailTemplate(firstName: string, verificationUrl: string): string {
    // Your existing implementation
    return `<!-- Your existing verification template HTML -->`;
  }

  private getWelcomeEmailTemplate(firstName: string, dashboardUrl: string): string {
    // Your existing implementation
    return `<!-- Your existing welcome template HTML -->`;
  }
}