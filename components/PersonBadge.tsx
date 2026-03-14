import { getMemberInfo, PersonName } from '@/lib/types'

export default function PersonBadge({ name, size = 'sm' }: { name: PersonName; size?: 'sm' | 'md' }) {
  const member = getMemberInfo(name)
  const sizeClass = size === 'md' ? 'px-3 py-1 text-sm' : 'px-2 py-0.5 text-xs'

  return (
    <span className={`inline-flex items-center rounded-full font-medium ${member.bgColor} ${member.textColor} ${sizeClass}`}>
      {member.hebrewName}
    </span>
  )
}
