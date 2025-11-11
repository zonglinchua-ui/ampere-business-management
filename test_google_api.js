require('dotenv').config();

async function testGoogleMapsAPI() {
  const apiKey = process.env.GOOGLE_MAPS_API_KEY || process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
  
  console.log('Testing Google Maps API...');
  console.log('API Key:', apiKey ? `${apiKey.substring(0, 10)}...` : 'NOT FOUND');
  console.log('');
  
  if (!apiKey) {
    console.error('❌ No API key found in environment');
    return;
  }
  
  // Test 1: Simple geocoding
  console.log('Test 1: Geocoding a simple address');
  const testAddress = 'Singapore';
  const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(testAddress)}&key=${apiKey}`;
  
  try {
    const response = await fetch(url);
    const data = await response.json();
    
    console.log('Status:', data.status);
    
    if (data.status === 'REQUEST_DENIED') {
      console.log('❌ REQUEST_DENIED');
      console.log('Error message:', data.error_message);
      console.log('');
      console.log('This usually means:');
      console.log('1. The Geocoding API is not enabled in Google Cloud Console');
      console.log('2. The API key has restrictions that block this request');
      console.log('3. The API key is invalid');
      console.log('');
      console.log('To fix:');
      console.log('1. Go to: https://console.cloud.google.com/apis/library/geocoding-backend.googleapis.com');
      console.log('2. Enable the Geocoding API');
      console.log('3. Check API key restrictions at: https://console.cloud.google.com/apis/credentials');
    } else if (data.status === 'OK') {
      console.log('✅ API key works!');
      console.log('Location:', data.results[0].geometry.location);
    } else {
      console.log('⚠️ Unexpected status:', data.status);
      console.log('Error:', data.error_message);
    }
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

testGoogleMapsAPI();
