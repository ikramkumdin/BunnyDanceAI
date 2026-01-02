# Vercel Deployment Guide

## ✅ Code Pushed Successfully!

Your code has been pushed to GitHub and will automatically deploy to Vercel.

**Deployment URL**: https://bunny-dance-ai.vercel.app

## 🔑 Required: Configure Environment Variables in Vercel

**IMPORTANT**: The app won't work on Vercel until you add the environment variables!

### Step 1: Go to Vercel Dashboard

1. Visit: https://vercel.com/dashboard
2. Find your project: **BunnyDanceAI**
3. Click on the project

### Step 2: Add Environment Variables

1. Click on **Settings** tab
2. Click on **Environment Variables** in the left sidebar
3. Add the following variables:

#### Required Variables:

```bash
# Kie.ai API Key (CRITICAL - App won't work without this)
GROK_API_KEY=8b0a2ddbad30a2eaf3545adb2272fe60

# Google Cloud Storage
GCP_STORAGE_BUCKET=bunnydanceai-storage

# Firebase Admin (Base64 encoded service account)
GOOGLE_APPLICATION_CREDENTIALS_BASE64=[your_base64_encoded_credentials]

# App URLs
NEXT_PUBLIC_SITE_URL=https://bunny-dance-ai.vercel.app
NEXT_PUBLIC_VERCEL_URL=bunny-dance-ai.vercel.app
```

### Step 3: How to Add Each Variable

For each variable:
1. Click **Add New**
2. **Name**: Enter the variable name (e.g., `GROK_API_KEY`)
3. **Value**: Enter the variable value
4. **Environment**: Select **Production**, **Preview**, and **Development** (all three)
5. Click **Save**

### Step 4: Redeploy

After adding all variables:
1. Go to **Deployments** tab
2. Click on the latest deployment
3. Click the **...** menu (three dots)
4. Click **Redeploy**
5. Check **Use existing Build Cache**
6. Click **Redeploy**

## 📋 Environment Variables Checklist

Copy these from your local `.env.local` file:

- [ ] `GROK_API_KEY` - Kie.ai API key for video generation
- [ ] `GCP_STORAGE_BUCKET` - Google Cloud Storage bucket name
- [ ] `GOOGLE_APPLICATION_CREDENTIALS_BASE64` - Firebase credentials (base64)
- [ ] `NEXT_PUBLIC_SITE_URL` - Your Vercel app URL
- [ ] `NEXT_PUBLIC_VERCEL_URL` - Your Vercel domain

### Optional Variables:

```bash
# Testing
KIE_TEST_MODE=false  # Set to true to test without API calls

# Callback Secret
PUBLIC_IMAGE_PROXY_SECRET=[random_secret_string]
NEXTAUTH_SECRET=[random_secret_string]
```

## 🔍 How to Get Base64 Credentials

If you need to encode your Firebase credentials:

```bash
# On Mac/Linux:
cat path/to/your-firebase-credentials.json | base64

# On Windows (PowerShell):
[Convert]::ToBase64String([System.IO.File]::ReadAllBytes("path\to\your-firebase-credentials.json"))
```

Then copy the output and paste it as the value for `GOOGLE_APPLICATION_CREDENTIALS_BASE64`.

## ✅ Verify Deployment

After redeploying:

1. **Visit**: https://bunny-dance-ai.vercel.app/generate
2. **Test**: Upload an image and try generating a video
3. **Check Logs**: Go to Vercel → Deployments → Click deployment → View Function Logs

### Expected Behavior:

✅ Page loads without errors
✅ Can upload images
✅ Templates are visible with titles
✅ Can select templates
✅ Generate button works
✅ Video generation starts (polling begins)
✅ Video appears after 1-2 minutes

### If It Doesn't Work:

1. **Check Function Logs** in Vercel:
   - Go to Deployments → Latest → Function Logs
   - Look for errors about missing environment variables

2. **Common Issues**:
   - ❌ `GROK_API_KEY is not configured` → Add the API key
   - ❌ `Firebase Admin initialization failed` → Check base64 credentials
   - ❌ `GCS bucket not found` → Check bucket name

3. **Verify Environment Variables**:
   - Go to Settings → Environment Variables
   - Make sure all required variables are set
   - Make sure they're enabled for Production

## 🎯 Quick Checklist

Before testing on Vercel:

1. ✅ Code pushed to GitHub
2. ✅ Vercel auto-deployed (check Deployments tab)
3. ✅ All environment variables added
4. ✅ Variables enabled for Production
5. ✅ Redeployed after adding variables
6. ✅ Visited the live URL

## 📊 Monitoring

### Check Deployment Status:
- Vercel Dashboard → Deployments
- Should show "Ready" status
- Build logs should show no errors

### Check Function Logs:
- Click on deployment → Function Logs
- Should see API calls when you generate videos
- Look for `✅ Task created successfully` messages

### Check Kie.ai Dashboard:
- Visit: https://kie.ai/logs
- Log in with your Kie.ai account
- Tasks should appear when you generate videos

## 🐛 Troubleshooting

### Issue: "GROK_API_KEY is not configured"
**Solution**: 
1. Go to Vercel Settings → Environment Variables
2. Add `GROK_API_KEY` with value `8b0a2ddbad30a2eaf3545adb2272fe60`
3. Redeploy

### Issue: "Firebase Admin initialization failed"
**Solution**:
1. Get your Firebase service account JSON
2. Convert to base64 (see command above)
3. Add as `GOOGLE_APPLICATION_CREDENTIALS_BASE64`
4. Redeploy

### Issue: Videos stuck in "waiting" state
**Solution**:
1. Check Kie.ai account has credits
2. Verify API key is correct
3. Check Kie.ai logs at https://kie.ai/logs

### Issue: Images not uploading
**Solution**:
1. Check GCS bucket name is correct
2. Verify Firebase credentials are valid
3. Check bucket permissions

## 📞 Support

If you need help:
1. Check Vercel Function Logs for errors
2. Check browser console for errors
3. Check Kie.ai dashboard for task status
4. Review documentation in `.agent/` folder

## 🎉 Success!

Once everything is configured:
- Visit: https://bunny-dance-ai.vercel.app/generate
- Upload an image
- Select a template
- Generate a video
- Watch it work! 🎬✨

---

**Remember**: The API key and credentials are sensitive. Never commit them to git!
