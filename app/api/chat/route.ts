import { NextRequest } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

export const dynamic = 'force-dynamic'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export async function POST(request: NextRequest) {
  const { messages, context } = await request.json()

  const systemPrompt = `אתה עוזר משפחתי חכם ואוהב של משפחת אלוני. אתה מכיר את כל בני המשפחה:
- עמי (ami) — בת
- איתן (itan) — בן
- אלכס (alex) — בן
- אסף (assaf) — אבא
- דניאל (danil) — אמא

אתה יכול לעזור בלוח הזמנים, לתת עצות, להזכיר אירועים, ולשוחח בחופשיות.
ענה תמיד בעברית, בצורה קצרה וידידותית.${context ? `\n\nאירועי היום:\n${context}` : ''}`

  const stream = anthropic.messages.stream({
    model: 'claude-opus-4-5',
    max_tokens: 1024,
    system: systemPrompt,
    messages,
  })

  const readable = new ReadableStream({
    async start(controller) {
      try {
        for await (const chunk of stream) {
          if (chunk.type === 'content_block_delta' && chunk.delta.type === 'text_delta') {
            controller.enqueue(new TextEncoder().encode(chunk.delta.text))
          }
        }
      } finally {
        controller.close()
      }
    },
  })

  return new Response(readable, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  })
}
