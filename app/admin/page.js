'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../lib/auth-context';
import { supabase } from '../lib/supabase';

export default function AdminPage() {
  const { user, userProfile, loading } = useAuth();
  const router = useRouter();

  const [stats, setStats] = useState(null);
  const [users, setUsers] = useState([]);
  const [cases, setCases] = useState([]);
  const [results, setResults] = useState([]);
  const [announcements, setAnnouncements] = useState([]);
  const [loadingData, setLoadingData] = useState(true);

  // 管理者操作
  const [activeTab, setActiveTab] = useState('overview'); // overview | users | cases | announce
  const [newAnnouncement, setNewAnnouncement] = useState({ title: '', body: '', important: false });
  const [postingAnnounce, setPostingAnnounce] = useState(false);

  // 新規症例追加
  const [showCaseForm, setShowCaseForm] = useState(false);
  const [newCase, setNewCase] = useState({
    title: '', chief_complaint: '', history: '',
    vital_signs: '', physical_exam: '', initial_labs: '',
    answer_diagnosis: '', scoring_criteria: '',
    difficulty: 'medium', category: '',
  });
  const [savingCase, setSavingCase] = useState(false);

  useEffect(() => {
    if (!loading) {
      if (!user) { router.push('/'); return; }
      if (userProfile && !userProfile.is_admin) {
        router.push('/');
        return;
      }
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
    ] = await Promise.all([
      supabase.from('users').select('*').order('created_at', { ascending: false }),
      supabase.from('cases').select('*').order('created_at', { ascending: false }),
      supabase.from('results').select('*').order('created_at', { ascending: false }),
      supabase.from('announcements').select('*').order('created_at', { ascending: false }),
    ]);

    setUsers(usersData || []);
    setCases(casesData || []);
    setResults(resultsData || []);
    setAnnouncements(announceData || []);
    computeStats(usersData || [], casesData || [], resultsData || []);
    setLoadingData(false);
  };

  const computeStats = (usersData, casesData, resultsData) => {
    const totalUsers = usersData.length;
    const totalCases = casesData.length;
    const totalAttempts = resultsData.length;
    const passedCount = resultsData.filter(r => r.passed).length;
    const avgScore = totalAttempts > 0
      ? Math.round(resultsData.reduce((s, r) => s + r.score, 0) / totalAttempts)
      : 0;

    // 身分別
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

    // 症例別難易度
    const casePerformance = casesData.map(c => {
      const caseResults = resultsData.filter(r => r.case_id === c.id);
      const avgCaseScore = caseResults.length > 0
        ? Math.round(caseResults.reduce((s, r) => s + r.score, 0) / caseResults.length)
        : null;
      const passRate = caseResults.length > 0
        ? Math.round((caseResults.filter(r => r.passed).length / caseResults.length) * 100)
        : null;
      return { ...c, attempts: caseResults.length, avgScore: avgCaseScore, passRate };
    }).sort((a, b) => b.attempts - a.attempts);

    // 月別挑戦数（直近6ヶ月）
    const monthlyData = {};
    const now = new Date();
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${d.getFullYear()}/${d.getMonth() + 1}`;
      monthlyData[key] = 0;
    }
    resultsData.forEach(r => {
      const d = new Date(r.created_at);
      const key = `${d.getFullYear()}/${d.getMonth() + 1}`;
      if (monthlyData[key] !== undefined) monthlyData[key]++;
    });

    setStats({
      totalUsers, totalCases, totalAttempts, passedCount, avgScore,
      passRate: totalAttempts > 0 ? Math.round((passedCount / totalAttempts) * 100) : 0,
      roleStats, casePerformance, monthlyData,
    });
  };

  const postAnnouncement = async () => {
    if (!newAnnouncement.title.trim()) { alert('タイトルを入力してください'); return; }
    setPostingAnnounce(true);
    const { error } = await supabase.from('announcements').insert({
      title: newAnnouncement.title,
      body: newAnnouncement.body,
      important: newAnnouncement.important,
      created_by: user.id,
      created_at: new Date().toISOString(),
    });
    if (error) { alert('投稿に失敗しました'); }
    else {
      setNewAnnouncement({ title: '', body: '', important: false });
      fetchAll();
      alert('お知らせを投稿しました');
    }
    setPostingAnnounce(false);
  };

  const deleteAnnouncement = async (id) => {
    if (!confirm('このお知らせを削除しますか？')) return;
    await supabase.from('announcements').delete().eq('id', id);
    fetchAll();
  };

  const saveCase = async () => {
    if (!newCase.title.trim()) { alert('症例タイトルを入力してください'); return; }
    setSavingCase(true);
    const { error } = await supabase.from('cases').insert({
      ...newCase,
      created_by: user.id,
      created_at: new Date().toISOString(),
    });
    if (error) { alert('症例の保存に失敗しました'); }
    else {
      setNewCase({ title: '', chief_complaint: '', history: '', vital_signs: '', physical_exam: '', initial_labs: '', answer_diagnosis: '', scoring_criteria: '', difficulty: 'medium', category: '' });
      setShowCaseForm(false);
      fetchAll();
      alert('症例を追加しました');
    }
    setSavingCase(false);
  };

  const deleteCase = async (id) => {
    if (!confirm('この症例を削除しますか？関連する成績も削除されます。')) return;
    await supabase.from('results').delete().eq('case_id', id);
    await supabase.from('cases').delete().eq('id', id);
    fetchAll();
  };

  if (loading || loadingData) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-3"></div>
          <p className="text-gray-500">管理者データ読み込み中...</p>
        </div>
      </div>
    );
  }

  if (userProfile && !userProfile.is_admin) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <p className="text-gray-500">管理者権限が必要です</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-gray-800 text-white sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
          <button onClick={() => router.push('/')} className="text-gray-300 text-sm">← トップ</button>
          <h1 className="text-lg font-bold">🔧 管理者ダッシュボード</h1>
          <div className="text-xs text-gray-400">{userProfile?.name}</div>
        </div>
        {/* タブ */}
        <div className="max-w-5xl mx-auto px-4 flex gap-1 pb-1">
          {[
            { key: 'overview', label: '📊 概要' },
            { key: 'users', label: '👥 利用者' },
            { key: 'cases', label: '📋 症例' },
            { key: 'announce', label: '📢 お知らせ' },
          ].map(t => (
            <button
              key={t.key}
              onClick={() => setActiveTab(t.key)}
              className={`text-xs px-3 py-1.5 rounded-t font-bold transition ${activeTab === t.key ? 'bg-white text-gray-800' : 'text-gray-400 hover:text-white'}`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </header>

      <div className="max-w-5xl mx-auto px-4 py-6">

        {/* ==== 概要タブ ==== */}
        {activeTab === 'overview' && stats && (
          <div className="space-y-5">
            {/* KPI */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {[
                { label: '登録ユーザー', value: stats.totalUsers, icon: '👥', color: 'text-blue-600' },
                { label: '症例数', value: stats.totalCases, icon: '📋', color: 'text-indigo-600' },
                { label: '総挑戦回数', value: stats.totalAttempts, icon: '🎯', color: 'text-orange-600' },
                { label: '平均スコア', value: `${stats.avgScore}点`, icon: '📈', color: 'text-green-600' },
              ].map((kpi, i) => (
                <div key={i} className="bg-white rounded-xl shadow-sm p-4 text-center">
                  <div className="text-2xl mb-1">{kpi.icon}</div>
                  <div className={`text-2xl font-black ${kpi.color}`}>{kpi.value}</div>
                  <div className="text-xs text-gray-500">{kpi.label}</div>
                </div>
              ))}
            </div>

            {/* 合格率 */}
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

            {/* 身分別統計 */}
            <div className="bg-white rounded-xl shadow-sm p-5">
              <h3 className="font-bold text-gray-700 mb-3">身分別パフォーマンス</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-2 text-gray-500 font-medium">身分</th>
                      <th className="text-right py-2 text-gray-500 font-medium">人数</th>
                      <th className="text-right py-2 text-gray-500 font-medium">挑戦数</th>
                      <th className="text-right py-2 text-gray-500 font-medium">平均点</th>
                      <th className="text-right py-2 text-gray-500 font-medium">合格率</th>
                    </tr>
                  </thead>
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
            </div>

            {/* 月別挑戦数 */}
            <div className="bg-white rounded-xl shadow-sm p-5">
              <h3 className="font-bold text-gray-700 mb-4">月別挑戦回数（直近6ヶ月）</h3>
              <div className="flex items-end gap-3 h-32">
                {Object.entries(stats.monthlyData).map(([month, count]) => {
                  const maxVal = Math.max(...Object.values(stats.monthlyData), 1);
                  const height = `${Math.max((count / maxVal) * 100, 4)}%`;
                  return (
                    <div key={month} className="flex-1 flex flex-col items-center justify-end gap-1">
                      <span className="text-xs font-bold text-blue-600">{count}</span>
                      <div className="w-full bg-blue-500 rounded-t" style={{ height }}></div>
                      <span className="text-xs text-gray-400">{month.split('/')[1]}月</span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* 症例別成績（上位5件） */}
            <div className="bg-white rounded-xl shadow-sm p-5">
              <h3 className="font-bold text-gray-700 mb-3">症例別成績（挑戦数順）</h3>
              <div className="space-y-2">
                {stats.casePerformance.slice(0, 10).map(c => (
                  <div key={c.id} className="flex items-center gap-3 py-1 border-b last:border-0">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-700 truncate">{c.title}</p>
                      <p className="text-xs text-gray-400">{c.category} / {c.difficulty}</p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <div className="text-xs text-gray-500">{c.attempts}回挑戦</div>
                      <div className="text-xs font-bold">
                        {c.avgScore !== null ? (
                          <span className={c.passRate >= 80 ? 'text-green-600' : 'text-orange-500'}>
                            平均{c.avgScore}点 / 合格率{c.passRate}%
                          </span>
                        ) : (
                          <span className="text-gray-400">未挑戦</span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ==== 利用者タブ ==== */}
        {activeTab === 'users' && (
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <h2 className="font-bold text-gray-700">登録ユーザー一覧（{users.length}人）</h2>
            </div>
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
                      <th className="text-left px-4 py-3 text-gray-500 font-medium">登録日</th>
                    </tr>
                  </thead>
                  <tbody>
                    {users.map(u => {
                      const userResults = results.filter(r => r.user_id === u.id);
                      const avgScore = userResults.length > 0
                        ? Math.round(userResults.reduce((s, r) => s + r.score, 0) / userResults.length)
                        : null;
                      const passRate = userResults.length > 0
                        ? Math.round((userResults.filter(r => r.passed).length / userResults.length) * 100)
                        : null;
                      return (
                        <tr key={u.id} className="border-t hover:bg-gray-50">
                          <td className="px-4 py-3">
                            <div className="font-medium text-gray-800">{u.name}</div>
                            <div className="text-xs text-gray-400">{u.email}</div>
                          </td>
                          <td className="px-4 py-3 text-gray-600">{u.role}</td>
                          <td className="px-4 py-3 text-right text-gray-600">{userResults.length}</td>
                          <td className="px-4 py-3 text-right font-bold">
                            {passRate !== null ? (
                              <span className={passRate >= 80 ? 'text-green-600' : 'text-orange-500'}>{passRate}%</span>
                            ) : <span className="text-gray-300">—</span>}
                          </td>
                          <td className="px-4 py-3 text-right font-bold text-gray-700">
                            {avgScore !== null ? `${avgScore}点` : <span className="text-gray-300">—</span>}
                          </td>
                          <td className="px-4 py-3 text-xs text-gray-400">
                            {new Date(u.created_at).toLocaleDateString('ja-JP')}
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
            <div className="flex justify-between items-center">
              <h2 className="font-bold text-gray-700">症例管理（{cases.length}件）</h2>
              <button
                onClick={() => setShowCaseForm(!showCaseForm)}
                className="bg-blue-600 text-white px-4 py-2 rounded-xl text-sm font-bold hover:bg-blue-700"
              >
                ＋ 症例追加
              </button>
            </div>

            {/* 症例追加フォーム */}
            {showCaseForm && (
              <div className="bg-white rounded-xl shadow-sm p-5 space-y-4 border-2 border-blue-200">
                <h3 className="font-bold text-blue-700">新規症例追加</h3>
                {[
                  { key: 'title', label: '症例タイトル *', placeholder: '例：60歳男性の急性胸痛', type: 'input' },
                  { key: 'chief_complaint', label: '主訴', placeholder: '例：胸痛・息切れ', type: 'input' },
                  { key: 'history', label: '現病歴', placeholder: '症状の経過...', type: 'textarea' },
                  { key: 'vital_signs', label: 'バイタルサイン', placeholder: 'BP 145/90, HR 98, SpO2 94%...', type: 'textarea' },
                  { key: 'physical_exam', label: '身体所見', placeholder: '診察所見...', type: 'textarea' },
                  { key: 'initial_labs', label: '初期検査所見（提示するもの）', placeholder: '心電図所見...', type: 'textarea' },
                  { key: 'answer_diagnosis', label: '正解診断名 *', placeholder: 'AI採点に使用（受験者には非表示）', type: 'input' },
                  { key: 'scoring_criteria', label: '採点基準・補足（任意）', placeholder: '採点でAIに伝えたい注意点...', type: 'textarea' },
                  { key: 'category', label: 'カテゴリ', placeholder: '例：循環器, 呼吸器, 外傷', type: 'input' },
                ].map(field => (
                  <div key={field.key}>
                    <label className="text-xs font-bold text-gray-600 mb-1 block">{field.label}</label>
                    {field.type === 'input' ? (
                      <input
                        value={newCase[field.key]}
                        onChange={e => setNewCase({ ...newCase, [field.key]: e.target.value })}
                        placeholder={field.placeholder}
                        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
                      />
                    ) : (
                      <textarea
                        value={newCase[field.key]}
                        onChange={e => setNewCase({ ...newCase, [field.key]: e.target.value })}
                        placeholder={field.placeholder}
                        rows={3}
                        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300 resize-none"
                      />
                    )}
                  </div>
                ))}
                <div>
                  <label className="text-xs font-bold text-gray-600 mb-1 block">難易度</label>
                  <select
                    value={newCase.difficulty}
                    onChange={e => setNewCase({ ...newCase, difficulty: e.target.value })}
                    className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none"
                  >
                    <option value="easy">易しい</option>
                    <option value="medium">普通</option>
                    <option value="hard">難しい</option>
                  </select>
                </div>
                <div className="flex gap-3">
                  <button onClick={() => setShowCaseForm(false)} className="flex-1 border border-gray-300 text-gray-600 py-2 rounded-xl text-sm font-bold">
                    キャンセル
                  </button>
                  <button
                    onClick={saveCase}
                    disabled={savingCase}
                    className="flex-1 bg-blue-600 text-white py-2 rounded-xl text-sm font-bold hover:bg-blue-700 disabled:opacity-50"
                  >
                    {savingCase ? '保存中...' : '✓ 保存する'}
                  </button>
                </div>
              </div>
            )}

            {/* 症例リスト */}
            <div className="space-y-3">
              {cases.map(c => {
                const caseResults = results.filter(r => r.case_id === c.id);
                return (
                  <div key={c.id} className="bg-white rounded-xl shadow-sm p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap gap-1.5 mb-1">
                          <span className="text-xs px-2 py-0.5 rounded bg-gray-100 text-gray-600">{c.difficulty}</span>
                          {c.category && <span className="text-xs px-2 py-0.5 rounded bg-blue-100 text-blue-600">{c.category}</span>}
                        </div>
                        <h3 className="font-bold text-gray-800 text-sm">{c.title}</h3>
                        <p className="text-xs text-gray-500 mt-0.5">正解：{c.answer_diagnosis}</p>
                        <p className="text-xs text-gray-400 mt-0.5">挑戦数：{caseResults.length}回</p>
                      </div>
                      <button
                        onClick={() => deleteCase(c.id)}
                        className="text-red-400 hover:text-red-600 text-xs flex-shrink-0"
                      >
                        削除
                      </button>
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

            {/* 新規投稿 */}
            <div className="bg-white rounded-xl shadow-sm p-5 space-y-3 border-2 border-orange-100">
              <h3 className="font-bold text-orange-600">＋ 新規お知らせ</h3>
              <input
                value={newAnnouncement.title}
                onChange={e => setNewAnnouncement({ ...newAnnouncement, title: e.target.value })}
                placeholder="タイトル *"
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-300"
              />
              <textarea
                value={newAnnouncement.body}
                onChange={e => setNewAnnouncement({ ...newAnnouncement, body: e.target.value })}
                placeholder="本文（任意）"
                rows={3}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-300 resize-none"
              />
              <label className="flex items-center gap-2 text-sm text-gray-700">
                <input
                  type="checkbox"
                  checked={newAnnouncement.important}
                  onChange={e => setNewAnnouncement({ ...newAnnouncement, important: e.target.checked })}
                  className="w-4 h-4"
                />
                重要（赤字表示）
              </label>
              <button
                onClick={postAnnouncement}
                disabled={postingAnnounce || !newAnnouncement.title.trim()}
                className="w-full bg-orange-500 text-white py-2 rounded-xl text-sm font-bold hover:bg-orange-600 disabled:opacity-50"
              >
                {postingAnnounce ? '投稿中...' : '📢 投稿する'}
              </button>
            </div>

            {/* 既存お知らせ */}
            <div className="space-y-3">
              {announcements.map(a => (
                <div key={a.id} className={`bg-white rounded-xl shadow-sm p-4 ${a.important ? 'border-l-4 border-red-500' : ''}`}>
                  <div className="flex justify-between items-start gap-3">
                    <div>
                      <p className={`font-bold text-sm ${a.important ? 'text-red-600' : 'text-gray-800'}`}>
                        {a.important && '🔴 '}{a.title}
                      </p>
                      {a.body && <p className="text-xs text-gray-600 mt-1">{a.body}</p>}
                      <p className="text-xs text-gray-400 mt-1">
                        {new Date(a.created_at).toLocaleDateString('ja-JP')}
                      </p>
                    </div>
                    <button onClick={() => deleteAnnouncement(a.id)} className="text-red-400 hover:text-red-600 text-xs flex-shrink-0">
                      削除
                    </button>
                  </div>
                </div>
              ))}
              {announcements.length === 0 && (
                <p className="text-center text-gray-400 py-8">お知らせはありません</p>
              )}
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
