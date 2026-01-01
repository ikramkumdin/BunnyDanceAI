# Testing Guide - Image to Video Generation

## ✅ API Key Updated Successfully!

Your new API key has been configured:
```
API Key: 8b0a2ddbad30a2eaf3545adb2272fe60
Status: ✅ Valid and authenticated
```

## 🎬 How to Test Video Generation

### Step 1: Open the Generate Page
1. Make sure the dev server is running (it should be)
2. Open your browser and go to: **http://localhost:3010/generate**
3. You should see three tabs at the top:
   - **IMAGE TO VIDEO** (should be selected/highlighted in purple)
   - TEXT TO VIDEO
   - TEXT TO IMAGE

### Step 2: Upload an Image
1. You'll see a dashed box with "Upload photo" and "max 10MB"
2. Click on it or drag & drop an image
3. **Best images for testing:**
   - Portrait photo (face clearly visible)
   - Vertical orientation (9:16 ratio is best)
   - Good lighting
   - Single person
   - High resolution (1080x1920 recommended)

### Step 3: Select a Template
After uploading, scroll down to see the template categories:
- **All** (default - shows all templates)
- Sway
- Shimmy
- Peach
- Halloween
- Playful
- Fright Zone
- JK
- Catgirl
- Custom

**Available Templates:**
1. **Shimmy Shake** - Energetic hip-hop dance (spicy mode)
2. **Kneel and Crawl** - Seductive movement (spicy mode)
3. **Standing Split** - Flexibility pose (spicy mode)
4. **Snake Sway** - Serpentine dance (spicy mode)
5. **Sparkling Eye Wink** - Playful wink (spicy mode)
6. **Hair Tuck** - Gentle gesture (spicy mode)
7. **Twerk Girl** - TikTok dance (spicy mode)
8. **Running Girl** - Athletic motion (spicy mode)
9. **Night Club Hip** - Hip shaking (spicy mode)
10. **Lustful Touch** - Sensual gesture (spicy mode)

**Recommendation for first test:** Try **"Hair Tuck"** or **"Sparkling Eye Wink"** - they're simpler and faster to generate.

### Step 4: Generate the Video
1. Click the **"Generate"** button
2. You should see a loading indicator
3. Watch the terminal/console for logs

### Step 5: Monitor Progress

**In the browser:**
- You'll see "Generating..." message
- The system polls every 10 seconds
- Maximum wait time: 20 minutes (usually 1-2 minutes)

**In the terminal (watch for these logs):**
```
✅ Task created successfully with taskId: [some-id]
🎨 Using generation mode: spicy (from template intensity: extreme)
📊 Response status: 200
```

**Check Kie.ai Dashboard:**
1. Go to https://kie.ai/logs
2. Log in with your account
3. You should now see your task appearing!
4. Watch the status change: waiting → processing → success

### Step 6: Video Ready!
When complete:
- Video will appear in the player
- You can play it immediately
- Click the share icon (bottom right) for actions:
  - **Share** - Copy link or use native share
  - **Download** - Save to your device
  - **Save** - Add to your Assets collection

## 📊 What to Expect

### Timeline:
- **Upload**: Instant
- **Task Creation**: 1-3 seconds
- **Processing**: 30-120 seconds (varies by template)
- **Total**: ~1-2 minutes for most templates

### Success Indicators:
✅ Task appears in Kie.ai logs immediately
✅ Status changes from "waiting" to "processing"
✅ Video URL returned within 1-2 minutes
✅ Video plays in browser

### If It Works:
You'll see in terminal:
```
✅ Task created successfully with taskId: abc123...
🎨 Using generation mode: spicy
📊 Response status: 200
"state": "processing"  // Then "success"
"resultJson": "https://cdn.kie.ai/your-video.mp4"
```

### If It Doesn't Work:
You'll see:
```
"state": "waiting"  // Stuck forever
"resultJson": ""
```

**If stuck in "waiting":**
- Check Kie.ai dashboard for credits
- Verify account is active
- Check email for verification needed
- Contact Kie.ai support

## 🧪 Quick Test Commands

### Test API Key:
```bash
# Visit in browser:
http://localhost:3010/api/test-kie-api
```

### Check Current API Key:
```bash
grep "GROK_API_KEY" .env.local
```

### View Server Logs:
The terminal where `npm run dev` is running shows all logs in real-time.

## 📝 Example Test Scenario

**Scenario: Generate "Hair Tuck" Animation**

1. **Upload**: Portrait photo of a woman with long hair
2. **Select**: "Hair Tuck" template
3. **Generate**: Click button
4. **Wait**: ~60 seconds
5. **Result**: Video of the person gently tucking hair behind ear

**Expected Logs:**
```
🚀 API called with templateId: hair-tuck
✅ Found template: { id: 'hair-tuck', name: 'Hair Tuck' }
🎨 Using generation mode: spicy (from template intensity: spicy)
✅ Task created successfully with taskId: [id]
```

**In Kie.ai Dashboard:**
- Task appears immediately
- Status: PROCESSING
- After ~60s: Status: SUCCESS
- Video URL available

**In Browser:**
- Loading indicator for ~60s
- Video appears and plays
- Actions available (share/download/save)

## 🎯 Success Criteria

Your implementation is working if:
- ✅ Task appears in Kie.ai logs
- ✅ Task status changes to "processing"
- ✅ Video URL is returned
- ✅ Video plays in browser
- ✅ Can download/share/save video

## 🐛 Troubleshooting

### Issue: Task stuck in "waiting"
**Solution:** Check Kie.ai account credits and status

### Issue: "Generation failed"
**Solution:** Check terminal logs for specific error

### Issue: Video doesn't play
**Solution:** Check browser console, try different browser

### Issue: Upload fails
**Solution:** Try smaller image (< 10MB), different format

## 📞 Need Help?

1. **Check Terminal Logs**: All debug info is there
2. **Check Kie.ai Dashboard**: https://kie.ai/logs
3. **Check Browser Console**: F12 → Console tab
4. **Review Documentation**: See `.agent/` folder files

## 🎉 Ready to Test!

Everything is configured and ready. Just:
1. Go to http://localhost:3010/generate
2. Upload an image
3. Select a template
4. Click "Generate"
5. Wait for the magic! ✨

**The new API key should work perfectly!** 🎬
