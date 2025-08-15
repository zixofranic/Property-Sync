async function testClientSystem() {
  const BASE_URL = 'http://localhost:3001/api/v1';
  
  try {
    console.log('🔐 Step 1: Logging in...');
    
    // Step 1: Login
    const loginResponse = await fetch(`${BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'john@realtyco.com',
        password: 'password123'
      })
    });
    
    const loginData = await loginResponse.json();
    
    if (!loginResponse.ok) {
      console.error('❌ Login failed:', loginData);
      return;
    }
    
    console.log('✅ Login successful!');
    const token = loginData.accessToken;
    
    console.log('\n👥 Step 2: Creating client...');
    
    // Step 2: Create Client
    const clientResponse = await fetch(`${BASE_URL}/clients`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        firstName: 'Sarah',
        lastName: 'Johnson',
        email: 'sarah.johnson@email.com',
        phone: '555-123-9876',
        notes: 'Looking for a 3BR family home in Highlands area'
      })
    });
    
    const clientData = await clientResponse.json();
    
    if (!clientResponse.ok) {
      console.error('❌ Client creation failed:', clientData);
      return;
    }
    
    console.log('🎉 Client created successfully!');
    console.log('📋 Client Details:');
    console.log(`   Name: ${clientData.firstName} ${clientData.lastName}`);
    console.log(`   Email: ${clientData.email}`);
    console.log(`   Phone: ${clientData.phone}`);
    
    if (clientData.timeline) {
      console.log('\n🏠 Timeline Details:');
      console.log(`   Title: ${clientData.timeline.title}`);
      console.log(`   Share URL: ${clientData.timeline.shareUrl}`);
      console.log(`   Client Login Code: ${clientData.timeline.clientLoginCode}`);
      console.log(`   Share Token: ${clientData.timeline.shareToken}`);
      
      console.log('\n🧪 Step 3: Testing timeline access...');
      
      // Step 3: Test Timeline Access
      const timelineResponse = await fetch(
        `${BASE_URL}/timelines/${clientData.timeline.shareToken}?client=${clientData.timeline.clientLoginCode}`
      );
      
      const timelineData = await timelineResponse.json();
      
      if (!timelineResponse.ok) {
        console.error('❌ Timeline access failed:', timelineData);
        return;
      }
      
      console.log('✅ Timeline access successful!');
      console.log(`   Timeline ID: ${timelineData.id}`);
      console.log(`   Title: ${timelineData.title}`);
      console.log(`   Agent: ${timelineData.agent.firstName} ${timelineData.agent.lastName}`);
      console.log(`   Brand Color: ${timelineData.agent.brandColor}`);
      console.log(`   Properties: ${timelineData.properties.length}`);
    }
    
    console.log('\n🎉 ALL TESTS PASSED! Your client timeline system is working perfectly!');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

// Run the test
testClientSystem();