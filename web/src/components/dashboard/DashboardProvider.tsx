// apps/web/src/components/dashboard/DashboardProvider.tsx - Updated for Real Data
'use client';

import { useEffect } from 'react';
import { useMissionControlStore } from '@/stores/missionControlStore';

interface DashboardProviderProps {
  children: React.ReactNode;
  user?: any; // User data from server-side auth
}

export function DashboardProvider({ children, user }: DashboardProviderProps) {
  const { 
    loadClients, 
    loadTimelines, 
    addClient, 
    addProperty,
    setSelectedClient, 
    clients,
    setUser 
  } = useMissionControlStore();

  useEffect(() => {
    const initializeDashboard = async () => {
      // Set user data if provided
      if (user) {
        setUser(user);
      }

      // Load real data from API
      await loadClients();
      await loadTimelines();

      // If no clients exist, add some demo data for testing
      // Remove this in production - real clients will come from API
      if (clients.length === 0) {
        // Add demo clients
        addClient({
          name: 'Sarah & Mike Johnson',
          email: 'sarah.johnson@email.com',
          phone: '(555) 123-4567',
          status: 'active'
        });

        addClient({
          name: 'David Chen',
          email: 'david.chen@email.com', 
          phone: '(555) 987-6543',
          status: 'warm'
        });

        addClient({
          name: 'Emily Rodriguez',
          email: 'emily.rodriguez@email.com',
          phone: '(555) 456-7890', 
          status: 'active'
        });

        // Wait for clients to be added, then add demo properties
        setTimeout(() => {
          const currentClients = useMissionControlStore.getState().clients;
          if (currentClients.length >= 3) {
            // Properties for Sarah & Mike Johnson
            addProperty(currentClients[0].id, {
              address: '123 Maple Street, Louisville, KY 40202',
              price: 450000,
              description: 'Beautiful modern home with updated kitchen, hardwood floors, and spacious backyard perfect for entertaining.',
              imageUrl: 'https://images.unsplash.com/photo-1570129477492-45c003edd2be?w=800&h=600&fit=crop',
              mlsLink: 'https://www.flexmls.com/crea/listings/123-Maple-Street-Louisville-KY-40202',
              clientFeedback: 'love',
              notes: 'Love the kitchen and the backyard! This feels like home.'
            });

            addProperty(currentClients[0].id, {
              address: '456 Oak Avenue, Louisville, KY 40205', 
              price: 380000,
              description: 'Charming ranch-style home in quiet neighborhood with excellent schools and mature trees.',
              imageUrl: 'https://images.unsplash.com/photo-1568605114967-8130f3a36994?w=800&h=600&fit=crop',
              mlsLink: 'https://www.flexmls.com/crea/listings/456-Oak-Avenue-Louisville-KY-40205',
              clientFeedback: 'like',
              notes: 'Great neighborhood but we prefer something more modern.'
            });

            addProperty(currentClients[0].id, {
              address: '789 Pine Street, Louisville, KY 40204',
              price: 520000,
              description: 'Contemporary two-story home with open floor plan, granite counters, and attached garage.',
              imageUrl: 'https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?w=800&h=600&fit=crop',
              mlsLink: 'https://www.flexmls.com/crea/listings/789-Pine-Street-Louisville-KY-40204'
            });

            // Properties for David Chen
            addProperty(currentClients[1].id, {
              address: '321 Cedar Lane, Louisville, KY 40206',
              price: 325000,
              description: 'Cozy starter home with recent updates, perfect for first-time buyers.',
              imageUrl: 'https://images.unsplash.com/photo-1599423300746-b62533397364?w=800&h=600&fit=crop',
              mlsLink: 'https://www.flexmls.com/crea/listings/321-Cedar-Lane-Louisville-KY-40206',
              clientFeedback: 'like',
              notes: 'Good starter home, but looking for something with more space.'
            });

            addProperty(currentClients[1].id, {
              address: '654 Elm Street, Louisville, KY 40207',
              price: 415000,
              description: 'Move-in ready home with finished basement and large deck overlooking private yard.',
              imageUrl: 'https://images.unsplash.com/photo-1600047509358-9dc75507daeb?w=800&h=600&fit=crop',
              mlsLink: 'https://www.flexmls.com/crea/listings/654-Elm-Street-Louisville-KY-40207'
            });

            // Properties for Emily Rodriguez
            addProperty(currentClients[2].id, {
              address: '987 Birch Road, Louisville, KY 40208',
              price: 680000,
              description: 'Luxury home with chef\'s kitchen, master suite, and professionally landscaped grounds.',
              imageUrl: 'https://images.unsplash.com/photo-1613977257363-707ba9348227?w=800&h=600&fit=crop',
              mlsLink: 'https://www.flexmls.com/crea/listings/987-Birch-Road-Louisville-KY-40208',
              clientFeedback: 'love',
              notes: 'This is exactly what we\'ve been looking for! When can we schedule a showing?'
            });

            // Set the first client as selected
            setSelectedClient(currentClients[0]);
          }
        }, 200);
      } else if (clients.length > 0) {
        // If real clients exist, select the first one
        setSelectedClient(clients[0]);
      }
    };

    initializeDashboard();
  }, [user]);

  return <>{children}</>;
}