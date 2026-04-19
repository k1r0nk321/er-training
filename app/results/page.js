'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../lib/auth-context';
import { supabase } from '../lib/supabase';

export default function ResultsPage() {
  const { user, userProfile, loading } = useAuth();
  const router = useRouter();

  const [results, setResults] = useState([]);
  const [cases, setCases] = useState({});
  const [loadingResults, setLoadingResults] = useState(true);

  const [filterPass, setFilterPass] = useState('all'); // 'all' | 'passed' | 'failed'
  const [filterCategory, setFilterCategory] = useState('all');
  const [sortOrder, setSortOrder] = useState('newest');

  useEffect(() => {
    if (!loading && !user) router.push('/');
  }, [user, loading, router]);

  useEffect(() => {
    if (user) {
      fetchResults();
    }
  }, [user]);

  const fetchResults = async () => {
    setLoadingResults(true);

    const { data: resultData, error } = await supabase
      .from('results')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (error) {
      console.error(error);
      setLoadingResults(false);
      return;
    }

    // 症例情報を取得
    const caseIds = [...new Set((resultData || []).map(r => r.case_id))];
    if (caseIds.length > 0) {
      const { data: caseData } = await supabase
        .from('cases')
        .select('id, title, category, difficulty')
        .in('id', caseIds);

      const caseMap = {};
      (caseData || []).forEach(c => { caseMap[c.id] = c; });
      setCases(caseMap);
    }

    setResults(resultData || []);
    setLoadingResults(false);
  };

  // 統計計算
  const totalAttempts = results.length;
  const passedCount = results.filter(r => r.passed).length;
  const avgScore = totalAttempts > 0
    ? Math.round(results.reduce((sum, r) => sum + r.score, 0) / totalAttempts)
    : 0;
  const uniqueCases = new Set(results.map(r => r.case_id)).size;

  // フィルター適用
  const filteredResults = results
    .filter(r => {
      if (filterPass === 'passed') return r.passed;
      if (filterPass === 'failed') return !r.passed;
      return true;
    })
    .filter(r => {
      if (filterCategory === 'all') return true;
      const c = cases[r.case_id];
      return c?.category === filterCategory;
    })
    .sort((a, b) => {
      if (sortOrder === 'newest') return new Date(b.created_at) - new Date(a.created_at);
      if (sortOrder === 'highest') return b.score - a.score;
      if (sortOrder === 'lowest') return a.score - b.score;
      return 0;
    });

  const allCategories = [...new Set(Object.values(cases).map(c => c.category).filter(Boolean))];

  const getDifficultyLabel = (d) => ({ easy: '易', medium: '中', hard: '難' }[d] || '中');
  const getDifficultyColor = (d) => ({
    easy: 'bg-green-100 text-green-700',
    medium: 'bg-yellow-100 text-yellow-700',
    hard: 'bg-red-100 text-red-700',
  }[d] || 'bg-gray-100 text-gray-600');

  const getScoreColor = (score) => {
    if (score >= 90) return 'text-blue-600';
    if (score >= 80) return 'text-green-600';
    if (score >= 60) return 'text-yellow-600';
    return 'text-red-500';
  };

  if (loading || loadingResults) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-3"></div>
          <p className="text-gray-500">読み込み中...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm sticky top-0 z-10">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center justify-between">
          <button onClick={() => router.push('/')} className="text-blue-600 text-sm">← トップへ</button>
          <h1 className="text-lg font-bold text-gray-800">成績一覧</h1>
          <div></div>
        </div>
      </header>

      <div className="max-w-2xl mx-auto px-4 py-6 space-y-5">

        {/* サマリー統計 */}
        <div className="grid grid-cols-4 gap-2">
          {[
            { label: '挑戦回数', value: totalAttempts, color: 'text-indigo-600' },
            { label: '合格数', value: passedCount, color: 'text-green-600' },
            { label: '平均点', value: `${avgScore}点`, color: 'text-blue-600' },
            { label: '挑戦症例', value: uniqueCases, color: 'text-orange-500' },
          ].map((stat, i) => (
            <div key={i} className="bg-white rounded-xl shadow-sm p-3 text-center">
              <div className={`text-xl font-black ${stat.color}`}>{stat.value}</div>
              <div className="text-xs text-gray-500 mt-0.5">{stat.label}</div>
            </div>
          ))}
        </div>

        {/* 合格率バー */}
        {totalAttempts > 0 && (
          <div className="bg-white rounded-xl shadow-sm p-4">
            <div className="flex justify-between text-sm mb-2">
              <span className="font-bold text-gray-700">合格率</span>
              <span className="font-bold text-green-600">
                {Math.round((passedCount / totalAttempts) * 100)}%
              </span>
            </div>
            <div className="bg-gray-100 rounded-full h-3">
              <div
                className="bg-green-500 h-3 rounded-full transition-all"
                style={{ width: `${(passedCount / totalAttempts) * 100}%` }}
              ></div>
            </div>
            <div className="flex justify-between text-xs text-gray-400 mt-1">
              <span>合格：{passedCount}回</span>
              <span>不合格：{totalAttempts - passedCount}回</span>
            </div>
          </div>
        )}

        {/* フィルター */}
        <div className="bg-white rounded-xl shadow-sm p-4 space-y-3">
          <div className="flex gap-2 flex-wrap">
            <select
              value={filterPass}
              onChange={e => setFilterPass(e.target.value)}
              className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
            >
              <option value="all">結果：すべて</option>
              <option value="passed">合格のみ</option>
              <option value="failed">不合格のみ</option>
            </select>
            <select
              value={filterCategory}
              onChange={e => setFilterCategory(e.target.value)}
              className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
            >
              <option value="all">カテゴリ：すべて</option>
              {allCategories.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
            <select
              value={sortOrder}
              onChange={e => setSortOrder(e.target.value)}
              className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
            >
              <option value="newest">新しい順</option>
              <option value="highest">高得点順</option>
              <option value="lowest">低得点順</option>
            </select>
          </div>
          <div className="text-xs text-gray-400">{filteredResults.length}件表示</div>
        </div>

        {/* 成績リスト */}
        <div className="space-y-3">
          {filteredResults.map((r) => {
            const c = cases[r.case_id];
            const feedback = r.feedback || {};
            return (
              <div
                key={r.id}
                className="bg-white rounded-xl shadow-sm p-4 cursor-pointer hover:shadow-md transition"
                onClick={() => router.push(`/cases/${r.case_id}`)}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    {/* タイトル・タグ */}
                    <div className="flex flex-wrap items-center gap-1.5 mb-1">
                      {c && (
                        <span className={`text-xs px-1.5 py-0.5 rounded font-bold ${getDifficultyColor(c.difficulty)}`}>
                          {getDifficultyLabel(c.difficulty)}
                        </span>
                      )}
                      {c?.category && (
                        <span className="text-xs px-1.5 py-0.5 rounded bg-gray-100 text-gray-500">{c.category}</span>
                      )}
                      <span className={`text-xs font-bold ${r.passed ? 'text-green-600' : 'text-red-500'}`}>
                        {r.passed ? '✅ 合格' : '❌ 不合格'}
                      </span>
                    </div>
                    <h3 className="font-bold text-gray-800 text-sm leading-snug">
                      {c?.title || '症例が削除されました'}
                    </h3>
                    <p className="text-xs text-gray-500 mt-1">
                      最終診断：{r.final_diagnosis || '—'}
                    </p>
                    {feedback.teaching_point && (
                      <p className="text-xs text-blue-600 mt-1 line-clamp-1">
                        📌 {feedback.teaching_point}
                      </p>
                    )}
                    <p className="text-xs text-gray-400 mt-1">
                      {new Date(r.created_at).toLocaleDateString('ja-JP', {
                        year: 'numeric', month: 'long', day: 'numeric',
                        hour: '2-digit', minute: '2-digit',
                      })}
                    </p>
                  </div>
                  {/* スコア */}
                  <div className="text-right flex-shrink-0">
                    <div className={`text-3xl font-black ${getScoreColor(r.score)}`}>{r.score}</div>
                    <div className="text-xs text-gray-400">点</div>
                  </div>
                </div>
              </div>
            );
          })}

          {filteredResults.length === 0 && (
            <div className="text-center py-16 text-gray-400">
              <p className="text-5xl mb-3">📊</p>
              <p className="font-bold">まだ成績がありません</p>
              <p className="text-sm mt-1">症例に挑戦してみましょう！</p>
              <button
                onClick={() => router.push('/cases')}
                className="mt-4 bg-blue-600 text-white px-6 py-2 rounded-xl text-sm font-bold"
              >
                症例一覧へ
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
