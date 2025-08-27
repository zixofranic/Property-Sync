// Replace your existing resend.provider.ts with this fixed version

import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Resend } from 'resend';
import { EmailTemplateService } from './template.service';

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
  companyLogo?: string;
  brandColor?: string;
  templateStyle?: 'modern' | 'classical';
  emailType?: 'initial' | 'reminder';
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

  constructor(
    private configService: ConfigService,
    private templateService: EmailTemplateService,
  ) {
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
      this.fromEmail = this.isDevelopment 
        ? 'Property Sync <onboarding@resend.dev>'
        : 'Property Sync <noreply@property-sync.com>';
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
    const emailType = data.emailType || 'initial';
    
    // DEBUG: Log template generation
    console.log('📧 Email Template Generation Debug:', {
      requestedTemplate: data.templateStyle,
      finalTemplate: templateStyle,
      emailType: emailType,
      willUseClassical: templateStyle === 'classical',
      clientName: data.clientName
    });

    return this.templateService.getTimelineTemplate(data, emailType, templateStyle);
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

}
