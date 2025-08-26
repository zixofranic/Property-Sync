'use client';

import { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  X, Download, Share2, Copy, Phone, Mail, MapPin, Globe, 
  Award, Star, Calendar, Building2, User, CheckCircle,
  Sparkles, Heart
} from 'lucide-react';
import html2canvas from 'html2canvas';
import { apiClient } from '@/lib/api-client';

interface AgentData {
  name: string;
  company: string;
  phone?: string;
  email: string;
  logo?: string;
  brandColor: string;
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

interface AgentIdentityCardModalProps {
  agent: AgentData;
  isOpen: boolean;
  onClose: () => void;
  shareToken?: string;
}

export function AgentIdentityCardModal({ agent, isOpen, onClose, shareToken }: AgentIdentityCardModalProps) {
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadSuccess, setDownloadSuccess] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);

  const handleDownloadCard = async () => {
    if (!cardRef.current) return;

    // Track the download action
    if (shareToken) {
      try {
        await apiClient.trackAgentInteraction(shareToken, 'agent_card_download', {
          agentName: agent.name,
          agentCompany: agent.company,
          action: 'download_agent_card',
          timestamp: new Date().toISOString()
        });
      } catch (error) {
        console.warn('Failed to track agent card download:', error);
      }
    }

    setIsDownloading(true);
    try {
      // Wait a moment for any images to finish loading
      await new Promise(resolve => setTimeout(resolve, 500));
      
      const canvas = await html2canvas(cardRef.current, {
        backgroundColor: null,
        scale: 2,
        useCORS: true,
        allowTaint: true,
        width: 600,
        height: 800,
        logging: false,
        ignoreElements: (element) => {
          // Ignore elements that might cause issues
          return element.classList.contains('ignore-in-canvas');
        },
        onclone: async (clonedDoc) => {
          // Fix any styling issues in the cloned document
          const clonedElement = clonedDoc.querySelector('[data-agent-card]');
          if (clonedElement) {
            // Ensure no text-decoration issues
            const textElements = clonedElement.querySelectorAll('*');
            textElements.forEach((el) => {
              const style = (el as HTMLElement).style;
              if (style.textDecoration && style.textDecoration.includes('line-through')) {
                style.textDecoration = 'none';
              }
              // Force remove any computed strikethrough
              const computedStyle = window.getComputedStyle(el as Element);
              if (computedStyle.textDecoration.includes('line-through')) {
                style.textDecoration = 'none !important';
              }
            });
            
            // Handle profile image
            const profileImage = clonedElement.querySelector('img[alt="' + agent.name + '"]') as HTMLImageElement;
            if (profileImage && agent.logo) {
              // Try to ensure the image is loaded for canvas
              if (!profileImage.complete) {
                await new Promise((resolve) => {
                  profileImage.onload = resolve;
                  profileImage.onerror = resolve;
                });
              }
            }
          }
        }
      });

      // Create download link
      const link = document.createElement('a');
      link.download = `${agent.name.replace(/\s+/g, '_')}_Agent_Card.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();

      setDownloadSuccess(true);
      setTimeout(() => setDownloadSuccess(false), 2000);
    } catch (error) {
      console.error('Failed to download card:', error);
    } finally {
      setIsDownloading(false);
    }
  };

  const handleShareCard = async () => {
    if (!cardRef.current) return;

    // Track the share action
    if (shareToken) {
      try {
        await apiClient.trackAgentInteraction(shareToken, 'agent_card_share', {
          agentName: agent.name,
          agentCompany: agent.company,
          action: 'share_agent_card',
          shareMethod: 'native_share',
          timestamp: new Date().toISOString()
        });
      } catch (error) {
        console.warn('Failed to track agent card share:', error);
      }
    }

    try {
      // Wait a moment for any images to finish loading
      await new Promise(resolve => setTimeout(resolve, 500));
      
      const canvas = await html2canvas(cardRef.current, {
        backgroundColor: null,
        scale: 2,
        useCORS: true,
        allowTaint: true,
        logging: false,
        ignoreElements: (element) => {
          return element.classList.contains('ignore-in-canvas');
        },
        onclone: async (clonedDoc) => {
          // Fix styling issues in the cloned document
          const clonedElement = clonedDoc.querySelector('[data-agent-card]');
          if (clonedElement) {
            const textElements = clonedElement.querySelectorAll('*');
            textElements.forEach((el) => {
              const style = (el as HTMLElement).style;
              if (style.textDecoration && style.textDecoration.includes('line-through')) {
                style.textDecoration = 'none';
              }
              // Force remove any computed strikethrough
              const computedStyle = window.getComputedStyle(el as Element);
              if (computedStyle.textDecoration.includes('line-through')) {
                style.textDecoration = 'none !important';
              }
            });
            
            // Handle profile image
            const profileImage = clonedElement.querySelector('img[alt="' + agent.name + '"]') as HTMLImageElement;
            if (profileImage && agent.logo) {
              // Try to ensure the image is loaded for canvas
              if (!profileImage.complete) {
                await new Promise((resolve) => {
                  profileImage.onload = resolve;
                  profileImage.onerror = resolve;
                });
              }
            }
          }
        }
      });

      canvas.toBlob(async (blob) => {
        if (!blob) return;

        if (navigator.share) {
          try {
            const file = new File([blob], `${agent.name}_Agent_Card.png`, { type: 'image/png' });
            await navigator.share({
              title: `${agent.name} - Your Trusted Real Estate Agent`,
              text: `I'd love to introduce you to my amazing real estate agent, ${agent.name} from ${agent.company}. They've been incredible in helping me with my home buying journey!`,
              files: [file],
            });
          } catch (shareError) {
            // Fallback to copy link
            handleCopyShareText();
          }
        } else {
          handleCopyShareText();
        }
      }, 'image/png');
    } catch (error) {
      console.error('Failed to share card:', error);
      handleCopyShareText();
    }
  };

  const handleCopyShareText = async () => {
    // Track the copy action
    if (shareToken) {
      try {
        await apiClient.trackAgentInteraction(shareToken, 'agent_info_copy', {
          agentName: agent.name,
          agentCompany: agent.company,
          action: 'copy_agent_info',
          shareMethod: 'copy_text',
          timestamp: new Date().toISOString()
        });
      } catch (error) {
        console.warn('Failed to track agent info copy:', error);
      }
    }

    const shareText = `🏠 Meet ${agent.name} - An amazing real estate agent!

${agent.company} • REALTOR®
${agent.yearsExperience ? `${agent.yearsExperience} years of experience` : 'Experienced professional'}

📧 ${agent.email}
${agent.phone ? `📱 ${agent.phone}` : ''}
${agent.website ? `🌐 ${agent.website}` : ''}

${agent.bio || `${agent.name} is a dedicated real estate professional committed to helping clients find their perfect home.`}

Highly recommend reaching out if you're looking to buy or sell!

#RealEstate #YourTrustedAgent #PropertySync`;

    try {
      await navigator.clipboard.writeText(shareText);
      alert('Agent information copied to clipboard! You can now paste and share it anywhere.');
    } catch (error) {
      console.error('Failed to copy text:', error);
    }
  };

  const currentYear = new Date().getFullYear();
  const startYear = agent.yearsExperience ? currentYear - agent.yearsExperience : currentYear;

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 50 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 50 }}
            className="bg-slate-900 border border-slate-700 rounded-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden mx-4"
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between p-4 sm:p-6 border-b border-slate-700">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 bg-gradient-to-r from-purple-500 to-pink-500 rounded-xl flex items-center justify-center">
                  <Share2 className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-white">Share Agent Profile</h2>
                  <p className="text-sm text-slate-400">Professional identity card for {agent.name}</p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="w-10 h-10 bg-slate-800 hover:bg-slate-700 rounded-lg flex items-center justify-center text-slate-400 hover:text-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 sm:p-6 overflow-y-auto max-h-[calc(90vh-80px)]">
              {/* Text Description - Now on top */}
              <div className="text-center mb-8">
                <p className="text-slate-400 text-sm max-w-2xl mx-auto">
                  Help {agent.name} grow their network by sharing this professional identity card with friends, 
                  family, or anyone looking for a trusted real estate agent.
                </p>
              </div>

              <div className="flex flex-col items-center space-y-8">
                {/* Action Buttons - Now above card in one row */}
                <div className="w-full max-w-[600px] flex flex-col sm:flex-row gap-4 justify-center">
                  <motion.button
                    onClick={handleDownloadCard}
                    disabled={isDownloading}
                    className="flex-1 flex items-center justify-center space-x-3 p-4 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 disabled:from-blue-800 disabled:to-blue-900 text-white rounded-xl transition-all duration-200 shadow-lg"
                    whileHover={{ scale: isDownloading ? 1 : 1.02 }}
                    whileTap={{ scale: isDownloading ? 1 : 0.98 }}
                  >
                    {downloadSuccess ? (
                      <>
                        <CheckCircle className="w-5 h-5" />
                        <span className="hidden sm:inline">Downloaded!</span>
                        <span className="sm:hidden">✓</span>
                      </>
                    ) : isDownloading ? (
                      <>
                        <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        <span className="hidden sm:inline">Creating...</span>
                      </>
                    ) : (
                      <>
                        <Download className="w-5 h-5" />
                        <span className="hidden sm:inline">Download</span>
                      </>
                    )}
                  </motion.button>

                  <motion.button
                    onClick={handleShareCard}
                    className="flex-1 flex items-center justify-center space-x-3 p-4 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white rounded-xl transition-all duration-200 shadow-lg"
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                  >
                    <Share2 className="w-5 h-5" />
                    <span className="hidden sm:inline">Share</span>
                  </motion.button>

                  <motion.button
                    onClick={handleCopyShareText}
                    className="flex-1 flex items-center justify-center space-x-3 p-4 bg-gradient-to-r from-slate-700 to-slate-800 hover:from-slate-600 hover:to-slate-700 text-white rounded-xl transition-all duration-200 shadow-lg border border-slate-600"
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                  >
                    <Copy className="w-5 h-5" />
                    <span className="hidden sm:inline">Copy</span>
                  </motion.button>
                </div>

                {/* Agent Identity Card */}
                <div className="flex justify-center">
                  <div
                    ref={cardRef}
                    data-agent-card="true"
                    className="w-full max-w-[600px] min-h-[800px] bg-gradient-to-br from-white via-slate-50 to-slate-100 rounded-3xl shadow-2xl p-4 sm:p-8 relative overflow-hidden"
                    style={{ fontFamily: 'Arial, sans-serif' }}
                  >
                    {/* Background Pattern */}
                    <div 
                      className="absolute inset-0 opacity-5"
                      style={{
                        backgroundImage: `radial-gradient(circle at 25% 25%, ${agent.brandColor} 0%, transparent 70%),
                                         radial-gradient(circle at 75% 75%, ${agent.brandColor} 0%, transparent 70%)`
                      }}
                    />

                    {/* Brand Header */}
                    <div className="relative">
                      <div className="flex justify-between items-start mb-8">
                        <div 
                          className="px-4 py-2 rounded-2xl text-white font-bold text-sm"
                          style={{ backgroundColor: agent.brandColor }}
                        >
                          MEET YOUR REALTOR
                        </div>
                      </div>

                      {/* Agent Photo & Basic Info */}
                      <div className="text-center mb-8">
                        {agent.logo ? (
                          <img
                            src={agent.logo}
                            alt={agent.name}
                            crossOrigin="anonymous"
                            className="w-24 h-24 sm:w-32 sm:h-32 rounded-full object-cover mx-auto mb-6 border-4 shadow-xl"
                            style={{ borderColor: agent.brandColor }}
                            onLoad={(e) => {
                              // Ensure the image is ready for canvas rendering
                              (e.target as HTMLImageElement).setAttribute('data-loaded', 'true');
                            }}
                            onError={(e) => {
                              console.error('Agent profile image failed to load:', agent.logo);
                              (e.target as HTMLImageElement).style.display = 'none';
                            }}
                          />
                        ) : (
                          <div 
                            className="w-24 h-24 sm:w-32 sm:h-32 rounded-full mx-auto mb-6 flex items-center justify-center shadow-xl border-4"
                            style={{ backgroundColor: `${agent.brandColor}20`, borderColor: agent.brandColor }}
                          >
                            <User className="w-12 h-12 sm:w-16 sm:h-16" style={{ color: agent.brandColor }} />
                          </div>
                        )}

                        <h1 className="text-2xl sm:text-4xl font-bold text-slate-800 mb-2">{agent.name}</h1>
                        <div className="flex items-center justify-center space-x-2 mb-4">
                          <Building2 className="w-4 h-4 sm:w-5 sm:h-5 text-slate-600" />
                          <p className="text-lg sm:text-xl text-slate-700 font-medium">{agent.company}</p>
                        </div>
                        
                        <div className="flex items-center justify-center space-x-4">
                          <div className="flex items-center space-x-1">
                            <Award className="w-4 h-4" style={{ color: agent.brandColor }} />
                            <span className="text-sm font-semibold" style={{ color: agent.brandColor }}>REALTOR®</span>
                          </div>
                          {agent.license && (
                            <div className="flex items-center space-x-1">
                              <CheckCircle className="w-4 h-4 text-green-600" />
                              <span className="text-sm text-slate-600">Licensed</span>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Experience & Specialties */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
                        {/* Experience */}
                        {agent.yearsExperience && (
                          <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-6 shadow-lg">
                            <div className="text-center">
                              <div className="text-2xl font-bold" style={{ color: agent.brandColor }}>
                                {agent.yearsExperience}
                              </div>
                              <div className="text-sm text-slate-600">Years Experience</div>
                              <div className="text-xs text-slate-500">{startYear} - {currentYear}</div>
                            </div>
                          </div>
                        )}

                        {/* Specialties */}
                        {agent.specialties && agent.specialties.length > 0 && (
                          <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-6 shadow-lg">
                            <h4 className="text-sm font-bold text-slate-700 mb-3 text-center flex items-center justify-center">
                              <Star className="w-4 h-4 mr-1" style={{ color: agent.brandColor }} />
                              Specialties
                            </h4>
                            <div className="flex flex-wrap gap-2 justify-center">
                              {agent.specialties.slice(0, 4).map((specialty, index) => (
                                <span
                                  key={index}
                                  className="px-3 py-1 text-xs font-medium text-white rounded-full shadow-sm"
                                  style={{ backgroundColor: agent.brandColor }}
                                >
                                  {specialty}
                                </span>
                              ))}
                              {agent.specialties.length > 4 && (
                                <span className="px-3 py-1 text-xs font-medium text-slate-600 rounded-full border border-slate-300">
                                  +{agent.specialties.length - 4} more
                                </span>
                              )}
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Contact Information */}
                      <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-6 mb-8 shadow-lg">
                        <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center">
                          <Phone className="w-5 h-5 mr-2" style={{ color: agent.brandColor }} />
                          Contact Information
                        </h3>
                        <div className="space-y-3">
                          <div className="flex items-center space-x-3">
                            <Mail className="w-4 h-4 text-slate-600" />
                            <span className="text-slate-700 font-medium" style={{ textDecoration: 'none' }}>{agent.email}</span>
                          </div>
                          {agent.phone && (
                            <div className="flex items-center space-x-3">
                              <Phone className="w-4 h-4 text-slate-600" />
                              <span className="text-slate-700 font-medium" style={{ textDecoration: 'none' }}>{agent.phone}</span>
                            </div>
                          )}
                          {agent.website && (
                            <div className="flex items-center space-x-3">
                              <Globe className="w-4 h-4 text-slate-600" />
                              <span className="text-slate-700 font-medium">{agent.website}</span>
                            </div>
                          )}
                          {agent.address && (
                            <div className="flex items-center space-x-3">
                              <MapPin className="w-4 h-4 text-slate-600" />
                              <span className="text-slate-700 font-medium">{agent.address}</span>
                            </div>
                          )}
                        </div>
                      </div>


                      {/* Bio */}
                      {agent.bio && (
                        <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-6 mb-8 shadow-lg">
                          <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center">
                            <User className="w-5 h-5 mr-2" style={{ color: agent.brandColor }} />
                            About Me
                          </h3>
                          <p className="text-slate-700 leading-relaxed">{agent.bio}</p>
                        </div>
                      )}

                      {/* Footer */}
                      <div className="text-center mt-auto pt-6">
                        <div className="flex items-center justify-center space-x-2 mb-2">
                          <Heart className="w-4 h-4 text-pink-500" />
                          <span className="text-sm text-slate-600">Your Trusted Real Estate Partner</span>
                          <Heart className="w-4 h-4 text-pink-500" />
                        </div>
                        <div className="text-xs text-slate-500">
                          Created with Property Sync • Professional Real Estate Platform
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}