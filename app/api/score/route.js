import Anthropic from '@anthropic-ai/sdk';

export async function POST(req) {
    try {
          const { prompt, stream = false } = await req.json();

      const client = new Anthropic({
              apiKey: process.env.ANTHROPIC_API_KEY,
      });

      const message = await client.messages.create({
              model: 'claude-sonnet-4-5-20250929',
              max_tokens: 2048,
              messages: [
                { role: 'user', content: prompt }
                      ],
      });

      const text = message.content?.[0]?.text || '';

      return Response.json({ text, content: text });
    } catch (error) {
          console.error('Anthropic API error:', error);
          return Response.json(
            { error: 'AI採点に失敗しました', detail: error.message },
            { status: 500 }
                );
    }
}
