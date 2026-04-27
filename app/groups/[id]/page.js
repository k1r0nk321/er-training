'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useAuth } from '../../../lib/auth-context';
import { supabase } from '../../../lib/supabase';

export default function GroupDetailPage() {
  const { user } = useAuth();
  const router = useRouter();
  const params = useParams();
  const id = params.id;

  const [group, setGroup] = useState(null);
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [showConfirm, setShowConfirm] = useState(false);
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    if (!user || !id) return;
    fetchGroupDetail();
  }, [user, id]);

  async function fetchGroupDetail() {
    setLoading(true);

    const { data: groupData } = await supabase
      .from('groups')
      .select('*')
      .eq('id', id)
      .single();

    if (!groupData) {
      router.push('/groups');
      return;
    }
    setGroup(groupData);

    const { data: memberRows } = await supabase
      .from('group_members')
      .select('user_id, joined_at')
      .eq('group_id', id);

    if (!memberRows || memberRows.length === 0) {
      setMembers([]);
      setLoading(false);
      return;
    }

    const userIds = memberRows.map(function(r) { return r.user_id; });

    const { data: usersData } = await supabase
      .from('users')
      .select('id, name, department, role')
      .in('id', userIds);

    const statsArr = [];
    for (let i = 0; i < userIds.length; i++) {
      const uid = userIds[i];

      const { data: uniqueCases } = await supabase
        .from('results')
        .select('case_id')
        .eq('user_id', uid);
      const uniqueCaseIds = new Set((uniqueCases || []).map(function(r) { return r.case_id; }));

      const { data: passedRows } = await supabase
        .from('results')
        .select('case_id')
        .eq('user_id', uid)
        .eq('passed', true);
      const passedCaseIds = new Set((passedRows || []).map(function(r) { return r.case_id; }));

      const { count: totalCount } = await supabase
        .from('results')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', uid);

      statsArr.push({
        user_id: uid,
        unique_cases: uniqueCaseIds.size,
        passed_cases: passedCaseIds.size,
        total_attempts: totalCount || 0,
      });
    }

    const merged = memberRows.map(function(m) {
      const userData = (usersData || []).find(function(u) { return u.id === m.user_id; }) || {};
      const stats = statsArr.find(function(s) { return s.user_id === m.user_id; }) || {};
      return Object.assign({
        user_id: m.user_id,
        name: userData.name || '（名前なし）',
        department: userData.department || '',
        role: userData.role || '',
        joined_at: m.joined_at,
      }, stats);
    });

    merged.sort(function(a, b) { return b.passed_cases - a.passed_cases; });
    setMembers(merged);
    setLoading(false);
  }

  async function handleLeave() {
    setProcessing(true);
    const isCreator = group && group.created_by === user.id;
    if (isCreator) {
      await supabase.from('group_members').delete().eq('group_id', id);
      await supabase.from('groups').delete().eq('id', id);
    } else {
      await supabase.from('group_members').delete().eq('group_id', id).eq('user_id', user.id);
    }
    setProcessing(false);
    router.push('/groups');
  }

  function handleCopyCode() {
    if (group) {
      navigator.clipboard.writeText(group.invite_code);
      setMessage('招待コードをコピーしました！');
      setTimeout(function() { setMessage(''); }, 2000);
    }
  }

  if (!user) return null;

  const isCreator = group && group.created_by === user.id;

  return (
    <div className="min-h-screen bg-gray-50 px-4 py-6">
      <div className="max-w-xl mx-auto space-y-4">

        <div className="flex items-center gap-3 mb-2">
          <button onClick={function() { router.push('/groups'); }} className="text-gray-400 hover:text-gray-600 text-sm">
            &larr; 戻る
          </button>
          <h1 className="text-xl font-bold text-gray-900">
            👥 {group ? group.name : 'グループ'}
          </h1>
        </div>

        {message && (
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 text-sm text-blue-800">
            {message}
          </div>
        )}

        {group && (
          <div className="bg-white rounded-xl shadow-sm p-4">
            <p className="text-xs text-gray-400 mb-1">招待コード（このコードを共有してメンバーを招待）</p>
            <div className="flex items-center gap-3">
              <span className="text-2xl font-mono font-bold tracking-widest text-blue-700">
                {group.invite_code}
              </span>
              <button
                onClick={handleCopyCode}
                className="text-xs bg-blue-50 text-blue-600 px-3 py-1 rounded-lg hover:bg-blue-100"
              >
                コピー
              </button>
            </div>
          </div>
        )}

        {loading ? (
          <div className="text-center py-8 text-gray-400 text-sm">読み込み中...</div>
        ) : (
          <div className="bg-white rounded-xl shadow-sm overflow-hidden">
            <div className="p-4 border-b border-gray-100">
              <p className="font-bold text-gray-800 text-sm">メンバー成績（{members.length}人）</p>
            </div>
            <div className="grid grid-cols-4 text-xs text-gray-400 font-medium px-4 py-2 bg-gray-50">
              <span>名前</span>
              <span className="text-center">挑戦症例</span>
              <span className="text-center">合格症例</span>
              <span className="text-center">延べ回数</span>
            </div>
            {members.length === 0 ? (
              <p className="text-center py-6 text-gray-400 text-sm">メンバーがいません</p>
            ) : (
              members.map(function(m, i) {
                return (
                  <div
                    key={m.user_id}
                    className={'grid grid-cols-4 px-4 py-3 items-center text-sm border-b border-gray-50' + (m.user_id === user.id ? ' bg-blue-50' : '')}
                  >
                    <div>
                      <span className="text-gray-400 text-xs mr-1">{i + 1}.</span>
                      <span className="font-medium text-gray-800">{m.name}</span>
                      {m.user_id === user.id && <span className="ml-1 text-xs text-blue-500">（自分）</span>}
                      {group && m.user_id === group.created_by && <span className="ml-1 text-xs text-yellow-500">👑</span>}
                      {m.department && <p className="text-xs text-gray-400">{m.department}</p>}
                    </div>
                    <span className="text-center font-bold text-gray-700">{m.unique_cases}</span>
                    <span className="text-center font-bold text-green-600">{m.passed_cases}</span>
                    <span className="text-center text-gray-500">{m.total_attempts}</span>
                  </div>
                );
              })
            )}
          </div>
        )}

        {!showConfirm ? (
          <button
            onClick={function() { setShowConfirm(true); }}
            className={'w-full py-3 rounded-xl text-sm font-bold border-2 transition' + (isCreator ? ' border-red-300 text-red-500 hover:bg-red-50' : ' border-gray-300 text-gray-500 hover:bg-gray-50')}
          >
            {isCreator ? '🗑️ このグループを解散する' : '🚪 このグループを脱退する'}
          </button>
        ) : (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 space-y-3">
            <p className="text-sm font-bold text-red-700">
              {isCreator ? 'グループを解散しますか？この操作は取り消せません。' : 'このグループを脱退しますか？'}
            </p>
            <div className="flex gap-3">
              <button
                onClick={handleLeave}
                disabled={processing}
                className="flex-1 bg-red-600 text-white py-2 rounded-lg text-sm font-bold hover:bg-red-700 disabled:opacity-50"
              >
                {processing ? '処理中...' : isCreator ? '解散する' : '脱退する'}
              </button>
              <button
                onClick={function() { setShowConfirm(false); }}
                className="flex-1 border border-gray-300 text-gray-600 py-2 rounded-lg text-sm hover:bg-gray-50"
              >
                キャンセル
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
