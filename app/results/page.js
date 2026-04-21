'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../lib/auth-context';
import { supabase } from '../lib/supabase';

export default function ResultsPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [results, setResults] = useState([]);
  const [cases, setCases] = useState({});
  const [loadingData, setLoadingData] = useState(true);
  const [activeTab, setActiveTab] = useState('list'); // 'list' | 'category'

  useEffect(() => {
    if (!loading && !user) router.push('/');
  }, [user, loading, router]);

  useEffect(() => {
    if (user) fetchAll();
  }, [user]);

  const fetchAll = async () => {
    setLoadingData(true);
    // 成績（全履歴）取得
    const { data: resultData } = await supabase
      .from('results')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    // 症例情報取得
    const { data: caseData } = await supabase
      .from('cases')
      .select('id, title, category, difficulty');

    if (caseData) {
      const caseMap = {};
      caseData.forEach(c => { caseMap[c.id] = c; });
      setCases(caseMap);
    }
    setResults(resultData || []);
    setLoadingData(false);
  };

  // 症例ごとの最新スコアを集計
  const latestByCase = {};
  results.forEach(r => {
    if (!latestByCase[r.case_id] || new Date(r.created_at) > new Date(latestByCase[r.case_id].created_at)) {
      latestByCase[r.case_id] = r;
    }
  });

  const latestResults = Object.values(latestByCase);
  const totalAttempted = latestResults.length;
  const totalPassed = latestResults.filter(r => r.passed).length;
  const avgScore = latestResults.length > 0
    ? Math.round(latestResults.reduce((s, r) => s + (r.score || 0), 0) / latestResults.length)
    : 0;
  const totalAttempts = results.length; // 延べ挑戦回数

  // 領域別集計（最新スコアを使用）
  const categoryStats = {};
  latestResults.forEach(r => {
    const c = cases[r.case_id];
    if (!c) return;
    const cat = c.category || '未分類';
    if (!categoryStats[cat]) {
      categoryStats[cat] = { scores: [], passed: 0, total: 0 };
    }
    categoryStats[cat].scores.push(r.score || 0);
    categoryStats[cat].total++;
    if (r.passed) categoryStats[cat].passed++;
  });

  const categoryList = Object.entries(categoryStats)
    .map(([cat, stat]) => ({
      cat,
      avg: Math.round(stat.scores.reduce((a, b) => a + b, 0) / stat.scores.length),
      passed: stat.passed,
      total: stat.total,
    }))
    .sort((a, b) => b.avg - a.avg);

  const getDiffLabel = (d) => ({ easy: '易', medium: '中', hard: '難' }[d] || d);
  const getDiffColor = (d) => ({
    easy: 'bg-green-100 text-green-700',
    medium: 'bg-yellow-100 text-yellow-700',
    hard: 'bg-red-100 text-red-700',
  }[d] || 'bg-gray-100 text-gray-600');

  const getScoreColor = (score) => {
    if (score >= 80) return 'text-green-600 font-bold';
    if (score >= 60) return 'text-yellow-600 font-bold';
    return 'text-red-500 font-bold';
  };

  if (loading || loadingData) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-3"></div>
          <p className="text-gray-500 text-sm">読み込み中...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* ヘッダー */}
      <header className="bg-white shadow-sm sticky top-0 z-10">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center justify-between">
          <button onClick={() => router.push('/')} className="text-blue-600 text-sm">← トップへ</button>
          <span className="font-bold text-gray-800">📊 成績一覧</span>
          <span className="text-xs text-gray-400">延べ{totalAttempts}回</span>
        </div>
      </header>

      <div className="max-w-2xl mx-auto px-4 py-5 space-y-4">

        {/* サマリーカード */}
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-white rounded-xl shadow-sm p-4 text-center">
            <p className="text-xs text-gray-500 mb-1">挑戦済み</p>
            <p className="text-2xl font-black text-blue-600">{totalAttempted}</p>
            <p className="text-xs text-gray-400">症例</p>
          </div>
          <div className="bg-white rounded-xl shadow-sm p-4 text-center">
            <p className="text-xs text-gray-500 mb-1">合格（80点以上）</p>
            <p className="text-2xl font-black text-green-600">{totalPassed}</p>
            <p className="text-xs text-gray-400">症例</p>
          </div>
          <div className="bg-white rounded-xl shadow-sm p-4 text-center">
            <p className="text-xs text-gray-500 mb-1">平均点</p>
            <p className={`text-2xl font-black ${getScoreColor(avgScore)}`}>{avgScore}</p>
            <p className="text-xs text-gray-400">点</p>
          </div>
        </div>

        {/* タブ切替 */}
        <div className="bg-white rounded-xl shadow-sm p-1 flex">
          <button
            onClick={() => setActiveTab('list')}
            className={`flex-1 py-2 rounded-lg text-xs font-bold transition ${activeTab === 'list' ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-gray-600'}`}
          >
            📋 症例別
          </button>
          <button
            onClick={() => setActiveTab('category')}
            className={`flex-1 py-2 rounded-lg text-xs font-bold transition ${activeTab === 'category' ? 'bg-indigo-600 text-white' : 'text-gray-400 hover:text-gray-600'}`}
          >
            📊 領域別平均点
          </button>
        </div>

        {/* ===== 症例別一覧 ===== */}
        {activeTab === 'list' && (
          <div className="space-y-2">
            {latestResults.length === 0 ? (
              <div className="text-center py-12 text-gray-400">
                <p className="text-4xl mb-3">📋</p>
                <p className="text-sm">まだ挑戦した症例がありません</p>
                <button onClick={() => router.push('/cases')} className="mt-4 bg-blue-600 text-white px-6 py-2 rounded-xl text-sm font-bold hover:bg-blue-700 transition">
                  症例に挑戦する
                </button>
              </div>
            ) : (
              latestResults
                .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
                .map(r => {
                  const c = cases[r.case_id];
                  // その症例の挑戦回数
                  const attemptCount = results.filter(x => x.case_id === r.case_id).length;
                  return (
                    <div key={r.case_id} className="bg-white rounded-xl shadow-sm p-4">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1 flex-wrap">
                            {c && (
                              <span className={`text-xs px-2 py-0.5 rounded-full font-bold ${getDiffColor(c.difficulty)}`}>
                                {getDiffLabel(c.difficulty)}
                              </span>
                            )}
                            <span className={`text-xs px-2 py-0.5 rounded-full font-bold ${r.passed ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'}`}>
                              {r.passed ? '✓ 合格' : '✗ 不合格'}
                            </span>
                            {attemptCount > 1 && (
                              <span className="text-xs text-gray-400">（{attemptCount}回挑戦）</span>
                            )}
                          </div>
                          <p className="text-sm font-bold text-gray-800 truncate">{c?.title || r.case_id}</p>
                          <p className="text-xs text-gray-400 mt-0.5">
                            {new Date(r.created_at).toLocaleDateString('ja-JP', { year: 'numeric', month: 'short', day: 'numeric' })}
                          </p>
                        </div>
                        <div className="text-right flex-shrink-0">
                          <p className={`text-2xl ${getScoreColor(r.score)}`}>{r.score}</p>
                          <p className="text-xs text-gray-400">点</p>
                        </div>
                      </div>
                      {/* フィードバック */}
                      {r.feedback?.overall_comment && (
                        <p className="text-xs text-gray-500 mt-2 pt-2 border-t border-gray-100 line-clamp-2">
                          {r.feedback.overall_comment}
                        </p>
                      )}
                    </div>
                  );
                })
            )}
          </div>
        )}

        {/* ===== 領域別平均点 ===== */}
        {activeTab === 'category' && (
          <div className="space-y-3">
            {categoryList.length === 0 ? (
              <div className="text-center py-12 text-gray-400">
                <p className="text-4xl mb-3">📊</p>
                <p className="text-sm">まだデータがありません</p>
              </div>
            ) : (
              <>
                <p className="text-xs text-gray-400 px-1">領域ごとの最新スコアの平均点を表示しています。</p>
                {categoryList.map(({ cat, avg, passed, total }) => (
                  <div key={cat} className="bg-white rounded-xl shadow-sm p-4">
                    <div className="flex items-center justify-between mb-2">
                      <div>
                        <p className="text-sm font-bold text-gray-800">{cat}</p>
                        <p className="text-xs text-gray-400">{total}症例中 {passed}合格</p>
                      </div>
                      <div className="text-right">
                        <p className={`text-2xl ${getScoreColor(avg)}`}>{avg}</p>
                        <p className="text-xs text-gray-400">点</p>
                      </div>
                    </div>
                    {/* スコアバー */}
                    <div className="w-full bg-gray-100 rounded-full h-2">
                      <div
                        className={`h-2 rounded-full transition-all ${avg >= 80 ? 'bg-green-500' : avg >= 60 ? 'bg-yellow-400' : 'bg-red-400'}`}
                        style={{ width: `${avg}%` }}
                      />
                    </div>
                  </div>
                ))}
              </>
            )}
          </div>
        )}

      </div>
    </div>
  );
}
