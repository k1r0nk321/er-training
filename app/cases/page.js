'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../lib/auth-context';
import { supabase } from '../lib/supabase';

export default function CasesPage() {
  const { user, userProfile, loading } = useAuth();
  const router = useRouter();

  // お試しモード判定
  const [isTrialMode, setIsTrialMode] = useState(false);

  const [cases, setCases] = useState([]);
  const [filteredCases, setFilteredCases] = useState([]);
  const [loadingCases, setLoadingCases] = useState(true);
  const [error, setError] = useState('');

  // フィルター状態
  const [searchText, setSearchText] = useState('');
  const [selectedDifficulty, setSelectedDifficulty] = useState('all');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [sortOrder, setSortOrder] = useState('newest');

  // 統計
  const [myResults, setMyResults] = useState({});

  useEffect(() => {
    // お試しモードチェック
    const trial = sessionStorage.getItem('trial_mode') === 'true';
    setIsTrialMode(trial);

    if (!loading && !user && !trial) {
      router.push('/');
    }
  }, [user, loading, router]);

  useEffect(() => {
    const trial = sessionStorage.getItem('trial_mode') === 'true';
    // 症例取得は常に実行
    fetchCases();
    // 成績取得はログイン済みユーザーのみ（お試しモードはスキップ）
    if (user && !trial) {
      fetchMyResults();
    }
  }, [user]);

  useEffect(() => {
    applyFilter();
  }, [cases, searchText, selectedDifficulty, selectedCategory, sortOrder]);

  const fetchCases = async () => {
    setLoadingCases(true);
    const { data, error } = await supabase
      .from('cases')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      setError('症例の読み込みに失敗しました');
      console.error(error);
    } else {
      setCases(data || []);
    }
    setLoadingCases(false);
  };

  const fetchMyResults = async () => {
    if (!user) return;
    const { data } = await supabase
      .from('results')
      .select('case_id, score, passed')
      .eq('user_id', user.id);

    if (data) {
      // case_idごとに記録を保持（合格・不合格問わず挑戦済みとしてカウント）
      // 最高スコアを保持しつつ、挑戦したことは必ず記録
      const resultMap = {};
      data.forEach(r => {
        if (!resultMap[r.case_id]) {
          // 初回：そのまま登録
          resultMap[r.case_id] = r;
        } else {
          // 2回目以降：スコアが高い方を保持（ただし挑戦済みフラグは維持）
          if (r.score > resultMap[r.case_id].score) {
            resultMap[r.case_id] = r;
          }
        }
      });
      setMyResults(resultMap);
    }
  };

  const applyFilter = () => {
    let filtered = [...cases];

    if (searchText) {
      filtered = filtered.filter(c =>
        c.title.includes(searchText) ||
        c.chief_complaint?.includes(searchText) ||
        c.category?.includes(searchText)
      );
    }

    if (selectedDifficulty !== 'all') {
      filtered = filtered.filter(c => c.difficulty === selectedDifficulty);
    }

    if (selectedCategory !== 'all') {
      filtered = filtered.filter(c => c.category === selectedCategory);
    }

    if (sortOrder === 'newest') {
      filtered.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    } else if (sortOrder === 'difficulty_asc') {
      const order = { easy: 1, medium: 2, hard: 3 };
      filtered.sort((a, b) => (order[a.difficulty] || 2) - (order[b.difficulty] || 2));
    } else if (sortOrder === 'title') {
      filtered.sort((a, b) => a.title.localeCompare(b.title, 'ja'));
    }

    setFilteredCases(filtered);
  };

  const handleRandomSelect = () => {
    if (filteredCases.length === 0) return;
    const randomCase = filteredCases[Math.floor(Math.random() * filteredCases.length)];
    router.push(`/cases/${randomCase.id}`);
  };

  const handleRandomUnsolved = () => {
    const unsolved = filteredCases.filter(c => !myResults[c.id]);
    if (unsolved.length === 0) {
      alert('未解答の症例はありません！すべて挑戦済みです 🎉');
      return;
    }
    const randomCase = unsolved[Math.floor(Math.random() * unsolved.length)];
    router.push(`/cases/${randomCase.id}`);
  };

  const getDifficultyLabel = (d) => {
    const labels = { easy: '易', medium: '中', hard: '難' };
    return labels[d] || '中';
  };

  const getDifficultyColor = (d) => {
    const colors = {
      easy: 'bg-green-100 text-green-700',
      medium: 'bg-yellow-100 text-yellow-700',
      hard: 'bg-red-100 text-red-700',
    };
    return colors[d] || 'bg-gray-100 text-gray-600';
  };

  const getScoreBadge = (caseId) => {
    const result = myResults[caseId];
    if (!result) return null;
    if (result.passed) {
      return (
        <span className="text-xs px-2 py-0.5 rounded-full font-bold bg-green-100 text-green-700">
          ✓ {result.score}点
        </span>
      );
    }
    return (
      <span className="text-xs px-2 py-0.5 rounded-full font-bold bg-orange-100 text-orange-600">
        挑戦済 {result.score}点
      </span>
    );
  };

  // カテゴリ一覧を動的生成
  const categories = ['all', ...new Set(cases.map(c => c.category).filter(Boolean))];

  const solvedCount = Object.keys(myResults).length;
  const passedCount = Object.values(myResults).filter(r => r.passed).length;

  if (loading || loadingCases) {
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
      {/* ヘッダー */}
      <header className="bg-white shadow-sm sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between">
          <button onClick={() => router.push('/')} className="text-blue-600 hover:text-blue-800 flex items-center gap-1 text-sm">
            ← トップへ
          </button>
          <h1 className="text-lg font-bold text-gray-800">症例一覧</h1>
          <div className="text-sm text-gray-500">
            {isTrialMode ? 'お試しモード' : `挑戦 ${solvedCount} / ${cases.length}問`}
          </div>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-4 py-6">

        {/* 自分の成績サマリー */}
        <div className="bg-white rounded-xl shadow-sm p-4 mb-5 space-y-2">
          <div className="flex items-center justify-between py-2 border-b border-gray-100">
            <span className="text-sm text-gray-600">総症例数</span>
            <span className="text-lg font-bold text-blue-600">{cases.length}例</span>
          </div>
          {!isTrialMode && (
            <>
              <div className="flex items-center justify-between py-2 border-b border-gray-100">
                <span className="text-sm text-gray-600">挑戦済み</span>
                <span className="text-lg font-bold text-indigo-600">{solvedCount} / {cases.length}例</span>
              </div>
              <div className="flex items-center justify-between py-2">
                <span className="text-sm text-gray-600">合格（80点以上）</span>
                <span className="text-lg font-bold text-green-600">{passedCount} / {solvedCount}例</span>
              </div>
            </>
          )}
          {isTrialMode && (
            <div className="py-2">
              <p className="text-xs text-gray-400 text-center">お試しモード：成績は保存されません</p>
            </div>
          )}
        </div>

        {/* ランダム選択ボタン */}
        <div className="flex gap-3 mb-5">
          <button
            onClick={handleRandomSelect}
            disabled={filteredCases.length === 0}
            className="flex-1 bg-blue-600 text-white py-3 rounded-xl font-bold text-sm hover:bg-blue-700 active:bg-blue-800 disabled:opacity-40 transition"
          >
            🎲 ランダムに挑戦
          </button>
          <button
            onClick={handleRandomUnsolved}
            disabled={filteredCases.length === 0}
            className="flex-1 bg-indigo-600 text-white py-3 rounded-xl font-bold text-sm hover:bg-indigo-700 active:bg-indigo-800 disabled:opacity-40 transition"
          >
            🌟 未解答からランダム
          </button>
        </div>

        {/* フィルター */}
        <div className="bg-white rounded-xl shadow-sm p-4 mb-4 space-y-3">
          <input
            type="text"
            placeholder="症例名・主訴・カテゴリで検索..."
            value={searchText}
            onChange={e => setSearchText(e.target.value)}
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
          />
          <div className="flex gap-2 flex-wrap">
            <select
              value={selectedDifficulty}
              onChange={e => setSelectedDifficulty(e.target.value)}
              className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
            >
              <option value="all">難易度：すべて</option>
              <option value="easy">易しい</option>
              <option value="medium">普通</option>
              <option value="hard">難しい</option>
            </select>
            <select
              value={selectedCategory}
              onChange={e => setSelectedCategory(e.target.value)}
              className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
            >
              {categories.map(c => (
                <option key={c} value={c}>{c === 'all' ? 'カテゴリ：すべて' : c}</option>
              ))}
            </select>
            <select
              value={sortOrder}
              onChange={e => setSortOrder(e.target.value)}
              className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
            >
              <option value="newest">新しい順</option>
              <option value="difficulty_asc">難易度順</option>
              <option value="title">タイトル順</option>
            </select>
          </div>
          <div className="text-xs text-gray-400">{filteredCases.length}件表示</div>
        </div>

        {/* 症例リスト */}
        {error && <p className="text-red-500 text-sm mb-3">{error}</p>}
        <div className="space-y-3">
          {filteredCases.map(c => (
            <button
              key={c.id}
              onClick={() => router.push(`/cases/${c.id}`)}
              className="w-full bg-white rounded-xl shadow-sm p-4 text-left hover:shadow-md hover:border-blue-200 border border-transparent transition"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-bold ${getDifficultyColor(c.difficulty)}`}>
                      {getDifficultyLabel(c.difficulty)}
                    </span>
                    {c.category && (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">{c.category}</span>
                    )}
                    {getScoreBadge(c.id)}
                  </div>
                  <h3 className="font-bold text-gray-800 text-sm leading-snug">{c.title}</h3>
                  {c.chief_complaint && (
                    <p className="text-xs text-gray-500 mt-0.5 truncate">主訴：{c.chief_complaint}</p>
                  )}
                </div>
                <span className="text-gray-300 flex-shrink-0 mt-1">›</span>
              </div>
            </button>
          ))}

          {filteredCases.length === 0 && !loadingCases && (
            <div className="text-center py-12 text-gray-400">
              <p className="text-4xl mb-3">📋</p>
              <p>該当する症例がありません</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
