'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  X, Upload, MapPin, DollarSign, ExternalLink, 
  Mail, Package, Wand2, Link as LinkIcon, Check, AlertTriangle
} from 'lucide-react';
import { useMissionControlStore } from '@/stores/missionControlStore';

interface SimplifiedAddPropertyModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface PropertyFormData {
  address: string;
  price: number;
  description: string;
  imageUrl: string;
  mlsLink: string;
}

export function SimplifiedAddPropertyModal({ isOpen, onClose }: SimplifiedAddPropertyModalProps) {
  const { 
    selectedClient, 
    addProperty, 
    addNotification, 
    bulkMode, 
    setBulkMode,
    checkMLSDuplicate,
    editingProperty, // Add this to handle edit mode
    updateProperty    // Add this for updating properties
  } = useMissionControlStore();
  
  const [formData, setFormData] = useState<PropertyFormData>({
    address: '',
    price: 0,
    description: '',
    imageUrl: '',
    mlsLink: ''
  });
  const [isLoading, setIsLoading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [mlsDuplicateWarning, setMlsDuplicateWarning] = useState(false);

  // ✅ FIX: Load editing property data when modal opens
  useEffect(() => {
    if (isOpen && editingProperty) {
      setFormData({
        address: editingProperty.address || '',
        price: editingProperty.price || 0,
        description: editingProperty.description || '',
        imageUrl: editingProperty.imageUrl || '',
        mlsLink: editingProperty.mlsLink || ''
      });
      setImagePreview(editingProperty.imageUrl || null);
    } else if (isOpen && !editingProperty) {
      // Reset form for new property
      setFormData({
        address: '',
        price: 0,
        description: '',
        imageUrl: '',
        mlsLink: ''
      });
      setImagePreview(null);
    }
  }, [isOpen, editingProperty]);

// Enhanced duplicate check with backend validation
useEffect(() => {
  if (!selectedClient || !formData.mlsLink) {
    setMlsDuplicateWarning(false);
    return;
  }

  const trimmedMlsLink = formData.mlsLink.trim();
  if (!trimmedMlsLink) {
    setMlsDuplicateWarning(false);
    return;
  }

  // Debounce the duplicate check to avoid excessive API calls
  const timeoutId = setTimeout(async () => {
    try {
      const isDuplicate = await checkMLSDuplicate(selectedClient.id, trimmedMlsLink);
      
      // If we're editing, don't flag as duplicate if it's the same property
      if (isDuplicate && editingProperty && editingProperty.mlsLink === trimmedMlsLink) {
        setMlsDuplicateWarning(false);
      } else {
        setMlsDuplicateWarning(isDuplicate);
      }
    } catch (error) {
      console.error('Duplicate check failed:', error);
      setMlsDuplicateWarning(false);
    }
  }, 500); // 500ms debounce

  return () => clearTimeout(timeoutId);
}, [formData.mlsLink, selectedClient, checkMLSDuplicate, editingProperty]);


const extractAddressFromMLS = async () => {
  if (!formData.mlsLink) {
    addNotification({
      type: 'warning',
      title: 'No MLS Link',
      message: 'Please enter a MLS link first.',
      read: false
    });
    return;
  }

  const trimmedLink = formData.mlsLink.trim();
  
  // Check for duplicate with backend validation
  if (selectedClient) {
    try {
      const isDuplicate = await checkMLSDuplicate(selectedClient.id, trimmedLink);
      
      // Only block if we're not editing the same property
      if (isDuplicate && (!editingProperty || editingProperty.mlsLink !== trimmedLink)) {
        addNotification({
          type: 'error',
          title: 'Duplicate Property',
          message: 'This MLS property has already been shared with this client.',
          read: false
        });
        return;
      }
    } catch (error) {
      console.error('Duplicate check failed:', error);
    }
  }

  try {
    const url = new URL(trimmedLink);
    const pathParts = url.pathname.split('/');
    const addressPart = pathParts[pathParts.length - 1];
    
    if (addressPart) {
      const extractedAddress = addressPart
        .replace(/-/g, ' ')
        .replace(/\b\w/g, (letter) => letter.toUpperCase());
      
      setFormData(prev => ({ ...prev, address: extractedAddress }));
      
      addNotification({
        type: 'success',
        title: 'Address Extracted!',
        message: `Address extracted: ${extractedAddress}`,
        read: false
      });
    }
  } catch (error) {
    addNotification({
      type: 'error',
      title: 'Extraction Failed',
      message: 'Could not extract address from MLS link.',
      read: false
    });
  }
};


  // Handle image operations
  const handleImageUrl = (url: string) => {
    setFormData(prev => ({ ...prev, imageUrl: url }));
    setImagePreview(url);
    
    addNotification({
      type: 'success',
      title: 'Image Added',
      message: 'Property image has been set successfully.',
      read: false
    });
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);

    // Handle dropped image files
    const files = Array.from(e.dataTransfer.files);
    const imageFile = files.find(file => file.type.startsWith('image/'));
    
    if (imageFile) {
      const blobUrl = URL.createObjectURL(imageFile);
      setFormData(prev => ({ ...prev, imageUrl: blobUrl }));
      setImagePreview(blobUrl);
      
      addNotification({
        type: 'success',
        title: 'Image Added',
        message: 'Property image loaded successfully.',
        read: false
      });
      return;
    }

    // Handle dropped URLs
    const urlData = e.dataTransfer.getData('text/uri-list') || e.dataTransfer.getData('text/plain');
    if (urlData && urlData.trim()) {
      const url = urlData.trim();
      
      if (url.startsWith('http')) {
        handleImageUrl(url);
      } else {
        addNotification({
          type: 'warning',
          title: 'Invalid URL',
          message: 'Please drop a valid image URL starting with http:// or https://',
          read: false
        });
      }
    }
  };

  // ✅ FIX: Enhanced submit handler with proper duplicate prevention
 const handleSubmit = async (e: React.FormEvent) => {
  e.preventDefault();
  
  if (!selectedClient) {
    addNotification({
      type: 'error',
      title: 'No Client Selected',
      message: 'Please select a client first.',
      read: false
    });
    return;
  }

  // Validate required fields
  if (!formData.address || !formData.price || !formData.description) {
    addNotification({
      type: 'error',
      title: 'Missing Information',
      message: 'Please fill in all required fields.',
      read: false
    });
    return;
  }

  const trimmedMlsLink = formData.mlsLink?.trim();
  
  // CRITICAL FIX: Final duplicate check with backend validation
  if (trimmedMlsLink && selectedClient) {
    try {
      const isDuplicate = await checkMLSDuplicate(selectedClient.id, trimmedMlsLink);
      
      // Block duplicates unless we're editing the same property
      if (isDuplicate && (!editingProperty || editingProperty.mlsLink !== trimmedMlsLink)) {
        addNotification({
          type: 'error',
          title: 'Duplicate Property Blocked',
          message: 'This MLS property has already been shared with this client. Please check your timeline.',
          read: false
        });
        return;
      }
    } catch (error) {
      console.error('Final duplicate check failed:', error);
      addNotification({
        type: 'warning',
        title: 'Validation Warning',
        message: 'Could not verify if this is a duplicate. Proceeding with caution.',
        read: false
      });
    }
  }

  setIsLoading(true);

  try {
    // Process image URL
    let validImageUrl = formData.imageUrl;
    
    if (!validImageUrl || 
        validImageUrl.startsWith('blob:') || 
        !validImageUrl.match(/^https?:\/\/.+/)) {
      validImageUrl = 'https://images.unsplash.com/photo-1570129477492-45c003edd2be?w=800&h=600&fit=crop';
    }

    // Validate price
    const cleanPrice = parseInt(formData.price.toString()) || 0;
    if (cleanPrice <= 0) {
      addNotification({
        type: 'error',
        title: 'Invalid Price',
        message: 'Please enter a valid price greater than 0',
        read: false
      });
      setIsLoading(false);
      return;
    }

    const propertyData = {
      address: formData.address.trim(),
      price: cleanPrice,
      description: formData.description.trim(),
      imageUrl: validImageUrl,
      mlsLink: trimmedMlsLink,
    };

    // Handle both edit and create modes
    if (editingProperty) {
      await updateProperty(editingProperty.id, propertyData);
      
      addNotification({
        type: 'success',
        title: 'Property Updated',
        message: `${formData.address} has been updated successfully`,
        read: false
      });
    } else {
      await addProperty(propertyData);
      
      const modeText = bulkMode ? 'Added to bulk queue!' : 'Email sent to client!';
      addNotification({
        type: 'success',
        title: 'Property Added',
        message: `${formData.address} - ${modeText}`,
        read: false
      });
    }

    // Reset form
    setFormData({
      address: '',
      price: 0,
      description: '',
      imageUrl: '',
      mlsLink: ''
    });
    setImagePreview(null);
    setMlsDuplicateWarning(false);

    // Close modal unless in bulk mode and creating new property
    if (!bulkMode || editingProperty) {
      onClose();
    }
  } catch (error) {
    console.error('Property operation error:', error);
    addNotification({
      type: 'error',
      title: editingProperty ? 'Failed to Update Property' : 'Failed to Add Property',
      message: 'Something went wrong. Please try again.',
      read: false
    });
  } finally {
    setIsLoading(false);
  }
};

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            className="bg-slate-800 border border-slate-700 rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden"
            onClick={e => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-slate-700">
              <div>
                <h2 className="text-2xl font-bold text-white">
                  {editingProperty ? 'Edit Property' : 'Add Property'}
                </h2>
                {selectedClient && (
                  <p className="text-slate-400 mt-1">for {selectedClient.name}</p>
                )}
              </div>
              
              <div className="flex items-center space-x-4">
                {/* ✅ FIX: Hide bulk mode toggle when editing */}
                {!editingProperty && (
                  <div className="flex items-center space-x-2 bg-slate-700 rounded-lg p-1">
                    <button
                      onClick={() => setBulkMode(false)}
                      className={`flex items-center space-x-2 px-3 py-2 rounded-md text-sm transition-colors ${
                        !bulkMode
                          ? 'bg-blue-600 text-white'
                          : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      <Mail className="w-4 h-4" />
                      <span>Send Now</span>
                    </button>
                    <button
                      onClick={() => setBulkMode(true)}
                      className={`flex items-center space-x-2 px-3 py-2 rounded-md text-sm transition-colors ${
                        bulkMode
                          ? 'bg-purple-600 text-white'
                          : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      <Package className="w-4 h-4" />
                      <span>Bulk</span>
                    </button>
                  </div>
                )}

                <button
                  onClick={onClose}
                  className="p-2 hover:bg-slate-700 rounded-lg transition-colors"
                >
                  <X className="w-5 h-5 text-slate-400" />
                </button>
              </div>
            </div>

            {/* Mode Description */}
            {!editingProperty && (
              <div className="px-6 py-3 bg-slate-700/30 border-b border-slate-700">
                {!bulkMode ? (
                  <p className="text-sm text-slate-300">
                    📧 <strong>Send Now:</strong> Property will be emailed to client immediately.
                  </p>
                ) : (
                  <p className="text-sm text-slate-300">
                    📦 <strong>Bulk Mode:</strong> Queue properties, then send all at once.
                  </p>
                )}
              </div>
            )}

            <form onSubmit={handleSubmit} className="p-6 space-y-6 overflow-y-auto max-h-[calc(90vh-200px)]">
              {/* MLS Link with Enhanced Duplicate Warning */}
              <div className={`border rounded-lg p-4 transition-all ${
                mlsDuplicateWarning 
                  ? 'bg-red-500/10 border-red-500/30' 
                  : 'bg-blue-500/10 border-blue-500/20'
              }`}>
                <label className={`block text-sm font-medium mb-2 ${
                  mlsDuplicateWarning ? 'text-red-300' : 'text-blue-300'
                }`}>
                  <ExternalLink className="w-4 h-4 inline mr-2" />
                  MLS Link
                  {mlsDuplicateWarning && (
                    <span className="ml-2 text-red-400 font-bold">⚠️ DUPLICATE DETECTED</span>
                  )}
                </label>
                
                {/* Enhanced Duplicate Warning */}
                {mlsDuplicateWarning && (
                  <div className="mb-3 p-3 bg-red-500/20 border border-red-500/30 rounded-lg">
                    <div className="flex items-center space-x-2 text-red-300">
                      <AlertTriangle className="w-4 h-4" />
                      <span className="text-sm font-medium">
                        This MLS property has already been shared with {selectedClient?.name}. 
                        Each property can only be added once per client.
                      </span>
                    </div>
                  </div>
                )}
                
                <div className="flex space-x-2">
                  <input
                    type="url"
                    value={formData.mlsLink}
                    onChange={(e) => setFormData(prev => ({ ...prev, mlsLink: e.target.value }))}
                    className={`flex-1 px-4 py-3 bg-slate-700 border rounded-lg text-white placeholder-slate-400 focus:ring-1 transition-colors ${
                      mlsDuplicateWarning 
                        ? 'border-red-500 focus:border-red-400 focus:ring-red-500' 
                        : 'border-slate-600 focus:border-blue-500 focus:ring-blue-500'
                    }`}
                    placeholder="https://www.flexmls.com/.../3512-Autumn-Way-Louisville-KY-40218"
                  />
                  <motion.button
                    type="button"
                    onClick={extractAddressFromMLS}
                    disabled={mlsDuplicateWarning}
                    className={`px-4 py-3 text-white rounded-lg transition-colors flex items-center space-x-2 ${
                      mlsDuplicateWarning 
                        ? 'bg-red-600/50 cursor-not-allowed' 
                        : 'bg-blue-600 hover:bg-blue-700'
                    }`}
                    whileHover={{ scale: mlsDuplicateWarning ? 1 : 1.02 }}
                    whileTap={{ scale: mlsDuplicateWarning ? 1 : 0.98 }}
                  >
                    <Wand2 className="w-4 h-4" />
                    <span>Extract</span>
                  </motion.button>
                </div>
              </div>

              {/* Address */}
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  <MapPin className="w-4 h-4 inline mr-2" />
                  Address *
                </label>
                <input
                  type="text"
                  value={formData.address}
                  onChange={(e) => setFormData(prev => ({ ...prev, address: e.target.value }))}
                  className="w-full px-4 py-3 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                  placeholder="123 Main Street, Louisville, KY 40202"
                  required
                />
              </div>

              {/* Price */}
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  <DollarSign className="w-4 h-4 inline mr-2" />
                  Price *
                </label>
                <input
                  type="number"
                  value={formData.price || ''}
                  onChange={(e) => setFormData(prev => ({ ...prev, price: parseInt(e.target.value) || 0 }))}
                  className="w-full px-4 py-3 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                  placeholder="450000"
                  required
                />
              </div>

              {/* Description */}
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Description *
                </label>
                <input
                  type="text"
                  value={formData.description}
                  onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                  className="w-full px-4 py-3 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                  placeholder="Beautiful 3BR/2BA ranch with updated kitchen and large backyard"
                  maxLength={120}
                  required
                />
                <p className="text-xs text-slate-400 mt-1">
                  {formData.description.length}/120 characters
                </p>
              </div>

              {/* Image Upload - Same as before */}
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Property Image
                </label>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onDrop={handleDrop}
                    className={`relative border-2 border-dashed rounded-lg p-6 text-center transition-colors ${
                      dragOver
                        ? 'border-blue-500 bg-blue-500/10'
                        : 'border-slate-600 hover:border-slate-500'
                    }`}
                  >
                    <Upload className="w-8 h-8 text-slate-400 mx-auto mb-2" />
                    <p className="text-sm text-slate-300 mb-1">Drop image here</p>
                    <p className="text-xs text-slate-500">or click to browse</p>
                    
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          const url = URL.createObjectURL(file);
                          handleImageUrl(url);
                        }
                      }}
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                    />
                  </div>

                  <div>
                    <label className="block text-sm text-slate-400 mb-2">Or paste image URL:</label>
                    <div className="flex space-x-2">
                      <input
                        type="url"
                        value={formData.imageUrl}
                        onChange={(e) => setFormData(prev => ({ ...prev, imageUrl: e.target.value }))}
                        className="flex-1 px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 text-sm"
                        placeholder="https://example.com/image.jpg"
                      />
                      <button
                        type="button"
                        onClick={() => handleImageUrl(formData.imageUrl)}
                        className="px-3 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors flex items-center"
                      >
                        <LinkIcon className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>

                {/* Image Preview */}
                {imagePreview && (
                  <div className="mt-4">
                    <div className="relative group w-full h-32 bg-slate-700 rounded-lg overflow-hidden">
                      <img
                        src={imagePreview}
                        alt="Property preview"
                        className="w-full h-full object-cover"
                      />
                      <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                        <div className="flex items-center space-x-2 text-white">
                          <Check className="w-4 h-4" />
                          <span className="text-sm">Image loaded successfully</span>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setImagePreview(null);
                          setFormData(prev => ({ ...prev, imageUrl: '' }));
                        }}
                        className="absolute top-2 right-2 w-6 h-6 bg-red-500 hover:bg-red-600 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Form Actions */}
              <div className="flex items-center justify-between pt-6 border-t border-slate-700">
                <div className="text-sm text-slate-400">
                  {bulkMode && !editingProperty && (
                    <span>💡 Keep adding properties, then send bulk email</span>
                  )}
                  {editingProperty && (
                    <span>✏️ Editing existing property</span>
                  )}
                </div>
                
                <div className="flex items-center space-x-4">
                  <button
                    type="button"
                    onClick={onClose}
                    className="px-6 py-3 text-slate-400 hover:text-white transition-colors"
                    disabled={isLoading}
                  >
                    Cancel
                  </button>
                  
                  <motion.button
                    type="submit"
                    disabled={isLoading || !selectedClient || mlsDuplicateWarning}
                    className={`px-8 py-3 text-white rounded-lg font-medium transition-all duration-200 disabled:cursor-not-allowed ${
                      editingProperty
                        ? 'bg-gradient-to-r from-green-600 to-green-700 hover:from-green-500 hover:to-green-600 disabled:from-slate-600 disabled:to-slate-600'
                        : !bulkMode
                        ? 'bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-500 hover:to-blue-600 disabled:from-slate-600 disabled:to-slate-600'
                        : 'bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-500 hover:to-purple-600 disabled:from-slate-600 disabled:to-slate-600'
                    }`}
                    whileHover={{ scale: (isLoading || mlsDuplicateWarning) ? 1 : 1.02 }}
                    whileTap={{ scale: (isLoading || mlsDuplicateWarning) ? 1 : 0.98 }}
                  >
                    {isLoading ? (
                      <div className="flex items-center">
                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin mr-2" />
                        {editingProperty ? 'Updating...' : 'Adding...'}
                      </div>
                    ) : mlsDuplicateWarning ? (
                      <div className="flex items-center">
                        <AlertTriangle className="w-4 h-4 mr-2" />
                        Duplicate Blocked
                      </div>
                    ) : editingProperty ? (
                      <div className="flex items-center">
                        <Check className="w-4 h-4 mr-2" />
                        Update Property
                      </div>
                    ) : !bulkMode ? (
                      <div className="flex items-center">
                        <Mail className="w-4 h-4 mr-2" />
                        Add & Send Email
                      </div>
                    ) : (
                      <div className="flex items-center">
                        <Package className="w-4 h-4 mr-2" />
                        Add to Queue
                      </div>
                    )}
                  </motion.button>
                </div>
              </div>
            </form>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}