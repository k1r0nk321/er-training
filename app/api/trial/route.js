import { createClient } from '@supabase/supabase-js';

export async function POST(req) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || null;

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );

  const { data, error } = await supabase.rpc('start_trial_session', { p_ip: ip });

  if (error || !data || !data[0]) {
    return Response.json(
      { error: 'お試しの開始に失敗しました。しばらくしてから再度お試しください。' },
      { status: 429 }
    );
  }

  const row = data[0];
  return Response.json({ token: row.id, expiresAt: row.expires_at });
}
