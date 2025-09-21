// Test Resend API key directly
const fetch = require('node-fetch');

async function testResendAPI() {
  const apiKey = 're_K9bz2Ptj_9eTV7V3qzveaCPZxNra6Hn7Q';

  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        from: 'onboarding@resend.dev',
        to: 'your-email@example.com', // Replace with your email
        subject: 'Test Email',
        html: '<p>This is a test email from Resend API</p>'
      })
    });

    const result = await response.json();
    console.log('Response:', result);

    if (response.ok) {
      console.log('✅ API key works!');
    } else {
      console.log('❌ API error:', result);
    }
  } catch (error) {
    console.error('❌ Request failed:', error.message);
  }
}

testResendAPI();