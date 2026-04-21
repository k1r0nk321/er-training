'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../lib/auth-context';
import { supabase } from '../lib/supabase';

const ADMIN_EMAIL = 'nakamae@mub.biglobe.ne.jp';

const DIFFICULTY_OPTIONS = [
  { value: 'easy',   label: '易しい', desc: '医師国家試験合格レベル',  color: 'bg-green-100 text-green-700' },
  { value: 'medium', label: '普通',   desc: '研修医2年目修了レベル',   color: 'bg-yellow-100 text-yellow-700' },
  { value: 'hard',   label: '難しい', desc: '専門医レベル',            color: 'bg-red-100 text-red-700' },
];

const CASE_FIELDS = [
  { key: 'title',            label: 'タイトル',        type: 'input',    required: true },
  { key: 'chief_complaint',  label: '主訴',            type: 'input',    required: false },
  { key: 'history',          label: '現病歴',          type: 'textarea', required: false },
  { key: 'vital_signs',      label: 'バイタルサイン',  type: 'textarea', required: false },
  { key: 'physical_exam',    label: '身体所見',        type: 'textarea', required: false },
  { key: 'initial_labs',     label: '初期検査所見',    type: 'textarea', required: false },
  { key: 'answer_diagnosis', label: '正解診断名',      type: 'input',    required: true },
  { key: 'scoring_criteria', label: '採点基準・補足',  type: 'textarea', required: false },
  { key: 'category',         label: 'カテゴリ',        type: 'input',    required: false },
];

export default function AdminPage() {
  const { user, userProfile, loading } = useAuth();
  const router = useRouter();

  const [stats, setStats] = useState(null);
  const [users, setUsers] = useState([]);
  const [cases, setCases] = useState([]);
  const [results, setResults] = useState([]);
  const [announcements, setAnnouncements] = useState([]);
  const [loadingData, setLoadingData] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');

  // お知らせ
  const [newAnnouncement, setNewAnnouncement] = useState({ title: '', body: '', important: false });
  const [postingAnnounce, setPostingAnnounce] = useState(false);

  // 症例追加
  const [showCaseForm, setShowCaseForm] = useState(false);
  const [newCase, setNewCase] = useState({
    title: '', chief_complaint: '', history: '', vital_signs: '',
    physical_exam: '', initial_labs: '', answer_diagnosis: '',
    scoring_criteria: '', difficulty: 'medium', category: '',
  });
  const [savingCase, setSavingCase] = useState(false);

  // 症例編集
  const [editingCase, setEditingCase] = useState(null);   // 編集中のcaseオブジェクト
  const [editCaseData, setEditCaseData] = useState({});   // 編集フォームの値
  const [savingEdit, setSavingEdit] = useState(false);
  const [editMessage, setEditMessage] = useState('');
  const [caseSearchText, setCaseSearchText] = useState('');

  // 難易度変更
  const [updatingDifficulty, setUpdatingDifficulty] = useState({});
  const [diffMessage, setDiffMessage] = useState('');

  // 設定
  const [currentTrialPw, setCurrentTrialPw] = useState('');
  const [newTrialPw, setNewTrialPw] = useState('');
  const [pwLoading, setPwLoading] = useState(false);
  const [pwMessage, setPwMessage] = useState('');

  useEffect(() => {
    if (!loading) {
      if (!user) { router.push('/'); return; }
      if (user.email !== ADMIN_EMAIL) { router.push('/'); return; }
      fetchAll();
    }
  }, [user, userProfile, loading]);

  const fetchAll = async () => {
    setLoadingData(true);
    const [
      { data: usersData },
      { data: casesData },
      { data: resultsData },
      { data: announceData },
      { data: pwData },
    ] = await Promise.all([
      supabase.from('users').select('*').order('created_at', { ascending: false }),
      supabase.from('cases').select('*').order('created_at', { ascending: false }),
      supabase.from('results').select('*').order('created_at', { ascending: false }),
      supabase.from('announcements').select('*').order('created_at', { ascending: false }),
      supabase.from('app_settings').select('value').eq('key', 'trial_password').single(),
    ]);
    setUsers(usersData || []);
    setCases(casesData || []);
    setResults(resultsData || []);
    setAnnouncements(announceData || []);
    if (pwData) setCurrentTrialPw(pwData.value || '');
    computeStats(usersData || [], casesData || [], resultsData || []);
    setLoadingData(false);
  };

  const computeStats = (usersData, casesData, resultsData) => {
    const totalUsers = usersData.length;
    const totalCases = casesData.length;
    const totalAttempts = resultsData.length;
    const passedCount = resultsData.filter(r => r.passed).length;
    const avgScore = totalAttempts > 0 ? Math.round(resultsData.reduce((s, r) => s + r.score, 0) / totalAttempts) : 0;
    const roleStats = {};
    usersData.forEach(u => {
      const role = u.role || 'その他';
      if (!roleStats[role]) roleStats[role] = { count: 0, attempts: 0, passed: 0, totalScore: 0 };
      roleStats[role].count++;
    });
    resultsData.forEach(r => {
      const u = usersData.find(u => u.id === r.user_id);
      if (!u) return;
      const role = u.role || 'その他';
      if (!roleStats[role]) return;
      roleStats[role].attempts++;
      if (r.passed) roleStats[role].passed++;
      roleStats[role].totalScore += r.score;
    });
    const monthlyData = {};
    const now = new Date();
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      monthlyData[`${d.getFullYear()}/${d.getMonth() + 1}`] = 0;
    }
    resultsData.forEach(r => {
      const d = new Date(r.created_at);
      const key = `${d.getFullYear()}/${d.getMonth() + 1}`;
      if (monthlyData[key] !== undefined) monthlyData[key]++;
    });
    setStats({ totalUsers, totalCases, totalAttempts, passedCount, avgScore,
      passRate: totalAttempts > 0 ? Math.round((passedCount / totalAttempts) * 100) : 0,
      roleStats, monthlyData });
  };

  // ===== 難易度変更 =====
  const handleDifficultyChange = async (caseId, newDiff) => {
    setUpdatingDifficulty(prev => ({ ...prev, [caseId]: true }));
    const { error } = await supabase.from('cases').update({ difficulty: newDiff }).eq('id', caseId);
    if (!error) {
      setCases(prev => prev.map(c => c.id === caseId ? { ...c, difficulty: newDiff } : c));
      setDiffMessage('✅ 難易度を更新しました');
      setTimeout(() => setDiffMessage(''), 2000);
    }
    setUpdatingDifficulty(prev => ({ ...prev, [caseId]: false }));
  };

  // ===== 症例編集を開く =====
  const startEditCase = (c) => {
    setEditingCase(c);
    setEditCaseData({ ...c });
    setEditMessage('');
    // 症例一覧の上部へスクロール
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const cancelEditCase = () => {
    setEditingCase(null);
    setEditCaseData({});
    setEditMessage('');
  };

  // ===== 症例編集を保存 =====
  const saveEditCase = async () => {
    if (!editCaseData.title?.trim()) { setEditMessage('❌ タイトルは必須です'); return; }
    if (!editCaseData.answer_diagnosis?.trim()) { setEditMessage('❌ 正解診断名は必須です'); return; }
    setSavingEdit(true);
    setEditMessage('');
    const { error } = await supabase
      .from('cases')
      .update({
        title:            editCaseData.title?.trim(),
        chief_complaint:  editCaseData.chief_complaint?.trim() || null,
        history:          editCaseData.history?.trim() || null,
        vital_signs:      editCaseData.vital_signs?.trim() || null,
        physical_exam:    editCaseData.physical_exam?.trim() || null,
        initial_labs:     editCaseData.initial_labs?.trim() || null,
        answer_diagnosis: editCaseData.answer_diagnosis?.trim(),
        scoring_criteria: editCaseData.scoring_criteria?.trim() || null,
        difficulty:       editCaseData.difficulty || 'medium',
        category:         editCaseData.category?.trim() || null,
      })
      .eq('id', editingCase.id);

    if (error) {
      setEditMessage('❌ 保存に失敗しました: ' + error.message);
    } else {
      // ローカルのcases stateも更新
      setCases(prev => prev.map(c => c.id === editingCase.id ? { ...c, ...editCaseData } : c));
      setEditMessage('✅ 保存しました！');
      setTimeout(() => {
        setEditingCase(null);
        setEditCaseData({});
        setEditMessage('');
      }, 1200);
    }
    setSavingEdit(false);
  };

  // ===== お知らせ =====
  const postAnnouncement = async () => {
    if (!newAnnouncement.title.trim()) { alert('タイトルを入力してください'); return; }
    setPostingAnnounce(true);
    const { error } = await supabase.from('announcements').insert({
      title: newAnnouncement.title, body: newAnnouncement.body,
      important: newAnnouncement.important, created_by: user.id,
      created_at: new Date().toISOString(),
    });
    if (error) { alert('投稿に失敗しました'); }
    else { setNewAnnouncement({ title: '', body: '', important: false }); fetchAll(); alert('お知らせを投稿しました'); }
    setPostingAnnounce(false);
  };

  const deleteAnnouncement = async (id) => {
    if (!confirm('このお知らせを削除しますか？')) return;
    await supabase.from('announcements').delete().eq('id', id);
    fetchAll();
  };

  // ===== 症例追加 =====
  const saveCase = async () => {
    if (!newCase.title.trim()) { alert('症例タイトルを入力してください'); return; }
    setSavingCase(true);
    const { error } = await supabase.from('cases').insert({
      ...newCase, created_by: user.id, created_at: new Date().toISOString(),
    });
    if (error) { alert('症例の保存に失敗しました'); }
    else {
      setNewCase({ title: '', chief_complaint: '', history: '', vital_signs: '',
        physical_exam: '', initial_labs: '', answer_diagnosis: '',
        scoring_criteria: '', difficulty: 'medium', category: '' });
      setShowCaseForm(false); fetchAll(); alert('症例を追加しました');
    }
    setSavingCase(false);
  };

  // ===== 症例削除 =====
  const deleteCase = async (id) => {
    if (!confirm('この症例を削除しますか？関連する成績も削除されます。')) return;
    await supabase.from('results').delete().eq('case_id', id);
    await supabase.from('cases').delete().eq('id', id);
    fetchAll();
  };

  // ===== パスワード更新 =====
  const updateTrialPassword = async () => {
    if (!newTrialPw.trim()) { alert('新しいパスワードを入力してください'); return; }
    setPwLoading(true); setPwMessage('');
    const { error } = await supabase.from('app_settings')
      .update({ value: newTrialPw.trim(), updated_at: new Date().toISOString() })
      .eq('key', 'trial_password');
    if (error) { setPwMessage('❌ 更新に失敗しました'); }
    else { setCurrentTrialPw(newTrialPw.trim()); setNewTrialPw(''); setPwMessage('✅ パスワードを更新しました'); }
    setPwLoading(false);
  };

  const getDiffColor = (d) => DIFFICULTY_OPTIONS.find(o => o.value === d)?.color || 'bg-gray-100 text-gray-600';
  const getDiffLabel = (d) => DIFFICULTY_OPTIONS.find(o => o.value === d)?.label || d;

  // 症例フィルター
  const filteredCases = cases.filter(c =>
    !caseSearchText ||
    c.title?.includes(caseSearchText) ||
    c.answer_diagnosis?.includes(caseSearchText) ||
    c.category?.includes(caseSearchText)
  );

  if (loading || loadingData) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
      </div>
    );
  }

  if (user && user.email !== ADMIN_EMAIL) {
    return <div className="min-h-screen flex items-center justify-center"><p className="text-gray-500">管理者権限が必要です</p></div>;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* ヘッダー */}
      <header className="bg-gray-800 text-white sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
          <button onClick={() => router.push('/')} className="text-gray-300 text-sm">← トップ</button>
          <h1 className="text-lg font-bold">🔧 管理者ダッシュボード</h1>
          <div className="text-xs text-gray-400">{userProfile?.name}</div>
        </div>
        <div className="max-w-5xl mx-auto px-4 flex gap-1 pb-1 overflow-x-auto">
          {[
            { key: 'overview', label: '📊 概要' },
            { key: 'users',    label: '👥 利用者' },
            { key: 'cases',    label: '📋 症例' },
            { key: 'announce', label: '📢 お知らせ' },
            { key: 'settings', label: '⚙️ 設定' },
          ].map(t => (
            <button key={t.key} onClick={() => { setActiveTab(t.key); setEditingCase(null); }}
              className={`text-xs px-3 py-1.5 rounded-t font-bold transition flex-shrink-0 ${activeTab === t.key ? 'bg-white text-gray-800' : 'text-gray-400 hover:text-white'}`}>
              {t.label}
            </button>
          ))}
        </div>
      </header>

      <div className="max-w-5xl mx-auto px-4 py-6">

        {/* ==== 概要タブ ==== */}
        {activeTab === 'overview' && stats && (
          <div className="space-y-5">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {[
                { label: '登録ユーザー', value: stats.totalUsers, icon: '👥', color: 'text-blue-600' },
                { label: '症例数', value: stats.totalCases, icon: '📋', color: 'text-indigo-600' },
                { label: '延べ挑戦回数', value: stats.totalAttempts, icon: '🎯', color: 'text-orange-600' },
                { label: '平均スコア', value: `${stats.avgScore}点`, icon: '📈', color: 'text-green-600' },
              ].map((kpi, i) => (
                <div key={i} className="bg-white rounded-xl shadow-sm p-4 text-center">
                  <div className="text-2xl mb-1">{kpi.icon}</div>
                  <div className={`text-2xl font-black ${kpi.color}`}>{kpi.value}</div>
                  <div className="text-xs text-gray-500">{kpi.label}</div>
                </div>
              ))}
            </div>
            <div className="bg-white rounded-xl shadow-sm p-5">
              <h3 className="font-bold text-gray-700 mb-3">全体合格率</h3>
              <div className="flex items-center gap-4">
                <div className="text-4xl font-black text-green-600">{stats.passRate}%</div>
                <div className="flex-1">
                  <div className="bg-gray-100 rounded-full h-4">
                    <div className="bg-green-500 h-4 rounded-full" style={{ width: `${stats.passRate}%` }}></div>
                  </div>
                  <div className="flex justify-between text-xs text-gray-400 mt-1">
                    <span>合格：{stats.passedCount}回</span>
                    <span>不合格：{stats.totalAttempts - stats.passedCount}回</span>
                  </div>
                </div>
              </div>
            </div>
            <div className="bg-white rounded-xl shadow-sm p-5">
              <h3 className="font-bold text-gray-700 mb-3">身分別パフォーマンス</h3>
              <table className="w-full text-sm">
                <thead><tr className="border-b">
                  <th className="text-left py-2 text-gray-500 font-medium">身分</th>
                  <th className="text-right py-2 text-gray-500 font-medium">人数</th>
                  <th className="text-right py-2 text-gray-500 font-medium">挑戦数</th>
                  <th className="text-right py-2 text-gray-500 font-medium">平均点</th>
                  <th className="text-right py-2 text-gray-500 font-medium">合格率</th>
                </tr></thead>
                <tbody>
                  {Object.entries(stats.roleStats).map(([role, data]) => (
                    <tr key={role} className="border-b last:border-0">
                      <td className="py-2 font-medium text-gray-700">{role}</td>
                      <td className="py-2 text-right text-gray-600">{data.count}人</td>
                      <td className="py-2 text-right text-gray-600">{data.attempts}回</td>
                      <td className="py-2 text-right font-bold text-gray-700">
                        {data.attempts > 0 ? Math.round(data.totalScore / data.attempts) : '—'}点
                      </td>
                      <td className="py-2 text-right">
                        <span className={`font-bold ${data.attempts > 0 && (data.passed / data.attempts) >= 0.8 ? 'text-green-600' : 'text-orange-500'}`}>
                          {data.attempts > 0 ? Math.round((data.passed / data.attempts) * 100) : '—'}%
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="bg-white rounded-xl shadow-sm p-5">
              <h3 className="font-bold text-gray-700 mb-4">月別挑戦回数（直近6ヶ月）</h3>
              <div className="flex items-end gap-3 h-32">
                {Object.entries(stats.monthlyData).map(([month, count]) => {
                  const maxVal = Math.max(...Object.values(stats.monthlyData), 1);
                  return (
                    <div key={month} className="flex-1 flex flex-col items-center justify-end gap-1">
                      <span className="text-xs font-bold text-blue-600">{count}</span>
                      <div className="w-full bg-blue-500 rounded-t" style={{ height: `${Math.max((count / maxVal) * 100, 4)}%` }}></div>
                      <span className="text-xs text-gray-400">{month.split('/')[1]}月</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* ==== 利用者タブ ==== */}
        {activeTab === 'users' && (
          <div className="space-y-4">
            <h2 className="font-bold text-gray-700">登録ユーザー一覧（{users.length}人）</h2>
            <div className="bg-white rounded-xl shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="text-left px-4 py-3 text-gray-500 font-medium">名前</th>
                      <th className="text-left px-4 py-3 text-gray-500 font-medium">身分</th>
                      <th className="text-right px-4 py-3 text-gray-500 font-medium">挑戦数</th>
                      <th className="text-right px-4 py-3 text-gray-500 font-medium">合格率</th>
                      <th className="text-right px-4 py-3 text-gray-500 font-medium">平均点</th>
                    </tr>
                  </thead>
                  <tbody>
                    {users.map(u => {
                      const ur = results.filter(r => r.user_id === u.id);
                      const avg = ur.length > 0 ? Math.round(ur.reduce((s, r) => s + r.score, 0) / ur.length) : null;
                      const pr = ur.length > 0 ? Math.round((ur.filter(r => r.passed).length / ur.length) * 100) : null;
                      return (
                        <tr key={u.id} className="border-t hover:bg-gray-50">
                          <td className="px-4 py-3">
                            <div className="font-medium text-gray-800">{u.name}</div>
                            <div className="text-xs text-gray-400">{u.email}</div>
                          </td>
                          <td className="px-4 py-3 text-gray-600">{u.role}</td>
                          <td className="px-4 py-3 text-right text-gray-600">{ur.length}</td>
                          <td className="px-4 py-3 text-right font-bold">
                            {pr !== null ? <span className={pr >= 80 ? 'text-green-600' : 'text-orange-500'}>{pr}%</span> : <span className="text-gray-300">—</span>}
                          </td>
                          <td className="px-4 py-3 text-right font-bold text-gray-700">
                            {avg !== null ? `${avg}点` : <span className="text-gray-300">—</span>}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ==== 症例タブ ==== */}
        {activeTab === 'cases' && (
          <div className="space-y-4">

            {/* ===== 症例編集フォーム（編集中のみ表示） ===== */}
            {editingCase && (
              <div className="bg-white rounded-xl shadow-lg p-5 space-y-4 border-2 border-blue-400">
                <div className="flex items-center justify-between">
                  <h3 className="font-bold text-blue-700 text-base">✏️ 症例を編集</h3>
                  <button onClick={cancelEditCase}
                    className="text-xs text-gray-400 hover:text-gray-600 px-2 py-1 rounded border border-gray-200">
                    ✕ キャンセル
                  </button>
                </div>

                <div className="bg-blue-50 rounded-lg px-3 py-2">
                  <p className="text-xs text-blue-600 font-bold">編集中：{editingCase.title}</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {CASE_FIELDS.map(field => (
                    <div key={field.key} className={field.type === 'textarea' ? 'md:col-span-2' : ''}>
                      <label className="text-xs font-bold text-gray-600 mb-1 block">
                        {field.label}{field.required && <span className="text-red-500 ml-0.5">*</span>}
                      </label>
                      {field.type === 'input' ? (
                        <input
                          value={editCaseData[field.key] || ''}
                          onChange={e => setEditCaseData(prev => ({ ...prev, [field.key]: e.target.value }))}
                          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
                        />
                      ) : (
                        <textarea
                          value={editCaseData[field.key] || ''}
                          onChange={e => setEditCaseData(prev => ({ ...prev, [field.key]: e.target.value }))}
                          rows={field.key === 'history' || field.key === 'scoring_criteria' ? 4 : 3}
                          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300 resize-y"
                        />
                      )}
                    </div>
                  ))}

                  {/* 難易度 */}
                  <div>
                    <label className="text-xs font-bold text-gray-600 mb-1 block">難易度</label>
                    <div className="grid grid-cols-3 gap-2">
                      {DIFFICULTY_OPTIONS.map(opt => (
                        <button key={opt.value} type="button"
                          onClick={() => setEditCaseData(prev => ({ ...prev, difficulty: opt.value }))}
                          className={`py-2 rounded-lg border text-xs font-bold transition ${
                            editCaseData.difficulty === opt.value
                              ? opt.color + ' border-current'
                              : 'bg-white text-gray-500 border-gray-200 hover:border-gray-400'
                          }`}>
                          {opt.label}<br />
                          <span className="text-xs font-normal opacity-70">{opt.desc}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {editMessage && (
                  <div className={`rounded-xl px-4 py-2 text-sm font-bold ${editMessage.startsWith('✅') ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-600'}`}>
                    {editMessage}
                  </div>
                )}

                <div className="flex gap-3">
                  <button onClick={cancelEditCase}
                    className="flex-1 border border-gray-300 text-gray-600 py-2.5 rounded-xl text-sm font-bold hover:bg-gray-50">
                    キャンセル
                  </button>
                  <button onClick={saveEditCase} disabled={savingEdit}
                    className="flex-1 bg-blue-600 text-white py-2.5 rounded-xl text-sm font-bold hover:bg-blue-700 disabled:opacity-50 transition">
                    {savingEdit ? '保存中...' : '💾 変更を保存する'}
                  </button>
                </div>
              </div>
            )}

            {/* 症例一覧ヘッダー */}
            <div className="flex justify-between items-center">
              <h2 className="font-bold text-gray-700">症例管理（{cases.length}件）</h2>
              <button onClick={() => { setShowCaseForm(!showCaseForm); setEditingCase(null); }}
                className="bg-blue-600 text-white px-4 py-2 rounded-xl text-sm font-bold hover:bg-blue-700">
                ＋ 症例追加
              </button>
            </div>

            {/* 難易度定義 */}
            <div className="bg-blue-50 border border-blue-100 rounded-xl p-4">
              <p className="text-xs font-bold text-blue-700 mb-2">📊 難易度の定義</p>
              <div className="grid grid-cols-3 gap-2">
                {DIFFICULTY_OPTIONS.map(opt => (
                  <div key={opt.value} className={`rounded-lg px-3 py-2 ${opt.color}`}>
                    <p className="text-xs font-bold">{opt.label}</p>
                    <p className="text-xs opacity-80">{opt.desc}</p>
                  </div>
                ))}
              </div>
            </div>

            {diffMessage && (
              <div className={`rounded-xl px-4 py-2 text-sm font-bold ${diffMessage.startsWith('✅') ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-600'}`}>
                {diffMessage}
              </div>
            )}

            {/* 症例追加フォーム */}
            {showCaseForm && (
              <div className="bg-white rounded-xl shadow-sm p-5 space-y-4 border-2 border-green-200">
                <h3 className="font-bold text-green-700">新規症例追加</h3>
                {CASE_FIELDS.map(field => (
                  <div key={field.key}>
                    <label className="text-xs font-bold text-gray-600 mb-1 block">
                      {field.label}{field.required && ' *'}
                    </label>
                    {field.type === 'input' ? (
                      <input value={newCase[field.key]}
                        onChange={e => setNewCase({ ...newCase, [field.key]: e.target.value })}
                        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-300" />
                    ) : (
                      <textarea value={newCase[field.key]}
                        onChange={e => setNewCase({ ...newCase, [field.key]: e.target.value })}
                        rows={3}
                        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-300 resize-none" />
                    )}
                  </div>
                ))}
                <div>
                  <label className="text-xs font-bold text-gray-600 mb-1 block">難易度</label>
                  <select value={newCase.difficulty} onChange={e => setNewCase({ ...newCase, difficulty: e.target.value })}
                    className="border border-gray-200 rounded-lg px-3 py-2 text-sm">
                    {DIFFICULTY_OPTIONS.map(opt => (
                      <option key={opt.value} value={opt.value}>{opt.label}（{opt.desc}）</option>
                    ))}
                  </select>
                </div>
                <div className="flex gap-3">
                  <button onClick={() => setShowCaseForm(false)} className="flex-1 border border-gray-300 text-gray-600 py-2 rounded-xl text-sm font-bold">キャンセル</button>
                  <button onClick={saveCase} disabled={savingCase} className="flex-1 bg-green-600 text-white py-2 rounded-xl text-sm font-bold hover:bg-green-700 disabled:opacity-50">
                    {savingCase ? '保存中...' : '✓ 保存する'}
                  </button>
                </div>
              </div>
            )}

            {/* 症例検索 */}
            <input
              type="text"
              value={caseSearchText}
              onChange={e => setCaseSearchText(e.target.value)}
              placeholder="症例名・診断名・カテゴリで絞り込み..."
              className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
            />
            <p className="text-xs text-gray-400">{filteredCases.length}件表示</p>

            {/* 症例リスト */}
            <div className="space-y-2">
              {filteredCases.map(c => {
                const caseResults = results.filter(r => r.case_id === c.id);
                const isEditing = editingCase?.id === c.id;
                return (
                  <div key={c.id} className={`bg-white rounded-xl shadow-sm p-4 transition ${isEditing ? 'border-2 border-blue-400' : ''}`}>
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <h3 className="font-bold text-gray-800 text-sm">{c.title}</h3>
                        <p className="text-xs text-gray-500 mt-0.5">正解：{c.answer_diagnosis}</p>
                        <div className="flex gap-2 mt-1 flex-wrap">
                          {c.category && <span className="text-xs text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded">{c.category}</span>}
                          <span className="text-xs text-gray-400">挑戦：{caseResults.length}回</span>
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
                        {/* 難易度ドロップダウン */}
                        <select
                          value={c.difficulty}
                          onChange={e => handleDifficultyChange(c.id, e.target.value)}
                          disabled={updatingDifficulty[c.id]}
                          className={`text-xs px-2 py-1 rounded-lg border font-bold cursor-pointer focus:outline-none ${getDiffColor(c.difficulty)} ${updatingDifficulty[c.id] ? 'opacity-50' : ''}`}
                        >
                          {DIFFICULTY_OPTIONS.map(opt => (
                            <option key={opt.value} value={opt.value}>{opt.label}</option>
                          ))}
                        </select>
                        <div className="flex gap-1.5">
                          {/* 編集ボタン */}
                          <button
                            onClick={() => isEditing ? cancelEditCase() : startEditCase(c)}
                            className={`text-xs px-2.5 py-1 rounded-lg font-bold transition ${
                              isEditing
                                ? 'bg-gray-100 text-gray-500'
                                : 'bg-blue-100 text-blue-700 hover:bg-blue-200'
                            }`}
                          >
                            {isEditing ? '編集中' : '✏️ 編集'}
                          </button>
                          {/* 削除ボタン */}
                          <button onClick={() => deleteCase(c.id)}
                            className="text-xs px-2 py-1 rounded-lg bg-red-50 text-red-400 hover:bg-red-100 hover:text-red-600 font-bold transition">
                            削除
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ==== お知らせタブ ==== */}
        {activeTab === 'announce' && (
          <div className="space-y-4">
            <h2 className="font-bold text-gray-700">お知らせ管理</h2>
            <div className="bg-white rounded-xl shadow-sm p-5 space-y-3 border-2 border-orange-100">
              <h3 className="font-bold text-orange-600">＋ 新規お知らせ</h3>
              <input value={newAnnouncement.title}
                onChange={e => setNewAnnouncement({ ...newAnnouncement, title: e.target.value })}
                placeholder="タイトル *"
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-300" />
              <textarea value={newAnnouncement.body}
                onChange={e => setNewAnnouncement({ ...newAnnouncement, body: e.target.value })}
                placeholder="本文（任意）" rows={3}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-300 resize-none" />
              <label className="flex items-center gap-2 text-sm text-gray-700">
                <input type="checkbox" checked={newAnnouncement.important}
                  onChange={e => setNewAnnouncement({ ...newAnnouncement, important: e.target.checked })} className="w-4 h-4" />
                重要（赤字表示）
              </label>
              <button onClick={postAnnouncement} disabled={postingAnnounce || !newAnnouncement.title.trim()}
                className="w-full bg-orange-500 text-white py-2 rounded-xl text-sm font-bold hover:bg-orange-600 disabled:opacity-50">
                {postingAnnounce ? '投稿中...' : '📢 投稿する'}
              </button>
            </div>
            <div className="space-y-3">
              {announcements.map(a => (
                <div key={a.id} className={`bg-white rounded-xl shadow-sm p-4 ${a.important ? 'border-l-4 border-red-500' : ''}`}>
                  <div className="flex justify-between items-start gap-3">
                    <div>
                      <p className={`font-bold text-sm ${a.important ? 'text-red-600' : 'text-gray-800'}`}>{a.important && '🔴 '}{a.title}</p>
                      {a.body && <p className="text-xs text-gray-600 mt-1">{a.body}</p>}
                      <p className="text-xs text-gray-400 mt-1">{new Date(a.created_at).toLocaleDateString('ja-JP')}</p>
                    </div>
                    <button onClick={() => deleteAnnouncement(a.id)} className="text-red-400 hover:text-red-600 text-xs flex-shrink-0">削除</button>
                  </div>
                </div>
              ))}
              {announcements.length === 0 && <p className="text-center text-gray-400 py-8">お知らせはありません</p>}
            </div>
          </div>
        )}

        {/* ==== 設定タブ ==== */}
        {activeTab === 'settings' && (
          <div className="space-y-4 max-w-lg">
            <h2 className="font-bold text-gray-700">アプリ設定</h2>
            <div className="bg-white rounded-xl shadow-sm p-5 space-y-4">
              <h3 className="font-bold text-gray-700">🔑 お試しモードのパスワード</h3>
              <div className="bg-gray-50 rounded-lg p-3">
                <p className="text-xs text-gray-500 mb-1">現在のパスワード</p>
                <p className="text-lg font-bold font-mono text-gray-800 tracking-widest">{currentTrialPw || '（未設定）'}</p>
              </div>
              <div>
                <label className="text-xs font-bold text-gray-600 mb-1 block">新しいパスワードに変更</label>
                <div className="flex gap-2">
                  <input type="text" value={newTrialPw}
                    onChange={e => { setNewTrialPw(e.target.value); setPwMessage(''); }}
                    placeholder="新しいパスワードを入力"
                    className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300 font-mono"
                    maxLength={20} />
                  <button onClick={updateTrialPassword} disabled={pwLoading || !newTrialPw.trim()}
                    className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-bold hover:bg-blue-700 disabled:opacity-50 flex-shrink-0">
                    {pwLoading ? '更新中...' : '更新'}
                  </button>
                </div>
                {pwMessage && <p className={`text-xs mt-2 ${pwMessage.startsWith('✅') ? 'text-green-600' : 'text-red-500'}`}>{pwMessage}</p>}
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
