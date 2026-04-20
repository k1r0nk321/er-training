'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useAuth } from '../../lib/auth-context';
import { supabase } from '../../lib/supabase';

// フェーズ定義
// 'info' → 'interview' → 'differential' → 'workup' → 'diagnosis' → 'result'

// 検査リスト定義
const EXAM_LIST = [
  { id: 'blood_gas', label: '血液ガス', category: '血液' },
  { id: 'blood_test', label: '一般採血', category: '血液' },
  { id: 'urinalysis', label: '検尿', category: '血液' },
  { id: 'ecg', label: '心電図', category: '生理' },
  { id: 'chest_xray', label: '胸部X線', category: '画像' },
  { id: 'abdominal_xray', label: '腹部X線', category: '画像' },
  { id: 'echo_cardiac', label: '心エコー', category: '画像' },
  { id: 'echo_abdominal', label: '腹部エコー', category: '画像' },
  { id: 'ct_head', label: '頭部単純CT', category: 'CT' },
  { id: 'ct_chest', label: '胸部単純CT', category: 'CT' },
  { id: 'ct_chest_contrast', label: '胸部造影CT', category: 'CT' },
  { id: 'ct_abdomen', label: '腹部単純CT', category: 'CT' },
  { id: 'ct_abdomen_contrast', label: '腹部造影CT', category: 'CT' },
  { id: 'mri_head', label: '頭部MRI', category: 'MRI' },
];

const EXAM_CATEGORIES = ['血液', '生理', '画像', 'CT', 'MRI'];

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
  const [messages, setMessages] = useState([]);
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

  // ===== 精査計画（新） =====
  const [selectedExams, setSelectedExams] = useState({});
  const [otherExam, setOtherExam] = useState('');
  const [examResults, setExamResults] = useState({}); // 検査結果
  const [examLoading, setExamLoading] = useState(false);
  const [examDone, setExamDone] = useState(false);
  const [otherExamResult, setOtherExamResult] = useState('');

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
      `${m.role === 'resident' ? '研修医' : '患者/家族'}：${m.text}`
    ).join('\n');

    const prompt = `あなたは救急ERに搬送された患者（または家族）の役を演じています。

【症例情報（演じる際の根拠。研修医には見せない）】
症例タイトル：${caseData.title}
主訴：${caseData.chief_complaint || ''}
現病歴：${caseData.history || ''}
正解の診断：${caseData.answer_diagnosis || ''}
身体所見（診察された場合のみ答える）：${caseData.physical_exam || ''}

【ルール】
- 患者または家族として自然に返答（医学用語は使わず一般的な言葉で）
- 診察の指示（「腹部を触らせてください」など）をされた場合は所見を答える
- 1〜3文で簡潔に返答
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
      setMessages(prev => [...prev, { role: 'patient', text: data.text || data.content || '（回答を取得できませんでした）' }]);
    } catch {
      setMessages(prev => [...prev, { role: 'patient', text: '（通信エラーが発生しました）' }]);
    }
    setChatLoading(false);
  };

  // ===== 指導コメント =====
  const handleGetCoaching = async () => {
    if (messages.length === 0) { alert('まず問診を行ってください'); return; }
    setCoachingLoading(true);
    setShowCoaching(true);
    setInterviewCoaching('');

    const conversationHistory = messages.map(m =>
      `${m.role === 'resident' ? '研修医' : '患者/家族'}：${m.text}`
    ).join('\n');

    const prompt = `救急・ER専門の指導医として、研修医の問診を評価してください。

【症例】タイトル：${caseData.title}、正解：${caseData.answer_diagnosis || ''}

【問診記録】
${conversationHistory}

以下を200字以内でコメント（採点なし）：
1. 取れている重要な情報
2. まだ聞けていない重要な点
3. この症例で特に重要な問診のポイント`;

    try {
      const response = await fetch('/api/score', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt }),
      });
      const data = await response.json();
      setInterviewCoaching(data.text || data.content || '');
    } catch {
      setInterviewCoaching('コメントの取得に失敗しました。');
    }
    setCoachingLoading(false);
  };

  // ===== 検査を選択 =====
  const toggleExam = (examId) => {
    setSelectedExams(prev => ({ ...prev, [examId]: !prev[examId] }));
    setExamDone(false);
  };

  const selectedExamIds = Object.entries(selectedExams).filter(([, v]) => v).map(([k]) => k);
  const selectedExamLabels = EXAM_LIST.filter(e => selectedExams[e.id]).map(e => e.label);

  // ===== 検査を実施してAI結果生成 =====
  const handleRunExams = async () => {
    const examsToRun = [...selectedExamLabels];
    if (otherExam.trim()) examsToRun.push(`その他：${otherExam}`);

    if (examsToRun.length === 0) { alert('検査を1つ以上選択してください'); return; }

    setExamLoading(true);
    setExamResults({});
    setOtherExamResult('');

    // 症例に設定済みの検査結果（initial_labs）を優先、それ以外はAIが生成
    const prompt = `あなたは救急ERの指導医です。以下の症例に対して、研修医が選択した検査の結果を生成してください。

【症例】
タイトル：${caseData.title}
主訴：${caseData.chief_complaint || ''}
現病歴：${caseData.history || ''}
バイタル：${caseData.vital_signs || ''}
正解の診断：${caseData.answer_diagnosis || ''}
症例に設定済みの検査所見：${caseData.initial_labs || '（なし）'}

【研修医が選択した検査】
${examsToRun.map((e, i) => `${i + 1}. ${e}`).join('\n')}

以下のルール：
- 症例の診断（${caseData.answer_diagnosis}）に関連する検査は、その疾患に特徴的な所見・数値を生成する
- 症例と直接関係のない検査は「異常なし」と返す
- 症例に設定済みの検査所見がある場合はそれを優先する
- 検査結果は数値・所見のみを記載する（解釈・指導コメント・「示唆する」などの解釈的な表現は一切含めない）
- 例：「Hb 7.2 g/dL、WBC 12,400/μL、PLT 18.4万/μL」のような純粋なデータのみ

以下のJSON形式のみで返答（マークダウン記号不要）：
{
  "results": {
    "検査名1": "数値・所見のみ",
    "検査名2": "数値・所見のみ"
  }
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
      setExamResults(parsed.results || {});
      setExamDone(true);
    } catch (e) {
      alert('検査結果の取得に失敗しました。もう一度お試しください。');
    }
    setExamLoading(false);
  };

  // ===== 鑑別AIフィードバック =====
  const handleAnalyzeDifferentials = async () => {
    if (differentials.filter(d => d.trim()).length === 0) { alert('鑑別診断を1つ以上入力してください'); return; }
    setAiAnalysis('');
    setAnalysisDone(false);

    const prompt = `救急・ERの指導医として、研修医の鑑別診断を評価してください。

【症例】主訴：${caseData.chief_complaint || ''}、バイタル：${caseData.vital_signs || ''}

【研修医の鑑別診断】
${differentials.filter(d => d.trim()).map((d, i) => `${i + 1}. ${d}`).join('\n')}

150字以内で教育的フィードバック（採点なし）：良い点・見落とし・次のステップへのヒント`;

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
    if (!finalDiagnosis.trim()) { alert('最終診断を入力してください'); return; }
    setScoringLoading(true);

    const interviewRecord = messages.length > 0
      ? messages.map(m => `${m.role === 'resident' ? '研修医' : '患者/家族'}：${m.text}`).join('\n')
      : '（問診なし）';

    const examRecord = [
      ...selectedExamLabels.map(label => `${label}：${examResults[label] || '（結果未取得）'}`),
      otherExam ? `その他（${otherExam}）：${otherExamResult || examResults[`その他：${otherExam}`] || '（結果未取得）'}` : null,
    ].filter(Boolean).join('\n') || '（精査なし）';

    const prompt = `救急・ERの指導医として研修医の症例対応を100点満点で採点してください。

【症例】タイトル：${caseData.title}、正解の診断：${caseData.answer_diagnosis || ''}
採点基準：${caseData.scoring_criteria || '総合的に判断'}

【研修医の問診記録】
${interviewRecord}

【選択した検査】
${examRecord}

【鑑別診断】
${differentials.filter(d => d.trim()).map((d, i) => `${i + 1}. ${d}`).join('\n') || '（未入力）'}

【最終診断】
${finalDiagnosis}

以下のJSON形式のみで返答（マークダウン記号不要）：
{
  "score": 85,
  "passed": true,
  "breakdown": {
    "interview": 25,
    "workup": 25,
    "differential": 25,
    "final_diagnosis": 25
  },
  "comment": "全体フィードバック200字以内",
  "interview_feedback": "問診の質1〜2文",
  "workup_feedback": "検査選択の適切さ1〜2文",
  "good_points": "よかった点1〜2文",
  "improvement": "改善点1〜2文",
  "teaching_point": "重要な教訓1文"
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
        workup_plan: [...selectedExamLabels, otherExam].filter(Boolean).join('、'),
        final_diagnosis: finalDiagnosis,
        score: parsed.score,
        passed: parsed.passed,
        feedback: parsed,
        created_at: new Date().toISOString(),
      });
      fetchPrevResults();
    } catch {
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

  const phaseLabels = ['症例確認', '問診・診察', '鑑別診断', '精査・検査', '最終診断'];
  const phaseOrder = ['info', 'interview', 'differential', 'workup', 'diagnosis'];
  const currentIdx = phaseOrder.indexOf(phase);

  const resetAll = () => {
    setPhase('info');
    setMessages([]);
    setDifferentials(['', '', '', '', '']);
    setSelectedExams({});
    setOtherExam('');
    setExamResults({});
    setExamDone(false);
    setFinalDiagnosis('');
    setAiAnalysis('');
    setAnalysisDone(false);
    setScoreResult(null);
    setInterviewCoaching('');
    setShowCoaching(false);
  };

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
                  { label: '精査・検査選択', key: 'workup', max: 25 },
                  { label: '鑑別診断', key: 'differential', max: 25 },
                  { label: '最終診断', key: 'final_diagnosis', max: 25 },
                ].map(item => (
                  <div key={item.key} className="flex items-center gap-3">
                    <span className="text-sm text-gray-600 w-28">{item.label}</span>
                    <div className="flex-1 bg-gray-100 rounded-full h-3">
                      <div className="bg-blue-500 h-3 rounded-full transition-all" style={{ width: `${(scoreResult.breakdown[item.key] / item.max) * 100}%` }}></div>
                    </div>
                    <span className="text-sm font-bold text-gray-700 w-16 text-right">{scoreResult.breakdown[item.key]} / {item.max}点</span>
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
              <div><span className="text-xs font-bold text-purple-600">🗣️ 問診について</span>
                <p className="text-sm text-gray-700 mt-1">{scoreResult.interview_feedback}</p></div>
            )}
            {scoreResult.workup_feedback && (
              <div><span className="text-xs font-bold text-indigo-600">🔬 検査選択について</span>
                <p className="text-sm text-gray-700 mt-1">{scoreResult.workup_feedback}</p></div>
            )}
            {scoreResult.good_points && (
              <div><span className="text-xs font-bold text-green-600">✓ 良かった点</span>
                <p className="text-sm text-gray-700 mt-1">{scoreResult.good_points}</p></div>
            )}
            {scoreResult.improvement && (
              <div><span className="text-xs font-bold text-orange-500">△ 改善点</span>
                <p className="text-sm text-gray-700 mt-1">{scoreResult.improvement}</p></div>
            )}
            {scoreResult.teaching_point && (
              <div className="bg-blue-50 rounded-lg p-3">
                <span className="text-xs font-bold text-blue-600">📌 Teaching Point</span>
                <p className="text-sm text-blue-800 mt-1 font-medium">{scoreResult.teaching_point}</p>
              </div>
            )}
          </div>

          {/* 選択した検査と結果 */}
          {Object.keys(examResults).length > 0 && (
            <div className="bg-white rounded-xl shadow-sm p-4">
              <h3 className="font-bold text-gray-700 mb-2">実施した検査と結果</h3>
              <div className="divide-y divide-gray-100">
                {Object.entries(examResults).map(([exam, result]) => (
                  <div key={exam} className="py-2">
                    <p className="text-xs font-bold text-indigo-600">{exam}</p>
                    <p className="text-xs text-gray-900 font-mono mt-0.5 whitespace-pre-wrap">{result}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="flex gap-3 pb-6">
            <button onClick={resetAll} className="flex-1 border border-blue-600 text-blue-600 py-3 rounded-xl font-bold text-sm hover:bg-blue-50 transition">🔄 再挑戦</button>
            <button onClick={() => router.push('/cases')} className="flex-1 bg-blue-600 text-white py-3 rounded-xl font-bold text-sm hover:bg-blue-700 transition">📋 症例一覧へ</button>
          </div>
        </div>
      </div>
    );
  }

  // ===== メイン画面 =====
  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm sticky top-0 z-10">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center justify-between">
          <button onClick={() => router.push('/cases')} className="text-blue-600 text-sm">← 一覧へ</button>
          <span className={`text-xs px-2 py-0.5 rounded-full font-bold ${getDifficultyColor(caseData.difficulty)}`}>
            {getDifficultyLabel(caseData.difficulty)}
          </span>
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

        {/* ===== Step1：症例確認 ===== */}
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
                  <div><h3 className="font-bold text-gray-700 text-sm mb-1">主訴</h3>
                    <p className="text-sm text-gray-800">{caseData.chief_complaint}</p></div>
                )}
                {caseData.history && (
                  <div><h3 className="font-bold text-gray-700 text-sm mb-1">現病歴（救急隊情報）</h3>
                    <p className="text-sm text-gray-800 whitespace-pre-wrap">{caseData.history}</p></div>
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
              <p className="text-sm text-blue-800 font-medium">🏥 患者が到着しました。問診・診察を開始してください。</p>
              <p className="text-xs text-blue-600 mt-1">次のステップで患者/家族にAIが代わりに応答します。</p>
            </div>
            <button onClick={() => setPhase('interview')} className="w-full bg-blue-600 text-white py-4 rounded-xl font-bold text-base hover:bg-blue-700 transition">
              問診・診察を開始する →
            </button>
          </>
        )}

        {/* ===== Step2：問診・診察 ===== */}
        {phase === 'interview' && (
          <>
            <div className="bg-purple-50 border border-purple-100 rounded-xl p-4">
              <h3 className="font-bold text-purple-700 mb-1">Step 2：問診・診察フェーズ</h3>
              <p className="text-xs text-purple-600">患者または家族にAIが役を演じて応答します。診察の指示（「腹部を触らせてください」など）も入力できます。</p>
            </div>
            <div className="bg-white rounded-xl shadow-sm overflow-hidden">
              <div className="bg-gray-800 px-4 py-2 flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-red-400"></div>
                <div className="w-2 h-2 rounded-full bg-yellow-400"></div>
                <div className="w-2 h-2 rounded-full bg-green-400"></div>
                <span className="text-xs text-gray-300 ml-2">問診・診察ルーム</span>
              </div>
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
                    <div className={`max-w-xs px-4 py-2.5 rounded-2xl text-sm ${m.role === 'resident' ? 'bg-blue-600 text-white rounded-br-sm' : 'bg-white text-gray-800 shadow-sm rounded-bl-sm border border-gray-100'}`}>
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
                        {[0, 150, 300].map(delay => (
                          <div key={delay} className="w-2 h-2 rounded-full bg-gray-400 animate-bounce" style={{ animationDelay: `${delay}ms` }}></div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
                <div ref={chatBottomRef}></div>
              </div>
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
                  <button onClick={handleSendMessage} disabled={!inputText.trim() || chatLoading}
                    className="bg-blue-600 text-white px-4 rounded-xl font-bold text-sm hover:bg-blue-700 disabled:opacity-40 transition flex-shrink-0">
                    送信
                  </button>
                </div>
                <p className="text-xs text-gray-400 mt-1">Enter で送信 / Shift+Enter で改行</p>
              </div>
            </div>
            <button onClick={handleGetCoaching} disabled={coachingLoading || messages.length === 0}
              className="w-full border border-purple-400 text-purple-600 py-3 rounded-xl font-bold text-sm hover:bg-purple-50 disabled:opacity-40 transition">
              {coachingLoading ? '指導コメント取得中...' : '👨‍⚕️ 指導医からコメントをもらう（任意）'}
            </button>
            {showCoaching && interviewCoaching && (
              <div className="bg-purple-50 border border-purple-200 rounded-xl p-4">
                <h4 className="font-bold text-purple-700 text-sm mb-2">👨‍⚕️ 指導医からのコメント</h4>
                <p className="text-sm text-purple-800 whitespace-pre-wrap">{interviewCoaching}</p>
              </div>
            )}
            <div className="flex gap-3">
              <button onClick={() => setPhase('info')} className="flex-1 border border-gray-300 text-gray-600 py-3 rounded-xl font-bold text-sm hover:bg-gray-50 transition">← 戻る</button>
              <button onClick={() => setPhase('differential')} className="flex-grow bg-blue-600 text-white py-3 rounded-xl font-bold text-sm hover:bg-blue-700 transition">
                診察完了 → 鑑別診断へ
              </button>
            </div>
          </>
        )}

        {/* ===== Step3：鑑別診断 ===== */}
        {phase === 'differential' && (
          <>
            <div className="bg-blue-50 border border-blue-100 rounded-xl p-4">
              <h3 className="font-bold text-blue-700 mb-1">Step 3：鑑別診断</h3>
              <p className="text-xs text-blue-600">問診・診察を踏まえて鑑別診断を最大5つ挙げてください（優先順）</p>
            </div>
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
                  <input type="text" value={d} onChange={e => updateDifferential(i, e.target.value)}
                    placeholder={i === 0 ? '最も可能性が高い診断名' : `鑑別診断 ${i + 1}`}
                    className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
                </div>
              ))}
            </div>
            {!analysisDone && (
              <button onClick={handleAnalyzeDifferentials} disabled={validDifferentials.length === 0}
                className="w-full border border-blue-400 text-blue-600 py-3 rounded-xl font-bold text-sm hover:bg-blue-50 disabled:opacity-40 transition">
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
              <button onClick={() => setPhase('workup')} disabled={validDifferentials.length === 0}
                className="flex-grow bg-blue-600 text-white py-3 rounded-xl font-bold text-sm hover:bg-blue-700 disabled:opacity-40 transition">
                精査・検査へ →
              </button>
            </div>
          </>
        )}

        {/* ===== Step4：精査・検査（新UI） ===== */}
        {phase === 'workup' && (
          <>
            <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-4">
              <h3 className="font-bold text-indigo-700 mb-1">Step 4：精査・検査</h3>
              <p className="text-xs text-indigo-600">必要な検査を選択して「検査を実施する」を押すとAIが結果を提示します。</p>
            </div>

            {/* 検査チェックボックス */}
            <div className="bg-white rounded-xl shadow-sm p-4">
              {EXAM_CATEGORIES.map(cat => (
                <div key={cat} className="mb-4">
                  <p className="text-xs font-bold text-gray-500 mb-2 pb-1 border-b border-gray-100">{cat}</p>
                  <div className="grid grid-cols-2 gap-2">
                    {EXAM_LIST.filter(e => e.category === cat).map(exam => (
                      <button
                        key={exam.id}
                        onClick={() => toggleExam(exam.id)}
                        className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border text-sm font-medium transition text-left ${
                          selectedExams[exam.id]
                            ? 'bg-indigo-600 text-white border-indigo-600'
                            : 'bg-white text-gray-700 border-gray-200 hover:border-indigo-300 hover:bg-indigo-50'
                        }`}
                      >
                        <span className="flex-shrink-0 w-5 h-5 rounded border flex items-center justify-center text-xs
                          ${selectedExams[exam.id] ? 'bg-white border-white text-indigo-600' : 'border-gray-300'}">
                          {selectedExams[exam.id] ? '✓' : ''}
                        </span>
                        {exam.label}
                      </button>
                    ))}
                  </div>
                </div>
              ))}

              {/* その他 */}
              <div className="mt-2">
                <p className="text-xs font-bold text-gray-500 mb-2 pb-1 border-b border-gray-100">その他</p>
                <input
                  type="text"
                  value={otherExam}
                  onChange={e => { setOtherExam(e.target.value); setExamDone(false); }}
                  placeholder="その他の検査・コンサルト・処置を入力"
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
                />
              </div>
            </div>

            {/* 選択中の検査 */}
            {(selectedExamIds.length > 0 || otherExam) && (
              <div className="bg-indigo-50 rounded-xl p-3">
                <p className="text-xs font-bold text-indigo-600 mb-1">選択中の検査（{selectedExamIds.length + (otherExam ? 1 : 0)}件）</p>
                <div className="flex flex-wrap gap-1">
                  {selectedExamLabels.map(label => (
                    <span key={label} className="text-xs bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full">{label}</span>
                  ))}
                  {otherExam && <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">{otherExam}</span>}
                </div>
              </div>
            )}

            {/* 検査実施ボタン＋結果（ボタンのすぐ下に表示） */}
            <div className="bg-white rounded-xl shadow-sm overflow-hidden">
              <button
                onClick={handleRunExams}
                disabled={examLoading || (selectedExamIds.length === 0 && !otherExam.trim())}
                className="w-full bg-indigo-600 text-white py-4 font-bold text-base hover:bg-indigo-700 disabled:opacity-40 transition flex items-center justify-center gap-2"
              >
                {examLoading ? (
                  <><div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>検査実施中...</>
                ) : '🔬 検査を実施する'}
              </button>

              {/* 検査結果：ボタンのすぐ下に即時表示 */}
              {examLoading && (
                <div className="p-4 space-y-2">
                  {[...selectedExamLabels, otherExam].filter(Boolean).map(label => (
                    <div key={label} className="flex items-center gap-3 py-2 border-b border-gray-100">
                      <div className="w-3 h-3 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin flex-shrink-0"></div>
                      <span className="text-sm text-gray-500">{label}　検査中...</span>
                    </div>
                  ))}
                </div>
              )}

              {examDone && Object.keys(examResults).length > 0 && (
                <div className="divide-y divide-gray-100">
                  {Object.entries(examResults).filter(([k]) => k !== '_key_finding').map(([exam, result]) => (
                    <div key={exam} className="px-4 py-3">
                      <p className="text-xs font-bold text-indigo-600 mb-1">{exam}</p>
                      <p className="text-sm text-gray-900 font-mono whitespace-pre-wrap leading-relaxed">{result}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="flex gap-3">
              <button onClick={() => setPhase('differential')} className="flex-1 border border-gray-300 text-gray-600 py-3 rounded-xl font-bold text-sm hover:bg-gray-50 transition">← 戻る</button>
              <button
                onClick={() => setPhase('diagnosis')}
                disabled={!examDone}
                className="flex-grow bg-blue-600 text-white py-3 rounded-xl font-bold text-sm hover:bg-blue-700 disabled:opacity-40 transition"
              >
                最終診断へ →
              </button>
            </div>
          </>
        )}

        {/* ===== Step5：最終診断 ===== */}
        {phase === 'diagnosis' && (
          <>
            <div className="bg-green-50 border border-green-100 rounded-xl p-4">
              <h3 className="font-bold text-green-700 mb-1">Step 5：最終診断</h3>
              <p className="text-xs text-green-600">問診・精査を踏まえた最終的な診断名を入力してください</p>
            </div>

            {/* 検査結果サマリー */}
            {Object.keys(examResults).length > 0 && (
              <div className="bg-white rounded-xl shadow-sm p-4">
                <p className="text-xs font-bold text-gray-500 mb-2">実施した検査</p>
                <div className="flex flex-wrap gap-1">
                  {selectedExamLabels.map(label => (
                    <span key={label} className="text-xs bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full">{label}</span>
                  ))}
                  {otherExam && <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">{otherExam}</span>}
                </div>
              </div>
            )}

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
