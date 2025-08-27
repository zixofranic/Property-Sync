# Property Sync Email System Documentation

## Overview
This document serves as a comprehensive reference for the Property Sync email template system for future developers and Claude AI instances. The system was consolidated and optimized to eliminate duplication and provide a single source of truth for all email templates.

## System Architecture

### Core Components

1. **EmailTemplateService** (`api/src/email/template.service.ts`)
   - Central template management service
   - Single source of truth for all email templates
   - Provides 4 distinct template variations
   - Handles both initial welcome and reminder emails

2. **EmailService** (`api/src/email/email.service.ts`)
   - Main email orchestration service
   - Handles dual provider system (Resend + Nodemailer fallback)
   - Uses EmailTemplateService for template generation

3. **ResendProvider** (`api/src/email/resend.provider.ts`)
   - Primary email delivery provider
   - Uses EmailTemplateService for template generation
   - Handles development email redirection

4. **EmailModule** (`api/src/email/email.module.ts`)
   - NestJS module configuration
   - Dependency injection setup

## Email Template Variations

The system supports 4 distinct email template combinations:

### 1. Modern Initial Welcome Email
- **Purpose**: First-time timeline sharing
- **Design**: Inter font family, modern gradients, clean UI
- **Key Features**:
  - Welcome messaging: "Your Personal Property Journey Begins"
  - Getting started guide
  - Property count highlighting
  - Agent photo in header (90px)
  - Company logo in footer (200px max-width, 60px max-height)

### 2. Modern Reminder Email  
- **Purpose**: Follow-up when new properties are added
- **Design**: Inter font family, orange accent colors
- **Key Features**:
  - Update messaging: "Property Timeline Updates"
  - New property highlighting
  - Continued engagement focus
  - Agent photo in header (90px)
  - Company logo in footer (200px max-width, 60px max-height)

### 3. Classical Initial Welcome Email
- **Purpose**: First-time timeline sharing (traditional style)
- **Design**: Playfair Display + Georgia fonts, formal typography
- **Key Features**:
  - Formal greeting: "Dear [Client Name]"
  - Traditional design elements
  - Distinguished styling
  - Agent photo in header (90px)
  - Company logo in footer (200px max-width, 60px max-height)

### 4. Classical Reminder Email
- **Purpose**: Follow-up when new properties are added (traditional style)
- **Design**: Playfair Display + Georgia fonts, formal language
- **Key Features**:
  - Formal update language
  - Traditional serif typography
  - Classical color schemes
  - Agent photo in header (90px)
  - Company logo in footer (200px max-width, 60px max-height)

## Email Template Structure

### Header Section
- **Agent Photo**: 90px x 90px, rounded corners, white border
- **Decorative Elements**: Subtle gradient overlays and floating shapes
- **Brand Colors**: Dynamic based on agent's brand color preference
- **Property Count Badge**: Prominent display of selected properties

### Body Content
- **Welcome/Update Message**: Personalized greeting with client's first name
- **Property Highlights**: Visual emphasis on property count and selection
- **Login Instructions**: Username (first name) and password (last 4 phone digits)
- **Call-to-Action Button**: Large, prominent timeline access button

### Footer Section
- **Agent Information**: 50px x 50px agent photo, name, and REALTOR® badge
- **Contact Options**: Email and phone buttons when available
- **Company Logo**: 200px max-width, 60px max-height, centered
  - Fallback: Company name with building emoji if no logo provided
- **Property Sync Branding**: Consistent across all templates

## Data Structure

### EmailTemplateData Interface
```typescript
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
  agentPhoto?: string;           // Agent profile photo URL
  companyLogo?: string;          // Company logo URL (200px max-width)
  brandColor?: string;           // Agent's brand color (hex)
  templateStyle?: 'modern' | 'classical';
}
```

### TimelineEmailData Interface
```typescript
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
  agentPhoto?: string;           // Agent profile photo URL
  companyLogo?: string;          // Company logo URL (200px max-width)
  brandColor?: string;           // Agent's brand color (hex)
  templateStyle?: 'modern' | 'classical';
  emailType?: 'initial' | 'reminder';
}
```

## Key Features

### Agent Photo Implementation
- **Header**: 90px x 90px circular image with white border and shadow
- **Footer**: 50px x 50px rounded image with brand color border
- **Fallback**: House emoji (🏠) or person emoji (👤) when no photo available
- **Source**: `agentProfile?.logo` from agent profile data

### Company Logo Implementation
- **Location**: Footer section, center-aligned
- **Dimensions**: 200px max-width, 60px max-height
- **Styling**: `object-fit: contain` to maintain aspect ratio
- **Fallback**: Company name with building emoji (🏢) when no logo provided
- **Source**: `agentProfile?.companyLogo` from agent profile data

### Email Type Logic
- **Initial Email**: Sent when `timeline.initialEmailSent = false`
- **Reminder Email**: Sent when `timeline.initialEmailSent = true` and new properties added
- **Auto-Detection**: System automatically determines email type based on timeline state

### Template Style Selection
1. **Agent Preference**: `agentProfile?.emailTemplateStyle`
2. **Email Options**: Override via `emailOptions?.templateStyle`
3. **Default**: 'modern' if no preference set

## File Structure

```
api/src/email/
├── email.module.ts          # NestJS module configuration
├── email.service.ts         # Main email service (uses templates)
├── resend.provider.ts       # Resend email provider (uses templates)
└── template.service.ts      # ⭐ SINGLE SOURCE OF TRUTH for all templates

web/src/app/
└── email-preview/
    └── page.tsx             # Template preview page for testing
```

## Integration Points

### TimelinesService Integration
```typescript
// In TimelinesService.sendTimelineEmail()
const emailResult = await this.emailService.sendTimelineEmail({
  // ... other data
  agentPhoto: agentProfile?.logo || undefined,
  companyLogo: agentProfile?.companyLogo || undefined,
  brandColor: agentProfile?.brandColor || '#3b82f6',
  templateStyle: templateStyle,
  emailType: emailType,  // 'initial' or 'reminder'
});
```

### Agent Profile Requirements
For optimal email rendering, agent profiles should include:
- `firstName` and `lastName`
- `company` name
- `logo` (agent photo URL)
- `companyLogo` (company logo URL, 200px recommended width)
- `brandColor` (hex color code)
- `emailTemplateStyle` ('modern' or 'classical')
- `email` and `phone` for contact buttons

## Development & Testing

### Email Preview Page
- **URL**: `/email-preview`
- **Purpose**: Test all 4 template variations with real agent data
- **Features**:
  - Live template switching
  - Real agent data when logged in
  - Default mock data for testing
  - Responsive design preview

### Template Modification Process
1. **Single File Edit**: All changes go to `template.service.ts`
2. **Method Structure**: 
   - `getModernInitialTemplate()`
   - `getModernReminderTemplate()`
   - `getClassicalInitialTemplate()`
   - `getClassicalReminderTemplate()`
3. **Testing**: Use email preview page to verify changes
4. **Deployment**: Changes automatically apply to all email providers

## Technical Implementation Details

### Dependency Injection
```typescript
// EmailService constructor
constructor(
  private configService: ConfigService,
  private resendProvider: ResendProvider,
  private templateService: EmailTemplateService,  // ⭐ Shared templates
) {}

// ResendProvider constructor  
constructor(
  private configService: ConfigService,
  private templateService: EmailTemplateService,  // ⭐ Shared templates
) {}
```

### Template Generation
```typescript
// All providers use this centralized method
const html = this.templateService.getTimelineTemplate(
  data,                    // EmailTemplateData
  emailType,              // 'initial' | 'reminder'  
  templateStyle           // 'modern' | 'classical'
);
```

### Email Type Detection
```typescript
// Automatic email type determination
const emailType = emailOptions?.emailType || 
  (timeline.initialEmailSent ? 'reminder' : 'initial');
```

## CSS & Styling

### Design System
- **Modern Templates**: Inter font family, clean gradients, bright colors
- **Classical Templates**: Playfair Display + Georgia fonts, formal styling
- **Responsive**: All templates work on mobile and desktop
- **Brand Integration**: Dynamic brand colors throughout templates

### Key Measurements
- **Email Width**: 650px max-width
- **Agent Header Photo**: 90px x 90px
- **Agent Footer Photo**: 50px x 50px  
- **Company Logo**: 200px max-width, 60px max-height
- **CTA Buttons**: 18px padding vertical, 40px horizontal

## Performance & Reliability

### Dual Provider System
1. **Primary**: Resend provider for production emails
2. **Fallback**: Nodemailer for development and backup
3. **Error Handling**: Automatic fallback on Resend failures
4. **Development Mode**: Email redirection to test addresses

### Template Caching
- **No Caching**: Templates generated fresh for each email
- **Dynamic Data**: All agent and client data injected at runtime
- **Personalization**: Every email fully personalized per recipient

## Migration Notes

### What Was Changed
1. **Before**: 3+ duplicate template versions across different services
2. **After**: 1 centralized template service with 4 distinct variations
3. **Eliminated**: 300+ lines of duplicate HTML template code
4. **Added**: Company logo support with 200px width specification
5. **Enhanced**: Proper agent photo handling in header and footer

### Backward Compatibility
- All existing email sending methods continue to work
- Agent profile data structure remains the same
- Template switching logic preserved
- Email type detection automatic

## Future Enhancements

### Potential Improvements
1. **Template Builder**: Visual template editor for agents
2. **A/B Testing**: Template performance analytics  
3. **More Styles**: Additional template variations beyond modern/classical
4. **Dynamic Branding**: More sophisticated brand color theming
5. **Email Analytics**: Open rates, click tracking, engagement metrics

### Maintenance Guidelines
1. **Single File Updates**: Only modify `template.service.ts` for template changes
2. **Test All Variations**: Use email preview page to verify changes
3. **Preserve Structure**: Maintain header/body/footer organization
4. **Brand Consistency**: Ensure all templates support dynamic brand colors
5. **Mobile Compatibility**: Test templates on various screen sizes

---

## Quick Reference

### Adding New Template Variations
1. Add new method to `EmailTemplateService`
2. Update the `getTimelineTemplate()` switch statement  
3. Test in email preview page
4. Update this documentation

### Debugging Email Issues
1. Check email preview page first
2. Verify agent profile has required fields
3. Check server logs for template generation errors
4. Test with both modern and classical styles
5. Verify company logo URL accessibility

### Emergency Template Rollback
If templates break, the system can fall back to text-only emails by:
1. Commenting out HTML template generation
2. Using the `generateTimelineEmailText()` method  
3. Sending plain text emails while fixing HTML issues

---

*Last Updated: August 27, 2025*
*System Version: Property Sync v2.0 - Email Template Consolidation*