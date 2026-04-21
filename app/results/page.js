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
  const [allCases, setAllCases] = useState([]);
  const [loadingData, setLoadingData] = useState(true);
  const [activeTab, setActiveTab] = useState('list');
  const [expandedCategory, setExpandedCategory] = useState(null);

  useEffect(() => {
    if (!loading && !user) router.push('/');
  }, [user, loading, router]);

  useEffect(() => {
    if (user) fetchAll();
  }, [user]);

  const fetchAll = async () => {
    setLoadingData(true);

    const { data: resultData } = await supabase
      .from('results')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    const { data: caseData } = await supabase
      .from('cases')
      .select('id, title, category, difficulty, chief_complaint');

    if (caseData) {
      const caseMap = {};
      caseData.forEach(c => { caseMap[c.id] = c; });
      setCases(caseMap);
      setAllCases(caseData);
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
  const totalAttempts = results.length;

  // 領域別集計：カテゴリごとに「総症例数・挑戦済み・合格数・不合格症例リスト」
  const categoryStats = {};

  // まず全症例からカテゴリを洗い出す
  allCases.forEach(c => {
    const cat = c.category || '未分類';
    if (!categoryStats[cat]) {
      categoryStats[cat] = {
        total: 0,         // その領域の総症例数
        attempted: 0,     // 挑戦済み数
        passed: 0,        // 合格数
        failedCases: [],  // 不合格症例リスト
        untriedCases: [], // 未挑戦症例リスト
      };
    }
    categoryStats[cat].total++;

    const result = latestByCase[c.id];
    if (result) {
      categoryStats[cat].attempted++;
      if (result.passed) {
        categoryStats[cat].passed++;
      } else {
        categoryStats[cat].failedCases.push({ ...c, score: result.score });
      }
    } else {
      categoryStats[cat].untriedCases.push(c);
    }
  });

  // 合格率で降順ソート
  const categoryList = Object.entries(categoryStats)
    .map(([cat, stat]) => ({ cat, ...stat }))
    .sort((a, b) => {
      const rateA = a.total > 0 ? a.passed / a.total : 0;
      const rateB = b.total > 0 ? b.passed / b.total : 0;
      return rateB - rateA;
    });

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
            <p className="text-xs text-gray-500 mb-1">合格</p>
            <p className="text-2xl font-black text-green-600">{totalPassed}</p>
            <p className="text-xs text-gray-400">症例</p>
          </div>
          <div className="bg-white rounded-xl shadow-sm p-4 text-center">
            <p className="text-xs text-gray-500 mb-1">延べ挑戦</p>
            <p className="text-2xl font-black text-indigo-600">{totalAttempts}</p>
            <p className="text-xs text-gray-400">回</p>
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
            📊 領域別成績
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
                  const attemptCount = results.filter(x => x.case_id === r.case_id).length;
                  return (
                    <button
                      key={r.case_id}
                      onClick={() => router.push(`/cases/${r.case_id}`)}
                      className="w-full bg-white rounded-xl shadow-sm p-4 text-left hover:shadow-md transition"
                    >
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
                      {r.feedback?.overall_comment && (
                        <p className="text-xs text-gray-500 mt-2 pt-2 border-t border-gray-100 line-clamp-2">
                          {r.feedback.overall_comment}
                        </p>
                      )}
                    </button>
                  );
                })
            )}
          </div>
        )}

        {/* ===== 領域別成績 ===== */}
        {activeTab === 'category' && (
          <div className="space-y-3">
            {categoryList.length === 0 ? (
              <div className="text-center py-12 text-gray-400">
                <p className="text-4xl mb-3">📊</p>
                <p className="text-sm">まだデータがありません</p>
              </div>
            ) : (
              <>
                <p className="text-xs text-gray-400 px-1">
                  領域ごとの合格数 / 総症例数を表示しています。不合格・未挑戦の症例はタップして挑戦できます。
                </p>
                {categoryList.map(({ cat, total, attempted, passed, failedCases, untriedCases }) => {
                  const isExpanded = expandedCategory === cat;
                  const passRate = total > 0 ? Math.round((passed / total) * 100) : 0;
                  const failed = attempted - passed;

                  return (
                    <div key={cat} className="bg-white rounded-xl shadow-sm overflow-hidden">
                      {/* カテゴリヘッダー */}
                      <button
                        onClick={() => setExpandedCategory(isExpanded ? null : cat)}
                        className="w-full p-4 text-left hover:bg-gray-50 transition"
                      >
                        <div className="flex items-center justify-between mb-2">
                          <p className="text-sm font-bold text-gray-800">{cat}</p>
                          <div className="flex items-center gap-2">
                            <span className="text-base font-black text-green-600">{passed}</span>
                            <span className="text-xs text-gray-400">/ {total}例</span>
                            <span className={`text-xs transition-transform ${isExpanded ? 'rotate-180' : ''} text-gray-400`}>▼</span>
                          </div>
                        </div>

                        {/* プログレスバー */}
                        <div className="w-full bg-gray-100 rounded-full h-3 flex overflow-hidden">
                          {/* 合格（緑） */}
                          <div
                            className="bg-green-500 h-3 transition-all"
                            style={{ width: `${total > 0 ? (passed / total) * 100 : 0}%` }}
                          />
                          {/* 不合格（オレンジ） */}
                          <div
                            className="bg-orange-400 h-3 transition-all"
                            style={{ width: `${total > 0 ? (failed / total) * 100 : 0}%` }}
                          />
                          {/* 未挑戦（グレー） */}
                        </div>

                        {/* 凡例 */}
                        <div className="flex gap-3 mt-1.5">
                          <span className="text-xs text-green-600">✓ 合格 {passed}</span>
                          {failed > 0 && <span className="text-xs text-orange-500">✗ 不合格 {failed}</span>}
                          {untriedCases.length > 0 && <span className="text-xs text-gray-400">未挑戦 {untriedCases.length}</span>}
                        </div>
                      </button>

                      {/* 展開時：不合格・未挑戦症例リスト */}
                      {isExpanded && (
                        <div className="border-t border-gray-100">
                          {/* 不合格症例 */}
                          {failedCases.length > 0 && (
                            <div>
                              <div className="px-4 py-2 bg-orange-50">
                                <p className="text-xs font-bold text-orange-600">✗ 不合格の症例（再挑戦しよう）</p>
                              </div>
                              {failedCases.map(c => (
                                <button
                                  key={c.id}
                                  onClick={() => router.push(`/cases/${c.id}`)}
                                  className="w-full flex items-center justify-between px-4 py-3 hover:bg-orange-50 transition border-t border-gray-50"
                                >
                                  <div className="flex items-center gap-2 flex-1 min-w-0">
                                    <span className={`text-xs px-1.5 py-0.5 rounded font-bold flex-shrink-0 ${getDiffColor(c.difficulty)}`}>
                                      {getDiffLabel(c.difficulty)}
                                    </span>
                                    <div className="min-w-0">
                                      <p className="text-xs font-bold text-gray-800 truncate">{c.title}</p>
                                      {c.chief_complaint && (
                                        <p className="text-xs text-gray-400 truncate">{c.chief_complaint}</p>
                                      )}
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-2 flex-shrink-0">
                                    <span className={`text-sm font-bold ${getScoreColor(c.score)}`}>{c.score}点</span>
                                    <span className="text-blue-500 text-xs">再挑戦 →</span>
                                  </div>
                                </button>
                              ))}
                            </div>
                          )}

                          {/* 未挑戦症例 */}
                          {untriedCases.length > 0 && (
                            <div>
                              <div className="px-4 py-2 bg-gray-50">
                                <p className="text-xs font-bold text-gray-500">○ 未挑戦の症例</p>
                              </div>
                              {untriedCases.map(c => (
                                <button
                                  key={c.id}
                                  onClick={() => router.push(`/cases/${c.id}`)}
                                  className="w-full flex items-center justify-between px-4 py-3 hover:bg-blue-50 transition border-t border-gray-50"
                                >
                                  <div className="flex items-center gap-2 flex-1 min-w-0">
                                    <span className={`text-xs px-1.5 py-0.5 rounded font-bold flex-shrink-0 ${getDiffColor(c.difficulty)}`}>
                                      {getDiffLabel(c.difficulty)}
                                    </span>
                                    <div className="min-w-0">
                                      <p className="text-xs font-bold text-gray-800 truncate">{c.title}</p>
                                      {c.chief_complaint && (
                                        <p className="text-xs text-gray-400 truncate">{c.chief_complaint}</p>
                                      )}
                                    </div>
                                  </div>
                                  <span className="text-blue-500 text-xs flex-shrink-0">挑戦 →</span>
                                </button>
                              ))}
                            </div>
                          )}

                          {/* 全合格の場合 */}
                          {failedCases.length === 0 && untriedCases.length === 0 && (
                            <div className="px-4 py-4 text-center">
                              <p className="text-sm text-green-600 font-bold">🎉 この領域は全問合格！</p>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </>
            )}
          </div>
        )}

      </div>
    </div>
  );
}
