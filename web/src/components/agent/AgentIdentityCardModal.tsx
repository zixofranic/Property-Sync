'use client';

import { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  X, Download, Share2, Copy, Phone, Mail, MapPin, Globe, 
  Award, Star, Calendar, Building2, User, CheckCircle,
  Sparkles, Heart
} from 'lucide-react';
import html2canvas from 'html2canvas';

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
}

export function AgentIdentityCardModal({ agent, isOpen, onClose }: AgentIdentityCardModalProps) {
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadSuccess, setDownloadSuccess] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);

  const handleDownloadCard = async () => {
    if (!cardRef.current) return;

    setIsDownloading(true);
    try {
      const canvas = await html2canvas(cardRef.current, {
        backgroundColor: null,
        scale: 2,
        useCORS: true,
        allowTaint: true,
        width: 600,
        height: 800,
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

    try {
      const canvas = await html2canvas(cardRef.current, {
        backgroundColor: null,
        scale: 2,
        useCORS: true,
        allowTaint: true,
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
            className="bg-slate-900 border border-slate-700 rounded-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden"
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between p-6 border-b border-slate-700">
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

            <div className="p-6">
              <div className="grid lg:grid-cols-2 gap-8">
                {/* Agent Identity Card */}
                <div className="flex justify-center">
                  <div
                    ref={cardRef}
                    className="w-[600px] h-[800px] bg-gradient-to-br from-white via-slate-50 to-slate-100 rounded-3xl shadow-2xl p-8 relative overflow-hidden"
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
                          REALTOR® PROFILE
                        </div>
                        <div className="text-right">
                          <div className="text-xs text-slate-500">Property Sync</div>
                          <div className="text-xs text-slate-400">Professional Network</div>
                        </div>
                      </div>

                      {/* Agent Photo & Basic Info */}
                      <div className="text-center mb-8">
                        {agent.logo ? (
                          <img
                            src={agent.logo}
                            alt={agent.name}
                            className="w-32 h-32 rounded-full object-cover mx-auto mb-6 border-4 shadow-xl"
                            style={{ borderColor: agent.brandColor }}
                          />
                        ) : (
                          <div 
                            className="w-32 h-32 rounded-full mx-auto mb-6 flex items-center justify-center shadow-xl border-4"
                            style={{ backgroundColor: `${agent.brandColor}20`, borderColor: agent.brandColor }}
                          >
                            <User className="w-16 h-16" style={{ color: agent.brandColor }} />
                          </div>
                        )}

                        <h1 className="text-4xl font-bold text-slate-800 mb-2">{agent.name}</h1>
                        <div className="flex items-center justify-center space-x-2 mb-4">
                          <Building2 className="w-5 h-5 text-slate-600" />
                          <p className="text-xl text-slate-700 font-medium">{agent.company}</p>
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

                      {/* Experience & Stats */}
                      {(agent.yearsExperience || (agent.specialties && agent.specialties.length > 0)) && (
                        <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-6 mb-8 shadow-lg">
                          <div className="grid grid-cols-2 gap-6">
                            {agent.yearsExperience && (
                              <div className="text-center">
                                <div className="text-3xl font-bold" style={{ color: agent.brandColor }}>
                                  {agent.yearsExperience}
                                </div>
                                <div className="text-sm text-slate-600">Years Experience</div>
                                <div className="text-xs text-slate-500">{startYear} - {currentYear}</div>
                              </div>
                            )}
                            {agent.specialties && agent.specialties.length > 0 && (
                              <div className="text-center">
                                <div className="text-3xl font-bold" style={{ color: agent.brandColor }}>
                                  {agent.specialties.length}
                                </div>
                                <div className="text-sm text-slate-600">Specialties</div>
                                <div className="text-xs text-slate-500">Areas of Expertise</div>
                              </div>
                            )}
                          </div>
                        </div>
                      )}

                      {/* Contact Information */}
                      <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-6 mb-8 shadow-lg">
                        <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center">
                          <Phone className="w-5 h-5 mr-2" style={{ color: agent.brandColor }} />
                          Contact Information
                        </h3>
                        <div className="space-y-3">
                          <div className="flex items-center space-x-3">
                            <Mail className="w-4 h-4 text-slate-600" />
                            <span className="text-slate-700 font-medium">{agent.email}</span>
                          </div>
                          {agent.phone && (
                            <div className="flex items-center space-x-3">
                              <Phone className="w-4 h-4 text-slate-600" />
                              <span className="text-slate-700 font-medium">{agent.phone}</span>
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

                      {/* Specialties */}
                      {agent.specialties && agent.specialties.length > 0 && (
                        <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-6 mb-8 shadow-lg">
                          <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center">
                            <Sparkles className="w-5 h-5 mr-2" style={{ color: agent.brandColor }} />
                            Areas of Expertise
                          </h3>
                          <div className="flex flex-wrap gap-2">
                            {agent.specialties.map((specialty, index) => (
                              <span
                                key={index}
                                className="px-3 py-1 rounded-full text-sm font-medium text-white"
                                style={{ backgroundColor: agent.brandColor }}
                              >
                                {specialty}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}

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

                {/* Actions Panel */}
                <div className="space-y-6">
                  <div>
                    <h3 className="text-lg font-semibold text-white mb-2">Share this profile card</h3>
                    <p className="text-slate-400 text-sm mb-6">
                      Help {agent.name} grow their network by sharing this professional identity card with friends, 
                      family, or anyone looking for a trusted real estate agent.
                    </p>
                  </div>

                  {/* Action Buttons */}
                  <div className="space-y-4">
                    <motion.button
                      onClick={handleDownloadCard}
                      disabled={isDownloading}
                      className="w-full flex items-center justify-center space-x-3 p-4 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 disabled:from-blue-800 disabled:to-blue-900 text-white rounded-xl transition-all duration-200 shadow-lg"
                      whileHover={{ scale: isDownloading ? 1 : 1.02 }}
                      whileTap={{ scale: isDownloading ? 1 : 0.98 }}
                    >
                      {downloadSuccess ? (
                        <>
                          <CheckCircle className="w-5 h-5" />
                          <span>Downloaded Successfully!</span>
                        </>
                      ) : isDownloading ? (
                        <>
                          <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                          <span>Creating Image...</span>
                        </>
                      ) : (
                        <>
                          <Download className="w-5 h-5" />
                          <span>Download as Image</span>
                        </>
                      )}
                    </motion.button>

                    <motion.button
                      onClick={handleShareCard}
                      className="w-full flex items-center justify-center space-x-3 p-4 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white rounded-xl transition-all duration-200 shadow-lg"
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                    >
                      <Share2 className="w-5 h-5" />
                      <span>Share Directly</span>
                    </motion.button>

                    <motion.button
                      onClick={handleCopyShareText}
                      className="w-full flex items-center justify-center space-x-3 p-4 bg-gradient-to-r from-slate-700 to-slate-800 hover:from-slate-600 hover:to-slate-700 text-white rounded-xl transition-all duration-200 shadow-lg border border-slate-600"
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                    >
                      <Copy className="w-5 h-5" />
                      <span>Copy Agent Info</span>
                    </motion.button>
                  </div>

                  {/* Tips */}
                  <div className="bg-gradient-to-r from-emerald-500/10 to-blue-500/10 border border-emerald-500/20 rounded-xl p-4">
                    <h4 className="text-emerald-400 font-medium mb-2 flex items-center">
                      <Sparkles className="w-4 h-4 mr-2" />
                      Sharing Tips
                    </h4>
                    <ul className="text-sm text-slate-300 space-y-1">
                      <li>• Perfect for social media posts and stories</li>
                      <li>• Share via text, email, or messaging apps</li>
                      <li>• Great for referrals and recommendations</li>
                      <li>• Professional networking and marketing</li>
                    </ul>
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