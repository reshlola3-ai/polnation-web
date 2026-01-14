import Link from 'next/link'

interface AuthLayoutProps {
  children: React.ReactNode
  title: string
  subtitle?: string
}

export function AuthLayout({ children, title, subtitle }: AuthLayoutProps) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-zinc-50 via-emerald-50/30 to-teal-50/40 flex flex-col">
      {/* Header */}
      <header className="p-6">
        <Link href="/" className="flex items-center gap-2 w-fit">
          <div className="w-8 h-8 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-lg flex items-center justify-center">
            <span className="text-white font-bold text-lg">P</span>
          </div>
          <span className="font-bold text-xl text-zinc-900">Polnation</span>
        </Link>
      </header>

      {/* Main content */}
      <main className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-md">
          <div className="bg-white rounded-2xl shadow-xl shadow-zinc-200/50 border border-zinc-100 p-8">
            <div className="text-center mb-8">
              <h1 className="text-2xl font-bold text-zinc-900">{title}</h1>
              {subtitle && (
                <p className="mt-2 text-zinc-600">{subtitle}</p>
              )}
            </div>
            {children}
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="p-6 text-center text-sm text-zinc-500">
        © 2026 Polnation. All rights reserved.
      </footer>
    </div>
  )
}
