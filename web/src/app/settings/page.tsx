// apps/web/src/app/settings/page.tsx
'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Settings, Save, Loader, User, Mail } from 'lucide-react';
import { withAuth } from '@/providers/AuthProvider';
import { useMissionControlStore } from '@/stores/missionControlStore';
import { EmailTemplateSelector } from '@/components/modals/email/EmailTemplateSelector';

function SettingsPage() {
  const { 
    emailPreferences, 
    loadEmailPreferences, 
    updateEmailPreferences,
    emailPreferencesLoading,
    emailPreferencesError,
    user
  } = useMissionControlStore();

  const [localPreferences, setLocalPreferences] = useState({
    preferredTemplate: 'modern' as 'modern' | 'classical',
    brandColor: '#3b82f6'
  });
  const [isSaving, setIsSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  // Load preferences on mount
  useEffect(() => {
    loadEmailPreferences();
  }, []);

  // Update local state when preferences load
  useEffect(() => {
    if (emailPreferences) {
      setLocalPreferences({
        preferredTemplate: emailPreferences.preferredTemplate,
        brandColor: emailPreferences.brandColor
      });
    }
  }, [emailPreferences]);

  // Check for changes
  useEffect(() => {
    if (emailPreferences) {
      const changed = 
        localPreferences.preferredTemplate !== emailPreferences.preferredTemplate ||
        localPreferences.brandColor !== emailPreferences.brandColor;
      setHasChanges(changed);
    }
  }, [localPreferences, emailPreferences]);

  const handleSavePreferences = async () => {
    setIsSaving(true);
    try {
      await updateEmailPreferences(localPreferences);
      setHasChanges(false);
    } catch (error) {
      // Error handling is done in the store
    } finally {
      setIsSaving(false);
    }
  };

  const handleTemplateChange = (template: 'modern' | 'classical') => {
    setLocalPreferences(prev => ({ ...prev, preferredTemplate: template }));
  };

  const handleColorChange = (color: string) => {
    setLocalPreferences(prev => ({ ...prev, brandColor: color }));
  };

  if (emailPreferencesLoading && !emailPreferences) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center">
        <div className="text-center">
          <Loader className="w-8 h-8 text-blue-500 animate-spin mx-auto mb-4" />
          <p className="text-white">Loading settings...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      {/* Header */}
      <div className="bg-slate-900/80 backdrop-blur-xl border-b border-slate-800/50 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center space-x-4">
            <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-purple-600 rounded-full flex items-center justify-center">
              <Settings className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-white">Settings</h1>
              <p className="text-sm text-slate-400">Manage your preferences and account settings</p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-6 py-8">
        <div className="space-y-8">
          {/* Profile Section */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-slate-800/50 backdrop-blur-sm border border-slate-700/50 rounded-2xl p-6"
          >
            <div className="flex items-center space-x-3 mb-6">
              <User className="w-5 h-5 text-blue-400" />
              <h2 className="text-lg font-semibold text-white">Profile Information</h2>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-slate-400">Name:</span>
                <p className="text-white font-medium">{user?.firstName} {user?.lastName}</p>
              </div>
              <div>
                <span className="text-slate-400">Email:</span>
                <p className="text-white font-medium">{user?.email}</p>
              </div>
              <div>
                <span className="text-slate-400">Plan:</span>
                <p className="text-white font-medium uppercase">{user?.plan || 'FREE'}</p>
              </div>
              <div>
                <span className="text-slate-400">Company:</span>
                <p className="text-white font-medium">{emailPreferences?.companyName || 'Not set'}</p>
              </div>
            </div>
          </motion.div>

          {/* Email Template Preferences */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="bg-slate-800/50 backdrop-blur-sm border border-slate-700/50 rounded-2xl p-6"
          >
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center space-x-3">
                <Mail className="w-5 h-5 text-purple-400" />
                <h2 className="text-lg font-semibold text-white">Email Template Preferences</h2>
              </div>
              
              {hasChanges && (
                <button
                  onClick={handleSavePreferences}
                  disabled={isSaving}
                  className="flex items-center space-x-2 px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-slate-600 text-white rounded-lg transition-colors disabled:cursor-not-allowed"
                >
                  {isSaving ? (
                    <>
                      <Loader className="w-4 h-4 animate-spin" />
                      <span>Saving...</span>
                    </>
                  ) : (
                    <>
                      <Save className="w-4 h-4" />
                      <span>Save Changes</span>
                    </>
                  )}
                </button>
              )}
            </div>

            {emailPreferencesError && (
              <div className="mb-6 p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
                <p className="text-red-400 text-sm">{emailPreferencesError}</p>
              </div>
            )}

            <EmailTemplateSelector
              currentTemplate={localPreferences.preferredTemplate}
              onTemplateChange={handleTemplateChange}
              agentName={emailPreferences?.agentName || `${user?.firstName} ${user?.lastName}`.trim() || 'Your Name'}
              companyName={emailPreferences?.companyName || 'Your Company'}
              brandColor={localPreferences.brandColor}
            />

            {/* Brand Color Picker */}
            <div className="mt-8 p-4 bg-slate-700/30 rounded-lg border border-slate-600/30">
              <label className="block text-sm font-medium text-slate-300 mb-3">Brand Color</label>
              <div className="flex items-center space-x-4">
                <input
                  type="color"
                  value={localPreferences.brandColor}
                  onChange={(e) => handleColorChange(e.target.value)}
                  className="w-12 h-12 rounded-lg border border-slate-600 bg-slate-700 cursor-pointer"
                />
                <div className="flex-1">
                  <input
                    type="text"
                    value={localPreferences.brandColor}
                    onChange={(e) => handleColorChange(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                    placeholder="#3b82f6"
                  />
                </div>
                <span className="text-sm text-slate-400">Used in email headers and buttons</span>
              </div>
            </div>

            {/* Preview Notice */}
            {hasChanges && (
              <div className="mt-6 p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg">
                <p className="text-blue-400 text-sm">
                  Changes will be saved as your default template for all future timeline emails.
                </p>
              </div>
            )}
          </motion.div>

          {/* Additional Settings Placeholder */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="bg-slate-800/50 backdrop-blur-sm border border-slate-700/50 rounded-2xl p-6"
          >
            <h2 className="text-lg font-semibold text-white mb-4">Coming Soon</h2>
            <div className="space-y-3 text-sm text-slate-400">
              <p>• Notification preferences</p>
              <p>• Custom email signatures</p>
              <p>• Automated follow-up settings</p>
              <p>• Client portal customization</p>
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
}

export default withAuth(SettingsPage);