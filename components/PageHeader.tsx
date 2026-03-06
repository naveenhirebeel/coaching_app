import Link from 'next/link'
import { ReactNode } from 'react'

type Props = {
  title: string
  subtitle?: string
  backHref?: string
  homeHref?: string
  right?: ReactNode
}

export default function PageHeader({ title, subtitle, backHref, homeHref, right }: Props) {
  const showHome = homeHref && homeHref !== backHref

  return (
    <header className="bg-white shadow-sm px-4 py-3 flex items-center gap-3">
      {backHref && (
        <Link href={backHref} className="text-gray-500 hover:text-gray-900 shrink-0 text-lg leading-none">
          ←
        </Link>
      )}
      <div className="flex-1 min-w-0">
        <h1 className="font-bold text-gray-900 truncate">{title}</h1>
        {subtitle && <p className="text-xs text-gray-500">{subtitle}</p>}
      </div>
      {showHome && (
        <Link href={homeHref} className="text-gray-400 hover:text-gray-700 shrink-0 text-sm" title="Home">
          🏠
        </Link>
      )}
      {right && <div className="shrink-0">{right}</div>}
    </header>
  )
}
