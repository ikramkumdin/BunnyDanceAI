// Template Prompts Database
// This file contains all the detailed prompts used to generate template videos
// Use these prompts when generating new videos with similar themes

export const templatePrompts = {
  'lustful-touch': {
    name: 'Lustful Touch',
    prompt: `A stunningly beautiful young woman with perfect symmetrical face, flawless porcelain skin, long flowing hair, seductive expression, wearing a tight low-cut top that accentuates her figure. She stands in an elegant luxurious bedroom with soft warm lighting. She slowly and sensually brings her hand up to her chest, gently touching and caressing her breasts through the fabric in a teasing and erotic way, biting her lower lip, looking directly at the camera with intense eye contact, subtle smile, slow graceful movements, highly detailed skin texture, realistic physics and fabric movement.

Camera: close-up to medium shot, slight slow dolly-in, cinematic 8K, photorealistic, ultra-detailed, natural soft bokeh background, 24 fps, sensual atmosphere, high production value, masterpiece`,
    intensity: 'spicy',
    category: 'playful'
  },

  'night-club-hip-movement': {
    name: 'Night Club Hip Movement',
    prompt: `A beautiful young woman, based on the reference image for her face and body. She is standing in a dimly lit nightclub with colorful lights, rhythmically shaking and twerking her hips and butt to upbeat music. Smooth, realistic animation, high-resolution 4K video, 10-second loop, slow-motion emphasis on the hip movements, cinematic camera panning from side to back view.`,
    intensity: 'spicy',
    category: 'shimmy'
  },

  'running-girl': {
    name: 'Running Girl',
    prompt: `A stunning athletic woman, based on the reference image for her face and physique. She is running dynamically. Her bra bounce with each step, captured in slow-motion for emphasis. Realistic animation, dynamic camera following from front and side angles, vibrant natural lighting.`,
    intensity: 'mild',
    category: 'sway'
  },

  'twerk-girl': {
    name: 'Twerk Girl',
    prompt: `based on the reference image for her face and physique.tiktok-style edge dance. Intense hip thrusting, aggressive twerking, ass shaking, waist rolling, seductive hair flips, provocative eye contact and biting lip, slow-motion sections mixed with fast rhythm beats, side-to-back camera rotation focusing heavily on her hips and ass shaking`,
    intensity: 'extreme',
    category: 'peach'
  },

  'hair-tuck': {
    name: 'Hair Tuck',
    prompt: `A highly detailed animated sequence of a beautiful woman with long, flowing hair performing a gentle hair tuck gesture: she gracefully lifts her hand to brush a strand of hair behind her ear, smiling softly with a serene expression. The animation is smooth, realistic, and in high resolution, based on the provided reference image for her facial features, clothing, and overall style. Use cinematic lighting, subtle wind effects on the hair, and a neutral background to emphasize the motion.`,
    intensity: 'mild',
    category: 'playful'
  },

  'sparkling-eye-wink': {
    name: 'Sparkling Eye Wink',
    prompt: `A highly detailed animated sequence of a beautiful woman based on the reference image, subtly flirting with the viewer by sending a coy wink towards the camera: she locks eyes with the screen, tilts her head playfully, gives a slow, seductive one-eyed wink while her lips curve into a teasing smile, with sparkling eyes and a hint of mischief. The animation is ultra-smooth, realistic, and in high resolution, capturing her exact facial features, hair, makeup, and clothing from the reference. Use soft cinematic lighting with a gentle glow on her face, subtle particle effects like fluttering eyelashes, and a neutral blurred background to focus on the expression and motion.`,
    intensity: 'mild',
    category: 'playful'
  },

  'snake-sway': {
    name: 'Snake Sway',
    prompt: `A highly detailed animated sequence of a beautiful woman based on the reference image, performing a seductive snake sway dance: she fluidly undulates her body in a serpentine wave motion starting from her hips, rolling up through her torso and shoulders in a hypnotic, snake-like sway, with graceful arm movements mimicking coiling and uncoiling, her expression sultry and confident with a subtle smile and intense gaze at the camera. The animation is ultra-smooth, realistic, and in high resolution, accurately capturing her facial features, hair, makeup, clothing, and overall style from the reference. Use dynamic cinematic lighting with soft shadows and highlights to accentuate the curves and motion, subtle particle effects like flowing fabric or hair movement, and a neutral blurred background to focus on the dance.`,
    intensity: 'spicy',
    category: 'sway'
  },

  'standing-split': {
    name: 'Standing Split',
    prompt: `A highly detailed animated sequence of a beautiful woman based on the reference image, performing a graceful standing split pose: she starts in a standing position, elegantly lifts one leg straight up high in front of her body while balancing on the other leg, extending her arms for poise and stability, her expression focused and serene with a subtle confident smile and direct gaze at the camera, showcasing flexibility and strength in a fluid motion. The animation is ultra-smooth, realistic, and in high resolution, accurately replicating her facial features, hair, makeup, clothing, and overall style from the reference. Use dynamic cinematic lighting with soft shadows and highlights to emphasize the leg extension and body lines, subtle particle effects like gentle fabric flow or hair movement, and a neutral blurred background to focus on the pose.`,
    intensity: 'mild',
    category: 'sway'
  },

  'kneel-and-crawl': {
    name: 'Kneel And Crawl',
    prompt: `A highly detailed animated sequence of a beautiful woman based on the reference image, performing a seductive kneel and crawl movement: she starts in a standing pose, gracefully lowers herself to her knees with elegant poise, then transitions into a fluid crawl forward on all fours, arching her back slightly in a cat-like manner, her hips swaying rhythmically, with a sultry expression, parted lips, and intense gaze directed at the camera to convey allure and confidence. The animation is ultra-smooth, realistic, and in high resolution, accurately replicating her facial features, hair, makeup, clothing, and overall style from the reference. Use dynamic cinematic lighting with soft shadows and highlights to accentuate her curves and motion, subtle particle effects like flowing hair or fabric movement, and a neutral blurred background to focus on the action.`,
    intensity: 'spicy',
    category: 'peach'
  }
};

// Helper function to get prompt by template ID
export function getTemplatePrompt(templateId: string) {
  return templatePrompts[templateId as keyof typeof templatePrompts];
}

// Helper function to get all prompts by category
export function getPromptsByCategory(category: string) {
  return Object.values(templatePrompts).filter(prompt => prompt.category === category);
}

// Helper function to get all prompts by intensity
export function getPromptsByIntensity(intensity: string) {
  return Object.values(templatePrompts).filter(prompt => prompt.intensity === intensity);
}




