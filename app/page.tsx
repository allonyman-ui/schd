import CalendarView from '@/components/CalendarView'
import { FAMILY_MEMBERS } from '@/lib/types'
import Link from 'next/link'

export default function HomePage() {
  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-800">לוח הזמנים המשפחתי</h1>
        <div className="flex gap-2 flex-wrap">
          {FAMILY_MEMBERS.map(member => (
            <Link
              key={member.name}
              href={`/person/${member.name}`}
              className={`px-3 py-1 rounded-full text-sm font-medium ${member.bgColor} ${member.textColor} hover:opacity-80 transition`}
            >
              {member.hebrewName}
            </Link>
          ))}
        </div>
      </div>
      <CalendarView />
    </div>
  )
}
