'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { Phone, Mail, MapPin, Share2, User, Building, Star, Award, Globe } from 'lucide-react';
import { AgentIdentityCardModal } from './AgentIdentityCardModal';
import { apiClient } from '@/lib/api-client';

interface AgentData {
  name: string;
  company: string;
  phone?: string;
  email: string;
  logo?: string;
  brandColor: string;
  // Extended profile information for identity card
  firstName?: string;
  lastName?: string;
  title?: string;
  license?: string;
  yearsExperience?: number;
  specialties?: string[];
  bio?: string;
  address?: string;
  website?: string;
  certifications?: string[];
}

interface AgentCardProps {
  agent: AgentData;
  isSticky?: boolean;
  variant?: 'dashboard' | 'email';
  className?: string;
  shareToken?: string;
}

export function AgentCard({ 
  agent, 
  isSticky = false, 
  variant = 'dashboard',
  className = '',
  shareToken
}: AgentCardProps) {
  const [showIdentityCard, setShowIdentityCard] = useState(false);

  const handleSmartContact = async (type: 'email' | 'phone' | 'website') => {
    // Track the agent interaction if shareToken is available
    if (shareToken) {
      try {
        await apiClient.trackAgentInteraction(shareToken, `agent_${type}_click`, {
          agentName: agent.name,
          agentCompany: agent.company,
          contactType: type,
          timestamp: new Date().toISOString()
        });
      } catch (error) {
        console.warn('Failed to track agent interaction:', error);
      }
    }

    if (type === 'email' && agent.email) {
      const mailtoLink = `mailto:${agent.email}?subject=Question about my property timeline&body=Hi ${agent.name.split(' ')[0]},

I have a question about the properties you shared with me.

Thank you!`;

      // Try to open email client
      try {
        window.location.href = mailtoLink;
      } catch (error) {
        // Fallback: copy email to clipboard
        await navigator.clipboard.writeText(agent.email);
        alert('Email copied to clipboard!');
      }
    } else if (type === 'phone' && agent.phone) {
      window.location.href = `tel:${agent.phone}`;
    } else if (type === 'website' && agent.website) {
      window.open(agent.website, '_blank');
    }
  };

  // Footer variant for timeline pages
  if (isSticky) {
    return (
      <>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="fixed bottom-0 left-0 right-0 z-50 bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 border-t border-slate-700/50 backdrop-blur-xl"
          style={{ borderTopColor: `${agent.brandColor}30` }}
        >
          <div className="max-w-7xl mx-auto px-4 py-3">
            <div className="flex items-center justify-between">
              {/* Agent Info Section */}
              <div className="flex items-center space-x-4">
                {agent.logo ? (
                  <img
                    src={agent.logo}
                    alt={agent.name}
                    className="w-10 h-10 rounded-full object-cover border-2"
                    style={{ borderColor: agent.brandColor }}
                  />
                ) : (
                  <div 
                    className="w-10 h-10 rounded-full flex items-center justify-center"
                    style={{ backgroundColor: `${agent.brandColor}20`, color: agent.brandColor }}
                  >
                    <User className="w-5 h-5" />
                  </div>
                )}
                
                <div className="hidden sm:block flex-1 min-w-0">
                  <div className="flex items-center space-x-2">
                    <h3 className="text-white font-semibold text-sm">{agent.name}</h3>
                    <span className="text-xs px-2 py-1 rounded-full" style={{ backgroundColor: `${agent.brandColor}20`, color: agent.brandColor }}>
                      REALTOR®
                    </span>
                  </div>
                  <div className="flex items-center space-x-1">
                    <Building className="w-3 h-3 text-slate-400" />
                    <p className="text-slate-400 text-xs">{agent.company}</p>
                  </div>
                </div>

                {/* Mobile: Name only */}
                <div className="sm:hidden">
                  <h3 className="text-white font-semibold text-sm">{agent.name}</h3>
                  <p className="text-slate-400 text-xs">REALTOR®</p>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center space-x-2">
                {/* Contact Buttons */}
                {agent.email && (
                  <motion.button
                    onClick={() => handleSmartContact('email')}
                    className="flex items-center space-x-1 px-2 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium rounded-lg transition-all duration-200"
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                  >
                    <Mail className="w-3 h-3" />
                    <span className="hidden sm:inline">Email</span>
                  </motion.button>
                )}

                {agent.phone && (
                  <motion.button
                    onClick={() => handleSmartContact('phone')}
                    className="flex items-center space-x-1 px-2 py-2 bg-green-600 hover:bg-green-700 text-white text-xs font-medium rounded-lg transition-all duration-200"
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                  >
                    <Phone className="w-3 h-3" />
                    <span className="hidden sm:inline">Call</span>
                  </motion.button>
                )}

                {agent.website && (
                  <motion.button
                    onClick={() => handleSmartContact('website')}
                    className="flex items-center space-x-1 px-2 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-medium rounded-lg transition-all duration-200"
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                  >
                    <Globe className="w-3 h-3" />
                    <span className="hidden sm:inline">Website</span>
                  </motion.button>
                )}

                {/* Share Agent Button */}
                <motion.button
                  onClick={() => setShowIdentityCard(true)}
                  className="flex items-center space-x-1 px-2 py-2 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white text-xs font-medium rounded-lg transition-all duration-200"
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                >
                  <Share2 className="w-3 h-3" />
                  <span className="hidden lg:inline">Share Agent</span>
                  <span className="lg:hidden">Share</span>
                </motion.button>
              </div>
            </div>


          </div>
        </motion.div>

        {/* Agent Identity Card Modal */}
        <AgentIdentityCardModal
          agent={agent}
          isOpen={showIdentityCard}
          onClose={() => setShowIdentityCard(false)}
        />
      </>
    );
  }

  // Regular card variant (for email, etc.)
  const baseClasses = `
    bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 
    border border-slate-700/50 backdrop-blur-xl rounded-2xl 
    p-3 sm:p-4 md:p-6
    shadow-2xl transition-all duration-300
    ${variant === 'email' ? 'max-w-md mx-auto' : 'max-w-sm sm:max-w-md lg:max-w-lg'}
    ${className}
  `;

  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: 20, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        whileHover={{ scale: 1.01 }}
        className={baseClasses}
        style={{ borderColor: `${agent.brandColor}20` }}
      >
        {/* Header */}
        <div className="flex items-center space-x-2 sm:space-x-3 mb-3 sm:mb-4">
          {agent.logo ? (
            <img
              src={agent.logo}
              alt={agent.name}
              className="w-10 h-10 sm:w-12 sm:h-12 rounded-full object-cover border-2 shadow-lg"
              style={{ borderColor: agent.brandColor }}
            />
          ) : (
            <div 
              className="w-10 h-10 sm:w-12 sm:h-12 rounded-full flex items-center justify-center shadow-lg"
              style={{ backgroundColor: `${agent.brandColor}20`, color: agent.brandColor }}
            >
              <User className="w-5 h-5 sm:w-6 sm:h-6" />
            </div>
          )}
          
          <div className="flex-1 min-w-0">
            <h3 className="text-white font-bold text-base sm:text-lg leading-tight truncate">{agent.name}</h3>
            <div className="flex items-center space-x-1">
              <Building className="w-3 h-3 text-slate-400 flex-shrink-0" />
              <p className="text-slate-300 text-xs sm:text-sm truncate">{agent.company}</p>
            </div>
            <div className="flex items-center space-x-1 mt-1">
              <Award className="w-3 h-3 flex-shrink-0" style={{ color: agent.brandColor }} />
              <p className="text-xs" style={{ color: agent.brandColor }}>REALTOR®</p>
            </div>
          </div>
        </div>

        {/* Agent Bio */}
        {agent.bio && (
          <div className="mb-3 sm:mb-4 p-2 sm:p-3 bg-slate-800/20 rounded-lg">
            <p className="text-slate-300 text-xs sm:text-sm leading-relaxed">{agent.bio}</p>
          </div>
        )}

        {/* Quick Stats (if available) */}
        {agent.yearsExperience && (
          <div className="flex items-center justify-center mb-3 sm:mb-4 p-2 sm:p-3 bg-slate-800/30 rounded-xl">
            <div className="text-center">
              <div className="text-xl sm:text-2xl font-bold text-white">{agent.yearsExperience}</div>
              <div className="text-xs text-slate-400">Years Experience</div>
            </div>
          </div>
        )}

        {/* Contact Actions */}
        <div className="space-y-2 sm:space-y-3 mb-3 sm:mb-4">
          {agent.email && (
            <motion.button
              onClick={() => handleSmartContact('email')}
              className="w-full flex items-center justify-center space-x-2 sm:space-x-3 p-2 sm:p-3 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white rounded-lg sm:rounded-xl transition-all duration-200 shadow-lg"
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              <Mail className="w-3 h-3 sm:w-4 sm:h-4" />
              <span className="font-medium text-sm sm:text-base">Email {agent.name.split(' ')[0]}</span>
            </motion.button>
          )}

          {agent.phone && (
            <motion.button
              onClick={() => handleSmartContact('phone')}
              className="w-full flex items-center justify-center space-x-2 sm:space-x-3 p-2 sm:p-3 bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 text-white rounded-lg sm:rounded-xl transition-all duration-200 shadow-lg"
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              <Phone className="w-3 h-3 sm:w-4 sm:h-4" />
              <span className="font-medium text-sm sm:text-base">Call Now</span>
            </motion.button>
          )}

          {agent.website && (
            <motion.button
              onClick={() => handleSmartContact('website')}
              className="w-full flex items-center justify-center space-x-2 sm:space-x-3 p-2 sm:p-3 bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-700 hover:to-indigo-800 text-white rounded-lg sm:rounded-xl transition-all duration-200 shadow-lg"
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              <Globe className="w-3 h-3 sm:w-4 sm:h-4" />
              <span className="font-medium text-sm sm:text-base">Visit Website</span>
            </motion.button>
          )}
        </div>

        {/* Share Agent Button */}
        <motion.button
          onClick={() => {
            if (shareToken) {
              try {
                apiClient.trackAgentInteraction(shareToken, 'agent_profile_view', {
                  agentName: agent.name,
                  agentCompany: agent.company,
                  action: 'profile_modal_opened',
                  timestamp: new Date().toISOString()
                });
              } catch (error) {
                console.warn('Failed to track agent profile view:', error);
              }
            }
            setShowIdentityCard(true);
          }}
          className="w-full flex items-center justify-center space-x-2 sm:space-x-3 p-2 sm:p-3 bg-gradient-to-r from-purple-600 via-pink-600 to-red-600 hover:from-purple-700 hover:via-pink-700 hover:to-red-700 text-white rounded-lg sm:rounded-xl transition-all duration-200 shadow-lg border border-white/20"
          whileHover={{ scale: 1.02, boxShadow: '0 20px 25px -5px rgba(168, 85, 247, 0.4)' }}
          whileTap={{ scale: 0.98 }}
        >
          <Share2 className="w-3 h-3 sm:w-4 sm:h-4" />
          <span className="font-medium text-xs sm:text-sm">Share with someone you care about</span>
        </motion.button>

        {/* Branding Footer */}
        <div className="mt-3 sm:mt-4 pt-2 sm:pt-3 border-t border-slate-700/50 text-center">
          <p className="text-xs text-slate-400">
            Powered by <span className="font-semibold" style={{ color: agent.brandColor }}>Property Sync</span>
          </p>
        </div>
      </motion.div>

      {/* Agent Identity Card Modal */}
      <AgentIdentityCardModal
        agent={agent}
        isOpen={showIdentityCard}
        onClose={() => setShowIdentityCard(false)}
        shareToken={shareToken}
      />
    </>
  );
}

// Email-specific component with inline styles for email compatibility
export function AgentCardEmail({ agent }: { agent: AgentData }) {
  const emailStyles = {
    container: {
      backgroundColor: '#0f172a',
      border: `1px solid ${agent.brandColor}33`,
      borderRadius: '16px',
      padding: '16px',
      color: '#ffffff',
      fontFamily: 'Arial, sans-serif',
      maxWidth: '400px',
      margin: '0 auto',
    },
    header: {
      display: 'flex',
      alignItems: 'center',
      marginBottom: '16px',
    },
    avatar: {
      width: '48px',
      height: '48px',
      borderRadius: '50%',
      marginRight: '12px',
      border: `2px solid ${agent.brandColor}`,
    },
    name: {
      fontSize: '18px',
      fontWeight: 'bold',
      margin: '0 0 4px 0',
      color: '#ffffff',
    },
    company: {
      fontSize: '14px',
      color: '#cbd5e1',
      margin: '0',
    },
    title: {
      fontSize: '12px',
      color: agent.brandColor,
      margin: '2px 0 0 0',
    },
    contactInfo: {
      backgroundColor: '#1e293b',
      borderRadius: '12px',
      padding: '12px',
      marginBottom: '12px',
    },
    contactItem: {
      fontSize: '14px',
      color: '#e2e8f0',
      margin: '4px 0',
    },
    footer: {
      textAlign: 'center' as const,
      paddingTop: '12px',
      borderTop: '1px solid #334155',
      fontSize: '12px',
      color: '#94a3b8',
    },
  };

  return (
    <div style={emailStyles.container}>
      <div style={emailStyles.header}>
        {agent.logo ? (
          <img
            src={agent.logo}
            alt={agent.name}
            style={emailStyles.avatar}
          />
        ) : (
          <div
            style={{
              ...emailStyles.avatar,
              backgroundColor: `${agent.brandColor}20`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '20px',
              color: agent.brandColor,
            }}
          >
            👤
          </div>
        )}
        <div>
          <h3 style={emailStyles.name}>{agent.name}</h3>
          <p style={emailStyles.company}>{agent.company}</p>
          <p style={emailStyles.title}>REALTOR®</p>
        </div>
      </div>

      <div style={emailStyles.contactInfo}>
        {agent.email && (
          <div style={emailStyles.contactItem}>
            📧 {agent.email}
          </div>
        )}
        {agent.phone && (
          <div style={emailStyles.contactItem}>
            📱 {agent.phone}
          </div>
        )}
      </div>

      <div style={emailStyles.footer}>
        Powered by <strong style={{ color: agent.brandColor }}>Property Sync</strong>
      </div>
    </div>
  );
}