import { createClient } from '@supabase/supabase-js';

// サービスキーを使ったサーバーサイドクライアント（RLSをバイパス）
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

      // 招待コード生成（重複チェック付き）
      let code = generateInviteCode();
      let attempts = 0;
      while (attempts < 10) {
        const { data: existing } = await supabase
          .from('groups')
          .select('id')
          .eq('invite_code', code)
          .maybeSingle();
        if (!existing) break;
        code = generateInviteCode();
        attempts++;
      }

      // グループ作成
      const { data: group, error: gErr } = await supabase
        .from('groups')
        .insert({ name: groupName.trim(), invite_code: code, created_by: userId })
        .select()
        .single();

      if (gErr) {
        return Response.json({ error: 'グループの作成に失敗しました', detail: gErr.message }, { status: 500 });
      }

      // 作成者をメンバーに追加
      await supabase
        .from('group_members')
        .insert({ group_id: group.id, user_id: userId });

      return Response.json({ success: true, group });
    }

    // グループ参加
    if (action === 'join') {
      if (!inviteCode) {
        return Response.json({ error: '招待コードを入力してください' }, { status: 400 });
      }

      const code = inviteCode.trim().toUpperCase();

      const { data: group } = await supabase
        .from('groups')
        .select('*')
        .eq('invite_code', code)
        .maybeSingle();

      if (!group) {
        return Response.json({ error: '招待コードが見つかりません' }, { status: 404 });
      }

      const { data: already } = await supabase
        .from('group_members')
        .select('id')
        .eq('group_id', group.id)
        .eq('user_id', userId)
        .maybeSingle();

      if (already) {
        return Response.json({ error: 'すでにこのグループに参加しています' }, { status: 400 });
      }

      const { error: joinErr } = await supabase
        .from('group_members')
        .insert({ group_id: group.id, user_id: userId });

      if (joinErr) {
        return Response.json({ error: '参加に失敗しました', detail: joinErr.message }, { status: 500 });
      }

      return Response.json({ success: true, group });
    }

    // グループ一覧取得
    if (action === 'list') {
      const { data: memberRows } = await supabase
        .from('group_members')
        .select('group_id')
        .eq('user_id', userId);

      if (!memberRows || memberRows.length === 0) {
        return Response.json({ groups: [] });
      }

      const groupIds = memberRows.map(r => r.group_id);

      const { data: groups } = await supabase
        .from('groups')
        .select('*')
        .in('id', groupIds)
        .order('created_at', { ascending: false });

      // メンバー数取得
      const groupsWithCount = await Promise.all((groups || []).map(async (g) => {
        const { count } = await supabase
          .from('group_members')
          .select('*', { count: 'exact', head: true })
          .eq('group_id', g.id);
        return { ...g, member_count: count || 0 };
      }));

      return Response.json({ groups: groupsWithCount });
    }

    // 脱退・解散
    if (action === 'leave') {
      const { data: group } = await supabase
        .from('groups')
        .select('created_by')
        .eq('id', groupId)
        .single();

      if (group && group.created_by === userId) {
        // 解散
        await supabase.from('group_members').delete().eq('group_id', groupId);
        await supabase.from('groups').delete().eq('id', groupId);
      } else {
        // 脱退
        await supabase.from('group_members').delete().eq('group_id', groupId).eq('user_id', userId);
      }

      return Response.json({ success: true });
    }

    return Response.json({ error: '不明なアクションです' }, { status: 400 });

  } catch (error) {
    return Response.json({ error: 'サーバーエラー', detail: error.message }, { status: 500 });
  }
}
