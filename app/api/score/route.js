import Anthropic from '@anthropic-ai/sdk';
import { createClient } from '@supabase/supabase-js';
import { getAuthedUser } from '../../lib/auth-server';

export async function POST(req) {
                const user = await getAuthedUser(req);
                if (!user) {
                                    const trialToken = req.headers.get('x-trial-token');
                                    if (!trialToken) {
                                                        return Response.json({ error: 'ログインまたはお試しモードの開始が必要です' }, { status: 401 });
                                    }
                                    // consume_trial_callはservice_roleのみ実行可能（anon/authenticatedから
                                    // 直接呼んでp_capを上書きされたり、トークンなしで突破されたりするのを防ぐ）。
                                    const supabase = createClient(
                                                        process.env.NEXT_PUBLIC_SUPABASE_URL,
                                                        process.env.SUPABASE_SERVICE_ROLE_KEY
                                    );
                                    const { data: ok, error: trialError } = await supabase.rpc('consume_trial_call', {
                                                        p_token: trialToken,
                                    });
                                    if (trialError || !ok) {
                                                        return Response.json(
                                                                            { error: 'お試しモードの利用回数上限、または有効期限に達しました。新規登録してご利用ください。' },
                                                                            { status: 429 }
                                                        );
                                    }
                }

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
