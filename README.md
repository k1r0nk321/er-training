# ER Training アプリ - デプロイ手順
<!-- redeploy trigger -->

## このファイルの中身
- `app/` → アプリの本体
- `app/api/ai/route.js` → AIとのやりとりをするサーバー側プログラム
- `app/App.js` → 画面の見た目
- `package.json` → 必要なプログラムのリスト

---

## デプロイ手順（スマホ操作）

### STEP 3：GitHubにアップロード

1. https://github.com にアクセスしてログイン
2. 右上の「＋」ボタン →「New repository」をタップ
3. Repository name に「er-training」と入力
4. 「Create repository」をタップ
5. 「uploading an existing file」をタップ
6. このZIPを解凍して中身のファイルをすべてアップロード
7. 「Commit changes」をタップ

### STEP 4：Vercelでデプロイ

1. https://vercel.com にアクセスしてログイン
2. 「Add New Project」をタップ
3. GitHubの「er-training」を選んで「Import」
4. 「Environment Variables」を開いて以下を追加：
   - Name: `ANTHROPIC_API_KEY`
   - Value: （AnthropicのAPIキーを貼り付け）
5. 「Deploy」をタップ
6. 数分後に `https://er-training-xxxx.vercel.app` のURLが発行される

---

## APIキーの取得方法

1. https://console.anthropic.com にアクセス
2. 「API Keys」→「Create Key」
3. 表示されたキー（sk-ant-...）をコピーして保管

---

## 完成後

URLを研修医に送るだけで、スマホから使えます。
管理者パスワードは `admin1234` です（変更推奨）。
