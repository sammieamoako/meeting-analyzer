'use client'

interface Transcript {
  id: string
  title: string
  meeting_date: string
  cleaned_text: string
}

interface SourcesPanelProps {
  transcripts: Transcript[]
  activeTranscriptId: string | null
  onSelectTranscript: (id: string) => void
}

export default function SourcesPanel({ 
  transcripts, 
  activeTranscriptId, 
  onSelectTranscript 
}: SourcesPanelProps) {
  return (
    <div className="h-full flex flex-col border-r border-gray-200 bg-gray-50">
      <div className="p-4 border-b border-gray-200">
        <h2 className="font-semibold text-gray-700">📁 SOURCES</h2>
        <p className="text-xs text-gray-500 mt-1">{transcripts.length} meetings</p>
      </div>
      
      <div className="flex-1 overflow-y-auto">
        {transcripts.length === 0 ? (
          <div className="p-4 text-center text-gray-500 text-sm">
            No meetings yet.<br />
            Upload or record audio above.
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {transcripts.map((transcript) => (
              <button
                key={transcript.id}
                onClick={() => onSelectTranscript(transcript.id)}
                className={`w-full text-left p-4 hover:bg-gray-100 transition-colors ${
                  activeTranscriptId === transcript.id ? 'bg-blue-50 border-l-4 border-blue-500' : ''
                }`}
              >
                <div className="flex items-center gap-2">
                  <span className="text-sm">
                    {activeTranscriptId === transcript.id ? '▶' : '📄'}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">
                      {transcript.title || new Date(transcript.meeting_date).toLocaleString()}
                    </p>
                    <p className="text-xs text-gray-500 truncate mt-0.5">
                      {transcript.cleaned_text?.substring(0, 60)}...
                    </p>
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}