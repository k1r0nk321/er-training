import { AuthProvider } from './lib/auth-context'
import './globals.css'

export const metadata = {
  title: 'ER Training',
  description: 'ER症例学習アプリ',
  icons: {
    apple: '/api/icon',
    icon: '/api/icon',
  },
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
