import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Mail, Eye, Palette, Sparkles, FileText, Check, X } from 'lucide-react';

interface EmailTemplateSelectorProps {
  currentTemplate: 'modern' | 'classical';
  onTemplateChange: (template: 'modern' | 'classical') => void;
  agentName?: string;
  companyName?: string;
  brandColor?: string;
}

export function EmailTemplateSelector({ 
  currentTemplate, 
  onTemplateChange, 
  agentName = "John Smith",
  companyName = "Premier Realty",
  brandColor = "#3b82f6"
}: EmailTemplateSelectorProps) {
  const [previewMode, setPreviewMode] = useState<'modern' | 'classical' | null>(null);

  const templates = [
    {
      id: 'modern' as const,
      name: 'Modern',
      description: 'Clean, gradient-based design with contemporary typography',
      icon: Sparkles,
      preview: {
        headerBg: `linear-gradient(135deg, ${brandColor} 0%, #8b5cf6 100%)`,
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
        buttonStyle: 'rounded-xl shadow-lg',
        accentColor: brandColor
      }
    },
    {
      id: 'classical' as const,
      name: 'Classical',
      description: 'Traditional, professional design with serif typography',
      icon: FileText,
      preview: {
        headerBg: '#34495e',
        fontFamily: 'Georgia, "Times New Roman", serif',
        buttonStyle: 'rounded-md border',
        accentColor: '#34495e'
      }
    }
  ];

  const handleTemplateSelect = (templateId: 'modern' | 'classical') => {
    onTemplateChange(templateId);
  };

  const generatePreviewContent = (template: typeof templates[0]) => {
    return {
      modern: `
        <div style="font-family: ${template.preview.fontFamily}; max-width: 400px; margin: 0 auto; border-radius: 16px; overflow: hidden; box-shadow: 0 10px 25px rgba(0,0,0,0.1);">
          <div style="padding: 30px; background: ${template.preview.headerBg}; color: white; text-align: center;">
            <h1 style="margin: 0; font-size: 1.8em; font-weight: 900;">Your Property Timeline</h1>
            <p style="margin: 8px 0 0 0; opacity: 0.9;">Curated by ${agentName}</p>
          </div>
          <div style="padding: 25px; background: white;">
            <h2 style="color: #1e293b; margin: 0 0 15px 0; font-size: 1.2em;">Hi Sarah!</h2>
            <p style="color: #64748b; margin: 0 0 20px 0; font-size: 0.9em;">I've selected 3 properties that match your criteria.</p>
            <div style="text-align: center;">
              <a href="#" style="display: inline-block; background: ${template.preview.accentColor}; color: white; padding: 12px 24px; ${template.preview.buttonStyle}; text-decoration: none; font-weight: bold; font-size: 0.9em;">View Timeline →</a>
            </div>
            <div style="margin-top: 20px; padding: 15px; background: #f8fafc; border-radius: 8px; border-left: 4px solid #22c55e;">
              <p style="margin: 0; font-size: 0.8em; color: #475569;">✨ Browse at your own pace<br/>💬 Leave feedback on each property</p>
            </div>
          </div>
          <div style="background: #f8fafc; padding: 15px; text-align: center; border-top: 1px solid #e2e8f0;">
            <p style="margin: 0; font-size: 0.7em; color: #64748b;">${agentName} • ${companyName}</p>
          </div>
        </div>
      `,
      classical: `
        <div style="font-family: ${template.preview.fontFamily}; max-width: 400px; margin: 0 auto; background: white; border-radius: 8px; box-shadow: 0 4px 12px rgba(0,0,0,0.1); overflow: hidden;">
          <div style="padding: 25px; background: ${template.preview.headerBg}; color: white; text-align: center;">
            <h1 style="margin: 0; font-size: 1.5em; font-weight: normal;">Property Selection</h1>
            <p style="margin: 8px 0 0 0; opacity: 0.9; font-size: 0.9em;">Presented by ${agentName}</p>
          </div>
          <div style="padding: 25px;">
            <p style="font-size: 0.95em; margin: 0 0 8px 0;">Dear Sarah,</p>
            <p style="margin: 0 0 20px 0; font-size: 0.85em; line-height: 1.6; color: #2c3e50;">I am pleased to present you with a carefully curated selection of 3 properties that align with your requirements.</p>
            <div style="background: #ecf0f1; padding: 15px; border-radius: 4px; margin: 15px 0; border-left: 4px solid ${template.preview.accentColor};">
              <h3 style="margin: 0 0 8px 0; color: #2c3e50; font-size: 0.9em;">Review Your Properties</h3>
              <div style="text-align: center; margin: 15px 0;">
                <a href="#" style="display: inline-block; background: ${template.preview.accentColor}; color: white; padding: 10px 20px; ${template.preview.buttonStyle}; text-decoration: none; font-size: 0.8em;">View Properties</a>
              </div>
            </div>
            <p style="margin: 15px 0 0 0; font-size: 0.8em; color: #7f8c8d;">Respectfully yours,<br/><strong>${agentName}</strong><br/><em>${companyName}</em></p>
          </div>
        </div>
      `
    };
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center space-x-3 mb-6">
        <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-purple-600 rounded-full flex items-center justify-center">
          <Mail className="w-5 h-5 text-white" />
        </div>
        <div>
          <h3 className="text-lg font-semibold text-white">Email Template Style</h3>
          <p className="text-sm text-slate-400">Choose how your client emails look and feel</p>
        </div>
      </div>

      {/* Template Options */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {templates.map((template) => {
          const Icon = template.icon;
          const isSelected = currentTemplate === template.id;
          
          return (
            <motion.div
              key={template.id}
              className={`relative p-6 rounded-xl border transition-all duration-200 cursor-pointer ${
                isSelected
                  ? 'bg-slate-700/50 border-purple-500/50 ring-2 ring-purple-500/30'
                  : 'bg-slate-800/50 border-slate-700/50 hover:bg-slate-700/30 hover:border-slate-600'
              }`}
              onClick={() => handleTemplateSelect(template.id)}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              {/* Selection Indicator */}
              {isSelected && (
                <div className="absolute top-4 right-4 w-6 h-6 bg-purple-500 rounded-full flex items-center justify-center">
                  <Check className="w-4 h-4 text-white" />
                </div>
              )}

              {/* Template Info */}
              <div className="flex items-start space-x-4">
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                  template.id === 'modern' 
                    ? 'bg-gradient-to-br from-blue-500 to-purple-600' 
                    : 'bg-slate-600'
                }`}>
                  <Icon className="w-6 h-6 text-white" />
                </div>
                
                <div className="flex-1">
                  <h4 className="text-white font-medium mb-1">{template.name}</h4>
                  <p className="text-slate-400 text-sm mb-4">{template.description}</p>
                  
                  {/* Preview Button */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setPreviewMode(template.id);
                    }}
                    className="flex items-center space-x-2 text-xs text-slate-300 hover:text-white transition-colors"
                  >
                    <Eye className="w-3 h-3" />
                    <span>Preview</span>
                  </button>
                </div>
              </div>

              {/* Style Indicators */}
              <div className="mt-4 flex items-center space-x-4 text-xs text-slate-400">
                <div className="flex items-center space-x-1">
                  <Palette className="w-3 h-3" />
                  <span>{template.id === 'modern' ? 'Gradient' : 'Solid'}</span>
                </div>
                <div className="flex items-center space-x-1">
                  <FileText className="w-3 h-3" />
                  <span>{template.id === 'modern' ? 'Sans-serif' : 'Serif'}</span>
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* Preview Modal */}
      <AnimatePresence>
        {previewMode && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={() => setPreviewMode(null)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-slate-800 border border-slate-700 rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden"
              onClick={e => e.stopPropagation()}
            >
              {/* Preview Header */}
              <div className="flex items-center justify-between p-6 border-b border-slate-700">
                <div className="flex items-center space-x-3">
                  <Eye className="w-5 h-5 text-purple-400" />
                  <div>
                    <h3 className="text-lg font-semibold text-white">
                      {templates.find(t => t.id === previewMode)?.name} Template Preview
                    </h3>
                    <p className="text-sm text-slate-400">How your timeline emails will look</p>
                  </div>
                </div>
                
                <button
                  onClick={() => setPreviewMode(null)}
                  className="p-2 hover:bg-slate-700 rounded-lg transition-colors"
                >
                  <X className="w-5 h-5 text-slate-400" />
                </button>
              </div>

              {/* Preview Content */}
              <div className="p-8 bg-gradient-to-br from-slate-50 to-slate-100 overflow-y-auto max-h-[calc(90vh-140px)]">
                <div 
                  dangerouslySetInnerHTML={{ 
                    __html: generatePreviewContent(templates.find(t => t.id === previewMode)!)[previewMode!]
                  }}
                />
              </div>

              {/* Preview Footer */}
              <div className="flex items-center justify-between p-6 border-t border-slate-700">
                <div className="text-sm text-slate-400">
                  Preview shows sample content with your branding
                </div>
                
                <div className="flex space-x-3">
                  <button
                    onClick={() => setPreviewMode(null)}
                    className="px-4 py-2 text-slate-400 hover:text-white transition-colors"
                  >
                    Close
                  </button>
                  <button
                    onClick={() => {
                      handleTemplateSelect(previewMode);
                      setPreviewMode(null);
                    }}
                    className="px-6 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors"
                  >
                    Use This Template
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}