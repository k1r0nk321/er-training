import { supabase } from './supabase';

// ログイン済みならSupabaseのアクセストークンを、
// 未ログイン（お試しモード）ならトライアルトークンを付けてPOSTする。
export async function authedFetch(url, body) {
  const headers = { 'Content-Type': 'application/json' };

  const { data: { session } } = await supabase.auth.getSession();
  if (session?.access_token) {
    headers['Authorization'] = `Bearer ${session.access_token}`;
  } else {
    try {
      const trialToken = sessionStorage.getItem('trial_token');
      if (trialToken) headers['X-Trial-Token'] = trialToken;
    } catch {}
  }

  return fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });
}
