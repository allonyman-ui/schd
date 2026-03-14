import { Event, getMemberInfo } from '@/lib/types'

interface EventCardProps {
  event: Event
  showPerson?: boolean
  onDelete?: (id: string) => void
}

export default function EventCard({ event, showPerson = true, onDelete }: EventCardProps) {
  const member = getMemberInfo(event.person)

  return (
    <div className={`event-card rounded-lg p-2 mb-1 ${member.bgColor} border border-opacity-30 relative group`}>
      <div className={`font-medium text-sm ${member.textColor}`}>{event.title}</div>
      {event.start_time && (
        <div className="text-xs text-gray-600">
          {event.start_time}{event.end_time ? ` - ${event.end_time}` : ''}
        </div>
      )}
      {event.location && (
        <div className="text-xs text-gray-500">📍 {event.location}</div>
      )}
      {showPerson && (
        <span className={`text-xs font-medium ${member.textColor}`}>{member.hebrewName}</span>
      )}
      {event.is_recurring && (
        <span className="text-xs text-gray-400 mr-1">🔄</span>
      )}
      {onDelete && (
        <button
          onClick={() => onDelete(event.id)}
          className="absolute top-1 left-1 opacity-0 group-hover:opacity-100 text-red-400 hover:text-red-600 text-xs transition no-print"
        >
          ✕
        </button>
      )}
    </div>
  )
}
