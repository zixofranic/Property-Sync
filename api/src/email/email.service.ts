/*
TODO: Email Authentication Roadmap
- [x] Basic email verification with nodemailer
- [ ] SMS verification via Twilio (future)
- [ ] Magic link authentication (future)
- [ ] Google OAuth integration (future)
- [ ] Microsoft OAuth integration (future)
- [ ] MLS/Realtor database verification (future)
- [ ] NAR (National Association of Realtors) integration (future)
- [ ] State licensing board API verification (future)
- [ ] Real estate company email domain verification (future)
*/

import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';

@Injectable()
export class EmailService {
  private transporter: nodemailer.Transporter;

  constructor(private configService: ConfigService) {
    this.initializeTransporter();
  }

  private async initializeTransporter() {
    if (process.env.NODE_ENV === 'production') {
      // Production email setup (add to .env later)
      this.transporter = nodemailer.createTransport({ // Fix: createTransport not createTransporter
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
      
      this.transporter = nodemailer.createTransport({ // Fix: createTransport not createTransporter
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
  // Add this method to your existing EmailService class
async sendTimelineEmail(data: {
  clientEmail: string;
  clientName: string;
  agentName: string;
  agentCompany: string;
  shareToken: string;
  propertyCount: number;
}) {
  const timelineUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/timeline/${data.shareToken}`;
  
  try {
    // For now, we'll use a simple email (you can enhance this later with Resend)
    console.log('Timeline email would be sent:', {
      to: data.clientEmail,
      subject: `Your Property Timeline from ${data.agentName}`,
      timelineUrl,
      propertyCount: data.propertyCount
    });

    // Return mock success for now
    return { 
      success: true, 
      messageId: `mock_${Date.now()}`,
      data: { id: `mock_${Date.now()}` }
    };
  } catch (error) {
    console.error('Timeline email failed:', error);
    throw error;
  }
}
  async sendVerificationEmail(email: string, firstName: string, verificationToken: string) {
    const verificationUrl = `${this.configService.get('FRONTEND_URL') || 'http://localhost:3000'}/verify-email?token=${verificationToken}`;
    
    const mailOptions = {
      from: '"Property Sync" <noreply@propertysync.com>',
      to: email,
      subject: 'Welcome to Property Sync - Verify Your Email',
      html: this.getVerificationEmailTemplate(firstName, verificationUrl),
      text: `
        Hi ${firstName},
        
        Welcome to Property Sync! Please verify your email address by clicking the link below:
        ${verificationUrl}
        
        This link will expire in 24 hours.
        
        Best regards,
        The Property Sync Team
      `,
    };

    try {
      const info = await this.transporter.sendMail(mailOptions);
      
      if (process.env.NODE_ENV !== 'production') {
        console.log('📧 Preview URL: %s', nodemailer.getTestMessageUrl(info));
      }
      
      return { success: true, messageId: info.messageId };
    } catch (error) {
      console.error('Email sending failed:', error);
      return { success: false, error: error.message };
    }
  }

  async sendWelcomeEmail(email: string, firstName: string) {
    const dashboardUrl = `${this.configService.get('FRONTEND_URL') || 'http://localhost:3000'}/dashboard`;
    
    const mailOptions = {
      from: '"Property Sync" <noreply@propertysync.com>',
      to: email,
      subject: '🎉 Welcome to Property Sync - Your Account is Ready!',
      html: this.getWelcomeEmailTemplate(firstName, dashboardUrl),
      text: `
        Hi ${firstName},
        
        Your Property Sync account is now verified and ready to use!
        
        Get started: ${dashboardUrl}
        
        Best regards,
        The Property Sync Team
      `,
    };

    try {
      const info = await this.transporter.sendMail(mailOptions);
      
      if (process.env.NODE_ENV !== 'production') {
        console.log('📧 Welcome Email Preview: %s', nodemailer.getTestMessageUrl(info));
      }
      
      return { success: true, messageId: info.messageId };
    } catch (error) {
      console.error('Welcome email sending failed:', error);
      return { success: false, error: error.message };
    }
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
          <h2 style="color: #0ea5e9; margin-top: 0;">Welcome aboard, ${firstName}! 🎉</h2>
          <p style="font-size: 1.1em; margin: 20px 0;">You're just one click away from accessing your Mission Control dashboard for real estate client management.</p>
          
          <div style="text-align: center; margin: 30px 0;">
            <a href="${verificationUrl}" style="background: #0ea5e9; color: white; padding: 15px 30px; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 1.1em; display: inline-block; box-shadow: 0 4px 6px rgba(14, 165, 233, 0.3);">
              ✅ Verify Email Address
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
          <h1 style="color: white; margin: 0; font-size: 2.5em;">🎉</h1>
          <h2 style="color: white; margin: 10px 0; font-size: 1.8em;">You're All Set!</h2>
        </div>
        
        <div style="padding: 30px; background: #f0fdf4; border-radius: 10px; border-left: 5px solid #10b981;">
          <h2 style="color: #059669; margin-top: 0;">Welcome to Property Sync, ${firstName}!</h2>
          <p style="font-size: 1.1em;">Your email has been verified and your account is ready to go. Time to revolutionize how you manage your real estate clients!</p>
          
          <div style="text-align: center; margin: 30px 0;">
            <a href="${dashboardUrl}" style="background: #10b981; color: white; padding: 15px 30px; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 1.1em; display: inline-block; box-shadow: 0 4px 6px rgba(16, 185, 129, 0.3);">
              🚀 Launch Mission Control
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
          <p style="margin: 5px 0;">Happy selling! 🏠</p>
        </div>
      </body>
      </html>
    `;
  }
}