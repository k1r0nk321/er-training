export const metadata = {
  title: "ER Training - 救急臨床推論",
  description: "研修医向け救急臨床推論トレーニングアプリ",
  viewport: "width=device-width, initial-scale=1, maximum-scale=1"
};

export default function RootLayout({ children }) {
  return (
    <html lang="ja">
      <body style={{ margin: 0, padding: 0, background: "#0a0e1a" }}>
        {children}
      </body>
    </html>
  );
}

