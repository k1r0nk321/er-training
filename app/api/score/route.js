import Anthropic from '@anthropic-ai/sdk';

export async function POST(req) {
                try {
                                    const { prompt } = await req.json();

                    const client = new Anthropic({
                                            apiKey: process.env.ANTHROPIC_API_KEY,
                    });

                    const message = await client.messages.create({
                                            model: 'claude-sonnet-4-5',
                                            max_tokens: 2048,
                                            messages: [
                                                        { role: 'user', content: prompt }
                                                                    ],
                    });

                    const text = message.content?.[0]?.text || '';
                                    return Response.json({ text, content: text });
                } catch (error) {
                                    console.error('Anthropic API error:', error);
                                    // クレジット不足の場合は決まったメッセージを返す
                    const isCreditError = error.message?.includes('credit balance is too low') ||
                                                              error.message?.includes('insufficient_quota') ||
                                                              error.status === 402;
                                    return Response.json(
                                                {
                                                                            error: isCreditError
                                                                                ? 'AIクレジットが不足しています。管理者に連絡してください。'
                                                                                                            : 'AI処理に失敗しました',
                                                                            detail: error.message,
                                                                            creditError: isCreditError
                                                },
                                                { status: isCreditError ? 402 : 500 }
                                                        );
                }
}
