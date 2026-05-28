interface ModernStudioCardProps {
  icon: string
  title: string
  description: string
  onClick: () => void
  isLoading?: boolean
}

export default function ModernStudioCard({ icon, title, description, onClick, isLoading }: ModernStudioCardProps) {
  return (
    <button
      onClick={onClick}
      disabled={isLoading}
      className="modern-card w-full p-4 mb-3 flex items-center justify-between hover:shadow-md transition-all active:scale-[0.98]"
    >
      <div className="flex items-center gap-3">
        <span className="text-2xl">{icon}</span>
        <div className="text-left">
          <h3 className="font-semibold text-foreground">{title}</h3>
          <p className="text-xs text-muted-foreground">{description}</p>
        </div>
      </div>
      <span className="text-muted-foreground">
        {isLoading ? '⏳' : '→'}
      </span>
    </button>
  )
}
