import { createClient } from '@supabase/supabase-js';

function getAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );
}

function generateInviteCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

export async function POST(req) {
  try {
    const { action, userId, groupName, inviteCode, groupId } = await req.json();

    if (!userId) {
      return Response.json({ error: 'ユーザーIDが必要です' }, { status: 400 });
    }

    const supabase = getAdminClient();

    // グループ作成
    if (action === 'create') {
      if (!groupName || !groupName.trim()) {
        return Response.json({ error: 'グループ名を入力してください' }, { status: 400 });
      }

      let code = generateInviteCode();
      let attempts = 0;
      while (attempts < 10) {
        const { data: existing } = await supabase
          .from('groups').select('id').eq('invite_code', code).maybeSingle();
        if (!existing) break;
        code = generateInviteCode();
        attempts++;
      }

      const { data: group, error: gErr } = await supabase
        .from('groups')
        .insert({ name: groupName.trim(), invite_code: code, created_by: userId })
        .select().single();

      if (gErr) {
        return Response.json({ error: 'グループの作成に失敗しました', detail: gErr.message }, { status: 500 });
      }

      await supabase.from('group_members').insert({ group_id: group.id, user_id: userId });
      return Response.json({ success: true, group });
    }

    // グループ参加
    if (action === 'join') {
      if (!inviteCode) {
        return Response.json({ error: '招待コードを入力してください' }, { status: 400 });
      }

      const code = inviteCode.trim().toUpperCase();
      const { data: group } = await supabase.from('groups').select('*').eq('invite_code', code).maybeSingle();

      if (!group) {
        return Response.json({ error: '招待コードが見つかりません' }, { status: 404 });
      }

      const { data: already } = await supabase
        .from('group_members').select('id').eq('group_id', group.id).eq('user_id', userId).maybeSingle();

      if (already) {
        return Response.json({ error: 'すでにこのグループに参加しています' }, { status: 400 });
      }

      const { error: joinErr } = await supabase.from('group_members').insert({ group_id: group.id, user_id: userId });

      if (joinErr) {
        return Response.json({ error: '参加に失敗しました', detail: joinErr.message }, { status: 500 });
      }

      return Response.json({ success: true, group });
    }

    // グループ一覧
    if (action === 'list') {
      const { data: memberRows } = await supabase
        .from('group_members').select('group_id').eq('user_id', userId);

      if (!memberRows || memberRows.length === 0) {
        return Response.json({ groups: [] });
      }

      const groupIds = memberRows.map(function(r) { return r.group_id; });
      const { data: groups } = await supabase.from('groups').select('*').in('id', groupIds).order('created_at', { ascending: false });

      const groupsWithCount = await Promise.all((groups || []).map(async function(g) {
        const { count } = await supabase.from('group_members').select('*', { count: 'exact', head: true }).eq('group_id', g.id);
        return Object.assign({}, g, { member_count: count || 0 });
      }));

      return Response.json({ groups: groupsWithCount });
    }

    // グループ詳細（メンバー成績 + 最終ログイン時間）
    if (action === 'detail') {
      if (!groupId) {
        return Response.json({ error: 'グループIDが必要です' }, { status: 400 });
      }

      const { data: group } = await supabase.from('groups').select('*').eq('id', groupId).single();
      if (!group) {
        return Response.json({ error: 'グループが見つかりません' }, { status: 404 });
      }

      const { data: memberRows } = await supabase.from('group_members').select('user_id, joined_at').eq('group_id', groupId);

      if (!memberRows || memberRows.length === 0) {
        return Response.json({ group, members: [] });
      }

      const userIds = memberRows.map(function(r) { return r.user_id; });

      // usersテーブル（名前・所属）
      const { data: usersData } = await supabase.from('users').select('id, name, department, role').in('id', userIds);

      // auth.usersから最終ログイン時間を取得（service_roleキーで可能）
      const { data: authData } = await supabase.auth.admin.listUsers();
      const authUsersMap = {};
      if (authData && authData.users) {
        authData.users.forEach(function(u) {
          authUsersMap[u.id] = u.last_sign_in_at;
        });
      }

      // 成績集計
      const statsArr = await Promise.all(userIds.map(async function(uid) {
        const { data: uniqueCases } = await supabase.from('results').select('case_id').eq('user_id', uid);
        const uniqueCaseIds = new Set((uniqueCases || []).map(function(r) { return r.case_id; }));

        const { data: passedRows } = await supabase.from('results').select('case_id').eq('user_id', uid).eq('passed', true);
        const passedCaseIds = new Set((passedRows || []).map(function(r) { return r.case_id; }));

        const { count: totalCount } = await supabase.from('results').select('*', { count: 'exact', head: true }).eq('user_id', uid);

        return {
          user_id: uid,
          unique_cases: uniqueCaseIds.size,
          passed_cases: passedCaseIds.size,
          total_attempts: totalCount || 0,
        };
      }));

      const members = memberRows.map(function(m) {
        const userData = (usersData || []).find(function(u) { return u.id === m.user_id; }) || {};
        const stats = statsArr.find(function(s) { return s.user_id === m.user_id; }) || {};
        return Object.assign({
          user_id: m.user_id,
          name: userData.name || '（名前なし）',
          department: userData.department || '',
          role: userData.role || '',
          last_sign_in_at: authUsersMap[m.user_id] || null,
        }, stats);
      });

      members.sort(function(a, b) { return b.passed_cases - a.passed_cases; });

      return Response.json({ group, members });
    }

    // 脱退・解散
    if (action === 'leave') {
      if (!groupId) {
        return Response.json({ error: 'グループIDが必要です' }, { status: 400 });
      }

      const { data: group } = await supabase.from('groups').select('created_by').eq('id', groupId).single();

      if (group && group.created_by === userId) {
        await supabase.from('group_members').delete().eq('group_id', groupId);
        await supabase.from('groups').delete().eq('id', groupId);
      } else {
        await supabase.from('group_members').delete().eq('group_id', groupId).eq('user_id', userId);
      }

      return Response.json({ success: true });
    }

    return Response.json({ error: '不明なアクションです' }, { status: 400 });

  } catch (error) {
    return Response.json({ error: 'サーバーエラー', detail: error.message }, { status: 500 });
  }
}
