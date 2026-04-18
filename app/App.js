“use client”;
import { useState, useRef, useEffect } from “react”;

// ===== STORAGE =====
const STORAGE_KEY = “emr_cases_v4”;
const ADMIN_PW = “admin1234”;
function loadCases() {
try { const r = localStorage.getItem(STORAGE_KEY); return r ? JSON.parse(r) : []; } catch { return []; }
}
function saveCases(c) {
try { localStorage.setItem(STORAGE_KEY, JSON.stringify(c)); } catch {}
}

// ===== DEMO CASE =====
const DEMO = [{
id: “demo1”, age: 68, sex: “男性”, chief_complaint: “突然の胸痛”,
stage1: {
ems_info: “68歳男性。本日15時頃、自宅で突然の前胸部圧迫感が出現。冷汗あり。救急要請。”,
vitals: “血圧 185/110 mmHg、脈拍 92回/分・整、SpO2 94%（室内気）、体温 36.8℃、呼吸数 20回/分”,
last_meal: “本日12時（昼食）”, last_stool: “昨日”,
ems_additional: “既往歴：高血圧、脂質異常症。内服：アムロジピン、ロスバスタチン。喫煙歴：20本/日×40年。”
},
stage2: {
history_info: “胸痛は前胸部中央、重い感じ。左肩・左腕にも広がる。安静にしても改善なし。NRS 8/10。嘔気あり。動悸は自覚なし。”,
physical_exam: “意識清明。顔面蒼白・冷汗あり。頸静脈怒張なし。心音：整、雑音なし。呼吸音：両側清明。腹部：軟、圧痛なし。下肢浮腫なし。”,
additional_history: “狭心症の指摘は過去になし。家族歴：父が60代で心筋梗塞。”
},
stage3: {
ecg: “洞調律 92bpm。II・III・aVFでST上昇（2mm）。reciprocal changeとしてI・aVLでST低下。”,
blood_gas: “pH 7.42、PaCO2 38、PaO2 72、HCO3 24.5、Lac 2.1”,
blood_test: “WBC 9800、Hb 14.2、Plt 22万、CRP 0.3、CK 285↑、CK-MB 28↑、TnI 0.8↑、BNP 45、Cr 0.9”,
urinalysis: “異常なし”,
echo: “下壁・後壁の壁運動低下。EF 45%。心嚢液なし。”,
cxr: “心陰影やや拡大。肺うっ血なし。大動脈拡張なし。”,
ct_plain: “施行せず（緊急カテーテル優先）”, ct_contrast: “施行せず”, head_ct: “施行せず”
},
diagnosis: “急性下壁心筋梗塞（STEMI）”,
explanation: `## 急性心筋梗塞（STEMI）

### 疾患概要

急性心筋梗塞は冠動脈の完全閉塞による心筋壊死で、STEMI（ST上昇型）とNSTEMI（非ST上昇型）に分類される。本症例は右冠動脈（RCA）急性閉塞による下壁STEMIの典型例。

### 診断のポイント

- **症状**：前胸部圧迫感・放散痛（左肩・左腕）、冷汗、嘔気
- **心電図**：II・III・aVFのST上昇＋reciprocal change
- **心筋逸脱酵素**：CK・CK-MB・トロポニン上昇
- **心エコー**：責任領域の壁運動低下

### 治療

1. **Door-to-Balloon time 90分以内**を目標に緊急PCI
1. 抗血小板薬（アスピリン＋P2Y12阻害薬）のDAPT
1. 抗凝固療法（ヘパリン）
1. 酸素投与（SpO2 < 90%の場合）
1. 硝酸薬（右室梗塞合併時は禁忌）

### 合併症

- 心原性ショック、心室細動、完全房室ブロック（下壁梗塞で多い）
- 心室瘤、乳頭筋断裂、心室中隔穿孔（亜急性期）

### 予後・フォロー

再灌流成功例の院内死亡率は約5%。退院後はDAPT継続、心臓リハビリ、二次予防（スタチン・ACE阻害薬）が重要。`
}];

// ===== AI CALL (サーバー経由・APIキーは安全) =====
async function askClaude(system, userMsg, history = []) {
try {
const res = await fetch(”/api/ai”, {
method: “POST”,
headers: { “content-type”: “application/json” },
body: JSON.stringify({ system, userMsg, history })
});
const data = await res.json();
return data.text ?? “（応答なし）”;
} catch (e) {
return “[エラー] “ + e.message;
}
}

// ===== STYLES =====
const S = `@import url('https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@400;500;600;700&family=JetBrains+Mono:wght@400;600&display=swap'); *{box-sizing:border-box;margin:0;padding:0} :root{ --bg:#0a0e1a;--s1:#111827;--s2:#1a2236;--bd:#1e2d45; --ac:#00d4ff;--ac2:#ff6b35;--ok:#00e676;--warn:#ffab40;--err:#ff5252; --tx:#e8edf5;--mu:#6b7fa3;--c1:#00d4ff;--c2:#a78bfa;--c3:#34d399; } body,#root{font-family:'Noto Sans JP',sans-serif;background:var(--bg);color:var(--tx);min-height:100vh;max-width:430px;margin:0 auto} .app{min-height:100vh;display:flex;flex-direction:column} .hdr{background:linear-gradient(135deg,#0d1b2e,#111827);border-bottom:1px solid var(--bd);padding:12px 16px;display:flex;align-items:center;gap:10px;position:sticky;top:0;z-index:100} .hdr-back{background:none;border:1px solid var(--bd);color:var(--ac);padding:6px 10px;border-radius:8px;cursor:pointer;font-size:13px;font-family:inherit} .hdr-title{font-size:15px;font-weight:600;flex:1} .hdr-badge{background:var(--ac);color:#000;padding:2px 8px;border-radius:20px;font-size:11px;font-weight:700} .home{padding:20px 16px} .logo{text-align:center;padding:30px 0 24px} .logo-icon{width:72px;height:72px;background:linear-gradient(135deg,#00d4ff15,#00d4ff30);border:2px solid var(--ac);border-radius:20px;display:flex;align-items:center;justify-content:center;font-size:32px;margin:0 auto 12px} .logo-t{font-size:22px;font-weight:700;color:var(--ac)} .logo-s{font-size:12px;color:var(--mu);margin-top:4px} .menu-grid{display:flex;flex-direction:column;gap:12px} .menu-card{background:var(--s1);border:1px solid var(--bd);border-radius:16px;padding:18px;cursor:pointer;display:flex;align-items:center;gap:14px;position:relative;overflow:hidden;transition:.2s} .menu-card:active{transform:scale(.98)} .menu-card::before{content:'';position:absolute;left:0;top:0;bottom:0;width:4px;border-radius:4px 0 0 4px} .menu-card.res::before{background:var(--ac)}.menu-card.adm::before{background:var(--ac2)} .menu-icon{font-size:28px}.menu-lbl{font-size:16px;font-weight:600}.menu-dsc{font-size:12px;color:var(--mu);margin-top:2px}.menu-arr{margin-left:auto;color:var(--mu)} .case-list{padding:16px;display:flex;flex-direction:column;gap:10px} .case-card{background:var(--s1);border:1px solid var(--bd);border-radius:14px;padding:14px 16px;cursor:pointer;display:flex;align-items:center;gap:12px;transition:.2s} .case-card:active{transform:scale(.98);opacity:.8} .case-av{width:44px;height:44px;background:linear-gradient(135deg,#00d4ff15,#00d4ff30);border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:18px;flex-shrink:0} .case-info{flex:1;min-width:0} .case-meta{font-size:13px;color:var(--mu)} .case-chief{font-size:15px;font-weight:600;margin-top:2px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap} .empty{text-align:center;padding:60px 20px;color:var(--mu)} .snav{display:flex;background:var(--s1);border-bottom:1px solid var(--bd)} .sbtn{flex:1;padding:10px 4px;border:none;background:none;color:var(--mu);font-size:11px;cursor:pointer;display:flex;flex-direction:column;align-items:center;gap:2px;border-bottom:2px solid transparent;transition:.2s;font-family:inherit} .sbtn.act{color:var(--tx);border-bottom-color:var(--ac)}.sbtn.lck{opacity:.4;cursor:default} .sdot{width:8px;height:8px;border-radius:50%;background:var(--mu)}.sbtn.act .sdot{background:var(--ac)} .scont{padding:16px;flex:1;overflow-y:auto}.sc{overflow-y:auto;flex:1} .ic{background:var(--s1);border:1px solid var(--bd);border-radius:14px;padding:14px;margin-bottom:12px} .ic-t{font-size:11px;text-transform:uppercase;letter-spacing:1px;color:var(--mu);margin-bottom:8px;display:flex;align-items:center;gap:6px} .ic-t span{font-size:14px}.ic-b{font-size:14px;line-height:1.7} .chat-wrap{background:var(--s1);border:1px solid var(--bd);border-radius:14px;overflow:hidden;margin-bottom:12px} .chat-msgs{max-height:280px;overflow-y:auto;padding:12px;display:flex;flex-direction:column;gap:10px} .msg{max-width:85%}.msg.user{align-self:flex-end}.msg.ai{align-self:flex-start} .msg-lbl{font-size:10px;color:var(--mu);margin-bottom:3px} .bbl{padding:10px 13px;border-radius:14px;font-size:13px;line-height:1.6} .msg.user .bbl{background:var(--ac);color:#000;border-bottom-right-radius:4px} .msg.ai .bbl{background:var(--s2);border:1px solid var(--bd);border-bottom-left-radius:4px} .chat-inp-row{display:flex;border-top:1px solid var(--bd)} .chat-inp{flex:1;background:none;border:none;padding:10px 12px;color:var(--tx);font-size:13px;font-family:inherit;outline:none;resize:none} .chat-inp::placeholder{color:var(--mu)} .chat-send{background:var(--ac);color:#000;border:none;padding:0 14px;cursor:pointer;font-size:16px;font-weight:700} .chat-send:disabled{opacity:.4;cursor:default} .btn{width:100%;padding:14px;border:none;border-radius:14px;font-size:15px;font-weight:600;font-family:inherit;cursor:pointer;margin-bottom:10px;display:flex;align-items:center;justify-content:center;gap:8px;transition:.2s} .btn:active{transform:scale(.98)}.btn-ac{background:var(--ac);color:#000}.btn-c2{background:var(--c2);color:#fff} .btn-c3{background:var(--c3);color:#000}.btn-err{background:var(--err);color:#fff}.btn-ol{background:none;border:1px solid var(--bd);color:var(--tx)} .egrid{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:14px} .ebtn{background:var(--s1);border:1px solid var(--bd);border-radius:12px;padding:10px;cursor:pointer;text-align:center;color:var(--tx);font-size:12px;font-family:inherit;transition:.2s} .ebtn:active{opacity:.7}.ebtn.sel{border-color:var(--c3);color:var(--c3)}.eico{font-size:20px;margin-bottom:4px} .rc{background:linear-gradient(135deg,#00e67610,#00e67620);border:1px solid #00e67640;border-radius:14px;padding:14px;margin-bottom:12px} .rc-t{font-size:12px;color:var(--ok);font-weight:600;margin-bottom:6px}.rc-b{font-size:13px;line-height:1.7} .dx{background:linear-gradient(135deg,#00d4ff10,#ff6b3510);border:1px solid #00d4ff30;border-radius:16px;padding:20px;text-align:center;margin-bottom:16px} .dx-lbl{font-size:11px;color:var(--mu);text-transform:uppercase;letter-spacing:1px}.dx-name{font-size:20px;font-weight:700;color:var(--ac);margin-top:6px} .exp{background:var(--s1);border:1px solid var(--bd);border-radius:14px;padding:16px;font-size:13px;line-height:1.8} .exp h2{font-size:16px;color:var(--ac);margin:16px 0 8px}.exp h3{font-size:14px;color:var(--c2);margin:12px 0 6px} .exp p{margin-bottom:10px}.exp ul{padding-left:18px;margin-bottom:10px}.exp li{margin-bottom:4px}.exp strong{color:var(--warn)} .thk{background:var(--s2);border-left:3px solid var(--ac);border-radius:0 10px 10px 0;padding:12px;margin-bottom:12px;font-size:13px;color:var(--tx);white-space:pre-wrap;line-height:1.7} .thk-t{font-size:11px;color:var(--ac);font-weight:600;margin-bottom:6px} .bdg{display:inline-flex;align-items:center;gap:4px;padding:3px 10px;border-radius:20px;font-size:11px;font-weight:600;margin-bottom:12px} .b1{background:#00d4ff15;color:var(--c1);border:1px solid #00d4ff30}.b2{background:#a78bfa15;color:var(--c2);border:1px solid #a78bfa30} .b3{background:#34d39915;color:var(--c3);border:1px solid #34d39930}.b4{background:#ff6b3515;color:var(--ac2);border:1px solid #ff6b3530} .adm-sec{padding:16px}.fg{margin-bottom:14px}.fl{font-size:12px;color:var(--mu);margin-bottom:6px;display:block} .fi,.fta,.fsel{width:100%;background:var(--s1);border:1px solid var(--bd);border-radius:10px;padding:10px 12px;color:var(--tx);font-size:14px;font-family:inherit;outline:none} .fta{resize:vertical;min-height:80px}.fi:focus,.fta:focus{border-color:var(--ac)} .sdiv{font-size:12px;text-transform:uppercase;letter-spacing:1px;color:var(--ac);padding:10px 0 6px;border-bottom:1px solid var(--bd);margin:16px 0 14px} .pw{min-height:100vh;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:24px;background:var(--bg)} .pw-ico{font-size:48px;margin-bottom:16px}.pw-t{font-size:18px;font-weight:700;margin-bottom:24px}.pw-err{color:var(--err);font-size:13px;margin-top:8px} .ld{display:inline-flex;gap:4px;align-items:center} .ld span{width:6px;height:6px;border-radius:50%;background:var(--ac);animation:pulse 1s ease-in-out infinite} .ld span:nth-child(2){animation-delay:.2s}.ld span:nth-child(3){animation-delay:.4s} @keyframes pulse{0%,100%{opacity:.3;transform:scale(.8)}50%{opacity:1;transform:scale(1.2)}} .rsec{margin-top:16px}.rsec-t{font-size:13px;font-weight:600;color:var(--ac);margin-bottom:10px}`;

function Dots() { return <div className="ld"><span/><span/><span/></div>; }

function renderMD(text) {
if (!text) return null;
return text.split(”\n”).map((line, i) => {
if (line.startsWith(”## “)) return <h2 key={i}>{line.slice(3)}</h2>;
if (line.startsWith(”### “)) return <h3 key={i}>{line.slice(4)}</h3>;
if (line.startsWith(”- “)) {
const html = line.slice(2).replace(/**(.+?)**/g, “<strong>$1</strong>”);
return <li key={i} dangerouslySetInnerHTML={{__html: html}}/>;
}
if (!line.trim()) return <br key={i}/>;
const html = line.replace(/**(.+?)**/g, “<strong>$1</strong>”);
return <p key={i} dangerouslySetInnerHTML={{__html: html}}/>;
});
}

function Chat({ messages, onSend, loading, placeholder }) {
const [input, setInput] = useState(””);
const bottom = useRef(null);
useEffect(() => { bottom.current?.scrollIntoView({behavior:“smooth”}); }, [messages, loading]);
const send = () => { if (!input.trim() || loading) return; onSend(input.trim()); setInput(””); };
return (
<div className="chat-wrap">
<div className="chat-msgs">
{messages.length === 0 && <div style={{color:“var(–mu)”,fontSize:12,textAlign:“center”,padding:“12px 0”}}>ここに質問・診察内容を入力してください</div>}
{messages.map((m, i) => (
<div key={i} className={“msg “ + m.role}>
<div className="msg-lbl">{m.role === “user” ? “研修医” : “患者”}</div>
<div className="bbl">{m.content}</div>
</div>
))}
{loading && <div className="msg ai"><div className="msg-lbl">患者</div><div className="bbl"><Dots/></div></div>}
<div ref={bottom}/>
</div>
<div className="chat-inp-row">
<textarea className=“chat-inp” rows={2} placeholder={placeholder} value={input}
onChange={e => setInput(e.target.value)}
onKeyDown={e => { if (e.key===“Enter” && !e.shiftKey) { e.preventDefault(); send(); } }}/>
<button className=“chat-send” onClick={send} disabled={loading || !input.trim()}>▶</button>
</div>
</div>
);
}

function AdminLogin({ onLogin }) {
const [pw, setPw] = useState(””); const [err, setErr] = useState(””);
const go = () => { if (pw === ADMIN_PW) onLogin(); else setErr(“パスワードが違います”); };
return (
<div className="pw">
<div className="pw-ico">🔐</div>
<div className="pw-t">管理者ログイン</div>
<input className=“fi” type=“password” placeholder=“管理者パスワード” value={pw}
style={{maxWidth:280}} onChange={e => setPw(e.target.value)} onKeyDown={e => e.key===“Enter” && go()}/>
{err && <div className="pw-err">{err}</div>}
<button className="btn btn-ac" style={{marginTop:16,maxWidth:280}} onClick={go}>ログイン</button>
</div>
);
}

function AdminForm({ initial, onSave, onCancel }) {
const blank = {
age:””, sex:“男性”, chief_complaint:””,
stage1:{ems_info:””,vitals:””,last_meal:””,last_stool:””,ems_additional:””},
stage2:{history_info:””,physical_exam:””,additional_history:””},
stage3:{ecg:””,blood_gas:””,blood_test:””,urinalysis:””,echo:””,cxr:””,ct_plain:””,ct_contrast:””,head_ct:””},
diagnosis:””, explanation:””
};
const [f, setF] = useState(initial || blank);
const set = (path, val) => {
setF(prev => {
const n = JSON.parse(JSON.stringify(prev));
const p = path.split(”.”); let o = n;
for (let i = 0; i < p.length-1; i++) o = o[p[i]];
o[p[p.length-1]] = val; return n;
});
};
const get = path => path.split(”.”).reduce((o,k) => o[k], f);
const F = ({label, path, ta}) => (
<div className="fg">
<label className="fl">{label}</label>
{ta ? <textarea className=“fta” value={get(path)} onChange={e => set(path, e.target.value)}/>
: <input className=“fi” value={get(path)} onChange={e => set(path, e.target.value)}/>}
</div>
);
return (
<div className="adm-sec">
<div className="sdiv">📋 基本情報</div>
<div style={{display:“flex”,gap:8}}>
<div className="fg" style={{flex:1}}><label className="fl">年齢</label>
<input className=“fi” type=“number” value={f.age} onChange={e => set(“age”,e.target.value)}/></div>
<div className="fg" style={{flex:1}}><label className="fl">性別</label>
<select className=“fsel” value={f.sex} onChange={e => set(“sex”,e.target.value)}>
<option>男性</option><option>女性</option></select></div>
</div>
<F label="主訴" path="chief_complaint"/>
<div className="sdiv">🚑 第1段階：救急隊情報</div>
<F label="救急隊からの情報・現病歴" path="stage1.ems_info" ta/>
<F label="バイタルサイン" path="stage1.vitals" ta/>
<F label="最終食事" path="stage1.last_meal"/>
<F label="最終排便" path="stage1.last_stool"/>
<F label="追加情報（既往歴・内服薬等）" path="stage1.ems_additional" ta/>
<div className="sdiv">🏥 第2段階：来院時情報</div>
<F label="追加問診情報（症状の詳細）" path="stage2.history_info" ta/>
<F label="身体診察所見" path="stage2.physical_exam" ta/>
<F label="その他の追加病歴" path="stage2.additional_history" ta/>
<div className="sdiv">🔬 第3段階：検査結果</div>
<F label="心電図" path="stage3.ecg" ta/>
<F label="血液ガス" path="stage3.blood_gas" ta/>
<F label="採血結果" path="stage3.blood_test" ta/>
<F label="検尿" path="stage3.urinalysis" ta/>
<F label="ベッドサイドエコー" path="stage3.echo" ta/>
<F label="胸部X線" path="stage3.cxr" ta/>
<F label="胸腹部単純CT" path="stage3.ct_plain" ta/>
<F label="胸腹部造影CT" path="stage3.ct_contrast" ta/>
<F label="頭部CT" path="stage3.head_ct" ta/>
<div className="sdiv">✅ 診断・解説</div>
<F label="確定診断" path="diagnosis"/>
<F label="解説（Markdown可）" path="explanation" ta/>
<button className=“btn btn-ac” onClick={() => onSave(f)}>💾 保存</button>
<button className="btn btn-ol" onClick={onCancel} style={{marginBottom:40}}>キャンセル</button>
</div>
);
}

function AdminScreen({ cases, setCases, onBack }) {
const [view, setView] = useState(“list”); const [editing, setEditing] = useState(null);
const save = f => {
const updated = editing ? cases.map(c => c.id===editing.id ? {…f,id:editing.id} : c) : […cases, {…f,id:Date.now().toString()}];
saveCases(updated); setCases(updated); setView(“list”);
};
const del = id => {
if (!window.confirm(“この症例を削除しますか？”)) return;
const updated = cases.filter(c => c.id!==id); saveCases(updated); setCases(updated);
};
if (view !== “list”) return (
<div className="app">
<div className="hdr"><button className=“hdr-back” onClick={() => setView(“list”)}>← 戻る</button>
<div className="hdr-title">{view===“add” ? “症例登録” : “症例編集”}</div></div>
<div className="sc"><AdminForm initial={editing} onSave={save} onCancel={() => setView(“list”)}/></div>
</div>
);
return (
<div className="app">
<div className="hdr"><button className="hdr-back" onClick={onBack}>← 戻る</button>
<div className="hdr-title">🔐 管理者</div><div className="hdr-badge">{cases.length}件</div></div>
<div className="sc"><div className="case-list">
<button className=“btn btn-ac” onClick={() => { setEditing(null); setView(“add”); }}>＋ 新規症例を登録</button>
{cases.length===0 && <div className="empty">登録された症例がありません</div>}
{cases.map(c => (
<div key={c.id} className=“case-card” style={{flexDirection:“column”,alignItems:“flex-start”,gap:8}}>
<div style={{display:“flex”,width:“100%”,alignItems:“center”,gap:10}}>
<div className="case-av">{c.sex===“男性”?“👨”:“👩”}</div>
<div className="case-info"><div className="case-meta">{c.age}歳 {c.sex}</div>
<div className="case-chief">{c.chief_complaint}</div></div>
</div>
<div style={{display:“flex”,gap:8,width:“100%”}}>
<button className=“btn btn-ol” style={{flex:1,marginBottom:0,padding:“8px”}}
onClick={() => { setEditing(c); setView(“edit”); }}>✏️ 編集</button>
<button className=“btn btn-err” style={{flex:1,marginBottom:0,padding:“8px”}}
onClick={() => del(c.id)}>🗑 削除</button>
</div>
</div>
))}
</div></div>
</div>
);
}

const EXAMS = [
{key:“ecg”,icon:“📈”,label:“心電図”},{key:“blood_gas”,icon:“🩸”,label:“血液ガス”},
{key:“blood_test”,icon:“🧪”,label:“採血”},{key:“urinalysis”,icon:“🔬”,label:“検尿”},
{key:“echo”,icon:“📡”,label:“エコー”},{key:“cxr”,icon:“🫁”,label:“胸部X線”},
{key:“ct_plain”,icon:“💻”,label:“単純CT”},{key:“ct_contrast”,icon:“💉”,label:“造影CT”},
{key:“head_ct”,icon:“🧠”,label:“頭部CT”},
];

function CaseStudy({ c, onBack }) {
const [stage, setStage] = useState(1);
const [unlocked, setUnlocked] = useState(1);
const [chat, setChat] = useState([]);
const [chatLoading, setChatLoading] = useState(false);
const [chatHist, setChatHist] = useState([]);
const [r1, setR1] = useState(””); const [l1, setL1] = useState(false);
const [r2, setR2] = useState(””); const [l2, setL2] = useState(false);
const [r3, setR3] = useState(””); const [l3, setL3] = useState(false);
const [selExams, setSelExams] = useState([]);
const [showDx, setShowDx] = useState(false);
const [showExp, setShowExp] = useState(false);
const unlock = n => setUnlocked(prev => Math.max(prev, n));

const genR1 = async () => {
setL1(true); setR1(””);
const sys = “あなたは救急医学の指導医です。研修医への教育的なフィードバックを日本語で簡潔に行ってください。”;
const msg = “救急外来で以下の情報が得られました。鑑別診断を3〜5つ挙げ、優先度と根拠、次に確認すべき事項を解説してください。\n\n救急隊情報: “ + c.stage1.ems_info + “\nバイタル: “ + c.stage1.vitals + “\n最終食事: “ + c.stage1.last_meal + “\n最終排便: “ + c.stage1.last_stool + “\n追加情報: “ + c.stage1.ems_additional;
setR1(await askClaude(sys, msg)); setL1(false);
};

const sendChat = async msg => {
setChatLoading(true);
setChat(prev => […prev, {role:“user”, content:msg}]);
const sys = “あなたは救急外来に搬送された患者です。研修医の問診・診察に患者として自然な日本語で答えてください。\n症状・問診情報: “ + c.stage2.history_info + “\n身体所見: “ + c.stage2.physical_exam + “\nその他: “ + c.stage2.additional_history + “\nルール: 患者として答える。聞かれていない情報は言わない。身体診察の質問には実施したと仮定して所見を答える。”;
const apiHist = chatHist.map(h => ({role: h.role===“ai”?“assistant”:“user”, content:h.content}));
const res = await askClaude(sys, msg, apiHist);
setChat(prev => […prev, {role:“ai”, content:res}]);
setChatHist(prev => […prev, {role:“user”,content:msg}, {role:“ai”,content:res}]);
setChatLoading(false);
};

const genR2 = async () => {
setL2(true); setR2(””);
const sys = “あなたは救急医学の指導医です。研修医への教育的なフィードバックを日本語で簡潔に行ってください。”;
const msg = “患者来院後の追加情報です。鑑別の変化、絞り込みの根拠、必要な検査とその理由を解説してください。\n\n追加問診: “ + c.stage2.history_info + “\n身体診察: “ + c.stage2.physical_exam + “\n追加病歴: “ + c.stage2.additional_history;
setR2(await askClaude(sys, msg)); setL2(false);
};

const toggleExam = key => setSelExams(prev => prev.includes(key) ? prev.filter(k=>k!==key) : […prev,key]);

const genR3 = async () => {
setL3(true); setR3(””);
const sys = “あなたは救急医学の指導医です。研修医への教育的なフィードバックを日本語で簡潔に行ってください。”;
const results = selExams.map(k => { const e=EXAMS.find(x=>x.key===k); return e.label+”: “+(c.stage3[k]||“データなし”); }).join(”\n”);
setR3(await askClaude(sys, “以下の検査結果から確定診断の根拠と鑑別の絞り込み過程を解説してください。\n\n”+results)); setL3(false);
};

return (
<div className="app">
<div className="hdr">
<button className="hdr-back" onClick={onBack}>← 戻る</button>
<div className="hdr-title" style={{fontSize:13}}>{c.age}歳 {c.sex}・{c.chief_complaint}</div>
</div>
<div className="snav">
{[1,2,3,4].map(n => {
const lck = n > unlocked;
return <button key={n} className={“sbtn”+(stage===n?” act”:””)+(lck?” lck”:””)} onClick={() => !lck && setStage(n)}>
<div className="sdot"/>{“第”+n+“段階”}</button>;
})}
</div>
<div className="sc"><div className="scont">
{stage===1 && <>
<div className="bdg b1">🚑 第1段階：救急隊情報</div>
<div className="ic"><div className="ic-t"><span>📻</span>救急隊からの情報</div><div className="ic-b">{c.stage1.ems_info}</div></div>
<div className="ic"><div className="ic-t"><span>📊</span>バイタルサイン</div><div className=“ic-b” style={{fontFamily:“monospace”,fontSize:13}}>{c.stage1.vitals}</div></div>
<div className="ic"><div className="ic-t"><span>🍱</span>最終食事・排便</div><div className="ic-b">食事：{c.stage1.last_meal}　排便：{c.stage1.last_stool}</div></div>
{c.stage1.ems_additional && <div className="ic"><div className="ic-t"><span>📋</span>追加情報</div><div className="ic-b">{c.stage1.ems_additional}</div></div>}
<div className="rsec">
<div className="rsec-t">💡 AIによる臨床推論解説</div>
{!r1 && !l1 && <button className="btn btn-ac" onClick={genR1}>🧠 臨床推論を生成</button>}
{l1 && <div className="thk"><div className="thk-t">考察中…</div><Dots/></div>}
{r1 && <div className="thk">{r1}</div>}
</div>
<button className=“btn btn-c2” onClick={() => { setStage(2); unlock(2); }}>次へ：来院時対応 →</button>
</>}
{stage===2 && <>
<div className="bdg b2">🏥 第2段階：来院時対応</div>
<div className="rsec">
<div className="rsec-t">🗣️ 問診・身体診察（AI患者に質問）</div>
<Chat messages={chat} onSend={sendChat} loading={chatLoading} placeholder="例：胸痛はどのような痛みですか？／胸部を聴診します"/>
</div>
<div className="rsec">
<div className="rsec-t">💡 AIによる臨床推論解説</div>
{!r2 && !l2 && <button className="btn btn-c2" onClick={genR2}>🧠 臨床推論を生成</button>}
{l2 && <div className="thk"><div className="thk-t">考察中…</div><Dots/></div>}
{r2 && <div className="thk">{r2}</div>}
</div>
<button className=“btn btn-c3” onClick={() => { setStage(3); unlock(3); }}>次へ：検査オーダー →</button>
</>}
{stage===3 && <>
<div className="bdg b3">🔬 第3段階：検査・診断</div>
<div style={{marginBottom:12,fontSize:13,color:“var(–mu)”}}>必要と思う検査を選択してください</div>
<div className="egrid">
{EXAMS.map(e => <button key={e.key} className={“ebtn”+(selExams.includes(e.key)?” sel”:””)} onClick={() => toggleExam(e.key)}>
<div className="eico">{e.icon}</div>{e.label}</button>)}
</div>
{selExams.length > 0 && <>
{selExams.map(k => { const e=EXAMS.find(x=>x.key===k);
return <div key={k} className="rc"><div className="rc-t">{e.icon} {e.label}</div>
<div className="rc-b">{c.stage3[k]||“この検査データは登録されていません”}</div></div>; })}
<div className="rsec">
<div className="rsec-t">💡 検査結果に基づく臨床推論</div>
{!r3 && !l3 && <button className="btn btn-c3" onClick={genR3}>🧠 推論を生成</button>}
{l3 && <div className="thk"><div className="thk-t">考察中…</div><Dots/></div>}
{r3 && <div className="thk">{r3}</div>}
</div>
</>}
<button className=“btn btn-ac” onClick={() => { setStage(4); unlock(4); setShowDx(true); }}>✅ 確定診断を確認する →</button>
</>}
{stage===4 && <>
<div className="bdg b4">✅ 第4段階：確定診断・解説</div>
{showDx && <div className="dx"><div className="dx-lbl">確定診断</div><div className="dx-name">🏥 {c.diagnosis}</div></div>}
{!showExp && <button className=“btn btn-ac” onClick={() => setShowExp(true)}>📖 疾患解説を読む</button>}
{showExp && <div className="exp">{renderMD(c.explanation)}</div>}
<div style={{height:40}}/>
</>}
</div></div>
</div>
);
}

export default function App() {
const [screen, setScreen] = useState(“home”);
const [cases, setCases] = useState(() => { const s=loadCases(); if(s.length===0){saveCases(DEMO);return DEMO;} return s; });
const [sel, setSel] = useState(null);
const [adminOk, setAdminOk] = useState(false);

return <>
<style>{S}</style>
{screen===“home” &&
<div className="app"><div className="sc"><div className="home">
<div className="logo">
<div className="logo-icon">🚑</div>
<div className="logo-t">ER Training</div>
<div className="logo-s">救急臨床推論トレーニング</div>
</div>
<div className="menu-grid">
<div className=“menu-card res” onClick={() => setScreen(“resident”)}>
<div className="menu-icon">👨‍⚕️</div>
<div><div className="menu-lbl">研修医モード</div><div className="menu-dsc">症例を選んで臨床推論を学ぶ</div></div>
<div className="menu-arr">›</div>
</div>
<div className=“menu-card adm” onClick={() => setScreen(“admin”)}>
<div className="menu-icon">🔐</div>
<div><div className="menu-lbl">管理者モード</div><div className="menu-dsc">症例の登録・編集・削除</div></div>
<div className="menu-arr">›</div>
</div>
</div>
<div style={{marginTop:24,padding:16,background:“var(–s1)”,borderRadius:14,border:“1px solid var(–bd)”}}>
<div style={{fontSize:12,color:“var(–mu)”,marginBottom:8}}>📖 使い方</div>
<div style={{fontSize:13,lineHeight:1.7}}>①管理者が症例を登録<br/>②研修医が症例一覧から選択<br/>③3段階で臨床推論を進める<br/>④AIが患者役・指導医役として支援</div>
</div>
</div></div></div>}
{screen===“resident” && !sel &&
<div className="app">
<div className="hdr"><button className=“hdr-back” onClick={() => setScreen(“home”)}>← 戻る</button>
<div className="hdr-title">症例一覧</div><div className="hdr-badge">{cases.length}件</div></div>
<div className="sc"><div className="case-list">
{cases.length===0 && <div className="empty">症例が登録されていません</div>}
{cases.map(c => (
<div key={c.id} className=“case-card” onClick={() => setSel(c)}>
<div className="case-av">{c.sex===“男性”?“👨”:“👩”}</div>
<div className="case-info"><div className="case-meta">{c.age}歳 {c.sex}</div>
<div className="case-chief">{c.chief_complaint}</div></div>
<div style={{color:“var(–ac)”,fontSize:20}}>›</div>
</div>
))}
</div></div>
</div>}
{screen===“resident” && sel && <CaseStudy c={sel} onBack={() => setSel(null)}/>}
{screen===“admin” && !adminOk && <AdminLogin onLogin={() => setAdminOk(true)}/>}
{screen===“admin” && adminOk && <AdminScreen cases={cases} setCases={setCases} onBack={() => { setScreen(“home”); setAdminOk(false); }}/>}
</>;
}
