'use client'
import { useState, useEffect } from 'react'
import { useAuth } from './lib/auth-context'
import { supabase } from './lib/supabase'

export default function TopPage() {
  const { user, isTrialMode, signIn, signOut, enterTrialMode } = useAuth()
  const [mode, setMode] = useState('top')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [trialPassword, setTrialPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [announcements, setAnnouncements] = useState([])

  useEffect(() => { fetchAnnouncements() }, [])

  const fetchAnnouncements = async () => {
    const { data } = await supabase.from('announcements').select('*')
      .eq('is_published', true).order('published_at', { ascending: false }).limit(3)
    if (data) setAnnouncements(data)
  }

  const handleLogin = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    const { error } = await signIn(email, password)
    if (error) setError(error)
    setLoading(false)
  }

  const handleTrial = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    const { data } = await supabase.from('app_settings').select('value')
      .eq('key', 'trial_password').single()
    if (data && data.value === trialPassword) {
      enterTrialMode()
    } else {
      setError('パスワードが違います')
    }
    setLoading(false)
  }

  if (user || isTrialMode) {
    return (
      <main style={S.main}>
        <div style={S.card}>
          <h1 style={S.title}>🏥 医仁会 臨床研修<br/>ER Training</h1>
          <p style={S.subtitle}>{isTrialMode ? 'お試しモード' : `${user?.name}さん（${roleLabel(user?.role)}）`}</p>
          <div style={S.menuGrid}>
            <a href="/cases" style={S.menuBtn}>📋 症例一覧</a>
            <a href="/cases/random" style={S.menuBtn}>🎲 ランダム</a>
            {!isTrialMode && <a href="/results" style={S.menuBtn}>📊 成績</a>}
            {user?.role === 'admin' && <a href="/admin" style={S.menuBtn}>⚙️ 管理</a>}
          </div>
          {announcements.map(a => (
            <div key={a.id} style={S.annItem}><strong>{a.title}</strong><p style={{margin:'4px 0 0',fontSize:'13px'}}>{a.body}</p></div>
          ))}
          <button onClick={signOut} style={S.logoutBtn}>ログアウト</button>
          <p style={S.credit}>医仁会武田総合病院　中前　恵一郎</p>
        </div>
      </main>
    )
  }

  return (
    <main style={S.main}>
      <div style={S.card}>
        <div style={{textAlign:'center',marginBottom:'24px'}}>
          <svg viewBox="0 0 120 120" width="90" height="90">
            <circle cx="60" cy="30" r="22" fill="#4A90D9"/>
            <rect x="38" y="55" width="44" height="50" rx="8" fill="#4A90D9" opacity="0.85"/>
            <rect x="50" y="20" width="4" height="20" rx="2" fill="white"/>
            <rect x="44" y="26" width="16" height="4" rx="2" fill="white"/>
            <rect x="48" y="68" width="24" height="4" rx="2" fill="white"/>
            <rect x="58" y="62" width="4" height="16" rx="2" fill="white"/>
          </svg>
          <h1 style={S.title}>医仁会 臨床研修<br/>ER Training</h1>
          <p style={{color:'#666',fontSize:'13px',margin:'6px 0 0'}}>救急・総合診療 症例トレーニングシステム</p>
        </div>
        {announcements.length > 0 && (
          <div style={S.ann}>
            <p style={{margin:'0 0 8px',fontSize:'13px',fontWeight:'bold',color:'#1a3a5c'}}>📢 お知らせ</p>
            {announcements.map(a => (
              <div key={a.id} style={S.annItem}><strong>{a.title}</strong><p style={{margin:'4px 0 0',fontSize:'12px'}}>{a.body}</p></div>
            ))}
          </div>
        )}
        {mode === 'top' && (
          <div style={{display:'flex',flexDirection:'column',gap:'12px',margin:'8px 0'}}>
            <button onClick={() => setMode('login')} style={S.primaryBtn}>🔐 研修医・指導医ログイン</button>
            <button onClick={() => setMode('trial')} style={S.secondaryBtn}>👀 お試しモード</button>
          </div>
        )}
        {mode === 'login' && (
          <form onSubmit={handleLogin} style={{display:'flex',flexDirection:'column',gap:'12px'}}>
            <h2 style={S.formTitle}>ログイン</h2>
            <input type="email" placeholder="メールアドレス" value={email} onChange={e=>setEmail(e.target.value)} style={S.input} required/>
            <input type="password" placeholder="パスワード" value={password} onChange={e=>setPassword(e.target.value)} style={S.input} required/>
            {error && <p style={S.error}>{error}</p>}
            <button type="submit" style={S.primaryBtn} disabled={loading}>{loading?'ログイン中...':'ログイン'}</button>
            <button type="button" onClick={()=>setMode('top')} style={S.backBtn}>← 戻る</button>
          </form>
        )}
        {mode === 'trial' && (
          <form onSubmit={handleTrial} style={{display:'flex',flexDirection:'column',gap:'12px'}}>
            <h2 style={S.formTitle}>お試しモード</h2>
            <p style={{color:'#666',fontSize:'13px',textAlign:'center',margin:'0',lineHeight:'1.6'}}>4桁のパスワードを入力<br/>（成績は保存されません）</p>
            <input type="password" placeholder="4桁パスワード" value={trialPassword} onChange={e=>setTrialPassword(e.target.value)} style={S.input} maxLength={4} required/>
            {error && <p style={S.error}>{error}</p>}
            <button type="submit" style={S.primaryBtn} disabled={loading}>{loading?'確認中...':'入室する'}</button>
            <button type="button" onClick={()=>setMode('top')} style={S.backBtn}>← 戻る</button>
          </form>
        )}
        <p style={S.credit}>医仁会武田総合病院　中前　恵一郎</p>
      </div>
    </main>
  )
}

function roleLabel(r){return r==='admin'?'管理者':r==='resident'?'研修医':'ゲスト'}

const S={
  main:{minHeight:'100vh',background:'linear-gradient(135deg,#1a3a5c 0%,#2E6DB4 50%,#4A90D9 100%)',display:'flex',alignItems:'center',justifyContent:'center',padding:'20px',fontFamily:"'Helvetica Neue',Arial,sans-serif"},
  card:{background:'white',borderRadius:'20px',padding:'40px 32px',maxWidth:'440px',width:'100%',boxShadow:'0 20px 60px rgba(0,0,0,0.3)'},
  title:{fontSize:'24px',fontWeight:'bold',color:'#1a3a5c',margin:'0',lineHeight:'1.4',textAlign:'center'},
  subtitle:{textAlign:'center',color:'#4A90D9',fontSize:'15px',margin:'0 0 20px'},
  menuGrid:{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'12px',margin:'20px 0'},
  menuBtn:{background:'#f0f7ff',border:'2px solid #4A90D9',borderRadius:'12px',padding:'16px 8px',textAlign:'center',color:'#1a3a5c',fontWeight:'bold',fontSize:'14px',textDecoration:'none',display:'block'},
  primaryBtn:{background:'#2E6DB4',color:'white',border:'none',borderRadius:'12px',padding:'16px',fontSize:'16px',fontWeight:'bold',cursor:'pointer',width:'100%'},
  secondaryBtn:{background:'white',color:'#2E6DB4',border:'2px solid #2E6DB4',borderRadius:'12px',padding:'14px',fontSize:'16px',fontWeight:'bold',cursor:'pointer',width:'100%'},
  formTitle:{fontSize:'18px',fontWeight:'bold',color:'#1a3a5c',margin:'0 0 4px',textAlign:'center'},
  input:{border:'2px solid #ddd',borderRadius:'10px',padding:'14px',fontSize:'16px',outline:'none',width:'100%',boxSizing:'border-box'},
  backBtn:{background:'none',border:'none',color:'#888',cursor:'pointer',fontSize:'14px',padding:'8px'},
  error:{color:'#e74c3c',fontSize:'14px',margin:'0',textAlign:'center'},
  ann:{background:'#f8f9ff',borderRadius:'12px',padding:'16px',margin:'16px 0',borderLeft:'4px solid #4A90D9'},
  annItem:{marginBottom:'8px',fontSize:'13px',color:'#333'},
  logoutBtn:{background:'#f5f5f5',border:'1px solid #ddd',borderRadius:'8px',padding:'10px',cursor:'pointer',width:'100%',marginTop:'16px',color:'#666',fontSize:'14px'},
  credit:{textAlign:'center',color:'#aaa',fontSize:'11px',margin:'16px 0 0'},
}
