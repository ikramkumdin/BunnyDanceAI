# Quick Start Guide - Image to Video Generation

## 🚀 Ready to Use!

Your image-to-video generation is now fully functional and ready to use. Here's how to get started:

## ✅ What's Working

1. **Template-Based Generation**: Select from 10 pre-configured templates
2. **Smart Mode Selection**: Automatically uses the right generation mode (normal/spicy) based on template
3. **Prompt System**: Each template has a detailed, optimized prompt
4. **Image Upload**: Upload any portrait photo
5. **Video Generation**: Powered by Grok Imagine API (Kie.ai)
6. **Polling System**: Automatically checks for completion
7. **Video Actions**: Download, share, and save to assets

## 🎬 How to Generate a Video

### Step 1: Start the Development Server
```bash
cd /Users/abyssinia/Documents/asmrtts/BunnyDanceAI
npm run dev
```

The app will be available at: http://localhost:3010

### Step 2: Navigate to Generate Page
1. Open http://localhost:3010/generate
2. You'll see three tabs: **IMAGE TO VIDEO**, **TEXT TO VIDEO**, **TEXT TO IMAGE**
3. Make sure **IMAGE TO VIDEO** is selected

### Step 3: Upload an Image
1. Click the upload area or drag & drop an image
2. Best results with:
   - Portrait photos (face clearly visible)
   - Good lighting
   - 9:16 aspect ratio (vertical)
   - High resolution (1080x1920 recommended)

### Step 4: Select a Template
Scroll down to see available templates:

**Mild Templates (Normal Mode):**
- None currently (all templates are spicy/extreme)

**Spicy Templates (Spicy Mode):**
- Shimmy Shake - Energetic hip-hop dance moves
- Sparkling Eye Wink - Coy wink gesture
- Hair Tuck - Gentle hair tuck gesture
- Twerk Girl - TikTok-style edge dance
- Running Girl - Dynamic running sequence
- Night Club Hip - Rhythmic hip shaking
- Lustful Touch - Sensual touch gesture

**Extreme Templates (Spicy Mode):**
- Kneel and Crawl - Seductive movement
- Standing Split - Graceful flexibility pose
- Snake Sway - Serpentine dance motion

### Step 5: Generate
1. Click the **"Generate"** button
2. You'll see a loading indicator
3. The system will:
   - Upload your image to cloud storage
   - Send request to Grok Imagine API
   - Start polling for completion
   - Display progress

### Step 6: Wait for Completion
- **Typical time**: 30-120 seconds
- **Max time**: 20 minutes
- Progress is shown on screen

### Step 7: Enjoy Your Video!
Once complete:
- Video plays automatically
- Click the share icon for actions:
  - **Share**: Copy link or use native share
  - **Download**: Save to your device
  - **Save**: Add to your Assets collection

## 📋 Template Details

### Example: Snake Sway
```
Name: Snake Sway
Intensity: extreme
Mode: spicy
Category: fright-zone

Prompt: "A highly detailed animated sequence of a beautiful woman 
based on the reference image, performing a seductive snake sway dance: 
she fluidly undulates her body in a serpentine wave motion starting 
from her hips, rolling up through her torso and shoulders in a 
hypnotic, snake-like sway..."
```

### Example: Hair Tuck
```
Name: Hair Tuck
Intensity: spicy
Mode: spicy
Category: custom

Prompt: "A highly detailed animated sequence of a beautiful woman 
with long, flowing hair performing a gentle hair tuck gesture: 
she gracefully lifts her hand to brush a strand of hair behind 
her ear, smiling softly with a serene expression..."
```

## 🔍 Behind the Scenes

When you click "Generate", here's what happens:

1. **Image Processing**
   - Image uploaded to Google Cloud Storage
   - Public URL generated
   - URL accessibility tested

2. **Prompt Construction**
   - Template prompt retrieved from database
   - Identity wrapper added to maintain person's appearance
   - Final prompt assembled (max 5000 chars)

3. **Mode Selection**
   - Template intensity checked (mild/spicy/extreme)
   - Appropriate mode selected (normal/spicy)
   - Logged for debugging

4. **API Request**
   ```json
   {
     "model": "grok-imagine/image-to-video",
     "callBackUrl": "https://yourapp.com/api/callback",
     "input": {
       "image_urls": ["https://storage.googleapis.com/..."],
       "index": 0,
       "prompt": "Your detailed prompt...",
       "mode": "spicy"
     }
   }
   ```

5. **Task Creation**
   - Kie.ai creates async task
   - Returns taskId
   - Frontend starts polling

6. **Polling**
   - Checks every 10 seconds
   - Queries both Kie.ai API and local database
   - Updates progress indicator

7. **Completion**
   - Video URL received
   - Video displayed in player
   - Saved to database
   - Actions available

## 🐛 Troubleshooting

### "Image upload failed"
- Check internet connection
- Try a smaller image (< 10MB)
- Ensure image is valid format (JPG, PNG)

### "Generation failed"
- Check API key is configured
- Verify image is accessible
- Try different template
- Check Kie.ai logs: https://kie.ai/logs

### "Timeout after 20 minutes"
- Check Kie.ai dashboard for task status
- Task might still be processing
- Try refreshing page
- Contact support if persistent

### "No video displayed"
- Check browser console for errors
- Verify polling is working
- Check database for saved video
- Try different browser

## 📊 Monitoring

### Check Logs
```bash
# Server logs (in terminal running npm run dev)
# Look for:
# ✅ Success messages
# ❌ Error messages
# 🎨 Mode selection
# 📊 API responses
```

### Kie.ai Dashboard
- Visit: https://kie.ai/logs
- Search for your taskId
- Check status: PENDING, PROCESSING, SUCCESS, FAILED
- View detailed logs

## 🎯 Best Practices

### Image Selection
- ✅ Clear, well-lit portrait
- ✅ Face clearly visible
- ✅ Vertical orientation (9:16)
- ✅ High resolution
- ❌ Blurry or dark images
- ❌ Multiple people
- ❌ Landscape orientation

### Template Selection
- Start with milder templates (Hair Tuck, Sparkling Eye Wink)
- Test with different templates to see variations
- Match template to desired animation style

### Generation Tips
- Be patient - quality takes time
- Don't refresh page during generation
- Save videos you like to Assets
- Try different images with same template

## 🔐 Environment Setup

Make sure these are configured in `.env.local`:

```bash
# Required
GROK_API_KEY=your_kie_ai_api_key_here

# GCP Storage
GCP_STORAGE_BUCKET=bunnydanceai-storage
GOOGLE_APPLICATION_CREDENTIALS=path/to/credentials.json

# App URLs
NEXT_PUBLIC_VERCEL_URL=your-app-url.vercel.app
NEXT_PUBLIC_SITE_URL=https://your-app-url.vercel.app

# Optional
KIE_TEST_MODE=false  # Set to true for testing without API calls
```

## 📱 Mobile Support

The app is fully responsive:
- Works on mobile browsers
- Touch-friendly interface
- Optimized for vertical videos
- Native share support on mobile

## 🎉 You're All Set!

Everything is configured and ready to go. Just:

1. Run `npm run dev`
2. Open http://localhost:3010/generate
3. Upload an image
4. Select a template
5. Click "Generate"
6. Wait for the magic! ✨

## 💡 Tips for Best Results

1. **Use high-quality images**: Better input = better output
2. **Try different templates**: Each creates unique animations
3. **Be patient**: Quality generation takes 1-2 minutes
4. **Save your favorites**: Use the save button to keep videos
5. **Experiment**: Try same image with different templates

## 🆘 Need Help?

- Check server logs in terminal
- Visit Kie.ai dashboard: https://kie.ai/logs
- Review implementation docs in `.agent/` folder
- Check browser console for errors

---

**Happy Creating! 🎬✨**
