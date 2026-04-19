import { useState, useRef, useEffect } from "react";

const STORAGE_KEY = "emr_cases_v5";
const ADMIN_PW = "admin1234";

function loadCases() {
  try { var r = localStorage.getItem(STORAGE_KEY); return r ? JSON.parse(r) : []; } catch(e) { return []; }
}
function saveCases(c) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(c)); } catch(e) {}
}

var DEMO = [{
  id: "demo1", age: 68, sex: "男性", chief_complaint: "突然の胸痛",
  stage1: {
    ems_info: "68歳男性。本日15時頃、自宅で突然の前胸部圧迫感が出現。冷汗あり。救急要請。",
    vitals: "血圧 185/110 mmHg、脈拍 92回/分・整、SpO2 94%（室内気）、体温 36.8℃、呼吸数 20回/分",
    last_meal: "本日12時（昼食）", last_stool: "昨日",
    ems_additional: "既往歴：高血圧、脂質異常症。内服：アムロジピン、ロスバスタチン。喫煙歴：20本/日×40年。"
  },
  stage2: {
    history_info: "胸痛は前胸部中央、重い感じ。左肩・左腕にも広がる。安静にしても改善なし。NRS 8/10。嘔気あり。動悸は自覚なし。",
    physical_exam: "意識清明。顔面蒼白・冷汗あり。頸静脈怒張なし。心音：整、雑音なし。呼吸音：両側清明。腹部：軟、圧痛なし。下肢浮腫なし。",
    additional_history: "狭心症の指摘は過去になし。家族歴：父が60代で心筋梗塞。"
  },
  stage3: {
    ecg: "洞調律 92bpm。II・III・aVFでST上昇（2mm）。reciprocal changeとしてI・aVLでST低下。", ecg_image: "",
    blood_gas: "pH 7.42、PaCO2 38、PaO2 72、HCO3 24.5、Lac 2.1", blood_gas_image: "",
    blood_test: "WBC 9800、Hb 14.2、Plt 22万、CRP 0.3、CK 285↑、CK-MB 28↑、TnI 0.8↑、BNP 45、Cr 0.9", blood_test_image: "",
    urinalysis: "異常なし", urinalysis_image: "",
    echo: "下壁・後壁の壁運動低下。EF 45%。心嚢液なし。", echo_image: "",
    cxr: "心陰影やや拡大。肺うっ血なし。大動脈拡張なし。", cxr_image: "",
    ct_plain: "施行せず（緊急カテーテル優先）", ct_plain_image: "",
    ct_contrast: "施行せず", ct_contrast_image: "",
    head_ct: "施行せず", head_ct_image: ""
  },
  diagnosis: "急性下壁心筋梗塞（STEMI）",
  explanation: "## 急性心筋梗塞（STEMI）\n\n### 疾患概要\n急性心筋梗塞は冠動脈の完全閉塞による心筋壊死で、STEMI（ST上昇型）とNSTEMI（非ST上昇型）に分類される。本症例は右冠動脈（RCA）急性閉塞による下壁STEMIの典型例。\n\n### 診断のポイント\n- **症状**：前胸部圧迫感・放散痛（左肩・左腕）、冷汗、嘔気\n- **心電図**：II・III・aVFのST上昇＋reciprocal change\n- **心筋逸脱酵素**：CK・CK-MB・トロポニン上昇\n- **心エコー**：責任領域の壁運動低下\n\n### 治療\n1. **Door-to-Balloon time 90分以内**を目標に緊急PCI\n2. 抗血小板薬（アスピリン＋P2Y12阻害薬）のDAPT\n3. 抗凝固療法（ヘパリン）\n4. 酸素投与（SpO2 < 90%の場合）\n5. 硝酸薬（右室梗塞合併時は禁忌）\n\n### 合併症\n- 心原性ショック、心室細動、完全房室ブロック（下壁梗塞で多い）\n- 心室瘤、乳頭筋断裂、心室中隔穿孔（亜急性期）\n\n### 予後・フォロー\n再灌流成功例の院内死亡率は約5%。退院後はDAPT継続、心臓リハビリ、二次予防（スタチン・ACE阻害薬）が重要。"
}];

async function askClaude(system, userMsg, history, imageUrl) {
  if (!history) history = [];
  try {
    var res = await fetch("/api/ai", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ system: system, userMsg: userMsg, history: history, imageUrl: imageUrl || null })
    });
    var data = await res.json();
    return data.text || "(応答なし)";
  } catch(e) {
    return "[エラー] " + e.message;
  }
}

var S = [
  "@import url('https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@400;500;600;700&display=swap');",
  "*{box-sizing:border-box;margin:0;padding:0}",
  ":root{--bg:#0a0e1a;--s1:#111827;--s2:#1a2236;--bd:#1e2d45;--ac:#00d4ff;--ac2:#ff6b35;--ok:#00e676;--warn:#ffab40;--err:#ff5252;--tx:#e8edf5;--mu:#6b7fa3;--c1:#00d4ff;--c2:#a78bfa;--c3:#34d399;}",
  "body,#root{font-family:'Noto Sans JP',sans-serif;background:var(--bg);color:var(--tx);min-height:100vh;max-width:430px;margin:0 auto}",
  ".app{min-height:100vh;display:flex;flex-direction:column}",
  ".hdr{background:linear-gradient(135deg,#0d1b2e,#111827);border-bottom:1px solid var(--bd);padding:12px 16px;display:flex;align-items:center;gap:10px;position:sticky;top:0;z-index:100}",
  ".hdr-back{background:none;border:1px solid var(--bd);color:var(--ac);padding:6px 10px;border-radius:8px;cursor:pointer;font-size:13px;font-family:inherit}",
  ".hdr-title{font-size:15px;font-weight:600;flex:1}",
  ".hdr-badge{background:var(--ac);color:#000;padding:2px 8px;border-radius:20px;font-size:11px;font-weight:700}",
  ".home{padding:20px 16px}",
  ".logo{text-align:center;padding:30px 0 24px}",
  ".logo-icon{width:72px;height:72px;background:linear-gradient(135deg,#00d4ff15,#00d4ff30);border:2px solid var(--ac);border-radius:20px;display:flex;align-items:center;justify-content:center;font-size:32px;margin:0 auto 12px}",
  ".logo-t{font-size:22px;font-weight:700;color:var(--ac)}",
  ".logo-s{font-size:12px;color:var(--mu);margin-top:4px}",
  ".menu-grid{display:flex;flex-direction:column;gap:12px}",
  ".menu-card{background:var(--s1);border:1px solid var(--bd);border-radius:16px;padding:18px;cursor:pointer;display:flex;align-items:center;gap:14px;position:relative;overflow:hidden;transition:.2s}",
  ".menu-card:active{transform:scale(.98)}",
  ".menu-card::before{content:'';position:absolute;left:0;top:0;bottom:0;width:4px;border-radius:4px 0 0 4px}",
  ".menu-card.res::before{background:var(--ac)}.menu-card.adm::before{background:var(--ac2)}",
  ".menu-icon{font-size:28px}.menu-lbl{font-size:16px;font-weight:600}.menu-dsc{font-size:12px;color:var(--mu);margin-top:2px}.menu-arr{margin-left:auto;color:var(--mu)}",
  ".case-list{padding:16px;display:flex;flex-direction:column;gap:10px}",
  ".case-card{background:var(--s1);border:1px solid var(--bd);border-radius:14px;padding:14px 16px;cursor:pointer;display:flex;align-items:center;gap:12px;transition:.2s}",
  ".case-card:active{transform:scale(.98);opacity:.8}",
  ".case-av{width:44px;height:44px;background:linear-gradient(135deg,#00d4ff15,#00d4ff30);border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:18px;flex-shrink:0}",
  ".case-info{flex:1;min-width:0}",
  ".case-meta{font-size:13px;color:var(--mu)}",
  ".case-chief{font-size:15px;font-weight:600;margin-top:2px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}",
  ".empty{text-align:center;padding:60px 20px;color:var(--mu)}",
  ".snav{display:flex;background:var(--s1);border-bottom:1px solid var(--bd)}",
  ".sbtn{flex:1;padding:10px 4px;border:none;background:none;color:var(--mu);font-size:11px;cursor:pointer;display:flex;flex-direction:column;align-items:center;gap:2px;border-bottom:2px solid transparent;transition:.2s;font-family:inherit}",
  ".sbtn.act{color:var(--tx);border-bottom-color:var(--ac)}.sbtn.lck{opacity:.4;cursor:default}",
  ".sdot{width:8px;height:8px;border-radius:50%;background:var(--mu)}.sbtn.act .sdot{background:var(--ac)}",
  ".scont{padding:16px;flex:1;overflow-y:auto}.sc{overflow-y:auto;flex:1}",
  ".ic{background:var(--s1);border:1px solid var(--bd);border-radius:14px;padding:14px;margin-bottom:12px}",
  ".ic-t{font-size:11px;text-transform:uppercase;letter-spacing:1px;color:var(--mu);margin-bottom:8px;display:flex;align-items:center;gap:6px}",
  ".ic-t span{font-size:14px}.ic-b{font-size:14px;line-height:1.7}",
  ".chat-wrap{background:var(--s1);border:1px solid var(--bd);border-radius:14px;overflow:hidden;margin-bottom:12px}",
  ".chat-msgs{max-height:280px;overflow-y:auto;padding:12px;display:flex;flex-direction:column;gap:10px}",
  ".msg{max-width:85%}.msg.user{align-self:flex-end}.msg.ai{align-self:flex-start}",
  ".msg-lbl{font-size:10px;color:var(--mu);margin-bottom:3px}",
  ".bbl{padding:10px 13px;border-radius:14px;font-size:13px;line-height:1.6}",
  ".msg.user .bbl{background:var(--ac);color:#000;border-bottom-right-radius:4px}",
  ".msg.ai .bbl{background:var(--s2);border:1px solid var(--bd);border-bottom-left-radius:4px}",
  ".chat-inp-row{display:flex;border-top:1px solid var(--bd)}",
  ".chat-inp{flex:1;background:none;border:none;padding:10px 12px;color:var(--tx);font-size:13px;font-family:inherit;outline:none;resize:none}",
  ".chat-inp::placeholder{color:var(--mu)}",
  ".chat-send{background:var(--ac);color:#000;border:none;padding:0 14px;cursor:pointer;font-size:16px;font-weight:700}",
  ".chat-send:disabled{opacity:.4;cursor:default}",
  ".btn{width:100%;padding:14px;border:none;border-radius:14px;font-size:15px;font-weight:600;font-family:inherit;cursor:pointer;margin-bottom:10px;display:flex;align-items:center;justify-content:center;gap:8px;transition:.2s}",
  ".btn:active{transform:scale(.98)}.btn-ac{background:var(--ac);color:#000}.btn-c2{background:var(--c2);color:#fff}",
  ".btn-c3{background:var(--c3);color:#000}.btn-err{background:var(--err);color:#fff}.btn-ol{background:none;border:1px solid var(--bd);color:var(--tx)}",
  ".btn-sm{padding:8px 12px;font-size:13px;border-radius:10px;width:auto;margin-bottom:0}",
  ".btn-ocr{background:linear-gradient(135deg,var(--c2),var(--ac));color:#000;font-size:12px;padding:8px 12px;border-radius:10px;width:auto;margin-bottom:0;border:none;cursor:pointer;font-family:inherit;font-weight:600}",
  ".btn-ocr:disabled{opacity:.4;cursor:default}",
  ".egrid{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:14px}",
  ".ebtn{background:var(--s1);border:1px solid var(--bd);border-radius:12px;padding:10px;cursor:pointer;text-align:center;color:var(--tx);font-size:12px;font-family:inherit;transition:.2s}",
  ".ebtn:active{opacity:.7}.ebtn.sel{border-color:var(--c3);color:var(--c3)}.eico{font-size:20px;margin-bottom:4px}",
  ".rc{background:linear-gradient(135deg,#00e67610,#00e67620);border:1px solid #00e67640;border-radius:14px;padding:14px;margin-bottom:12px}",
  ".rc-t{font-size:12px;color:var(--ok);font-weight:600;margin-bottom:6px}.rc-b{font-size:13px;line-height:1.7}",
  ".exam-img{width:100%;border-radius:10px;margin-top:10px;border:1px solid var(--bd);cursor:pointer}",
  ".img-modal{position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,.92);z-index:1000;display:flex;align-items:center;justify-content:center;padding:16px}",
  ".img-modal img{max-width:100%;max-height:90vh;border-radius:10px}",
  ".img-modal-close{position:absolute;top:16px;right:16px;background:var(--ac);color:#000;border:none;border-radius:50%;width:36px;height:36px;font-size:18px;cursor:pointer;font-weight:700}",
  ".dx{background:linear-gradient(135deg,#00d4ff10,#ff6b3510);border:1px solid #00d4ff30;border-radius:16px;padding:20px;text-align:center;margin-bottom:16px}",
  ".dx-lbl{font-size:11px;color:var(--mu);text-transform:uppercase;letter-spacing:1px}.dx-name{font-size:20px;font-weight:700;color:var(--ac);margin-top:6px}",
  ".exp{background:var(--s1);border:1px solid var(--bd);border-radius:14px;padding:16px;font-size:13px;line-height:1.8}",
  ".exp h2{font-size:16px;color:var(--ac);margin:16px 0 8px}.exp h3{font-size:14px;color:var(--c2);margin:12px 0 6px}",
  ".exp p{margin-bottom:10px}.exp ul{padding-left:18px;margin-bottom:10px}.exp li{margin-bottom:4px}.exp strong{color:var(--warn)}",
  ".thk{background:var(--s2);border-left:3px solid var(--ac);border-radius:0 10px 10px 0;padding:12px;margin-bottom:12px;font-size:13px;color:var(--tx);white-space:pre-wrap;line-height:1.7}",
  ".thk-t{font-size:11px;color:var(--ac);font-weight:600;margin-bottom:6px}",
  ".bdg{display:inline-flex;align-items:center;gap:4px;padding:3px 10px;border-radius:20px;font-size:11px;font-weight:600;margin-bottom:12px}",
  ".b1{background:#00d4ff15;color:var(--c1);border:1px solid #00d4ff30}.b2{background:#a78bfa15;color:var(--c2);border:1px solid #a78bfa30}",
  ".b3{background:#34d39915;color:var(--c3);border:1px solid #34d39930}.b4{background:#ff6b3515;color:var(--ac2);border:1px solid #ff6b3530}",
  ".adm-sec{padding:16px}.fg{margin-bottom:14px}.fl{font-size:12px;color:var(--mu);margin-bottom:6px;display:block}",
  ".fi,.fta,.fsel{width:100%;background:var(--s1);border:1px solid var(--bd);border-radius:10px;padding:10px 12px;color:var(--tx);font-size:14px;font-family:inherit;outline:none}",
  ".fta{resize:vertical;min-height:80px}.fi:focus,.fta:focus{border-color:var(--ac)}",
  ".sdiv{font-size:12px;text-transform:uppercase;letter-spacing:1px;color:var(--ac);padding:10px 0 6px;border-bottom:1px solid var(--bd);margin:16px 0 14px}",
  ".ocr-row{display:flex;gap:8px;align-items:flex-start;margin-bottom:6px}",
  ".ocr-row .fi{flex:1}",
  ".ocr-hint{font-size:11px;color:var(--mu);margin-top:4px}",
  ".ocr-status{font-size:12px;color:var(--c2);margin-top:6px;font-style:italic}",
  ".pw{min-height:100vh;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:24px;background:var(--bg)}",
  ".pw-ico{font-size:48px;margin-bottom:16px}.pw-t{font-size:18px;font-weight:700;margin-bottom:24px}.pw-err{color:var(--err);font-size:13px;margin-top:8px}",
  ".ld{display:inline-flex;gap:4px;align-items:center}",
  ".ld span{width:6px;height:6px;border-radius:50%;background:var(--ac);animation:pulse 1s ease-in-out infinite}",
  ".ld span:nth-child(2){animation-delay:.2s}.ld span:nth-child(3){animation-delay:.4s}",
  "@keyframes pulse{0%,100%{opacity:.3;transform:scale(.8)}50%{opacity:1;transform:scale(1.2)}}",
  ".rsec{margin-top:16px}.rsec-t{font-size:13px;font-weight:600;color:var(--ac);margin-bottom:10px}"
].join("");

function Dots() {
  return React.createElement("div", { className: "ld" },
    React.createElement("span", null),
    React.createElement("span", null),
    React.createElement("span", null)
  );
}

function ImageModal(props) {
  if (!props.url) return null;
  return React.createElement("div", { className: "img-modal", onClick: props.onClose },
    React.createElement("button", { className: "img-modal-close", onClick: props.onClose }, "x"),
    React.createElement("img", { src: props.url, alt: "検査画像", onClick: function(e) { e.stopPropagation(); } })
  );
}

function renderMD(text) {
  if (!text) return null;
  return text.split("\n").map(function(line, i) {
    if (line.indexOf("## ") === 0) return React.createElement("h2", { key: i }, line.slice(3));
    if (line.indexOf("### ") === 0) return React.createElement("h3", { key: i }, line.slice(4));
    if (line.indexOf("- ") === 0) {
      var html = line.slice(2).replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
      return React.createElement("li", { key: i, dangerouslySetInnerHTML: { __html: html } });
    }
    if (!line.trim()) return React.createElement("br", { key: i });
    var html2 = line.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
    return React.createElement("p", { key: i, dangerouslySetInnerHTML: { __html: html2 } });
  });
}

function Chat(props) {
  var inputState = useState(""); var input = inputState[0]; var setInput = inputState[1];
  var bottom = useRef(null);
  useEffect(function() { if (bottom.current) bottom.current.scrollIntoView({ behavior: "smooth" }); }, [props.messages, props.loading]);
  function send() { if (!input.trim() || props.loading) return; props.onSend(input.trim()); setInput(""); }
  return React.createElement("div", { className: "chat-wrap" },
    React.createElement("div", { className: "chat-msgs" },
      props.messages.length === 0 && React.createElement("div", { style: { color: "var(--mu)", fontSize: 12, textAlign: "center", padding: "12px 0" } }, "ここに質問・診察内容を入力してください"),
      props.messages.map(function(m, i) {
        return React.createElement("div", { key: i, className: "msg " + m.role },
          React.createElement("div", { className: "msg-lbl" }, m.role === "user" ? "研修医" : "患者"),
          React.createElement("div", { className: "bbl" }, m.content)
        );
      }),
      props.loading && React.createElement("div", { className: "msg ai" },
        React.createElement("div", { className: "msg-lbl" }, "患者"),
        React.createElement("div", { className: "bbl" }, React.createElement(Dots, null))
      ),
      React.createElement("div", { ref: bottom })
    ),
    React.createElement("div", { className: "chat-inp-row" },
      React.createElement("textarea", {
        className: "chat-inp", rows: 2, placeholder: props.placeholder, value: input,
        onChange: function(e) { setInput(e.target.value); },
        onKeyDown: function(e) { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }
      }),
      React.createElement("button", { className: "chat-send", onClick: send, disabled: props.loading || !input.trim() }, "\u25b6")
    )
  );
}

function OcrField(props) {
  var urlState = useState(props.imgUrl || ""); var url = urlState[0]; var setUrl = urlState[1];
  var loadingState = useState(false); var loading = loadingState[0]; var setLoading = loadingState[1];
  var statusState = useState(""); var status = statusState[0]; var setStatus = statusState[1];

  function runOcr() {
    if (!url.trim()) { setStatus("URLを入力してください"); return; }
    setLoading(true);
    setStatus("AI文字起こし中...");
    var sys = "あなたは医療検査結果を読み取る専門家です。画像に含まれる検査データをすべて正確に文字起こしして、検査名・基準値・結果値・単位を整理して出力してください。異常値には↑または↓を付けてください。";
    askClaude(sys, "この検査結果画像を文字起こししてください。", [], url).then(function(res) {
      props.onResult(url, res);
      setStatus("文字起こし完了！所見欄に反映しました。画像はGoogle Driveから削除できます。");
      setLoading(false);
    });
  }

  return React.createElement("div", { className: "fg" },
    React.createElement("label", { className: "fl" }, props.label + " - 画像URL（文字起こし用・後で削除可）"),
    React.createElement("div", { className: "ocr-row" },
      React.createElement("input", {
        className: "fi", placeholder: "https://drive.google.com/...", value: url,
        onChange: function(e) { setUrl(e.target.value); props.onUrlChange(e.target.value); }
      }),
      React.createElement("button", { className: "btn-ocr", onClick: runOcr, disabled: loading || !url.trim() },
        loading ? React.createElement(Dots, null) : "AI文字起こし"
      )
    ),
    React.createElement("div", { className: "ocr-hint" }, "※文字起こし後はGoogle Driveから画像を削除できます"),
    status && React.createElement("div", { className: "ocr-status" }, status)
  );
}

function ImageField(props) {
  return React.createElement("div", { className: "fg" },
    React.createElement("label", { className: "fl" }, props.label + " - 画像URL（表示用・削除不可）"),
    React.createElement("input", {
      className: "fi", placeholder: "https://drive.google.com/...", value: props.value,
      onChange: function(e) { props.onChange(e.target.value); }
    }),
    React.createElement("div", { className: "ocr-hint" }, "※この画像は研修医に表示されます。匿名化済みの画像を使用してください。")
  );
}

function AdminLogin(props) {
  var pwState = useState(""); var pw = pwState[0]; var setPw = pwState[1];
  var errState = useState(""); var err = errState[0]; var setErr = errState[1];
  function go() { if (pw === ADMIN_PW) props.onLogin(); else setErr("パスワードが違います"); }
  return React.createElement("div", { className: "pw" },
    React.createElement("div", { className: "pw-ico" }, "\uD83D\uDD10"),
    React.createElement("div", { className: "pw-t" }, "管理者ログイン"),
    React.createElement("input", { className: "fi", type: "password", placeholder: "管理者パスワード", value: pw, style: { maxWidth: 280 }, onChange: function(e) { setPw(e.target.value); }, onKeyDown: function(e) { if (e.key === "Enter") go(); } }),
    err && React.createElement("div", { className: "pw-err" }, err),
    React.createElement("button", { className: "btn btn-ac", style: { marginTop: 16, maxWidth: 280 }, onClick: go }, "ログイン")
  );
}

function AdminForm(props) {
  var blank = {
    age: "", sex: "男性", chief_complaint: "",
    stage1: { ems_info: "", vitals: "", last_meal: "", last_stool: "", ems_additional: "" },
    stage2: { history_info: "", physical_exam: "", additional_history: "" },
    stage3: {
      ecg: "", ecg_image: "",
      blood_gas: "", blood_gas_image: "",
      blood_test: "", blood_test_image: "",
      urinalysis: "", urinalysis_image: "",
      echo: "", echo_image: "",
      cxr: "", cxr_image: "",
      ct_plain: "", ct_plain_image: "",
      ct_contrast: "", ct_contrast_image: "",
      head_ct: "", head_ct_image: ""
    },
    diagnosis: "", explanation: ""
  };
  var fState = useState(props.initial || blank); var f = fState[0]; var setF = fState[1];

  function set(path, val) {
    setF(function(prev) {
      var n = JSON.parse(JSON.stringify(prev));
      var p = path.split("."); var o = n;
      for (var i = 0; i < p.length - 1; i++) o = o[p[i]];
      o[p[p.length - 1]] = val; return n;
    });
  }
  function get(path) { return path.split(".").reduce(function(o, k) { return o[k]; }, f); }

  function F(fp) {
    return React.createElement("div", { className: "fg" },
      React.createElement("label", { className: "fl" }, fp.label),
      fp.ta
        ? React.createElement("textarea", { className: "fta", value: get(fp.path), onChange: function(e) { set(fp.path, e.target.value); } })
        : React.createElement("input", { className: "fi", value: get(fp.path), onChange: function(e) { set(fp.path, e.target.value); } })
    );
  }

  // テキスト所見 + OCRフィールド（採血・検尿・血液ガス）
  function OcrExamField(ep) {
    return React.createElement("div", null,
      React.createElement("div", { className: "fg" },
        React.createElement("label", { className: "fl" }, ep.label + " - 所見"),
        React.createElement("textarea", { className: "fta", value: get(ep.path), onChange: function(e) { set(ep.path, e.target.value); } })
      ),
      React.createElement(OcrField, {
        label: ep.label,
        imgUrl: get(ep.imgPath),
        onUrlChange: function(url) { set(ep.imgPath, url); },
        onResult: function(url, text) {
          set(ep.path, text);
          set(ep.imgPath, "");
        }
      })
    );
  }

  // テキスト所見 + 画像表示フィールド（心電図・画像系）
  function ImgExamField(ep) {
    return React.createElement("div", null,
      React.createElement("div", { className: "fg" },
        React.createElement("label", { className: "fl" }, ep.label + " - 所見"),
        React.createElement("textarea", { className: "fta", value: get(ep.path), onChange: function(e) { set(ep.path, e.target.value); } })
      ),
      React.createElement(ImageField, {
        label: ep.label,
        value: get(ep.imgPath),
        onChange: function(url) { set(ep.imgPath, url); }
      })
    );
  }

  return React.createElement("div", { className: "adm-sec" },
    React.createElement("div", { className: "sdiv" }, "\uD83D\uDCCB 基本情報"),
    React.createElement("div", { style: { display: "flex", gap: 8 } },
      React.createElement("div", { className: "fg", style: { flex: 1 } }, React.createElement("label", { className: "fl" }, "年齢"), React.createElement("input", { className: "fi", type: "number", value: f.age, onChange: function(e) { set("age", e.target.value); } })),
      React.createElement("div", { className: "fg", style: { flex: 1 } }, React.createElement("label", { className: "fl" }, "性別"), React.createElement("select", { className: "fsel", value: f.sex, onChange: function(e) { set("sex", e.target.value); } }, React.createElement("option", null, "男性"), React.createElement("option", null, "女性")))
    ),
    React.createElement(F, { label: "主訴", path: "chief_complaint" }),
    React.createElement("div", { className: "sdiv" }, "\uD83D\uDE91 第1段階：救急隊情報"),
    React.createElement(F, { label: "救急隊からの情報・現病歴", path: "stage1.ems_info", ta: true }),
    React.createElement(F, { label: "バイタルサイン", path: "stage1.vitals", ta: true }),
    React.createElement(F, { label: "最終食事", path: "stage1.last_meal" }),
    React.createElement(F, { label: "最終排便", path: "stage1.last_stool" }),
    React.createElement(F, { label: "追加情報（既往歴・内服薬等）", path: "stage1.ems_additional", ta: true }),
    React.createElement("div", { className: "sdiv" }, "\uD83C\uDFE5 第2段階：来院時情報"),
    React.createElement(F, { label: "追加問診情報", path: "stage2.history_info", ta: true }),
    React.createElement(F, { label: "身体診察所見", path: "stage2.physical_exam", ta: true }),
    React.createElement(F, { label: "その他の追加病歴", path: "stage2.additional_history", ta: true }),
    React.createElement("div", { className: "sdiv" }, "\uD83D\uDD2C 第3段階：検査結果"),
    React.createElement("div", { style: { background: "var(--s2)", borderRadius: 10, padding: 12, marginBottom: 12, fontSize: 12, color: "var(--mu)" } },
      "\uD83D\uDCA1 採血・検尿・血液ガスは画像URLを貼り付けて「AI文字起こし」ボタンを押すと自動入力されます。文字起こし後はGoogle Driveから画像を削除できます。"
    ),
    React.createElement(ImgExamField, { label: "心電図", path: "stage3.ecg", imgPath: "stage3.ecg_image" }),
    React.createElement(OcrExamField, { label: "血液ガス", path: "stage3.blood_gas", imgPath: "stage3.blood_gas_image" }),
    React.createElement(OcrExamField, { label: "採血", path: "stage3.blood_test", imgPath: "stage3.blood_test_image" }),
    React.createElement(OcrExamField, { label: "検尿", path: "stage3.urinalysis", imgPath: "stage3.urinalysis_image" }),
    React.createElement(ImgExamField, { label: "エコー", path: "stage3.echo", imgPath: "stage3.echo_image" }),
    React.createElement(ImgExamField, { label: "胸部X線", path: "stage3.cxr", imgPath: "stage3.cxr_image" }),
    React.createElement(ImgExamField, { label: "胸腹部単純CT", path: "stage3.ct_plain", imgPath: "stage3.ct_plain_image" }),
    React.createElement(ImgExamField, { label: "胸腹部造影CT", path: "stage3.ct_contrast", imgPath: "stage3.ct_contrast_image" }),
    React.createElement(ImgExamField, { label: "頭部CT", path: "stage3.head_ct", imgPath: "stage3.head_ct_image" }),
    React.createElement("div", { className: "sdiv" }, "\u2705 診断・解説"),
    React.createElement(F, { label: "確定診断", path: "diagnosis" }),
    React.createElement(F, { label: "解説（Markdown可）", path: "explanation", ta: true }),
    React.createElement("button", { className: "btn btn-ac", onClick: function() { props.onSave(f); } }, "\uD83D\uDCBE 保存"),
    React.createElement("button", { className: "btn btn-ol", onClick: props.onCancel, style: { marginBottom: 40 } }, "キャンセル")
  );
}

function AdminScreen(props) {
  var viewState = useState("list"); var view = viewState[0]; var setView = viewState[1];
  var editingState = useState(null); var editing = editingState[0]; var setEditing = editingState[1];
  function save(f) {
    var updated = editing
      ? props.cases.map(function(c) { return c.id === editing.id ? Object.assign({}, f, { id: editing.id }) : c; })
      : props.cases.concat([Object.assign({}, f, { id: Date.now().toString() })]);
    saveCases(updated); props.setCases(updated); setView("list");
  }
  function del(id) {
    if (!window.confirm("この症例を削除しますか？")) return;
    var updated = props.cases.filter(function(c) { return c.id !== id; });
    saveCases(updated); props.setCases(updated);
  }
  if (view !== "list") return React.createElement("div", { className: "app" },
    React.createElement("div", { className: "hdr" },
      React.createElement("button", { className: "hdr-back", onClick: function() { setView("list"); } }, "\u2190 \u623b\u308b"),
      React.createElement("div", { className: "hdr-title" }, view === "add" ? "症例登録" : "症例編集")
    ),
    React.createElement("div", { className: "sc" }, React.createElement(AdminForm, { initial: editing, onSave: save, onCancel: function() { setView("list"); } }))
  );
  return React.createElement("div", { className: "app" },
    React.createElement("div", { className: "hdr" },
      React.createElement("button", { className: "hdr-back", onClick: props.onBack }, "\u2190 \u623b\u308b"),
      React.createElement("div", { className: "hdr-title" }, "\uD83D\uDD10 管理者"),
      React.createElement("div", { className: "hdr-badge" }, props.cases.length + "件")
    ),
    React.createElement("div", { className: "sc" }, React.createElement("div", { className: "case-list" },
      React.createElement("button", { className: "btn btn-ac", onClick: function() { setEditing(null); setView("add"); } }, "\uff0b 新規症例を登録"),
      props.cases.length === 0 && React.createElement("div", { className: "empty" }, "登録された症例がありません"),
      props.cases.map(function(c) {
        return React.createElement("div", { key: c.id, className: "case-card", style: { flexDirection: "column", alignItems: "flex-start", gap: 8 } },
          React.createElement("div", { style: { display: "flex", width: "100%", alignItems: "center", gap: 10 } },
            React.createElement("div", { className: "case-av" }, c.sex === "男性" ? "\uD83D\uDC68" : "\uD83D\uDC69"),
            React.createElement("div", { className: "case-info" },
              React.createElement("div", { className: "case-meta" }, c.age + "歳 " + c.sex),
              React.createElement("div", { className: "case-chief" }, c.chief_complaint)
            )
          ),
          React.createElement("div", { style: { display: "flex", gap: 8, width: "100%" } },
            React.createElement("button", { className: "btn btn-ol", style: { flex: 1, marginBottom: 0, padding: "8px" }, onClick: function() { setEditing(c); setView("edit"); } }, "\u270f\ufe0f 編集"),
            React.createElement("button", { className: "btn btn-err", style: { flex: 1, marginBottom: 0, padding: "8px" }, onClick: function() { del(c.id); } }, "\uD83D\uDDD1 削除")
          )
        );
      })
    ))
  );
}

var EXAMS = [
  { key: "ecg", icon: "\uD83D\uDCC8", label: "心電図" },
  { key: "blood_gas", icon: "\uD83E\uDE78", label: "血液ガス" },
  { key: "blood_test", icon: "\uD83E\uDDEA", label: "採血" },
  { key: "urinalysis", icon: "\uD83D\uDD2C", label: "検尿" },
  { key: "echo", icon: "\uD83D\uDCE1", label: "エコー" },
  { key: "cxr", icon: "\uD83E\uDEB1", label: "胸部X線" },
  { key: "ct_plain", icon: "\uD83D\uDCBB", label: "単純CT" },
  { key: "ct_contrast", icon: "\uD83D\uDC89", label: "造影CT" },
  { key: "head_ct", icon: "\uD83E\uDDE0", label: "頭部CT" }
];

function CaseStudy(props) {
  var c = props.c;
  var stageState = useState(1); var stage = stageState[0]; var setStage = stageState[1];
  var unlockedState = useState(1); var unlocked = unlockedState[0]; var setUnlocked = unlockedState[1];
  var chatState = useState([]); var chat = chatState[0]; var setChat = chatState[1];
  var chatLoadingState = useState(false); var chatLoading = chatLoadingState[0]; var setChatLoading = chatLoadingState[1];
  var chatHistState = useState([]); var chatHist = chatHistState[0]; var setChatHist = chatHistState[1];
  var r1State = useState(""); var r1 = r1State[0]; var setR1 = r1State[1];
  var l1State = useState(false); var l1 = l1State[0]; var setL1 = l1State[1];
  var r2State = useState(""); var r2 = r2State[0]; var setR2 = r2State[1];
  var l2State = useState(false); var l2 = l2State[0]; var setL2 = l2State[1];
  var r3State = useState(""); var r3 = r3State[0]; var setR3 = r3State[1];
  var l3State = useState(false); var l3 = l3State[0]; var setL3 = l3State[1];
  var selExamsState = useState([]); var selExams = selExamsState[0]; var setSelExams = selExamsState[1];
  var showDxState = useState(false); var showDx = showDxState[0]; var setShowDx = showDxState[1];
  var showExpState = useState(false); var showExp = showExpState[0]; var setShowExp = showExpState[1];
  var modalImgState = useState(""); var modalImg = modalImgState[0]; var setModalImg = modalImgState[1];

  function unlock(n) { setUnlocked(function(prev) { return Math.max(prev, n); }); }

  function genR1() {
    setL1(true); setR1("");
    var sys = "あなたは救急医学の指導医です。研修医への教育的なフィードバックを日本語で簡潔に行ってください。";
    var msg = "救急外来で以下の情報が得られました。鑑別診断を3〜5つ挙げ、優先度と根拠、次に確認すべき事項を解説してください。\n\n救急隊情報: " + c.stage1.ems_info + "\nバイタル: " + c.stage1.vitals + "\n最終食事: " + c.stage1.last_meal + "\n最終排便: " + c.stage1.last_stool + "\n追加情報: " + c.stage1.ems_additional;
    askClaude(sys, msg).then(function(res) { setR1(res); setL1(false); });
  }

  function sendChat(msg) {
    setChatLoading(true);
    setChat(function(prev) { return prev.concat([{ role: "user", content: msg }]); });
    var sys = "あなたは救急外来に搬送された患者です。研修医の問診・診察に患者として自然な日本語で答えてください。\n症状・問診情報: " + c.stage2.history_info + "\n身体所見: " + c.stage2.physical_exam + "\nその他: " + c.stage2.additional_history + "\nルール: 患者として答える。聞かれていない情報は言わない。身体診察の質問には実施したと仮定して所見を答える。";
    var apiHist = chatHist.map(function(h) { return { role: h.role === "ai" ? "assistant" : "user", content: h.content }; });
    askClaude(sys, msg, apiHist).then(function(res) {
      setChat(function(prev) { return prev.concat([{ role: "ai", content: res }]); });
      setChatHist(function(prev) { return prev.concat([{ role: "user", content: msg }, { role: "ai", content: res }]); });
      setChatLoading(false);
    });
  }

  function genR2() {
    setL2(true); setR2("");
    var sys = "あなたは救急医学の指導医です。研修医への教育的なフィードバックを日本語で簡潔に行ってください。";
    var msg = "患者来院後の追加情報です。鑑別の変化、絞り込みの根拠、必要な検査とその理由を解説してください。\n\n追加問診: " + c.stage2.history_info + "\n身体診察: " + c.stage2.physical_exam + "\n追加病歴: " + c.stage2.additional_history;
    askClaude(sys, msg).then(function(res) { setR2(res); setL2(false); });
  }

  function toggleExam(key) {
    setSelExams(function(prev) { return prev.includes(key) ? prev.filter(function(k) { return k !== key; }) : prev.concat([key]); });
  }

  function genR3() {
    setL3(true); setR3("");
    var sys = "あなたは救急医学の指導医です。研修医への教育的なフィードバックを日本語で簡潔に行ってください。";
    var results = selExams.map(function(k) { var e = EXAMS.find(function(x) { return x.key === k; }); return e.label + ": " + (c.stage3[k] || "データなし"); }).join("\n");
    askClaude(sys, "以下の検査結果から確定診断の根拠と鑑別の絞り込み過程を解説してください。\n\n" + results).then(function(res) { setR3(res); setL3(false); });
  }

  return React.createElement("div", { className: "app" },
    React.createElement(ImageModal, { url: modalImg, onClose: function() { setModalImg(""); } }),
    React.createElement("div", { className: "hdr" },
      React.createElement("button", { className: "hdr-back", onClick: props.onBack }, "\u2190 \u623b\u308b"),
      React.createElement("div", { className: "hdr-title", style: { fontSize: 13 } }, c.age + "歳 " + c.sex + "・" + c.chief_complaint)
    ),
    React.createElement("div", { className: "snav" },
      [1, 2, 3, 4].map(function(n) {
        var lck = n > unlocked;
        return React.createElement("button", { key: n, className: "sbtn" + (stage === n ? " act" : "") + (lck ? " lck" : ""), onClick: function() { if (!lck) setStage(n); } },
          React.createElement("div", { className: "sdot" }), "第" + n + "段階"
        );
      })
    ),
    React.createElement("div", { className: "sc" }, React.createElement("div", { className: "scont" },

      stage === 1 && React.createElement("div", null,
        React.createElement("div", { className: "bdg b1" }, "\uD83D\uDE91 第1段階：救急隊情報"),
        React.createElement("div", { className: "ic" }, React.createElement("div", { className: "ic-t" }, React.createElement("span", null, "\uD83D\uDCFB"), "救急隊からの情報"), React.createElement("div", { className: "ic-b" }, c.stage1.ems_info)),
        React.createElement("div", { className: "ic" }, React.createElement("div", { className: "ic-t" }, React.createElement("span", null, "\uD83D\uDCCA"), "バイタルサイン"), React.createElement("div", { className: "ic-b", style: { fontFamily: "monospace", fontSize: 13 } }, c.stage1.vitals)),
        React.createElement("div", { className: "ic" }, React.createElement("div", { className: "ic-t" }, React.createElement("span", null, "\uD83C\uDF71"), "最終食事・排便"), React.createElement("div", { className: "ic-b" }, "食事：" + c.stage1.last_meal + "　排便：" + c.stage1.last_stool)),
        c.stage1.ems_additional && React.createElement("div", { className: "ic" }, React.createElement("div", { className: "ic-t" }, React.createElement("span", null, "\uD83D\uDCCB"), "追加情報"), React.createElement("div", { className: "ic-b" }, c.stage1.ems_additional)),
        React.createElement("div", { className: "rsec" },
          React.createElement("div", { className: "rsec-t" }, "\uD83D\uDCA1 AIによる臨床推論解説"),
          !r1 && !l1 && React.createElement("button", { className: "btn btn-ac", onClick: genR1 }, "\uD83E\uDDE0 臨床推論を生成"),
          l1 && React.createElement("div", { className: "thk" }, React.createElement("div", { className: "thk-t" }, "考察中..."), React.createElement(Dots, null)),
          r1 && React.createElement("div", { className: "thk" }, r1)
        ),
        React.createElement("button", { className: "btn btn-c2", onClick: function() { setStage(2); unlock(2); } }, "次へ：来院時対応 \u2192")
      ),

      stage === 2 && React.createElement("div", null,
        React.createElement("div", { className: "bdg b2" }, "\uD83C\uDFE5 第2段階：来院時対応"),
        React.createElement("div", { className: "rsec" },
          React.createElement("div", { className: "rsec-t" }, "\uD83D\uDDE3\uFE0F 問診・身体診察（AI患者に質問）"),
          React.createElement(Chat, { messages: chat, onSend: sendChat, loading: chatLoading, placeholder: "例：胸痛はどのような痛みですか？／胸部を聴診します" })
        ),
        React.createElement("div", { className: "rsec" },
          React.createElement("div", { className: "rsec-t" }, "\uD83D\uDCA1 AIによる臨床推論解説"),
          !r2 && !l2 && React.createElement("button", { className: "btn btn-c2", onClick: genR2 }, "\uD83E\uDDE0 臨床推論を生成"),
          l2 && React.createElement("div", { className: "thk" }, React.createElement("div", { className: "thk-t" }, "考察中..."), React.createElement(Dots, null)),
          r2 && React.createElement("div", { className: "thk" }, r2)
        ),
        React.createElement("button", { className: "btn btn-c3", onClick: function() { setStage(3); unlock(3); } }, "次へ：検査オーダー \u2192")
      ),

      stage === 3 && React.createElement("div", null,
        React.createElement("div", { className: "bdg b3" }, "\uD83D\uDD2C 第3段階：検査・診断"),
        React.createElement("div", { style: { marginBottom: 12, fontSize: 13, color: "var(--mu)" } }, "必要と思う検査を選択してください"),
        React.createElement("div", { className: "egrid" },
          EXAMS.map(function(e) {
            return React.createElement("button", { key: e.key, className: "ebtn" + (selExams.includes(e.key) ? " sel" : ""), onClick: function() { toggleExam(e.key); } },
              React.createElement("div", { className: "eico" }, e.icon), e.label
            );
          })
        ),
        selExams.length > 0 && React.createElement("div", null,
          selExams.map(function(k) {
            var e = EXAMS.find(function(x) { return x.key === k; });
            var imgUrl = c.stage3[k + "_image"];
            return React.createElement("div", { key: k, className: "rc" },
              React.createElement("div", { className: "rc-t" }, e.icon + " " + e.label),
              React.createElement("div", { className: "rc-b" }, c.stage3[k] || "この検査データは登録されていません"),
              imgUrl && React.createElement("img", { src: imgUrl, alt: e.label, className: "exam-img", onClick: function() { setModalImg(imgUrl); } }),
              imgUrl && React.createElement("div", { style: { fontSize: 11, color: "var(--mu)", marginTop: 4 } }, "画像をタップすると拡大表示")
            );
          }),
          React.createElement("div", { className: "rsec" },
            React.createElement("div", { className: "rsec-t" }, "\uD83D\uDCA1 検査結果に基づく臨床推論"),
            !r3 && !l3 && React.createElement("button", { className: "btn btn-c3", onClick: genR3 }, "\uD83E\uDDE0 推論を生成"),
            l3 && React.createElement("div", { className: "thk" }, React.createElement("div", { className: "thk-t" }, "考察中..."), React.createElement(Dots, null)),
            r3 && React.createElement("div", { className: "thk" }, r3)
          )
        ),
        React.createElement("button", { className: "btn btn-ac", onClick: function() { setStage(4); unlock(4); setShowDx(true); } }, "\u2705 確定診断を確認する \u2192")
      ),

      stage === 4 && React.createElement("div", null,
        React.createElement("div", { className: "bdg b4" }, "\u2705 第4段階：確定診断・解説"),
        showDx && React.createElement("div", { className: "dx" }, React.createElement("div", { className: "dx-lbl" }, "確定診断"), React.createElement("div", { className: "dx-name" }, "\uD83C\uDFE5 " + c.diagnosis)),
        !showExp && React.createElement("button", { className: "btn btn-ac", onClick: function() { setShowExp(true); } }, "\uD83D\uDCD6 疾患解説を読む"),
        showExp && React.createElement("div", { className: "exp" }, renderMD(c.explanation)),
        React.createElement("div", { style: { height: 40 } })
      )
    ))
  );
}

export default function App() {
  var screenState = useState("home"); var screen = screenState[0]; var setScreen = screenState[1];
  var casesState = useState(function() { var s = loadCases(); if (s.length === 0) { saveCases(DEMO); return DEMO; } return s; });
  var cases = casesState[0]; var setCases = casesState[1];
  var selState = useState(null); var sel = selState[0]; var setSel = selState[1];
  var adminOkState = useState(false); var adminOk = adminOkState[0]; var setAdminOk = adminOkState[1];

  return React.createElement("div", null,
    React.createElement("style", null, S),
    screen === "home" && React.createElement("div", { className: "app" },
      React.createElement("div", { className: "sc" }, React.createElement("div", { className: "home" },
        React.createElement("div", { className: "logo" },
          React.createElement("div", { className: "logo-icon" }, "\uD83D\uDE91"),
          React.createElement("div", { className: "logo-t" }, "ER Training"),
          React.createElement("div", { className: "logo-s" }, "救急臨床推論トレーニング")
        ),
        React.createElement("div", { className: "menu-grid" },
          React.createElement("div", { className: "menu-card res", onClick: function() { setScreen("resident"); } },
            React.createElement("div", { className: "menu-icon" }, "\uD83D\uDC68\u200D\u2695\uFE0F"),
            React.createElement("div", null, React.createElement("div", { className: "menu-lbl" }, "研修医モード"), React.createElement("div", { className: "menu-dsc" }, "症例を選んで臨床推論を学ぶ")),
            React.createElement("div", { className: "menu-arr" }, "\u203a")
          ),
          React.createElement("div", { className: "menu-card adm", onClick: function() { setScreen("admin"); } },
            React.createElement("div", { className: "menu-icon" }, "\uD83D\uDD10"),
            React.createElement("div", null, React.createElement("div", { className: "menu-lbl" }, "管理者モード"), React.createElement("div", { className: "menu-dsc" }, "症例の登録・編集・削除")),
            React.createElement("div", { className: "menu-arr" }, "\u203a")
          )
        ),
        React.createElement("div", { style: { marginTop: 24, padding: 16, background: "var(--s1)", borderRadius: 14, border: "1px solid var(--bd)" } },
          React.createElement("div", { style: { fontSize: 12, color: "var(--mu)", marginBottom: 8 } }, "\uD83D\uDCD6 使い方"),
          React.createElement("div", { style: { fontSize: 13, lineHeight: 1.7 } },
            "\u2460管理者が症例を登録", React.createElement("br", null),
            "\u2461研修医が症例一覧から選択", React.createElement("br", null),
            "\u24623段階で臨床推論を進める", React.createElement("br", null),
            "\u2463AIが患者役・指導医役として支援"
          )
        )
      ))
    ),
    screen === "resident" && !sel && React.createElement("div", { className: "app" },
      React.createElement("div", { className: "hdr" },
        React.createElement("button", { className: "hdr-back", onClick: function() { setScreen("home"); } }, "\u2190 \u623b\u308b"),
        React.createElement("div", { className: "hdr-title" }, "症例一覧"),
        React.createElement("div", { className: "hdr-badge" }, cases.length + "件")
      ),
      React.createElement("div", { className: "sc" }, React.createElement("div", { className: "case-list" },
        cases.length === 0 && React.createElement("div", { className: "empty" }, "症例が登録されていません"),
        cases.map(function(c) {
          return React.createElement("div", { key: c.id, className: "case-card", onClick: function() { setSel(c); } },
            React.createElement("div", { className: "case-av" }, c.sex === "男性" ? "\uD83D\uDC68" : "\uD83D\uDC69"),
            React.createElement("div", { className: "case-info" },
              React.createElement("div", { className: "case-meta" }, c.age + "歳 " + c.sex),
              React.createElement("div", { className: "case-chief" }, c.chief_complaint)
            ),
            React.createElement("div", { style: { color: "var(--ac)", fontSize: 20 } }, "\u203a")
          );
        })
      ))
    ),
    screen === "resident" && sel && React.createElement(CaseStudy, { c: sel, onBack: function() { setSel(null); } }),
    screen === "admin" && !adminOk && React.createElement(AdminLogin, { onLogin: function() { setAdminOk(true); } }),
    screen === "admin" && adminOk && React.createElement(AdminScreen, { cases: cases, setCases: setCases, onBack: function() { setScreen("home"); setAdminOk(false); } })
  );
}
