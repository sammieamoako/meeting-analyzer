interface ModernNoteCardProps {
  title: string
  date: string
  preview: string
  speakers: string[]
  isActive?: boolean
  onClick: () => void
}

export default function ModernNoteCard({ title, date, preview, speakers, isActive, onClick }: ModernNoteCardProps) {
  return (
    <div 
      onClick={onClick}
      className={`modern-card p-4 mb-3 cursor-pointer ${isActive ? 'ring-2 ring-blue-500' : ''}`}
    >
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-lg">▶</span>
            <h3 className="font-semibold text-foreground">{title}</h3>
          </div>
          <p className="text-sm text-muted-foreground mb-2">{date}</p>
          <p className="text-sm text-foreground line-clamp-2">{preview}</p>
          <div className="flex flex-wrap gap-1 mt-2">
            {speakers.slice(0, 3).map((speaker, idx) => (
              <span key={idx} className="text-xs px-2 py-0.5 bg-muted rounded-full text-muted-foreground">
                👤 {speaker}
              </span>
            ))}
            {speakers.length > 3 && (
              <span className="text-xs px-2 py-0.5 bg-muted rounded-full text-muted-foreground">
                +{speakers.length - 3}
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
