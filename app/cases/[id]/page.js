'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useAuth } from '../../lib/auth-context';
import { supabase } from '../../lib/supabase';

// フェーズ定義
// 'info' → 'interview' → 'differential' → 'workup' → 'diagnosis' → 'result'

export default function CaseDetailPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const params = useParams();
  const caseId = params.id;

  const [caseData, setCaseData] = useState(null);
  const [loadingCase, setLoadingCase] = useState(true);
  const [error, setError] = useState('');
  const [phase, setPhase] = useState('info');

  // ===== 問診チャット =====
  const [messages, setMessages] = useState([]); // {role: 'resident'|'patient'|'system', text: string}
  const [inputText, setInputText] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const [interviewCoaching, setInterviewCoaching] = useState('');
  const [showCoaching, setShowCoaching] = useState(false);
  const [coachingLoading, setCoachingLoading] = useState(false);
  const chatBottomRef = useRef(null);

  // ===== 鑑別診断 =====
  const [differentials, setDifferentials] = useState(['', '', '', '', '']);
  const [aiAnalysis, setAiAnalysis] = useState('');
  const [analysisDone, setAnalysisDone] = useState(false);

  // ===== 精査計画 =====
  const [workupPlan, setWorkupPlan] = useState('');

  // ===== 最終診断 =====
  const [finalDiagnosis, setFinalDiagnosis] = useState('');

  // ===== 採点 =====
  const [scoreResult, setScoreResult] = useState(null);
  const [scoringLoading, setScoringLoading] = useState(false);

  // ===== 前回成績 =====
  const [prevResults, setPrevResults] = useState([]);

  useEffect(() => {
    if (!loading && !user) router.push('/');
  }, [user, loading, router]);

  useEffect(() => {
    if (user && caseId) {
      fetchCase();
      fetchPrevResults();
    }
  }, [user, caseId]);

  // チャットを最下部にスクロール
  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const fetchCase = async () => {
    setLoadingCase(true);
    const { data, error } = await supabase
      .from('cases')
      .select('*')
      .eq('id', caseId)
      .single();
    if (error || !data) setError('症例が見つかりません');
    else setCaseData(data);
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

  // ===== 問診送信 =====
  const handleSendMessage = async () => {
    if (!inputText.trim() || chatLoading) return;
    const userMsg = inputText.trim();
    setInputText('');

    const newMessages = [...messages, { role: 'resident', text: userMsg }];
    setMessages(newMessages);
    setChatLoading(true);

    const conversationHistory = newMessages.map(m =>
      `${m.role === 'resident' ? '研修医' : m.role === 'patient' ? '患者/家族' : 'システム'}：${m.text}`
    ).join('\n');

    const prompt = `あなたは救急ERに搬送された患者（または家族）の役を演じています。

【この症例の情報（演じる際の根拠。研修医には見せない）】
症例タイトル：${caseData.title}
主訴：${caseData.chief_complaint || ''}
現病歴：${caseData.history || ''}
正解の診断：${caseData.answer_diagnosis || ''}
身体所見（診察された場合のみ答える）：${caseData.physical_exam || ''}
バイタルは第1段階で提示済み。

【ルール】
- 患者または家族として自然に返答する（医学用語は使わず、一般的な言葉で）
- 研修医が診察の指示（「腹部を触らせてください」など）をした場合は所見を答える
- 症例の情報に基づいて一貫した回答をする
- 答えられない質問（検査結果など未実施のもの）は「わかりません」と答える
- 1〜3文で簡潔に返答する
- 絶対に診断名を自分から言わない

【これまでの問診の流れ】
${conversationHistory}

研修医の最新の質問/指示に対して患者/家族として返答してください：`;

    try {
      const response = await fetch('/api/score', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt }),
      });
      const data = await response.json();
      const patientReply = data.text || data.content || '（回答を取得できませんでした）';
      setMessages(prev => [...prev, { role: 'patient', text: patientReply }]);
    } catch (e) {
      setMessages(prev => [...prev, { role: 'patient', text: '（通信エラーが発生しました）' }]);
    }
    setChatLoading(false);
  };

  // ===== AIから指導コメントを取得 =====
  const handleGetCoaching = async () => {
    if (messages.length === 0) {
      alert('まず問診を行ってください');
      return;
    }
    setCoachingLoading(true);
    setShowCoaching(true);
    setInterviewCoaching('');

    const conversationHistory = messages.map(m =>
      `${m.role === 'resident' ? '研修医' : '患者/家族'}：${m.text}`
    ).join('\n');

    const prompt = `あなたは救急・ER専門の指導医です。研修医の問診内容を教育的に評価してください。

【症例】
タイトル：${caseData.title}
正解の診断：${caseData.answer_diagnosis || ''}

【研修医の問診記録】
${conversationHistory}

以下の観点で指導的コメントをしてください（合計200字以内）：
1. 問診で取れている重要な情報
2. まだ聞けていない重要な点（もしあれば）
3. この症例で特に重要な問診のポイント

採点はしないでください。教育的なフィードバックのみをお願いします。`;

    try {
      const response = await fetch('/api/score', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt }),
      });
      const data = await response.json();
      setInterviewCoaching(data.text || data.content || '');
    } catch (e) {
      setInterviewCoaching('コメントの取得に失敗しました。');
    }
    setCoachingLoading(false);
  };

  // ===== 鑑別AI中間フィードバック =====
  const handleAnalyzeDifferentials = async () => {
    if (differentials.filter(d => d.trim()).length === 0) {
      alert('鑑別診断を1つ以上入力してください');
      return;
    }
    setAiAnalysis('');
    setAnalysisDone(false);

    const interviewSummary = messages.length > 0
      ? `【問診で得られた情報】\n${messages.filter(m => m.role === 'patient').map(m => m.text).join(' / ')}`
      : '';

    const prompt = `あなたは救急・ERの指導医です。研修医の鑑別診断を評価してください。

【症例】
主訴：${caseData.chief_complaint || ''}
現病歴：${caseData.history || ''}
バイタル：${caseData.vital_signs || ''}
${interviewSummary}

【研修医の鑑別診断】
${differentials.filter(d => d.trim()).map((d, i) => `${i + 1}. ${d}`).join('\n')}

教育的なフィードバックを150字以内でお願いします（採点なし）：
- 良い点
- 見落としがあれば1〜2つ
- 次のステップへのヒント`;

    try {
      const response = await fetch('/api/score', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt }),
      });
      const data = await response.json();
      setAiAnalysis(data.text || data.content || '');
      setAnalysisDone(true);
    } catch {
      setAiAnalysis('フィードバックの取得に失敗しました。');
      setAnalysisDone(true);
    }
  };

  // ===== 最終採点 =====
  const handleFinalScore = async () => {
    if (!finalDiagnosis.trim()) {
      alert('最終診断を入力してください');
      return;
    }
    setScoringLoading(true);
    setScoreResult(null);

    const interviewRecord = messages.length > 0
      ? messages.map(m => `${m.role === 'resident' ? '研修医' : '患者/家族'}：${m.text}`).join('\n')
      : '（問診なし）';

    const prompt = `あなたは救急・ERの指導医です。研修医の症例対応を100点満点で採点してください。

【症例】
タイトル：${caseData.title}
主訴：${caseData.chief_complaint || ''}
正解の診断：${caseData.answer_diagnosis || ''}
採点基準：${caseData.scoring_criteria || '総合的に判断'}

【研修医の問診記録】
${interviewRecord}

【鑑別診断】
${differentials.filter(d => d.trim()).map((d, i) => `${i + 1}. ${d}`).join('\n') || '（未入力）'}

【精査計画】
${workupPlan || '（未記入）'}

【最終診断】
${finalDiagnosis}

以下のJSON形式のみで返答（マークダウン記号不要）：
{
  "score": 85,
  "passed": true,
  "breakdown": {
    "interview": 25,
    "differential": 25,
    "workup": 25,
    "final_diagnosis": 25
  },
  "comment": "全体的なフィードバック200字以内",
  "good_points": "よかった点1〜2文",
  "improvement": "改善点1〜2文",
  "teaching_point": "この症例の重要な教訓1文",
  "interview_feedback": "問診の質に関するフィードバック1〜2文"
}`;

    try {
      const response = await fetch('/api/score', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt }),
      });
      const data = await response.json();
      const text = (data.text || data.content || '').replace(/```json|```/g, '').trim();
      const parsed = JSON.parse(text);
      setScoreResult(parsed);
      setPhase('result');

      await supabase.from('results').insert({
        user_id: user.id,
        case_id: caseId,
        differentials: differentials.filter(d => d.trim()),
        workup_plan: workupPlan,
        final_diagnosis: finalDiagnosis,
        score: parsed.score,
        passed: parsed.passed,
        feedback: parsed,
        created_at: new Date().toISOString(),
      });
      fetchPrevResults();
    } catch (e) {
      alert('採点に失敗しました。もう一度お試しください。');
    }
    setScoringLoading(false);
  };

  const validDifferentials = differentials.filter(d => d.trim());
  const updateDifferential = (idx, val) => {
    const newList = [...differentials];
    newList[idx] = val;
    setDifferentials(newList);
  };

  const getDifficultyColor = (d) => ({
    easy: 'bg-green-100 text-green-700',
    medium: 'bg-yellow-100 text-yellow-700',
    hard: 'bg-red-100 text-red-700',
  }[d] || 'bg-gray-100 text-gray-600');

  const getDifficultyLabel = (d) => ({ easy: '易', medium: '中', hard: '難' }[d] || '中');

  // プログレスバーのフェーズ
  const phaseLabels = ['症例確認', '問診・診察', '鑑別診断', '精査計画', '最終診断'];
  const phaseOrder = ['info', 'interview', 'differential', 'workup', 'diagnosis'];
  const currentIdx = phaseOrder.indexOf(phase);

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
          <button onClick={() => router.push('/cases')} className="mt-4 text-blue-600 underline">症例一覧へ</button>
        </div>
      </div>
    );
  }

  // ===== 結果画面 =====
  if (phase === 'result' && scoreResult) {
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
          <div className={`rounded-2xl p-6 text-center shadow-lg ${scoreResult.passed ? 'bg-blue-600' : 'bg-gray-500'} text-white`}>
            <div className="text-6xl font-black mb-1">{scoreResult.score}</div>
            <div className="text-xl font-bold mb-2">点</div>
            <div className={`inline-block px-4 py-1 rounded-full text-sm font-bold ${scoreResult.passed ? 'bg-white text-blue-600' : 'bg-white text-gray-600'}`}>
              {scoreResult.passed ? '✅ 合格（80点以上）' : '❌ 不合格（再挑戦推奨）'}
            </div>
          </div>

          {/* 内訳 */}
          {scoreResult.breakdown && (
            <div className="bg-white rounded-xl shadow-sm p-4">
              <h3 className="font-bold text-gray-700 mb-3">採点内訳</h3>
              <div className="space-y-2">
                {[
                  { label: '問診・診察', key: 'interview', max: 25 },
                  { label: '鑑別診断', key: 'differential', max: 25 },
                  { label: '精査計画', key: 'workup', max: 25 },
                  { label: '最終診断', key: 'final_diagnosis', max: 25 },
                ].map(item => (
                  <div key={item.key} className="flex items-center gap-3">
                    <span className="text-sm text-gray-600 w-24">{item.label}</span>
                    <div className="flex-1 bg-gray-100 rounded-full h-3">
                      <div className="bg-blue-500 h-3 rounded-full" style={{ width: `${(scoreResult.breakdown[item.key] / item.max) * 100}%` }}></div>
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
            {scoreResult.comment && <div className="text-sm text-gray-700 bg-gray-50 rounded-lg p-3">{scoreResult.comment}</div>}
            {scoreResult.interview_feedback && (
              <div>
                <span className="text-xs font-bold text-purple-600">🗣️ 問診について</span>
                <p className="text-sm text-gray-700 mt-1">{scoreResult.interview_feedback}</p>
              </div>
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

          {/* 問診記録 */}
          {messages.length > 0 && (
            <div className="bg-white rounded-xl shadow-sm p-4">
              <h3 className="font-bold text-gray-700 mb-2">問診記録</h3>
              <div className="space-y-2 max-h-40 overflow-y-auto">
                {messages.map((m, i) => (
                  <div key={i} className={`text-xs px-3 py-1.5 rounded-lg ${m.role === 'resident' ? 'bg-blue-50 text-blue-800' : 'bg-gray-50 text-gray-700'}`}>
                    <span className="font-bold">{m.role === 'resident' ? '研修医' : '患者/家族'}：</span>{m.text}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* アクション */}
          <div className="flex gap-3 pb-6">
            <button
              onClick={() => {
                setPhase('info');
                setMessages([]);
                setDifferentials(['', '', '', '', '']);
                setWorkupPlan('');
                setFinalDiagnosis('');
                setAiAnalysis('');
                setAnalysisDone(false);
                setScoreResult(null);
                setInterviewCoaching('');
                setShowCoaching(false);
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

  // ===== メイン画面 =====
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
          <div className="flex items-center gap-1">
            {phaseLabels.map((label, i) => {
              const isActive = i === currentIdx;
              const isDone = i < currentIdx;
              return (
                <div key={i} className="flex items-center gap-1 flex-1">
                  <div className={`w-full text-center text-xs py-1 rounded font-medium transition ${isActive ? 'bg-blue-600 text-white' : isDone ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-400'}`}>
                    {isDone ? '✓ ' : ''}{label}
                  </div>
                  {i < 4 && <span className="text-gray-300 text-xs">›</span>}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-5 space-y-4">
        <div>
          <h1 className="text-xl font-black text-gray-900">{caseData.title}</h1>
          {caseData.category && <span className="text-xs text-gray-400">{caseData.category}</span>}
        </div>

        {/* ===== フェーズ1：症例確認 ===== */}
        {phase === 'info' && (
          <>
            {caseData.vital_signs && (
              <div className="bg-red-50 border border-red-100 rounded-xl p-4">
                <h3 className="font-bold text-red-700 text-sm mb-2">🚨 バイタルサイン（救急隊より）</h3>
                <p className="text-sm text-red-800 whitespace-pre-wrap">{caseData.vital_signs}</p>
              </div>
            )}
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
                    <h3 className="font-bold text-gray-700 text-sm mb-1">現病歴（救急隊情報）</h3>
                    <p className="text-sm text-gray-800 whitespace-pre-wrap">{caseData.history}</p>
                  </div>
                )}
              </div>
            )}
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
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
              <p className="text-sm text-blue-800 font-medium">
                🏥 患者が到着しました。問診・診察を開始してください。
              </p>
              <p className="text-xs text-blue-600 mt-1">次のステップで患者/家族にAIが代わりに応答します。</p>
            </div>
            <button
              onClick={() => setPhase('interview')}
              className="w-full bg-blue-600 text-white py-4 rounded-xl font-bold text-base hover:bg-blue-700 transition"
            >
              問診・診察を開始する →
            </button>
          </>
        )}

        {/* ===== フェーズ2：問診・診察 ===== */}
        {phase === 'interview' && (
          <>
            <div className="bg-purple-50 border border-purple-100 rounded-xl p-4">
              <h3 className="font-bold text-purple-700 mb-1">Step 2：問診・診察フェーズ</h3>
              <p className="text-xs text-purple-600">患者または家族にAIが役を演じて応答します。診察の指示（「腹部を触らせてください」など）も入力できます。</p>
            </div>

            {/* チャット画面 */}
            <div className="bg-white rounded-xl shadow-sm overflow-hidden">
              <div className="bg-gray-800 px-4 py-2 flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-red-400"></div>
                <div className="w-2 h-2 rounded-full bg-yellow-400"></div>
                <div className="w-2 h-2 rounded-full bg-green-400"></div>
                <span className="text-xs text-gray-300 ml-2">問診・診察ルーム</span>
              </div>

              {/* メッセージ一覧 */}
              <div className="h-72 overflow-y-auto p-4 space-y-3 bg-gray-50">
                {messages.length === 0 && (
                  <div className="text-center text-gray-400 text-sm mt-8">
                    <p className="text-3xl mb-2">🏥</p>
                    <p>患者が入室しました。</p>
                    <p className="text-xs mt-1">問診や診察の指示を入力してください。</p>
                  </div>
                )}
                {messages.map((m, i) => (
                  <div key={i} className={`flex ${m.role === 'resident' ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-xs px-4 py-2.5 rounded-2xl text-sm ${
                      m.role === 'resident'
                        ? 'bg-blue-600 text-white rounded-br-sm'
                        : 'bg-white text-gray-800 shadow-sm rounded-bl-sm border border-gray-100'
                    }`}>
                      <div className={`text-xs mb-1 ${m.role === 'resident' ? 'text-blue-200' : 'text-gray-400'}`}>
                        {m.role === 'resident' ? '研修医（あなた）' : '患者/家族'}
                      </div>
                      {m.text}
                    </div>
                  </div>
                ))}
                {chatLoading && (
                  <div className="flex justify-start">
                    <div className="bg-white px-4 py-3 rounded-2xl rounded-bl-sm shadow-sm border border-gray-100">
                      <div className="flex gap-1">
                        <div className="w-2 h-2 rounded-full bg-gray-400 animate-bounce" style={{ animationDelay: '0ms' }}></div>
                        <div className="w-2 h-2 rounded-full bg-gray-400 animate-bounce" style={{ animationDelay: '150ms' }}></div>
                        <div className="w-2 h-2 rounded-full bg-gray-400 animate-bounce" style={{ animationDelay: '300ms' }}></div>
                      </div>
                    </div>
                  </div>
                )}
                <div ref={chatBottomRef}></div>
              </div>

              {/* 入力エリア */}
              <div className="p-3 border-t border-gray-100 bg-white">
                <div className="flex gap-2">
                  <textarea
                    value={inputText}
                    onChange={e => setInputText(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSendMessage(); } }}
                    placeholder="例：いつから痛いですか？&#10;腹部を触らせてください"
                    rows={2}
                    className="flex-1 border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300 resize-none"
                    disabled={chatLoading}
                  />
                  <button
                    onClick={handleSendMessage}
                    disabled={!inputText.trim() || chatLoading}
                    className="bg-blue-600 text-white px-4 rounded-xl font-bold text-sm hover:bg-blue-700 disabled:opacity-40 transition flex-shrink-0"
                  >
                    送信
                  </button>
                </div>
                <p className="text-xs text-gray-400 mt-1">Enter で送信 / Shift+Enter で改行</p>
              </div>
            </div>

            {/* 指導コメントボタン */}
            <button
              onClick={handleGetCoaching}
              disabled={coachingLoading || messages.length === 0}
              className="w-full border border-purple-400 text-purple-600 py-3 rounded-xl font-bold text-sm hover:bg-purple-50 disabled:opacity-40 transition"
            >
              {coachingLoading ? '指導コメント取得中...' : '👨‍⚕️ 指導医からコメントをもらう（任意）'}
            </button>

            {showCoaching && interviewCoaching && (
              <div className="bg-purple-50 border border-purple-200 rounded-xl p-4">
                <h4 className="font-bold text-purple-700 text-sm mb-2">👨‍⚕️ 指導医からのコメント</h4>
                <p className="text-sm text-purple-800 whitespace-pre-wrap">{interviewCoaching}</p>
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
                onClick={() => setPhase('differential')}
                className="flex-grow bg-blue-600 text-white py-3 rounded-xl font-bold text-sm hover:bg-blue-700 transition"
              >
                診察完了 → 鑑別診断へ
              </button>
            </div>
          </>
        )}

        {/* ===== フェーズ3：鑑別診断 ===== */}
        {phase === 'differential' && (
          <>
            <div className="bg-blue-50 border border-blue-100 rounded-xl p-4">
              <h3 className="font-bold text-blue-700 mb-1">Step 3：鑑別診断</h3>
              <p className="text-xs text-blue-600">問診・診察を踏まえて鑑別診断を最大5つ挙げてください（優先順）</p>
            </div>

            {/* 問診要約 */}
            {messages.length > 0 && (
              <div className="bg-white rounded-xl shadow-sm p-4">
                <p className="text-xs font-bold text-gray-400 mb-2">問診・診察で得られた情報</p>
                <div className="space-y-1 max-h-28 overflow-y-auto">
                  {messages.filter(m => m.role === 'patient').map((m, i) => (
                    <p key={i} className="text-xs text-gray-600 bg-gray-50 rounded px-2 py-1">{m.text}</p>
                  ))}
                </div>
              </div>
            )}

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
                <h4 className="font-bold text-indigo-700 text-sm mb-2">🤖 AIフィードバック</h4>
                <p className="text-sm text-indigo-800 whitespace-pre-wrap">{aiAnalysis}</p>
              </div>
            )}

            <div className="flex gap-3">
              <button onClick={() => setPhase('interview')} className="flex-1 border border-gray-300 text-gray-600 py-3 rounded-xl font-bold text-sm hover:bg-gray-50 transition">← 戻る</button>
              <button onClick={() => setPhase('workup')} disabled={validDifferentials.length === 0} className="flex-grow bg-blue-600 text-white py-3 rounded-xl font-bold text-sm hover:bg-blue-700 disabled:opacity-40 transition">精査計画へ →</button>
            </div>
          </>
        )}

        {/* ===== フェーズ4：精査計画 ===== */}
        {phase === 'workup' && (
          <>
            <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-4">
              <h3 className="font-bold text-indigo-700 mb-1">Step 4：精査計画</h3>
              <p className="text-xs text-indigo-600">必要な検査・処置・コンサルトを記入してください</p>
            </div>
            <div className="bg-white rounded-xl shadow-sm p-4">
              <div className="flex flex-wrap gap-1 mb-3">
                {validDifferentials.map((d, i) => (
                  <span key={i} className="text-xs bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full">{d}</span>
                ))}
              </div>
              <textarea
                value={workupPlan}
                onChange={e => setWorkupPlan(e.target.value)}
                placeholder="例：&#10;・頭部CT（単純）&#10;・血液検査（CBC、生化、凝固）&#10;・腰椎穿刺（CTで出血なければ）&#10;・脳外科緊急コンサルト&#10;・血圧管理（ニカルジピン）"
                rows={8}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 resize-none"
              />
            </div>
            <div className="flex gap-3">
              <button onClick={() => setPhase('differential')} className="flex-1 border border-gray-300 text-gray-600 py-3 rounded-xl font-bold text-sm hover:bg-gray-50 transition">← 戻る</button>
              <button onClick={() => setPhase('diagnosis')} className="flex-grow bg-blue-600 text-white py-3 rounded-xl font-bold text-sm hover:bg-blue-700 transition">最終診断へ →</button>
            </div>
          </>
        )}

        {/* ===== フェーズ5：最終診断 ===== */}
        {phase === 'diagnosis' && (
          <>
            <div className="bg-green-50 border border-green-100 rounded-xl p-4">
              <h3 className="font-bold text-green-700 mb-1">Step 5：最終診断</h3>
              <p className="text-xs text-green-600">問診・精査を踏まえた最終的な診断名を入力してください</p>
            </div>
            <div className="bg-white rounded-xl shadow-sm p-4">
              <input
                type="text"
                value={finalDiagnosis}
                onChange={e => setFinalDiagnosis(e.target.value)}
                placeholder="例：くも膜下出血（SAH）"
                className="w-full border border-gray-200 rounded-xl px-4 py-3 text-base font-bold focus:outline-none focus:ring-2 focus:ring-green-300"
              />
            </div>
            <div className="flex gap-3">
              <button onClick={() => setPhase('workup')} className="flex-1 border border-gray-300 text-gray-600 py-3 rounded-xl font-bold text-sm hover:bg-gray-50 transition">← 戻る</button>
              <button
                onClick={handleFinalScore}
                disabled={!finalDiagnosis.trim() || scoringLoading}
                className="flex-grow bg-green-600 text-white py-3 rounded-xl font-bold text-sm hover:bg-green-700 disabled:opacity-40 transition flex items-center justify-center gap-2"
              >
                {scoringLoading ? (
                  <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>採点中...</>
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
