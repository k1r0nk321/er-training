'use client';
import { useState, useEffect, useRef } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useAuth } from '../../lib/auth-context';
import { supabase } from '../../lib/supabase';
// フェーズ定義
// 'info' → 'interview'（問診＋鑑別診断） → 'workup' → 'diagnosis' → 'result'
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
// ===== アコーディオンコンポーネント =====
function InfoAccordion({ title, children, defaultOpen = false }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border border-gray-200 rounded-xl overflow-hidden">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 hover:bg-gray-100 transition text-left"
      >
        <span className="text-sm font-bold text-gray-600">{title}</span>
        <span className={`text-gray-400 text-xs transition-transform ${open ? 'rotate-180' : ''}`}>▼</span>
      </button>
      {open && (
        <div className="px-4 py-3 bg-white">
          {children}
        </div>
      )}
    </div>
  );
}
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
  // ===== Step3指導医コメント =====
  const [workupCoaching, setWorkupCoaching] = useState('');
  const [workupCoachingLoading, setWorkupCoachingLoading] = useState(false);
  const [showWorkupCoaching, setShowWorkupCoaching] = useState(false);
  // ===== 採点用スナップショット（指導コメント取得前の情報を保存） =====
  const [scoreSnapshot, setScoreSnapshot] = useState(null);
  // ===== 鑑別診断 =====
  const [differentials, setDifferentials] = useState(['', '', '', '', '']);
  const [aiAnalysis, setAiAnalysis] = useState('');
  const [analysisDone, setAnalysisDone] = useState(false);
  // ===== 精査計画 =====
  const [selectedExams, setSelectedExams] = useState({});
  const [otherExam, setOtherExam] = useState('');
  const [examResults, setExamResults] = useState({});
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
    const trial = sessionStorage.getItem('trial_mode') === 'true';
    if (user) sessionStorage.removeItem('trial_mode');
    if (!loading && !user && !trial) router.push('/');
  }, [user, loading, router]);
  useEffect(() => {
    const trial = sessionStorage.getItem('trial_mode') === 'true';
    if (user && caseId) {
      fetchCase();
      fetchPrevResults();
    }
    if (!user && trial && caseId) {
      fetchCase();
    }
  }, [user, caseId]);
  useEffect(() => {
    if (messages.length === 0) return;
    const last = messages[messages.length - 1];
    if (last.role === 'patient') {
      // AI返答時：チャット欄を最下部にスクロール（入力欄が見えるように）
      const chatContainer = chatBottomRef.current?.parentElement;
      if (chatContainer) {
        chatContainer.scrollTop = chatContainer.scrollHeight;
      }
    } else {
      chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
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
- 患者または家族として自然に返答（医学用語は使わず一般的な言葉で）。ただし、身体所見については、患者又は家族の返答ではなく、医師がとる医学所見情報を回答する。
-【診察への応答（最重要）】研修医が触診・聴診・打診・視診などの身体診察を指示した場合（例：「腹部を触診します」「Murphy徴候を確認します」「呼吸音を聴診します」「心音を聴診します」「腹膜刺激徴候を確認します」など）は、必ず【身体所見】を回答する。身体所見に記載がない部位は「特に異常は認めません」と答える
- 1〜3文で簡潔に返答
- 絶対に診断名を自分から言わない
- 検査結果（採血・心電図・画像・培養など）に関する質問には「検査をしてみないとわかりません」と答える。検査結果は次のStep3で提示されるため、このStep2では回答しない
- 治療法・薬剤・診断基準に関する質問も「先生にお任せします」と答える
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
1. 問診で取れている重要な情報
2. まだ聞けていない重要な点（もしあれば）
※検査・処置・診断についてのアドバイスや次のステップの提案は一切しないこと。`;
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
  // ===== 検査を実施してAI結果生成（追加分のみ生成） =====
  const handleRunExams = async () => {
    const examsToRun = [...selectedExamLabels];
    if (otherExam.trim()) examsToRun.push(`その他：${otherExam}`);
    if (examsToRun.length === 0) { alert('検査を1つ以上選択してください'); return; }
    // 既に結果が取得済みの検査を除外（新規追加分のみAIに問い合わせる）
    const newExamsToRun = examsToRun.filter(e => !examResults[e]);
    if (newExamsToRun.length === 0) {
      setExamDone(true);
      return;
    }
    setExamLoading(true);
    setOtherExamResult('');
    const prompt = `あなたは救急ERの指導医です。以下の症例に対して、研修医が選択した検査の結果を生成してください。
【症例】
タイトル：${caseData.title}
主訴：${caseData.chief_complaint || ''}
現病歴：${caseData.history || ''}
バイタル：${caseData.vital_signs || ''}
正解の診断：${caseData.answer_diagnosis || ''}
症例に設定済みの検査所見：${caseData.initial_labs || '（なし）'}
【研修医が選択した検査】
${newExamsToRun.map((e, i) => `${i + 1}. ${e}`).join('\n')}
以下のルール：
- 症例の診断（${caseData.answer_diagnosis}）に関連する検査は、その疾患に特徴的な所見・数値を生成する
- 症例と直接関係のない検査は「異常なし」と返す
- 症例に設定済みの検査所見がある場合はそれを優先する
- 一般採血（WBC・RBC・Hb・Plt・CRP・肝機能・腎機能・電解質・血糖・凝固検査など）は全て鑑別診断情報と関係なく通常通り提示する
- 研修医の現時点の鑑別診断：${differentials.filter(d => d.trim()).join('、') || '（未入力）'}
- 特殊検査（自己抗体・腫瘍マーカー・ホルモン・遺伝子検査・特殊染色など）は、研修医の鑑別診断に関連する項目のみ提示し、無関係な項目は結果に含めず「鑑別に応じて追加検討」と記載する
- 鑑別診断が未入力の場合は採血結果は一般採血結果のみ生成する
- 検査結果は数値・所見のみを記載する（解釈・指導コメント・「示唆する」などの解釈的な表現は一切含めない）
- 例：「Hb 7.2 g/dL、WBC 12,400/μL、PLT 18.4万/μL」のような純粋なデータのみ
- 血液検査結果は項目を横並びにして一覧表示すること。例：
  WBC 8500 /μL　RBC 450万/μL　Hb 13.5 g/dL　Ht 40%　Plt 20万/μL　WBC分類：Neut 65%　Lymph 28%　Mono 5%
  TP 7.0 g/dL　Alb 4.0 g/dL　T-Bil 0.8 mg/dL　AST 25 U/L　ALT 20 U/L　γ-GTP 30 U/L
  BUN 15 mg/dL　Cr 0.8 mg/dL　Na 140 mEq/L　K 4.0 mEq/L　Cl 104 mEq/L
  BS 100 mg/dL　CRP 0.5 mg/dL
- 各項目は「項目名 数値 単位」の形式で半角スペースで区切り、同カテゴリをまとめて1行に並べる
- 箇条書き（・や-）は使わない
以下のJSON形式のみで返答（マークダウン記号・コードブロック不要）：
{
  "results": {
    "検査名1": "数値・所見のみ（改行なし・1行で）",
    "検査名2": "数値・所見のみ（改行なし・1行で）"
  }
}
注意：値の中に改行・ダブルクォート・バックスラッシュを含めないこと。血液ガスは「pH 7.32、PaO2 58mmHg、PaCO2 52mmHg、HCO3 24mEq/L、BE -2」のように1行で記載すること。`;
    try {
      const response = await fetch('/api/score', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt }),
      });
      const data = await response.json();
      const raw = (data.text || data.content || '').replace(/```json|```/g, '').trim();
      let parsed = { results: {} };
      try {
        parsed = JSON.parse(raw);
      } catch {
        const firstExam = newExamsToRun[0] || '検査結果';
        parsed = { results: { [firstExam]: raw.substring(0, 500) } };
      }
      // 既存の結果とマージ（追加分のみ上書き）
      setExamResults(prev => ({ ...prev, ...(parsed.results || {}) }));
      setExamDone(true);
      // ===== 採点用スナップショットを保存 =====
      setScoreSnapshot({
        differentials: [...differentials],
        messages: [...messages],
        examLabels: [...selectedExamLabels, otherExam ? otherExam : null].filter(Boolean),
        examResults: { ...examResults, ...(parsed.results || {}) },
      });
    } catch (e) {
      alert('検査結果の取得に失敗しました。もう一度お試しください。');
    }
    setExamLoading(false);
  };
  // ===== Step3 指導医コメント =====
  const handleWorkupCoaching = async () => {
    setWorkupCoachingLoading(true);
    setShowWorkupCoaching(true);
    setWorkupCoaching('');
    const examSummary = selectedExamLabels.join('、') + (otherExam ? `、${otherExam}` : '');
    const resultSummary = Object.entries(examResults)
      .map(([k, v]) => `${k}：${v}`)
      .join('\n');
    const prompt = `救急・ERの指導医として、研修医の検査選択と結果解釈の段階に対してコメントしてください。
【症例】タイトル：${caseData.title}、正解：${caseData.answer_diagnosis || ''}
【研修医が選択した検査】
${examSummary || '（なし）'}
【検査結果】
${resultSummary || '（なし）'}
200字以内でコメント（採点なし）：
1. 検査選択の妥当性（良い点）
2. 選択しておくべきだった検査（もしあれば）
※次に何をすべきか・診断名・治療方針についてのアドバイスは一切しないこと。`;
    try {
      const response = await fetch('/api/score', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt }),
      });
      const data = await response.json();
      setWorkupCoaching(data.text || data.content || '');
    } catch {
      setWorkupCoaching('コメントの取得に失敗しました。');
    }
    setWorkupCoachingLoading(false);
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
150字以内で教育的フィードバック（採点なし）：
- 挙げられた鑑別の妥当性（良い点）
- 見落としていると思われる重要な鑑別（もしあれば1〜2つ）
※次のステップで何をすべきかのアドバイスや、検査・処置の提案は一切しないこと。`;
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
    const snap = scoreSnapshot || {
      differentials,
      messages,
      examLabels: selectedExamLabels,
      examResults,
    };
    const interviewRecord = snap.messages.length > 0
      ? snap.messages.map(m => `${m.role === 'resident' ? '研修医' : '患者/家族'}：${m.text}`).join('\n')
      : '（問診なし）';
    const examRecord = snap.examLabels.length > 0
      ? snap.examLabels.map(label => `${label}：${snap.examResults[label] || '（結果あり）'}`).join('\n')
      : '（精査なし）';
    const prompt = `救急・ERの指導医として研修医の症例対応を100点満点で採点してください。
【重要な採点方針】
- 評価対象は「問診・身体診察・検査選択・鑑別診断・最終診断」の過程のみです
- 治療方針・治療薬・診断基準（スコアリングシステム等）への言及は採点対象外です
- 治療や診断基準については、採点後のteaching_pointで「知識として」補足してください
- 減点は問診・検査選択・鑑別・最終診断の質にのみ基づいてください
- 【Step1提示情報は確認済みとして扱う】Step1（症例確認フェーズ）で研修医に提示された情報（主訴・現病歴・既往歴・バイタルサイン・背景情報）は、研修医がすでに確認済みとして扱うこと。Step2の問診でこれらを再確認しなかったことを減点してはならない。Step2では「Step1で得られなかった追加情報」を引き出す質問・診察を評価する
【鑑別診断の評価方針（最重要）】
- 鑑別診断の評価は「Step1の症例情報（バイタル・主訴・現病歴・初期検査）とStep2の問診・診察」の情報のみに基づいて行うこと
- 検査結果（Step3で選択した採血・心電図・画像など）は鑑別診断の評価に一切使用しないこと
- 例：心電図でVTが確認されても、その情報は鑑別診断の評価に使ってはならない。Step1・Step2の情報から鑑別診断としてVT・不整脈を挙げていれば適切と評価する
- 鑑別診断の順位（第何位か）も、Step1・Step2時点の情報から見て妥当かどうかで判断する。検査結果判明後の視点で「なぜ第一位にしなかったか」と批判してはならない
- 最終診断と鑑別診断の一致度を論評する際も、検査前の時点での思考過程として評価すること
【症例】タイトル：${caseData.title}、正解の診断：${caseData.answer_diagnosis || ''}
採点基準：${caseData.scoring_criteria || '総合的に判断'}
【研修医の問診記録（Step2）】
${interviewRecord}
【選択した検査】
${examRecord}
【鑑別診断】
${snap.differentials.filter(d => d.trim()).map((d, i) => `${i + 1}. ${d}`).join('\n') || '（未入力）'}
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
  "comment": "全体フィードバック200字以内（診断過程のみ評価・治療への言及は不要）",
  "interview_feedback": "問診の質1〜2文。Step1で已に提示された情報（主訴・現病歴・既往歴・バイタルサイン・背景情報）はすでに確認済みとして扱い、Step2で再確認しなかったことは減点しないこと。評価は、Step2で新たに引き出した情報（症状の詳細・伴同症状・誰による冒文かどうか・綺当・再現履歴・身体診察所見等）に對して行うこと。またStep2で聞かれなかった重要情報があれば指摘する",
  "workup_feedback": "検査選択の適切さ1〜2文",
  "good_points": "よかった点1〜2文",
  "improvement": "診断過程における改善点1〜2文",
  "teaching_point": "【Teaching Point】\n本症例で研修医が理解できていなかった点・間違えた点を中心に、以下の3点を詳細に解説してください（各100〜150字）。なお、一般的でない医学略語を使う場合は必ず英語のフルスペルと日本語訳を括弧内に記載してください（例：DVT（Deep Vein Thrombosis：深部静脈血栓症））：\n①診断の核心：この疾患を診断するうえで最も重要な思考プロセスや見落としがちな点\n②検査・問診の要点：適切な問診・検査選択のポイントと、研修医が不足していた観点\n③臨床的知識：治療方針・診断基準・類似疾患との鑑別など、この症例で知っておくべき実践的知識"
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
      parsed.passed = (parsed.score >= 80);
      setScoreResult(parsed);
      setPhase('result');
      window.scrollTo({ top: 0, behavior: 'instant' });
      const isTrial = sessionStorage.getItem('trial_mode') === 'true';
      if (!isTrial && user) {
        await supabase.from('results').insert({
          user_id: user.id,
          case_id: caseId,
          differentials: snap.differentials.filter(d => d.trim()),
          workup_plan: snap.examLabels.join('、'),
          final_diagnosis: finalDiagnosis,
          score: parsed.score,
          passed: parsed.passed,
          feedback: parsed,
          created_at: new Date().toISOString(),
        });
        fetchPrevResults();
      }
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
  const phaseLabels = ['症例確認', '問診・診察・鑑別', '精査・検査・最終診断'];
  const phaseOrder = ['info', 'interview', 'workup'];
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
    setWorkupCoaching('');
    setShowWorkupCoaching(false);
    setScoreSnapshot(null);
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
            {sessionStorage.getItem('trial_mode') === 'true' && (
              <p className="text-xs text-white/70 mt-2">※ お試しモードのため成績は保存されません</p>
            )}
          </div>
          {/* 内訳 */}
          {scoreResult.breakdown && (
            <div className="bg-white rounded-xl shadow-sm p-4">
              <h3 className="font-bold text-gray-700 mb-3">採点内訳</h3>
              <div className="space-y-2">
                {[
                  { label: '問診・診察', key: 'interview', max: 25 },
                  { label: '鑑別診断', key: 'differential', max: 25 },
                  { label: '精査・検査', key: 'workup', max: 25 },
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
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
                <span className="text-xs font-bold text-blue-600">📌 Teaching Point</span>
                <div className="mt-2 space-y-3">
                  {scoreResult.teaching_point.includes('①') ? (
                    scoreResult.teaching_point.split(/(?=①|②|③)/).filter(s => s.trim()).map((section, i) => (
                      <p key={i} className="text-sm text-blue-800 leading-relaxed">{section.trim()}</p>
                    ))
                  ) : (
                    <p className="text-sm text-blue-800 leading-relaxed font-medium">{scoreResult.teaching_point}</p>
                  )}
                </div>
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
            <button onClick={() => { window.location.href = '/cases'; }} className="flex-1 bg-blue-600 text-white py-3 rounded-xl font-bold text-sm hover:bg-blue-700 transition">📋 症例一覧へ</button>
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
          <button onClick={() => { window.location.href = '/cases'; }} className="text-blue-600 text-sm">← 一覧へ</button>
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
                  {i < 2 && <span className="text-gray-300 text-xs">›</span>}
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
                  <div><h3 className="font-bold text-gray-700 text-sm mb-1">現病歴・既往歴・背景情報</h3>
                    <p className="text-sm text-gray-800 whitespace-pre-wrap">{caseData.history}</p></div>
                )}
              </div>
            )}
            {prevResults.length > 0 && (
              <div className="bg-yellow-50 border border-yellow-100 rounded-xl p-3">
                <p className="text-xs font-bold text-yellow-700 mb-1">📊 前回の成績</p>
                {prevResults.slice(0, 2).map(r => (
                  <p key={r.id} className="text-xs text-yellow-800">
                    {new Date(r.created_at).toLocaleDateString('ja-JP')} — {r.score}点 {r.score >= 80 ? '（合格）' : '（不合格）'}
                  </p>
                ))}
              </div>
            )}
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
              <p className="text-sm text-blue-800 font-medium">🏥 来院前情報と第一印象から鑑別診断を考えてください。</p>
              <p className="text-xs text-blue-600 mt-1">次のステップで患者/家族にAIが代わり応答します。下の鑑別診断欄に現時点での考えを入力できます（任意）。</p>
            </div>
            <div className="bg-white rounded-xl shadow-sm p-4">
              <h3 className="font-bold text-gray-700 text-sm mb-1">第一印象での鑑別診断（任意）</h3>
              <p className="text-xs text-gray-400 mb-3">バイタル・主訴から現時点で考える鑑別を入力できます。未記入でも進めます。</p>
              <div className="space-y-2">
                {differentials.map((d, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <span className="text-sm font-bold text-gray-400 w-5">{i + 1}</span>
                    <input type="text" value={d} onChange={e => updateDifferential(i, e.target.value)}
                      placeholder={i === 0 ? '最も可能性が高い診断名' : `鑑別診断 ${i + 1}`}
                      className="flex-1 border-2 border-blue-200 bg-blue-50 rounded-lg px-3 py-2.5 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-400 focus:bg-white placeholder-blue-300" />
                  </div>
                ))}
              </div>
            </div>
            <button onClick={() => setPhase('interview')} className="w-full bg-blue-600 text-white py-4 rounded-xl font-bold text-base hover:bg-blue-700 transition">
              問診・診察を開始する →
            </button>
          </>
        )}
        {/* ===== Step2：問診・診察 ===== */}
        {phase === 'interview' && (
          <>
            <InfoAccordion title="📋 Step1：症例情報を確認する" defaultOpen={false}>
              {caseData.vital_signs && (
                <div className="mb-3">
                  <p className="text-xs font-bold text-red-600 mb-1">🚨 バイタルサイン</p>
                  <p className="text-sm text-gray-800 whitespace-pre-wrap">{caseData.vital_signs}</p>
                </div>
              )}
              {caseData.chief_complaint && (
                <div className="mb-3">
                  <p className="text-xs font-bold text-gray-600 mb-1">主訴</p>
                  <p className="text-sm text-gray-800">{caseData.chief_complaint}</p>
                </div>
              )}
              {caseData.history && (
                <div className="mb-3">
                  <p className="text-xs font-bold text-gray-600 mb-1">現病歴・既往歴・背景情報</p>
                  <p className="text-sm text-gray-800 whitespace-pre-wrap">{caseData.history}</p>
                </div>
              )}
              {validDifferentials.length > 0 && (
                <div>
                  <p className="text-xs font-bold text-gray-600 mb-1">第一印象での鑑別診断</p>
                  {validDifferentials.map((d, i) => (
                    <p key={i} className="text-sm text-gray-800">{i + 1}. {d}</p>
                  ))}
                </div>
              )}
            </InfoAccordion>
            <div className="bg-purple-50 border border-purple-100 rounded-xl p-4">
              <h3 className="font-bold text-purple-700 mb-1">Step 2：問診・診察・鑑別診断</h3>
              <p className="text-xs text-purple-600">患者または家族にAIが役を演じて応答します。診察の指示（「腹部を触らせてください」など）も入力できます。問診後、下の鑑別診断欄に現時点での診断を入力してください。</p>
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
                  <div key={i} data-msg={i} className={`flex ${m.role === 'resident' ? 'justify-end' : 'justify-start'}`}>
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
                    placeholder={"問診例：いつから痛いですか？\n診察例：腹部を触らせてください"}
                    rows={3}
                    className="flex-1 border-2 border-indigo-200 bg-indigo-50 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:bg-white resize-none placeholder-indigo-300"
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
            <div className="bg-blue-50 border border-blue-100 rounded-xl p-4">
              <h3 className="font-bold text-blue-700 mb-1">現時点での鑑別診断（任意）</h3>
              <p className="text-xs text-blue-600">問診・診察を踏まえた現時点での鑑別を入力してください。未記入のまま次へ進むこともできます。</p>
            </div>
            <div className="bg-white rounded-xl shadow-sm p-4 space-y-3">
              {differentials.map((d, i) => (
                <div key={i} className="flex items-center gap-2">
                  <span className="text-sm font-bold text-gray-400 w-5">{i + 1}</span>
                  <input type="text" value={d} onChange={e => updateDifferential(i, e.target.value)}
                    placeholder={i === 0 ? '最も可能性が高い診断名' : `鑑別診断 ${i + 1}`}
                    className="flex-1 border-2 border-blue-200 bg-blue-50 rounded-lg px-3 py-2.5 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-400 focus:bg-white placeholder-blue-300" />
                </div>
              ))}
            </div>
            {!analysisDone && validDifferentials.length > 0 && (
              <button onClick={handleAnalyzeDifferentials}
                className="w-full border border-blue-400 text-blue-600 py-3 rounded-xl font-bold text-sm hover:bg-blue-50 transition">
                🤖 鑑別診断にAIフィードバックをもらう（任意）
              </button>
            )}
            {aiAnalysis && (
              <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-4">
                <h4 className="font-bold text-indigo-700 text-sm mb-2">🤖 AIフィードバック</h4>
                <p className="text-sm text-indigo-800 whitespace-pre-wrap">{aiAnalysis}</p>
              </div>
            )}
            <div className="flex gap-3">
              <button onClick={() => setPhase('info')} className="flex-1 border border-gray-300 text-gray-600 py-3 rounded-xl font-bold text-sm hover:bg-gray-50 transition">← 戻る</button>
              <button onClick={() => setPhase('workup')} className="flex-grow bg-blue-600 text-white py-3 rounded-xl font-bold text-sm hover:bg-blue-700 transition">
                精査・検査へ →
              </button>
            </div>
          </>
        )}
        {/* ===== Step3：精査・検査 ===== */}
        {phase === 'workup' && (
          <>
            <InfoAccordion title="📋 Step1：症例情報を確認する" defaultOpen={false}>
              {caseData.vital_signs && (
                <div className="mb-3">
                  <p className="text-xs font-bold text-red-600 mb-1">🚨 バイタルサイン</p>
                  <p className="text-sm text-gray-800 whitespace-pre-wrap">{caseData.vital_signs}</p>
                </div>
              )}
              {caseData.chief_complaint && (
                <div className="mb-2">
                  <p className="text-xs font-bold text-gray-600 mb-1">主訴</p>
                  <p className="text-sm text-gray-800">{caseData.chief_complaint}</p>
                </div>
              )}
              {caseData.history && (
                <div>
                  <p className="text-xs font-bold text-gray-600 mb-1">現病歴・既往歴・背景情報</p>
                  <p className="text-sm text-gray-800 whitespace-pre-wrap">{caseData.history}</p>
                </div>
              )}
            </InfoAccordion>
            <InfoAccordion title="🗣️ Step2：問診・診察の記録を確認する" defaultOpen={false}>
              {messages.length > 0 ? (
                <div className="space-y-2">
                  {messages.map((m, i) => (
                    <div key={i} className={`text-xs px-3 py-2 rounded-lg ${m.role === 'resident' ? 'bg-blue-50 text-blue-800' : 'bg-gray-50 text-gray-700'}`}>
                      <span className="font-bold">{m.role === 'resident' ? '研修医' : '患者/家族'}：</span>{m.text}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-gray-400">問診記録はありません</p>
              )}
              {validDifferentials.length > 0 && (
                <div className="mt-3 pt-3 border-t border-gray-100">
                  <p className="text-xs font-bold text-gray-600 mb-1">鑑別診断</p>
                  {validDifferentials.map((d, i) => (
                    <p key={i} className="text-sm text-gray-800">{i + 1}. {d}</p>
                  ))}
                </div>
              )}
            </InfoAccordion>
            <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-4">
              <h3 className="font-bold text-indigo-700 mb-1">Step 3：精査・検査 → 最終診断</h3>
              <p className="text-xs text-indigo-600">必要な検査を選択して「検査を実施する」を押すとAIが結果を提示します。結果確認後に最終診断を入力してください。</p>
            </div>
            {validDifferentials.length > 0 && (
              <div className="bg-white rounded-xl shadow-sm p-3">
                <p className="text-xs font-bold text-gray-400 mb-1">現時点の鑑別診断</p>
                <div className="flex flex-wrap gap-1">
                  {validDifferentials.map((d, i) => (
                    <span key={i} className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">{i+1}. {d}</span>
                  ))}
                </div>
              </div>
            )}
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
                        <span className="flex-shrink-0 w-5 h-5 rounded border flex items-center justify-center text-xs">
                          {selectedExams[exam.id] ? '✓' : ''}
                        </span>
                        {exam.label}
                        {examResults[exam.label] && <span className="ml-auto text-xs opacity-60">✓済</span>}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
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
            {(selectedExamIds.length > 0 || otherExam) && (
              <div className="bg-indigo-50 rounded-xl p-3">
                <p className="text-xs font-bold text-indigo-600 mb-1">選択中の検査（{selectedExamIds.length + (otherExam ? 1 : 0)}件）</p>
                <div className="flex flex-wrap gap-1">
                  {selectedExamLabels.map(label => (
                    <span key={label} className={`text-xs px-2 py-0.5 rounded-full ${examResults[label] ? 'bg-green-100 text-green-700' : 'bg-indigo-100 text-indigo-700'}`}>
                      {examResults[label] ? '✓ ' : ''}{label}
                    </span>
                  ))}
                  {otherExam && <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">{otherExam}</span>}
                </div>
              </div>
            )}
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
              {examLoading && (
                <div className="p-4 space-y-2">
                  {[...selectedExamLabels, otherExam].filter(l => l && !examResults[l]).map(label => (
                    <div key={label} className="flex items-center gap-3 py-2 border-b border-gray-100">
                      <div className="w-3 h-3 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin flex-shrink-0"></div>
                      <span className="text-sm text-gray-500">{label}　検査中...</span>
                    </div>
                  ))}
                </div>
              )}
              {Object.keys(examResults).length > 0 && (
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
            {examDone && (
              <>
                <button
                  onClick={handleWorkupCoaching}
                  disabled={workupCoachingLoading}
                  className="w-full border border-purple-400 text-purple-600 py-3 rounded-xl font-bold text-sm hover:bg-purple-50 disabled:opacity-40 transition"
                >
                  {workupCoachingLoading ? '指導コメント取得中...' : '👨‍⚕️ 指導医からコメントをもらう（任意）'}
                </button>
                {showWorkupCoaching && workupCoaching && (
                  <div className="bg-purple-50 border border-purple-200 rounded-xl p-4">
                    <h4 className="font-bold text-purple-700 text-sm mb-2">👨‍⚕️ 指導医からのコメント</h4>
                    <p className="text-sm text-purple-800 whitespace-pre-wrap">{workupCoaching}</p>
                  </div>
                )}
                <div className="bg-green-50 border border-green-100 rounded-xl p-4">
                  <h3 className="font-bold text-green-700 mb-1">最終診断</h3>
                  <p className="text-xs text-green-600">検査結果を踏まえた最終的な診断名を入力してください</p>
                </div>
                <div className="bg-white rounded-xl shadow-sm p-4">
                  <input
                    type="text"
                    value={finalDiagnosis}
                    onChange={e => setFinalDiagnosis(e.target.value)}
                    placeholder="診断名を入力してください"
                    className="w-full border border-gray-200 rounded-xl px-4 py-3 text-base font-bold focus:outline-none focus:ring-2 focus:ring-green-300"
                  />
                </div>
              </>
            )}
            <div className="flex gap-3">
              <button onClick={() => setPhase('interview')} className="flex-1 border border-gray-300 text-gray-600 py-3 rounded-xl font-bold text-sm hover:bg-gray-50 transition">← 戻る</button>
              {examDone ? (
                <button
                  onClick={handleFinalScore}
                  disabled={!finalDiagnosis.trim() || scoringLoading}
                  className="flex-grow bg-green-600 text-white py-3 rounded-xl font-bold text-sm hover:bg-green-700 disabled:opacity-40 transition flex items-center justify-center gap-2"
                >
                  {scoringLoading ? (
                    <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>採点中...</>
                  ) : '🎯 採点する'}
                </button>
              ) : (
                <div className="flex-grow bg-gray-100 text-gray-400 py-3 rounded-xl font-bold text-sm text-center">
                  検査を実施すると最終診断が入力できます
                </div>
              )}
            </div>
          </>
        )}
        <div className="h-4"></div>
      </div>
    </div>
  );
}
