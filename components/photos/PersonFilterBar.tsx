'use client'

import { FAMILY_MEMBERS } from '@/lib/types'

interface Props {
  selected: string | null
  onChange: (uploader: string | null) => void
}

const MEMBER_COLORS: Record<string, { bg: string; text: string }> = {
  alex:  { bg: '#1d4ed8', text: '#fff' },
  itan:  { bg: '#15803d', text: '#fff' },
  ami:   { bg: '#be123c', text: '#fff' },
  danil: { bg: '#7c3aed', text: '#fff' },
  assaf: { bg: '#b45309', text: '#fff' },
}

export default function PersonFilterBar({ selected, onChange }: Props) {
  return (
    <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
      <button
        onClick={() => onChange(null)}
        className="shrink-0 px-4 py-1.5 rounded-full text-sm font-bold transition-all"
        style={
          selected === null
            ? { background: '#fff', color: '#0a0a0a' }
            : { background: 'rgba(255,255,255,0.12)', color: 'rgba(255,255,255,0.7)' }
        }
      >
        הכל
      </button>
      {FAMILY_MEMBERS.map(m => {
        const colors = MEMBER_COLORS[m.name]
        const isActive = selected === m.name
        return (
          <button
            key={m.name}
            onClick={() => onChange(isActive ? null : m.name)}
            className="shrink-0 px-4 py-1.5 rounded-full text-sm font-bold transition-all"
            style={
              isActive
                ? { background: colors.bg, color: colors.text }
                : { background: 'rgba(255,255,255,0.12)', color: 'rgba(255,255,255,0.7)' }
            }
          >
            {m.hebrewName}
          </button>
        )
      })}
    </div>
  )
}
