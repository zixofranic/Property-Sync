import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Resend } from 'resend';

@Injectable()
export class ResendProvider {
  private resend: Resend;

  constructor(private configService: ConfigService) {
    this.resend = new Resend(this.configService.get<string>('RESEND_API_KEY'));
  }

  async sendTimelineEmail(data: {
    to: string;
    clientName: string;
    agentName: string;
    agentCompany: string;
    timelineUrl: string;
    propertyCount: number;
  }) {
    const htmlContent = this.generateTimelineEmailHtml(data);
    
    return await this.resend.emails.send({
      from: 'Property Sync <noreply@propertysync.com>',
      to: data.to,
      subject: `Your Property Timeline from ${data.agentName}`,
      html: htmlContent,
    });
  }

  private generateTimelineEmailHtml(data: any): string {
    return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>Your Property Timeline</title></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="text-align: center; padding: 30px 0; border-bottom: 3px solid #3b82f6;">
    <h1 style="color: #1e293b; margin: 0;">Your Property Timeline</h1>
    <p style="color: #64748b; margin: 10px 0 0 0;">Curated by ${data.agentName}</p>
  </div>
  
  <div style="padding: 40px 20px;">
    <h2 style="color: #1e293b;">Hi ${data.clientName}! 👋</h2>
    <p>I've created a personalized property timeline just for you. I've carefully selected <strong>${data.propertyCount} properties</strong> that match your criteria.</p>
    
    <div style="background: linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%); padding: 30px; border-radius: 12px; text-align: center; margin: 30px 0;">
      <h3 style="color: white; margin: 0 0 20px 0;">View Your Properties</h3>
      <a href="${data.timelineUrl}" style="display: inline-block; background: white; color: #3b82f6; padding: 15px 30px; border-radius: 8px; text-decoration: none; font-weight: bold;">Open Timeline →</a>
    </div>
    
    <div style="background: #f8fafc; padding: 25px; border-radius: 8px; border-left: 4px solid #22c55e;">
      <h4 style="margin: 0 0 10px 0;">💡 How it works:</h4>
      <ul style="margin: 0; padding-left: 20px;">
        <li>Browse each property at your own pace</li>
        <li>Leave feedback using the ❤️ Love, 💬 Let's Talk, or ❌ Not for Me buttons</li>
        <li>Add your personal notes</li>
      </ul>
    </div>
  </div>
  
  <div style="border-top: 2px solid #e2e8f0; padding: 30px 20px; background: #f8fafc; text-align: center;">
    <h4 style="margin: 0; color: #1e293b;">${data.agentName}</h4>
    <p style="margin: 5px 0; color: #64748b;">${data.agentCompany}</p>
    <p style="margin: 15px 0; color: #64748b; font-size: 12px;">Powered by Property Sync</p>
  </div>
</body>
</html>`;
  }
}