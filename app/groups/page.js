'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../lib/auth-context';

export default function GroupsPage() {
  const { user } = useAuth();
  const router = useRouter();

  const [myGroups, setMyGroups] = useState([]);
  const [loading, setLoading] = useState(true);

  const [showCreate, setShowCreate] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  const [creating, setCreating] = useState(false);

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
    try {
      const res = await fetch('/api/groups', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'list', userId: user.id }),
      });
      const data = await res.json();
      setMyGroups(data.groups || []);
    } catch (e) {
      setMessage('グループの読み込みに失敗しました');
    }
    setLoading(false);
  }

  async function handleCreate() {
    if (!newGroupName.trim()) { setMessage('グループ名を入力してください'); return; }
    setCreating(true);
    setMessage('');
    try {
      const res = await fetch('/api/groups', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'create', userId: user.id, groupName: newGroupName }),
      });
      const data = await res.json();
      if (data.error) {
        setMessage(data.error);
      } else {
        setShowCreate(false);
        setNewGroupName('');
        setMessage('グループ「' + data.group.name + '」を作成しました！招待コード: ' + data.group.invite_code);
        fetchMyGroups();
      }
    } catch (e) {
      setMessage('グループの作成に失敗しました');
    }
    setCreating(false);
  }

  async function handleJoin() {
    if (!joinCode.trim()) { setMessage('招待コードを入力してください'); return; }
    setJoining(true);
    setMessage('');
    try {
      const res = await fetch('/api/groups', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'join', userId: user.id, inviteCode: joinCode }),
      });
      const data = await res.json();
      if (data.error) {
        setMessage(data.error);
      } else {
        setShowJoin(false);
        setJoinCode('');
        setMessage('グループ「' + data.group.name + '」に参加しました！');
        fetchMyGroups();
      }
    } catch (e) {
      setMessage('参加に失敗しました');
    }
    setJoining(false);
  }

  if (!user) return (
    <div className="min-h-screen flex items-center justify-center">
      <p className="text-gray-500">ログインが必要です</p>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50 px-4 py-6">
      <div className="max-w-xl mx-auto space-y-4">

        <div className="flex items-center gap-3 mb-2">
          <button onClick={function() { router.push('/'); }} className="text-gray-400 hover:text-gray-600 text-sm">
            ← 戻る
          </button>
          <h1 className="text-xl font-bold text-gray-900">👥 グループ</h1>
        </div>

        {message && (
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 text-sm text-blue-800">
            {message}
          </div>
        )}

        <div className="flex gap-3">
          <button
            onClick={function() { setShowCreate(true); setShowJoin(false); setMessage(''); }}
            className="flex-1 bg-blue-600 text-white py-3 rounded-xl font-bold text-sm hover:bg-blue-700 transition"
          >
            ＋ グループを作成
          </button>
          <button
            onClick={function() { setShowJoin(true); setShowCreate(false); setMessage(''); }}
            className="flex-1 bg-green-600 text-white py-3 rounded-xl font-bold text-sm hover:bg-green-700 transition"
          >
            🔑 コードで参加
          </button>
        </div>

        {showCreate && (
          <div className="bg-white rounded-xl shadow-sm p-4 space-y-3">
            <h2 className="font-bold text-gray-800">新しいグループを作成</h2>
            <input
              type="text"
              value={newGroupName}
              onChange={function(e) { setNewGroupName(e.target.value); }}
              placeholder="グループ名（例：武田病院研修医2025）"
              className="w-full border-2 border-blue-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
              maxLength={30}
            />
            <div className="flex gap-2">
              <button
                onClick={handleCreate}
                disabled={creating}
                className="flex-1 bg-blue-600 text-white py-2 rounded-lg text-sm font-bold hover:bg-blue-700 disabled:opacity-50"
              >
                {creating ? '作成中...' : '作成する'}
              </button>
              <button
                onClick={function() { setShowCreate(false); }}
                className="px-4 py-2 text-sm text-gray-500 hover:text-gray-700"
              >
                キャンセル
              </button>
            </div>
          </div>
        )}

        {showJoin && (
          <div className="bg-white rounded-xl shadow-sm p-4 space-y-3">
            <h2 className="font-bold text-gray-800">招待コードで参加</h2>
            <input
              type="text"
              value={joinCode}
              onChange={function(e) { setJoinCode(e.target.value.toUpperCase()); }}
              placeholder="6桁のコード（例：AB3X9Z）"
              className="w-full border-2 border-green-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-400 tracking-widest font-mono"
              maxLength={6}
            />
            <div className="flex gap-2">
              <button
                onClick={handleJoin}
                disabled={joining}
                className="flex-1 bg-green-600 text-white py-2 rounded-lg text-sm font-bold hover:bg-green-700 disabled:opacity-50"
              >
                {joining ? '参加中...' : '参加する'}
              </button>
              <button
                onClick={function() { setShowJoin(false); }}
                className="px-4 py-2 text-sm text-gray-500 hover:text-gray-700"
              >
                キャンセル
              </button>
            </div>
          </div>
        )}

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
            {myGroups.map(function(g) {
              return (
                <button
                  key={g.id}
                  onClick={function() { router.push('/groups/' + g.id); }}
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
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
