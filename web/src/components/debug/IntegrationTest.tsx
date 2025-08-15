// apps/web/src/components/debug/IntegrationTest.tsx
'use client';

import { useState } from 'react';
import { useMissionControlStore } from '@/stores/missionControlStore';

export function IntegrationTest() {
  const {
    isAuthenticated,
    user,
    clients,
    selectedClient,
    isLoading,
    notifications,
    login,
    loadClients,
    addClient,
    addProperty,
    loadTimeline,
    getClientTimeline,
    setSelectedClient,
  } = useMissionControlStore();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [testClient, setTestClient] = useState({
    name: 'Test Client',
    email: 'test@example.com',
    phone: '555-123-4567',
  });
  const [testProperty, setTestProperty] = useState({
    address: '123 Test Street, Louisville, KY 40202',
    price: 350000,
    description: 'Beautiful test property for integration testing',
    imageUrl: 'https://via.placeholder.com/400x300',
    mlsLink: 'https://example.com/mls/test-property',
  });

  const handleLogin = async () => {
    const success = await login(email, password);
    if (success) {
      console.log('✅ Login successful');
    }
  };

  const handleLoadClients = async () => {
    console.log('🔄 Loading clients...');
    await loadClients();
    console.log('✅ Clients loaded:', clients.length);
  };

  const handleAddClient = async () => {
    console.log('🔄 Adding client...');
    const success = await addClient(testClient);
    if (success) {
      console.log('✅ Client added successfully');
      await loadClients(); // Refresh the list
    }
  };

  const handleSelectClient = (client: any) => {
    console.log('🔄 Selecting client:', client.name);
    setSelectedClient(client);
    loadTimeline(client.id);
  };

  const handleAddProperty = async () => {
    if (!selectedClient) {
      console.log('❌ No client selected');
      return;
    }

    console.log('🔄 Adding property...');
    const success = await addProperty(selectedClient.id, testProperty);
    if (success) {
      console.log('✅ Property added successfully');
    }
  };

  const timeline = selectedClient ? getClientTimeline(selectedClient.id) : null;

  return (
    <div className="p-6 bg-slate-900 text-white min-h-screen">
      <h1 className="text-2xl font-bold mb-6">🧪 Backend Integration Test</h1>

      {/* Authentication Status */}
      <div className="mb-6 p-4 bg-slate-800 rounded-lg">
        <h2 className="text-lg font-semibold mb-2">Authentication Status</h2>
        <p>Status: {isAuthenticated ? '✅ Authenticated' : '❌ Not Authenticated'}</p>
        {user && (
          <p>User: {user.firstName} {user.lastName} ({user.email})</p>
        )}
        {isLoading && <p>🔄 Loading...</p>}
      </div>

      {/* Login Form */}
      {!isAuthenticated && (
        <div className="mb-6 p-4 bg-slate-800 rounded-lg">
          <h2 className="text-lg font-semibold mb-2">Login</h2>
          <div className="space-y-2">
            <input
              type="email"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full p-2 bg-slate-700 rounded border border-slate-600"
            />
            <input
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full p-2 bg-slate-700 rounded border border-slate-600"
            />
            <button
              onClick={handleLogin}
              className="px-4 py-2 bg-blue-600 rounded hover:bg-blue-700"
            >
              Login
            </button>
          </div>
        </div>
      )}

      {/* Client Management */}
      {isAuthenticated && (
        <>
          <div className="mb-6 p-4 bg-slate-800 rounded-lg">
            <h2 className="text-lg font-semibold mb-2">Client Management</h2>
            <div className="space-y-2 mb-4">
              <button
                onClick={handleLoadClients}
                className="px-4 py-2 bg-green-600 rounded hover:bg-green-700 mr-2"
              >
                Load Clients ({clients.length})
              </button>
              <button
                onClick={handleAddClient}
                className="px-4 py-2 bg-purple-600 rounded hover:bg-purple-700"
              >
                Add Test Client
              </button>
            </div>

            {/* Client List */}
            <div className="space-y-2">
              <h3 className="font-medium">Clients:</h3>
              {clients.map((client) => (
                <div
                  key={client.id}
                  className={`p-2 bg-slate-700 rounded cursor-pointer hover:bg-slate-600 ${
                    selectedClient?.id === client.id ? 'ring-2 ring-blue-500' : ''
                  }`}
                  onClick={() => handleSelectClient(client)}
                >
                  <p className="font-medium">{client.name}</p>
                  <p className="text-sm text-slate-400">
                    {client.email} • {client.status} • {client.propertiesViewed} properties
                  </p>
                  <p className="text-xs text-slate-500">
                    Engagement: {client.engagementScore}% • Last active: {new Date(client.lastActive).toLocaleDateString()}
                  </p>
                </div>
              ))}
            </div>
          </div>

          {/* Property Management */}
          {selectedClient && (
            <div className="mb-6 p-4 bg-slate-800 rounded-lg">
              <h2 className="text-lg font-semibold mb-2">
                Property Management - {selectedClient.name}
              </h2>
              
              <button
                onClick={handleAddProperty}
                className="px-4 py-2 bg-orange-600 rounded hover:bg-orange-700 mb-4"
              >
                Add Test Property
              </button>

              {/* Timeline Properties */}
              {timeline && (
                <div>
                  <h3 className="font-medium mb-2">Timeline Properties ({timeline.properties.length}):</h3>
                  <div className="space-y-2">
                    {timeline.properties.map((property) => (
                      <div key={property.id} className="p-2 bg-slate-700 rounded">
                        <p className="font-medium">{property.address}</p>
                        <p className="text-sm text-slate-400">
                          ${property.price.toLocaleString()} • {property.description}
                        </p>
                        <p className="text-xs text-slate-500">
                          Added: {new Date(property.addedAt).toLocaleDateString()} • 
                          Feedback: {property.clientFeedback || 'None'}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </>
      )}

      {/* Notifications */}
      {notifications.length > 0 && (
        <div className="mb-6 p-4 bg-slate-800 rounded-lg">
          <h2 className="text-lg font-semibold mb-2">Recent Notifications</h2>
          <div className="space-y-2">
            {notifications.slice(0, 5).map((notification) => (
              <div
                key={notification.id}
                className={`p-2 rounded ${
                  notification.type === 'success' ? 'bg-green-900' :
                  notification.type === 'error' ? 'bg-red-900' :
                  notification.type === 'warning' ? 'bg-yellow-900' :
                  'bg-blue-900'
                }`}
              >
                <p className="font-medium">{notification.title}</p>
                <p className="text-sm">{notification.message}</p>
                <p className="text-xs text-slate-400">
                  {new Date(notification.timestamp).toLocaleTimeString()}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Test Data Forms */}
      <div className="mb-6 p-4 bg-slate-800 rounded-lg">
        <h2 className="text-lg font-semibold mb-2">Test Data Configuration</h2>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Client Test Data */}
          <div>
            <h3 className="font-medium mb-2">Test Client Data:</h3>
            <div className="space-y-2">
              <input
                type="text"
                placeholder="Name"
                value={testClient.name}
                onChange={(e) => setTestClient({...testClient, name: e.target.value})}
                className="w-full p-2 bg-slate-700 rounded border border-slate-600"
              />
              <input
                type="email"
                placeholder="Email"
                value={testClient.email}
                onChange={(e) => setTestClient({...testClient, email: e.target.value})}
                className="w-full p-2 bg-slate-700 rounded border border-slate-600"
              />
              <input
                type="tel"
                placeholder="Phone"
                value={testClient.phone}
                onChange={(e) => setTestClient({...testClient, phone: e.target.value})}
                className="w-full p-2 bg-slate-700 rounded border border-slate-600"
              />
            </div>
          </div>

          {/* Property Test Data */}
          <div>
            <h3 className="font-medium mb-2">Test Property Data:</h3>
            <div className="space-y-2">
              <input
                type="text"
                placeholder="Address"
                value={testProperty.address}
                onChange={(e) => setTestProperty({...testProperty, address: e.target.value})}
                className="w-full p-2 bg-slate-700 rounded border border-slate-600"
              />
              <input
                type="number"
                placeholder="Price"
                value={testProperty.price}
                onChange={(e) => setTestProperty({...testProperty, price: parseInt(e.target.value)})}
                className="w-full p-2 bg-slate-700 rounded border border-slate-600"
              />
              <input
                type="text"
                placeholder="Description"
                value={testProperty.description}
                onChange={(e) => setTestProperty({...testProperty, description: e.target.value})}
                className="w-full p-2 bg-slate-700 rounded border border-slate-600"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Debug Info */}
      <div className="p-4 bg-slate-800 rounded-lg">
        <h2 className="text-lg font-semibold mb-2">Debug Information</h2>
        <div className="text-xs">
          <p>Store State:</p>
          <ul className="list-disc list-inside space-y-1">
            <li>Authenticated: {isAuthenticated.toString()}</li>
            <li>Clients loaded: {clients.length}</li>
            <li>Selected client: {selectedClient?.name || 'None'}</li>
            <li>Timeline loaded: {timeline ? 'Yes' : 'No'}</li>
            <li>Properties in timeline: {timeline?.properties.length || 0}</li>
            <li>Notifications: {notifications.length}</li>
            <li>Loading: {isLoading.toString()}</li>
          </ul>
        </div>
      </div>
    </div>
  );
}