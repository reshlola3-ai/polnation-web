import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Polygon Clone',
  robots: {
    index: false,
    follow: false,
  },
}

export default function PolygonClonePage() {
  return (
    <main className="h-screen w-full overflow-hidden bg-black">
      <iframe
        src="/polygon-clone/index.html"
        title="Polygon Clone"
        className="h-full w-full border-0"
      />
    </main>
  )
}
