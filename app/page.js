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

  // モード切替：'login' | 'signup' | 'trial'
  const [mode, setMode] = useState('login');

  // ログイン
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [loginLoading, setLoginLoading] = useState(false);
  const [showLoginPw, setShowLoginPw] = useState(false);

  // 新規アカウント作成
  const [signupEmail, setSignupEmail] = useState('');
  const [signupPassword, setSignupPassword] = useState('');
  const [signupPasswordConfirm, setSignupPasswordConfirm] = useState('');
  const [signupError, setSignupError] = useState('');
  const [signupLoading, setSignupLoading] = useState(false);
  const [signupDone, setSignupDone] = useState(false);
  const [showSignupPw, setShowSignupPw] = useState(false);
  const [showSignupPwConfirm, setShowSignupPwConfirm] = useState(false);

  // お試しモード
  const [trialPassword, setTrialPassword] = useState('');
  const [trialError, setTrialError] = useState('');
  const [trialPw, setTrialPw] = useState('');
  const [showTrialPw, setShowTrialPw] = useState(false);

  // プロフィール編集
  const [editingProfile, setEditingProfile] = useState(false);
  const [editName, setEditName] = useState('');
  const [editRole, setEditRole] = useState('');
  const [editLoading, setEditLoading] = useState(false);
  const [editError, setEditError] = useState('');
  const [editSuccess, setEditSuccess] = useState(false);

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

  // ===== ログイン =====
  const handleLogin = async (e) => {
    e?.preventDefault();
    setLoginError('');
    setLoginLoading(true);
    const { error } = await signIn(email, password);
    if (error) {
      setLoginError('メールアドレスまたはパスワードが違います');
    } else {
      sessionStorage.removeItem('trial_mode');
    }
    setLoginLoading(false);
  };

  // ===== 新規アカウント作成 =====
  const handleSignup = async (e) => {
    e?.preventDefault();
    setSignupError('');
    if (!signupEmail.trim()) { setSignupError('メールアドレスを入力してください'); return; }
    if (signupPassword.length < 8) { setSignupError('パスワードは8文字以上で設定してください'); return; }
    if (signupPassword !== signupPasswordConfirm) { setSignupError('パスワードが一致しません'); return; }
    setSignupLoading(true);
    const { error } = await supabase.auth.signUp({
      email: signupEmail.trim(),
      password: signupPassword,
    });
    if (error) {
      if (error.message.includes('already registered')) {
        setSignupError('このメールアドレスはすでに登録されています');
      } else {
        setSignupError('登録に失敗しました：' + error.message);
      }
    } else {
      setSignupDone(true);
    }
    setSignupLoading(false);
  };

  // ===== お試しモード =====
  const handleTrial = () => {
    if (trialPassword === trialPw) {
      sessionStorage.setItem('trial_mode', 'true');
      router.push('/cases');
    } else {
      setTrialError('パスワードが違います。管理者にご確認ください。');
    }
  };

  // ===== 新規ユーザー属性登録 =====
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

  // ===== プロフィール更新 =====
  const handleUpdateProfile = async (e) => {
    e?.preventDefault();
    if (!editName.trim()) { setEditError('お名前を入力してください'); return; }
    if (!editRole) { setEditError('身分を選択してください'); return; }
    setEditLoading(true);
    setEditError('');
    setEditSuccess(false);
    const { error } = await supabase
      .from('users')
      .update({ name: editName.trim(), role: editRole })
      .eq('id', user.id);
    if (error) {
      setEditError('更新に失敗しました。もう一度お試しください。');
    } else {
      setEditSuccess(true);
      setTimeout(() => window.location.reload(), 800);
    }
    setEditLoading(false);
  };

  const startEditProfile = () => {
    setEditName(userProfile.name || '');
    setEditRole(userProfile.role || '');
    setEditError('');
    setEditSuccess(false);
    setEditingProfile(true);
  };

  // ===== ローディング =====
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
            <p className="text-gray-500 mt-1">プロフィール設定（初回のみ）</p>
          </div>

          <div className="bg-white rounded-2xl shadow-sm p-6 space-y-5">
            <div>
              <h2 className="font-bold text-gray-800 text-lg">プロフィール登録</h2>
              <p className="text-sm text-gray-500 mt-1">初回ログイン時のみ必要です。</p>
            </div>

            <form onSubmit={handleRegister} className="space-y-4">
              <div>
                <label className="text-sm font-bold text-gray-700 mb-1 block">お名前 *</label>
                <p className="text-xs text-orange-600 mb-2">⚠️ 2次配布防止のため、実名でご登録ください。</p>
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
          </div>

          {/* プロフィールカード */}
          {!editingProfile ? (
            <div className="bg-white rounded-2xl shadow-sm p-5">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm text-gray-500">ようこそ</p>
                  <p className="text-xl font-bold text-gray-900 mt-0.5">{userProfile.name} 先生</p>
                  <p className="text-sm text-blue-600">{userProfile.role}</p>
                </div>
                <button
                  onClick={startEditProfile}
                  className="text-xs text-gray-400 hover:text-blue-600 border border-gray-200 hover:border-blue-300 px-3 py-1.5 rounded-lg transition"
                >
                  ✏️ 編集
                </button>
              </div>
            </div>
          ) : (
            <div className="bg-white rounded-2xl shadow-sm p-5 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-gray-800">プロフィール編集</h3>
                <button
                  onClick={() => setEditingProfile(false)}
                  className="text-xs text-gray-400 hover:text-gray-600"
                >
                  ✕ キャンセル
                </button>
              </div>
              <form onSubmit={handleUpdateProfile} className="space-y-4">
                <div>
                  <label className="text-sm font-bold text-gray-700 mb-1 block">お名前 *</label>
                  <p className="text-xs text-orange-600 mb-2">⚠️ 2次配布防止のため、実名でご登録ください。</p>
                  <input
                    type="text"
                    value={editName}
                    onChange={e => setEditName(e.target.value)}
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
                        onClick={() => setEditRole(opt.value)}
                        className={`w-full text-left px-4 py-3 rounded-xl border text-sm font-medium transition ${
                          editRole === opt.value
                            ? 'bg-blue-600 text-white border-blue-600'
                            : 'bg-white text-gray-700 border-gray-200 hover:border-blue-300 hover:bg-blue-50'
                        }`}
                      >
                        {editRole === opt.value ? '✓ ' : ''}{opt.label}
                      </button>
                    ))}
                  </div>
                </div>
                {editError && <p className="text-red-500 text-xs">{editError}</p>}
                {editSuccess && <p className="text-green-600 text-xs font-bold">✅ 更新しました！</p>}
                <button
                  type="submit"
                  disabled={editLoading || !editName.trim() || !editRole}
                  className="w-full bg-blue-600 text-white py-3 rounded-xl font-bold text-sm hover:bg-blue-700 disabled:opacity-50 transition"
                >
                  {editLoading ? '更新中...' : '保存する'}
                </button>
              </form>
            </div>
          )}

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
                  <p className={`text-sm font-bold ${a.important ? 'text-red-600' : 'text-gray-700'}`}>
                    {a.important ? '🔴 ' : ''}{a.title}
                  </p>
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
        </div>

        {/* タブ切替：ログイン／新規登録／お試し */}
        <div className="bg-white rounded-2xl shadow-sm p-1 flex">
          <button
            onClick={() => setMode('login')}
            className={`flex-1 py-2.5 rounded-xl text-xs font-bold transition ${mode === 'login' ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-gray-600'}`}
          >
            ログイン
          </button>
          <button
            onClick={() => setMode('signup')}
            className={`flex-1 py-2.5 rounded-xl text-xs font-bold transition ${mode === 'signup' ? 'bg-green-600 text-white' : 'text-gray-400 hover:text-gray-600'}`}
          >
            新規登録
          </button>
          <button
            onClick={() => setMode('trial')}
            className={`flex-1 py-2.5 rounded-xl text-xs font-bold transition ${mode === 'trial' ? 'bg-indigo-600 text-white' : 'text-gray-400 hover:text-gray-600'}`}
          >
            お試し
          </button>
        </div>

        {/* ===== ログイン ===== */}
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
              <div className="relative">
                <input
                  type={showLoginPw ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="パスワード"
                  required
                  className="w-full border border-gray-200 rounded-xl px-4 py-3 pr-12 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
                />
                <button
                  type="button"
                  onClick={() => setShowLoginPw(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 text-xs px-1"
                  tabIndex={-1}
                >
                  {showLoginPw ? '隠す' : '表示'}
                </button>
              </div>
              {loginError && <p className="text-red-500 text-xs">{loginError}</p>}
              <button
                type="submit"
                disabled={loginLoading}
                className="w-full bg-blue-600 text-white py-3 rounded-xl font-bold text-sm hover:bg-blue-700 disabled:opacity-50 transition"
              >
                {loginLoading ? 'ログイン中...' : 'ログイン'}
              </button>
            </form>
            <p className="text-center text-xs text-gray-400">
              アカウントをお持ちでない方は
              <button onClick={() => setMode('signup')} className="text-green-600 font-bold ml-1">新規登録</button>
            </p>
          </div>
        )}

        {/* ===== 新規アカウント作成 ===== */}
        {mode === 'signup' && (
          <div className="bg-white rounded-2xl shadow-sm p-6 space-y-4">
            <h2 className="font-bold text-gray-700">新規アカウント作成</h2>

            {signupDone ? (
              <div className="text-center space-y-4 py-4">
                <div className="text-5xl">📧</div>
                <p className="font-bold text-gray-800">確認メールを送信しました</p>
                <p className="text-sm text-gray-500">
                  <span className="font-bold text-blue-600">{signupEmail}</span> に確認メールを送りました。
                  メール内のリンクをクリックしてアカウントを有効化してください。
                </p>
                <button
                  onClick={() => { setSignupDone(false); setMode('login'); }}
                  className="w-full bg-blue-600 text-white py-3 rounded-xl font-bold text-sm hover:bg-blue-700 transition"
                >
                  ログイン画面へ
                </button>
              </div>
            ) : (
              <form onSubmit={handleSignup} className="space-y-3">
                <input
                  type="email"
                  value={signupEmail}
                  onChange={e => setSignupEmail(e.target.value)}
                  placeholder="メールアドレス"
                  required
                  className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-green-300"
                />
                <div className="relative">
                  <input
                    type={showSignupPw ? 'text' : 'password'}
                    value={signupPassword}
                    onChange={e => setSignupPassword(e.target.value)}
                    placeholder="パスワード（8文字以上）"
                    required
                    className="w-full border border-gray-200 rounded-xl px-4 py-3 pr-12 text-sm focus:outline-none focus:ring-2 focus:ring-green-300"
                  />
                  <button
                    type="button"
                    onClick={() => setShowSignupPw(v => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 text-xs px-1"
                    tabIndex={-1}
                  >
                    {showSignupPw ? '隠す' : '表示'}
                  </button>
                </div>
                <div className="relative">
                  <input
                    type={showSignupPwConfirm ? 'text' : 'password'}
                    value={signupPasswordConfirm}
                    onChange={e => setSignupPasswordConfirm(e.target.value)}
                    placeholder="パスワード（確認）"
                    required
                    className="w-full border border-gray-200 rounded-xl px-4 py-3 pr-12 text-sm focus:outline-none focus:ring-2 focus:ring-green-300"
                  />
                  <button
                    type="button"
                    onClick={() => setShowSignupPwConfirm(v => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 text-xs px-1"
                    tabIndex={-1}
                  >
                    {showSignupPwConfirm ? '隠す' : '表示'}
                  </button>
                </div>
                {signupError && <p className="text-red-500 text-xs">{signupError}</p>}
                <button
                  type="submit"
                  disabled={signupLoading}
                  className="w-full bg-green-600 text-white py-3 rounded-xl font-bold text-sm hover:bg-green-700 disabled:opacity-50 transition"
                >
                  {signupLoading ? '登録中...' : 'アカウントを作成する'}
                </button>
              </form>
            )}

            {!signupDone && (
              <p className="text-center text-xs text-gray-400">
                すでにアカウントをお持ちの方は
                <button onClick={() => setMode('login')} className="text-blue-600 font-bold ml-1">ログイン</button>
              </p>
            )}
          </div>
        )}

        {/* ===== お試しモード ===== */}
        {mode === 'trial' && (
          <div className="bg-white rounded-2xl shadow-sm p-6 space-y-4">
            <h2 className="font-bold text-gray-700">お試しモード</h2>
            <p className="text-xs text-gray-500">
              共通パスワードで症例を体験できます。成績は保存されません。<br />
              パスワードは管理者にお問い合わせください。
            </p>
            <div className="relative">
              <input
                type={showTrialPw ? 'text' : 'password'}
                value={trialPassword}
                onChange={e => { setTrialPassword(e.target.value); setTrialError(''); }}
                placeholder="共通パスワード"
                className="w-full border border-gray-200 rounded-xl px-4 py-3 pr-12 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
                onKeyDown={e => e.key === 'Enter' && handleTrial()}
              />
              <button
                type="button"
                onClick={() => setShowTrialPw(v => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 text-xs px-1"
                tabIndex={-1}
              >
                {showTrialPw ? '隠す' : '表示'}
              </button>
            </div>
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

        {/* お知らせ（全件表示） */}
        {announcements.length > 0 && (
          <div className="space-y-2">
            {announcements.map(a => (
              <div
                key={a.id}
                className={`rounded-xl p-4 ${a.important ? 'bg-red-50 border border-red-100' : 'bg-white border border-gray-100 shadow-sm'}`}
              >
                <p className={`text-sm font-bold ${a.important ? 'text-red-600' : 'text-gray-700'}`}>
                  {a.important ? '🔴 ' : '📢 '}{a.title}
                </p>
                {a.body && (
                  <p className={`text-xs mt-1 ${a.important ? 'text-red-700' : 'text-gray-500'}`}>
                    {a.body}
                  </p>
                )}
              </div>
            ))}
          </div>
        )}

      </div>
    </div>
  );
}
