# Quick Start - Build & Deploy PayPal Integration

## ✅ Code Status: READY

- ✅ No linting errors
- ✅ All files created correctly
- ✅ Sandbox/Production support
- ✅ Type safety verified

---

## 🚀 Quick Deployment Steps

### 1. Add Environment Variables to Vercel

Go to: **Vercel Dashboard** → **Your Project** → **Settings** → **Environment Variables**

Add:
- `PAYPAL_PDT_TOKEN` = `your-paypal-pdt-token` (get from PayPal dashboard)
- `PAYPAL_MODE` = `sandbox` (for testing first)

### 2. Deploy

```bash
git add .
git commit -m "Add PayPal integration"
git push origin main
```

Vercel will automatically build and deploy!

### 3. Test Endpoints

After deployment, verify:

```bash
# Test IPN endpoint
curl https://www.waifudance.com/api/paypal/ipn

# Should return:
# {"message":"PayPal IPN endpoint is active","endpoint":"/api/paypal/ipn"}
```

Visit in browser:
- `https://www.waifudance.com/payment/success` ✅
- `https://www.waifudance.com/payment/canceled` ✅

### 4. Test with PayPal Sandbox

1. Create sandbox accounts at https://developer.paypal.com
2. Configure Sandbox IPN: `https://www.waifudance.com/api/paypal/ipn`
3. Make test payment
4. Verify credits granted automatically

### 5. Switch to Production

In Vercel, change `PAYPAL_MODE` to `production` and redeploy.

---

## 📝 Files Created

- ✅ `app/api/paypal/ipn/route.ts` - IPN handler
- ✅ `app/payment/success/page.tsx` - Success page
- ✅ `app/payment/canceled/page.tsx` - Canceled page
- ✅ `lib/paypal.ts` - PayPal utilities
- ✅ `scripts/test-paypal-endpoints.ts` - Test script

---

## 🧪 Local Testing (Optional)

If you want to test locally first:

```bash
# Start dev server
npm run dev

# In another terminal, test endpoints
npx tsx scripts/test-paypal-endpoints.ts
```

---

## ✅ Ready to Deploy!

Your code is **ready**. Just:
1. Add env vars to Vercel
2. Push code
3. Test with sandbox
4. Switch to production

That's it! 🚀
