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

  constructor(private configService: ConfigService) {
    const apiKey = this.configService.get<string>('RESEND_API_KEY');
    if (!apiKey) {
      this.logger.warn('RESEND_API_KEY not found. Resend functionality will be limited.');
    }
    this.resend = new Resend(apiKey);
  }

  // ENHANCED: Timeline Email with Modern/Classical Templates
  async sendTimelineEmail(data: TimelineEmailData) {
    this.logger.log(`Sending timeline email via Resend to ${data.to}`);

    const htmlContent = this.generateTimelineEmailHtml(data);
    const textContent = this.generateTimelineEmailText(data);

    try {
      const result = await this.resend.emails.send({
        from: 'Property Sync <noreply@propertysync.com>',
        to: data.to,
        subject: `Your Property Timeline from ${data.agentName}`,
        html: htmlContent,
        text: textContent,
        headers: {
          'X-Entity-Ref-ID': `timeline-${Date.now()}`,
        },
      });

      // Send to spouse if provided
      if (data.spouseEmail) {
        await this.resend.emails.send({
          from: 'Property Sync <noreply@propertysync.com>',
          to: data.spouseEmail,
          subject: `Property Timeline for ${data.clientName} from ${data.agentName}`,
          html: htmlContent.replace(new RegExp(data.clientName, 'g'), `${data.clientName} and you`),
          text: textContent.replace(new RegExp(data.clientName, 'g'), `${data.clientName} and you`),
          headers: {
            'X-Entity-Ref-ID': `timeline-spouse-${Date.now()}`,
          },
        });
      }

      return result;
    } catch (error) {
      this.logger.error('Resend timeline email failed:', error);
      throw error;
    }
  }

  // NEW: Property Update Notification
  async sendPropertyNotification(data: PropertyNotificationData) {
    this.logger.log(`Sending property notification via Resend to ${data.clientEmail}`);

    const htmlContent = this.generatePropertyNotificationHtml(data);
    const textContent = `New Property Added!\n\n${data.agentName} has added a new property to your timeline:\n\n${data.propertyAddress}\nPrice: $${data.propertyPrice.toLocaleString()}\n\n${data.propertyDescription}\n\nView your timeline: ${data.timelineUrl}`;

    try {
      const result = await this.resend.emails.send({
        from: 'Property Sync <noreply@propertysync.com>',
        to: data.clientEmail,
        subject: `New Property Added: ${data.propertyAddress}`,
        html: htmlContent,
        text: textContent,
        headers: {
          'X-Entity-Ref-ID': `property-notification-${Date.now()}`,
        },
      });

      // Send to spouse if provided
      if (data.spouseEmail) {
        await this.resend.emails.send({
          from: 'Property Sync <noreply@propertysync.com>',
          to: data.spouseEmail,
          subject: `New Property Added: ${data.propertyAddress}`,
          html: htmlContent,
          text: textContent,
          headers: {
            'X-Entity-Ref-ID': `property-notification-spouse-${Date.now()}`,
          },
        });
      }

      return result;
    } catch (error) {
      this.logger.error('Resend property notification failed:', error);
      throw error;
    }
  }

  // NEW: Feedback Reminder Email
  async sendFeedbackReminder(data: FeedbackReminderData) {
    this.logger.log(`Sending feedback reminder via Resend to ${data.clientEmail}`);

    const htmlContent = this.generateFeedbackReminderHtml(data);
    const textContent = `Hi ${data.clientName}!\n\nYou have ${data.pendingPropertiesCount} properties waiting for your feedback from ${data.agentName}.\n\nIt's been ${data.daysSinceLastActivity} days since your last activity. Your input helps us find you the perfect home!\n\nView your timeline: ${data.timelineUrl}`;

    try {
      return await this.resend.emails.send({
        from: 'Property Sync <noreply@propertysync.com>',
        to: data.clientEmail,
        subject: `Feedback Requested: ${data.pendingPropertiesCount} Properties Await Your Response`,
        html: htmlContent,
        text: textContent,
        headers: {
          'X-Entity-Ref-ID': `feedback-reminder-${Date.now()}`,
        },
      });
    } catch (error) {
      this.logger.error('Resend feedback reminder failed:', error);
      throw error;
    }
  }

  // NEW: Verification Email via Resend
  async sendVerificationEmail(email: string, firstName: string, verificationToken: string) {
    this.logger.log(`Sending verification email via Resend to ${email}`);

    const verificationUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/verify-email?token=${verificationToken}`;
    const htmlContent = this.getVerificationEmailTemplate(firstName, verificationUrl);
    const textContent = `Hi ${firstName},\n\nWelcome to Property Sync! Please verify your email address by clicking the link below:\n${verificationUrl}\n\nThis link will expire in 24 hours.\n\nBest regards,\nThe Property Sync Team`;

    try {
      return await this.resend.emails.send({
        from: 'Property Sync <noreply@propertysync.com>',
        to: email,
        subject: 'Welcome to Property Sync - Verify Your Email',
        html: htmlContent,
        text: textContent,
        headers: {
          'X-Entity-Ref-ID': `verification-${Date.now()}`,
        },
      });
    } catch (error) {
      this.logger.error('Resend verification email failed:', error);
      throw error;
    }
  }

  // NEW: Welcome Email via Resend
  async sendWelcomeEmail(email: string, firstName: string) {
    this.logger.log(`Sending welcome email via Resend to ${email}`);

    const dashboardUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/dashboard`;
    const htmlContent = this.getWelcomeEmailTemplate(firstName, dashboardUrl);
    const textContent = `Hi ${firstName},\n\nYour Property Sync account is now verified and ready to use!\n\nGet started: ${dashboardUrl}\n\nBest regards,\nThe Property Sync Team`;

    try {
      return await this.resend.emails.send({
        from: 'Property Sync <noreply@propertysync.com>',
        to: email,
        subject: '🎉 Welcome to Property Sync - Your Account is Ready!',
        html: htmlContent,
        text: textContent,
        headers: {
          'X-Entity-Ref-ID': `welcome-${Date.now()}`,
        },
      });
    } catch (error) {
      this.logger.error('Resend welcome email failed:', error);
      throw error;
    }
  }

  // PRIVATE: Template Generators
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
  
  <div style="border-top: 2px solid #e2e8f0; padding: 20px; background: #f8fafc; text-align: center;">
    <p style="margin: 0; color: #64748b; font-size: 12px;">Powered by Property Sync</p>
  </div>
</body>
</html>`;
  }

  private getModernTimelineTemplate(data: TimelineEmailData, brandColor: string): string {
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

  private getClassicalTimelineTemplate(data: TimelineEmailData, brandColor: string): string {
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

  private getVerificationEmailTemplate(firstName: string, verificationUrl: string): string {
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

  private getWelcomeEmailTemplate(firstName: string, dashboardUrl: string): string {
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
          <h1 style="color: white; margin: 0; font-size: 2.5em;">You're All Set!</h1>
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