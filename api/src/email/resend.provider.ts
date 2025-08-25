// Replace your existing resend.provider.ts with this fixed version

import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Resend } from 'resend';

export interface TimelineEmailData {
  to: string;
  clientName: string;
  clientPhone?: string;
  agentName: string;
  agentCompany: string;
  agentEmail?: string;
  agentPhone?: string;
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

    // Enhanced logging for debugging
    this.logger.log(`Environment: ${process.env.NODE_ENV || 'not set'}`);
    this.logger.log(`API Key present: ${!!apiKey}`);
    this.logger.log(`API Key length: ${apiKey?.length || 0}`);

    if (!apiKey) {
      this.logger.error('RESEND_API_KEY not found - email functionality disabled');
      this.resend = null;
      this.fromEmail = '';
      return;
    }

    try {
      this.resend = new Resend(apiKey);
      this.fromEmail = 'Property Sync <onboarding@resend.dev>';
      this.logger.log('Resend client initialized successfully');
    } catch (error) {
      this.logger.error('Failed to initialize Resend client:', error);
      this.resend = null;
      this.fromEmail = '';
    }

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
      this.logger.error('CRITICAL: RESEND_API_KEY not configured on Railway - cannot send emails');
      this.logger.error('Please add RESEND_API_KEY environment variable to Railway deployment');
      return { 
        success: false, 
        error: 'RESEND_API_KEY environment variable not configured on Railway deployment' 
      };
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
        this.logger.error('Resend service not configured - cannot send email');
        throw new Error('Resend service not configured');
      }

      this.logger.log('Attempting to send email via Resend API...');
      this.logger.log(`From: ${this.fromEmail}`);
      this.logger.log(`To: ${redirectedTo}`);

      const result = await this.resend.emails.send({
        from: this.fromEmail,
        to: redirectedTo,
        subject: `${this.isDevelopment ? '[DEV TEST] ' : ''}🏠 ${data.propertyCount} Properties Selected for You - ${data.agentName}`,
        html: htmlContent,
        text: textContent,
        headers: {
          'X-Entity-Ref-ID': `timeline-${Date.now()}`,
          ...(this.isDevelopment && { 'X-Original-Recipient': data.to }),
        },
      });

      this.logger.log('Resend API response received');
      this.logger.log(`Result type: ${typeof result}`);
      this.logger.log(`Has error: ${!!result.error}`);
      this.logger.log(`Has data: ${!!result.data}`);

      if (result.error) {
        this.logger.error('Resend API returned error:', JSON.stringify(result.error, null, 2));
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
    const firstName = data.clientName.split(' ')[0];
    const clientPhone = data.clientPhone || 'your phone number';
    const last4Digits = clientPhone.length >= 4 ? clientPhone.slice(-4) : '****';
    
    return `
🏠 YOUR PERSONAL PROPERTY TIMELINE - ${data.propertyCount} PROPERTIES SELECTED FOR YOU

Hi ${data.clientName}!

${data.agentName} from ${data.agentCompany} has personally selected ${data.propertyCount} exceptional properties that perfectly match your criteria and preferences. Each home has been chosen specifically with your needs in mind.

🔑 QUICK ACCESS INSTRUCTIONS:
Login Details: Use your first name and last 4 digits of your phone number
Username: ${firstName}
Password: ${last4Digits}

📋 STEP-BY-STEP GUIDE:
1. Click the link below to open your personalized property portal
2. Enter your login details (${firstName} / ${last4Digits}) when prompted
3. Browse each property with detailed photos, descriptions, and pricing
4. Share your feedback using Love It! ❤️, Let's Talk 💬, or Not for Me ❌ buttons

VIEW YOUR ${data.propertyCount} PROPERTIES: ${data.timelineUrl}

Ready to discuss your next move?
${data.agentEmail ? `📧 Email: ${data.agentEmail}` : ''}
${data.agentPhone ? `📱 Phone: ${data.agentPhone}` : ''}

Best regards,
${data.agentName}
${data.agentCompany}
⭐ REALTOR®

Powered by Property Sync - Making real estate personal
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
    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Welcome to Property Sync - Verify Your Email</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; background: #f8fafc;">
  <!-- Header -->
  <div style="text-align: center; padding: 40px 20px; background: linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%); border-radius: 20px; margin-bottom: 30px; position: relative; overflow: hidden;">
    <!-- Decorative elements -->
    <div style="position: absolute; top: -20px; right: -20px; width: 80px; height: 80px; background: rgba(255,255,255,0.1); border-radius: 50%;"></div>
    <div style="position: absolute; bottom: -30px; left: -30px; width: 60px; height: 60px; background: rgba(255,255,255,0.1); border-radius: 50%;"></div>
    
    <div style="position: relative; z-index: 10;">
      <h1 style="color: white; margin: 0; font-size: 2.8em; font-weight: 900; text-shadow: 0 2px 4px rgba(0,0,0,0.3);">🏠 Property Sync</h1>
      <p style="color: rgba(255,255,255,0.95); margin: 15px 0 0 0; font-size: 1.3em; font-weight: 500;">Mission Control for Real Estate</p>
    </div>
  </div>
  
  <!-- Main Content -->
  <div style="background: white; padding: 40px 30px; border-radius: 16px; box-shadow: 0 10px 25px rgba(0,0,0,0.1); margin-bottom: 20px;">
    <div style="text-align: center; margin-bottom: 35px;">
      <h2 style="color: #1e293b; font-size: 2.2em; margin: 0 0 20px 0;">Welcome aboard, ${firstName}! 🎉</h2>
      <div style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); padding: 25px; border-radius: 16px; margin: 25px 0;">
        <p style="color: white; font-size: 1.3em; font-weight: 600; margin: 0; text-shadow: 0 1px 2px rgba(0,0,0,0.2);">
          🚀 Property Sync will revolutionize how your clients experience their home-buying journey. 
          Turn every property search into an engaging, personalized story that converts browsers into buyers!
        </p>
      </div>
    </div>
    
    <!-- Verification Section -->
    <div style="background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%); padding: 30px; border-radius: 16px; border-left: 6px solid #f59e0b; margin: 30px 0; text-align: center;">
      <div style="margin-bottom: 25px;">
        <div style="width: 80px; height: 80px; background: #f59e0b; border-radius: 50%; margin: 0 auto 20px; display: flex; align-items: center; justify-content: center; box-shadow: 0 8px 25px rgba(245, 158, 11, 0.4);">
          <span style="font-size: 36px; color: white;">📧</span>
        </div>
        <h3 style="color: #92400e; margin: 0 0 15px 0; font-size: 1.4em;">Let's Verify Your Email</h3>
        <p style="color: #b45309; margin: 0 0 25px 0; font-size: 1.1em;">Click the button below to activate your account and start transforming your real estate business!</p>
      </div>
      
      <a href="${verificationUrl}" style="display: inline-block; background: linear-gradient(135deg, #f59e0b 0%, #f97316 100%); color: white; padding: 18px 40px; border-radius: 50px; text-decoration: none; font-weight: 800; font-size: 1.2em; box-shadow: 0 8px 25px rgba(249, 115, 22, 0.4); text-shadow: 0 1px 2px rgba(0,0,0,0.2);">
        ✨ Verify My Email & Get Started
      </a>
      
      <p style="color: #b45309; margin: 20px 0 0 0; font-size: 0.9em;">⏰ This verification link expires in 24 hours</p>
    </div>
    
    <!-- What's Next Section -->
    <div style="background: linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%); padding: 30px; border-radius: 16px; border-left: 6px solid #22c55e; margin: 30px 0;">
      <h3 style="color: #166534; margin: 0 0 20px 0; font-size: 1.4em; display: flex; align-items: center; gap: 10px;">
        <span>🎯</span> What's Next - Your Success Journey:
      </h3>
      <div style="display: grid; gap: 15px;">
        <div style="display: flex; align-items: center; gap: 12px;">
          <span style="width: 30px; height: 30px; background: #22c55e; color: white; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: bold; font-size: 14px; flex-shrink: 0;">1</span>
          <span style="color: #166534; font-size: 1.1em;"><strong>Set up your profile</strong> with branding and company info</span>
        </div>
        <div style="display: flex; align-items: center; gap: 12px;">
          <span style="width: 30px; height: 30px; background: #22c55e; color: white; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: bold; font-size: 14px; flex-shrink: 0;">2</span>
          <span style="color: #166534; font-size: 1.1em;"><strong>Create your first client</strong> and their personalized timeline</span>
        </div>
        <div style="display: flex; align-items: center; gap: 12px;">
          <span style="width: 30px; height: 30px; background: #22c55e; color: white; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: bold; font-size: 14px; flex-shrink: 0;">3</span>
          <span style="color: #166534; font-size: 1.1em;"><strong>Add properties</strong> with stunning visuals and details</span>
        </div>
        <div style="display: flex; align-items: center; gap: 12px;">
          <span style="width: 30px; height: 30px; background: #22c55e; color: white; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: bold; font-size: 14px; flex-shrink: 0;">4</span>
          <span style="color: #166534; font-size: 1.1em;"><strong>Share the magic</strong> and watch client engagement soar!</span>
        </div>
      </div>
    </div>
    
    <!-- Troubleshooting -->
    <div style="background: #f1f5f9; padding: 20px; border-radius: 12px; margin: 25px 0;">
      <h4 style="color: #475569; margin: 0 0 10px 0; font-size: 1.1em;">Having trouble with the button?</h4>
      <p style="color: #64748b; margin: 0; font-size: 0.95em;">Copy and paste this link in your browser:</p>
      <p style="color: #3b82f6; font-family: monospace; word-break: break-all; background: white; padding: 10px; border-radius: 6px; margin: 8px 0 0 0; font-size: 0.9em;">${verificationUrl}</p>
    </div>
  </div>
  
  <!-- Footer -->
  <div style="text-align: center; padding: 20px; color: #94a3b8; font-size: 0.9em;">
    <p style="margin: 0 0 10px 0;">Questions? We're here to help at <a href="mailto:support@propertysync.com" style="color: #3b82f6;">support@propertysync.com</a></p>
    <p style="margin: 0;">Property Sync - Transforming Real Estate, One Client at a Time 🏡</p>
  </div>
</body>
</html>`;
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
    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>🎉 Welcome to Property Sync - You're Ready!</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; background: #f8fafc;">
  <!-- Header -->
  <div style="text-align: center; padding: 40px 20px; background: linear-gradient(135deg, #10b981 0%, #059669 100%); border-radius: 20px; margin-bottom: 30px; position: relative; overflow: hidden;">
    <!-- Decorative elements -->
    <div style="position: absolute; top: -30px; right: -30px; width: 100px; height: 100px; background: rgba(255,255,255,0.1); border-radius: 50%;"></div>
    <div style="position: absolute; bottom: -40px; left: -40px; width: 80px; height: 80px; background: rgba(255,255,255,0.1); border-radius: 50%;"></div>
    
    <div style="position: relative; z-index: 10;">
      <div style="font-size: 4em; margin-bottom: 20px;">🎉</div>
      <h1 style="color: white; margin: 0; font-size: 2.6em; font-weight: 900; text-shadow: 0 2px 4px rgba(0,0,0,0.3);">You're All Set!</h1>
      <p style="color: rgba(255,255,255,0.95); margin: 15px 0 0 0; font-size: 1.3em; font-weight: 500;">Welcome to the future of real estate</p>
    </div>
  </div>
  
  <!-- Main Content -->
  <div style="background: white; padding: 40px 30px; border-radius: 16px; box-shadow: 0 10px 25px rgba(0,0,0,0.1); margin-bottom: 20px;">
    <div style="text-align: center; margin-bottom: 35px;">
      <h2 style="color: #1e293b; font-size: 2.2em; margin: 0 0 20px 0;">Welcome to Property Sync, ${firstName}! 🚀</h2>
      
      <!-- Success Message -->
      <div style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); padding: 30px; border-radius: 16px; margin: 25px 0; text-align: center;">
        <div style="margin-bottom: 20px;">
          <div style="width: 80px; height: 80px; background: rgba(255,255,255,0.2); border-radius: 50%; margin: 0 auto 15px; display: flex; align-items: center; justify-content: center; box-shadow: 0 8px 25px rgba(0,0,0,0.2);">
            <span style="font-size: 36px; color: white;">✅</span>
          </div>
          <h3 style="color: white; margin: 0; font-size: 1.6em; font-weight: 800; text-shadow: 0 1px 2px rgba(0,0,0,0.2);">Your Account is Verified & Ready!</h3>
        </div>
        <p style="color: rgba(255,255,255,0.95); font-size: 1.2em; margin: 0;">Time to revolutionize how you manage your real estate clients and transform their home-buying experience!</p>
      </div>
    </div>
    
    <!-- Call to Action -->
    <div style="text-align: center; margin: 40px 0;">
      <a href="${dashboardUrl}" style="display: inline-block; background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: white; padding: 20px 45px; border-radius: 50px; text-decoration: none; font-weight: 800; font-size: 1.3em; box-shadow: 0 10px 30px rgba(16, 185, 129, 0.4); text-shadow: 0 1px 2px rgba(0,0,0,0.2); transform: translateY(0); transition: all 0.3s ease;">
        🏡 Launch My Mission Control
      </a>
      
      <p style="color: #64748b; margin: 20px 0 0 0; font-size: 1em;">Your personalized dashboard awaits ⚡</p>
    </div>
    
    <!-- Quick Start Guide -->
    <div style="background: linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%); padding: 30px; border-radius: 16px; border-left: 6px solid #22c55e; margin: 30px 0;">
      <h3 style="color: #166534; margin: 0 0 25px 0; font-size: 1.5em; text-align: center;">🚀 Your 4-Step Success Journey</h3>
      <div style="display: grid; gap: 20px;">
        <div style="background: white; padding: 20px; border-radius: 12px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
          <div style="display: flex; align-items: center; gap: 15px;">
            <span style="width: 40px; height: 40px; background: #22c55e; color: white; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: bold; font-size: 16px; flex-shrink: 0; box-shadow: 0 4px 12px rgba(34, 197, 94, 0.3);">1</span>
            <div>
              <h4 style="margin: 0 0 5px 0; color: #166534; font-size: 1.2em;">Customize Your Profile</h4>
              <p style="margin: 0; color: #374151; font-size: 1em;">Add your branding, company info, and professional photo</p>
            </div>
          </div>
        </div>
        
        <div style="background: white; padding: 20px; border-radius: 12px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
          <div style="display: flex; align-items: center; gap: 15px;">
            <span style="width: 40px; height: 40px; background: #22c55e; color: white; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: bold; font-size: 16px; flex-shrink: 0; box-shadow: 0 4px 12px rgba(34, 197, 94, 0.3);">2</span>
            <div>
              <h4 style="margin: 0 0 5px 0; color: #166534; font-size: 1.2em;">Create Your First Client</h4>
              <p style="margin: 0; color: #374151; font-size: 1em;">We'll automatically generate their personalized timeline</p>
            </div>
          </div>
        </div>
        
        <div style="background: white; padding: 20px; border-radius: 12px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
          <div style="display: flex; align-items: center; gap: 15px;">
            <span style="width: 40px; height: 40px; background: #22c55e; color: white; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: bold; font-size: 16px; flex-shrink: 0; box-shadow: 0 4px 12px rgba(34, 197, 94, 0.3);">3</span>
            <div>
              <h4 style="margin: 0 0 5px 0; color: #166534; font-size: 1.2em;">Add Properties</h4>
              <p style="margin: 0; color: #374151; font-size: 1em;">Upload stunning property details and images</p>
            </div>
          </div>
        </div>
        
        <div style="background: white; padding: 20px; border-radius: 12px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
          <div style="display: flex; align-items: center; gap: 15px;">
            <span style="width: 40px; height: 40px; background: #22c55e; color: white; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: bold; font-size: 16px; flex-shrink: 0; box-shadow: 0 4px 12px rgba(34, 197, 94, 0.3);">4</span>
            <div>
              <h4 style="margin: 0 0 5px 0; color: #166534; font-size: 1.2em;">Share & Watch Magic Happen</h4>
              <p style="margin: 0; color: #374151; font-size: 1em;">Send the timeline and watch client engagement soar!</p>
            </div>
          </div>
        </div>
      </div>
    </div>
    
    <!-- Key Benefits -->
    <div style="background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%); padding: 25px; border-radius: 16px; border-left: 6px solid #f59e0b; margin: 25px 0;">
      <h4 style="color: #92400e; margin: 0 0 15px 0; font-size: 1.3em; text-align: center;">⭐ What Makes Property Sync Special</h4>
      <div style="color: #b45309; font-size: 1.1em; text-align: center;">
        <p style="margin: 10px 0;">🎯 <strong>Personalized client experiences</strong> that build trust</p>
        <p style="margin: 10px 0;">📊 <strong>Instant feedback</strong> on every property you share</p>
        <p style="margin: 10px 0;">⚡ <strong>Save hours</strong> of back-and-forth emails</p>
        <p style="margin: 10px 0;">🏆 <strong>Close more deals</strong> with engaged clients</p>
      </div>
    </div>
  </div>
  
  <!-- Footer -->
  <div style="text-align: center; padding: 20px; color: #94a3b8; font-size: 0.9em;">
    <p style="margin: 0 0 10px 0;">Questions? We're here to help at <a href="mailto:support@propertysync.com" style="color: #10b981;">support@propertysync.com</a></p>
    <p style="margin: 0;">Property Sync - Transforming Real Estate, One Client at a Time 🏡</p>
  </div>
</body>
</html>`;
  }

  private getModernTimelineTemplate(data: TimelineEmailData, brandColor: string): string {
    // Extract client's first name and phone for login instructions
    const firstName = data.clientName.split(' ')[0];
    const clientPhone = data.clientPhone || 'your phone number';
    const last4Digits = clientPhone.length >= 4 ? clientPhone.slice(-4) : '****';
    
    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>🏠 Your Personal Property Timeline - ${data.propertyCount} Properties Selected</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
  </style>
</head>
<body style="font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #334155; max-width: 650px; margin: 0 auto; padding: 0; background: #f8fafc;">
  
  <!-- Header with Agent Photo -->
  <div style="background: linear-gradient(135deg, ${brandColor} 0%, #8b5cf6 100%); padding: 45px 30px; text-align: center; border-radius: 16px 16px 0 0; position: relative; overflow: hidden;">
    <!-- Decorative elements -->
    <div style="position: absolute; top: -20px; right: -20px; width: 120px; height: 120px; background: rgba(255,255,255,0.1); border-radius: 50%;"></div>
    <div style="position: absolute; bottom: -30px; left: -30px; width: 80px; height: 80px; background: rgba(255,255,255,0.15); border-radius: 50%;"></div>
    
    <div style="position: relative; z-index: 10;">
      ${data.agentPhoto ? `<img src="${data.agentPhoto}" alt="${data.agentName}" style="width: 90px; height: 90px; border-radius: 50%; border: 5px solid white; margin-bottom: 20px; object-fit: cover; box-shadow: 0 8px 25px rgba(0,0,0,0.3);">` : `<div style="width: 90px; height: 90px; border-radius: 50%; border: 5px solid white; margin: 0 auto 20px; background: rgba(255,255,255,0.2); display: flex; align-items: center; justify-content: center; font-size: 36px;">🏠</div>`}
      
      <!-- Prominent Property Count -->
      <div style="background: rgba(255,255,255,0.2); backdrop-filter: blur(10px); border: 1px solid rgba(255,255,255,0.3); border-radius: 50px; display: inline-block; padding: 8px 20px; margin-bottom: 15px;">
        <span style="color: white; font-size: 14px; font-weight: 600; text-shadow: 0 1px 2px rgba(0,0,0,0.2);">✨ ${data.propertyCount} PROPERTIES SELECTED FOR YOU ✨</span>
      </div>
      
      <h1 style="color: white; margin: 0 0 8px 0; font-size: 32px; font-weight: 700; text-shadow: 0 2px 4px rgba(0,0,0,0.3);">Your Personal Property Timeline</h1>
      <p style="color: rgba(255,255,255,0.95); margin: 0; font-size: 18px; font-weight: 500; text-shadow: 0 1px 2px rgba(0,0,0,0.2);">Curated by ${data.agentName}</p>
      <p style="color: rgba(255,255,255,0.8); margin: 5px 0 0 0; font-size: 15px;">${data.agentCompany}</p>
    </div>
  </div>
  
  <!-- Welcome Message -->
  <div style="background: white; padding: 40px 35px 30px 35px; box-shadow: 0 10px 25px rgba(0,0,0,0.08);">
    <h2 style="color: #1e293b; font-size: 24px; font-weight: 600; margin: 0 0 20px 0; text-align: center;">Hi ${data.clientName}! 👋</h2>
    
    <p style="font-size: 17px; line-height: 1.8; margin: 0 0 25px 0; text-align: center; color: #475569;">
      I've personally selected <strong style="color: ${brandColor}; font-size: 18px;">${data.propertyCount} exceptional properties</strong> that perfectly match your criteria and preferences. Each home has been chosen specifically with your needs in mind.
    </p>
    
    <!-- Property Count Highlight -->
    <div style="background: linear-gradient(135deg, ${brandColor}08 0%, #8b5cf608 100%); border: 2px solid ${brandColor}20; border-radius: 16px; padding: 25px; text-align: center; margin: 25px 0; position: relative;">
      <div style="background: ${brandColor}; color: white; font-size: 32px; font-weight: 700; width: 60px; height: 60px; border-radius: 50%; display: flex; align-items: center; justify-content: center; margin: 0 auto 15px; box-shadow: 0 4px 15px ${brandColor}40;">
        ${data.propertyCount}
      </div>
      <h3 style="color: #1e293b; margin: 0 0 10px 0; font-size: 20px; font-weight: 600;">Properties Ready for You</h3>
      <p style="margin: 0; color: #64748b; font-size: 15px;">Handpicked from thousands of listings</p>
    </div>
  </div>

  <!-- Access Instructions -->
  <div style="background: white; padding: 0 35px 35px 35px;">
    <div style="background: #fef3c7; border: 2px solid #f59e0b; border-radius: 12px; padding: 25px; margin-bottom: 25px;">
      <h3 style="color: #92400e; margin: 0 0 15px 0; font-size: 18px; font-weight: 600; display: flex; align-items: center;">
        🔑 <span style="margin-left: 8px;">Quick Access Instructions</span>
      </h3>
      <p style="margin: 0 0 15px 0; color: #78350f; font-size: 16px; line-height: 1.6;">
        <strong>Login Details:</strong> Use your first name and last 4 digits of your phone number
      </p>
      <div style="background: white; border: 1px solid #f59e0b; border-radius: 8px; padding: 15px; font-family: 'Monaco', 'Menlo', monospace;">
        <div style="color: #92400e; font-size: 14px; margin-bottom: 5px;">👤 <strong>Username:</strong> ${firstName}</div>
        <div style="color: #92400e; font-size: 14px;">🔢 <strong>Password:</strong> ${last4Digits}</div>
      </div>
    </div>

    <!-- Step-by-Step Guide -->
    <div style="background: #f0f9ff; border: 2px solid #0ea5e9; border-radius: 12px; padding: 25px; margin-bottom: 25px;">
      <h3 style="color: #0c4a6e; margin: 0 0 20px 0; font-size: 18px; font-weight: 600; text-align: center;">📋 Step-by-Step Access Guide</h3>
      
      <div style="space-y: 15px;">
        <div style="display: flex; align-items: flex-start; margin-bottom: 15px;">
          <div style="background: #0ea5e9; color: white; width: 24px; height: 24px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 12px; font-weight: 600; margin-right: 12px; flex-shrink: 0;">1</div>
          <div style="color: #0c4a6e; font-size: 15px; line-height: 1.5;">
            <strong>Click the "View Timeline" button</strong> below to open your personalized property portal
          </div>
        </div>
        
        <div style="display: flex; align-items: flex-start; margin-bottom: 15px;">
          <div style="background: #0ea5e9; color: white; width: 24px; height: 24px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 12px; font-weight: 600; margin-right: 12px; flex-shrink: 0;">2</div>
          <div style="color: #0c4a6e; font-size: 15px; line-height: 1.5;">
            <strong>Enter your login details</strong> (${firstName} / ${last4Digits}) when prompted
          </div>
        </div>
        
        <div style="display: flex; align-items: flex-start; margin-bottom: 15px;">
          <div style="background: #0ea5e9; color: white; width: 24px; height: 24px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 12px; font-weight: 600; margin-right: 12px; flex-shrink: 0;">3</div>
          <div style="color: #0c4a6e; font-size: 15px; line-height: 1.5;">
            <strong>Browse each property</strong> with detailed photos, descriptions, and pricing
          </div>
        </div>
        
        <div style="display: flex; align-items: flex-start; margin-bottom: 0;">
          <div style="background: #0ea5e9; color: white; width: 24px; height: 24px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 12px; font-weight: 600; margin-right: 12px; flex-shrink: 0;">4</div>
          <div style="color: #0c4a6e; font-size: 15px; line-height: 1.5;">
            <strong>Share your feedback</strong> using Love It! ❤️, Let's Talk 💬, or Not for Me ❌ buttons
          </div>
        </div>
      </div>
    </div>

    <!-- CTA Button -->
    <div style="text-align: center; margin: 30px 0;">
      <a href="${data.timelineUrl}" style="display: inline-block; background: linear-gradient(135deg, ${brandColor} 0%, #8b5cf6 100%); color: white; padding: 18px 40px; border-radius: 12px; text-decoration: none; font-weight: 600; font-size: 18px; box-shadow: 0 6px 20px ${brandColor}40; transition: all 0.3s ease; border: 2px solid transparent;">
        🏠 VIEW YOUR ${data.propertyCount} PROPERTIES →
      </a>
      <p style="margin: 12px 0 0 0; color: #64748b; font-size: 14px; font-style: italic;">Click above to access your personalized timeline</p>
    </div>
  </div>
  
  <!-- Enhanced Agent Branding Footer -->
  <div style="background: linear-gradient(135deg, #1e293b 0%, #334155 100%); padding: 35px 30px; border-radius: 0 0 16px 16px; color: white; position: relative; overflow: hidden;">
    <!-- Decorative background -->
    <div style="position: absolute; top: -50px; right: -50px; width: 150px; height: 150px; background: rgba(255,255,255,0.05); border-radius: 50%;"></div>
    <div style="position: absolute; bottom: -30px; left: -30px; width: 100px; height: 100px; background: rgba(255,255,255,0.03); border-radius: 50%;"></div>
    
    <div style="position: relative; z-index: 10;">
      <!-- Agent Card -->
      <div style="background: rgba(255,255,255,0.08); backdrop-filter: blur(10px); border: 1px solid rgba(255,255,255,0.1); border-radius: 16px; padding: 25px; margin-bottom: 25px;">
        <div style="display: flex; align-items: center; margin-bottom: 20px;">
          ${data.agentPhoto ? `<img src="${data.agentPhoto}" alt="${data.agentName}" style="width: 70px; height: 70px; border-radius: 12px; border: 3px solid rgba(255,255,255,0.2); margin-right: 20px; object-fit: cover;">` : `<div style="width: 70px; height: 70px; border-radius: 12px; border: 3px solid rgba(255,255,255,0.2); margin-right: 20px; background: rgba(255,255,255,0.1); display: flex; align-items: center; justify-content: center; font-size: 28px;">👤</div>`}
          
          <div style="flex: 1;">
            <h3 style="margin: 0 0 5px 0; font-size: 20px; font-weight: 700; color: white;">${data.agentName}</h3>
            <p style="margin: 0 0 8px 0; color: #cbd5e1; font-size: 16px; font-weight: 500;">${data.agentCompany}</p>
            <div style="background: ${brandColor}; color: white; font-size: 11px; font-weight: 600; padding: 4px 8px; border-radius: 6px; display: inline-block; letter-spacing: 0.5px;">
              ⭐ REALTOR®
            </div>
          </div>
        </div>
        
        ${data.agentEmail || data.agentPhone ? `
        <div style="border-top: 1px solid rgba(255,255,255,0.1); padding-top: 15px;">
          <p style="margin: 0 0 10px 0; color: #e2e8f0; font-size: 14px; font-weight: 600;">Ready to discuss your next move?</p>
          <div style="display: flex; gap: 10px; flex-wrap: wrap;">
            ${data.agentEmail ? `<a href="mailto:${data.agentEmail}" style="background: rgba(255,255,255,0.1); color: white; padding: 8px 12px; border-radius: 8px; text-decoration: none; font-size: 13px; font-weight: 500; border: 1px solid rgba(255,255,255,0.2);">📧 Email Me</a>` : ''}
            ${data.agentPhone ? `<a href="tel:${data.agentPhone}" style="background: rgba(255,255,255,0.1); color: white; padding: 8px 12px; border-radius: 8px; text-decoration: none; font-size: 13px; font-weight: 500; border: 1px solid rgba(255,255,255,0.2);">📱 Call Me</a>` : ''}
          </div>
        </div>` : ''}
      </div>

      <!-- Footer -->
      <div style="text-align: center; padding-top: 20px; border-top: 1px solid rgba(255,255,255,0.1);">
        <p style="margin: 0 0 5px 0; color: #94a3b8; font-size: 16px; font-weight: 500;">Powered by</p>
        <div style="color: ${brandColor}; font-size: 18px; font-weight: 700; display: flex; align-items: center; justify-content: center; gap: 8px;">
          🏠 <span>Property Sync</span>
        </div>
        <p style="margin: 8px 0 0 0; color: #64748b; font-size: 12px; font-style: italic;">Making real estate personal</p>
      </div>
    </div>
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
