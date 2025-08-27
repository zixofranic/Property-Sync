'use client';

import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  X, Share2, Copy, Phone, Mail, MapPin, Globe, 
  Award, Star, Calendar, Building2, User, CheckCircle,
  Sparkles, Heart
} from 'lucide-react';
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
  const cardRef = useRef<HTMLDivElement>(null);

  // Debug agent data when modal opens
  React.useEffect(() => {
    if (isOpen) {
      console.log('🔍 Agent Identity Modal Debug:', {
        agentName: agent.name,
        agentLogo: agent.logo,
        hasLogo: !!agent.logo,
        logoLength: agent.logo?.length || 0,
        brandColor: agent.brandColor,
        shareToken: shareToken
      });
    }
  }, [isOpen, agent, shareToken]);




  const handleShareCard = async () => {
    // Track the share action
    if (shareToken) {
      try {
        await apiClient.trackAgentInteraction(shareToken, 'agent_url_share', {
          agentName: `${agent.firstName} ${agent.lastName}`,
          agentCompany: agent.company,
          action: 'share_agent_url',
          shareMethod: 'native_share',
          timestamp: new Date().toISOString()
        });
      } catch (error) {
        console.warn('Failed to track agent URL share:', error);
      }
    }

    const agentPageUrl = `${window.location.origin}/agent/${shareToken || 'demo'}`;
    
    // Client-perspective referral message
    const clientReferralText = `Just had to share! 🏠✨ My real estate agent ${agent.firstName} ${agent.lastName} from ${agent.company} has been absolutely incredible helping me through my property journey. ${agent.yearsExperience ? `With ${agent.yearsExperience} years of experience` : 'Professional service'}, they truly know the market inside and out!

If you're looking to buy or sell, I can't recommend them enough! 👏

#RealEstate #PropertyJourney #RecommendedAgent #RealEstateExcellence`;

    try {
      if (navigator.share) {
        await navigator.share({
          title: `${agent.firstName} ${agent.lastName} - Your Trusted Real Estate Agent`,
          text: clientReferralText,
          url: agentPageUrl,
        });
      } else {
        // Fallback to copy URL
        await navigator.clipboard.writeText(agentPageUrl);
        alert('Agent profile URL copied to clipboard! You can share it anywhere.');
      }
    } catch (error) {
      console.error('Failed to share:', error);
      // Final fallback - copy URL
      try {
        await navigator.clipboard.writeText(agentPageUrl);
        alert('Agent profile URL copied to clipboard! You can share it anywhere.');
      } catch (clipboardError) {
        console.error('Failed to copy to clipboard:', clipboardError);
      }
    }
  };




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

                {/* Agent Identity Card */}
                <div className="flex justify-center">
                  <div
                    ref={cardRef}
                    className="w-full max-w-[500px] min-h-[550px] bg-gradient-to-br from-white via-slate-50 to-slate-100 rounded-3xl shadow-2xl p-4 sm:p-6 relative overflow-hidden"
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
                      <div className="flex justify-center mb-8">
                        <div 
                          className="px-6 py-3 rounded-2xl text-white font-bold text-sm w-4/5 text-center"
                          style={{ backgroundColor: agent.brandColor }}
                        >
                          MEET YOUR REALTOR
                        </div>
                      </div>

                      {/* Agent Photo & Basic Info */}
                      <div className="text-center mb-6">
                        {agent.logo ? (
                          <img
                            src={agent.logo}
                            alt={agent.name}
                            className="w-24 h-24 sm:w-32 sm:h-32 rounded-full object-cover mx-auto mb-6 border-4 shadow-xl"
                            style={{ borderColor: agent.brandColor }}
                            crossOrigin="anonymous"
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
                        
                        <div className="flex items-center justify-center space-x-4 flex-wrap gap-2">
                          <div className="flex items-center space-x-1">
                            <Award className="w-4 h-4" style={{ color: agent.brandColor }} />
                            <span className="text-sm font-semibold" style={{ color: agent.brandColor }}>REALTOR®</span>
                          </div>
                          {agent.yearsExperience && (
                            <div className="flex items-center space-x-1">
                              <Calendar className="w-4 h-4 text-slate-600" />
                              <span className="text-sm text-slate-600">{agent.yearsExperience} years experience</span>
                            </div>
                          )}
                          {agent.license && (
                            <div className="flex items-center space-x-1">
                              <CheckCircle className="w-4 h-4 text-green-600" />
                              <span className="text-sm text-slate-600">Licensed</span>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Contact Information */}
                      <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-4 mb-6 shadow-lg">
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

                      {/* Bio */}
                      {agent.bio && (
                        <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-4 mb-6 shadow-lg">
                          <h3 className="text-lg font-bold text-slate-800 mb-3 flex items-center">
                            <User className="w-5 h-5 mr-2" style={{ color: agent.brandColor }} />
                            About Me
                          </h3>
                          <p className="text-slate-700 leading-relaxed text-sm">{agent.bio}</p>
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