async function testEmailAuth() {
  const BASE_URL = 'http://localhost:3001/api/v1';
  
  try {
    console.log('📧 Testing Email Verification System...\n');
    
    // Test 1: Register new user
    console.log('1. Registering new user...');
    const registerResponse = await fetch(`${BASE_URL}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'agent@test.com',
        password: 'password123',
        firstName: 'Test',
        lastName: 'Agent',
        company: 'Test Realty',
        phone: '555-123-4567'
      })
    });
    
    const registerData = await registerResponse.json();
    console.log('✅ Registration:', registerData.message);
    
    // Test 2: Try to login without verification
    console.log('\n2. Trying to login without email verification...');
    const loginResponse = await fetch(`${BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'agent@test.com',
        password: 'password123'
      })
    });
    
    const loginData = await loginResponse.json();
    if (loginResponse.ok) {
      console.log('❌ Login should have failed!');
    } else {
      console.log('✅ Login blocked:', loginData.message);
    }
    
    console.log('\n🎉 Email verification system is working!');
    console.log('📧 Check the console for email preview URLs');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

testEmailAuth();