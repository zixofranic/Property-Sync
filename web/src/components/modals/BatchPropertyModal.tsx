'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  X, Plus, ExternalLink, AlertTriangle, CheckCircle, 
  Clock, Loader2, Trash2, Edit3, Eye, Upload,
  Home, DollarSign, Bed, Bath, Square
} from 'lucide-react';
import { useMissionControlStore } from '@/stores/missionControlStore';
import { apiClient, BatchProperty, PropertyBatch } from '@/lib/api-client';

interface BatchPropertyModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function BatchPropertyModal({ isOpen, onClose }: BatchPropertyModalProps) {
  const { 
    selectedClient, 
    getClientTimeline,
    addNotification,
    loadTimeline
  } = useMissionControlStore();

  // State management
  const [currentMlsUrl, setCurrentMlsUrl] = useState('');
  const [mlsUrls, setMlsUrls] = useState<string[]>([]);
  const [batch, setBatch] = useState<PropertyBatch | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [selectedProperties, setSelectedProperties] = useState<Set<string>>(new Set());
  const [editingDescriptions, setEditingDescriptions] = useState<Record<string, string>>({});
  const [editingBeds, setEditingBeds] = useState<Record<string, string>>({});
  const [editingBaths, setEditingBaths] = useState<Record<string, string>>({});
  const [editingSqft, setEditingSqft] = useState<Record<string, string>>({});
  const [showImportSummary, setShowImportSummary] = useState(false);
  const [importResults, setImportResults] = useState<any>(null);

  // Current timeline
  const currentTimeline = selectedClient ? getClientTimeline(selectedClient.id) : null;

  // Reset state when modal opens/closes
  useEffect(() => {
    if (isOpen) {
      setCurrentMlsUrl('');
      setMlsUrls([]);
      setBatch(null);
      setSelectedProperties(new Set());
      setEditingDescriptions({});
      setEditingBeds({});
      setEditingBaths({});
      setEditingSqft({});
      setShowImportSummary(false);
      setImportResults(null);
    }
  }, [isOpen]);

  // Poll batch status
  useEffect(() => {
    if (!batch?.id || batch.status === 'completed' || batch.status === 'failed') return;

    const interval = setInterval(async () => {
      try {
        const response = await apiClient.getBatchStatus(batch.id);
        if (response.data) {
          setBatch(response.data);
        }
      } catch (error) {
        console.error('Failed to poll batch status:', error);
      }
    }, 2000);

    return () => clearInterval(interval);
  }, [batch]);

  // Add MLS URL to queue
  const handleAddMlsUrl = () => {
    const trimmedUrl = currentMlsUrl.trim();
    
    if (!trimmedUrl) {
      addNotification({
        type: 'warning',
        title: 'No URL Provided',
        message: 'Please enter a MLS URL',
        read: false
      });
      return;
    }

    if (!trimmedUrl.includes('flexmls.com')) {
      addNotification({
        type: 'error',
        title: 'Invalid MLS URL',
        message: 'Only FlexMLS URLs are currently supported',
        read: false
      });
      return;
    }

    if (mlsUrls.includes(trimmedUrl)) {
      addNotification({
        type: 'warning',
        title: 'Duplicate URL',
        message: 'This URL is already in the queue',
        read: false
      });
      return;
    }

    setMlsUrls(prev => [...prev, trimmedUrl]);
    setCurrentMlsUrl('');
    
    addNotification({
      type: 'success',
      title: 'URL Added',
      message: 'MLS URL added to queue',
      read: false
    });

    // Auto-processing disabled to prevent spurious error messages
    // Users can manually click "Start Processing" when ready
  };

  // Remove URL from queue
  const handleRemoveUrl = (urlToRemove: string) => {
    setMlsUrls(prev => prev.filter(url => url !== urlToRemove));
  };

  // Start batch processing
  const handleStartProcessing = async () => {
    if (!selectedClient || mlsUrls.length === 0) {
      addNotification({
        type: 'error',
        title: 'Cannot Start Processing',
        message: 'No client selected or no URLs in queue',
        read: false
      });
      return;
    }

    setIsProcessing(true);
    
    try {
      const response = await apiClient.createAndParseBatch(
        selectedClient.id,
        currentTimeline?.id || '',
        mlsUrls
      );

      if (response.error) {
        throw new Error(response.error);
      }

      if (response.data) {
        // Immediately fetch the full batch object
        const batchStatusResponse = await apiClient.getBatchStatus(response.data.batchId);
        if (batchStatusResponse.data) {
          setBatch(batchStatusResponse.data);
        }
        
        addNotification({
          type: 'success',
          title: 'Batch Created!',
          message: `Started parsing ${mlsUrls.length} properties. Review and select which properties to import.`,
          read: false
        });
      }
    } catch (error) {
      addNotification({
        type: 'error',
        title: 'Processing Failed',
        message: error.message,
        read: false
      });
    } finally {
      setIsProcessing(false);
    }
  };

  // Toggle property selection
  const handleToggleProperty = (propertyId: string) => {
    setSelectedProperties(prev => {
      const newSet = new Set(prev);
      if (newSet.has(propertyId)) {
        newSet.delete(propertyId);
      } else {
        newSet.add(propertyId);
      }
      return newSet;
    });
  };

  // Select all valid properties
  const handleSelectAll = () => {
    if (!batch?.properties) return;
    
    const validProperties = batch.properties.filter(p => 
      p.parseStatus === 'parsed' && p.parsedData
    );
    
    setSelectedProperties(new Set(validProperties.map(p => p.id)));
  };

  // Deselect all properties
  const handleDeselectAll = () => {
    setSelectedProperties(new Set());
  };

  // Import selected properties
  const handleImportProperties = async () => {
    if (!batch || selectedProperties.size === 0) return;

    setIsImporting(true);

    try {
      const propertiesToImport = Array.from(selectedProperties).map(propertyId => ({
        batchPropertyId: propertyId,
        customDescription: editingDescriptions[propertyId],
        agentNotes: '',
        customBeds: editingBeds[propertyId],
        customBaths: editingBaths[propertyId],
        customSqft: editingSqft[propertyId]
      }));

      const response = await apiClient.importBatchProperties(batch.id, propertiesToImport);

      if (response.error) {
        throw new Error(response.error);
      }

      if (response.data) {
        setImportResults(response.data);
        setShowImportSummary(true);
        
        addNotification({
          type: 'success',
          title: 'Import Complete',
          message: `Successfully imported ${response.data.summary.successful} properties`,
          read: false
        });

        // Refresh timeline
        if (selectedClient) {
          await loadTimeline(selectedClient.id);
        }

        // Add email reminder notification after successful import
        if (response.data.summary.successful > 0) {
          setTimeout(() => {
            addNotification({
              type: 'info',
              title: '📧 Email Reminder',
              message: `Ready to share ${response.data.summary.successful} new properties with ${selectedClient?.name}? Click "Share Timeline" to send email.`,
              read: false
            });
          }, 1000);
        }

        // Close modal after successful import and timeline refresh
        setTimeout(() => {
          onClose();
        }, 2000);
      }
    } catch (error) {
      addNotification({
        type: 'error',
        title: 'Import Failed',
        message: error.message,
        read: false
      });
    } finally {
      setIsImporting(false);
    }
  };

  // Update property description
  const handleUpdateDescription = (propertyId: string, description: string) => {
    setEditingDescriptions(prev => ({
      ...prev,
      [propertyId]: description
    }));
  };


  // Update beds
  const handleUpdateBeds = (propertyId: string, beds: string) => {
    setEditingBeds(prev => ({
      ...prev,
      [propertyId]: beds
    }));
  };

  // Update baths
  const handleUpdateBaths = (propertyId: string, baths: string) => {
    setEditingBaths(prev => ({
      ...prev,
      [propertyId]: baths
    }));
  };

  // Update sqft
  const handleUpdateSqft = (propertyId: string, sqft: string) => {
    setEditingSqft(prev => ({
      ...prev,
      [propertyId]: sqft
    }));
  };

  // Get status color and icon
  const getStatusDisplay = (status: string) => {
    switch (status) {
      case 'pending':
        return { color: 'text-yellow-400', icon: Clock, text: 'Pending' };
      case 'parsing':
        return { color: 'text-blue-400', icon: Loader2, text: 'Parsing...' };
      case 'parsed':
        return { color: 'text-green-400', icon: CheckCircle, text: 'Ready' };
      case 'failed':
        return { color: 'text-red-400', icon: AlertTriangle, text: 'Failed' };
      case 'imported':
        return { color: 'text-purple-400', icon: CheckCircle, text: 'Imported' };
      default:
        return { color: 'text-gray-400', icon: Clock, text: status };
    }
  };

  const validPropertiesCount = batch?.properties?.filter(p => 
    p.parseStatus === 'parsed' && p.parsedData
  ).length || 0;

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
            className="bg-slate-800 border border-slate-700 rounded-2xl w-full max-w-6xl max-h-[90vh] overflow-hidden"
            onClick={e => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-slate-700">
              <div>
                <h2 className="text-2xl font-bold text-white">
                  Batch Import Properties
                </h2>
                {selectedClient && (
                  <p className="text-slate-400 mt-1">for {selectedClient.name}</p>
                )}
              </div>
              
              <button
                onClick={onClose}
                className="p-2 hover:bg-slate-700 rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-slate-400" />
              </button>
            </div>

            {/* Content */}
            <div className="p-6 overflow-y-auto max-h-[calc(90vh-200px)]">
              {!batch ? (
                /* URL Input Phase */
                <div className="space-y-6">
                  {/* URL Input */}
                  <div className="bg-slate-700/30 rounded-lg p-4">
                    <label className="block text-sm font-medium text-slate-300 mb-2">
                      <ExternalLink className="w-4 h-4 inline mr-2" />
                      Add MLS URLs
                    </label>
                    
                    <div className="flex space-x-2">
                      <input
                        type="url"
                        value={currentMlsUrl}
                        onChange={(e) => setCurrentMlsUrl(e.target.value)}
                        onKeyPress={(e) => e.key === 'Enter' && handleAddMlsUrl()}
                        className="flex-1 px-4 py-3 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                        placeholder="https://www.flexmls.com/share/..."
                      />
                      <button
                        onClick={handleAddMlsUrl}
                        className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors flex items-center space-x-2"
                      >
                        <Plus className="w-4 h-4" />
                        <span>Add</span>
                      </button>
                    </div>
                  </div>

                  {/* URL Queue */}
                  {mlsUrls.length > 0 && (
                    <div className="bg-slate-700/30 rounded-lg p-4">
                      <h3 className="text-lg font-semibold text-white mb-4">
                        Queued URLs ({mlsUrls.length})
                      </h3>
                      
                      <div className="space-y-2">
                        {mlsUrls.map((url, index) => (
                          <div key={url} className="flex items-center justify-between bg-slate-700 rounded-lg p-3">
                            <div className="flex-1">
                              <p className="text-white font-mono text-sm truncate">{url}</p>
                            </div>
                            <button
                              onClick={() => handleRemoveUrl(url)}
                              className="p-1 hover:bg-slate-600 rounded transition-colors"
                            >
                              <Trash2 className="w-4 h-4 text-red-400" />
                            </button>
                          </div>
                        ))}
                      </div>
                      
                      <div className="mt-4 flex justify-between items-center">
                        <p className="text-slate-400 text-sm">
                          Ready to parse {mlsUrls.length} properties
                        </p>
                        <button
                          onClick={handleStartProcessing}
                          disabled={isProcessing || !selectedClient}
                          className="px-6 py-3 bg-green-600 hover:bg-green-700 disabled:bg-slate-600 disabled:cursor-not-allowed text-white rounded-lg transition-colors flex items-center space-x-2"
                        >
                          {isProcessing ? (
                            <>
                              <Loader2 className="w-4 h-4 animate-spin" />
                              <span>Starting...</span>
                            </>
                          ) : (
                            <>
                              <Upload className="w-4 h-4" />
                              <span>Start Processing</span>
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                /* Batch Processing Phase */
                <div className="space-y-6">
                  {/* Batch Status */}
                  <div className="bg-slate-700/30 rounded-lg p-4">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-lg font-semibold text-white">
                        Processing Status
                      </h3>
                      <div className="flex items-center space-x-4 text-sm">
                        <span className="text-green-400">
                          {batch.successCount} parsed
                        </span>
                        <span className="text-red-400">
                          {batch.failureCount} failed
                        </span>
                        <span className="text-slate-400">
                          {batch.totalProperties - batch.successCount - batch.failureCount} pending
                        </span>
                      </div>
                    </div>
                    
                    {/* Progress Bar */}
                    <div className="w-full bg-slate-700 rounded-full h-2 mb-2">
                      <div 
                        className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                        style={{ 
                          width: `${((batch.successCount + batch.failureCount) / batch.totalProperties) * 100}%` 
                        }}
                      />
                    </div>
                    
                    <p className="text-slate-400 text-sm">
                      {batch.status === 'processing' ? 'Parsing properties...' : 
                       batch.status === 'completed' ? 'Processing complete' : 
                       'Ready to import'}
                    </p>
                  </div>

                  {/* Property List */}
                  <div className="space-y-4">
                    {validPropertiesCount > 0 && (
                      <div className="flex items-center justify-between">
                        <h3 className="text-lg font-semibold text-white">
                          Parsed Properties ({validPropertiesCount})
                        </h3>
                        <div className="flex items-center space-x-2">
                          <button
                            onClick={handleSelectAll}
                            className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded text-sm transition-colors"
                          >
                            Select All
                          </button>
                          <button
                            onClick={handleDeselectAll}
                            className="px-3 py-1 bg-slate-600 hover:bg-slate-700 text-white rounded text-sm transition-colors"
                          >
                            Deselect All
                          </button>
                        </div>
                      </div>
                    )}
                    
                    {batch.properties?.map((property) => (
                      <PropertyQueueItem
                        key={property.id}
                        property={property}
                        isSelected={selectedProperties.has(property.id)}
                        onToggleSelect={() => handleToggleProperty(property.id)}
                        description={editingDescriptions[property.id] || ''}
                        onUpdateDescription={(desc) => handleUpdateDescription(property.id, desc)}
                        beds={editingBeds[property.id] || property.parsedData?.beds || ''}
                        onUpdateBeds={(beds) => handleUpdateBeds(property.id, beds)}
                        baths={editingBaths[property.id] || property.parsedData?.baths || ''}
                        onUpdateBaths={(baths) => handleUpdateBaths(property.id, baths)}
                        sqft={editingSqft[property.id] || property.parsedData?.sqft || ''}
                        onUpdateSqft={(sqft) => handleUpdateSqft(property.id, sqft)}
                        getStatusDisplay={getStatusDisplay}
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Footer */}
            {batch && validPropertiesCount > 0 && (
              <div className="p-6 border-t border-slate-700 bg-slate-800/50">
                <div className="flex items-center justify-between">
                  <p className="text-slate-400">
                    {selectedProperties.size} of {validPropertiesCount} properties selected
                  </p>
                  
                  <div className="flex items-center space-x-4">
                    <button
                      onClick={onClose}
                      className="px-6 py-3 text-slate-400 hover:text-white transition-colors"
                    >
                      Cancel
                    </button>
                    
                    <button
                      onClick={handleImportProperties}
                      disabled={selectedProperties.size === 0 || isImporting}
                      className="px-8 py-3 bg-green-600 hover:bg-green-700 disabled:bg-slate-600 disabled:cursor-not-allowed text-white rounded-lg font-medium transition-colors flex items-center space-x-2"
                    >
                      {isImporting ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          <span>Importing...</span>
                        </>
                      ) : (
                        <>
                          <Upload className="w-4 h-4" />
                          <span>Import {selectedProperties.size} Properties</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Import Summary Modal */}
            {showImportSummary && importResults && (
              <ImportSummaryModal
                results={importResults}
                onClose={() => {
                  setShowImportSummary(false);
                  onClose();
                }}
              />
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// Property Queue Item Component
function PropertyQueueItem({
  property,
  isSelected,
  onToggleSelect,
  description,
  onUpdateDescription,
  beds,
  onUpdateBeds,
  baths,
  onUpdateBaths,
  sqft,
  onUpdateSqft,
  getStatusDisplay
}: {
  property: BatchProperty;
  isSelected: boolean;
  onToggleSelect: () => void;
  description: string;
  onUpdateDescription: (desc: string) => void;
  beds: string;
  onUpdateBeds: (beds: string) => void;
  baths: string;
  onUpdateBaths: (baths: string) => void;
  sqft: string;
  onUpdateSqft: (sqft: string) => void;
  getStatusDisplay: (status: string) => any;
}) {
  const status = getStatusDisplay(property.parseStatus);
  const StatusIcon = status.icon;

  return (
    <div className={`border rounded-lg p-4 transition-all ${
      property.parseStatus === 'parsed' && isSelected
        ? 'border-blue-500 bg-blue-500/10'
        : property.parseStatus === 'parsed'
        ? 'border-slate-600 bg-slate-700/30'
        : 'border-slate-700 bg-slate-800/30'
    }`}>
      <div className="flex items-start space-x-4">
        {/* Selection Checkbox */}
        {property.parseStatus === 'parsed' && property.parsedData && (
          <button
            onClick={onToggleSelect}
            className={`mt-1 w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${
              isSelected
                ? 'border-blue-500 bg-blue-500'
                : 'border-slate-400 hover:border-blue-400'
            }`}
          >
            {isSelected && <CheckCircle className="w-3 h-3 text-white" />}
          </button>
        )}

        {/* Content */}
        <div className="flex-1">
          {/* Status and URL */}
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center space-x-2">
              <StatusIcon className={`w-4 h-4 ${status.color} ${
                property.parseStatus === 'parsing' ? 'animate-spin' : ''
              }`} />
              <span className={`text-sm font-medium ${status.color}`}>
                {status.text}
              </span>
            </div>
            <p className="text-xs text-slate-500 font-mono truncate max-w-md">
              {property.mlsUrl}
            </p>
          </div>

          {/* Error Message */}
          {property.parseError && (
            <div className="mb-3 p-2 bg-red-500/20 border border-red-500/30 rounded text-red-300 text-sm">
              {property.parseError}
            </div>
          )}

          {/* Parsed Data */}
          {property.parsedData && (
            <div className="space-y-3">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Property Info */}
                <div>
                  <h4 className="text-white font-semibold mb-2 flex items-center">
                    <Home className="w-4 h-4 mr-2" />
                    {property.parsedData.address}
                  </h4>
                  
                  <div className="flex items-center space-x-4 text-sm text-slate-300">
                    <div className="flex items-center space-x-1">
                      <DollarSign className="w-3 h-3" />
                      <span>{property.parsedData.price}</span>
                    </div>
                    {property.parsedData.beds && (
                      <div className="flex items-center space-x-1">
                        <Bed className="w-3 h-3" />
                        <span>{property.parsedData.beds}</span>
                      </div>
                    )}
                    {property.parsedData.baths && (
                      <div className="flex items-center space-x-1">
                        <Bath className="w-3 h-3" />
                        <span>{property.parsedData.baths}</span>
                      </div>
                    )}
                    {property.parsedData.sqft && (
                      <div className="flex items-center space-x-1">
                        <Square className="w-3 h-3" />
                        <span>{property.parsedData.sqft}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Images Preview */}
                {property.parsedData.images.length > 0 && (
                  <div>
                    <p className="text-sm text-slate-400 mb-2">
                      {property.parsedData.imageCount} images found
                    </p>
                    <div className="flex space-x-2">
                      {property.parsedData.images.slice(0, 3).map((imageUrl, index) => (
                        <img
                          key={imageUrl}
                          src={imageUrl}
                          alt={`Property ${index + 1}`}
                          className="w-16 h-16 object-cover rounded border border-slate-600"
                        />
                      ))}
                      {property.parsedData.imageCount > 3 && (
                        <div className="w-16 h-16 bg-slate-700 rounded border border-slate-600 flex items-center justify-center">
                          <span className="text-xs text-slate-400">
                            +{property.parsedData.imageCount - 3}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Custom Description */}
              {isSelected && (
                <div className="space-y-3">
                  <div>
                    <label className="block text-sm text-slate-400 mb-1">
                      Custom Description (optional)
                    </label>
                    <input
                      type="text"
                      value={description}
                      onChange={(e) => onUpdateDescription(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded text-white placeholder-slate-400 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 text-sm"
                      placeholder="Override the auto-generated description..."
                    />
                  </div>
                  
                  {/* Property Details Editing */}
                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <label className="block text-sm text-slate-400 mb-1">
                        <Bed className="w-3 h-3 inline mr-1" />
                        Beds
                      </label>
                      <input
                        type="text"
                        value={beds}
                        onChange={(e) => onUpdateBeds(e.target.value)}
                        className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded text-white placeholder-slate-400 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 text-sm"
                        placeholder="e.g., 3"
                      />
                    </div>
                    <div>
                      <label className="block text-sm text-slate-400 mb-1">
                        <Bath className="w-3 h-3 inline mr-1" />
                        Baths
                      </label>
                      <input
                        type="text"
                        value={baths}
                        onChange={(e) => onUpdateBaths(e.target.value)}
                        className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded text-white placeholder-slate-400 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 text-sm"
                        placeholder="e.g., 2.5"
                      />
                    </div>
                    <div>
                      <label className="block text-sm text-slate-400 mb-1">
                        <Square className="w-3 h-3 inline mr-1" />
                        Sq Ft
                      </label>
                      <input
                        type="text"
                        value={sqft}
                        onChange={(e) => onUpdateSqft(e.target.value)}
                        className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded text-white placeholder-slate-400 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 text-sm"
                        placeholder="e.g., 1,500"
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// Import Summary Modal
function ImportSummaryModal({
  results,
  onClose
}: {
  results: any;
  onClose: () => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/50 backdrop-blur-sm z-60 flex items-center justify-center p-4"
    >
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        className="bg-slate-800 border border-slate-700 rounded-2xl w-full max-w-2xl p-6"
      >
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-xl font-bold text-white">Import Complete</h3>
          <button
            onClick={onClose}
            className="p-2 hover:bg-slate-700 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-slate-400" />
          </button>
        </div>

        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-4 text-center">
            <div className="bg-green-500/20 border border-green-500/30 rounded-lg p-4">
              <div className="text-2xl font-bold text-green-400">
                {results.summary.successful}
              </div>
              <div className="text-sm text-green-300">Successful</div>
            </div>
            <div className="bg-red-500/20 border border-red-500/30 rounded-lg p-4">
              <div className="text-2xl font-bold text-red-400">
                {results.summary.failed}
              </div>
              <div className="text-sm text-red-300">Failed</div>
            </div>
            <div className="bg-slate-500/20 border border-slate-500/30 rounded-lg p-4">
              <div className="text-2xl font-bold text-slate-400">
                {results.summary.total}
              </div>
              <div className="text-sm text-slate-300">Total</div>
            </div>
          </div>

          {/* Detailed Results */}
          <div className="max-h-60 overflow-y-auto space-y-2">
            {results.importResults.map((result: any, index: number) => (
              <div
                key={`result-${index}-${result.address || result.error || index}`}
                className={`p-3 rounded-lg border ${
                  result.success
                    ? 'bg-green-500/10 border-green-500/30'
                    : 'bg-red-500/10 border-red-500/30'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div>
                    {result.success ? (
                      <div className="text-green-300 font-medium">
                        {result.address}
                      </div>
                    ) : (
                      <div className="text-red-300 font-medium">
                        Import Failed
                      </div>
                    )}
                    {result.error && (
                      <div className="text-red-400 text-sm mt-1">
                        {result.error}
                      </div>
                    )}
                  </div>
                  <div className="text-right">
                    {result.success ? (
                      <CheckCircle className="w-5 h-5 text-green-400" />
                    ) : (
                      <AlertTriangle className="w-5 h-5 text-red-400" />
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-6 flex justify-end">
          <button
            onClick={onClose}
            className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
          >
            Close
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}