import { Injectable } from '@nestjs/common';

export interface EmailTemplateData {
  clientEmail?: string;
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
}

export interface TimelineEmailData {
  to?: string;
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
}

@Injectable()
export class EmailTemplateService {
  
  /**
   * Get the appropriate email template based on type and style
   */
  getTimelineTemplate(
    data: TimelineEmailData | EmailTemplateData,
    emailType: 'initial' | 'reminder',
    templateStyle: 'modern' | 'classical' = 'modern'
  ): string {
    const brandColor = data.brandColor || '#3b82f6';
    
    switch (templateStyle) {
      case 'classical':
        return emailType === 'initial' 
          ? this.getClassicalInitialTemplate(data, brandColor)
          : this.getClassicalReminderTemplate(data, brandColor);
      case 'modern':
      default:
        return emailType === 'initial'
          ? this.getModernInitialTemplate(data, brandColor)
          : this.getModernReminderTemplate(data, brandColor);
    }
  }

  /**
   * Modern Initial Welcome Template
   */
  private getModernInitialTemplate(data: TimelineEmailData | EmailTemplateData, brandColor: string): string {
    const firstName = data.clientName.split(' ')[0];
    const clientPhone = data.clientPhone || 'your phone number';
    const last4Digits = clientPhone.length >= 4 ? clientPhone.slice(-4) : '****';
    
    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>🏡 Welcome to Your Property Timeline - ${data.propertyCount} Properties Selected</title>
</head>
<body style="font-family: Arial, Helvetica, sans-serif; line-height: 1.6; color: #334155; margin: 0; padding: 0; background-color: #f8fafc;">
  
  <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #f8fafc;">
    <tr>
      <td align="center" style="padding: 20px 10px;">
        <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="600" style="max-width: 600px; background-color: white; margin: 0 auto;">
          
          <!-- Header -->
          <tr>
            <td align="center" style="background-color: ${brandColor}; padding: 30px 20px; color: white;">
              
              <!-- Agent Photo -->
              ${data.agentPhoto ? 
                `<img src="${data.agentPhoto}" alt="${data.agentName}" width="80" height="80" style="border-radius: 10px; border: 3px solid white; margin-bottom: 15px; display: block;">` : 
                `<table role="presentation" border="0" cellpadding="0" cellspacing="0" width="80" height="80" style="margin: 0 auto 15px auto; background-color: rgba(255,255,255,0.2); border-radius: 10px; border: 3px solid white;">
                  <tr><td align="center" style="font-size: 36px; line-height: 80px;">🏠</td></tr>
                </table>`
              }
              
              <!-- Welcome Badge -->
              <table role="presentation" border="0" cellpadding="0" cellspacing="0" style="margin: 0 auto 15px auto;">
                <tr>
                  <td style="background-color: rgba(255,255,255,0.2); border: 1px solid rgba(255,255,255,0.3); border-radius: 25px; padding: 8px 20px;">
                    <span style="color: white; font-size: 14px; font-weight: bold;">🎉 WELCOME TO YOUR TIMELINE ✨</span>
                  </td>
                </tr>
              </table>
              
              <h1 style="color: white; margin: 10px 0; font-size: 28px; font-weight: bold; text-align: center;">Your Personal Property Journey Begins</h1>
              <p style="color: white; margin: 5px 0; font-size: 16px; font-weight: bold; text-align: center;">Curated by ${data.agentName}</p>
              <p style="color: rgba(255,255,255,0.9); margin: 5px 0 0 0; font-size: 14px; text-align: center;">${data.agentCompany}</p>
              
            </td>
          </tr>
          
          <!-- Welcome Message -->
          <tr>
            <td style="padding: 30px 20px; background-color: white;">
              <h2 style="color: #1e293b; font-size: 24px; font-weight: bold; margin: 0 0 20px 0; text-align: center;">Welcome ${firstName}! 🎉</h2>
              
              <p style="font-size: 16px; line-height: 1.6; margin: 0 0 25px 0; text-align: center; color: #475569;">
                I'm thrilled to introduce you to your personalized property timeline! I've handpicked <strong style="color: ${brandColor};">${data.propertyCount} exceptional properties</strong> that perfectly match your dream home criteria.
              </p>
              
              <!-- Property Count Highlight -->
              <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="margin: 20px 0;">
                <tr>
                  <td align="center" style="padding: 25px; background-color: ${brandColor}08; border: 2px solid ${brandColor}40; border-radius: 12px;">
                    
                    <!-- Property Count Circle -->
                    <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="60" height="60" style="margin: 0 auto 15px auto; background-color: ${brandColor}; border-radius: 30px;">
                      <tr><td align="center" style="color: white; font-size: 24px; font-weight: bold; line-height: 60px;">${data.propertyCount}</td></tr>
                    </table>
                    
                    <h3 style="color: #1e293b; margin: 0 0 10px 0; font-size: 18px; font-weight: bold; text-align: center;">Properties Waiting for You</h3>
                    <p style="margin: 0; color: #64748b; font-size: 14px; text-align: center;">Your home-buying journey starts here</p>
                    
                  </td>
                </tr>
              </table>
              
            </td>
          </tr>
          
          <!-- Getting Started Guide -->
          <tr>
            <td style="padding: 0 20px 30px 20px; background-color: white;">
              
              <!-- Getting Started Box -->
              <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="margin-bottom: 25px;">
                <tr>
                  <td style="background-color: #fef3c7; border: 2px solid #f59e0b; border-radius: 12px; padding: 25px;">
                    
                    <h3 style="color: #92400e; margin: 0 0 15px 0; font-size: 18px; font-weight: bold; text-align: center;">
                      🎯 Getting Started is Simple
                    </h3>
                    <p style="margin: 0 0 15px 0; color: #78350f; font-size: 16px; text-align: center;">
                      <strong>Your Login Details:</strong> Use your first name and last 4 digits of your phone number
                    </p>
                    
                    <!-- Login Details Box -->
                    <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: white; border: 1px solid #f59e0b; border-radius: 8px; margin: 15px 0;">
                      <tr><td style="padding: 15px; text-align: center;">
                        <div style="color: #92400e; font-size: 14px; margin-bottom: 5px;">👤 <strong>Username:</strong> ${firstName}</div>
                        <div style="color: #92400e; font-size: 14px;">🔢 <strong>Password:</strong> ${last4Digits}</div>
                      </td></tr>
                    </table>
                    
                  </td>
                </tr>
              </table>
              
              <!-- CTA Button -->
              <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%">
                <tr>
                  <td align="center" style="padding: 20px 0;">
                    <a href="${data.timelineUrl}" style="display: inline-block; background-color: ${brandColor}; color: white; padding: 18px 40px; border-radius: 8px; text-decoration: none; font-weight: bold; font-size: 16px;">
                      🏠 START YOUR PROPERTY JOURNEY →
                    </a>
                  </td>
                </tr>
                <tr>
                  <td align="center">
                    <p style="margin: 10px 0 0 0; color: #64748b; font-size: 14px; font-style: italic;">Click above to begin exploring your ${data.propertyCount} properties</p>
                  </td>
                </tr>
              </table>
              
            </td>
          </tr>
          
          <!-- Agent Footer -->
          <tr>
            <td style="background-color: #1e293b; border-top: 1px solid #334155; padding: 25px 20px; color: white;">
              
              <!-- Agent Info Row -->
              <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="margin-bottom: 20px;">
                <tr>
                  <td width="60" style="vertical-align: top;">
                    ${data.agentPhoto ? 
                      `<img src="${data.agentPhoto}" alt="${data.agentName}" width="50" height="50" style="border-radius: 8px; border: 2px solid ${brandColor};">` : 
                      `<table role="presentation" border="0" cellpadding="0" cellspacing="0" width="50" height="50" style="background-color: rgba(59, 130, 246, 0.2); border-radius: 8px; border: 2px solid ${brandColor};">
                        <tr><td align="center" style="color: ${brandColor}; font-size: 20px; line-height: 50px;">👤</td></tr>
                      </table>`
                    }
                  </td>
                  <td style="vertical-align: top; padding-left: 15px;">
                    <h3 style="margin: 0 0 5px 0; font-size: 16px; font-weight: bold; color: white;">${data.agentName} <span style="font-size: 10px; padding: 3px 8px; border-radius: 12px; background: rgba(59, 130, 246, 0.2); color: ${brandColor}; font-weight: bold;">⭐ REALTOR®</span></h3>
                    <p style="margin: 0; color: #94a3b8; font-size: 12px;">🏢 ${data.agentCompany}</p>
                  </td>
                </tr>
              </table>

              <p style="margin: 0 0 15px 0; color: #e2e8f0; font-size: 14px; font-weight: bold; font-style: italic; text-align: center;">Ready to discuss your dream home?</p>

              <!-- Contact Buttons -->
              <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="margin-bottom: 20px;">
                <tr>
                  <td align="center">
                    ${data.agentEmail ? `<a href="mailto:${data.agentEmail}" style="display: inline-block; margin: 0 5px; padding: 8px 15px; background-color: #3b82f6; color: white; text-decoration: none; font-size: 12px; font-weight: bold; border-radius: 6px;">📧 Email</a>` : ''}
                    ${data.agentPhone ? `<a href="tel:${data.agentPhone}" style="display: inline-block; margin: 0 5px; padding: 8px 15px; background-color: #16a34a; color: white; text-decoration: none; font-size: 12px; font-weight: bold; border-radius: 6px;">📱 Call</a>` : ''}
                  </td>
                </tr>
              </table>

              <!-- Company Logo Section -->
              <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="border-top: 1px solid rgba(255,255,255,0.1); padding-top: 20px;">
                <tr>
                  <td align="center">
                    ${data.companyLogo ? 
                      `<img src="${data.companyLogo}" alt="${data.agentCompany} Logo" style="max-width: 200px; height: auto; max-height: 60px; margin-bottom: 15px;">` : 
                      `<div style="margin-bottom: 15px; color: ${brandColor}; font-size: 18px; font-weight: bold;">🏢 ${data.agentCompany}</div>`
                    }
                    
                    <p style="margin: 0 0 5px 0; color: #94a3b8; font-size: 14px; font-weight: bold;">Powered by</p>
                    <div style="color: ${brandColor}; font-size: 16px; font-weight: bold;">🏠 Property Sync</div>
                    <p style="margin: 5px 0 0 0; color: #64748b; font-size: 11px; font-style: italic;">Your home-buying journey starts here</p>
                  </td>
                </tr>
              </table>
              
            </td>
          </tr>
          
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
  }

  /**
   * Modern Reminder Template
   */
  private getModernReminderTemplate(data: TimelineEmailData | EmailTemplateData, brandColor: string): string {
    const firstName = data.clientName.split(' ')[0];
    const newPropertyCount = 2; // This should be calculated based on actual new properties
    
    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>🏡 ${newPropertyCount} New Properties Added to Your Timeline</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
  </style>
</head>
<body style="font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #334155; max-width: 650px; margin: 0 auto; padding: 0; background: #f8fafc;">
  
  <!-- Header with Agent Photo -->
  <div style="background: linear-gradient(135deg, ${brandColor} 0%, #f97316 100%); padding: 25px 20px; text-align: center; border-radius: 16px 16px 0 0; position: relative; overflow: hidden;">
    <div style="position: absolute; top: -20px; right: -20px; width: 120px; height: 120px; background: rgba(255,255,255,0.1); border-radius: 50%;"></div>
    <div style="position: absolute; bottom: -30px; left: -30px; width: 80px; height: 80px; background: rgba(255,255,255,0.15); border-radius: 50%;"></div>
    
    <div style="position: relative; z-index: 10;">
      ${data.agentPhoto ? `<img src="${data.agentPhoto}" alt="${data.agentName}" style="width: 90px; height: 90px; border-radius: 12px; border: 3px solid white; margin-bottom: 20px; object-fit: cover; box-shadow: 0 8px 25px rgba(0,0,0,0.3);">` : `<div style="width: 90px; height: 90px; border-radius: 12px; border: 3px solid white; margin: 0 auto 20px; background: rgba(255,255,255,0.2); display: flex; align-items: center; justify-content: center; font-size: 36px; box-shadow: 0 8px 25px rgba(0,0,0,0.3);">🏠</div>`}
      
      <div style="background: rgba(255,255,255,0.2); backdrop-filter: blur(10px); border: 1px solid rgba(255,255,255,0.3); border-radius: 50px; display: inline-block; padding: 8px 20px; margin-bottom: 15px;">
        <span style="color: white; font-size: 14px; font-weight: 600; text-shadow: 0 1px 2px rgba(0,0,0,0.2);">🚨 NEW PROPERTIES ADDED 🚨</span>
      </div>
      
      <h1 style="color: white; margin: 0 0 8px 0; font-size: 32px; font-weight: 700; text-shadow: 0 2px 4px rgba(0,0,0,0.3);">${newPropertyCount} Fresh Properties for You</h1>
      <p style="color: rgba(255,255,255,0.95); margin: 0; font-size: 18px; font-weight: 500; text-shadow: 0 1px 2px rgba(0,0,0,0.2);">Updated by ${data.agentName}</p>
      <p style="color: rgba(255,255,255,0.8); margin: 5px 0 0 0; font-size: 15px;">${data.agentCompany}</p>
    </div>
  </div>
  
  <!-- Reminder Message -->
  <div style="background: white; padding: 25px 20px 20px 20px; box-shadow: 0 10px 25px rgba(0,0,0,0.08);">
    <h2 style="color: #1e293b; font-size: 24px; font-weight: 600; margin: 0 0 20px 0; text-align: center;">Hi ${firstName}! 🎯</h2>
    
    <p style="font-size: 17px; line-height: 1.8; margin: 0 0 25px 0; text-align: center; color: #475569;">
      Exciting news! I've added <strong style="color: #f97316; font-size: 18px;">${newPropertyCount} brand new properties</strong> to your timeline that I believe are perfect matches for your needs.
    </p>
    
    <!-- New Properties Highlight -->
    <div style="background: linear-gradient(135deg, #fff7ed 0%, #fed7aa 100%); border: 2px solid #f97316; border-radius: 16px; padding: 25px; text-align: center; margin: 25px 0; position: relative;">
      <div style="background: #f97316; color: white; font-size: 32px; font-weight: 700; width: 60px; height: 60px; border-radius: 50%; display: flex; align-items: center; justify-content: center; margin: 0 auto 15px; box-shadow: 0 4px 15px rgba(249, 115, 22, 0.4);">
        +${newPropertyCount}
      </div>
      <h3 style="color: #ea580c; margin: 0 0 10px 0; font-size: 20px; font-weight: 600;">New Properties Since Your Last Visit</h3>
      <p style="margin: 0; color: #c2410c; font-size: 15px;">Total properties: ${data.propertyCount} (${newPropertyCount} new)</p>
    </div>
    
    <!-- What's Changed -->
    <div style="background: #f0f9ff; border: 2px solid #0ea5e9; border-radius: 12px; padding: 20px; margin: 20px 0;">
      <h4 style="color: #0c4a6e; margin: 0 0 10px 0; font-size: 16px; font-weight: 600;">📋 What's Changed Since Last Email:</h4>
      <ul style="margin: 0; padding-left: 20px; color: #075985;">
        <li style="margin: 5px 0;">Added ${newPropertyCount} properties that match your updated criteria</li>
        <li style="margin: 5px 0;">Removed 1 property that went off the market</li>
        <li style="margin: 5px 0;">Updated pricing on 2 existing properties</li>
      </ul>
    </div>
  </div>

  <!-- CTA Section -->
  <div style="background: white; padding: 0 35px 35px 35px;">
    <div style="text-align: center; margin: 30px 0;">
      <a href="${data.timelineUrl}" style="display: inline-block; background: linear-gradient(135deg, #f97316 0%, #ea580c 100%); color: white; padding: 18px 40px; border-radius: 12px; text-decoration: none; font-weight: 600; font-size: 18px; box-shadow: 0 6px 20px rgba(249, 115, 22, 0.4); transition: all 0.3s ease;">
        🔥 SEE YOUR ${newPropertyCount} NEW PROPERTIES →
      </a>
      <p style="margin: 12px 0 0 0; color: #64748b; font-size: 14px; font-style: italic;">Fresh opportunities await your review</p>
    </div>
  </div>
  
  <!-- Agent Footer -->
  <div style="background: linear-gradient(45deg, #0f172a 0%, #1e293b 50%, #0f172a 100%); border-top: 1px solid #334155; padding: 25px 30px; color: white;">
    <div style="display: flex; align-items: center; margin-bottom: 20px;">
      <div style="position: relative; width: 50px; height: 50px; margin-right: 15px;">
        ${data.agentPhoto ? `<img src="${data.agentPhoto}" alt="${data.agentName}" style="width: 50px; height: 50px; border-radius: 8px; border: 2px solid #f97316; object-fit: cover;">` : `<div style="width: 50px; height: 50px; border-radius: 8px; border: 2px solid #f97316; background: rgba(249, 115, 22, 0.2); color: #f97316; display: flex; align-items: center; justify-content: center; font-size: 20px;">👤</div>`}
      </div>
      <div style="flex: 1; min-width: 0;">
        <div style="display: flex; align-items: center; margin-bottom: 5px;">
          <h3 style="margin: 0; margin-right: 10px; font-size: 16px; font-weight: 600; color: white;">${data.agentName}</h3>
          <span style="font-size: 10px; padding: 3px 8px; border-radius: 12px; background: rgba(249, 115, 22, 0.2); color: #f97316; font-weight: 600; letter-spacing: 0.5px;">⭐ REALTOR®</span>
        </div>
        <div style="display: flex; align-items: center;">
          <span style="font-size: 12px; color: #94a3b8; margin-right: 5px;">🏢</span>
          <p style="margin: 0; color: #94a3b8; font-size: 12px;">${data.agentCompany}</p>
        </div>
      </div>
    </div>

    <p style="margin: 0 0 15px 0; color: #e2e8f0; font-size: 14px; font-weight: 500; font-style: italic;">Questions about the new properties?</p>

    <div style="display: flex; gap: 10px; margin-bottom: 20px;">
      ${data.agentEmail ? `<a href="mailto:${data.agentEmail}" style="display: inline-flex; align-items: center; gap: 5px; padding: 8px 12px; background: #3b82f6; color: white; text-decoration: none; font-size: 12px; font-weight: 500; border-radius: 6px; border: none;">📧 <span>Email</span></a>` : ''}
      ${data.agentPhone ? `<a href="tel:${data.agentPhone}" style="display: inline-flex; align-items: center; gap: 5px; padding: 8px 12px; background: #16a34a; color: white; text-decoration: none; font-size: 12px; font-weight: 500; border-radius: 6px; border: none;">📱 <span>Call</span></a>` : ''}
    </div>

    <!-- Company Logo Section -->
    <div style="border-top: 1px solid rgba(255,255,255,0.1); padding-top: 20px; text-align: center;">
      ${data.companyLogo ? `
        <div style="margin-bottom: 15px;">
          <img src="${data.companyLogo}" alt="${data.agentCompany} Logo" style="max-width: 200px; height: auto; max-height: 60px; object-fit: contain;">
        </div>
      ` : `
        <div style="margin-bottom: 15px;">
          <div style="display: flex; align-items: center; justify-content: center; gap: 8px; color: #f97316; font-size: 18px; font-weight: 700;">
            🏢 <span>${data.agentCompany}</span>
          </div>
        </div>
      `}
      
      <p style="margin: 0 0 5px 0; color: #94a3b8; font-size: 14px; font-weight: 500;">Powered by</p>
      <div style="display: flex; align-items: center; justify-content: center; gap: 5px; color: #f97316; font-size: 16px; font-weight: 700;">
        🏠 <span>Property Sync</span>
      </div>
      <p style="margin: 5px 0 0 0; color: #64748b; font-size: 11px; font-style: italic;">Your property search, continuously updated</p>
    </div>
  </div>
</body>
</html>`;
  }

  /**
   * Classical Initial Welcome Template
   */
  private getClassicalInitialTemplate(data: TimelineEmailData | EmailTemplateData, brandColor: string): string {
    const firstName = data.clientName.split(' ')[0];
    const clientPhone = data.clientPhone || 'your phone number';
    const last4Digits = clientPhone.length >= 4 ? clientPhone.slice(-4) : '****';
    const classicalColor = brandColor || '#34495e';
    
    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>🏠 Welcome to Your Property Timeline - ${data.propertyCount} Properties Selected</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;700&family=Georgia:wght@400;600&display=swap');
  </style>
</head>
<body style="font-family: Georgia, 'Times New Roman', serif; line-height: 1.8; color: #2c3e50; max-width: 650px; margin: 0 auto; padding: 0; background: #f8f9fa;">
  
  <!-- Enhanced Header with Agent Photo -->
  <div style="background: linear-gradient(135deg, ${classicalColor} 0%, #2c3e50 100%); padding: 40px 30px; text-align: center; border-radius: 16px 16px 0 0; position: relative; overflow: hidden;">
    <!-- Decorative elements -->
    <div style="position: absolute; top: -30px; right: -30px; width: 120px; height: 120px; background: rgba(255,255,255,0.08); border-radius: 50%;"></div>
    <div style="position: absolute; bottom: -40px; left: -40px; width: 100px; height: 100px; background: rgba(255,255,255,0.05); border-radius: 50%;"></div>
    
    <div style="position: relative; z-index: 10;">
      ${data.agentPhoto ? `<img src="${data.agentPhoto}" alt="${data.agentName}" style="width: 90px; height: 90px; border-radius: 12px; border: 4px solid rgba(255,255,255,0.9); margin-bottom: 25px; object-fit: cover; box-shadow: 0 8px 25px rgba(0,0,0,0.4);">` : `<div style="width: 90px; height: 90px; border-radius: 12px; border: 4px solid rgba(255,255,255,0.9); margin: 0 auto 25px; background: rgba(255,255,255,0.1); display: flex; align-items: center; justify-content: center; font-size: 36px;">🏠</div>`}
      
      <!-- Welcome Badge -->
      <div style="background: rgba(255,255,255,0.15); backdrop-filter: blur(10px); border: 1px solid rgba(255,255,255,0.3); border-radius: 50px; display: inline-block; padding: 8px 20px; margin-bottom: 20px;">
        <span style="color: white; font-size: 14px; font-weight: 600; text-shadow: 0 1px 2px rgba(0,0,0,0.3); letter-spacing: 0.5px;">✨ WELCOME TO YOUR PROPERTY JOURNEY ✨</span>
      </div>
      
      <h1 style="color: #ecf0f1; margin: 0 0 10px 0; font-size: 36px; font-weight: 700; letter-spacing: 1px; text-shadow: 0 2px 4px rgba(0,0,0,0.4); font-family: 'Playfair Display', Georgia, serif;">Your Personal Property Timeline</h1>
      <p style="color: rgba(255,255,255,0.9); margin: 0; font-size: 18px; font-weight: 600; text-shadow: 0 1px 2px rgba(0,0,0,0.3);">Curated by ${data.agentName}</p>
      <p style="color: rgba(255,255,255,0.75); margin: 5px 0 0 0; font-size: 15px;">${data.agentCompany}</p>
    </div>
  </div>
  
  <!-- Welcome Message -->
  <div style="background: white; padding: 35px 30px; box-shadow: 0 4px 15px rgba(0,0,0,0.1);">
    <div style="text-align: center; margin-bottom: 30px;">
      <h2 style="color: #2c3e50; font-size: 28px; font-weight: 700; margin: 0 0 15px 0; letter-spacing: 0.5px; font-family: 'Playfair Display', Georgia, serif;">Welcome, Dear ${firstName},</h2>
      <div style="width: 80px; height: 3px; background: linear-gradient(135deg, ${classicalColor}, #2c3e50); margin: 0 auto; border-radius: 2px;"></div>
    </div>
    
    <p style="font-size: 18px; line-height: 1.9; margin: 0 0 30px 0; text-align: justify; text-indent: 35px; color: #34495e;">
      It is my distinct privilege and honor to welcome you to your personalized property journey. I have meticulously curated a selection of <strong style="color: ${classicalColor}; font-size: 19px;">${data.propertyCount} exceptional properties</strong> that embody the finest qualities and align perfectly with your distinguished tastes and specific requirements.
    </p>
    
    <p style="font-size: 17px; line-height: 1.8; margin: 0 0 30px 0; text-align: justify; color: #5a6c7d; font-style: italic;">
      Each residence has been thoughtfully selected to offer not merely a home, but a sanctuary where your dreams may flourish and your lifestyle aspirations can be fully realized.
    </p>
    
    <!-- Property Count Highlight -->
    <div style="background: linear-gradient(135deg, ${classicalColor}10 0%, #2c3e5010 100%); border: 2px solid ${classicalColor}30; border-radius: 16px; padding: 30px; text-align: center; margin: 30px 0; position: relative;">
      <div style="background: ${classicalColor}; color: white; font-size: 28px; font-weight: 700; width: 70px; height: 70px; border-radius: 12px; display: flex; align-items: center; justify-content: center; margin: 0 auto 20px; box-shadow: 0 6px 20px ${classicalColor}40; font-family: 'Playfair Display', Georgia, serif;">
        ${data.propertyCount}
      </div>
      <h3 style="color: #2c3e50; margin: 0 0 12px 0; font-size: 22px; font-weight: 700; font-family: 'Playfair Display', Georgia, serif;">Exceptional Properties Await</h3>
      <p style="margin: 0; color: #5a6c7d; font-size: 16px; font-style: italic;">Your home-buying journey begins with distinction</p>
    </div>
  </div>

  <!-- Access Instructions -->
  <div style="background: white; padding: 0 35px 35px 35px;">
    <div style="background: #fff8e1; border: 2px solid #ffa726; border-radius: 12px; padding: 25px; margin-bottom: 25px;">
      <h3 style="color: #e65100; margin: 0 0 15px 0; font-size: 20px; font-weight: 700; display: flex; align-items: center; font-family: 'Playfair Display', Georgia, serif;">
        🔑 <span style="margin-left: 10px;">Your Personal Access Details</span>
      </h3>
      <p style="margin: 0 0 15px 0; color: #ef6c00; font-size: 17px; line-height: 1.6;">
        To ensure the privacy and security of your property selection, please use the following credentials:
      </p>
      <div style="background: white; border: 2px solid #ffb74d; border-radius: 8px; padding: 18px; font-family: Georgia, serif;">
        <div style="color: #e65100; font-size: 15px; margin-bottom: 8px; font-weight: 600;">👤 <strong>Username:</strong> ${firstName}</div>
        <div style="color: #e65100; font-size: 15px; font-weight: 600;">🔢 <strong>Password:</strong> ${last4Digits}</div>
      </div>
    </div>

    <!-- CTA Button -->
    <div style="text-align: center; margin: 35px 0;">
      <a href="${data.timelineUrl}" style="display: inline-block; background: linear-gradient(135deg, ${classicalColor} 0%, #2c3e50 100%); color: white; padding: 20px 50px; border-radius: 12px; text-decoration: none; font-weight: 700; font-size: 18px; box-shadow: 0 8px 25px ${classicalColor}50; border: 3px solid transparent; letter-spacing: 0.5px; font-family: 'Playfair Display', Georgia, serif;">
        🏠 BEGIN YOUR PROPERTY JOURNEY
      </a>
      <p style="margin: 15px 0 0 0; color: #6b7280; font-size: 14px; font-style: italic;">Click above to commence your personalized property review</p>
    </div>
  </div>
  
  <!-- Agent Footer -->
  <div style="background: linear-gradient(45deg, #0f172a 0%, #1e293b 50%, #0f172a 100%); border-top: 1px solid #334155; padding: 25px 30px; color: white;">
    <div style="display: flex; align-items: center; margin-bottom: 20px;">
      <div style="position: relative; width: 50px; height: 50px; margin-right: 15px;">
        ${data.agentPhoto ? `<img src="${data.agentPhoto}" alt="${data.agentName}" style="width: 50px; height: 50px; border-radius: 8px; border: 2px solid ${classicalColor}; object-fit: cover;">` : `<div style="width: 50px; height: 50px; border-radius: 8px; border: 2px solid ${classicalColor}; background: ${classicalColor}20; color: ${classicalColor}; display: flex; align-items: center; justify-content: center; font-size: 20px;">👤</div>`}
      </div>
      <div style="flex: 1; min-width: 0;">
        <div style="display: flex; align-items: center; margin-bottom: 5px;">
          <h3 style="margin: 0; margin-right: 10px; font-size: 16px; font-weight: 600; color: white; font-family: 'Playfair Display', Georgia, serif;">${data.agentName}</h3>
          <span style="font-size: 10px; padding: 3px 8px; border-radius: 12px; background: ${classicalColor}20; color: ${classicalColor}; font-weight: 600; letter-spacing: 0.5px;">⭐ REALTOR®</span>
        </div>
        <div style="display: flex; align-items: center;">
          <span style="font-size: 12px; color: #94a3b8; margin-right: 5px;">🏢</span>
          <p style="margin: 0; color: #94a3b8; font-size: 12px;">${data.agentCompany}</p>
        </div>
      </div>
    </div>

    <p style="margin: 0 0 15px 0; color: #e2e8f0; font-size: 14px; font-weight: 500; font-style: italic;">I remain at your distinguished service for any inquiries.</p>

    <div style="display: flex; gap: 10px; margin-bottom: 20px;">
      ${data.agentEmail ? `<a href="mailto:${data.agentEmail}" style="display: inline-flex; align-items: center; gap: 5px; padding: 8px 12px; background: #3b82f6; color: white; text-decoration: none; font-size: 12px; font-weight: 500; border-radius: 6px; border: none;">📧 <span>Email</span></a>` : ''}
      ${data.agentPhone ? `<a href="tel:${data.agentPhone}" style="display: inline-flex; align-items: center; gap: 5px; padding: 8px 12px; background: #16a34a; color: white; text-decoration: none; font-size: 12px; font-weight: 500; border-radius: 6px; border: none;">📱 <span>Call</span></a>` : ''}
    </div>

    <!-- Company Logo Section -->
    <div style="border-top: 1px solid rgba(255,255,255,0.1); padding-top: 20px; text-align: center;">
      ${data.companyLogo ? `
        <div style="margin-bottom: 15px;">
          <img src="${data.companyLogo}" alt="${data.agentCompany} Logo" style="max-width: 200px; height: auto; max-height: 60px; object-fit: contain;">
        </div>
      ` : `
        <div style="margin-bottom: 15px;">
          <div style="display: flex; align-items: center; justify-content: center; gap: 8px; color: ${classicalColor}; font-size: 18px; font-weight: 700; font-family: 'Playfair Display', Georgia, serif;">
            🏢 <span>${data.agentCompany}</span>
          </div>
        </div>
      `}
      
      <p style="margin: 0 0 5px 0; color: #94a3b8; font-size: 14px; font-weight: 500;">Powered by</p>
      <div style="display: flex; align-items: center; justify-content: center; gap: 5px; color: ${classicalColor}; font-size: 16px; font-weight: 700; font-family: 'Playfair Display', Georgia, serif;">
        🏠 <span>Property Sync</span>
      </div>
      <p style="margin: 5px 0 0 0; color: #64748b; font-size: 11px; font-style: italic;">Where distinguished service meets exceptional properties</p>
    </div>
  </div>
</body>
</html>`;
  }

  /**
   * Classical Reminder Template
   */
  private getClassicalReminderTemplate(data: TimelineEmailData | EmailTemplateData, brandColor: string): string {
    const firstName = data.clientName.split(' ')[0];
    const newPropertyCount = 2; // This should be calculated based on actual new properties
    const classicalColor = brandColor || '#34495e';
    
    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>🏠 ${newPropertyCount} Distinguished Properties Added to Your Timeline</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;700&family=Georgia:wght@400;600&display=swap');
  </style>
</head>
<body style="font-family: Georgia, 'Times New Roman', serif; line-height: 1.8; color: #2c3e50; max-width: 650px; margin: 0 auto; padding: 0; background: #f8f9fa;">
  
  <!-- Enhanced Header with Agent Photo -->
  <div style="background: linear-gradient(135deg, ${classicalColor} 0%, #8b4513 100%); padding: 40px 30px; text-align: center; border-radius: 16px 16px 0 0; position: relative; overflow: hidden;">
    <div style="position: absolute; top: -30px; right: -30px; width: 120px; height: 120px; background: rgba(255,255,255,0.08); border-radius: 50%;"></div>
    <div style="position: absolute; bottom: -40px; left: -40px; width: 100px; height: 100px; background: rgba(255,255,255,0.05); border-radius: 50%;"></div>
    
    <div style="position: relative; z-index: 10;">
      ${data.agentPhoto ? `<img src="${data.agentPhoto}" alt="${data.agentName}" style="width: 90px; height: 90px; border-radius: 12px; border: 4px solid rgba(255,255,255,0.9); margin-bottom: 25px; object-fit: cover; box-shadow: 0 8px 25px rgba(0,0,0,0.4);">` : `<div style="width: 90px; height: 90px; border-radius: 12px; border: 4px solid rgba(255,255,255,0.9); margin: 0 auto 25px; background: rgba(255,255,255,0.1); display: flex; align-items: center; justify-content: center; font-size: 36px;">🏠</div>`}
      
      <!-- Update Badge -->
      <div style="background: rgba(255,255,255,0.15); backdrop-filter: blur(10px); border: 1px solid rgba(255,255,255,0.3); border-radius: 50px; display: inline-block; padding: 8px 20px; margin-bottom: 20px;">
        <span style="color: white; font-size: 14px; font-weight: 600; text-shadow: 0 1px 2px rgba(0,0,0,0.3); letter-spacing: 0.5px;">📋 TIMELINE UPDATE AVAILABLE 📋</span>
      </div>
      
      <h1 style="color: #ecf0f1; margin: 0 0 10px 0; font-size: 36px; font-weight: 700; letter-spacing: 1px; text-shadow: 0 2px 4px rgba(0,0,0,0.4); font-family: 'Playfair Display', Georgia, serif;">${newPropertyCount} Distinguished Properties Added</h1>
      <p style="color: rgba(255,255,255,0.9); margin: 0; font-size: 18px; font-weight: 600; text-shadow: 0 1px 2px rgba(0,0,0,0.3);">Curated by ${data.agentName}</p>
      <p style="color: rgba(255,255,255,0.75); margin: 5px 0 0 0; font-size: 15px;">${data.agentCompany}</p>
    </div>
  </div>
  
  <!-- Update Message -->
  <div style="background: white; padding: 35px 30px; box-shadow: 0 4px 15px rgba(0,0,0,0.1);">
    <div style="text-align: center; margin-bottom: 30px;">
      <h2 style="color: #2c3e50; font-size: 28px; font-weight: 700; margin: 0 0 15px 0; letter-spacing: 0.5px; font-family: 'Playfair Display', Georgia, serif;">Dear ${firstName},</h2>
      <div style="width: 80px; height: 3px; background: linear-gradient(135deg, ${classicalColor}, #8b4513); margin: 0 auto; border-radius: 2px;"></div>
    </div>
    
    <p style="font-size: 18px; line-height: 1.9; margin: 0 0 30px 0; text-align: justify; text-indent: 35px; color: #34495e;">
      I am pleased to inform you that I have identified <strong style="color: #8b4513; font-size: 19px;">${newPropertyCount} additional distinguished properties</strong> that warrant your consideration. These exceptional residences have been carefully selected to complement your existing timeline and align with your refined preferences.
    </p>
    
    <!-- New Properties Highlight -->
    <div style="background: linear-gradient(135deg, #fef3c7 0%, #fcd34d 100%); border: 2px solid #8b4513; border-radius: 16px; padding: 30px; text-align: center; margin: 30px 0; position: relative;">
      <div style="background: #8b4513; color: white; font-size: 28px; font-weight: 700; width: 70px; height: 70px; border-radius: 12px; display: flex; align-items: center; justify-content: center; margin: 0 auto 20px; box-shadow: 0 6px 20px rgba(139, 69, 19, 0.4); font-family: 'Playfair Display', Georgia, serif;">
        +${newPropertyCount}
      </div>
      <h3 style="color: #8b4513; margin: 0 0 12px 0; font-size: 22px; font-weight: 700; font-family: 'Playfair Display', Georgia, serif;">New Additions to Your Timeline</h3>
      <p style="margin: 0; color: #a16207; font-size: 16px; font-style: italic;">Total curated properties: ${data.propertyCount} (${newPropertyCount} newly added)</p>
    </div>
    
    <!-- What's Changed -->
    <div style="background: #f0f9ff; border: 2px solid #0ea5e9; border-radius: 12px; padding: 25px; margin: 25px 0;">
      <h4 style="color: #0c4a6e; margin: 0 0 15px 0; font-size: 18px; font-weight: 700; font-family: 'Playfair Display', Georgia, serif;">📋 Recent Timeline Updates:</h4>
      <ul style="margin: 0; padding-left: 25px; color: #075985; font-size: 16px; line-height: 1.7;">
        <li style="margin: 8px 0;">Added ${newPropertyCount} exceptional properties that meet your updated criteria</li>
        <li style="margin: 8px 0;">Removed one property that is no longer available on the market</li>
        <li style="margin: 8px 0;">Updated pricing information for two existing properties in your timeline</li>
      </ul>
    </div>
  </div>

  <!-- CTA Section -->
  <div style="background: white; padding: 0 35px 35px 35px;">
    <div style="text-align: center; margin: 35px 0;">
      <a href="${data.timelineUrl}" style="display: inline-block; background: linear-gradient(135deg, #8b4513 0%, #a16207 100%); color: white; padding: 20px 50px; border-radius: 12px; text-decoration: none; font-weight: 700; font-size: 18px; box-shadow: 0 8px 25px rgba(139, 69, 19, 0.5); border: 3px solid transparent; letter-spacing: 0.5px; font-family: 'Playfair Display', Georgia, serif;">
        🏛️ REVIEW YOUR UPDATED TIMELINE
      </a>
      <p style="margin: 15px 0 0 0; color: #6b7280; font-size: 14px; font-style: italic;">Click above to examine your newly added properties</p>
    </div>
  </div>
  
  <!-- Agent Footer -->
  <div style="background: linear-gradient(45deg, #0f172a 0%, #1e293b 50%, #0f172a 100%); border-top: 1px solid #334155; padding: 25px 30px; color: white;">
    <div style="display: flex; align-items: center; margin-bottom: 20px;">
      <div style="position: relative; width: 50px; height: 50px; margin-right: 15px;">
        ${data.agentPhoto ? `<img src="${data.agentPhoto}" alt="${data.agentName}" style="width: 50px; height: 50px; border-radius: 8px; border: 2px solid #8b4513; object-fit: cover;">` : `<div style="width: 50px; height: 50px; border-radius: 8px; border: 2px solid #8b4513; background: rgba(139, 69, 19, 0.2); color: #8b4513; display: flex; align-items: center; justify-content: center; font-size: 20px;">👤</div>`}
      </div>
      <div style="flex: 1; min-width: 0;">
        <div style="display: flex; align-items: center; margin-bottom: 5px;">
          <h3 style="margin: 0; margin-right: 10px; font-size: 16px; font-weight: 600; color: white; font-family: 'Playfair Display', Georgia, serif;">${data.agentName}</h3>
          <span style="font-size: 10px; padding: 3px 8px; border-radius: 12px; background: rgba(139, 69, 19, 0.2); color: #8b4513; font-weight: 600; letter-spacing: 0.5px;">⭐ REALTOR®</span>
        </div>
        <div style="display: flex; align-items: center;">
          <span style="font-size: 12px; color: #94a3b8; margin-right: 5px;">🏢</span>
          <p style="margin: 0; color: #94a3b8; font-size: 12px;">${data.agentCompany}</p>
        </div>
      </div>
    </div>

    <p style="margin: 0 0 15px 0; color: #e2e8f0; font-size: 14px; font-weight: 500; font-style: italic;">I remain available to discuss these new opportunities at your convenience.</p>

    <div style="display: flex; gap: 10px; margin-bottom: 20px;">
      ${data.agentEmail ? `<a href="mailto:${data.agentEmail}" style="display: inline-flex; align-items: center; gap: 5px; padding: 8px 12px; background: #3b82f6; color: white; text-decoration: none; font-size: 12px; font-weight: 500; border-radius: 6px; border: none;">📧 <span>Email</span></a>` : ''}
      ${data.agentPhone ? `<a href="tel:${data.agentPhone}" style="display: inline-flex; align-items: center; gap: 5px; padding: 8px 12px; background: #16a34a; color: white; text-decoration: none; font-size: 12px; font-weight: 500; border-radius: 6px; border: none;">📱 <span>Call</span></a>` : ''}
    </div>

    <!-- Company Logo Section -->
    <div style="border-top: 1px solid rgba(255,255,255,0.1); padding-top: 20px; text-align: center;">
      ${data.companyLogo ? `
        <div style="margin-bottom: 15px;">
          <img src="${data.companyLogo}" alt="${data.agentCompany} Logo" style="max-width: 200px; height: auto; max-height: 60px; object-fit: contain;">
        </div>
      ` : `
        <div style="margin-bottom: 15px;">
          <div style="display: flex; align-items: center; justify-content: center; gap: 8px; color: #8b4513; font-size: 18px; font-weight: 700; font-family: 'Playfair Display', Georgia, serif;">
            🏢 <span>${data.agentCompany}</span>
          </div>
        </div>
      `}
      
      <p style="margin: 0 0 5px 0; color: #94a3b8; font-size: 14px; font-weight: 500;">Powered by</p>
      <div style="display: flex; align-items: center; justify-content: center; gap: 5px; color: #8b4513; font-size: 16px; font-weight: 700; font-family: 'Playfair Display', Georgia, serif;">
        🏠 <span>Property Sync</span>
      </div>
      <p style="margin: 5px 0 0 0; color: #64748b; font-size: 11px; font-style: italic;">Continuously curating exceptional properties for discerning clients</p>
    </div>
  </div>
</body>
</html>`;
  }
}