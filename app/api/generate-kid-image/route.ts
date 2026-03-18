import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  const { kidName, style } = await request.json()

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

  // Generate a fun image prompt using Claude
  const msg = await client.messages.create({
    model: 'claude-3-5-haiku-20241022',
    max_tokens: 150,
    messages: [{
      role: 'user',
      content: `Create a fun, colorful, child-friendly cartoon avatar prompt for a kid named "${kidName}".
Style preference: ${style || 'cute cartoon'}.
Return ONLY a single image generation prompt (no explanation), max 100 words.
The prompt should be in English, describe an adorable cartoon character/avatar, bright colors, happy, child-friendly.
Start with the style/art style, then describe the character.`
    }]
  })

  const prompt = (msg.content[0] as { text: string }).text.trim()

  // Build Pollinations AI URLs (free, no API key needed)
  const encodedPrompt = encodeURIComponent(prompt)
  const seed = Math.floor(Math.random() * 999999)

  // Generate 4 variants with different seeds
  const variants = [0, 1, 2, 3].map(i =>
    `https://image.pollinations.ai/prompt/${encodedPrompt}?width=512&height=512&seed=${seed + i * 100}&nologo=true&enhance=true`
  )

  return NextResponse.json({ prompt, variants })
}
