// apps/web/src/components/dashboard/modals/AddClientModal.tsx
'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, User, Mail, Phone, UserPlus, Heart, Edit3 } from 'lucide-react';
import { useMissionControlStore, Client } from '@/stores/missionControlStore';
import { useSafeModalClose } from '@/hooks/useSafeModalClose';

interface AddClientModalProps {
  isOpen: boolean;
  onClose: () => void;
  editingClient?: Client | null; // New prop for edit mode
}

interface ClientFormData {
  name: string;
  email: string;
  phone: string;
  spouseEmail: string;
}

export function AddClientModal({ isOpen, onClose, editingClient = null }: AddClientModalProps) {
  const { addClient, updateClient, addNotification } = useMissionControlStore();
  
  const [formData, setFormData] = useState<ClientFormData>({
    name: '',
    email: '',
    phone: '',
    spouseEmail: ''
  });
  const [initialFormData, setInitialFormData] = useState<ClientFormData>({
    name: '',
    email: '',
    phone: '',
    spouseEmail: ''
  });
  const [isLoading, setIsLoading] = useState(false);

  const isEditMode = !!editingClient;

  // Check if form has changes by comparing to initial state
  const hasUnsavedChanges = 
    formData.name !== initialFormData.name ||
    formData.email !== initialFormData.email ||
    formData.phone !== initialFormData.phone ||
    formData.spouseEmail !== initialFormData.spouseEmail;

  // Debug logging
  console.log('AddClientModal - hasUnsavedChanges:', hasUnsavedChanges, {
    isEditMode,
    formData,
    initialFormData,
    editingClient
  });

  const { handleBackdropClick, handleSafeClose } = useSafeModalClose({
    hasUnsavedChanges,
    onClose,
    confirmMessage: isEditMode 
      ? 'You have unsaved changes to this client. Discard changes?' 
      : 'You have unsaved client information. Discard and close?'
  });

  // Populate form when editing
  useEffect(() => {
    if (editingClient) {
      const clientData = {
        name: editingClient.name || '',
        email: editingClient.email || '',
        phone: editingClient.phone || '',
        spouseEmail: editingClient.spouseEmail || ''
      };
      setFormData(clientData);
      setInitialFormData(clientData);
    } else {
      // Reset form for add mode
      const emptyData = {
        name: '',
        email: '',
        phone: '',
        spouseEmail: ''
      };
      setFormData(emptyData);
      setInitialFormData(emptyData);
    }
  }, [editingClient, isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.name || !formData.email) {
      addNotification({
        type: 'error',
        title: 'Missing Information',
        message: 'Please fill in name and email fields.',
        read: false
      });
      return;
    }

    setIsLoading(true);

    try {
      if (isEditMode && editingClient) {
        // Edit existing client
        await updateClient(editingClient.id, {
          name: formData.name.trim(),
          email: formData.email.trim(),
          phone: formData.phone?.trim() || undefined,
          spouseEmail: formData.spouseEmail?.trim() || undefined,
        });

        addNotification({
          type: 'success',
          title: 'Client Updated',
          message: `${formData.name} has been updated successfully.`,
          read: false
        });
      } else {
        // Add new client
        const nameParts = formData.name.trim().split(' ');
        const firstName = nameParts[0] || '';
        const lastName = nameParts.slice(1).join(' ') || '';

        const clientData = {
          email: formData.email.trim(),
          phone: formData.phone?.trim() || undefined,
          spouseEmail: formData.spouseEmail?.trim() || undefined,
          firstName: firstName,
          lastName: lastName,
        };

        const success = await addClient(clientData);

        if (success) {
          addNotification({
            type: 'success',
            title: 'Client Added',
            message: `${formData.name} has been added to your client list.`,
            read: false
          });
        } else {
          throw new Error('Failed to create client');
        }
      }

      // Reset form and close
      setFormData({
        name: '',
        email: '',
        phone: '',
        spouseEmail: ''
      });
      onClose();

    } catch (error) {
      console.error('Client operation error:', error);
      addNotification({
        type: 'error',
        title: isEditMode ? 'Failed to Update Client' : 'Failed to Add Client',
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
          onClick={handleBackdropClick}
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            className="bg-slate-800 border border-slate-700 rounded-2xl w-full max-w-md overflow-hidden"
            onClick={e => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-slate-700">
              <div className="flex items-center space-x-3">
                <div className={`w-10 h-10 bg-gradient-to-br ${isEditMode ? 'from-orange-500 to-red-600' : 'from-blue-500 to-purple-600'} rounded-full flex items-center justify-center`}>
                  {isEditMode ? <Edit3 className="w-5 h-5 text-white" /> : <UserPlus className="w-5 h-5 text-white" />}
                </div>
                <div>
                  <h2 className="text-xl font-bold text-white">
                    {isEditMode ? 'Edit Client' : 'Add New Client'}
                  </h2>
                  <p className="text-sm text-slate-400">
                    {isEditMode ? 'Update client information' : 'Create a new client profile'}
                  </p>
                </div>
              </div>
              
              <button
                onClick={handleSafeClose}
                className="p-2 hover:bg-slate-700 rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-slate-400" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-6">
              {/* Client Name */}
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  <User className="w-4 h-4 inline mr-2" />
                  Client Name *
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  className="w-full px-4 py-3 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                  placeholder="Sarah & Mike Johnson"
                  required
                />
                <p className="text-xs text-slate-400 mt-1">
                  {isEditMode ? 'Update the client name' : 'Enter full name (will be split into first/last name)'}
                </p>
              </div>

              {/* Email */}
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  <Mail className="w-4 h-4 inline mr-2" />
                  Email Address *
                </label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                  className="w-full px-4 py-3 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                  placeholder="sarah.johnson@email.com"
                  required
                />
              </div>

              {/* Spouse Email */}
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  <Heart className="w-4 h-4 inline mr-2" />
                  Spouse Email
                </label>
                <input
                  type="email"
                  value={formData.spouseEmail}
                  onChange={(e) => setFormData(prev => ({ ...prev, spouseEmail: e.target.value }))}
                  className="w-full px-4 py-3 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                  placeholder="mike.johnson@email.com"
                />
                <p className="text-xs text-slate-400 mt-1">
                  Optional: Spouse will also receive property timeline emails
                </p>
              </div>

              {/* Phone */}
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  <Phone className="w-4 h-4 inline mr-2" />
                  Phone Number
                </label>
                <input
                  type="tel"
                  value={formData.phone}
                  onChange={(e) => setFormData(prev => ({ ...prev, phone: e.target.value }))}
                  className="w-full px-4 py-3 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                  placeholder="(555) 123-4567"
                />
              </div>

              {/* Form Actions */}
              <div className="flex items-center justify-end space-x-4 pt-4">
                <button
                  type="button"
                  onClick={handleSafeClose}
                  className="px-6 py-3 text-slate-400 hover:text-white transition-colors"
                  disabled={isLoading}
                >
                  Cancel
                </button>
                
                <motion.button
                  type="submit"
                  disabled={isLoading}
                  className={`px-8 py-3 bg-gradient-to-r ${isEditMode ? 'from-orange-600 to-red-700 hover:from-orange-500 hover:to-red-600' : 'from-blue-600 to-blue-700 hover:from-blue-500 hover:to-blue-600'} disabled:from-slate-600 disabled:to-slate-600 text-white rounded-lg font-medium transition-all duration-200 disabled:cursor-not-allowed`}
                  whileHover={{ scale: isLoading ? 1 : 1.02 }}
                  whileTap={{ scale: isLoading ? 1 : 0.98 }}
                >
                  {isLoading ? (
                    <div className="flex items-center">
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin mr-2" />
                      {isEditMode ? 'Updating...' : 'Adding Client...'}
                    </div>
                  ) : (
                    <div className="flex items-center">
                      {isEditMode ? <Edit3 className="w-4 h-4 mr-2" /> : <UserPlus className="w-4 h-4 mr-2" />}
                      {isEditMode ? 'Update Client' : 'Add Client'}
                    </div>
                  )}
                </motion.button>
              </div>
            </form>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}