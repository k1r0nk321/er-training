// PWAマニフェスト（Android用設定）
// ホーム画面に追加した際のアプリ名・アイコン・テーマカラーなどを指定

export default function manifest() {
  return {
    name: 'ER Training',
    short_name: 'ER Training',
    description: 'ER症例学習アプリ',
    start_url: '/',
    display: 'standalone',
    background_color: '#dbeafe',
    theme_color: '#2563eb',
    icons: [
      {
        src: '/api/icon',
        sizes: '512x512',
        type: 'image/jpeg',
        purpose: 'any',
      },
    ],
  };
}
