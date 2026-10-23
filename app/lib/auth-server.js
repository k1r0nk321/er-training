import { createClient } from '@supabase/supabase-js';

// Authorizationヘッダーのトークンを検証し、ログイン済みユーザーを返す。
// 未ログイン・無効なトークンの場合は null を返す。
export async function getAuthedUser(req) {
  const authHeader = req.headers.get('authorization') || '';
  const token = authHeader.replace(/^Bearer\s+/i, '').trim();
  if (!token) return null;

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data?.user) return null;
  return data.user;
}
