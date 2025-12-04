# Vercel Deployment Guide for BunnyDanceAI

## 🚀 Quick Deployment Steps

### 1. **Sign up/Login to Vercel**
   - Go to [vercel.com](https://vercel.com)
   - Sign up or login with your GitHub, GitLab, or email account

### 2. **Import Your Project**
   - Click "Import Project" or "Add New..." → "Project"
   - Connect your GitHub account (recommended) or upload from your computer
   - Select the `BunnyDanceAI` repository

### 3. **Configure Build Settings**
   Vercel should automatically detect this as a Next.js project. Verify these settings:
   - **Framework Preset**: Next.js
   - **Root Directory**: `./` (leave empty)
   - **Build Command**: `npm run build` or `yarn build`
   - **Output Directory**: `.next` (automatic)
   - **Install Command**: `npm install` or `yarn install`

### 4. **Set Environment Variables**
   In the Vercel dashboard, go to your project settings and add these environment variables:

   #### Required Variables:
   ```
   GROK_API_KEY=your_grok_api_key_here
   GCP_PROJECT_ID=your_gcp_project_id
   GCP_STORAGE_BUCKET=your_gcp_storage_bucket
   GCP_SERVICE_ACCOUNT_KEY=your_gcp_service_account_key_json_here
   ```

   #### Optional Variables (for payments):
   ```
   STRIPE_SECRET_KEY=sk_test_your_stripe_secret_key
   NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_your_stripe_publishable_key
   LEMON_SQUEEZY_API_KEY=your_lemon_api_key
   ```

### 5. **Deploy**
   - Click "Deploy"
   - Wait for the build to complete (usually takes 2-5 minutes)
   - Your site will be live at a URL like: `https://bunny-dance-ai.vercel.app`

## 🔧 Troubleshooting

### Build Errors
- Check the build logs in Vercel dashboard
- Ensure all dependencies are listed in `package.json`
- Verify Node.js version compatibility (Vercel uses Node 18+ by default)

### Environment Variables Issues
- Make sure all required environment variables are set
- Check that the GCP service account key JSON is properly formatted as one line
- Restart deployment after adding environment variables

### Domain Configuration
- Vercel provides a free `.vercel.app` subdomain
- You can connect a custom domain in Project Settings → Domains

## 📋 Post-Deployment Checklist

- [ ] Test the main page loads
- [ ] Test video generation functionality
- [ ] Verify payment integration (if using)
- [ ] Check file upload/download features
- [ ] Test on mobile devices

## 💡 Tips

- Vercel automatically redeploys when you push to your main branch
- You can create preview deployments for pull requests
- Environment variables can be different for production/preview deployments
