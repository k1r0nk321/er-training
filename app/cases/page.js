'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../lib/auth-context';
import { supabase } from '../lib/supabase';

export default function CasesPage() {
  const { user, userProfile, loading } = useAuth();
  const router = useRouter();

  const [isTrialMode, setIsTrialMode] = useState(false);

  const [cases, setCases] = useState([]);
  const [filteredCases, setFilteredCases] = useState([]);
  const [loadingCases, setLoadingCases] = useState(true);
  const [error, setError] = useState('');

  // フィルター状態
  const [searchText, setSearchText] = useState('');
  const [selectedDifficulty, setSelectedDifficulty] = useState('all');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [sortOrder, setSortOrder] = useState('number');
  const [showBasicOnly, setShowBasicOnly] = useState(false);
  const [resultFilter, setResultFilter] = useState('all'); // 'all' | 'unsolved' | 'failed'

  // 統計
  const [myResults, setMyResults] = useState({});

  useEffect(() => {
    const trial = sessionStorage.getItem('trial_mode') === 'true';
    if (user) {
      sessionStorage.removeItem('trial_mode');
      setIsTrialMode(false);
    } else {
      setIsTrialMode(trial);
    }
    if (!loading && !user && !trial) {
      router.push('/');
      return;
    }
    if (trial && !user) {
      fetchCases();
    }
  }, [user, loading, router]);

  useEffect(() => {
    const trial = sessionStorage.getItem('trial_mode') === 'true';
    if (user && !trial) {
      fetchCases();
      fetchMyResults();
    }
  }, [user]);

  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState === 'visible' && user) {
        fetchMyResults();
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, [user]);

  useEffect(() => {
    applyFilter();
  }, [cases, searchText, selectedDifficulty, selectedCategory, sortOrder, showBasicOnly, resultFilter, myResults]);

  const fetchCases = async () => {
    setLoadingCases(true);
    const { data, error } = await supabase
      .from('cases')
      .select('*')
      .order('case_number', { ascending: true });
    if (error) {
      setError('症例の読み込みに失敗しました');
    } else {
      setCases(data || []);
    }
    setLoadingCases(false);
  };

  const fetchMyResults = async () => {
    if (!user) return;
    const { data } = await supabase
      .from('results')
      .select('case_id, score, passed, created_at')
      .eq('user_id', user.id);
    if (data) {
      const resultMap = {};
      data.forEach(r => {
        if (!resultMap[r.case_id]) {
          resultMap[r.case_id] = r;
        } else {
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

    // 救急基本症例集フィルター
    if (showBasicOnly) {
      filtered = filtered.filter(c => c.is_basic === true);
    }

    // テキスト検索
    if (searchText) {
      filtered = filtered.filter(c =>
        c.title?.includes(searchText) ||
        c.chief_complaint?.includes(searchText) ||
        c.category?.includes(searchText) ||
        String(c.case_number).includes(searchText)
      );
    }

    // 難易度フィルター
    if (selectedDifficulty !== 'all') {
      filtered = filtered.filter(c => c.difficulty === selectedDifficulty);
    }

    // カテゴリフィルター
    if (selectedCategory !== 'all') {
      filtered = filtered.filter(c => c.category === selectedCategory);
    }

    // 回答状況フィルター
    if (resultFilter === 'unsolved') {
      filtered = filtered.filter(c => !myResults[c.id]);
    } else if (resultFilter === 'failed') {
      filtered = filtered.filter(c => myResults[c.id] && !myResults[c.id].passed);
    }

    // ソート
    if (sortOrder === 'number') {
      filtered.sort((a, b) => (a.case_number || 9999) - (b.case_number || 9999));
    } else if (sortOrder === 'newest') {
      filtered.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    } else if (sortOrder === 'difficulty_asc') {
      const order = { easy: 1, medium: 2, hard: 3 };
      filtered.sort((a, b) => (order[a.difficulty] || 2) - (order[b.difficulty] || 2));
    } else if (sortOrder === 'title') {
      filtered.sort((a, b) => a.title.localeCompare(b.title, 'ja'));
    }

    setFilteredCases(filtered);
  };

  const formatNumber = (n) => {
    if (!n) return '—';
    return '#' + String(n).padStart(3, '0');
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

  const handleRandomFailed = () => {
    const failed = filteredCases.filter(c => myResults[c.id] && !myResults[c.id].passed);
    if (failed.length === 0) {
      alert('不合格の症例はありません！');
      return;
    }
    const diffOrder = { easy: 1, medium: 2, hard: 3 };
    const minDiff = Math.min(...failed.map(c => diffOrder[c.difficulty] || 2));
    const easiest = failed.filter(c => (diffOrder[c.difficulty] || 2) === minDiff);
    const randomCase = easiest[Math.floor(Math.random() * easiest.length)];
    router.push(`/cases/${randomCase.id}`);
  };

  const getDifficultyLabel = (d) => ({ easy: '易', medium: '中', hard: '難' }[d] || '中');
  const getDifficultyColor = (d) => ({
    easy: 'bg-green-100 text-green-700',
    medium: 'bg-yellow-100 text-yellow-700',
    hard: 'bg-red-100 text-red-700',
  }[d] || 'bg-gray-100 text-gray-600');

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
        再挑戦 {result.score}点
      </span>
    );
  };

  const basicCount = cases.filter(c => c.is_basic).length;
  const solvedCount = Object.keys(myResults).length;
  const passedCount = Object.values(myResults).filter(r => r.passed).length;
  const failedCount = Object.values(myResults).filter(r => !r.passed).length;
  const unsolvedCount = cases.length - solvedCount;

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
          <button onClick={() => router.push('/')} className="text-blue-600 hover:text-blue-800 text-sm">
            ← トップへ
          </button>
          <h1 className="text-lg font-bold text-gray-800">症例一覧</h1>
          <div className="text-sm text-gray-500">
            {isTrialMode ? 'お試しモード' : `${solvedCount} / ${cases.length}問`}
          </div>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-4 py-6">
        {/* 成績サマリー */}
        {!isTrialMode && (
          <div className="bg-white rounded-xl shadow-sm p-4 mb-5">
            <div className="grid grid-cols-4 gap-2 text-center">
              <div className="py-2">
                <p className="text-lg font-black text-blue-600">{cases.length}</p>
                <p className="text-xs text-gray-400">総症例数</p>
              </div>
              <div className="py-2 border-l border-gray-100">
                <p className="text-lg font-black text-green-600">{passedCount}</p>
                <p className="text-xs text-gray-400">合格</p>
              </div>
              <div className="py-2 border-l border-gray-100">
                <p className="text-lg font-black text-orange-500">{failedCount}</p>
                <p className="text-xs text-gray-400">不合格</p>
              </div>
              <div className="py-2 border-l border-gray-100">
                <p className="text-lg font-black text-gray-400">{unsolvedCount}</p>
                <p className="text-xs text-gray-400">未回答</p>
              </div>
            </div>
          </div>
        )}

        {/* ランダム選択ボタン */}
        <div className="grid grid-cols-2 gap-3 mb-5">
          <button onClick={handleRandomSelect} disabled={filteredCases.length === 0}
            className="bg-blue-600 text-white py-3 rounded-xl font-bold text-sm hover:bg-blue-700 disabled:opacity-40 transition">
            🎲 ランダムに挑戦
          </button>
          <button onClick={handleRandomUnsolved} disabled={filteredCases.length === 0 || isTrialMode}
            className="bg-indigo-600 text-white py-3 rounded-xl font-bold text-sm hover:bg-indigo-700 disabled:opacity-40 transition">
            🌟 未解答からランダム
          </button>
          <button onClick={handleRandomFailed} disabled={filteredCases.length === 0 || isTrialMode}
            className="col-span-2 bg-orange-500 text-white py-3 rounded-xl font-bold text-sm hover:bg-orange-600 disabled:opacity-40 transition">
            🔁 不合格からランダム
          </button>
        </div>

        {/* フィルターパネル */}
        <div className="bg-white rounded-xl shadow-sm p-4 mb-4 space-y-3">

          {/* 検索 */}
          <input
            type="text"
            placeholder="症例名・主訴・番号で検索..."
            value={searchText}
            onChange={e => setSearchText(e.target.value)}
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
          />

          {/* 救急基本症例集 */}
          <div>
            <p className="text-xs text-gray-400 font-medium mb-1.5">カテゴリ</p>
            <div className="flex gap-2 flex-wrap">
              <button
                onClick={() => { setShowBasicOnly(false); setSelectedCategory('all'); }}
                className={`px-3 py-1.5 rounded-full text-xs font-medium transition ${
                  !showBasicOnly && selectedCategory === 'all'
                    ? 'bg-blue-600 text-white'
                    : 'bg-white text-gray-600 border border-gray-200'
                }`}
              >
                すべて
              </button>
              <button
                onClick={() => { setShowBasicOnly(true); setSelectedCategory('all'); }}
                className={`px-3 py-1.5 rounded-full text-xs font-medium transition ${
                  showBasicOnly
                    ? 'bg-red-600 text-white'
                    : 'bg-white text-red-600 border border-red-300'
                }`}
              >
                🚨 救急基本症例集{basicCount > 0 ? `（${basicCount}）` : ''}
              </button>
            </div>
          </div>

          {/* 回答状況フィルター */}
          {!isTrialMode && (
            <div>
              <p className="text-xs text-gray-400 font-medium mb-1.5">回答状況</p>
              <div className="flex gap-2 flex-wrap">
                <button
                  onClick={() => setResultFilter('all')}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium transition ${
                    resultFilter === 'all'
                      ? 'bg-gray-700 text-white'
                      : 'bg-white text-gray-600 border border-gray-200'
                  }`}
                >
                  すべて
                </button>
                <button
                  onClick={() => setResultFilter('unsolved')}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium transition ${
                    resultFilter === 'unsolved'
                      ? 'bg-gray-500 text-white'
                      : 'bg-white text-gray-500 border border-gray-300'
                  }`}
                >
                  未回答（{unsolvedCount}）
                </button>
                <button
                  onClick={() => setResultFilter('failed')}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium transition ${
                    resultFilter === 'failed'
                      ? 'bg-orange-500 text-white'
                      : 'bg-white text-orange-500 border border-orange-300'
                  }`}
                >
                  不合格（{failedCount}）
                </button>
              </div>
            </div>
          )}

          {/* 難易度・ソート */}
          <div>
            <p className="text-xs text-gray-400 font-medium mb-1.5">難易度・並び順</p>
            <div className="flex gap-2 flex-wrap">
              <select value={selectedDifficulty} onChange={e => setSelectedDifficulty(e.target.value)}
                className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300">
                <option value="all">難易度：すべて</option>
                <option value="easy">易しい</option>
                <option value="medium">普通</option>
                <option value="hard">難しい</option>
              </select>
              <select value={sortOrder} onChange={e => setSortOrder(e.target.value)}
                className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300">
                <option value="number">番号順</option>
                <option value="newest">新しい順</option>
                <option value="difficulty_asc">難易度順</option>
                <option value="title">タイトル順</option>
              </select>
            </div>
          </div>

          {/* 件数表示 + フィルタークリアボタン */}
          <div className="flex items-center justify-between pt-1">
            <p className="text-xs text-gray-400">{filteredCases.length}件表示</p>
            {(showBasicOnly || resultFilter !== 'all' || selectedDifficulty !== 'all' || searchText) && (
              <button
                onClick={() => {
                  setShowBasicOnly(false);
                  setResultFilter('all');
                  setSelectedDifficulty('all');
                  setSelectedCategory('all');
                  setSearchText('');
                  setSortOrder('number');
                }}
                className="text-xs text-blue-500 hover:text-blue-700 underline"
              >
                フィルターをリセット
              </button>
            )}
          </div>
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
                    <span className="text-xs font-mono font-bold text-gray-400 bg-gray-100 px-2 py-0.5 rounded">
                      {formatNumber(c.case_number)}
                    </span>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-bold ${getDifficultyColor(c.difficulty)}`}>
                      {getDifficultyLabel(c.difficulty)}
                    </span>
                    {c.is_basic && (
                      <span className="text-xs px-2 py-0.5 rounded-full font-bold bg-red-100 text-red-700">
                        🚨 基本
                      </span>
                    )}
                    {getScoreBadge(c.id)}
                    {!myResults[c.id] && !isTrialMode && (
                      <span className="text-xs px-2 py-0.5 rounded-full font-bold bg-gray-100 text-gray-400">
                        未回答
                      </span>
                    )}
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
              {(resultFilter !== 'all' || selectedDifficulty !== 'all' || showBasicOnly || searchText) && (
                <button
                  onClick={() => {
                    setShowBasicOnly(false);
                    setResultFilter('all');
                    setSelectedDifficulty('all');
                    setSelectedCategory('all');
                    setSearchText('');
                    setSortOrder('number');
                  }}
                  className="mt-3 text-sm text-blue-500 hover:text-blue-700 underline"
                >
                  フィルターをリセットする
                </button>
              )}
            </div>
          )}
        </div>
        <div className="h-4"></div>
      </div>
    </div>
  );
}
