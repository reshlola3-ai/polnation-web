'use client'

import { useState, useRef, useEffect, useMemo } from 'react'
import { Search, ChevronDown } from 'lucide-react'

export interface SearchableOption {
  value: string
  label: string
  search?: string // 用于匹配的文本（默认用 label）；可放国家名+区号等关键词
}

interface SearchableSelectProps {
  options: SearchableOption[]
  value: string
  onChange: (value: string) => void
  placeholder?: string
  searchPlaceholder?: string
  className?: string
}

export function SearchableSelect({
  options,
  value,
  onChange,
  placeholder = 'Select',
  searchPlaceholder = 'Search...',
  className = '',
}: SearchableSelectProps) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [highlight, setHighlight] = useState(0)
  const rootRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const selected = options.find((o) => o.value === value)

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return options
    return options.filter((o) => (o.search || o.label).toLowerCase().includes(q))
  }, [options, query])

  // 关闭：点击外部 / Esc
  useEffect(() => {
    if (!open) return
    function onDocClick(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDocClick)
    return () => document.removeEventListener('mousedown', onDocClick)
  }, [open])

  // 打开时聚焦搜索框（聚焦非 state 更新，可放在 effect 里）
  useEffect(() => {
    if (open) requestAnimationFrame(() => inputRef.current?.focus())
  }, [open])

  function toggleOpen() {
    if (open) {
      setOpen(false)
    } else {
      setQuery('')
      setHighlight(0)
      setOpen(true)
    }
  }

  function choose(v: string) {
    onChange(v)
    setOpen(false)
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Escape') {
      setOpen(false)
      return
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setHighlight((h) => Math.min(filtered.length - 1, h + 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setHighlight((h) => Math.max(0, h - 1))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      const opt = filtered[highlight]
      if (opt) choose(opt.value)
    }
  }

  return (
    <div ref={rootRef} className={`relative w-full ${className}`}>
      <button
        type="button"
        onClick={toggleOpen}
        className="w-full px-4 py-3 rounded-xl border bg-[rgba(13,11,33,0.6)] text-white
          border-[rgba(139,92,246,0.3)] focus:outline-none focus:ring-2 focus:ring-purple-500/50
          focus:border-purple-500 transition-all duration-200 flex items-center justify-between gap-2 text-left"
      >
        <span className={`truncate ${selected ? 'text-white' : 'text-zinc-500'}`}>
          {selected ? selected.label : placeholder}
        </span>
        <ChevronDown className={`w-4 h-4 text-zinc-400 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div
          className="absolute z-50 mt-1 w-full min-w-[14rem] rounded-xl border border-[rgba(139,92,246,0.3)]
            bg-[#1A1333] shadow-xl shadow-black/40 overflow-hidden"
          onKeyDown={onKeyDown}
        >
          <div className="p-2 border-b border-[rgba(139,92,246,0.2)]">
            <div className="relative">
              <Search className="w-4 h-4 text-zinc-500 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                ref={inputRef}
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value)
                  setHighlight(0)
                }}
                onKeyDown={onKeyDown}
                placeholder={searchPlaceholder}
                className="w-full pl-8 pr-3 py-2 rounded-lg bg-[rgba(13,11,33,0.8)] text-white text-sm
                  border border-[rgba(139,92,246,0.2)] placeholder-zinc-600
                  focus:outline-none focus:border-purple-500"
              />
            </div>
          </div>
          <ul className="max-h-60 overflow-y-auto py-1">
            {filtered.length === 0 ? (
              <li className="px-3 py-2 text-sm text-zinc-500">No match</li>
            ) : (
              filtered.map((o, i) => (
                <li key={`${o.value}-${i}`}>
                  <button
                    type="button"
                    onClick={() => choose(o.value)}
                    onMouseEnter={() => setHighlight(i)}
                    className={`w-full text-left px-3 py-2 text-sm transition-colors
                      ${i === highlight ? 'bg-purple-500/20 text-white' : 'text-zinc-300 hover:bg-purple-500/10'}
                      ${o.value === value ? 'font-semibold' : ''}`}
                  >
                    {o.label}
                  </button>
                </li>
              ))
            )}
          </ul>
        </div>
      )}
    </div>
  )
}
