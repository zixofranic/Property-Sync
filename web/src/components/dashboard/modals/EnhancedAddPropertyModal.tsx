// apps/web/src/components/dashboard/modals/EnhancedAddPropertyModal.tsx
'use client';

import { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  X, Upload, MapPin, DollarSign, Home, Camera, 
  ExternalLink, Zap, Mail, Package, Wand2 
} from 'lucide-react';
import { useMissionControlStore } from '@/stores/missionControlStore';

interface EnhancedAddPropertyModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface PropertyFormData {
  address: string;
  price: number;
  bedrooms: number;
  bathrooms: number;
  squareFeet: number;
  lotSize: string;
  yearBuilt: number;
  propertyType: 'house' | 'condo' | 'townhouse' | 'apartment';
  description: string;
  mls: string;
  mlsLink: string;
  virtualTourUrl: string;
  images: string[];
}

type SendMode = 'individual' | 'bulk';

export function EnhancedAddPropertyModal({ isOpen, onClose }: EnhancedAddPropertyModalProps) {
  const { selectedClient, addProperty, addNotification } = useMissionControlStore();
  const [sendMode, setSendMode] = useState<SendMode>('individual');
  const [formData, setFormData] = useState<PropertyFormData>({
    address: '',
    price: 0,
    bedrooms: 3,
    bathrooms: 2,
    squareFeet: 0,
    lotSize: '',
    yearBuilt: new Date().getFullYear(),
    propertyType: 'house',
    description: '',
    mls: '',
    mlsLink: '',
    virtualTourUrl: '',
    images: []
  });
  const [isLoading, setIsLoading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const extractAddressFromMLS = () => {
    if (!formData.mlsLink) {
      addNotification({
        type: 'warning',
        title: 'No MLS Link',
        message: 'Please enter a MLS link first.'
      });
      return;
    }

    try {
      const url = new URL(formData.mlsLink);
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
          message: `Address extracted from MLS link: ${extractedAddress}`
        });
      } else {
        throw new Error('Could not extract address from URL');
      }
    } catch (error) {
      addNotification({
        type: 'error',
        title: 'Extraction Failed',
        message: 'Could not extract address from MLS link. Please check the URL format.'
      });
    }
  };

  const generateMapsLink = () => {
    if (formData.address) {
      const mapsUrl = `https://maps.google.com/maps?q=${encodeURIComponent(formData.address)}`;
      window.open(mapsUrl, '_blank');
    }
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

    const files = Array.from(e.dataTransfer.files);
    const imageFiles = files.filter(file => file.type.startsWith('image/'));
    
    if (imageFiles.length > 0) {
      const imageUrls = imageFiles.map(file => URL.createObjectURL(file));
      setFormData(prev => ({
        ...prev,
        images: [...prev.images, ...imageUrls].slice(0, 5)
      }));
      
      addNotification({
        type: 'success',
        title: 'Images Added',
        message: `Added ${imageFiles.length} image(s) to the property.`
      });
    }

    const urlData = e.dataTransfer.getData('text/uri-list');
    if (urlData && urlData.startsWith('http')) {
      setFormData(prev => ({
        ...prev,
        images: [...prev.images, urlData].slice(0, 5)
      }));
      
      addNotification({
        type: 'success',
        title: 'Image URL Added',
        message: 'Image URL added from drag and drop.'
      });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!selectedClient) {
      addNotification({
        type: 'error',
        title: 'No Client Selected',
        message: 'Please select a client before adding a property.'
      });
      return;
    }

    if (!formData.address || !formData.price) {
      addNotification({
        type: 'error',
        title: 'Missing Information',
        message: 'Please fill in the address and price fields.'
      });
      return;
    }

    setIsLoading(true);

    try {
      await new Promise(resolve => setTimeout(resolve, 1000));

      addProperty(selectedClient.id, {
        ...formData,
        images: formData.images.length > 0 ? formData.images : ['/api/placeholder/400/300']
      });

      const modeText = sendMode === 'individual' ? 'Email sent to client!' : 'Added to bulk queue';
      
      addNotification({
        type: 'success',
        title: 'Property Added',
        message: `Successfully added ${formData.address}. ${modeText}`
      });

      setFormData({
        address: '',
        price: 0,
        bedrooms: 3,
        bathrooms: 2,
        squareFeet: 0,
        lotSize: '',
        yearBuilt: new Date().getFullYear(),
        propertyType: 'house',
        description: '',
        mls: '',
        mlsLink: '',
        virtualTourUrl: '',
        images: []
      });

      if (sendMode === 'individual') {
        onClose();
      }
    } catch (error) {
      addNotification({
        type: 'error',
        title: 'Failed to Add Property',
        message: 'Something went wrong. Please try again.'
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
            className="bg-slate-800 border border-slate-700 rounded-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between p-6 border-b border-slate-700">
              <div>
                <h2 className="text-2xl font-bold text-white">Add New Property</h2>
                {selectedClient && (
                  <p className="text-slate-400 mt-1">for {selectedClient.name}</p>
                )}
              </div>
              
              <div className="flex items-center space-x-4">
                <div className="flex items-center space-x-2 bg-slate-700 rounded-lg p-1">
                  <button
                    onClick={() => setSendMode('individual')}
                    className={`flex items-center space-x-2 px-3 py-2 rounded-md text-sm transition-colors ${
                      sendMode === 'individual'
                        ? 'bg-blue-600 text-white'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    <Mail className="w-4 h-4" />
                    <span>Send Email</span>
                  </button>
                  <button
                    onClick={() => setSendMode('bulk')}
                    className={`flex items-center space-x-2 px-3 py-2 rounded-md text-sm transition-colors ${
                      sendMode === 'bulk'
                        ? 'bg-purple-600 text-white'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    <Package className="w-4 h-4" />
                    <span>Bulk Mode</span>
                  </button>
                </div>

                <button
                  onClick={onClose}
                  className="p-2 hover:bg-slate-700 rounded-lg transition-colors"
                >
                  <X className="w-5 h-5 text-slate-400" />
                </button>
              </div>
            </div>

            <div className="px-6 py-3 bg-slate-700/30 border-b border-slate-700">
              {sendMode === 'individual' ? (
                <p className="text-sm text-slate-300">
                  📧 <strong>Individual Mode:</strong> Property will be added and email sent immediately to the client.
                </p>
              ) : (
                <p className="text-sm text-slate-300">
                  📦 <strong>Bulk Mode:</strong> Properties will be queued up. Use "Send Bulk Properties" when ready to email all at once.
                </p>
              )}
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-6 overflow-y-auto max-h-[calc(90vh-200px)]">
              <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-4">
                <label className="block text-sm font-medium text-blue-300 mb-2">
                  <ExternalLink className="w-4 h-4 inline mr-2" />
                  MLS Link (Most Important)
                </label>
                <div className="flex space-x-2">
                  <input
                    type="url"
                    value={formData.mlsLink}
                    onChange={(e) => setFormData(prev => ({ ...prev, mlsLink: e.target.value }))}
                    className="flex-1 px-4 py-3 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                    placeholder="https://www.flexmls.com/.../3512-Autumn-Way-Louisville-KY-40218"
                  />
                  <motion.button
                    type="button"
                    onClick={extractAddressFromMLS}
                    className="px-4 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors flex items-center space-x-2"
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                  >
                    <Wand2 className="w-4 h-4" />
                    <span>Extract Address</span>
                  </motion.button>
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-sm font-medium text-slate-300">
                    <MapPin className="w-4 h-4 inline mr-2" />
                    Property Address *
                  </label>
                  {formData.address && (
                    <button
                      type="button"
                      onClick={generateMapsLink}
                      className="text-xs text-blue-400 hover:text-blue-300 flex items-center space-x-1"
                    >
                      <MapPin className="w-3 h-3" />
                      <span>View on Maps</span>
                    </button>
                  )}
                </div>
                <input
                  type="text"
                  value={formData.address}
                  onChange={(e) => setFormData(prev => ({ ...prev, address: e.target.value }))}
                  className="w-full px-4 py-3 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                  placeholder="123 Main Street, City, State 12345"
                  required
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
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

                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">Bedrooms</label>
                  <input
                    type="number"
                    value={formData.bedrooms}
                    onChange={(e) => setFormData(prev => ({ ...prev, bedrooms: parseInt(e.target.value) || 0 }))}
                    className="w-full px-4 py-3 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                    min="0"
                    max="20"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">Bathrooms</label>
                  <input
                    type="number"
                    step="0.5"
                    value={formData.bathrooms}
                    onChange={(e) => setFormData(prev => ({ ...prev, bathrooms: parseFloat(e.target.value) || 0 }))}
                    className="w-full px-4 py-3 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                    min="0"
                    max="20"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  One-line Description *
                </label>
                <input
                  type="text"
                  value={formData.description}
                  onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                  className="w-full px-4 py-3 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                  placeholder="Beautiful 3BR/2BA ranch with updated kitchen, hardwood floors, and large backyard"
                  maxLength={150}
                  required
                />
                <p className="text-xs text-slate-400 mt-1">
                  {formData.description.length}/150 characters
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  <Camera className="w-4 h-4 inline mr-2" />
                  Property Images
                </label>
                
                <div
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  className={`relative border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
                    dragOver
                      ? 'border-blue-500 bg-blue-500/10'
                      : 'border-slate-600 hover:border-slate-500'
                  }`}
                >
                  <Upload className="w-12 h-12 text-slate-400 mx-auto mb-4" />
                  <p className="text-slate-300 mb-2">Drop images here or click to browse</p>
                  <p className="text-sm text-slate-400 mb-4">
                    Drag from any website, upload files, or paste URL below
                  </p>
                  <p className="text-xs text-slate-500">
                    Supports: JPG, PNG, GIF, WEBP (max 10MB)
                  </p>
                  
                  <input
                    ref={fileInputRef}
                    type="file"
                    multiple
                    accept="image/*"
                    onChange={(e) => {
                      const files = Array.from(e.target.files || []);
                      const imageUrls = files.map(file => URL.createObjectURL(file));
                      setFormData(prev => ({
                        ...prev,
                        images: [...prev.images, ...imageUrls].slice(0, 5)
                      }));
                    }}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  />
                </div>

                {formData.images.length > 0 && (
                  <div className="mt-4 grid grid-cols-2 md:grid-cols-5 gap-4">
                    {formData.images.map((image, index) => (
                      <div key={image} className="relative group">
                        <img
                          src={image}
                          alt={`Property image ${index + 1}`}
                          className="w-full h-24 object-cover rounded-lg border border-slate-600"
                        />
                        <button
                          type="button"
                          onClick={() => setFormData(prev => ({
                            ...prev,
                            images: prev.images.filter((_, i) => i !== index)
                          }))}
                          className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 hover:bg-red-600 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="flex items-center justify-between pt-6 border-t border-slate-700">
                <div className="text-sm text-slate-400">
                  {sendMode === 'bulk' && (
                    <span>💡 Tip: Keep adding properties, then use "Send Bulk" when ready</span>
                  )}
                </div>
                
                <div className="flex items-center space-x-4">
                  <button
                    type="button"
                    onClick={onClose}
                    className="px-6 py-3 text-slate-400 hover:text-white transition-colors"
                    disabled={isLoading}
                  >
                    {sendMode === 'bulk' ? 'Close' : 'Cancel'}
                  </button>
                  
                  <motion.button
                    type="submit"
                    disabled={isLoading || !selectedClient}
                    className={`px-8 py-3 text-white rounded-lg font-medium transition-all duration-200 disabled:cursor-not-allowed ${
                      sendMode === 'individual'
                        ? 'bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-500 hover:to-blue-600 disabled:from-slate-600 disabled:to-slate-600'
                        : 'bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-500 hover:to-purple-600 disabled:from-slate-600 disabled:to-slate-600'
                    }`}
                    whileHover={{ scale: isLoading ? 1 : 1.02 }}
                    whileTap={{ scale: isLoading ? 1 : 0.98 }}
                  >
                    {isLoading ? (
                      <div className="flex items-center">
                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin mr-2" />
                        Adding...
                      </div>
                    ) : sendMode === 'individual' ? (
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