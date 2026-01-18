import Link from 'next/link'
import Image from 'next/image'

interface AuthLayoutProps {
  children: React.ReactNode
  title: string
  subtitle?: string
}

export function AuthLayout({ children, title, subtitle }: AuthLayoutProps) {
  return (
    <div className="min-h-screen bg-gradient-radial relative overflow-hidden flex flex-col">
      {/* Animated Background */}
      <div className="stars" />
      <div className="orb orb-1" />
      <div className="orb orb-2" />
      
      {/* Header */}
      <header className="relative z-10 p-6">
        <Link href="/" className="flex items-center gap-3 w-fit group">
          <Image
            src="/logo.svg"
            alt="Polnation"
            width={40}
            height={40}
            className="rounded-xl glow-purple-sm group-hover:glow-purple transition-all duration-300"
          />
          <span className="font-display text-xl text-white group-hover:glow-text transition-all duration-300">Polnation</span>
        </Link>
      </header>

      {/* Main content */}
      <main className="relative z-10 flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-md">
          <div className="glass-card-solid p-8 relative overflow-hidden">
            {/* Subtle inner glow */}
            <div className="absolute inset-0 bg-gradient-to-br from-purple-500/5 to-transparent pointer-events-none" />
            
            <div className="relative z-10">
              <div className="text-center mb-8">
                <h1 className="text-2xl font-bold text-white">{title}</h1>
                {subtitle && (
                  <p className="mt-2 text-zinc-400">{subtitle}</p>
                )}
              </div>
              {children}
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="relative z-10 p-6 text-center text-sm text-zinc-500">
        © 2026 Polnation. All rights reserved.
      </footer>
    </div>
  )
}
