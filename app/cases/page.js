'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../lib/auth-context';
import { supabase } from '../lib/supabase';
import { DOMAINS, getDomain } from '../lib/domains';

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
  const [selectedDomains, setSelectedDomains] = useState([...DOMAINS]); // 初期は全領域チェック

  // 絞り込み条件の保存/復元制御
  const [prefsLoaded, setPrefsLoaded] = useState(false);

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
  }, [cases, searchText, selectedDifficulty, selectedCategory, sortOrder, showBasicOnly, resultFilter, selectedDomains, myResults]);

  // ===== 絞り込み条件の復元（IDに紐づけてDB保存されたもの） =====
  useEffect(() => {
    if (prefsLoaded) return;
    if (loading) return; // 認証・プロフィール確定待ち
    if (isTrialMode) { setPrefsLoaded(true); return; } // お試しは保存しない
    if (!user) return;

    const p = userProfile?.case_filter_prefs;
    if (p && typeof p === 'object') {
      if (typeof p.searchText === 'string') setSearchText(p.searchText);
      if (['all', 'easy', 'medium', 'hard'].includes(p.selectedDifficulty)) setSelectedDifficulty(p.selectedDifficulty);
      if (typeof p.showBasicOnly === 'boolean') setShowBasicOnly(p.showBasicOnly);
      if (['all', 'unsolved', 'failed'].includes(p.resultFilter)) setResultFilter(p.resultFilter);
      if (Array.isArray(p.selectedDomains)) {
        const valid = p.selectedDomains.filter(d => DOMAINS.includes(d));
        setSelectedDomains(valid.length ? valid : [...DOMAINS]);
      }
      if (['number', 'newest', 'difficulty_asc', 'title'].includes(p.sortOrder)) setSortOrder(p.sortOrder);
    }
    setPrefsLoaded(true);
  }, [user, userProfile, loading, isTrialMode, prefsLoaded]);

  // ===== 絞り込み条件の保存（IDに紐づけてDBへ、変更を検知して自動保存） =====
  useEffect(() => {
    if (!prefsLoaded || !user || isTrialMode) return;
    const prefs = {
      searchText,
      selectedDifficulty,
      showBasicOnly,
      resultFilter,
      selectedDomains,
      sortOrder,
    };
    const t = setTimeout(() => {
      supabase.from('users').update({ case_filter_prefs: prefs }).eq('id', user.id);
    }, 600);
    return () => clearTimeout(t);
  }, [prefsLoaded, user, isTrialMode, searchText, selectedDifficulty, showBasicOnly, resultFilter, selectedDomains, sortOrder]);

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

  // ===== 共通フィルター述語 =====
  const matchesSearch = (c) => !searchText || (
    c.title?.includes(searchText) ||
    c.chief_complaint?.includes(searchText) ||
    c.category?.includes(searchText) ||
    String(c.case_number).includes(searchText)
  );

  const matchesResult = (c) => {
    if (resultFilter === 'unsolved') return !myResults[c.id];
    if (resultFilter === 'failed') return myResults[c.id] && !myResults[c.id].passed;
    return true;
  };

  const matchesDomain = (c) => selectedDomains.includes(getDomain(c.category));

  const applyFilter = () => {
    let filtered = cases.filter(c => {
      if (showBasicOnly && c.is_basic !== true) return false;
      if (selectedDifficulty !== 'all' && c.difficulty !== selectedDifficulty) return false;
      if (!matchesSearch(c)) return false;
      if (!matchesResult(c)) return false;
      if (!matchesDomain(c)) return false;
      return true;
    });

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

  // ===== カウント計算 =====

  // 「基本症例・難易度・検索・領域」フィルターを適用した母数（回答状況フィルターは除く）
  const baseFilteredCases = cases.filter(c => {
    if (showBasicOnly && !c.is_basic) return false;
    if (selectedDifficulty !== 'all' && c.difficulty !== selectedDifficulty) return false;
    if (!matchesSearch(c)) return false;
    if (!matchesDomain(c)) return false;
    return true;
  });

  const baseTotal = baseFilteredCases.length;
  const baseUnsolved = baseFilteredCases.filter(c => !myResults[c.id]).length;
  const baseFailed = baseFilteredCases.filter(c => myResults[c.id] && !myResults[c.id].passed).length;
  const basePassed = baseFilteredCases.filter(c => myResults[c.id] && myResults[c.id].passed).length;

  // 領域チェックボックス用の件数（領域以外のフィルターを適用した母数）
  const nonDomainFiltered = cases.filter(c => {
    if (showBasicOnly && !c.is_basic) return false;
    if (selectedDifficulty !== 'all' && c.difficulty !== selectedDifficulty) return false;
    if (!matchesSearch(c)) return false;
    if (!matchesResult(c)) return false;
    return true;
  });
  const domainCount = (d) => nonDomainFiltered.filter(c => getDomain(c.category) === d).length;

  // 全体の統計（サマリー用）
  const totalAll = cases.length;
  const passedAll = Object.values(myResults).filter(r => r.passed).length;
  const failedAll = Object.values(myResults).filter(r => !r.passed).length;
  const unsolvedAll = cases.length - Object.keys(myResults).length;
  const basicCount = cases.filter(c => c.is_basic).length;

  const allDomainsSelected = selectedDomains.length === DOMAINS.length;

  // 難易度ラベル（ボタン表示用）
  const difficultyLabel = {
    easy: '易しい',
    medium: '普通',
    hard: '難しい',
  };

  const formatNumber = (n) => {
    if (!n) return '—';
    return '#' + String(n).padStart(3, '0');
  };

  const toggleDomain = (d) => {
    setSelectedDomains(prev =>
      prev.includes(d) ? prev.filter(x => x !== d) : [...prev, d]
    );
  };
  const selectAllDomains = () => setSelectedDomains([...DOMAINS]);
  const clearDomains = () => setSelectedDomains([]);

  const handleRandomSelect = () => {
    if (filteredCases.length === 0) return;
    const randomCase = filteredCases[Math.floor(Math.random() * filteredCases.length)];
    router.push(`/cases/${randomCase.id}`);
  };

  const resetFilters = () => {
    setShowBasicOnly(false);
    setResultFilter('all');
    setSelectedDifficulty('all');
    setSelectedCategory('all');
    setSearchText('');
    setSortOrder('number');
    setSelectedDomains([...DOMAINS]);
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

  // フィルターが適用されているかどうか
  const isFiltered = showBasicOnly || selectedDifficulty !== 'all' || searchText || !allDomainsSelected;
  // フィルターラベル（サマリーに表示）
  const filterLabel = [
    showBasicOnly ? '救急基本症例' : null,
    selectedDifficulty !== 'all' ? difficultyLabel[selectedDifficulty] : null,
    !allDomainsSelected ? `領域${selectedDomains.length}件` : null,
  ].filter(Boolean).join(' · ');

  // フィルターが初期状態から変更されているか（リセットボタン表示用）
  const hasActiveFilter = showBasicOnly || resultFilter !== 'all' || selectedDifficulty !== 'all' || searchText || !allDomainsSelected || sortOrder !== 'number';

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
            {isTrialMode ? 'お試しモード' : `${Object.keys(myResults).length} / ${totalAll}問`}
          </div>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-4 py-6">
        {/* 成績サマリー */}
        {!isTrialMode && (
          <div className="bg-white rounded-xl shadow-sm p-4 mb-5">
            {/* フィルター適用中はフィルター後の数を表示 */}
            {isFiltered ? (
              <>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs font-bold text-blue-600">
                    🔍 {filterLabel}（{baseTotal}件）
                  </p>
                  <p className="text-xs text-gray-400">全体: {totalAll}問</p>
                </div>
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div className="py-2 bg-green-50 rounded-lg">
                    <p className="text-lg font-black text-green-600">{basePassed}</p>
                    <p className="text-xs text-gray-500">合格</p>
                  </div>
                  <div className="py-2 bg-orange-50 rounded-lg">
                    <p className="text-lg font-black text-orange-500">{baseFailed}</p>
                    <p className="text-xs text-gray-500">不合格</p>
                  </div>
                  <div className="py-2 bg-gray-50 rounded-lg">
                    <p className="text-lg font-black text-gray-400">{baseUnsolved}</p>
                    <p className="text-xs text-gray-500">未回答</p>
                  </div>
                </div>
              </>
            ) : (
              <div className="grid grid-cols-4 gap-2 text-center">
                <div className="py-2">
                  <p className="text-lg font-black text-blue-600">{totalAll}</p>
                  <p className="text-xs text-gray-400">総症例数</p>
                </div>
                <div className="py-2 border-l border-gray-100">
                  <p className="text-lg font-black text-green-600">{passedAll}</p>
                  <p className="text-xs text-gray-400">合格</p>
                </div>
                <div className="py-2 border-l border-gray-100">
                  <p className="text-lg font-black text-orange-500">{failedAll}</p>
                  <p className="text-xs text-gray-400">不合格</p>
                </div>
                <div className="py-2 border-l border-gray-100">
                  <p className="text-lg font-black text-gray-400">{unsolvedAll}</p>
                  <p className="text-xs text-gray-400">未回答</p>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ランダム選択ボタン（以下の絞り込み条件で抽出された症例から選択） */}
        <div className="mb-5">
          <button
            onClick={handleRandomSelect}
            disabled={filteredCases.length === 0}
            className={`w-full py-3.5 rounded-xl font-bold text-sm transition ${
              filteredCases.length === 0
                ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                : 'bg-blue-600 text-white hover:bg-blue-700'
            }`}
          >
            {filteredCases.length === 0
              ? '😶 該当する症例がありません'
              : `🎲 ランダムに挑戦（以下の条件で絞り込み・${filteredCases.length}件）`}
          </button>
        </div>

        {/* フィルターパネル */}
        <div className="bg-white rounded-xl shadow-sm p-4 mb-4 space-y-3">

          {/* 検索（自由記入欄） */}
          <input
            type="text"
            placeholder="症例名・主訴・番号で検索..."
            value={searchText}
            onChange={e => setSearchText(e.target.value)}
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
          />

          {/* カテゴリ（救急基本症例集） */}
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
                すべて（{totalAll}）
              </button>
              <button
                onClick={() => { setShowBasicOnly(true); setSelectedCategory('all'); }}
                className={`px-3 py-1.5 rounded-full text-xs font-medium transition ${
                  showBasicOnly
                    ? 'bg-red-600 text-white'
                    : 'bg-white text-red-600 border border-red-300'
                }`}
              >
                🚨 救急基本症例集（{basicCount}）
              </button>
            </div>
          </div>

          {/* 難易度フィルター */}
          <div>
            <p className="text-xs text-gray-400 font-medium mb-1.5">難易度</p>
            <div className="flex gap-2 flex-wrap">
              {[
                { value: 'all', label: 'すべて' },
                { value: 'easy', label: '易しい' },
                { value: 'medium', label: '普通' },
                { value: 'hard', label: '難しい' },
              ].map(opt => {
                // 各難易度での件数を計算（基本症例フィルターは考慮）
                const count = cases.filter(c => {
                  if (showBasicOnly && !c.is_basic) return false;
                  if (opt.value !== 'all' && c.difficulty !== opt.value) return false;
                  return true;
                }).length;
                return (
                  <button
                    key={opt.value}
                    onClick={() => setSelectedDifficulty(opt.value)}
                    className={`px-3 py-1.5 rounded-full text-xs font-medium transition ${
                      selectedDifficulty === opt.value
                        ? opt.value === 'easy' ? 'bg-green-600 text-white'
                          : opt.value === 'medium' ? 'bg-yellow-500 text-white'
                          : opt.value === 'hard' ? 'bg-red-600 text-white'
                          : 'bg-gray-700 text-white'
                        : opt.value === 'easy' ? 'bg-white text-green-700 border border-green-300'
                          : opt.value === 'medium' ? 'bg-white text-yellow-700 border border-yellow-300'
                          : opt.value === 'hard' ? 'bg-white text-red-700 border border-red-300'
                          : 'bg-white text-gray-600 border border-gray-200'
                    }`}
                  >
                    {opt.label}（{count}）
                  </button>
                );
              })}
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
                  すべて（{baseTotal}）
                </button>
                <button
                  onClick={() => setResultFilter('unsolved')}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium transition ${
                    resultFilter === 'unsolved'
                      ? 'bg-gray-500 text-white'
                      : 'bg-white text-gray-500 border border-gray-300'
                  }`}
                >
                  未回答（{baseUnsolved}）
                </button>
                <button
                  onClick={() => setResultFilter('failed')}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium transition ${
                    resultFilter === 'failed'
                      ? 'bg-orange-500 text-white'
                      : 'bg-white text-orange-500 border border-orange-300'
                  }`}
                >
                  不合格（{baseFailed}）
                </button>
              </div>
              {/* フィルター説明 */}
              {isFiltered && (
                <p className="text-xs text-blue-500 mt-1">
                  ※ {filterLabel}（{baseTotal}件）を母数としたカウントです
                </p>
              )}
            </div>
          )}

          {/* 領域フィルター（複数選択チェックボックス） */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <p className="text-xs text-gray-400 font-medium">
                領域（{selectedDomains.length}/{DOMAINS.length}）
              </p>
              <div className="flex gap-2">
                <button
                  onClick={selectAllDomains}
                  disabled={allDomainsSelected}
                  className="text-xs text-blue-500 hover:text-blue-700 disabled:text-gray-300 disabled:cursor-default underline"
                >
                  すべて選択
                </button>
                <button
                  onClick={clearDomains}
                  disabled={selectedDomains.length === 0}
                  className="text-xs text-gray-400 hover:text-gray-600 disabled:text-gray-200 disabled:cursor-default underline"
                >
                  クリア
                </button>
              </div>
            </div>
            <div className="flex gap-2 flex-wrap">
              {DOMAINS.map(d => {
                const checked = selectedDomains.includes(d);
                const count = domainCount(d);
                return (
                  <button
                    key={d}
                    onClick={() => toggleDomain(d)}
                    className={`px-3 py-1.5 rounded-full text-xs font-medium transition border ${
                      checked
                        ? 'bg-blue-600 text-white border-blue-600'
                        : 'bg-white text-gray-500 border-gray-200'
                    }`}
                  >
                    <span className="mr-1">{checked ? '☑' : '☐'}</span>
                    {d}（{count}）
                  </button>
                );
              })}
            </div>
          </div>

          {/* ソート */}
          <div>
            <p className="text-xs text-gray-400 font-medium mb-1.5">並び順</p>
            <select value={sortOrder} onChange={e => setSortOrder(e.target.value)}
              className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300">
              <option value="number">番号順</option>
              <option value="newest">新しい順</option>
              <option value="difficulty_asc">難易度順</option>
              <option value="title">タイトル順</option>
            </select>
          </div>

          {/* 件数表示 + フィルタークリア */}
          <div className="flex items-center justify-between pt-1">
            <p className="text-xs text-gray-400">{filteredCases.length}件表示</p>
            {hasActiveFilter && (
              <button
                onClick={resetFilters}
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
              {hasActiveFilter && (
                <button
                  onClick={resetFilters}
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
