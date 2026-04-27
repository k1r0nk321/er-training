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

const TERMS_TEXT = `【ER Training 利用規約】

第1条（目的・アプリの性質）
本アプリ「ER Training」は、医師・医学生・コメディカルスタッフを対象とした教育・学習目的のシミュレーションツールです。AIが生成する症例・フィードバック・採点は、臨床現場での診断・治療の指針を提供するものではありません。

第2条（医療免責事項）
・本アプリの症例・採点結果を実際の患者への診療に使用してはなりません。
・AIによる採点・フィードバックは医学的に正確であることを保証するものではありません。
・実際の臨床判断は、最新のガイドライン・文献・指導医の指示に従ってください。
・本アプリの利用による臨床上の判断・行動について、運営者は一切の責任を負いません。

第3条（利用者の登録義務）
・利用にあたっては、実名・所属・資格を正確に登録することへの同意が必要です。虚偽の情報による登録は禁止します。
・アカウントは利用者本人のみが使用できます。他者への貸与・譲渡を禁止します。
・アクセス情報（URL・パスワード等）を無断で第三者に配布・開示することを禁じます。

第4条（個人情報の取り扱い）
・登録された個人情報（氏名・メールアドレス・所属・資格・学習成績）は、本アプリの利用者管理・認証、研修プログラムの教育効果の評価・改善、運営者からのお知らせ配信のみに使用します。
・収集した個人情報は、上記以外の目的には一切使用しません。
・個人情報を第三者に提供・販売することはありません。
・本アプリは広告を表示せず、広告目的での個人情報利用は行いません。
・学習成績は、指導医・プログラム管理者が教育目的で閲覧する場合があります。

第5条（AIの利用と限界）
・本アプリはAI（Anthropic社 Claude）を使用して採点・フィードバックを行います。
・AIの回答には誤りが含まれる可能性があります。

第6条（禁止事項）
・本アプリを実際の患者診療の判断に利用すること
・アクセス情報・パスワードを無断で第三者に開示・配布すること
・アプリの内容を無断で複製・転載すること

運営：医仁会武田総合病院 臨床研修部`;

export default function HomePage() {
  const { user, userProfile, isNewUser, signIn, signOut, registerProfile, loading } = useAuth();
  const router = useRouter();

  const [mode, setMode] = useState('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [loginLoading, setLoginLoading] = useState(false);
  const [showLoginPw, setShowLoginPw] = useState(false);
  const [signupEmail, setSignupEmail] = useState('');
  const [signupPassword, setSignupPassword] = useState('');
  const [signupPasswordConfirm, setSignupPasswordConfirm] = useState('');
  const [signupError, setSignupError] = useState('');
  const [signupLoading, setSignupLoading] = useState(false);
  const [signupDone, setSignupDone] = useState(false);
  const [showSignupPw, setShowSignupPw] = useState(false);
  const [showSignupPwConfirm, setShowSignupPwConfirm] = useState(false);
  const [trialPassword, setTrialPassword] = useState('');
  const [trialError, setTrialError] = useState('');
  const [trialPw, setTrialPw] = useState('');
  const [showTrialPw, setShowTrialPw] = useState(false);

  // プロフィール編集
  const [editingProfile, setEditingProfile] = useState(false);
  const [editName, setEditName] = useState('');
  const [editRole, setEditRole] = useState('');
  const [editDepartment, setEditDepartment] = useState('');
  const [editLoading, setEditLoading] = useState(false);
  const [editError, setEditError] = useState('');
  const [editSuccess, setEditSuccess] = useState(false);

  // 新規登録
  const [regName, setRegName] = useState('');
  const [regRole, setRegRole] = useState('');
  const [regDepartment, setRegDepartment] = useState('');
  const [regLoading, setRegLoading] = useState(false);
  const [regError, setRegError] = useState('');
  const [termsAgreed, setTermsAgreed] = useState(false);
  const [showTerms, setShowTerms] = useState(false);

  // アカウント削除
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [deleteInput, setDeleteInput] = useState('');

  const [announcements, setAnnouncements] = useState([]);

  const [appUpdates, setAppUpdates] = useState([]);

  useEffect(() => {
    fetchAnnouncements();
    fetchTrialPw();
    fetchAppUpdates();
  }, []);

  const fetchAnnouncements = async () => {
    const { data } = await supabase
      .from('announcements')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(5);
    setAnnouncements(data || []);
  };

  const fetchAppUpdates = async () => {
    const { data } = await supabase
      .from('app_updates')
      .select('id, title, category, created_at')
      .order('created_at', { ascending: false })
      .limit(3);
    setAppUpdates(data || []);
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
    } else {
      sessionStorage.removeItem('trial_mode');
    }
    setLoginLoading(false);
  };

  const handleSignup = async (e) => {
    e?.preventDefault();
    setSignupError('');
    if (!signupEmail.trim()) { setSignupError('メールアドレスを入力してください'); return; }
    if (signupPassword.length < 8) { setSignupError('パスワードは8文字以上で設定してください'); return; }
    if (signupPassword !== signupPasswordConfirm) { setSignupError('パスワードが一致しません'); return; }
    setSignupLoading(true);
    const { error } = await supabase.auth.signUp({ email: signupEmail.trim(), password: signupPassword });
    if (error) {
      setSignupError(error.message.includes('already registered')
        ? 'このメールアドレスはすでに登録されています'
        : '登録に失敗しました：' + error.message);
    } else {
      setSignupDone(true);
    }
    setSignupLoading(false);
  };

  const handleTrial = () => {
    if (trialPassword === trialPw) {
      sessionStorage.setItem('trial_mode', 'true');
      router.push('/cases');
    } else {
      setTrialError('パスワードが違います。管理者にご確認ください。');
    }
  };

  const handleRegister = async (e) => {
    e?.preventDefault();
    if (!regName.trim()) { setRegError('お名前を入力してください'); return; }
    if (!regRole) { setRegError('身分を選択してください'); return; }
    if (!termsAgreed) { setRegError('利用規約に同意してください'); return; }
    setRegLoading(true);
    setRegError('');
    // registerProfileで基本情報を登録後、departmentを更新
    const { error } = await registerProfile(regName.trim(), regRole);
    if (error) {
      setRegError('登録に失敗しました。もう一度お試しください。');
    } else if (regDepartment.trim()) {
      // 所属がある場合は追加更新
      await supabase
        .from('users')
        .update({ department: regDepartment.trim() })
        .eq('id', user.id);
    }
    setRegLoading(false);
  };

  const handleUpdateProfile = async (e) => {
    e?.preventDefault();
    if (!editName.trim()) { setEditError('お名前を入力してください'); return; }
    if (!editRole) { setEditError('身分を選択してください'); return; }
    setEditLoading(true);
    setEditError('');
    setEditSuccess(false);
    const { error } = await supabase
      .from('users')
      .update({
        name: editName.trim(),
        role: editRole,
        department: editDepartment.trim() || null,
      })
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
    setEditDepartment(userProfile.department || '');
    setEditError('');
    setEditSuccess(false);
    setEditingProfile(true);
  };

  // アカウント削除
  const handleDeleteAccount = async () => {
    if (deleteInput !== '削除する') return;
    setDeleteLoading(true);
    try {
      // 成績・ユーザー情報を削除
      await supabase.from('results').delete().eq('user_id', user.id);
      await supabase.from('users').delete().eq('id', user.id);
      await signOut();
      alert('アカウントを削除しました。ご利用ありがとうございました。');
    } catch {
      alert('削除に失敗しました。管理者にお問い合わせください。');
    }
    setDeleteLoading(false);
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
        <div className="max-w-md mx-auto w-full px-4 py-10 space-y-5 flex-1">
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
              {/* 名前 */}
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

              {/* 所属 */}
              <div>
                <label className="text-sm font-bold text-gray-700 mb-1 block">所属（任意）</label>
                <input
                  type="text"
                  value={regDepartment}
                  onChange={e => setRegDepartment(e.target.value)}
                  placeholder="例：医仁会武田総合病院"
                  className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
                />
              </div>

              {/* 身分 */}
              <div>
                <label className="text-sm font-bold text-gray-700 mb-2 block">身分 *</label>
                <div className="grid grid-cols-2 gap-2">
                  {ROLE_OPTIONS.map(opt => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setRegRole(opt.value)}
                      className={`text-left px-3 py-2.5 rounded-xl border text-xs font-medium transition ${
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

              {/* 利用規約 */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-bold text-gray-700">利用規約 *</label>
                  <button
                    type="button"
                    onClick={() => setShowTerms(!showTerms)}
                    className="text-xs text-blue-600 hover:text-blue-800 font-bold underline"
                  >
                    {showTerms ? '閉じる ▲' : '規約を確認する ▼'}
                  </button>
                </div>

                {showTerms && (
                  <div className="bg-gray-50 rounded-xl p-4 max-h-48 overflow-y-auto border border-gray-200">
                    <pre className="text-xs text-gray-600 whitespace-pre-wrap font-sans leading-relaxed">
                      {TERMS_TEXT}
                    </pre>
                  </div>
                )}

                <label className="flex items-start gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={termsAgreed}
                    onChange={e => setTermsAgreed(e.target.checked)}
                    className="w-4 h-4 mt-0.5 rounded accent-blue-600 flex-shrink-0"
                  />
                  <span className="text-xs text-gray-700 leading-relaxed">
                    利用規約を読み、内容に同意します。個人情報（氏名・メールアドレス・所属・成績）が本アプリの管理目的のみに使用されることに同意します。
                  </span>
                </label>
              </div>

              {regError && <p className="text-red-500 text-xs">{regError}</p>}

              <button
                type="submit"
                disabled={regLoading || !regName.trim() || !regRole || !termsAgreed}
                className="w-full bg-blue-600 text-white py-3 rounded-xl font-bold text-sm hover:bg-blue-700 disabled:opacity-50 transition"
              >
                {regLoading ? '登録中...' : '同意して登録する'}
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
              <div className="flex items-start justify-between mb-1">
                <div>
                  <p className="text-xs text-gray-400">ようこそ</p>
                  <p className="text-xl font-bold text-gray-900 mt-0.5">{userProfile.name} 先生</p>
                  <p className="text-sm text-blue-600">{userProfile.role}</p>
                  {userProfile.department && (
                    <p className="text-xs text-gray-500 mt-0.5">{userProfile.department}</p>
                  )}
                </div>
                <button
                  onClick={startEditProfile}
                  className="text-xs text-blue-600 hover:text-blue-800 border border-blue-200 hover:border-blue-400 bg-blue-50 px-3 py-1.5 rounded-lg transition font-bold flex-shrink-0"
                >
                  ✏️ 編集
                </button>
              </div>
            </div>
          ) : (
            <div className="bg-white rounded-2xl shadow-sm p-5 space-y-4 border-2 border-blue-200">
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-blue-700">✏️ プロフィール編集</h3>
                <button
                  onClick={() => { setEditingProfile(false); setEditSuccess(false); setEditError(''); }}
                  className="text-xs text-gray-400 hover:text-gray-600 px-2 py-1 rounded border border-gray-200"
                >
                  ✕ キャンセル
                </button>
              </div>

              <form onSubmit={handleUpdateProfile} className="space-y-4">
                {/* 名前 */}
                <div>
                  <label className="text-xs font-bold text-gray-600 mb-1 block">
                    お名前 <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={editName}
                    onChange={e => setEditName(e.target.value)}
                    placeholder="例：山田 太郎"
                    className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
                  />
                </div>

                {/* 所属 */}
                <div>
                  <label className="text-xs font-bold text-gray-600 mb-1 block">所属</label>
                  <input
                    type="text"
                    value={editDepartment}
                    onChange={e => setEditDepartment(e.target.value)}
                    placeholder="例：医仁会武田総合病院"
                    className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
                  />
                </div>

                {/* 身分 */}
                <div>
                  <label className="text-xs font-bold text-gray-600 mb-2 block">
                    身分 <span className="text-red-500">*</span>
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    {ROLE_OPTIONS.map(opt => (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => setEditRole(opt.value)}
                        className={`text-left px-3 py-2.5 rounded-xl border text-xs font-medium transition ${
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
                {editSuccess && (
                  <div className="bg-green-50 border border-green-200 rounded-xl px-4 py-2">
                    <p className="text-green-700 text-xs font-bold">✅ プロフィールを更新しました</p>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={editLoading || !editName.trim() || !editRole}
                  className="w-full bg-blue-600 text-white py-3 rounded-xl font-bold text-sm hover:bg-blue-700 disabled:opacity-50 transition"
                >
                  {editLoading ? '更新中...' : '💾 保存する'}
                </button>
              </form>

              {/* アカウント削除セクション */}
              <div className="pt-3 border-t border-gray-100">
                {!showDeleteConfirm ? (
                  <button
                    onClick={() => setShowDeleteConfirm(true)}
                    className="w-full text-xs text-red-400 hover:text-red-600 py-2 transition"
                  >
                    🗑️ アカウントを削除する
                  </button>
                ) : (
                  <div className="bg-red-50 border border-red-200 rounded-xl p-4 space-y-3">
                    <p className="text-xs font-bold text-red-700">⚠️ アカウント削除の確認</p>
                    <p className="text-xs text-red-600">
                      削除するとプロフィール・成績データが全て失われます。この操作は取り消せません。
                    </p>
                    <p className="text-xs text-red-600 font-medium">
                      確認のため「削除する」と入力してください：
                    </p>
                    <input
                      type="text"
                      value={deleteInput}
                      onChange={e => setDeleteInput(e.target.value)}
                      placeholder="削除する"
                      className="w-full border border-red-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-300"
                    />
                    <div className="flex gap-2">
                      <button
                        onClick={() => { setShowDeleteConfirm(false); setDeleteInput(''); }}
                        className="flex-1 border border-gray-300 text-gray-600 py-2 rounded-lg text-xs font-bold"
                      >
                        キャンセル
                      </button>
                      <button
                        onClick={handleDeleteAccount}
                        disabled={deleteInput !== '削除する' || deleteLoading}
                        className="flex-1 bg-red-600 text-white py-2 rounded-lg text-xs font-bold hover:bg-red-700 disabled:opacity-40 transition"
                      >
                        {deleteLoading ? '削除中...' : '完全に削除する'}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

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
                            <button
                              onClick={() => router.push('/groups')}
                                              className="col-span-2 bg-teal-600 text-white rounded-2xl p-5 text-left hover:bg-teal-700 transition shadow-sm"
                                                            >
                                                              <div className="text-3xl mb-1">&#x1F465;</div>
                                                              <div className="font-bold text-base">&#x30B0;&#x30EB;&#x30FC;&#x30D7;</div>
                                                              <div className="text-xs text-teal-200 mt-0.5">&#x6210;&#x7E3E;&#x3092;&#x5171;&#x6709;&#x3057;&#x3066;&#x4E00;&#x7DD2;&#x306B;&#x5B66;&#x3076;</div>
                                                </button>
          </div>

          {/* アップデート情報 */}
onClick={() => router.push('/updates')}
            className="w-full bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-2xl p-4 text-left hover:bg-emerald-100 transition flex items-center gap-3"
          >
            <span className="text-2xl flex-shrink-0">🆕</span>
            <div className="flex-1 min-w-0">
              <div className="font-bold text-sm">アップデート情報</div>
              <div className="text-xs text-emerald-600 mt-0.5">最新の機能改善・追加情報（過去5日分）</div>
            </div>
            <span className="text-emerald-400 text-sm flex-shrink-0">→</span>
          </button>

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

          {/* 利用規約・ログアウト */}
          <div className="space-y-1 text-center">
            <button
              onClick={() => setShowTerms(!showTerms)}
              className="text-xs text-gray-400 hover:text-gray-600 underline block w-full"
            >
              利用規約を確認する
            </button>
            {showTerms && (
              <div className="mt-2 bg-white rounded-xl shadow-sm p-4 text-left border border-gray-100">
                <pre className="text-xs text-gray-600 whitespace-pre-wrap font-sans leading-relaxed max-h-64 overflow-y-auto">
                  {TERMS_TEXT}
                </pre>
                <button
                  onClick={() => setShowTerms(false)}
                  className="mt-3 w-full text-xs text-gray-400 hover:text-gray-600 border border-gray-200 rounded-lg py-1.5"
                >
                  閉じる
                </button>
              </div>
            )}
            <button onClick={signOut} className="w-full text-gray-400 text-sm py-2 hover:text-gray-600">
              ログアウト
            </button>
          </div>
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

        {/* タブ切替 */}
        <div className="bg-white rounded-2xl shadow-sm p-1 flex">
          {[
            { key: 'login', label: 'ログイン', active: 'bg-blue-600' },
            { key: 'signup', label: '新規登録', active: 'bg-green-600' },
            { key: 'trial', label: 'お試し', active: 'bg-indigo-600' },
          ].map(tab => (
            <button
              key={tab.key}
              onClick={() => setMode(tab.key)}
              className={`flex-1 py-2.5 rounded-xl text-xs font-bold transition ${
                mode === tab.key ? `${tab.active} text-white` : 'text-gray-400 hover:text-gray-600'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* ログイン */}
        {mode === 'login' && (
          <div className="bg-white rounded-2xl shadow-sm p-6 space-y-4">
            <h2 className="font-bold text-gray-700">アカウントでログイン</h2>
            <form onSubmit={handleLogin} className="space-y-3">
              <input
                type="email" value={email} onChange={e => setEmail(e.target.value)}
                placeholder="メールアドレス" required
                className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
              />
              <div className="relative">
                <input
                  type={showLoginPw ? 'text' : 'password'} value={password}
                  onChange={e => setPassword(e.target.value)} placeholder="パスワード" required
                  className="w-full border border-gray-200 rounded-xl px-4 py-3 pr-12 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
                />
                <button type="button" onClick={() => setShowLoginPw(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 text-xs px-1" tabIndex={-1}>
                  {showLoginPw ? '隠す' : '表示'}
                </button>
              </div>
              {loginError && <p className="text-red-500 text-xs">{loginError}</p>}
              <button type="submit" disabled={loginLoading}
                className="w-full bg-blue-600 text-white py-3 rounded-xl font-bold text-sm hover:bg-blue-700 disabled:opacity-50 transition">
                {loginLoading ? 'ログイン中...' : 'ログイン'}
              </button>
            </form>
            <p className="text-center text-xs text-gray-400">
              アカウントをお持ちでない方は
              <button onClick={() => setMode('signup')} className="text-green-600 font-bold ml-1">新規登録</button>
            </p>
          </div>
        )}

        {/* 新規登録 */}
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
                <button onClick={() => { setSignupDone(false); setMode('login'); }}
                  className="w-full bg-blue-600 text-white py-3 rounded-xl font-bold text-sm hover:bg-blue-700 transition">
                  ログイン画面へ
                </button>
              </div>
            ) : (
              <form onSubmit={handleSignup} className="space-y-3">
                <input type="email" value={signupEmail} onChange={e => setSignupEmail(e.target.value)}
                  placeholder="メールアドレス" required
                  className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-green-300" />
                <div className="relative">
                  <input type={showSignupPw ? 'text' : 'password'} value={signupPassword}
                    onChange={e => setSignupPassword(e.target.value)} placeholder="パスワード（8文字以上）" required
                    className="w-full border border-gray-200 rounded-xl px-4 py-3 pr-12 text-sm focus:outline-none focus:ring-2 focus:ring-green-300" />
                  <button type="button" onClick={() => setShowSignupPw(v => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 text-xs px-1" tabIndex={-1}>
                    {showSignupPw ? '隠す' : '表示'}
                  </button>
                </div>
                <div className="relative">
                  <input type={showSignupPwConfirm ? 'text' : 'password'} value={signupPasswordConfirm}
                    onChange={e => setSignupPasswordConfirm(e.target.value)} placeholder="パスワード（確認）" required
                    className="w-full border border-gray-200 rounded-xl px-4 py-3 pr-12 text-sm focus:outline-none focus:ring-2 focus:ring-green-300" />
                  <button type="button" onClick={() => setShowSignupPwConfirm(v => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 text-xs px-1" tabIndex={-1}>
                    {showSignupPwConfirm ? '隠す' : '表示'}
                  </button>
                </div>
                {signupError && <p className="text-red-500 text-xs">{signupError}</p>}
                <button type="submit" disabled={signupLoading}
                  className="w-full bg-green-600 text-white py-3 rounded-xl font-bold text-sm hover:bg-green-700 disabled:opacity-50 transition">
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

        {/* お試しモード */}
        {mode === 'trial' && (
          <div className="bg-white rounded-2xl shadow-sm p-6 space-y-4">
            <h2 className="font-bold text-gray-700">お試しモード</h2>
            <p className="text-xs text-gray-500">
              共通パスワードで症例を体験できます。成績は保存されません。<br />
              パスワードは管理者にお問い合わせください。
            </p>
            <div className="relative">
              <input
                type={showTrialPw ? 'text' : 'password'} value={trialPassword}
                onChange={e => { setTrialPassword(e.target.value); setTrialError(''); }}
                placeholder="共通パスワード"
                className="w-full border border-gray-200 rounded-xl px-4 py-3 pr-12 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
                onKeyDown={e => e.key === 'Enter' && handleTrial()} />
              <button type="button" onClick={() => setShowTrialPw(v => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 text-xs px-1" tabIndex={-1}>
                {showTrialPw ? '隠す' : '表示'}
              </button>
            </div>
            {trialError && <p className="text-red-500 text-xs">{trialError}</p>}
            <button onClick={handleTrial} disabled={!trialPassword}
              className="w-full bg-indigo-600 text-white py-3 rounded-xl font-bold text-sm hover:bg-indigo-700 disabled:opacity-50 transition">
              体験する
            </button>
          </div>
        )}

        {/* お知らせ */}
        {announcements.length > 0 && (
          <div className="space-y-2">
            {announcements.map(a => (
              <div key={a.id} className={`rounded-xl p-4 ${a.important ? 'bg-red-50 border border-red-100' : 'bg-white border border-gray-100 shadow-sm'}`}>
                <p className={`text-sm font-bold ${a.important ? 'text-red-600' : 'text-gray-700'}`}>
                  {a.important ? '🔴 ' : '📢 '}{a.title}
                </p>
                {a.body && <p className={`text-xs mt-1 ${a.important ? 'text-red-700' : 'text-gray-500'}`}>{a.body}</p>}
              </div>
            ))}
          </div>
        )}

        {/* アップデート情報（最新3件） */}
        {appUpdates.length > 0 && (
          <div className="bg-white border border-gray-100 shadow-sm rounded-xl p-4 space-y-2">
            <p className="text-xs font-bold text-gray-500">🆕 最新のアップデート</p>
            {appUpdates.map(u => (
              <div key={u.id} className="flex items-start gap-2">
                <span className={`text-xs px-1.5 py-0.5 rounded font-bold flex-shrink-0 ${
                  u.category === '機能追加' ? 'bg-blue-100 text-blue-600' :
                  u.category === '改善' ? 'bg-green-100 text-green-600' :
                  u.category === '修正' ? 'bg-orange-100 text-orange-600' :
                  'bg-purple-100 text-purple-600'
                }`}>{u.category}</span>
                <p className="text-xs text-gray-600">{u.title}</p>
              </div>
            ))}
          </div>
        )}

      </div>
    </div>
  );
}
