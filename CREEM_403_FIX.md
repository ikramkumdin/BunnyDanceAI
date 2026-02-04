# Fixing Creem API 403 Forbidden Error

## 🔴 Current Error

```
Creem API error (403): {"trace_id":"...","status":403,"error":"Forbidden","timestamp":...}
```

## 🔍 Possible Causes

### 1. **Invalid API Key**
- The API key `creem_test_5RYM7gLt7dP8PEK2uPu1R3` might be:
  - Expired
  - Incorrect
  - Not activated
  - For a different environment

### 2. **API Key Permissions**
- The API key might not have permission to create checkouts
- Check in Creem dashboard if the API key has the right scopes

### 3. **Product ID Mismatch**
- The product ID `prod_6KhUBGVKtaH6ZH9liHC1sc` might:
  - Not exist
  - Belong to a different account
  - Be inactive

### 4. **Wrong API Endpoint**
- The endpoint might be incorrect
- Check Creem documentation for the correct endpoint

## ✅ Solutions to Try

### Solution 1: Verify API Key in Creem Dashboard

1. Go to: https://www.creem.io/dashboard
2. Navigate to **Settings** → **API Keys** (or **Developers** → **API Keys`)
3. Verify:
   - The API key `creem_test_5RYM7gLt7dP8PEK2uPu1R3` exists
   - It's active (not revoked)
   - It has permissions for "Checkouts" or "Create Checkout"
   - It's for the correct environment (sandbox/production)

### Solution 2: Regenerate API Key

1. In Creem dashboard, create a new API key
2. Copy the new key
3. Update in Vercel:
   - Go to **Settings** → **Environment Variables**
   - Update `CREEM_API_KEY` with the new key
   - Redeploy

### Solution 3: Check Product ID

1. Go to: https://www.creem.io/dashboard/products
2. Find your product "Pro Weekly - 300 Credits"
3. Verify the Product ID matches: `prod_6KhUBGVKtaH6ZH9liHC1sc`
4. Make sure the product is **Active**

### Solution 4: Check API Documentation

1. Visit: https://docs.creem.io
2. Look for "Create Checkout" or "Checkout API" documentation
3. Verify:
   - The endpoint URL is correct: `https://api.creem.io/v1/checkouts`
   - The request format matches
   - The authentication method is correct

### Solution 5: Test API Key Directly

Test the API key with curl:

```bash
curl -X POST https://api.creem.io/v1/checkouts \
  -H "Content-Type: application/json" \
  -H "x-api-key: creem_test_5RYM7gLt7dP8PEK2uPu1R3" \
  -d '{
    "product_id": "prod_6KhUBGVKtaH6ZH9liHC1sc"
  }'
```

If this also returns 403, the issue is with the API key or permissions.

## 🔧 Quick Checks

- [ ] API key is correct in Vercel environment variables
- [ ] API key is active in Creem dashboard
- [ ] API key has "Create Checkout" permissions
- [ ] Product ID is correct: `prod_6KhUBGVKtaH6ZH9liHC1sc`
- [ ] Product is active in Creem dashboard
- [ ] API endpoint is correct: `https://api.creem.io/v1/checkouts`

## 📞 Contact Creem Support

If none of the above works:
1. Contact Creem support through their dashboard
2. Provide the trace_id from the error: `baf00ad0-7558-4d3e-90a3-1ee627ece65f`
3. Ask about:
   - API key permissions
   - Correct authentication method
   - Product ID validation

## 🧪 Alternative: Use Direct Checkout URL

If the API continues to fail, you might be able to use a direct checkout URL format:

```
https://www.creem.io/checkout?product_id=prod_6KhUBGVKtaH6ZH9liHC1sc&metadata[user_id]=USER_ID
```

But this would require checking Creem's documentation for the correct URL format.
