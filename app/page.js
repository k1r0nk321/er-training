'use client'

import { useState, useEffect } from 'react'
import { useAuth } from './lib/auth-context'
import { supabase } from './lib/supabase'

export default function TopPage() {
  const { user, isTrialMode, signIn, signOut, enterTrialMode } = useAuth()
  const [mode, setMode] = useState('top') // top | login | trial
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [trialPassword, setTrialPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [announcements, setAnnouncements] = useState([])

  useEffect(() => {
    fetchAnnouncements()
  }, [])

  const fetchAnnouncements = async () => {
    const { data } = await supabase
      .from('announcements')
      .select('*')
      .eq('is_published', true)
      .order('published_at', { ascending: false })
      .limit(3)
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
    const { data } = await supabase
      .from('app_settings')
      .select('value')
      .eq('key', 'trial_password')
      .single()
    if (data && data.value === trialPassword) {
      enterTrialMode()
    } else {
      setError('パスワードが違います')
    }
    setLoading(false)
  }

  if (user || isTrialMode) {
    return (
      <main style={styles.main}>
        <div style={styles.card}>
          <h1 style={styles.title}>🏥 医仁会 臨床研修<br/>ER Training</h1>
          <p style={styles.subtitle}>
            {isTrialMode ? 'お試しモード' : `${user?.name} さん（${roleLabel(user?.role)}）`}
          </p>
          <div style={styles.menuGrid}>
            <a href="/cases" style={styles.menuBtn}>📋 症例一覧</a>
            <a href="/cases/random" style={styles.menuBtn}>🎲 ランダム出題</a>
            {!isTrialMode && <a href="/results" style={styles.menuBtn}>📊 成績一覧</a>}
            {user?.role === 'admin' && <a href="/admin" style={styles.menuBtn}>⚙️ 管理者画面</a>}
          </div>
          {announcements.length > 0 && (
            <div style={styles.announcements}>
              <h3 style={styles.annTitle}>📢 お知らせ</h3>
              {announcements.map(a => (
                <div key={a.id} style={styles.annItem}>
                  <strong>{a.title}</strong>
                  <p>{a.body}</p>
                </div>
              ))}
            </div>
          )}
          <button onClick={signOut} style={styles.logoutBtn}>ログアウト</button>
          <p style={styles.credit}>医仁会武田総合病院　中前　恵一郎</p>
        </div>
      </main>
    )
  }

  return (
    <main style={styles.main}>
      <div style={styles.card}>
        <div style={styles.heroArea}>
          <div style={styles.heroIllust}>
            <svg viewBox="0 0 120 120" width="120" height="120">
              <circle cx="60" cy="30" r="22" fill="#4A90D9" opacity="0.9"/>
              <rect x="38" y="55" width="44" height="50" rx="8" fill="#4A90D9" opacity="0.85"/>
              <rect x="50" y="20" width="4" height="20" rx="2" fill="white"/>
              <rect x="44" y="26" width="16" height="4" rx="2" fill="white"/>
              <rect x="48" y="68" width="24" height="4" rx="2" fill="white"/>
              <rect x="58" y="62" width="4" height="16" rx="2" fill="white"/>
              <circle cx="60" cy="30" r="10" fill="#2E6DB4" opacity="0.3"/>
            </svg>
          </div>
          <h1 style={styles.title}>医仁会 臨床研修<br/>ER Training</h1>
          <p style={styles.heroSub}>救急・総合診療 症例トレーニングシステム</p>
        </div>

        {announcements.length > 0 && (
          <div style={styles.announcements}>
            <h3 style={styles.annTitle}>📢 お知らせ</h3>
            {announcements.map(a => (
              <div key={a.id} style={styles.annItem}>
                <strong>{a.title}</strong>
                <p style={{margin:'4px 0 0',fontSize:'13px'}}>{a.body}</p>
              </div>
            ))}
          </div>
        )}

        {mode === 'top' && (
          <div style={styles.btnGroup}>
            <button onClick={() => setMode('login')} style={styles.primaryBtn}>
              🔐 研修医・指導医ログイン
            </button>
            <button onClick={() => setMode('trial')} style={styles.secondaryBtn}>
              👀 お試しモード
            </button>
          </div>
        )}

        {mode === 'login' && (
          <form onSubmit={handleLogin} style={styles.form}>
            <h2 style={styles.formTitle}>ログイン</h2>
            <input
              type="email"
              placeholder="メールアドレス"
              value={email}
              onChange={e => setEmail(e.target.value)}
              style={styles.input}
              required
            />
            <input
              type="password"
              placeholder="パスワード"
              value={password}
              onChange={e => setPassword(e.target.value)}
              style={styles.input}
              required
            />
            {error && <p style={styles.error}>{error}</p>}
            <button type="submit" style={styles.primaryBtn} disabled={loading}>
              {loading ? 'ログイン中...' : 'ログイン'}
            </button>
            <button type="button" onClick={() => setMode('top')} style={styles.backBtn}>
              ← 戻る
            </button>
          </form>
        )}

        {mode === 'trial' && (
          <form onSubmit={handleTrial} style={styles.form}>
            <h2 style={styles.formTitle}>お試しモード</h2>
            <p style={styles.trialNote}>4桁のパスワードを入力してください<br/>（成績は保存されません）</p>
            <input
              type="password"
              placeholder="4桁パスワード"
              value={trialPassword}
              onChange={e => setTrialPassword(e.target.value)}
              style={styles.input}
              maxLength={4}
              required
            />
            {error && <p style={styles.error}>{error}</p>}
            <button type="submit" style={styles.primaryBtn} disabled={loading}>
              {loading ? '確認中...' : '入室する'}
            </button>
            <button type="button" onClick={() => setMode('top')} style={styles.backBtn}>
              ← 戻る
            </button>
          </form>
        )}

        <p style={styles.credit}>医仁会武田総合病院　中前　恵一郎</p>
      </div>
    </main>
  )
}

function roleLabel(role) {
  if (role === 'admin') return '管理者'
  if (role === 'resident') return '研修医'
  return 'ゲスト'
}

const styles = {
  main: {
    minHeight: '100vh',
    background: 'linear-gradient(135deg, #1a3a5c 0%, #2E6DB4 50%, #4A90D9 100%)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '20px',
    fontFamily: "'Helvetica Neue', Arial, sans-serif",
  },
  card: {
    background: 'white',
    borderRadius: '20px',
    padding: '40px 32px',
    maxWidth: '440px',
    width: '100%',
    boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
  },
  heroArea: {
    textAlign: 'center',
    marginBottom: '24px',
  },
  heroIllust: {
    marginBottom: '12px',
  },
  heroSub: {
    col
