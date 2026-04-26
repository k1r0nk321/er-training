'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../lib/supabase';

const CATEGORY_STYLE = {
  '機能追加': 'bg-blue-100 text-blue-700',
  '改善':     'bg-green-100 text-green-700',
  '修正':     'bg-orange-100 text-orange-700',
  '症例追加': 'bg-purple-100 text-purple-700',
};

export default function UpdatesPage() {
  const router = useRouter();
  const [updates, setUpdates] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchUpdates();
  }, []);

  const fetchUpdates = async () => {
    setLoading(true);
    // 過去5日分を取得
    const since = new Date();
    since.setDate(since.getDate() - 5);

    const { data } = await supabase
      .from('app_updates')
      .select('*')
      .gte('created_at', since.toISOString())
      .order('created_at', { ascending: false });

    setUpdates(data || []);
    setLoading(false);
  };

  // 日付ごとにグループ化
  const grouped = (updates || []).reduce((acc, u) => {
    const d = new Date(u.created_at).toLocaleDateString('ja-JP', {
      year: 'numeric', month: 'long', day: 'numeric', weekday: 'short'
    });
    if (!acc[d]) acc[d] = [];
    acc[d].push(u);
    return acc;
  }, {});

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm sticky top-0 z-10">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center justify-between">
          <button onClick={() => router.push('/')} className="text-blue-600 text-sm">← トップへ</button>
          <span className="font-bold text-gray-800">🆕 アップデート情報</span>
          <span className="text-xs text-gray-400">過去5日間</span>
        </div>
      </header>

      <div className="max-w-2xl mx-auto px-4 py-5 space-y-6">
        {loading ? (
          <div className="text-center py-12">
            <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-3"></div>
            <p className="text-gray-400 text-sm">読み込み中...</p>
          </div>
        ) : Object.keys(grouped).length === 0 ? (
          <div className="text-center py-12 text-gray-400">
            <p className="text-4xl mb-3">📋</p>
            <p className="text-sm">過去5日間のアップデートはありません</p>
          </div>
        ) : (
          Object.entries(grouped).map(([date, items]) => (
            <div key={date}>
              {/* 日付ヘッダー */}
              <div className="flex items-center gap-3 mb-3">
                <div className="h-px flex-1 bg-gray-200"></div>
                <span className="text-xs font-bold text-gray-500 bg-gray-100 px-3 py-1 rounded-full">{date}</span>
                <div className="h-px flex-1 bg-gray-200"></div>
              </div>
              {/* その日のアップデート一覧 */}
              <div className="space-y-3">
                {items.map(u => (
                  <div key={u.id} className="bg-white rounded-xl shadow-sm p-4">
                    <div className="flex items-start gap-3">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-bold flex-shrink-0 mt-0.5 ${CATEGORY_STYLE[u.category] || 'bg-gray-100 text-gray-600'}`}>
                        {u.category}
                      </span>
                      <div>
                        <p className="text-sm font-bold text-gray-800">{u.title}</p>
                        <p className="text-xs text-gray-500 mt-1 leading-relaxed">{u.body}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))
        )}

        {/* SQL追加方法の案内（管理者向け） */}
        <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 text-xs text-blue-700 space-y-1">
          <p className="font-bold">📌 アップデート情報の追加方法（管理者）</p>
          <p>Supabase SQL Editorで以下を実行してください：</p>
          <pre className="bg-white rounded-lg p-2 mt-1 text-blue-800 text-xs overflow-x-auto">{`INSERT INTO app_updates (title, body, category)
VALUES ('タイトル', '内容', 'カテゴリ');
-- category: 機能追加 / 改善 / 修正 / 症例追加`}</pre>
        </div>
      </div>
    </div>
  );
}
