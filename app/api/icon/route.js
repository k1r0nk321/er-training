// PWAアイコン配信用のAPIルート
// Base64でエンコードされた画像を、ブラウザがアクセスできる画像ファイルとして配信する

import { ER_HERO_IMAGE } from '../../er-hero-image';

export const dynamic = 'force-static';

export async function GET() {
  // data:image/jpeg;base64,xxxxx... の "xxxxx..." 部分だけを取り出す
  const base64Data = ER_HERO_IMAGE.replace('data:image/jpeg;base64,', '');
  const buffer = Buffer.from(base64Data, 'base64');

  return new Response(buffer, {
    headers: {
      'Content-Type': 'image/jpeg',
      'Cache-Control': 'public, max-age=31536000, immutable',
    },
  });
}
