// apps/web/src/components/modals/settings/SettingsModal.tsx
'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  X, Settings, User, Mail, Bell, Shield, 
  CreditCard, HelpCircle, Palette, Save,
  MapPin, Eye, EyeOff, Lock,
  Check, AlertTriangle, Loader, Image as ImageIcon
} from 'lucide-react';
import { PasswordChangeModal } from '@/components/profile/PasswordChangeModal';
import { ImageUrlInput } from '@/components/ui/ImageUrlInput';
import { useSafeModalClose } from '@/hooks/useSafeModalClose';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    plan: string;
  };
  preferences: {
    emailTemplateStyle: 'modern' | 'classical';
    notifications: {
      email: boolean;
      desktop: boolean;
      feedback: boolean;
      newProperties: boolean;
      // New activity notifications
      clientViews?: boolean;
      clientLogin?: boolean;
      emailOpens?: boolean;
      inactiveClients?: boolean;
    };
    theme: 'dark' | 'light' | 'system';
    soundEnabled: boolean;
    timezone?: string;
    brandColor?: string;
    logo?: string;
  };
  onSavePreferences: (preferences: any) => Promise<void>;
}

const TIMEZONES = [
  { value: 'America/New_York', label: 'Eastern Time' },
  { value: 'America/Chicago', label: 'Central Time' },
  { value: 'America/Denver', label: 'Mountain Time' },
  { value: 'America/Los_Angeles', label: 'Pacific Time' },
  { value: 'America/Anchorage', label: 'Alaska Time' },
  { value: 'Pacific/Honolulu', label: 'Hawaii Time' }
];

export function SettingsModal({ 
  isOpen, 
  onClose, 
  user, 
  preferences: initialPreferences,
  onSavePreferences 
}: SettingsModalProps) {
  const [activeTab, setActiveTab] = useState('branding');
  const [preferences, setPreferences] = useState({
    ...initialPreferences,
    timezone: initialPreferences.timezone || 'America/New_York',
    brandColor: initialPreferences.brandColor || '#3b82f6',
    logo: initialPreferences.logo || ''
  });
  const [isSaving, setIsSaving] = useState(false);

  // Check if settings have been modified
  const hasUnsavedChanges = JSON.stringify(preferences) !== JSON.stringify({
    ...initialPreferences,
    timezone: initialPreferences.timezone || 'America/New_York',
    brandColor: initialPreferences.brandColor || '#3b82f6',
    logo: initialPreferences.logo || ''
  });

  const { handleBackdropClick, handleSafeClose } = useSafeModalClose({
    hasUnsavedChanges,
    onClose,
    confirmMessage: 'You have unsaved settings changes. Discard changes?'
  });
  const [hasChanges, setHasChanges] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);

  const tabs = [
    { id: 'branding', label: 'Branding', icon: Palette },
    { id: 'professional', label: 'Password', icon: Lock },
    { id: 'notifications', label: 'Notifications', icon: Bell },
    { id: 'account', label: 'Account & Security', icon: Shield },
    { id: 'help', label: 'Help & Support', icon: HelpCircle },
  ];

  const updatePreference = (path: string[], value: any) => {
    setPreferences(prev => {
      const newPrefs = { ...prev };
      let current = newPrefs;
      
      for (let i = 0; i < path.length - 1; i++) {
        current = current[path[i]] = { ...current[path[i]] };
      }
      current[path[path.length - 1]] = value;
      
      return newPrefs;
    });
    setHasChanges(true);
  };

  const handleLogoChange = (url: string) => {
    updatePreference(['logo'], url);
  };
  

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await onSavePreferences(preferences);
      setHasChanges(false);
    } catch (error) {
      console.error('Failed to save preferences:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const renderTabContent = () => {
    switch (activeTab) {
      case 'branding':
        return (
          <div className="space-y-8">
            <div>
              <h3 className="text-lg font-semibold text-white mb-6">Brand Identity</h3>
              
              {/* Logo Upload */}
              <div className="space-y-4">
                <div>
                  <ImageUrlInput
                    value={preferences.logo || ''}
                    onChange={handleLogoChange}
                    placeholder="https://yourcompany.com/logo.png"
                    label="Company Logo URL"
                    preview={false}
                  />
                </div>

                {/* Brand Color */}
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-3">Brand Color</label>
                  <div className="flex flex-col sm:flex-row sm:items-start space-y-4 sm:space-y-0 sm:space-x-4">
                    <div className="flex items-center space-x-3">
                      <input
                        type="color"
                        value={preferences.brandColor}
                        onChange={(e) => updatePreference(['brandColor'], e.target.value)}
                        className="w-12 h-10 rounded-lg border border-slate-600 bg-slate-700 cursor-pointer flex-shrink-0"
                      />
                      <input
                        type="text"
                        value={preferences.brandColor}
                        onChange={(e) => updatePreference(['brandColor'], e.target.value)}
                        className="w-32 px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 font-mono text-sm"
                        placeholder="#3b82f6"
                      />
                    </div>
                    
                    {/* Color Preview */}
                    <div className="flex-1 min-w-0">
                      <div 
                        className="h-10 rounded-lg border border-slate-600"
                        style={{ backgroundColor: preferences.brandColor }}
                      />
                      <p className="text-xs text-slate-400 mt-1">
                        This color will appear in your email templates and client timeline
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Email Template Styles */}
            <div>
              <h4 className="text-base font-semibold text-white mb-4">Email Template Style</h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {[
                  { 
                    id: 'modern', 
                    label: 'Modern', 
                    description: 'Clean, minimalist design with bold typography' 
                  },
                  { 
                    id: 'classical', 
                    label: 'Classical', 
                    description: 'Traditional layout with professional styling' 
                  }
                ].map((template) => (
                  <button
                    key={template.id}
                    onClick={() => updatePreference(['emailTemplateStyle'], template.id)}
                    className={`p-4 rounded-lg border transition-all text-left ${
                      preferences.emailTemplateStyle === template.id
                        ? 'bg-blue-500/20 border-blue-500/50 text-blue-300'
                        : 'bg-slate-700/30 border-slate-600/30 text-slate-300 hover:bg-slate-700/50'
                    }`}
                  >
                    <div className="font-medium mb-1">{template.label}</div>
                    <div className="text-sm opacity-80">{template.description}</div>
                    {preferences.emailTemplateStyle === template.id && (
                      <Check className="w-4 h-4 mt-2 text-blue-400" />
                    )}
                  </button>
                ))}
              </div>
            </div>

            {/* Email Template Preview */}
            <div className="bg-slate-700/30 rounded-lg p-4 border border-slate-600/30">
              <h4 className="font-medium text-white mb-3">Email Template Preview</h4>
              
              {preferences.emailTemplateStyle === 'modern' ? (
                // Modern Template Preview
                <div className="bg-white rounded-lg overflow-hidden shadow-lg">
                  {/* Modern Header */}
                  <div 
                    className="px-6 py-6 text-center"
                    style={{ 
                      background: `linear-gradient(135deg, ${preferences.brandColor} 0%, #8b5cf6 100%)` 
                    }}
                  >
                    <div className="flex items-center justify-center space-x-4 mb-4">
                      {preferences.logo && (
                        <img 
                          src={preferences.logo} 
                          alt="Logo" 
                          className="h-16 w-auto object-contain"
                          style={{ filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.3))' }}
                        />
                      )}
                    </div>
                    <h1 className="text-white text-xl font-bold mb-1">5 Properties Selected For You</h1>
                    <p className="text-white/90 text-sm">Curated by {user.firstName} {user.lastName}</p>
                  </div>
                  
                  {/* Modern Content */}
                  <div className="p-6">
                    <h2 className="text-gray-900 text-lg font-semibold mb-3">Hi Sarah! 👋</h2>
                    <p className="text-gray-700 text-sm mb-4 leading-relaxed">
                      I've personally selected <span style={{ color: preferences.brandColor }} className="font-semibold">5 exceptional properties</span> that perfectly match your criteria.
                    </p>
                    
                    {/* Property count highlight */}
                    <div 
                      className="rounded-lg p-4 mb-4 text-center"
                      style={{ 
                        background: `linear-gradient(135deg, ${preferences.brandColor}08 0%, #8b5cf608 100%)`,
                        border: `2px solid ${preferences.brandColor}20`
                      }}
                    >
                      <div 
                        className="w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-2 text-white font-bold text-lg"
                        style={{ backgroundColor: preferences.brandColor }}
                      >
                        5
                      </div>
                      <p className="text-gray-800 font-medium text-sm">Properties Ready for You</p>
                    </div>
                    
                    <div className="text-xs text-gray-500 text-center">
                      Modern • Clean Design • Bold Typography
                    </div>
                  </div>
                </div>
              ) : (
                // Classical Template Preview  
                <div className="bg-white rounded-lg overflow-hidden shadow-lg">
                  {/* Classical Header */}
                  <div className="bg-slate-700 px-6 py-6 text-center border-b-4 border-slate-500">
                    {preferences.logo && (
                      <div className="flex justify-center mb-4">
                        <img 
                          src={preferences.logo} 
                          alt="Logo" 
                          className="h-16 w-auto object-contain"
                          style={{ filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.3))' }}
                        />
                      </div>
                    )}
                    <h1 className="text-white text-xl font-bold mb-1 tracking-wide" style={{ fontFamily: 'Georgia, serif' }}>Property Timeline</h1>
                    <p className="text-white/80 text-sm italic">Presented by {user.firstName} {user.lastName}</p>
                  </div>
                  
                  {/* Classical Content */}
                  <div className="p-6" style={{ fontFamily: 'Georgia, serif' }}>
                    <div className="text-center mb-4">
                      <h2 className="text-gray-900 text-lg font-bold mb-2">Dear Sarah,</h2>
                      <div className="w-12 h-0.5 bg-slate-600 mx-auto"></div>
                    </div>
                    
                    <p className="text-gray-700 text-sm mb-4 leading-relaxed text-justify" style={{ textIndent: '1.5rem' }}>
                      It is my distinct pleasure to present to you a carefully curated selection of <strong>5 exceptional properties</strong> that have been thoughtfully chosen to align with your specific requirements.
                    </p>
                    
                    {/* Classical CTA */}
                    <div className="bg-gray-100 border-2 border-gray-300 p-4 text-center mb-4">
                      <h3 className="text-gray-800 font-bold text-sm mb-2">Your Property Portfolio</h3>
                      <div 
                        className="inline-block px-6 py-2 border-2 text-white font-bold text-sm tracking-wide"
                        style={{ 
                          backgroundColor: '#34495e',
                          borderColor: '#34495e'
                        }}
                      >
                        VIEW TIMELINE
                      </div>
                    </div>
                    
                    <div className="text-xs text-gray-500 text-center italic">
                      Classical • Traditional Layout • Professional Styling
                    </div>
                  </div>
                </div>
              )}
              
              <p className="text-xs text-slate-400 mt-3 text-center">
                This preview shows how your branding will appear in client emails
              </p>
            </div>
          </div>
        );

      case 'professional':
        return (
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-semibold text-white mb-6">Password & Security</h3>
              
              {/* Timezone */}
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    <MapPin className="w-4 h-4 inline mr-2" />
                    Timezone
                  </label>
                  <select
                    value={preferences.timezone}
                    onChange={(e) => updatePreference(['timezone'], e.target.value)}
                    className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                  >
                    {TIMEZONES.map((tz) => (
                      <option key={tz.value} value={tz.value}>
                        {tz.label}
                      </option>
                    ))}
                  </select>
                  <p className="text-xs text-slate-400 mt-1">
                    Used for scheduling and timestamp display
                  </p>
                </div>

                {/* Password Change */}
                <div className="bg-slate-700/30 rounded-lg p-4 border border-slate-600/30">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-medium text-white flex items-center space-x-2">
                        <Lock className="w-4 h-4" />
                        <span>Password & Security</span>
                      </h4>
                      <p className="text-sm text-slate-400 mt-1">
                        Update your password and security settings
                      </p>
                    </div>
                    <button
                      onClick={() => setShowPasswordModal(true)}
                      className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
                    >
                      Change Password
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        );

      case 'notifications':
        return (
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-semibold text-white mb-6">Notification Preferences</h3>
              
              {/* Email Notifications */}
              <div className="space-y-4">
                <div className="bg-slate-700/30 rounded-lg p-4 border border-slate-600/30">
                  <h4 className="font-medium text-white mb-4 flex items-center space-x-2">
                    <Mail className="w-4 h-4 text-blue-400" />
                    <span>Email Notifications</span>
                  </h4>
                  <div className="space-y-3">
                    {[
                      { key: 'email', label: 'General email notifications', description: 'System updates and important messages' },
                      { key: 'newProperties', label: 'New properties added', description: 'When properties are added to timelines' },
                      { key: 'feedback', label: 'Client feedback received', description: 'When clients provide property feedback' }
                    ].map(({ key, label, description }) => (
                      <div key={key} className="flex items-center justify-between">
                        <div className="flex-1">
                          <div className="font-medium text-slate-200">{label}</div>
                          <div className="text-sm text-slate-400">{description}</div>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer ml-4">
                          <input
                            type="checkbox"
                            checked={preferences.notifications[key as keyof typeof preferences.notifications]}
                            onChange={(e) => updatePreference(['notifications', key], e.target.checked)}
                            className="sr-only peer"
                          />
                          <div className="w-11 h-6 bg-slate-600 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                        </label>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Desktop Notifications */}
                <div className="bg-slate-700/30 rounded-lg p-4 border border-slate-600/30">
                  <h4 className="font-medium text-white mb-4 flex items-center space-x-2">
                    <Bell className="w-4 h-4 text-green-400" />
                    <span>Desktop & Browser Notifications</span>
                  </h4>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="font-medium text-slate-200">Desktop notifications</div>
                        <div className="text-sm text-slate-400">Show browser notifications for real-time updates</div>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer ml-4">
                        <input
                          type="checkbox"
                          checked={preferences.notifications.desktop}
                          onChange={(e) => updatePreference(['notifications', 'desktop'], e.target.checked)}
                          className="sr-only peer"
                        />
                        <div className="w-11 h-6 bg-slate-600 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-green-600"></div>
                      </label>
                    </div>
                  </div>
                </div>

                {/* Client Activity Notifications */}
                <div className="bg-slate-700/30 rounded-lg p-4 border border-slate-600/30">
                  <h4 className="font-medium text-white mb-4 flex items-center space-x-2">
                    <Bell className="w-4 h-4 text-purple-400" />
                    <span>Client Activity Notifications</span>
                  </h4>
                  <div className="space-y-3">
                    {[
                      { 
                        key: 'clientViews', 
                        label: 'Timeline & property views', 
                        description: 'When clients view their timeline or specific properties',
                        enabled: preferences.notifications.clientViews ?? true
                      },
                      { 
                        key: 'emailOpens', 
                        label: 'Email opens', 
                        description: 'When clients open timeline emails you send',
                        enabled: preferences.notifications.emailOpens ?? true
                      },
                      { 
                        key: 'clientLogin', 
                        label: 'Client logins', 
                        description: 'When clients authenticate to access their timeline',
                        enabled: preferences.notifications.clientLogin ?? false
                      }
                    ].map(({ key, label, description, enabled }) => (
                      <div key={key} className="flex items-center justify-between">
                        <div className="flex-1">
                          <div className="font-medium text-slate-200">{label}</div>
                          <div className="text-sm text-slate-400">{description}</div>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer ml-4">
                          <input
                            type="checkbox"
                            checked={enabled}
                            onChange={(e) => updatePreference(['notifications', key], e.target.checked)}
                            className="sr-only peer"
                          />
                          <div className="w-11 h-6 bg-slate-600 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-purple-600"></div>
                        </label>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        );

      case 'account':
        return (
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-semibold text-white mb-4">Account & Billing</h3>
              
              <div className="space-y-4">
                {/* Account Info */}
                <div className="bg-slate-700/30 rounded-lg p-4 border border-slate-600/30">
                  <h4 className="font-medium text-white mb-3">Account Information</h4>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-slate-400">Name:</span>
                      <p className="text-white font-medium">{user.firstName} {user.lastName}</p>
                    </div>
                    <div>
                      <span className="text-slate-400">Email:</span>
                      <p className="text-white font-medium">{user.email}</p>
                    </div>
                  </div>
                </div>

                {/* Current Plan */}
                <div className="bg-slate-700/30 rounded-lg p-4 border border-slate-600/30">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-medium text-white">Current Plan</h4>
                      <p className="text-sm text-slate-400">Your subscription details</p>
                    </div>
                    <span className="px-3 py-1 bg-green-500/20 text-green-400 rounded-full text-sm font-medium">
                      {user.plan}
                    </span>
                  </div>
                </div>

                {/* Billing Info */}
                <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-4">
                  <div className="flex items-center space-x-2">
                    <AlertTriangle className="w-4 h-4 text-yellow-400" />
                    <p className="text-yellow-400 text-sm">
                      Billing and subscription management features will be available soon.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        );

      case 'help':
        return (
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-semibold text-white mb-4">Help & Support</h3>
              
              <div className="space-y-4">
                {/* Support Options */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <a
                    href="mailto:support@propertysync.com"
                    className="p-4 bg-slate-700/30 rounded-lg border border-slate-600/30 hover:bg-slate-700/50 transition-colors"
                  >
                    <Mail className="w-6 h-6 text-blue-400 mb-2" />
                    <h4 className="font-medium text-white">Email Support</h4>
                    <p className="text-sm text-slate-400">Get help via email</p>
                  </a>
                  
                  <div className="p-4 bg-slate-700/30 rounded-lg border border-slate-600/30">
                    <HelpCircle className="w-6 h-6 text-purple-400 mb-2" />
                    <h4 className="font-medium text-white">Documentation</h4>
                    <p className="text-sm text-slate-400">Coming soon</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/60 backdrop-blur-xl z-50 flex items-start lg:items-center justify-center p-2 lg:p-4"
          onClick={handleBackdropClick}
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            className="bg-slate-800 border border-slate-700 rounded-lg lg:rounded-2xl w-full max-w-6xl h-[100vh] lg:max-h-[95vh] lg:h-auto overflow-hidden mt-0 lg:mt-0"
            onClick={e => e.stopPropagation()}
          >
              {/* Mobile-Responsive Header */}
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between p-4 lg:p-6 border-b border-slate-700 gap-4 sm:gap-3">
                <div className="flex items-center space-x-3 min-w-0">
                  <div className="w-8 h-8 lg:w-10 lg:h-10 bg-gradient-to-br from-slate-600 to-slate-700 rounded-full flex items-center justify-center flex-shrink-0">
                    <Settings className="w-4 h-4 lg:w-5 lg:h-5 text-white" />
                  </div>
                  <div className="min-w-0">
                    <h2 className="text-lg lg:text-xl font-bold text-white">Settings</h2>
                    <p className="text-xs lg:text-sm text-slate-400 truncate">Manage your preferences and account</p>
                  </div>
                </div>
                
                <div className="flex items-center space-x-2 sm:space-x-3 sm:flex-shrink-0">
                  {hasChanges && (
                    <button
                      onClick={handleSave}
                      disabled={isSaving}
                      className="px-3 lg:px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-green-600/50 text-white rounded-lg transition-colors flex items-center space-x-2 text-sm lg:text-base"
                    >
                      {isSaving ? (
                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      ) : (
                        <Save className="w-4 h-4" />
                      )}
                      <span>{isSaving ? 'Saving...' : 'Save'}</span>
                    </button>
                  )}
                  
                  <button
                    onClick={handleSafeClose}
                    className="p-2 hover:bg-slate-700 rounded-lg transition-colors flex-shrink-0"
                  >
                    <X className="w-5 h-5 text-slate-400" />
                  </button>
                </div>
              </div>

              <div className="flex flex-col lg:flex-row h-[calc(100vh-140px)] lg:h-[calc(95vh-120px)]">
                {/* Mobile Tab Bar / Desktop Sidebar */}
                <div className="lg:w-64 border-b lg:border-b-0 lg:border-r border-slate-700 overflow-x-auto lg:overflow-x-visible lg:overflow-y-auto">
                  {/* Mobile: Horizontal scrolling tabs */}
                  <nav className="flex lg:flex-col lg:space-y-2 lg:p-4">
                    <div className="flex lg:flex-col space-x-1 lg:space-x-0 lg:space-y-2 p-2 lg:p-0 min-w-max lg:min-w-0">
                      {tabs.map((tab) => {
                        const Icon = tab.icon;
                        return (
                          <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            className={`flex items-center space-x-2 lg:space-x-3 px-3 lg:px-4 py-2 lg:py-3 rounded-lg transition-colors text-left whitespace-nowrap lg:w-full ${
                              activeTab === tab.id
                                ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                                : 'text-slate-300 hover:bg-slate-700/50 hover:text-white'
                            }`}
                          >
                            <Icon className="w-4 h-4 flex-shrink-0" />
                            <span className="font-medium text-sm lg:text-base">{tab.label}</span>
                          </button>
                        );
                      })}
                    </div>
                  </nav>
                </div>

                {/* Content */}
                <div className="flex-1 p-4 lg:p-6 overflow-y-auto">
                  {renderTabContent()}
                </div>
              </div>
          </motion.div>

          {/* Password Change Modal */}
          <PasswordChangeModal
            isOpen={showPasswordModal}
            onClose={() => setShowPasswordModal(false)}
          />
        </motion.div>
      )}
    </AnimatePresence>
  );
}