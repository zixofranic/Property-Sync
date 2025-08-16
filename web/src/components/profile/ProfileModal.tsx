// apps/web/src/components/profile/ProfileModal.tsx
'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X, User, Mail, Phone, Building, Globe, Award, Clock,
  Camera, Edit3, Save, Briefcase, Star, Calendar, Search,
  CheckCircle, AlertCircle
} from 'lucide-react';
import { useProfile, useProfileActions, UpdateProfileData } from '@/stores/profileStore';
import { useMissionControlStore } from '@/stores/missionControlStore';

interface ProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const SPECIALTIES = [
  { category: 'Residential', items: ['Residential Sales', 'First-Time Buyers', 'Luxury Properties', 'Senior Living'] },
  { category: 'Commercial', items: ['Commercial Real Estate', 'Investment Properties', 'Land & Lots'] },
  { category: 'Special Services', items: ['Relocation Services', 'Military Relocation', 'International Buyers', 'New Construction', 'Foreclosures'] }
];

export function ProfileModal({ isOpen, onClose }: ProfileModalProps) {
  const { profile, isLoading, error, loadProfile, clearErrors } = useProfile();
  const { updateProfile, isUpdating, updateError } = useProfileActions();
  const { addNotification } = useMissionControlStore();

  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState<UpdateProfileData>({});
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  
  // Enhanced specialties state
  const [specialtySearch, setSpecialtySearch] = useState('');
  const [customSpecialty, setCustomSpecialty] = useState('');

  // Load profile data when modal opens
  useEffect(() => {
    if (isOpen && !profile) {
      loadProfile();
    }
  }, [isOpen, profile, loadProfile]);

  // Initialize form data when profile loads
  useEffect(() => {
    if (profile && !isEditing) {
      setFormData({
        firstName: profile.firstName,
        lastName: profile.lastName,
        company: profile.company || '',
        phone: profile.phone || '',
        website: profile.website || '',
        licenseNumber: profile.licenseNumber || '',
        bio: profile.bio || '',
        specialties: profile.specialties || [],
        yearsExperience: profile.yearsExperience || 0,
      });
      setAvatarPreview(profile.avatar || null);
    }
  }, [profile, isEditing]);

  const handleInputChange = (field: keyof UpdateProfileData, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  // Enhanced specialty management
  const handleSpecialtyToggle = (specialty: string) => {
    const current = formData.specialties || [];
    const updated = current.includes(specialty)
      ? current.filter(s => s !== specialty)
      : [...current, specialty];
    
    handleInputChange('specialties', updated);
  };

  const handleAddCustomSpecialty = () => {
    if (customSpecialty.trim() && !(formData.specialties || []).includes(customSpecialty.trim())) {
      handleInputChange('specialties', [...(formData.specialties || []), customSpecialty.trim()]);
      setCustomSpecialty('');
    }
  };

  const handleRemoveSpecialty = (specialty: string) => {
    const updated = (formData.specialties || []).filter(s => s !== specialty);
    handleInputChange('specialties', updated);
  };

  // Enhanced avatar upload with validation
  const handleAvatarUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // File validation
    const maxSize = 2 * 1024 * 1024; // 2MB
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
    
    if (file.size > maxSize) {
      addNotification({
        type: 'error',
        title: 'File Too Large',
        message: 'Please select an image under 2MB.',
        read: false,
      });
      return;
    }

    if (!allowedTypes.includes(file.type)) {
      addNotification({
        type: 'error',
        title: 'Invalid File Type',
        message: 'Please select a JPEG, PNG, or WebP image.',
        read: false,
      });
      return;
    }

    // Store file for upload
    setAvatarFile(file);
    
    // Create preview
    const reader = new FileReader();
    reader.onload = (e) => {
      const result = e.target?.result as string;
      setAvatarPreview(result);
    };
    reader.readAsDataURL(file);
  };

  const handleSave = async () => {
    try {
      // If avatar file exists, we need to handle file upload
      let finalFormData = { ...formData };
      
      if (avatarFile) {
        // For now, convert to base64 - this should be replaced with proper file upload
        const reader = new FileReader();
        const base64Promise = new Promise<string>((resolve) => {
          reader.onload = (e) => resolve(e.target?.result as string);
          reader.readAsDataURL(avatarFile);
        });
        
        const base64Avatar = await base64Promise;
        finalFormData.avatar = base64Avatar;
      }

      const success = await updateProfile(finalFormData);
      
      if (success) {
        setIsEditing(false);
        setAvatarFile(null);
        addNotification({
          type: 'success',
          title: 'Profile Updated',
          message: 'Your profile has been saved successfully.',
          read: false,
        });
      } else {
        addNotification({
          type: 'error',
          title: 'Update Failed',
          message: updateError || 'Failed to update profile.',
          read: false,
        });
      }
    } catch (error) {
      addNotification({
        type: 'error',
        title: 'Update Error',
        message: 'An unexpected error occurred.',
        read: false,
      });
    }
  };

  const handleCancel = () => {
    setIsEditing(false);
    setAvatarFile(null);
    clearErrors();
    // Reset form data to profile values
    if (profile) {
      setFormData({
        firstName: profile.firstName,
        lastName: profile.lastName,
        company: profile.company || '',
        phone: profile.phone || '',
        website: profile.website || '',
        licenseNumber: profile.licenseNumber || '',
        bio: profile.bio || '',
        specialties: profile.specialties || [],
        yearsExperience: profile.yearsExperience || 0,
      });
      setAvatarPreview(profile.avatar || null);
    }
  };

  // Filter specialties based on search
  const filteredSpecialties = SPECIALTIES.map(category => ({
    ...category,
    items: category.items.filter(item => 
      item.toLowerCase().includes(specialtySearch.toLowerCase())
    )
  })).filter(category => category.items.length > 0);

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/60 backdrop-blur-xl z-50 flex items-center justify-center p-4"
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            className="bg-slate-800 border border-slate-700 rounded-2xl w-full max-w-5xl max-h-[95vh] overflow-hidden"
            onClick={e => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-slate-700">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center">
                  <User className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-white">Agent Profile</h2>
                  <p className="text-sm text-slate-400">Manage your professional information</p>
                </div>
              </div>
              
              <div className="flex items-center space-x-3">
                {!isEditing ? (
                  <button
                    onClick={() => setIsEditing(true)}
                    className="flex items-center space-x-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
                  >
                    <Edit3 className="w-4 h-4" />
                    <span>Edit Profile</span>
                  </button>
                ) : (
                  <>
                    <button
                      onClick={handleCancel}
                      disabled={isUpdating}
                      className="px-4 py-2 text-slate-400 hover:text-white transition-colors disabled:opacity-50"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleSave}
                      disabled={isUpdating}
                      className="flex items-center space-x-2 px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-green-600/50 text-white rounded-lg transition-colors"
                    >
                      {isUpdating ? (
                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      ) : (
                        <Save className="w-4 h-4" />
                      )}
                      <span>Save Changes</span>
                    </button>
                  </>
                )}
                
                <button
                  onClick={onClose}
                  className="p-2 hover:bg-slate-700 rounded-lg transition-colors"
                >
                  <X className="w-5 h-5 text-slate-400" />
                </button>
              </div>
            </div>

            {/* Content */}
            <div className="overflow-y-auto max-h-[calc(95vh-140px)]">
              {isLoading ? (
                <div className="flex items-center justify-center py-20">
                  <div className="w-8 h-8 border-2 border-blue-500/30 border-t-blue-500 rounded-full animate-spin" />
                </div>
              ) : error ? (
                <div className="p-6">
                  <div className="bg-red-500/20 border border-red-500/30 rounded-lg p-4 text-center">
                    <p className="text-red-400">{error}</p>
                    <button
                      onClick={loadProfile}
                      className="mt-2 px-4 py-2 bg-red-600/50 hover:bg-red-600/70 text-white rounded-lg transition-colors"
                    >
                      Retry
                    </button>
                  </div>
                </div>
              ) : !profile ? (
                <div className="p-6 text-center py-20">
                  <p className="text-slate-400">No profile data available</p>
                </div>
              ) : (
                <div className="p-6 space-y-8">
                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    {/* Left Column - Avatar & Status */}
                    <div className="space-y-6">
                      {/* Avatar */}
                      <div className="text-center">
                        <div className="relative inline-block">
                          <div className="w-32 h-32 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center overflow-hidden">
                            {avatarPreview ? (
                              <img
                                src={avatarPreview}
                                alt="Profile"
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <User className="w-16 h-16 text-white" />
                            )}
                          </div>
                          {isEditing && (
                            <label className="absolute bottom-0 right-0 w-10 h-10 bg-blue-600 hover:bg-blue-700 rounded-full flex items-center justify-center cursor-pointer transition-colors">
                              <Camera className="w-5 h-5 text-white" />
                              <input
                                type="file"
                                accept="image/jpeg,image/png,image/webp"
                                onChange={handleAvatarUpload}
                                className="hidden"
                              />
                            </label>
                          )}
                        </div>
                        <h3 className="text-xl font-bold text-white mt-4">
                          {profile.firstName} {profile.lastName}
                        </h3>
                        <p className="text-slate-400">{profile.company || 'Real Estate Professional'}</p>
                        <div className="flex items-center justify-center space-x-2 mt-2">
                          <div className={`w-3 h-3 rounded-full ${profile.emailVerified ? 'bg-green-500' : 'bg-yellow-500'}`} />
                          <span className="text-sm text-slate-400">
                            {profile.emailVerified ? 'Verified' : 'Pending Verification'}
                          </span>
                        </div>
                      </div>

                      {/* Quick Stats */}
                      <div className="bg-slate-700/30 rounded-lg p-4">
                        <h4 className="font-semibold text-white mb-3">Professional Info</h4>
                        <div className="space-y-3">
                          <div className="flex items-center space-x-3">
                            <Calendar className="w-4 h-4 text-blue-400" />
                            <span className="text-sm text-slate-300">
                              {profile.yearsExperience || 0} years experience
                            </span>
                          </div>
                          <div className="flex items-center space-x-3">
                            <Star className="w-4 h-4 text-yellow-400" />
                            <span className="text-sm text-slate-300">
                              {profile.specialties?.length || 0} specialties
                            </span>
                          </div>
                          <div className="flex items-center space-x-3">
                            <Award className="w-4 h-4 text-purple-400" />
                            <span className="text-sm text-slate-300">
                              {profile.plan} Plan
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Right Columns - Form Fields */}
                    <div className="lg:col-span-2 space-y-8">
                      {/* Personal Information */}
                      <div>
                        <h4 className="text-lg font-semibold text-white mb-4 flex items-center space-x-2">
                          <User className="w-5 h-5 text-blue-400" />
                          <span>Personal Information</span>
                        </h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                            <label className="block text-sm font-medium text-slate-300 mb-2">First Name</label>
                            <input
                              type="text"
                              value={formData.firstName || ''}
                              onChange={(e) => handleInputChange('firstName', e.target.value)}
                              disabled={!isEditing}
                              className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-slate-300 mb-2">Last Name</label>
                            <input
                              type="text"
                              value={formData.lastName || ''}
                              onChange={(e) => handleInputChange('lastName', e.target.value)}
                              disabled={!isEditing}
                              className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-slate-300 mb-2">Email</label>
                            <div className="relative">
                              <input
                                type="email"
                                value={profile.email}
                                disabled
                                className="w-full px-3 py-2 bg-slate-700/50 border border-slate-600/50 rounded-lg text-slate-400 cursor-not-allowed pr-8"
                              />
                              {profile.emailVerified ? (
                                <CheckCircle className="absolute right-2 top-1/2 transform -translate-y-1/2 w-4 h-4 text-green-400" />
                              ) : (
                                <AlertCircle className="absolute right-2 top-1/2 transform -translate-y-1/2 w-4 h-4 text-yellow-400" />
                              )}
                            </div>
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-slate-300 mb-2">Phone</label>
                            <input
                              type="tel"
                              value={formData.phone || ''}
                              onChange={(e) => handleInputChange('phone', e.target.value)}
                              disabled={!isEditing}
                              className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                              placeholder="(555) 123-4567"
                            />
                          </div>
                        </div>
                      </div>

                      {/* Professional Information */}
                      <div>
                        <h4 className="text-lg font-semibold text-white mb-4 flex items-center space-x-2">
                          <Briefcase className="w-5 h-5 text-blue-400" />
                          <span>Professional Information</span>
                        </h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                            <label className="block text-sm font-medium text-slate-300 mb-2">Company/Brokerage</label>
                            <input
                              type="text"
                              value={formData.company || ''}
                              onChange={(e) => handleInputChange('company', e.target.value)}
                              disabled={!isEditing}
                              className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                              placeholder="Premier Realty Group"
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-slate-300 mb-2">License Number</label>
                            <input
                              type="text"
                              value={formData.licenseNumber || ''}
                              onChange={(e) => handleInputChange('licenseNumber', e.target.value)}
                              disabled={!isEditing}
                              className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                              placeholder="RE12345678"
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-slate-300 mb-2">Years Experience</label>
                            <input
                              type="number"
                              value={formData.yearsExperience || ''}
                              onChange={(e) => handleInputChange('yearsExperience', parseInt(e.target.value) || 0)}
                              disabled={!isEditing}
                              min="0"
                              max="50"
                              className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-slate-300 mb-2">Website</label>
                            <input
                              type="url"
                              value={formData.website || ''}
                              onChange={(e) => handleInputChange('website', e.target.value)}
                              disabled={!isEditing}
                              className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                              placeholder="https://yourwebsite.com"
                            />
                          </div>
                        </div>
                      </div>

                      {/* Bio */}
                      <div>
                        <label className="block text-sm font-medium text-slate-300 mb-2">Professional Bio</label>
                        <textarea
                          value={formData.bio || ''}
                          onChange={(e) => handleInputChange('bio', e.target.value)}
                          disabled={!isEditing}
                          rows={3}
                          className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                          placeholder="Tell clients about your experience and approach to real estate..."
                        />
                      </div>

                      {/* Enhanced Specialties */}
                      <div>
                        <h4 className="text-lg font-semibold text-white mb-4 flex items-center space-x-2">
                          <Star className="w-5 h-5 text-blue-400" />
                          <span>Specialties</span>
                        </h4>

                        {/* Selected Specialties Tags */}
                        {formData.specialties && formData.specialties.length > 0 && (
                          <div className="mb-4">
                            <p className="text-sm text-slate-300 mb-2">Selected specialties:</p>
                            <div className="flex flex-wrap gap-2">
                              {formData.specialties.map((specialty) => (
                                <span
                                  key={specialty}
                                  className="inline-flex items-center space-x-2 px-3 py-1 bg-blue-600/20 text-blue-300 rounded-full text-sm border border-blue-500/30"
                                >
                                  <span>{specialty}</span>
                                  {isEditing && (
                                    <button
                                      onClick={() => handleRemoveSpecialty(specialty)}
                                      className="hover:text-blue-200 transition-colors"
                                    >
                                      <X className="w-3 h-3" />
                                    </button>
                                  )}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}

                        {isEditing && (
                          <>
                            {/* Search Bar */}
                            <div className="mb-4">
                              <div className="relative">
                                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" />
                                <input
                                  type="text"
                                  placeholder="Search specialties..."
                                  value={specialtySearch}
                                  onChange={(e) => setSpecialtySearch(e.target.value)}
                                  className="w-full pl-10 pr-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                                />
                              </div>
                            </div>

                            {/* Categorized Specialties */}
                            <div className="space-y-4 max-h-60 overflow-y-auto">
                              {filteredSpecialties.map((category) => (
                                <div key={category.category}>
                                  <h5 className="text-sm font-medium text-slate-300 mb-2">{category.category}</h5>
                                  <div className="grid grid-cols-2 gap-2">
                                    {category.items.map((specialty) => (
                                      <label
                                        key={specialty}
                                        className={`flex items-center space-x-2 p-2 rounded-lg border transition-all cursor-pointer ${
                                          formData.specialties?.includes(specialty)
                                            ? 'bg-blue-600/20 border-blue-500/50 text-blue-300'
                                            : 'bg-slate-700/50 border-slate-600/50 text-slate-300 hover:bg-slate-700'
                                        }`}
                                      >
                                        <input
                                          type="checkbox"
                                          checked={formData.specialties?.includes(specialty) || false}
                                          onChange={() => handleSpecialtyToggle(specialty)}
                                          className="hidden"
                                        />
                                        <div className={`w-2 h-2 rounded-full ${
                                          formData.specialties?.includes(specialty) ? 'bg-blue-400' : 'bg-slate-500'
                                        }`} />
                                        <span className="text-sm">{specialty}</span>
                                      </label>
                                    ))}
                                  </div>
                                </div>
                              ))}
                            </div>

                            {/* Add Custom Specialty */}
                            <div className="mt-4 pt-4 border-t border-slate-700">
                              <div className="flex space-x-2">
                                <input
                                  type="text"
                                  placeholder="Add custom specialty..."
                                  value={customSpecialty}
                                  onChange={(e) => setCustomSpecialty(e.target.value)}
                                  onKeyPress={(e) => e.key === 'Enter' && handleAddCustomSpecialty()}
                                  className="flex-1 px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                                />
                                <button
                                  onClick={handleAddCustomSpecialty}
                                  disabled={!customSpecialty.trim()}
                                  className="px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-slate-600 disabled:cursor-not-allowed text-white rounded-lg transition-colors"
                                >
                                  Add
                                </button>
                              </div>
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}