import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  X, Share2, Copy, Check, MessageSquare, Mail, 
  Phone, Link as LinkIcon, ExternalLink, Send,
  Sparkles, Users, Settings, AlertCircle, Loader
} from 'lucide-react';
import { EmailTemplateSelector } from './EmailTemplateSelector';

interface EmailState {
  canSendInitial: boolean;
  canSendReminder: boolean;
  propertyCount: number;
  newPropertyCount: number;
  lastEmailDate?: string;
  lastEmailPropertyCount: number;
  initialEmailSent: boolean;
}

interface ShareTimelineModalProps {
  isOpen: boolean;
  onClose: () => void;
  client: {
    id: string;
    name: string;
    email: string;
    phone?: string;
  };
  timeline: {
    id: string;
    shareToken: string;
    shareUrl: string;
    propertyCount: number;
  };
  agentName: string;
  onSendEmail: (templateOverride?: 'modern' | 'classical', emailType?: 'initial' | 'reminder') => Promise<void>;
  initialTemplate?: 'modern' | 'classical';
  emailState?: EmailState;
}

export function ShareTimelineModal({ 
  isOpen, 
  onClose, 
  client, 
  timeline, 
  agentName,
  onSendEmail,
  initialTemplate = 'modern',
  emailState
}: ShareTimelineModalProps) {
  const [copiedItem, setCopiedItem] = useState<string | null>(null);
  const [isEmailSending, setIsEmailSending] = useState(false);
  const [emailError, setEmailError] = useState<string | null>(null);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<'modern' | 'classical'>(initialTemplate);
  const [showTemplateSelector, setShowTemplateSelector] = useState(false);

  // Smart email logic
  const getEmailType = (): 'initial' | 'reminder' => {
    if (!emailState) return 'initial';
    return emailState.initialEmailSent ? 'reminder' : 'initial';
  };

  const getEmailButtonText = (): string => {
    if (!emailState || timeline.propertyCount === 0) return 'Send Email';
    
    const emailType = getEmailType();
    if (emailType === 'initial') {
      return `Send Initial Email (${timeline.propertyCount} properties)`;
    } else {
      return `Send Reminder (${emailState.newPropertyCount} new properties)`;
    }
  };

  const getEmailButtonDisabled = (): boolean => {
    if (isEmailSending) return true;
    if (!emailState) return timeline.propertyCount === 0;
    return !emailState.canSendInitial && !emailState.canSendReminder;
  };

  const formatLastEmailDate = (dateString?: string): string => {
    if (!dateString) return 'Never sent';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const shareMessages = {
    email: {
      subject: `Your Property Timeline from ${agentName}`,
      body: `Hi ${client.name}!\n\n${agentName} has created a personalized property timeline just for you with ${timeline.propertyCount} carefully selected properties.\n\nView your timeline here: ${timeline.shareUrl}\n\nYou can browse each property at your own pace and leave feedback using the Love It, Let's Talk, or Not for Me buttons.\n\nBest regards,\n${agentName}`
    },
    sms: `Hi ${client.name}! ${agentName} here. I've created your property timeline with ${timeline.propertyCount} properties that match your criteria. Check it out: ${timeline.shareUrl}`,
    whatsapp: `Hi ${client.name}! 🏡\n\nI've created a personalized property timeline just for you with ${timeline.propertyCount} carefully selected properties.\n\n🔗 View your timeline: ${timeline.shareUrl}\n\nBrowse at your own pace and let me know what you think!\n\nBest,\n${agentName}`,
    simple: timeline.shareUrl
  };

  const copyToClipboard = async (text: string, itemKey: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedItem(itemKey);
      setTimeout(() => setCopiedItem(null), 2000);
    } catch (error) {
      console.error('Failed to copy to clipboard:', error);
    }
  };

  const handleSendEmail = async () => {
    setShowConfirmation(true);
  };

  const confirmSendEmail = async () => {
    setIsEmailSending(true);
    setEmailError(null);
    
    try {
      const emailType = getEmailType();
      await onSendEmail(selectedTemplate, emailType);
      setCopiedItem('email-sent');
      setShowConfirmation(false);
      setTimeout(() => setCopiedItem(null), 3000);
    } catch (error) {
      console.error('Failed to send email:', error);
      setEmailError(error instanceof Error ? error.message : 'Failed to send email');
    } finally {
      setIsEmailSending(false);
    }
  };

  const openEmailClient = () => {
    const mailtoLink = `mailto:${client.email}?subject=${encodeURIComponent(shareMessages.email.subject)}&body=${encodeURIComponent(shareMessages.email.body)}`;
    window.open(mailtoLink, '_blank');
  };

  const openSMSClient = () => {
    if (client.phone) {
      const smsLink = `sms:${client.phone}?body=${encodeURIComponent(shareMessages.sms)}`;
      window.open(smsLink, '_blank');
    }
  };

  const openWhatsApp = () => {
    if (client.phone) {
      const cleanPhone = client.phone.replace(/[^\d]/g, '');
      const whatsappLink = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(shareMessages.whatsapp)}`;
      window.open(whatsappLink, '_blank');
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/50 backdrop-blur-xl z-50 flex items-start justify-center pt-16 px-4"
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            className="bg-slate-800/90 backdrop-blur-sm border border-slate-700 rounded-2xl w-full max-w-4xl h-[80vh] flex flex-col shadow-2xl"
            onClick={e => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-slate-700">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 bg-gradient-to-br from-green-500 to-emerald-600 rounded-full flex items-center justify-center">
                  <Share2 className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-white">Share Timeline</h2>
                  <p className="text-sm text-slate-400">Send timeline to {client.name}</p>
                </div>
              </div>
              
              <button
                onClick={onClose}
                className="p-2 hover:bg-slate-700 rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-slate-400" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-6 scroll-smooth">
              {/* Timeline Info */}
              <div className="bg-slate-700/30 rounded-xl p-4 border border-slate-600/30">
                <div className="flex items-center space-x-3 mb-3">
                  <Users className="w-5 h-5 text-blue-400" />
                  <h3 className="font-medium text-white">Timeline Details</h3>
                </div>
                <div className="grid grid-cols-2 gap-4 text-sm mb-4">
                  <div>
                    <span className="text-slate-400">Properties:</span>
                    <p className="text-white font-medium">{timeline.propertyCount}</p>
                  </div>
                  {emailState && emailState.initialEmailSent && emailState.newPropertyCount > 0 && (
                    <div>
                      <span className="text-slate-400">New since last email:</span>
                      <p className="text-orange-400 font-medium">+{emailState.newPropertyCount}</p>
                    </div>
                  )}
                </div>
                
                {/* Email Status Info */}
                {emailState && (
                  <div className="border-t border-slate-600/50 pt-3 mt-3">
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="text-sm font-medium text-slate-300">Email Status</h4>
                      <span className={`px-2 py-1 text-xs rounded-full ${
                        emailState.initialEmailSent 
                          ? 'bg-green-500/20 text-green-400' 
                          : 'bg-orange-500/20 text-orange-400'
                      }`}>
                        {emailState.initialEmailSent ? 'Email Sent' : 'Email Not Sent'}
                      </span>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <span className="text-slate-400">Last sent:</span>
                        <span className="ml-2 text-white font-medium">{formatLastEmailDate(emailState.lastEmailDate)}</span>
                      </div>
                      
                      {emailState.initialEmailSent && (
                        <div>
                          <span className="text-slate-400">Properties sent:</span>
                          <span className="ml-2 text-white font-medium">{emailState.lastEmailPropertyCount}</span>
                        </div>
                      )}
                    </div>

                    {!emailState.canSendInitial && !emailState.canSendReminder && (
                      <div className="mt-3 p-2 bg-orange-500/10 border border-orange-500/20 rounded-lg">
                        <p className="text-xs text-orange-400">
                          {timeline.propertyCount === 0 
                            ? '⚠️ Add properties before sending email' 
                            : emailState.clientHasSeenNewProperties
                              ? '👁️ Client has already viewed new properties on timeline'
                              : '✅ No new properties to share since last email'}
                        </p>
                      </div>
                    )}

                    {emailState.lastViewed && (
                      <div className="mt-3 p-2 bg-blue-500/10 border border-blue-500/20 rounded-lg">
                        <p className="text-xs text-blue-400">
                          🕐 Client last viewed timeline: {formatLastEmailDate(emailState.lastViewed)}
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Quick Actions */}
              <div className="space-y-3">
                
                {/* Email Template Selector Toggle */}
                <div className="flex items-center justify-between p-3 bg-slate-700/30 rounded-lg border border-slate-600/30">
                  <div className="flex items-center space-x-2">
                    <Settings className="w-4 h-4 text-slate-400" />
                    <span className="text-sm text-slate-300">Email Template</span>
                    <span className="text-xs text-slate-400 bg-slate-600/50 px-2 py-1 rounded-full capitalize">{selectedTemplate}</span>
                  </div>
                  <button
                    onClick={() => setShowTemplateSelector(!showTemplateSelector)}
                    className="text-xs text-blue-400 hover:text-blue-300 transition-colors"
                  >
                    {showTemplateSelector ? 'Hide' : 'Change'}
                  </button>
                </div>

                {/* Template Selector */}
                <AnimatePresence>
                  {showTemplateSelector && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      className="overflow-hidden"
                    >
                      <EmailTemplateSelector
                        currentTemplate={selectedTemplate}
                        onTemplateChange={setSelectedTemplate}
                        agentName={agentName}
                        companyName="Your Company"
                        brandColor="#3b82f6"
                      />
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Error Display */}
                {emailError && (
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg flex items-start space-x-2"
                  >
                    <AlertCircle className="w-4 h-4 text-red-400 mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="text-red-400 text-sm font-medium">Email Failed</p>
                      <p className="text-red-300 text-xs">{emailError}</p>
                    </div>
                    <button
                      onClick={() => setEmailError(null)}
                      className="text-red-400 hover:text-red-300 ml-auto"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </motion.div>
                )}

                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {/* Smart Send Email Button */}
                  <button
                    onClick={handleSendEmail}
                    disabled={getEmailButtonDisabled()}
                    className={`flex items-center justify-center space-x-2 p-4 rounded-xl transition-all duration-200 disabled:cursor-not-allowed ${
                      getEmailButtonDisabled()
                        ? 'bg-slate-600 text-slate-400'
                        : getEmailType() === 'reminder' 
                          ? 'bg-gradient-to-r from-orange-600 to-red-600 hover:from-orange-500 hover:to-red-500 text-white'
                          : 'bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-500 hover:to-blue-600 text-white'
                    }`}
                  >
                    {isEmailSending ? (
                      <>
                        <Loader className="w-4 h-4 animate-spin" />
                        <span>Sending...</span>
                      </>
                    ) : copiedItem === 'email-sent' ? (
                      <>
                        <Check className="w-4 h-4" />
                        <span>Email Sent!</span>
                      </>
                    ) : getEmailButtonDisabled() ? (
                      <>
                        <AlertCircle className="w-4 h-4" />
                        <span>No Properties</span>
                      </>
                    ) : (
                      <>
                        <Send className="w-4 h-4" />
                        <span className="text-sm sm:text-base">{getEmailButtonText()}</span>
                      </>
                    )}
                  </button>

                  {/* Copy Link Button */}
                  <button
                    onClick={() => copyToClipboard(timeline.shareUrl, 'link')}
                    className="flex items-center justify-center space-x-2 p-4 bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-500 hover:to-purple-600 text-white rounded-xl transition-all duration-200"
                  >
                    {copiedItem === 'link' ? (
                      <>
                        <Check className="w-4 h-4" />
                        <span>Copied!</span>
                      </>
                    ) : (
                      <>
                        <LinkIcon className="w-4 h-4" />
                        <span>Copy Link</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* Manual Sharing Options */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-white">Manual Sharing</h3>
                
                {/* Email Template */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="font-medium text-white flex items-center space-x-2">
                      <Mail className="w-4 h-4 text-blue-400" />
                      <span>Email Template</span>
                    </h4>
                    <div className="flex space-x-2">
                      <button
                        onClick={openEmailClient}
                        className="text-xs px-3 py-1 bg-blue-600/20 text-blue-400 rounded-md hover:bg-blue-600/30 transition-colors flex items-center space-x-1"
                      >
                        <ExternalLink className="w-3 h-3" />
                        <span>Open</span>
                      </button>
                      <button
                        onClick={() => copyToClipboard(`Subject: ${shareMessages.email.subject}\n\n${shareMessages.email.body}`, 'email')}
                        className="text-xs px-3 py-1 bg-slate-600/50 text-slate-300 rounded-md hover:bg-slate-600/70 transition-colors flex items-center space-x-1"
                      >
                        {copiedItem === 'email' ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                        <span>{copiedItem === 'email' ? 'Copied' : 'Copy'}</span>
                      </button>
                    </div>
                  </div>
                  <div className="bg-slate-700/30 rounded-lg p-3 border border-slate-600/30">
                    <div className="text-xs text-slate-400 mb-2">Subject:</div>
                    <div className="text-sm text-white mb-3 font-medium">{shareMessages.email.subject}</div>
                    <div className="text-xs text-slate-400 mb-2">Body:</div>
                    <div className="text-sm text-slate-300 whitespace-pre-line leading-relaxed">
                      {shareMessages.email.body}
                    </div>
                  </div>
                </div>

                {/* SMS Template */}
                {client.phone && (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <h4 className="font-medium text-white flex items-center space-x-2">
                        <MessageSquare className="w-4 h-4 text-green-400" />
                        <span>SMS Template</span>
                      </h4>
                      <div className="flex space-x-2">
                        <button
                          onClick={openSMSClient}
                          className="text-xs px-3 py-1 bg-green-600/20 text-green-400 rounded-md hover:bg-green-600/30 transition-colors flex items-center space-x-1"
                        >
                          <ExternalLink className="w-3 h-3" />
                          <span>Open</span>
                        </button>
                        <button
                          onClick={() => copyToClipboard(shareMessages.sms, 'sms')}
                          className="text-xs px-3 py-1 bg-slate-600/50 text-slate-300 rounded-md hover:bg-slate-600/70 transition-colors flex items-center space-x-1"
                        >
                          {copiedItem === 'sms' ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                          <span>{copiedItem === 'sms' ? 'Copied' : 'Copy'}</span>
                        </button>
                      </div>
                    </div>
                    <div className="bg-slate-700/30 rounded-lg p-3 border border-slate-600/30">
                      <div className="text-sm text-slate-300">{shareMessages.sms}</div>
                      <div className="text-xs text-slate-500 mt-2">{shareMessages.sms.length}/160 characters</div>
                    </div>
                  </div>
                )}

                {/* WhatsApp Template */}
                {client.phone && (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <h4 className="font-medium text-white flex items-center space-x-2">
                        <Phone className="w-4 h-4 text-green-500" />
                        <span>WhatsApp Template</span>
                      </h4>
                      <div className="flex space-x-2">
                        <button
                          onClick={openWhatsApp}
                          className="text-xs px-3 py-1 bg-green-600/20 text-green-400 rounded-md hover:bg-green-600/30 transition-colors flex items-center space-x-1"
                        >
                          <ExternalLink className="w-3 h-3" />
                          <span>Open</span>
                        </button>
                        <button
                          onClick={() => copyToClipboard(shareMessages.whatsapp, 'whatsapp')}
                          className="text-xs px-3 py-1 bg-slate-600/50 text-slate-300 rounded-md hover:bg-slate-600/70 transition-colors flex items-center space-x-1"
                        >
                          {copiedItem === 'whatsapp' ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                          <span>{copiedItem === 'whatsapp' ? 'Copied' : 'Copy'}</span>
                        </button>
                      </div>
                    </div>
                    <div className="bg-slate-700/30 rounded-lg p-3 border border-slate-600/30">
                      <div className="text-sm text-slate-300 whitespace-pre-line">{shareMessages.whatsapp}</div>
                    </div>
                  </div>
                )}

              </div>

              {/* Usage Instructions */}
              <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-4">
                <h4 className="font-medium text-blue-300 mb-2">How it works:</h4>
                <ul className="text-sm text-blue-200 space-y-1">
                  <li>• Your client will receive a personalized timeline with {timeline.propertyCount} properties</li>
                  <li>• They can browse each property and provide feedback using simple buttons</li>
                  <li>• You'll be notified when they interact with properties</li>
                  <li>• The link works on any device - no app needed</li>
                </ul>
              </div>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between p-6 border-t border-slate-700 bg-slate-800/50">
              <div className="text-sm text-slate-400">
                Timeline will remain active until manually revoked
              </div>
              <button
                onClick={onClose}
                className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors"
              >
                Done
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}

      {/* Confirmation Dialog */}
      <AnimatePresence>
        {showConfirmation && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[10000] flex items-center justify-center p-4"
            onClick={() => setShowConfirmation(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-slate-800 border border-slate-700 rounded-2xl max-w-md w-full p-6"
              onClick={e => e.stopPropagation()}
            >
              <div className="text-center">
                <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-blue-600 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Send className="w-6 h-6 text-white" />
                </div>
                
                <h3 className="text-lg font-semibold text-white mb-2">
                  Send {getEmailType() === 'initial' ? 'Initial' : 'Reminder'} Email?
                </h3>
                <p className="text-slate-400 mb-6">
                  {getEmailType() === 'initial' 
                    ? `Send ${timeline.propertyCount} properties to ${client.name} using the `
                    : `Send ${emailState?.newPropertyCount || 0} new properties to ${client.name} using the `
                  }
                  <span className="capitalize font-medium text-white">{selectedTemplate}</span> template.
                </p>
                
                {getEmailType() === 'reminder' && emailState && (
                  <div className="bg-orange-500/10 border border-orange-500/20 rounded-lg p-3 mb-4">
                    <p className="text-xs text-orange-300">
                      📧 Last email sent {formatLastEmailDate(emailState.lastEmailDate)} with {emailState.lastEmailPropertyCount} properties
                    </p>
                  </div>
                )}
                
                <div className="flex space-x-3">
                  <button
                    onClick={() => setShowConfirmation(false)}
                    disabled={isEmailSending}
                    className="flex-1 px-4 py-2 text-slate-400 hover:text-white transition-colors disabled:opacity-50"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={confirmSendEmail}
                    disabled={isEmailSending}
                    className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-600 text-white rounded-lg transition-colors flex items-center justify-center space-x-2"
                  >
                    {isEmailSending ? (
                      <>
                        <Loader className="w-4 h-4 animate-spin" />
                        <span>Sending...</span>
                      </>
                    ) : (
                      <>
                        <Send className="w-4 h-4" />
                        <span>Send Email</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </AnimatePresence>
  );
}