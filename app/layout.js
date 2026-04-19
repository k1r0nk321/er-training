import { AuthProvider } from './lib/auth-context'
import './globals.css'

export const metadata = {
  title: '医仁会 臨床研修 ER Training',
  description: '医仁会武田総合病院 臨床研修 救急トレーニングシステム',
}

export default function RootLayout({ children }) {
  return (
    <html lang="ja">
      <body>
        <AuthProvider>
          {children}
        </AuthProvider>
      </body>
    </html>
  )
}
