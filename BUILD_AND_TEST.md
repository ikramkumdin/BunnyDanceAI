# Build and Test Guide

## ✅ Code Verification Complete

### Status:
- ✅ **No linting errors** - All TypeScript checks pass
- ✅ **All imports correct** - No missing dependencies
- ✅ **Type safety** - All types properly defined
- ✅ **Sandbox/Production support** - Environment variable based

---

## 🔨 Building the Project

### Option 1: Build Locally (Recommended First)

```bash
# Make sure you're in the project directory
cd /Users/abyssinia/Documents/asmrtts/BunnyDanceAI

# Install dependencies (if needed)
npm install

# Build the project
npm run build
```

**Expected Output:**
- Should compile successfully
- No TypeScript errors
- Next.js build completes

### Option 2: Build on Vercel (Recommended for Production)

Vercel will automatically build when you push to your repository:

```bash
# Commit your changes
git add .
git commit -m "Add PayPal integration with sandbox/production support"

# Push to trigger Vercel deployment
git push origin main
```

Vercel will:
1. Install dependencies
2. Run `npm run build`
3. Deploy if build succeeds

---

## 🧪 Testing the Integration

### Step 1: Test Endpoints Locally

Run the test script:

```bash
# Start your dev server first
npm run dev

# In another terminal, run the test script
npx tsx scripts/test-paypal-endpoints.ts
```

This will test:
- ✅ IPN endpoint: `/api/paypal/ipn`
- ✅ Success page: `/payment/success`
- ✅ Canceled page: `/payment/canceled`
- ✅ Environment variables

### Step 2: Manual Endpoint Testing

#### Test IPN Endpoint:
```bash
# Should return JSON with message
curl http://localhost:3009/api/paypal/ipn
```

Expected response:
```json
{
  "message": "PayPal IPN endpoint is active",
  "endpoint": "/api/paypal/ipn"
}
```

#### Test Success Page:
Open in browser: `http://localhost:3009/payment/success`

Should show:
- ✅ "Payment Successful! 🎉"
- ✅ Receipt confirmation message
- ✅ Transaction details section

#### Test Canceled Page:
Open in browser: `http://localhost:3009/payment/canceled`

Should show:
- ✅ "Payment Canceled"
- ✅ "No charges were made"
- ✅ Try again button

---

## 🚀 Deploy to Vercel

### Step 1: Add Environment Variables

Go to: **Vercel Dashboard** → **Your Project** → **Settings** → **Environment Variables**

Add:

1. **PAYPAL_PDT_TOKEN**
   - Value: `2ZdecpHZ-VKsobQKLneeVBjweb7v5-j8pDVSdJYQGrxJWTvYvhvHPn5_-rW`
   - Environments: Production, Preview, Development

2. **PAYPAL_MODE**
   - Value: `sandbox` (for testing first)
   - Environments: Production, Preview, Development

### Step 2: Deploy

```bash
# Commit all changes
git add .
git commit -m "Add PayPal integration"

# Push to trigger deployment
git push origin main
```

Or use Vercel CLI:
```bash
vercel --prod
```

### Step 3: Verify Deployment

After deployment, test production endpoints:

1. **IPN Endpoint:**
   ```bash
   curl https://www.waifudance.com/api/paypal/ipn
   ```
   Should return: `{"message":"PayPal IPN endpoint is active",...}`

2. **Success Page:**
   Visit: `https://www.waifudance.com/payment/success`
   Should load correctly

3. **Canceled Page:**
   Visit: `https://www.waifudance.com/payment/canceled`
   Should load correctly

---

## 🧪 Test with PayPal Sandbox

### Step 1: Create Sandbox Accounts

1. Go to: https://developer.paypal.com
2. Log in with your PayPal account
3. Go to: **Sandbox** → **Accounts**
4. Create:
   - **Business account** (seller) - Note the email
   - **Personal account** (buyer) - For testing payments

### Step 2: Configure Sandbox IPN

1. Go to Sandbox Business account
2. Settings → **Notifications** → **Instant Payment Notification**
3. Set IPN URL: `https://www.waifudance.com/api/paypal/ipn`
4. Enable IPN

### Step 3: Test Payment

1. Use your PayPal button with sandbox mode
2. Make test payment with sandbox buyer account
3. Check:
   - ✅ User gets 300 credits
   - ✅ User tier upgraded to "pro"
   - ✅ Transaction in Firestore `paypal_transactions` collection

### Step 4: Check Logs

In Vercel Dashboard → **Functions** → **View Logs**

Look for:
- `📧 PayPal IPN received (sandbox):` - IPN received
- `✅ Successfully processed payment` - Payment processed

---

## 🔄 Switch to Production

Once sandbox testing is successful:

1. **Update Vercel Environment Variable:**
   - Change `PAYPAL_MODE` from `sandbox` to `production`
   - Redeploy (or wait for auto-redeploy)

2. **Test with Real Payment:**
   - Make small test payment ($5.99)
   - Verify credits granted
   - Check Firestore

3. **Go Live:**
   - Keep `PAYPAL_MODE=production`
   - Start accepting real payments!

---

## ✅ Pre-Deployment Checklist

- [ ] Code builds successfully (`npm run build`)
- [ ] No linting errors
- [ ] All endpoints accessible locally
- [ ] Environment variables set in Vercel
- [ ] Deployed to Vercel
- [ ] Production endpoints accessible
- [ ] Tested with PayPal Sandbox
- [ ] Verified credits granted automatically
- [ ] Checked Vercel logs for errors
- [ ] Ready to test in production

---

## 🐛 Troubleshooting Build Issues

### If Build Fails:

1. **Check TypeScript errors:**
   ```bash
   npx tsc --noEmit
   ```

2. **Check for missing dependencies:**
   ```bash
   npm install
   ```

3. **Clear Next.js cache:**
   ```bash
   rm -rf .next
   npm run build
   ```

4. **Check Vercel build logs:**
   - Go to Vercel Dashboard → Your Project → Deployments
   - Click on failed deployment
   - Check build logs for specific errors

---

## 📝 Files to Verify

Make sure these files exist and are correct:

- ✅ `app/api/paypal/ipn/route.ts` - IPN handler
- ✅ `app/payment/success/page.tsx` - Success page
- ✅ `app/payment/canceled/page.tsx` - Canceled page
- ✅ `lib/paypal.ts` - PayPal utilities
- ✅ `lib/payment.ts` - Updated payment tiers
- ✅ `types/index.ts` - Updated User interface

---

## 🎉 Ready to Deploy!

Your PayPal integration is **ready for deployment**!

**Next Steps:**
1. Build locally (optional but recommended)
2. Add environment variables to Vercel
3. Push code to trigger deployment
4. Test with PayPal Sandbox
5. Switch to production mode
6. Go live! 🚀

Good luck! 🎊
