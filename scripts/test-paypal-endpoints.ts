/**
 * Test PayPal Integration Endpoints
 * 
 * Run this script to verify PayPal endpoints are working:
 * npx tsx scripts/test-paypal-endpoints.ts
 */

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3009';
const PROD_URL = 'https://www.waifudance.com';

async function testIPNEndpoint(url: string) {
  console.log(`\n🧪 Testing IPN endpoint: ${url}/api/paypal/ipn`);
  
  try {
    const response = await fetch(`${url}/api/paypal/ipn`, {
      method: 'GET',
    });
    
    const data = await response.json();
    
    if (response.ok && data.message) {
      console.log('✅ IPN endpoint is active!');
      console.log(`   Response: ${data.message}`);
      return true;
    } else {
      console.log('❌ IPN endpoint returned unexpected response');
      console.log(`   Status: ${response.status}`);
      console.log(`   Data:`, data);
      return false;
    }
  } catch (error) {
    console.log('❌ Failed to reach IPN endpoint');
    console.log(`   Error: ${error instanceof Error ? error.message : String(error)}`);
    return false;
  }
}

async function testSuccessPage(url: string) {
  console.log(`\n🧪 Testing success page: ${url}/payment/success`);
  
  try {
    const response = await fetch(`${url}/payment/success`, {
      method: 'GET',
    });
    
    if (response.ok) {
      const html = await response.text();
      if (html.includes('Payment Successful') || html.includes('payment/success')) {
        console.log('✅ Success page is accessible!');
        return true;
      } else {
        console.log('⚠️  Success page loaded but content may be incorrect');
        return false;
      }
    } else {
      console.log(`❌ Success page returned status: ${response.status}`);
      return false;
    }
  } catch (error) {
    console.log('❌ Failed to reach success page');
    console.log(`   Error: ${error instanceof Error ? error.message : String(error)}`);
    return false;
  }
}

async function testCanceledPage(url: string) {
  console.log(`\n🧪 Testing canceled page: ${url}/payment/canceled`);
  
  try {
    const response = await fetch(`${url}/payment/canceled`, {
      method: 'GET',
    });
    
    if (response.ok) {
      console.log('✅ Canceled page is accessible!');
      return true;
    } else {
      console.log(`❌ Canceled page returned status: ${response.status}`);
      return false;
    }
  } catch (error) {
    console.log('❌ Failed to reach canceled page');
    console.log(`   Error: ${error instanceof Error ? error.message : String(error)}`);
    return false;
  }
}

async function checkEnvironmentVariables() {
  console.log('\n🔍 Checking Environment Variables:');
  
  const pdtToken = process.env.PAYPAL_PDT_TOKEN;
  const paypalMode = process.env.PAYPAL_MODE;
  
  if (pdtToken) {
    console.log('✅ PAYPAL_PDT_TOKEN is set');
  } else {
    console.log('❌ PAYPAL_PDT_TOKEN is NOT set');
  }
  
  if (paypalMode) {
    console.log(`✅ PAYPAL_MODE is set to: ${paypalMode}`);
  } else {
    console.log('⚠️  PAYPAL_MODE is NOT set (will default to sandbox in dev, production in prod)');
  }
}

async function main() {
  console.log('🚀 PayPal Integration Test Suite');
  console.log('================================\n');
  
  // Check environment variables
  await checkEnvironmentVariables();
  
  // Test local endpoints
  console.log('\n📡 Testing Local Endpoints:');
  const localIPN = await testIPNEndpoint(BASE_URL);
  const localSuccess = await testSuccessPage(BASE_URL);
  const localCanceled = await testCanceledPage(BASE_URL);
  
  // Test production endpoints (if different)
  if (PROD_URL !== BASE_URL) {
    console.log('\n📡 Testing Production Endpoints:');
    const prodIPN = await testIPNEndpoint(PROD_URL);
    const prodSuccess = await testSuccessPage(PROD_URL);
    const prodCanceled = await testCanceledPage(PROD_URL);
    
    // Summary
    console.log('\n📊 Test Summary:');
    console.log('================');
    console.log(`Local IPN: ${localIPN ? '✅' : '❌'}`);
    console.log(`Local Success: ${localSuccess ? '✅' : '❌'}`);
    console.log(`Local Canceled: ${localCanceled ? '✅' : '❌'}`);
    console.log(`Production IPN: ${prodIPN ? '✅' : '❌'}`);
    console.log(`Production Success: ${prodSuccess ? '✅' : '❌'}`);
    console.log(`Production Canceled: ${prodCanceled ? '✅' : '❌'}`);
    
    const allPassed = localIPN && localSuccess && localCanceled && prodIPN && prodSuccess && prodCanceled;
    
    if (allPassed) {
      console.log('\n🎉 All tests passed!');
    } else {
      console.log('\n⚠️  Some tests failed. Check the output above.');
    }
  } else {
    // Summary for local only
    console.log('\n📊 Test Summary:');
    console.log('================');
    console.log(`IPN Endpoint: ${localIPN ? '✅' : '❌'}`);
    console.log(`Success Page: ${localSuccess ? '✅' : '❌'}`);
    console.log(`Canceled Page: ${localCanceled ? '✅' : '❌'}`);
    
    const allPassed = localIPN && localSuccess && localCanceled;
    
    if (allPassed) {
      console.log('\n🎉 All tests passed!');
    } else {
      console.log('\n⚠️  Some tests failed. Check the output above.');
    }
  }
  
  console.log('\n💡 Next Steps:');
  console.log('1. Deploy to Vercel');
  console.log('2. Set environment variables in Vercel:');
  console.log('   - PAYPAL_PDT_TOKEN');
  console.log('   - PAYPAL_MODE=sandbox (for testing)');
  console.log('3. Test with PayPal Sandbox');
  console.log('4. Switch to PAYPAL_MODE=production when ready');
}

main().catch(console.error);
