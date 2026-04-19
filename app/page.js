'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from './lib/auth-context';
import { supabase } from './lib/supabase';

export default function HomePage() {
  const { user, userProfile, signIn, signOut, loading } = useAuth();
  const router = useRouter();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [loginLoading, setLoginLoading] = useState(false);
  const [mode, setMode] = useState('login'); // 'login' | 'trial'
  const [trialPassword, setTrialPassword] = useState('');
  const [trialError, setTrialError] = useState('');
  const [announcements, setAnnouncements] = useState([]);
  const [trialPw, setTrialPw] = useState('');

  useEffect(() => {
    fetchAnnouncements();
    fetchTrialPw();
  }, []);

  const fetchAnnouncements = async () => {
    const { data } = await supabase
      .from('announcements')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(5);
    setAnnouncements(data || []);
  };

  const fetchTrialPw = async () => {
    const { data } = await supabase
      .from('app_settings')
      .select('value')
      .eq('key', 'trial_password')
      .single();
    if (data) setTrialPw(data.value);
  };

  const handleLogin = async (e) => {
    e?.preventDefault();
    setLoginError('');
    setLoginLoading(true);
    const { error } = await signIn(email, password);
    if (error) {
      setLoginError('メールアドレスまたはパスワードが違います');
    }
    setLoginLoading(false);
  };

  const handleTrial = () => {
    if (trialPassword === trialPw) {
      // お試しモード：sessionStorageにフラグを立てる
      sessionStorage.setItem('trial_mode', 'true');
      router.push('/cases');
    } else {
      setTrialError('パスワードが違います。管理者にご確認ください。');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-3"></div>
          <p className="text-gray-500">読み込み中...</p>
        </div>
      </div>
    );
  }

  // ログイン済みのトップ画面
  if (user && userProfile) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
        <div className="max-w-md mx-auto px-4 py-8 space-y-5">

          {/* ヘッダー */}
          <div className="text-center py-4">
            <div className="text-4xl mb-2">🏥</div>
            <h1 className="text-2xl font-black text-gray-900">ER Training</h1>
            <p className="text-sm text-gray-500 mt-1">医仁会 臨床研修プログラム</p>
          </div>

          {/* ウェルカムカード */}
          <div className="bg-white rounded-2xl shadow-sm p-5">
            <p className="text-sm text-gray-500">ようこそ</p>
            <p className="text-xl font-bold text-gray-900 mt-0.5">{userProfile.name} 先生</p>
            <p className="text-sm text-blue-600">{userProfile.role}</p>
          </div>

          {/* メインメニュー */}
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => router.push('/cases')}
              className="bg-blue-600 text-white rounded-2xl p-5 text-left hover:bg-blue-700 active:bg-blue-800 transition shadow-sm"
            >
              <div className="text-3xl mb-2">📋</div>
              <div className="font-bold text-base">症例に挑戦</div>
              <div className="text-xs text-blue-200 mt-0.5">鑑別診断・採点</div>
            </button>
            <button
              onClick={() => router.push('/results')}
              className="bg-indigo-600 text-white rounded-2xl p-5 text-left hover:bg-indigo-700 active:bg-indigo-800 transition shadow-sm"
            >
              <div className="text-3xl mb-2">📊</div>
              <div className="font-bold text-base">成績一覧</div>
              <div className="text-xs text-indigo-200 mt-0.5">過去の記録</div>
            </button>
          </div>

          {userProfile.is_admin && (
            <button
              onClick={() => router.push('/admin')}
              className="w-full bg-gray-700 text-white rounded-2xl p-4 text-left hover:bg-gray-800 transition shadow-sm flex items-center gap-3"
            >
              <span className="text-2xl">🔧</span>
              <div>
                <div className="font-bold">管理者ダッシュボード</div>
                <div className="text-xs text-gray-300">統計・症例管理・お知らせ</div>
              </div>
            </button>
          )}

          {/* お知らせ */}
          {announcements.length > 0 && (
            <div className="bg-white rounded-2xl shadow-sm p-4 space-y-2">
              <h3 className="font-bold text-gray-700 text-sm">📢 お知らせ</h3>
              {announcements.map(a => (
                <div key={a.id} className={`p-3 rounded-xl ${a.important ? 'bg-red-50' : 'bg-gray-50'}`}>
                  <p className={`text-sm font-bold ${a.important ? 'text-red-600' : 'text-gray-700'}`}>{a.title}</p>
                  {a.body && <p className="text-xs text-gray-500 mt-0.5">{a.body}</p>}
                </div>
              ))}
            </div>
          )}

          {/* ログアウト */}
          <button
            onClick={signOut}
            className="w-full text-gray-400 text-sm py-2 hover:text-gray-600"
          >
            ログアウト
          </button>
        </div>
      </div>
    );
  }

  // 未ログイン画面
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex flex-col">
      <div className="max-w-md mx-auto w-full px-4 py-10 space-y-6 flex-1">

        {/* タイトル */}
        <div className="text-center py-4">
          <div className="text-5xl mb-3">🏥</div>
          <h1 className="text-3xl font-black text-gray-900">ER Training</h1>
          <p className="text-gray-500 mt-1">医仁会 臨床研修プログラム</p>
        </div>

        {/* タブ切り替え */}
        <div className="bg-white rounded-2xl shadow-sm p-1 flex">
          <button
            onClick={() => setMode('login')}
            className={`flex-1 py-2.5 rounded-xl text-sm font-bold transition ${mode === 'login' ? 'bg-blue-600 text-white' : 'text-gray-400'}`}
          >
            ログイン
          </button>
          <button
            onClick={() => setMode('trial')}
            className={`flex-1 py-2.5 rounded-xl text-sm font-bold transition ${mode === 'trial' ? 'bg-indigo-600 text-white' : 'text-gray-400'}`}
          >
            お試しモード
          </button>
        </div>

        {/* ログインフォーム */}
        {mode === 'login' && (
          <div className="bg-white rounded-2xl shadow-sm p-6 space-y-4">
            <h2 className="font-bold text-gray-700">アカウントでログイン</h2>
            <form onSubmit={handleLogin} className="space-y-3">
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="メールアドレス"
                required
                className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
              />
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="パスワード"
                required
                className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
              />
              {loginError && <p className="text-red-500 text-xs">{loginError}</p>}
              <button
                type="submit"
                disabled={loginLoading}
                className="w-full bg-blue-600 text-white py-3 rounded-xl font-bold text-sm hover:bg-blue-700 disabled:opacity-50 transition"
              >
                {loginLoading ? 'ログイン中...' : 'ログイン'}
              </button>
            </form>
          </div>
        )}

        {/* お試しモード */}
        {mode === 'trial' && (
          <div className="bg-white rounded-2xl shadow-sm p-6 space-y-4">
            <h2 className="font-bold text-gray-700">お試しモード</h2>
            <p className="text-xs text-gray-500">共通パスワードで症例を体験できます。成績は保存されません。</p>
            <input
              type="password"
              value={trialPassword}
              onChange={e => setTrialPassword(e.target.value)}
              placeholder="共通パスワード"
              className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
              onKeyDown={e => e.key === 'Enter' && handleTrial()}
            />
            {trialError && <p className="text-red-500 text-xs">{trialError}</p>}
            <button
              onClick={handleTrial}
              disabled={!trialPassword}
              className="w-full bg-indigo-600 text-white py-3 rounded-xl font-bold text-sm hover:bg-indigo-700 disabled:opacity-50 transition"
            >
              体験する
            </button>
          </div>
        )}

        {/* お知らせ（未ログイン時も表示） */}
        {announcements.filter(a => a.important).length > 0 && (
          <div className="space-y-2">
            {announcements.filter(a => a.important).map(a => (
              <div key={a.id} className="bg-red-50 border border-red-100 rounded-xl p-3">
                <p className="text-sm font-bold text-red-600">🔴 {a.title}</p>
                {a.body && <p className="text-xs text-red-700 mt-0.5">{a.body}</p>}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
