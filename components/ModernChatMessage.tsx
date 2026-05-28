interface ModernChatMessageProps {
  role: 'user' | 'assistant'
  content: string
  timestamp: string
}

export default function ModernChatMessage({ role, content, timestamp }: ModernChatMessageProps) {
  const isUser = role === 'user'
  
  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'} mb-4`}>
      <div className={`max-w-[85%] ${isUser ? 'bg-primary text-primary-foreground' : 'bg-card border border-border'} rounded-2xl px-4 py-3 shadow-sm`}>
        <p className="text-sm leading-relaxed">{content}</p>
        <p className={`text-xs mt-1 ${isUser ? 'text-primary-foreground/70' : 'text-muted-foreground'}`}>
          {timestamp}
        </p>
      </div>
    </div>
  )
}
