import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

export const dynamic = 'force-dynamic'

const STYLE_PROMPTS: Record<string, string> = {
  'cute cartoon': 'cute cartoon character, Disney Pixar style, vibrant colors, expressive big eyes, smooth shading, colorful background',
  'anime': 'anime chibi character, Studio Ghibli inspired, pastel colors, detailed hair, soft lighting, dreamy background',
  'watercolor': 'watercolor illustration, soft brush strokes, pastel palette, artistic, flowing colors, white paper texture',
  'pixel art': '16-bit pixel art character sprite, retro game style, bright pixel colors, clean outlines, game character',
  'superhero': 'superhero character illustration, dynamic pose, bold colors, comic book style, heroic, action pose',
  'sticker': 'cute sticker design, thick white outline, flat design, kawaii style, bright cheerful colors, no background',
}

export async function POST(request: NextRequest) {
  const { kidName, style } = await request.json()
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

  const styleDesc = STYLE_PROMPTS[style] || STYLE_PROMPTS['cute cartoon']

  const msg = await client.messages.create({
    model: 'claude-3-5-haiku-20241022',
    max_tokens: 200,
    messages: [{
      role: 'user',
      content: `Create a detailed image generation prompt for an AI art generator. The subject is a cute avatar/portrait for a child named "${kidName}".
Style: ${styleDesc}
Requirements: child-safe, friendly, happy expression, portrait/avatar framing (head and shoulders), high quality, detailed.
Return ONLY the prompt text (no explanation, no quotes), max 120 words. Write in English. Make it vivid and specific for best image quality.`
    }]
  })

  const prompt = (msg.content[0] as { text: string }).text.trim()
  const encodedPrompt = encodeURIComponent(prompt)
  const baseSeed = Math.floor(Math.random() * 99999)

  const variants = [0, 1, 2, 3].map(i =>
    `https://image.pollinations.ai/prompt/${encodedPrompt}?width=1024&height=1024&model=flux&seed=${baseSeed + i * 137}&nologo=true&enhance=true`
  )

  return NextResponse.json({ prompt, variants })
}
