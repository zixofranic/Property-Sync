'use client';

import React from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import { 
  Phone, Mail, MapPin, Globe, Award, Calendar, Building2, User, 
  Heart, ExternalLink, MessageCircle, Star
} from 'lucide-react';
import { apiClient } from '@/lib/api-client';

interface AgentData {
  firstName: string;
  lastName: string;
  company?: string;
  phone?: string;
  email: string;
  avatar?: string;
  logo?: string;
  brandColor: string;
  licenseNumber?: string;
  yearsExperience?: number;
  specialties?: string[];
  bio?: string;
  website?: string;
}

// Fetch agent data with fallback
const getAgentData = async (shareToken: string): Promise<AgentData | null> => {
  // Handle demo/invalid tokens immediately
  if (shareToken === 'demo' || !shareToken) {
    console.log('🎭 Using demo shareToken, skipping API call');
    const fallbackData = {
      firstName: "Ziad",
      lastName: "El Feghali", 
      company: "ReMax Properties East",
      phone: "(502) 295-0925",
      email: "ziadfeg@gmail.com",
      website: "https://ziad.realtor",
      avatar: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400&h=400&fit=crop&crop=face&auto=format&q=80",
      brandColor: "#0066cc",
      yearsExperience: 10,
      licenseNumber: "KY123456",
      bio: "Ziad Feghali is a REALTOR® with RE/MAX Properties East, serving clients across Louisville, Kentucky. Fluent in English, French, and Arabic, he offers clear communication and a global perspective backed by strong local expertise. With over two decades of experience in technology and education, Ziad excels in strategic planning and problem-solving, guiding clients seamlessly through every transaction.",
      specialties: ["Buyer's Agent", "Seller's Agent", "Relocation Specialist", "International Buyers", "First-Time Buyers"]
    };
    console.log('🔄 Using demo fallback data:', fallbackData);
    return fallbackData;
  }

  try {
    console.log('🌐 Making API call to:', `/api/v1/agent/${shareToken}`);
    // Try to get real data from API first
    const response = await apiClient.getPublicAgentProfile(shareToken);
    console.log('📡 API response:', response);
    
    if (response.data) {
      const agentData = {
        firstName: response.data.firstName,
        lastName: response.data.lastName,
        company: response.data.company,
        phone: response.data.phone,
        email: response.data.email,
        avatar: response.data.avatar,
        logo: response.data.logo,
        brandColor: response.data.brandColor,
        licenseNumber: response.data.licenseNumber,
        yearsExperience: response.data.yearsExperience,
        specialties: response.data.specialties,
        bio: response.data.bio,
        website: response.data.website,
      };
      console.log('✅ Using real API data:', agentData);
      return agentData;
    }
  } catch (error) {
    console.warn('❌ API endpoint not available, using fallback data:', error);
  }

  // Fallback data when API is not available
  const fallbackData = {
    firstName: "Ziad",
    lastName: "El Feghali", 
    company: "ReMax Properties East",
    phone: "(502) 295-0925",
    email: "ziadfeg@gmail.com",
    website: "https://ziad.realtor",
    avatar: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400&h=400&fit=crop&crop=face&auto=format&q=80",
    brandColor: "#0066cc",
    yearsExperience: 10,
    licenseNumber: "KY123456",
    bio: "Ziad Feghali is a REALTOR® with RE/MAX Properties East, serving clients across Louisville, Kentucky. Fluent in English, French, and Arabic, he offers clear communication and a global perspective backed by strong local expertise. With over two decades of experience in technology and education, Ziad excels in strategic planning and problem-solving, guiding clients seamlessly through every transaction.",
    specialties: ["Buyer's Agent", "Seller's Agent", "Relocation Specialist", "International Buyers", "First-Time Buyers"]
  };
  console.log('🔄 Using fallback data:', fallbackData);
  return fallbackData;
};

export default function AgentSharePage() {
  const { shareToken } = useParams();
  const searchParams = useSearchParams();
  const [agent, setAgent] = React.useState<AgentData | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);

  // Extract tracking parameters
  const referralSource = searchParams.get('ref');
  const clientName = searchParams.get('client');
  const agentName = searchParams.get('agent');
  const token = searchParams.get('token');

  React.useEffect(() => {
    const loadAgentData = async () => {
      try {
        console.log('🔍 Loading agent data for shareToken:', shareToken);
        const agentData = await getAgentData(shareToken as string);
        console.log('📦 Agent data received:', agentData);
        setAgent(agentData);

        // Temporarily disabled analytics tracking
        // TODO: Re-enable once backend analytics endpoint is fixed
        console.log('Agent page visit:', {
          shareToken,
          referralSource: referralSource || 'direct',
          clientName: clientName || 'Unknown'
        });
      } catch (error) {
        console.error('Failed to load agent data:', error);
      } finally {
        setIsLoading(false);
      }
    };

    if (shareToken) {
      loadAgentData();
    }
  }, [shareToken, referralSource, clientName]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 flex items-center justify-center">
        <div className="text-white text-xl">Loading agent profile...</div>
      </div>
    );
  }

  if (!agent) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 flex items-center justify-center">
        <div className="text-white text-xl">Agent profile not found</div>
      </div>
    );
  }

  const handleContactClick = async (type: 'phone' | 'email' | 'website') => {
    // Temporarily disabled analytics tracking
    console.log('Contact interaction:', {
      shareToken,
      contactType: type,
      referralSource: referralSource || 'direct'
    });

    switch (type) {
      case 'phone':
        if (agent?.phone) {
          window.open(`tel:${agent.phone}`, '_self');
        }
        break;
      case 'email':
        const emailSubject = referralSource === 'client_referral' && clientName 
          ? `Referral from ${clientName} - Real Estate Inquiry`
          : 'Real Estate Inquiry';
        const emailBody = referralSource === 'client_referral' && clientName 
          ? `Hi ${agent?.firstName || 'there'}, I was referred to you by ${clientName} and would like to discuss my real estate needs.`
          : `Hi ${agent?.firstName || 'there'}, I found your profile and would like to discuss my real estate needs.`;
        
        window.open(`mailto:${agent?.email}?subject=${encodeURIComponent(emailSubject)}&body=${encodeURIComponent(emailBody)}`, '_self');
        break;
      case 'website':
        if (agent?.website) {
          window.open(agent.website, '_blank', 'noopener,noreferrer');
        }
        break;
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800">
      {/* Header */}
      <div className="bg-slate-800/50 backdrop-blur-sm border-b border-slate-700">
        <div className="max-w-4xl mx-auto px-4 py-6">
          <div className="flex items-center space-x-3">
            <div className="w-12 h-12 bg-gradient-to-r from-purple-500 to-pink-500 rounded-xl flex items-center justify-center">
              <Building2 className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white">Meet Your REALTOR®</h1>
              <p className="text-slate-400">Professional Real Estate Services</p>
            </div>
          </div>
        </div>
      </div>

      {/* Agent Card */}
      <div className="max-w-4xl mx-auto px-4 py-12">
        <div className="bg-gradient-to-br from-white via-slate-50 to-slate-100 rounded-3xl shadow-2xl p-8 relative overflow-hidden">
          {/* Background Pattern */}
          <div 
            className="absolute inset-0 opacity-5"
            style={{
              backgroundImage: `radial-gradient(circle at 25% 25%, ${agent.brandColor} 0%, transparent 70%), radial-gradient(circle at 75% 75%, ${agent.brandColor} 0%, transparent 70%)`
            }}
          />

          <div className="relative">
            {/* Brand Header */}
            <div className="flex justify-center mb-8">
              <div 
                className="px-8 py-4 rounded-2xl text-white font-bold text-lg text-center"
                style={{ backgroundColor: agent.brandColor }}
              >
                MEET YOUR REALTOR
              </div>
            </div>

            {/* Agent Photo & Basic Info */}
            <div className="text-center mb-8">
              {agent.avatar ? (
                <img
                  src={agent.avatar}
                  alt={`${agent.firstName} ${agent.lastName}`}
                  className="w-40 h-40 rounded-full object-cover mx-auto mb-6 border-4 shadow-xl"
                  style={{ borderColor: agent.brandColor }}
                  onError={(e) => {
                    console.error('Failed to load agent avatar:', agent.avatar);
                    // Hide the image and show fallback
                    (e.target as HTMLImageElement).style.display = 'none';
                    const fallback = (e.target as HTMLImageElement).nextElementSibling;
                    if (fallback) fallback.classList.remove('hidden');
                  }}
                />
              ) : null}
              
              {/* Fallback avatar */}
              <div 
                className={`w-40 h-40 rounded-full mx-auto mb-6 flex items-center justify-center shadow-xl border-4 ${agent.avatar ? 'hidden' : ''}`}
                style={{ backgroundColor: `${agent.brandColor}20`, borderColor: agent.brandColor }}
              >
                <User className="w-20 h-20" style={{ color: agent.brandColor }} />
              </div>

              <h1 className="text-5xl font-bold text-slate-800 mb-4">{agent.firstName} {agent.lastName}</h1>
              
              {/* Company Logo or Name */}
              <div className="flex items-center justify-center space-x-3 mb-6">
                {agent.logo ? (
                  <img
                    src={agent.logo}
                    alt={agent.company}
                    className="h-8 w-auto max-w-40"
                  />
                ) : (
                  <>
                    <Building2 className="w-6 h-6 text-slate-600" />
                    <p className="text-2xl text-slate-700 font-medium">{agent.company || 'Real Estate Professional'}</p>
                  </>
                )}
              </div>
              
              <div className="flex items-center justify-center space-x-6 flex-wrap gap-3">
                <div className="flex items-center space-x-2">
                  <Award className="w-5 h-5" style={{ color: agent.brandColor }} />
                  <span className="text-lg font-semibold" style={{ color: agent.brandColor }}>REALTOR®</span>
                </div>
                {agent.yearsExperience && (
                  <div className="flex items-center space-x-2">
                    <Calendar className="w-5 h-5 text-slate-600" />
                    <span className="text-lg text-slate-600">{agent.yearsExperience} years experience</span>
                  </div>
                )}
                {agent.licenseNumber && (
                  <div className="flex items-center space-x-2">
                    <Star className="w-5 h-5 text-green-600" />
                    <span className="text-lg text-slate-600">Licensed Professional</span>
                  </div>
                )}
              </div>
            </div>

            {/* Contact Information */}
            <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-6 mb-8 shadow-lg">
              <h3 className="text-2xl font-bold text-slate-800 mb-6 flex items-center">
                <Phone className="w-6 h-6 mr-3" style={{ color: agent.brandColor }} />
                Contact Information
              </h3>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                {agent.phone && (
                  <button
                    onClick={() => handleContactClick('phone')}
                    className="flex items-center justify-center space-x-3 px-6 py-4 bg-green-600 hover:bg-green-700 text-white rounded-xl transition-all duration-200 shadow-lg hover:shadow-xl transform hover:scale-105"
                  >
                    <Phone className="w-5 h-5" />
                    <span className="font-semibold">Call Now</span>
                  </button>
                )}
                <button
                  onClick={() => handleContactClick('email')}
                  className="flex items-center justify-center space-x-3 px-6 py-4 bg-blue-600 hover:bg-blue-700 text-white rounded-xl transition-all duration-200 shadow-lg hover:shadow-xl transform hover:scale-105"
                >
                  <Mail className="w-5 h-5" />
                  <span className="font-semibold">Send Email</span>
                </button>
                {agent.website && (
                  <button
                    onClick={() => handleContactClick('website')}
                    className="flex items-center justify-center space-x-3 px-6 py-4 bg-purple-600 hover:bg-purple-700 text-white rounded-xl transition-all duration-200 shadow-lg hover:shadow-xl transform hover:scale-105"
                  >
                    <Globe className="w-5 h-5" />
                    <span className="font-semibold">Visit Website</span>
                  </button>
                )}
              </div>
            </div>

            {/* Specialties */}
            {agent.specialties && agent.specialties.length > 0 && (
              <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-6 mb-8 shadow-lg">
                <h3 className="text-2xl font-bold text-slate-800 mb-4 flex items-center">
                  <Award className="w-6 h-6 mr-3" style={{ color: agent.brandColor }} />
                  Specialties
                </h3>
                <div className="flex flex-wrap gap-3">
                  {agent.specialties.map((specialty, index) => (
                    <span
                      key={index}
                      className="px-4 py-2 bg-slate-100 text-slate-700 rounded-lg font-medium"
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
                <h3 className="text-2xl font-bold text-slate-800 mb-4 flex items-center">
                  <User className="w-6 h-6 mr-3" style={{ color: agent.brandColor }} />
                  About Me
                </h3>
                <p className="text-slate-700 leading-relaxed text-lg">{agent.bio}</p>
              </div>
            )}

            {/* Footer */}
            <div className="text-center mt-8 pt-6 border-t border-slate-200">
              <div className="flex items-center justify-center space-x-2 mb-6">
                <Heart className="w-5 h-5 text-pink-500" />
                <span className="text-lg text-slate-600">Your Trusted Real Estate Partner</span>
                <Heart className="w-5 h-5 text-pink-500" />
              </div>
              
              {/* Footer Contact Buttons */}
              <div className="flex flex-col sm:flex-row gap-4 justify-center mb-6">
                {agent.phone && (
                  <button
                    onClick={() => handleContactClick('phone')}
                    className="flex items-center justify-center space-x-3 px-6 py-4 bg-green-600 hover:bg-green-700 text-white rounded-xl transition-all duration-200 shadow-lg hover:shadow-xl transform hover:scale-105"
                  >
                    <Phone className="w-5 h-5" />
                    <span className="font-semibold">Call Now</span>
                  </button>
                )}
                <button
                  onClick={() => handleContactClick('email')}
                  className="flex items-center justify-center space-x-3 px-6 py-4 bg-blue-600 hover:bg-blue-700 text-white rounded-xl transition-all duration-200 shadow-lg hover:shadow-xl transform hover:scale-105"
                >
                  <Mail className="w-5 h-5" />
                  <span className="font-semibold">Send Email</span>
                </button>
                {agent.website && (
                  <button
                    onClick={() => handleContactClick('website')}
                    className="flex items-center justify-center space-x-3 px-6 py-4 bg-purple-600 hover:bg-purple-700 text-white rounded-xl transition-all duration-200 shadow-lg hover:shadow-xl transform hover:scale-105"
                  >
                    <Globe className="w-5 h-5" />
                    <span className="font-semibold">Visit Website</span>
                  </button>
                )}
              </div>
              
              <div className="text-sm text-slate-500">
                Created with Property Sync • Professional Real Estate Platform
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}