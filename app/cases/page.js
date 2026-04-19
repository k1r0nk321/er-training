'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useAuth } from '../../lib/auth-context';
import { supabase } from '../../lib/supabase';

// 採点のフェーズ定義
// phase: 'info' → 'differential' → 'workup' → 'diagnosis' → 'result'

export default function CaseDetailPage() {
  const { user, userProfile, loading } = useAuth();
  const router = useRouter();
  const params = useParams();
  const caseId = params.id;

  const [caseData, setCaseData] = useState(null);
  const [loadingCase, setLoadingCase] = useState(true);
  const [error, setError] = useState('');
  const [phase, setPhase] = useState('info'); // 'info' | 'differential' | 'workup' | 'diagnosis' | 'result'

  // 鑑別診断（段階的入力）
  const [differentials, setDifferentials] = useState(['', '', '', '', '']); // 最大5つ
  const [aiAnalysis, setAiAnalysis] = useState(''); // AI中間フィードバック
  const [analysisDone, setAnalysisDone] = useState(false);

  // 精査計画
  const [workupPlan, setWorkupPlan] = useState('');

  // 最終診断
  const [finalDiagnosis, setFinalDiagnosis] = useState('');

  // 採点結果
  const [scoreResult, setScoreResult] = useState(null);
  const [scoringLoading, setScoringLoading] = useState(false);

  // 前回成績
  const [prevResults, setPrevResults] = useState([]);

  const streamRef = useRef(null);

  useEffect(() => {
    if (!loading && !user) router.push('/');
  }, [user, loading, router]);

  useEffect(() => {
    if (user && caseId) {
      fetchCase();
      fetchPrevResults();
    }
  }, [user, caseId]);

  const fetchCase = async () => {
    setLoadingCase(true);
    const { data, error } = await supabase
      .from('cases')
      .select('*')
      .eq('id', caseId)
      .single();

    if (error || !data) {
      setError('症例が見つかりません');
    } else {
      setCaseData(data);
    }
    setLoadingCase(false);
  };

  const fetchPrevResults = async () => {
    if (!user) return;
    const { data } = await supabase
      .from('results')
      .select('*')
      .eq('user_id', user.id)
      .eq('case_id', caseId)
      .order('created_at', { ascending: false })
      .limit(3);
    if (data) setPrevResults(data);
  };

  // ---- 鑑別診断の入力更新 ----
  const updateDifferential = (idx, val) => {
    const newList = [...differentials];
    newList[idx] = val;
    setDifferentials(newList);
  };

  const validDifferentials = differentials.filter(d => d.trim() !== '');

  // ---- AI中間フィードバック（鑑別診断チェック）----
  const handleAnalyzeDifferentials = async () => {
    if (validDifferentials.length === 0) {
      alert('鑑別診断を1つ以上入力してください');
      return;
    }
    setAiAnalysis('');
    setAnalysisDone(false);

    const prompt = `あなたは救急・ERの指導医です。研修医が提出した鑑別診断リストを評価してください。

【症例情報】
${caseData.chief_complaint ? `主訴：${caseData.chief_complaint}` : ''}
${caseData.history ? `現病歴：${caseData.history}` : ''}
${caseData.vital_signs ? `バイタル：${caseData.vital_signs}` : ''}
${caseData.physical_exam ? `身体所見：${caseData.physical_exam}` : ''}

【研修医が挙げた鑑別診断】
${validDifferentials.map((d, i) => `${i + 1}. ${d}`).join('\n')}

以下の点について、簡潔に（200字以内）フィードバックしてください：
- 挙げられた鑑別の妥当性（良い点）
- 見落としていると思われる重要な鑑別（もしあれば1〜2つ）
- 次のステップ（精査計画）へのヒント

採点はまだしないでください。教育的なフィードバックのみお願いします。`;

    try {
      const response = await fetch('/api/score', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt, stream: false }),
      });
      const data = await response.json();
      setAiAnalysis(data.text || data.content || '');
      setAnalysisDone(true);
    } catch (e) {
      setAiAnalysis('フィードバックの取得に失敗しました。そのまま次へ進んでください。');
      setAnalysisDone(true);
    }
  };

  // ---- 最終採点 ----
  const handleFinalScore = async () => {
    if (!finalDiagnosis.trim()) {
      alert('最終診断を入力してください');
      return;
    }
    setScoringLoading(true);
    setScoreResult(null);

    const prompt = `あなたは救急・ERの指導医です。研修医の症例対応を100点満点で採点してください。

【症例情報】
タイトル：${caseData.title}
主訴：${caseData.chief_complaint || ''}
現病歴：${caseData.history || ''}
バイタル：${caseData.vital_signs || ''}
身体所見：${caseData.physical_exam || ''}
正解の診断：${caseData.answer_diagnosis || '（非公開）'}
採点基準：${caseData.scoring_criteria || '総合的に判断'}

【研修医の回答】
鑑別診断リスト：
${validDifferentials.map((d, i) => `${i + 1}. ${d}`).join('\n')}

精査計画：
${workupPlan || '（未記入）'}

最終診断：
${finalDiagnosis}

以下のJSON形式のみで返答してください。マークダウン記号（\`\`\`）は使わないこと：
{
  "score": 85,
  "passed": true,
  "breakdown": {
    "differential": 30,
    "workup": 25,
    "final_diagnosis": 30
  },
  "comment": "全体的なフィードバックを200字以内で",
  "good_points": "よかった点を1〜2文で",
  "improvement": "改善点を1〜2文で",
  "teaching_point": "この症例の重要な教訓を1文で"
}`;

    try {
      const response = await fetch('/api/score', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt, stream: false }),
      });
      const data = await response.json();
      const text = (data.text || data.content || '').replace(/```json|```/g, '').trim();
      const parsed = JSON.parse(text);
      setScoreResult(parsed);
      setPhase('result');

      // Supabaseに保存
      await supabase.from('results').insert({
        user_id: user.id,
        case_id: caseId,
        differentials: validDifferentials,
        workup_plan: workupPlan,
        final_diagnosis: finalDiagnosis,
        score: parsed.score,
        passed: parsed.passed,
        feedback: parsed,
        created_at: new Date().toISOString(),
      });

      fetchPrevResults();
    } catch (e) {
      console.error(e);
      alert('採点に失敗しました。もう一度お試しください。');
    }

    setScoringLoading(false);
  };

  const getDifficultyLabel = (d) => ({ easy: '易', medium: '中', hard: '難' }[d] || '中');
  const getDifficultyColor = (d) => ({
    easy: 'bg-green-100 text-green-700',
    medium: 'bg-yellow-100 text-yellow-700',
    hard: 'bg-red-100 text-red-700',
  }[d] || 'bg-gray-100 text-gray-600');

  // ---- ローディング ----
  if (loading || loadingCase) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-3"></div>
          <p className="text-gray-500">症例を読み込んでいます...</p>
        </div>
      </div>
    );
  }

  if (error || !caseData) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <p className="text-4xl mb-3">⚠️</p>
          <p className="text-gray-600">{error || '症例が見つかりません'}</p>
          <button onClick={() => router.push('/cases')} className="mt-4 text-blue-600 underline">
            症例一覧へ戻る
          </button>
        </div>
      </div>
    );
  }

  // =====================
  // フェーズ：結果表示
  // =====================
  if (phase === 'result' && scoreResult) {
    const score = scoreResult.score;
    const passed = scoreResult.passed;
    return (
      <div className="min-h-screen bg-gray-50">
        <header className="bg-white shadow-sm sticky top-0 z-10">
          <div className="max-w-2xl mx-auto px-4 py-3 flex items-center justify-between">
            <button onClick={() => router.push('/cases')} className="text-blue-600 text-sm">← 症例一覧</button>
            <h1 className="text-lg font-bold text-gray-800">採点結果</h1>
            <div></div>
          </div>
        </header>
        <div className="max-w-2xl mx-auto px-4 py-6 space-y-5">

          {/* スコアカード */}
          <div className={`rounded-2xl p-6 text-center ${passed ? 'bg-blue-600' : 'bg-gray-500'} text-white shadow-lg`}>
            <div className="text-6xl font-black mb-1">{score}</div>
            <div className="text-xl font-bold mb-2">点</div>
            <div className={`inline-block px-4 py-1 rounded-full text-sm font-bold ${passed ? 'bg-white text-blue-600' : 'bg-white text-gray-600'}`}>
              {passed ? '✅ 合格（80点以上）' : '❌ 不合格（再挑戦を推奨）'}
            </div>
          </div>

          {/* 内訳 */}
          {scoreResult.breakdown && (
            <div className="bg-white rounded-xl shadow-sm p-4">
              <h3 className="font-bold text-gray-700 mb-3">採点内訳</h3>
              <div className="space-y-2">
                {[
                  { label: '鑑別診断', key: 'differential', max: 30 },
                  { label: '精査計画', key: 'workup', max: 25 },
                  { label: '最終診断', key: 'final_diagnosis', max: 30 },
                ].map(item => (
                  <div key={item.key} className="flex items-center gap-3">
                    <span className="text-sm text-gray-600 w-24">{item.label}</span>
                    <div className="flex-1 bg-gray-100 rounded-full h-3">
                      <div
                        className="bg-blue-500 h-3 rounded-full transition-all"
                        style={{ width: `${(scoreResult.breakdown[item.key] / item.max) * 100}%` }}
                      ></div>
                    </div>
                    <span className="text-sm font-bold text-gray-700 w-16 text-right">
                      {scoreResult.breakdown[item.key]} / {item.max}点
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* AIフィードバック */}
          <div className="bg-white rounded-xl shadow-sm p-4 space-y-3">
            <h3 className="font-bold text-gray-700">AIフィードバック</h3>
            {scoreResult.comment && (
              <div className="text-sm text-gray-700 bg-gray-50 rounded-lg p-3">{scoreResult.comment}</div>
            )}
            {scoreResult.good_points && (
              <div>
                <span className="text-xs font-bold text-green-600">✓ 良かった点</span>
                <p className="text-sm text-gray-700 mt-1">{scoreResult.good_points}</p>
              </div>
            )}
            {scoreResult.improvement && (
              <div>
                <span className="text-xs font-bold text-orange-500">△ 改善点</span>
                <p className="text-sm text-gray-700 mt-1">{scoreResult.improvement}</p>
              </div>
            )}
            {scoreResult.teaching_point && (
              <div className="bg-blue-50 rounded-lg p-3">
                <span className="text-xs font-bold text-blue-600">📌 Teaching Point</span>
                <p className="text-sm text-blue-800 mt-1 font-medium">{scoreResult.teaching_point}</p>
              </div>
            )}
          </div>

          {/* あなたの回答 */}
          <div className="bg-white rounded-xl shadow-sm p-4 space-y-3">
            <h3 className="font-bold text-gray-700">あなたの回答</h3>
            <div>
              <span className="text-xs text-gray-400">鑑別診断</span>
              <div className="flex flex-wrap gap-1 mt-1">
                {validDifferentials.map((d, i) => (
                  <span key={i} className="text-xs bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full">{d}</span>
                ))}
              </div>
            </div>
            {workupPlan && (
              <div>
                <span className="text-xs text-gray-400">精査計画</span>
                <p className="text-sm text-gray-700 mt-1 whitespace-pre-wrap">{workupPlan}</p>
              </div>
            )}
            <div>
              <span className="text-xs text-gray-400">最終診断</span>
              <p className="text-sm font-bold text-gray-800 mt-1">{finalDiagnosis}</p>
            </div>
          </div>

          {/* 過去の成績 */}
          {prevResults.length > 1 && (
            <div className="bg-white rounded-xl shadow-sm p-4">
              <h3 className="font-bold text-gray-700 mb-2">この症例の挑戦歴</h3>
              {prevResults.map((r, i) => (
                <div key={r.id} className="flex justify-between items-center text-sm py-1 border-b last:border-0">
                  <span className="text-gray-500">{new Date(r.created_at).toLocaleDateString('ja-JP')}</span>
                  <span className={`font-bold ${r.passed ? 'text-blue-600' : 'text-gray-500'}`}>
                    {r.score}点 {r.passed ? '✓' : ''}
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* アクション */}
          <div className="flex gap-3 pb-6">
            <button
              onClick={() => {
                setPhase('info');
                setDifferentials(['', '', '', '', '']);
                setWorkupPlan('');
                setFinalDiagnosis('');
                setAiAnalysis('');
                setAnalysisDone(false);
                setScoreResult(null);
              }}
              className="flex-1 border border-blue-600 text-blue-600 py-3 rounded-xl font-bold text-sm hover:bg-blue-50 transition"
            >
              🔄 再挑戦
            </button>
            <button
              onClick={() => router.push('/cases')}
              className="flex-1 bg-blue-600 text-white py-3 rounded-xl font-bold text-sm hover:bg-blue-700 transition"
            >
              📋 症例一覧へ
            </button>
          </div>
        </div>
      </div>
    );
  }

  // =====================
  // メイン：症例表示
  // =====================
  return (
    <div className="min-h-screen bg-gray-50">
      {/* ヘッダー */}
      <header className="bg-white shadow-sm sticky top-0 z-10">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center justify-between">
          <button onClick={() => router.push('/cases')} className="text-blue-600 text-sm">← 一覧へ</button>
          <div className="flex items-center gap-2">
            <span className={`text-xs px-2 py-0.5 rounded-full font-bold ${getDifficultyColor(caseData.difficulty)}`}>
              {getDifficultyLabel(caseData.difficulty)}
            </span>
          </div>
        </div>
      </header>

      {/* プログレスバー */}
      <div className="bg-white border-b">
        <div className="max-w-2xl mx-auto px-4 py-2">
          <div className="flex items-center gap-2">
            {['症例確認', '鑑別診断', '精査計画', '最終診断'].map((label, i) => {
              const phaseOrder = ['info', 'differential', 'workup', 'diagnosis'];
              const currentIdx = phaseOrder.indexOf(phase);
              const isActive = i === currentIdx;
              const isDone = i < currentIdx;
              return (
                <div key={i} className="flex items-center gap-1 flex-1">
                  <div className={`w-full text-center text-xs py-1 rounded font-medium transition ${isActive ? 'bg-blue-600 text-white' : isDone ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-400'}`}>
                    {isDone ? '✓ ' : ''}{label}
                  </div>
                  {i < 3 && <span className="text-gray-300 text-xs">›</span>}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-5 space-y-4">

        {/* 症例タイトル */}
        <div>
          <h1 className="text-xl font-black text-gray-900">{caseData.title}</h1>
          {caseData.category && <span className="text-xs text-gray-400">{caseData.category}</span>}
        </div>

        {/* ==== フェーズ：症例情報 ==== */}
        {phase === 'info' && (
          <>
            {/* バイタル */}
            {caseData.vital_signs && (
              <div className="bg-red-50 border border-red-100 rounded-xl p-4">
                <h3 className="font-bold text-red-700 text-sm mb-2">🩺 バイタルサイン</h3>
                <p className="text-sm text-red-800 whitespace-pre-wrap">{caseData.vital_signs}</p>
              </div>
            )}

            {/* 主訴・現病歴 */}
            {(caseData.chief_complaint || caseData.history) && (
              <div className="bg-white rounded-xl shadow-sm p-4 space-y-3">
                {caseData.chief_complaint && (
                  <div>
                    <h3 className="font-bold text-gray-700 text-sm mb-1">主訴</h3>
                    <p className="text-sm text-gray-800">{caseData.chief_complaint}</p>
                  </div>
                )}
                {caseData.history && (
                  <div>
                    <h3 className="font-bold text-gray-700 text-sm mb-1">現病歴</h3>
                    <p className="text-sm text-gray-800 whitespace-pre-wrap">{caseData.history}</p>
                  </div>
                )}
              </div>
            )}

            {/* 身体所見 */}
            {caseData.physical_exam && (
              <div className="bg-white rounded-xl shadow-sm p-4">
                <h3 className="font-bold text-gray-700 text-sm mb-2">身体所見</h3>
                <p className="text-sm text-gray-800 whitespace-pre-wrap">{caseData.physical_exam}</p>
              </div>
            )}

            {/* 検査所見（最初に提示する分） */}
            {caseData.initial_labs && (
              <div className="bg-white rounded-xl shadow-sm p-4">
                <h3 className="font-bold text-gray-700 text-sm mb-2">初期検査所見</h3>
                <p className="text-sm text-gray-800 whitespace-pre-wrap">{caseData.initial_labs}</p>
              </div>
            )}

            {/* 前回成績 */}
            {prevResults.length > 0 && (
              <div className="bg-yellow-50 border border-yellow-100 rounded-xl p-3">
                <p className="text-xs font-bold text-yellow-700 mb-1">📊 前回の成績</p>
                {prevResults.slice(0, 2).map(r => (
                  <p key={r.id} className="text-xs text-yellow-800">
                    {new Date(r.created_at).toLocaleDateString('ja-JP')} — {r.score}点 {r.passed ? '（合格）' : ''}
                  </p>
                ))}
              </div>
            )}

            <button
              onClick={() => setPhase('differential')}
              className="w-full bg-blue-600 text-white py-4 rounded-xl font-bold text-base hover:bg-blue-700 active:bg-blue-800 transition"
            >
              鑑別診断を入力する →
            </button>
          </>
        )}

        {/* ==== フェーズ：鑑別診断 ==== */}
        {phase === 'differential' && (
          <>
            <div className="bg-blue-50 border border-blue-100 rounded-xl p-4">
              <h3 className="font-bold text-blue-700 mb-1">Step 1：鑑別診断を挙げてください</h3>
              <p className="text-xs text-blue-600">可能性のある診断名を最大5つ入力してください（優先順に）</p>
            </div>

            <div className="bg-white rounded-xl shadow-sm p-4 space-y-3">
              {differentials.map((d, i) => (
                <div key={i} className="flex items-center gap-2">
                  <span className="text-sm font-bold text-gray-400 w-5">{i + 1}</span>
                  <input
                    type="text"
                    value={d}
                    onChange={e => updateDifferential(i, e.target.value)}
                    placeholder={i === 0 ? '最も可能性が高い診断名' : `鑑別診断 ${i + 1}`}
                    className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
                  />
                </div>
              ))}
            </div>

            {/* AI中間フィードバック */}
            {!analysisDone && (
              <button
                onClick={handleAnalyzeDifferentials}
                disabled={validDifferentials.length === 0}
                className="w-full border border-blue-400 text-blue-600 py-3 rounded-xl font-bold text-sm hover:bg-blue-50 disabled:opacity-40 transition"
              >
                🤖 AIにフィードバックをもらう（任意）
              </button>
            )}

            {aiAnalysis && (
              <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-4">
                <h4 className="font-bold text-indigo-700 text-sm mb-2">🤖 AIからのフィードバック</h4>
                <p className="text-sm text-indigo-800 whitespace-pre-wrap">{aiAnalysis}</p>
              </div>
            )}

            <div className="flex gap-3">
              <button
                onClick={() => setPhase('info')}
                className="flex-1 border border-gray-300 text-gray-600 py-3 rounded-xl font-bold text-sm hover:bg-gray-50 transition"
              >
                ← 戻る
              </button>
              <button
                onClick={() => setPhase('workup')}
                disabled={validDifferentials.length === 0}
                className="flex-2 flex-grow bg-blue-600 text-white py-3 rounded-xl font-bold text-sm hover:bg-blue-700 disabled:opacity-40 transition"
              >
                精査計画へ →
              </button>
            </div>
          </>
        )}

        {/* ==== フェーズ：精査計画 ==== */}
        {phase === 'workup' && (
          <>
            <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-4">
              <h3 className="font-bold text-indigo-700 mb-1">Step 2：精査計画を立ててください</h3>
              <p className="text-xs text-indigo-600">どの検査・処置・コンサルトが必要か記入してください</p>
            </div>

            {/* 入力した鑑別の確認 */}
            <div className="bg-white rounded-xl shadow-sm p-4">
              <p className="text-xs font-bold text-gray-400 mb-2">あなたの鑑別診断</p>
              <div className="flex flex-wrap gap-1">
                {validDifferentials.map((d, i) => (
                  <span key={i} className="text-xs bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full">{d}</span>
                ))}
              </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm p-4">
              <label className="text-sm font-bold text-gray-700 mb-2 block">精査計画</label>
              <textarea
                value={workupPlan}
                onChange={e => setWorkupPlan(e.target.value)}
                placeholder="例：&#10;・12誘導心電図&#10;・血液検査（CBC, CMP, troponin, BNP）&#10;・胸部X線&#10;・心エコー&#10;・循環器内科コンサルト"
                rows={8}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300 resize-none"
              />
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setPhase('differential')}
                className="flex-1 border border-gray-300 text-gray-600 py-3 rounded-xl font-bold text-sm hover:bg-gray-50 transition"
              >
                ← 戻る
              </button>
              <button
                onClick={() => setPhase('diagnosis')}
                className="flex-grow bg-blue-600 text-white py-3 rounded-xl font-bold text-sm hover:bg-blue-700 transition"
              >
                最終診断へ →
              </button>
            </div>
          </>
        )}

        {/* ==== フェーズ：最終診断 ==== */}
        {phase === 'diagnosis' && (
          <>
            <div className="bg-green-50 border border-green-100 rounded-xl p-4">
              <h3 className="font-bold text-green-700 mb-1">Step 3：最終診断を入力してください</h3>
              <p className="text-xs text-green-600">鑑別・精査を踏まえた最終的な診断名を記入してください</p>
            </div>

            {/* これまでの回答確認 */}
            <div className="bg-white rounded-xl shadow-sm p-4 space-y-3">
              <div>
                <p className="text-xs font-bold text-gray-400">鑑別診断</p>
                <div className="flex flex-wrap gap-1 mt-1">
                  {validDifferentials.map((d, i) => (
                    <span key={i} className="text-xs bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full">{d}</span>
                  ))}
                </div>
              </div>
              {workupPlan && (
                <div>
                  <p className="text-xs font-bold text-gray-400">精査計画（概要）</p>
                  <p className="text-xs text-gray-600 line-clamp-3 mt-1">{workupPlan}</p>
                </div>
              )}
            </div>

            <div className="bg-white rounded-xl shadow-sm p-4">
              <label className="text-sm font-bold text-gray-700 mb-2 block">最終診断名</label>
              <input
                type="text"
                value={finalDiagnosis}
                onChange={e => setFinalDiagnosis(e.target.value)}
                placeholder="例：急性心筋梗塞（STEMI）"
                className="w-full border border-gray-200 rounded-lg px-3 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-green-300 text-base font-bold"
              />
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setPhase('workup')}
                className="flex-1 border border-gray-300 text-gray-600 py-3 rounded-xl font-bold text-sm hover:bg-gray-50 transition"
              >
                ← 戻る
              </button>
              <button
                onClick={handleFinalScore}
                disabled={!finalDiagnosis.trim() || scoringLoading}
                className="flex-grow bg-green-600 text-white py-3 rounded-xl font-bold text-sm hover:bg-green-700 disabled:opacity-40 transition flex items-center justify-center gap-2"
              >
                {scoringLoading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    採点中...
                  </>
                ) : '🎯 採点する'}
              </button>
            </div>
          </>
        )}

        <div className="h-4"></div>
      </div>
    </div>
  );
}
