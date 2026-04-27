'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../lib/auth-context';
import { supabase } from '../../lib/supabase';

function generateInviteCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

export default function GroupsPage() {
  const { user } = useAuth();
  const router = useRouter();

  const [myGroups, setMyGroups] = useState([]);
  const [loading, setLoading] = useState(true);

  // 作成モーダル
  const [showCreate, setShowCreate] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  const [creating, setCreating] = useState(false);

  // 参加モーダル
  const [showJoin, setShowJoin] = useState(false);
  const [joinCode, setJoinCode] = useState('');
  const [joining, setJoining] = useState(false);

  const [message, setMessage] = useState('');

  useEffect(() => {
    if (!user) return;
    fetchMyGroups();
  }, [user]);

  async function fetchMyGroups() {
    setLoading(true);
    // 自分が参加しているgroup_idを取得
    const { data: memberRows } = await supabase
      .from('group_members')
      .select('group_id')
      .eq('user_id', user.id);

    if (!memberRows || memberRows.length === 0) {
      setMyGroups([]);
      setLoading(false);
      return;
    }

    const groupIds = memberRows.map(r => r.group_id);

    // グループ情報取得
    const { data: groups } = await supabase
      .from('groups')
      .select('*')
      .in('id', groupIds)
      .order('created_at', { ascending: false });

    // 各グループのメンバー数取得
    const groupsWithCount = await Promise.all((groups || []).map(async (g) => {
      const { count } = await supabase
        .from('group_members')
        .select('*', { count: 'exact', head: true })
        .eq('group_id', g.id);
      return { ...g, member_count: count || 0 };
    }));

    setMyGroups(groupsWithCount);
    setLoading(false);
  }

  async function handleCreate() {
    if (!newGroupName.trim()) { setMessage('グループ名を入力してください'); return; }
    setCreating(true);
    setMessage('');

    // 招待コードの重複チェック付き生成
    let code = generateInviteCode();
    let exists = true;
    while (exists) {
      const { data } = await supabase.from('groups').select('id').eq('invite_code', code).maybeSingle();
      if (!data) exists = false;
      else code = generateInviteCode();
    }

    // グループ作成
    const { data: group, error: gErr } = await supabase
      .from('groups')
      .insert({ name: newGroupName.trim(), invite_code: code, created_by: user.id })
      .select()
      .single();

    if (gErr) { setMessage('グループの作成に失敗しました'); setCreating(false); return; }

    // 作成者を自動でメンバーに追加
    await supabase.from('group_members').insert({ group_id: group.id, user_id: user.id });

    setCreating(false);
    setShowCreate(false);
    setNewGroupName('');
    setMessage(`グループ「${group.name}」を作成しました！招待コード: ${code}`);
    fetchMyGroups();
  }

  async function handleJoin() {
    if (!joinCode.trim()) { setMessage('招待コードを入力してください'); return; }
    setJoining(true);
    setMessage('');

    const code = joinCode.trim().toUpperCase();

    // コードからグループを検索
    const { data: group } = await supabase
      .from('groups')
      .select('*')
      .eq('invite_code', code)
      .maybeSingle();

    if (!group) { setMessage('招待コードが見つかりません'); setJoining(false); return; }

    // すでに参加済みか確認
    const { data: already } = await supabase
      .from('group_members')
      .select('id')
      .eq('group_id', group.id)
      .eq('user_id', user.id)
      .maybeSingle();

    if (already) { setMessage('すでにこのグループに参加しています'); setJoining(false); return; }

    // 参加
    const { error } = await supabase
      .from('group_members')
      .insert({ group_id: group.id, user_id: user.id });

    if (error) { setMessage('参加に失敗しました'); setJoining(false); return; }

    setJoining(false);
    setShowJoin(false);
    setJoinCode('');
    setMessage(`グループ「${group.name}」に参加しました！`);
    fetchMyGroups();
  }

  if (!user) return <div className="min-h-screen flex items-center justify-center"><p>ログインが必要です</p></div>;

  return (
    <div className="min-h-screen bg-gray-50 px-4 py-6">
      <div className="max-w-xl mx-auto space-y-4">

        {/* ヘッダー */}
        <div className="flex items-center gap-3 mb-2">
          <button onClick={() => router.push('/')} className="text-gray-400 hover:text-gray-600 text-sm">← 戻る</button>
          <h1 className="text-xl font-bold text-gray-900">👥 グループ</h1>
        </div>

        {/* メッセージ */}
        {message && (
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 text-sm text-blue-800">
            {message}
          </div>
        )}

        {/* ボタン */}
        <div className="flex gap-3">
          <button
            onClick={() => { setShowCreate(true); setShowJoin(false); setMessage(''); }}
            className="flex-1 bg-blue-600 text-white py-3 rounded-xl font-bold text-sm hover:bg-blue-700 transition"
          >
            ＋ グループを作成
          </button>
          <button
            onClick={() => { setShowJoin(true); setShowCreate(false); setMessage(''); }}
            className="flex-1 bg-green-600 text-white py-3 rounded-xl font-bold text-sm hover:bg-green-700 transition"
          >
            🔑 コードで参加
          </button>
        </div>

        {/* グループ作成フォーム */}
        {showCreate && (
          <div className="bg-white rounded-xl shadow-sm p-4 space-y-3">
            <h2 className="font-bold text-gray-800">新しいグループを作成</h2>
            <input
              type="text"
              value={newGroupName}
              onChange={e => setNewGroupName(e.target.value)}
              placeholder="グループ名（例：武田病院研修医2025）"
              className="w-full border-2 border-blue-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
              maxLength={30}
            />
            <div className="flex gap-2">
              <button onClick={handleCreate} disabled={creating}
                className="flex-1 bg-blue-600 text-white py-2 rounded-lg text-sm font-bold hover:bg-blue-700 disabled:opacity-50">
                {creating ? '作成中...' : '作成する'}
              </button>
              <button onClick={() => setShowCreate(false)}
                className="px-4 py-2 text-sm text-gray-500 hover:text-gray-700">キャンセル</button>
            </div>
          </div>
        )}

        {/* 招待コード参加フォーム */}
        {showJoin && (
          <div className="bg-white rounded-xl shadow-sm p-4 space-y-3">
            <h2 className="font-bold text-gray-800">招待コードで参加</h2>
            <input
              type="text"
              value={joinCode}
              onChange={e => setJoinCode(e.target.value.toUpperCase())}
              placeholder="6桁のコード（例：AB3X9Z）"
              className="w-full border-2 border-green-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-400 tracking-widest font-mono"
              maxLength={6}
            />
            <div className="flex gap-2">
              <button onClick={handleJoin} disabled={joining}
                className="flex-1 bg-green-600 text-white py-2 rounded-lg text-sm font-bold hover:bg-green-700 disabled:opacity-50">
                {joining ? '参加中...' : '参加する'}
              </button>
              <button onClick={() => setShowJoin(false)}
                className="px-4 py-2 text-sm text-gray-500 hover:text-gray-700">キャンセル</button>
            </div>
          </div>
        )}

        {/* グループ一覧 */}
        {loading ? (
          <div className="text-center py-8 text-gray-400 text-sm">読み込み中...</div>
        ) : myGroups.length === 0 ? (
          <div className="bg-white rounded-xl shadow-sm p-6 text-center text-gray-400 text-sm">
            <p className="text-2xl mb-2">👥</p>
            <p>まだグループに参加していません</p>
            <p className="mt-1">グループを作成するか、招待コードで参加しましょう</p>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-xs text-gray-400 font-medium">参加中のグループ（{myGroups.length}件）</p>
            {myGroups.map(g => (
              <button
                key={g.id}
                onClick={() => router.push(`/groups/${g.id}`)}
                className="w-full bg-white rounded-xl shadow-sm p-4 text-left hover:shadow-md transition flex items-center justify-between"
              >
                <div>
                  <p className="font-bold text-gray-800">{g.name}</p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {g.created_by === user.id ? '👑 作成者' : '参加中'} · {g.member_count}人
                  </p>
                </div>
                <span className="text-gray-300 text-lg">›</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
