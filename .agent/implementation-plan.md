# Grok Imagine Image-to-Video Implementation Plan

## Overview
Implement image-to-video generation using the Grok Imagine API (Kie.ai) with template-based prompts.

## Documentation Summary (from https://kie.ai/grok-imagine)

### Supported Models
1. **Grok T2V (Text-to-Video)**: Turns written prompts into short AI-generated videos with natural motion, scene continuity, and synchronized audio
2. **Grok I2V (Image-to-Video)**: Animates a single image into a smooth short video while preserving the original look, adding motion, depth, and lighting variation

### Key Features
- Text-to-Image & Text-to-Video generation
- High-quality Image-to-Video animation
- Synchronized audio + motion
- Multiple modes including "Spicy Mode"
- Fast & efficient generation

### API Usage Steps
1. **Access API**: Get free credits from Kie.ai
2. **Choose Mode**: Select generation mode (Normal, Fun, Custom, or Spicy)
3. **Enter Prompt**: Provide text prompt or upload image
4. **Generate**: API processes request and delivers results in seconds

### API Endpoint
- **URL**: `https://api.kie.ai/api/v1/jobs/createTask`
- **Model**: `grok-imagine/image-to-video`
- **Method**: POST
- **Headers**: 
  - `Authorization: Bearer {API_KEY}`
  - `Content-Type: application/json`

### Request Format
```json
{
  "model": "grok-imagine/image-to-video",
  "callBackUrl": "optional_callback_url",
  "input": {
    "image_urls": ["https://example.com/image.jpg"],
    "index": 0,
    "prompt": "Animation description...",
    "mode": "normal" // or "spicy", "fun", "custom"
  }
}
```

### Response Format
```json
{
  "code": 200,
  "data": {
    "taskId": "task_id_here"
  }
}
```

## Current Implementation Status

### ✅ Already Implemented
1. **Template System**: Templates with prompts stored in `/data/templates.ts` and `/data/template-prompts.ts`
2. **Image Upload**: PhotoUpload component handles image selection and upload to GCS
3. **API Route**: `/api/generate` exists and calls Kie.ai API
4. **Polling System**: Frontend polls for video completion
5. **Callback System**: Callback URL for async completion notifications

### 🔧 Issues to Fix
1. **Prompt Construction**: Ensure template prompts are properly used
2. **Image URL Accessibility**: Verify images are publicly accessible for Kie.ai to fetch
3. **Error Handling**: Improve error messages and retry logic
4. **Mode Selection**: Currently hardcoded to "normal", should support template-based modes

## Implementation Tasks

### Task 1: Verify Template Prompts are Used ✅
- [x] Check that `getTemplatePrompt()` is called correctly
- [x] Ensure prompts from `template-prompts.ts` are prioritized
- [x] Add identity wrapper to maintain person's appearance

### Task 2: Improve Image URL Handling ✅
- [x] Ensure GCS bucket is public or use signed URLs
- [x] Test URL accessibility before sending to Kie.ai
- [x] Add fallback to direct upload to Kie.ai File Upload API

### Task 3: Add Mode Support
- [ ] Map template intensity to Kie.ai modes:
  - `mild` → `normal`
  - `spicy` → `spicy`
  - `extreme` → `spicy`
- [ ] Allow custom mode selection in UI

### Task 4: Enhance Error Handling
- [x] Add detailed logging for debugging
- [x] Surface Kie.ai validation errors clearly
- [x] Add retry logic for transient failures

### Task 5: Testing & Validation
- [ ] Test with different template types
- [ ] Verify video quality and prompt adherence
- [ ] Test callback and polling mechanisms
- [ ] Validate error scenarios

## Code Changes Required

### 1. Update `/app/api/generate/route.ts`
- ✅ Already uses `getTemplatePrompt()` correctly
- ✅ Has identity wrapper for person consistency
- ✅ Tests URL accessibility
- 🔧 Add mode mapping based on template intensity

### 2. Update `/app/generate/page.tsx`
- ✅ Already passes template ID correctly
- ✅ Has polling mechanism
- ✅ Displays generated videos
- No changes needed

### 3. Update `/data/template-prompts.ts`
- ✅ Prompts are detailed and specific
- ✅ Include intensity and category
- No changes needed

## Testing Checklist

- [ ] Upload an image
- [ ] Select a template (e.g., "Lustful Touch", "Snake Sway")
- [ ] Click "Generate"
- [ ] Verify prompt is constructed correctly (check logs)
- [ ] Verify image URL is accessible (check logs)
- [ ] Verify taskId is returned
- [ ] Wait for video generation (polling)
- [ ] Verify video is displayed
- [ ] Test download, share, and save functions

## Notes

- **API Key**: Stored in `GROK_API_KEY` environment variable
- **Bucket**: `bunnydanceai-storage` (should be public)
- **Callback URL**: `{baseUrl}/api/callback`
- **Polling Interval**: 10 seconds
- **Max Polling Time**: 20 minutes
- **Prompt Length Limit**: 5000 characters (Kie.ai limit)

## Next Steps

1. Add mode selection based on template intensity
2. Test with various templates
3. Monitor Kie.ai logs for any issues
4. Optimize prompt construction for better results
