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
        const { data } = await supabase
          .from('app_updates')
          .select('*')
          .order('created_at', { ascending: false });
        setUpdates(data || []);
        setLoading(false);
  };

  const formatDate = (dateStr) => {
        const d = new Date(dateStr);
        return `${d.getFullYear()}/${String(d.getMonth()+1).padStart(2,'0')}/${String(d.getDate()).padStart(2,'0')}`;
  };

  if (loading) return (
        <div className="min-h-screen flex items-center justify-center">
          <p className="text-gray-500">読み込み中...</p>
    </div>
    );

  return (
        <div className="max-w-2xl mx-auto px-4 py-6 space-y-4">
          <div className="flex items-center gap-3 mb-2">
            <button onClick={() => router.back()} className="text-sm text-gray-500 hover:text-gray-700">← 戻る</button>
          <h1 className="text-xl font-black text-gray-900">🆕 アップデート情報</h1>
    </div>
  {updates.length === 0 ? (
            <p className="text-gray-400 text-sm">アップデート情報はありません。</p>
          ) : (
            updates.map((u) => (
                        <div key={u.id} className="bg-white rounded-xl shadow-sm p-4 space-y-1">
                <div className="flex items-center gap-2 flex-wrap">
  {u.category && (
                    <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${CATEGORY_STYLE[u.category] || 'bg-gray-100 text-gray-600'}`}>
{u.category}
</span>
              )}
              <span className="text-xs text-gray-400">{formatDate(u.created_at)}</span>
                </div>
            <p className="font-bold text-gray-800 text-sm">{u.title}</p>
{u.body && <p className="text-sm text-gray-600 whitespace-pre-wrap">{u.body}</p>}
  </div>
         ))
      )}
</div>
  );
}
