import { notFound } from 'next/navigation'
import { FAMILY_MEMBERS, PersonName } from '@/lib/types'
import CalendarView from '@/components/CalendarView'
import Link from 'next/link'

interface Props {
  params: { name: string }
}

export default function PersonPage({ params }: Props) {
  const member = FAMILY_MEMBERS.find(m => m.name === params.name)
  if (!member) notFound()

  return (
    <div>
      <div className="mb-6 flex items-center gap-4">
        <Link href="/" className="text-gray-400 hover:text-gray-600 text-sm">
          ← כל המשפחה
        </Link>
        <h1 className={`text-2xl font-bold ${member.textColor}`}>
          לוח זמנים של {member.hebrewName}
        </h1>
        <span className={`px-4 py-1 rounded-full text-sm font-medium ${member.bgColor} ${member.textColor}`}>
          {member.name}
        </span>
      </div>
      <CalendarView personFilter={member.name} />
    </div>
  )
}

export function generateStaticParams() {
  return FAMILY_MEMBERS.map(m => ({ name: m.name }))
}
