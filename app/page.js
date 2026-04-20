'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from './lib/auth-context';
import { supabase } from './lib/supabase';

const ADMIN_EMAIL = 'nakamae@mub.biglobe.ne.jp';

const ROLE_OPTIONS = [
  { value: '医学生', label: '医学生' },
  { value: '初期研修医1年', label: '初期研修医（1年目）' },
  { value: '初期研修医2年', label: '初期研修医（2年目）' },
  { value: '専攻医・後期研修医', label: '専攻医・後期研修医' },
  { value: 'コメディカル', label: 'コメディカル' },
  { value: '指導医', label: '指導医' },
  { value: 'その他', label: 'その他' },
];

export default function HomePage() {
  const { user, userProfile, isNewUser, signIn, signOut, registerProfile, loading } = useAuth();
  const router = useRouter();

  // ログインフォーム
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [loginLoading, setLoginLoading] = useState(false);
  const [mode, setMode] = useState('login');

  // お試しモード
  const [trialPassword, setTrialPassword] = useState('');
  const [trialError, setTrialError] = useState('');
  const [trialPw, setTrialPw] = useState('');

  // 新規ユーザー属性登録
  const [regName, setRegName] = useState('');
  const [regRole, setRegRole] = useState('');
  const [regLoading, setRegLoading] = useState(false);
  const [regError, setRegError] = useState('');

  // お知らせ
  const [announcements, setAnnouncements] = useState([]);

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
    if (error) setLoginError('メールアドレスまたはパスワードが違います');
    setLoginLoading(false);
  };

  const handleTrial = () => {
    if (trialPassword === trialPw) {
      sessionStorage.setItem('trial_mode', 'true');
      router.push('/cases');
    } else {
      setTrialError('パスワードが違います。管理者にご確認ください。');
    }
  };

  // 新規ユーザー属性登録
  const handleRegister = async (e) => {
    e?.preventDefault();
    if (!regName.trim()) { setRegError('お名前を入力してください'); return; }
    if (!regRole) { setRegError('身分を選択してください'); return; }
    setRegLoading(true);
    setRegError('');
    const { error } = await registerProfile(regName.trim(), regRole);
    if (error) setRegError('登録に失敗しました。もう一度お試しください。');
    setRegLoading(false);
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

  // ===== 新規ユーザー：属性登録画面 =====
  if (user && isNewUser) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex flex-col">
        <div className="max-w-md mx-auto w-full px-4 py-10 space-y-6 flex-1">
          <div className="text-center py-4">
            <div className="text-5xl mb-3">🏥</div>
            <h1 className="text-2xl font-black text-gray-900">ER Training</h1>
            <p className="text-gray-500 mt-1">初回ログイン設定</p>
          </div>

          <div className="bg-white rounded-2xl shadow-sm p-6 space-y-5">
            <div>
              <h2 className="font-bold text-gray-800 text-lg">プロフィール登録</h2>
              <p className="text-sm text-gray-500 mt-1">初回のみ設定が必要です。</p>
            </div>

            <form onSubmit={handleRegister} className="space-y-4">
              <div>
                <label className="text-sm font-bold text-gray-700 mb-1 block">お名前 *</label>
                <input
                  type="text"
                  value={regName}
                  onChange={e => setRegName(e.target.value)}
                  placeholder="例：山田 太郎"
                  className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
                />
              </div>

              <div>
                <label className="text-sm font-bold text-gray-700 mb-2 block">身分 *</label>
                <div className="space-y-2">
                  {ROLE_OPTIONS.map(opt => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setRegRole(opt.value)}
                      className={`w-full text-left px-4 py-3 rounded-xl border text-sm font-medium transition ${
                        regRole === opt.value
                          ? 'bg-blue-600 text-white border-blue-600'
                          : 'bg-white text-gray-700 border-gray-200 hover:border-blue-300 hover:bg-blue-50'
                      }`}
                    >
                      {regRole === opt.value ? '✓ ' : ''}{opt.label}
                    </button>
                  ))}
                </div>
              </div>

              {regError && <p className="text-red-500 text-xs">{regError}</p>}

              <button
                type="submit"
                disabled={regLoading || !regName.trim() || !regRole}
                className="w-full bg-blue-600 text-white py-3 rounded-xl font-bold text-sm hover:bg-blue-700 disabled:opacity-50 transition"
              >
                {regLoading ? '登録中...' : '登録して始める'}
              </button>
            </form>
          </div>

          <button onClick={signOut} className="w-full text-gray-400 text-sm py-2 hover:text-gray-600">
            ログアウト
          </button>
        </div>
      </div>
    );
  }

  // ===== ログイン済み：トップ画面 =====
  if (user && userProfile) {
    const isAdmin = user.email === ADMIN_EMAIL;

    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
        <div className="max-w-md mx-auto px-4 py-8 space-y-5">
          <div className="text-center py-4">
            <div className="text-4xl mb-2">🏥</div>
            <h1 className="text-2xl font-black text-gray-900">ER Training</h1>
            <p className="text-sm text-gray-500 mt-1">医仁会 臨床研修プログラム</p>
          </div>

          <div className="bg-white rounded-2xl shadow-sm p-5">
            <p className="text-sm text-gray-500">ようこそ</p>
            <p className="text-xl font-bold text-gray-900 mt-0.5">{userProfile.name} 先生</p>
            <p className="text-sm text-blue-600">{userProfile.role}</p>
          </div>

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

          {/* 管理者ダッシュボードは中前先生のみ表示 */}
          {isAdmin && (
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

          <button onClick={signOut} className="w-full text-gray-400 text-sm py-2 hover:text-gray-600">
            ログアウト
          </button>
        </div>
      </div>
    );
  }

  // ===== 未ログイン画面 =====
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex flex-col">
      <div className="max-w-md mx-auto w-full px-4 py-10 space-y-6 flex-1">
        <div className="text-center py-4">
          <div className="text-5xl mb-3">🏥</div>
          <h1 className="text-3xl font-black text-gray-900">ER Training</h1>
          <p className="text-gray-500 mt-1">医仁会 臨床研修プログラム</p>
        </div>

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
