'use client'

export const dynamic = 'force-dynamic'

import { useParams, useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase/client'
import { useDropzone } from 'react-dropzone'
import { Toaster, toast } from 'sonner'
import { useLiveRecording } from '@/hooks/useLiveRecording'
import ModernNoteCard from '@/components/ModernNoteCard'
import ModernChatMessage from '@/components/ModernChatMessage'
import ModernStudioCard from '@/components/ModernStudioCard'

interface Transcript {
  id: string
  title: string
  meeting_date: string
  cleaned_text: string
  speaker_turns: any
}

interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  created_at: string
}

export default function NotebookPage() {
  const { id } = useParams()
  const router = useRouter()
  const [notebook, setNotebook] = useState<any>(null)
  const [transcripts, setTranscripts] = useState<Transcript[]>([])
  const [activeTranscriptId, setActiveTranscriptId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [savingRecording, setSavingRecording] = useState(false)
  const [mobileTab, setMobileTab] = useState<'notes' | 'chat' | 'studio'>('notes')
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([])
  const [chatInput, setChatInput] = useState('')
  const [chatLoading, setChatLoading] = useState(false)
  const [studioLoading, setStudioLoading] = useState<string | null>(null)
  const [studioContent, setStudioContent] = useState<string | null>(null)

  const {
    isRecording,
    isConnecting,
    duration,
    liveTranscript,
    startRecording,
    stopRecording,
    formatDuration
  } = useLiveRecording({
    onError: (error) => toast.error(error),
    onTranscriptUpdate: (transcript, speaker) => {
      console.log(`Speaker ${speaker}: ${transcript}`)
    }
  })

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) {
        router.push('/')
      } else {
        loadNotebook()
        loadTranscripts()
      }
    })
  }, [id])

  useEffect(() => {
    if (activeTranscriptId) {
      loadChatHistory()
    }
  }, [activeTranscriptId])

  async function loadNotebook() {
    const { data } = await supabase
      .from('notebooks')
      .select('*')
      .eq('id', id)
      .single()
    setNotebook(data)
  }

  async function loadTranscripts() {
    const { data } = await supabase
      .from('transcripts')
      .select('*')
      .eq('notebook_id', id)
      .order('created_at', { ascending: false })
    setTranscripts(data || [])
    if (data && data.length > 0 && !activeTranscriptId) {
      setActiveTranscriptId(data[0].id)
    }
    setLoading(false)
  }

  async function loadChatHistory() {
    const response = await fetch(`/api/chat?transcriptId=${activeTranscriptId}`)
    if (response.ok) {
      const data = await response.json()
      setChatMessages(data)
    }
  }

  async function sendChatMessage() {
    if (!chatInput.trim() || !activeTranscriptId || chatLoading) return

    const message = chatInput.trim()
    setChatInput('')
    setChatLoading(true)

    const tempUserMessage: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: message,
      created_at: new Date().toISOString()
    }
    setChatMessages(prev => [...prev, tempUserMessage])

    const response = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        transcriptId: activeTranscriptId,
        message: message
      })
    })

    const data = await response.json()
    
    const assistantMessage: ChatMessage = {
      id: (Date.now() + 1).toString(),
      role: 'assistant',
      content: data.reply,
      created_at: new Date().toISOString()
    }
    setChatMessages(prev => [...prev, assistantMessage])
    setChatLoading(false)
  }

  async function generateStudioContent(type: string) {
    if (!activeTranscriptId) {
      toast.error('Please select a meeting first')
      return
    }

    setStudioLoading(type)
    setStudioContent(null)

    const response = await fetch('/api/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        transcriptId: activeTranscriptId,
        type: type
      })
    })

    const data = await response.json()
    setStudioContent(data.content)
    setStudioLoading(null)
  }

  const { getRootProps, getInputProps } = useDropzone({
    accept: { 'audio/*': ['.mp3', '.m4a', '.wav', '.webm'] },
    maxSize: 100 * 1024 * 1024,
    onDrop: async (acceptedFiles) => {
      if (acceptedFiles.length === 0) {
        toast.error('File too large. Max 100MB')
        return
      }
      await uploadToDeepgram(acceptedFiles[0])
    }
  })

  async function uploadToDeepgram(file: File) {
    setUploading(true)
    toast.info('Uploading to Deepgram...')

    try {
      const { data: transcript, error } = await supabase
        .from('transcripts')
        .insert({
          notebook_id: id,
          status: 'processing',
          meeting_date: new Date().toISOString()
        })
        .select()
        .single()

      if (error) throw error

      const response = await fetch('https://api.deepgram.com/v1/listen', {
        method: 'POST',
        headers: {
          'Authorization': `Token ${process.env.NEXT_PUBLIC_DEEPGRAM_API_KEY}`
        },
        body: file
      })

      const result = await response.json()
      
      const transcriptText = result.results?.channels[0]?.alternatives[0]?.transcript || ''
      const utterances = result.results?.channels[0]?.alternatives[0]?.utterances || []
      
      const speakerTurns = utterances.map((u: any) => ({
        speaker: `Speaker ${u.speaker + 1}`,
        text: u.transcript,
        start: u.start,
        end: u.end
      }))

      await supabase
        .from('transcripts')
        .update({
          cleaned_text: transcriptText,
          speaker_turns: speakerTurns,
          status: 'completed',
          title: new Date().toLocaleString()
        })
        .eq('id', transcript.id)

      toast.success('Meeting transcribed!')
      loadTranscripts()
      
    } catch (error: any) {
      console.error('Upload error:', error)
      toast.error(error.message || 'Upload failed')
    } finally {
      setUploading(false)
    }
  }

  async function saveLiveRecording() {
    if (!liveTranscript.trim()) {
      toast.error('No transcript to save')
      return
    }
    
    setSavingRecording(true)
    
    const { error } = await supabase
      .from('transcripts')
      .insert({
        notebook_id: id,
        title: `Live Recording ${new Date().toLocaleString()}`,
        cleaned_text: liveTranscript,
        status: 'completed',
        meeting_date: new Date().toISOString()
      })
    
    if (error) {
      console.error('Error saving recording:', error)
      toast.error('Failed to save recording')
    } else {
      toast.success('Recording saved!')
      loadTranscripts()
    }
    
    setSavingRecording(false)
  }

  if (loading) {
    return <div className="flex min-h-screen items-center justify-center">Loading...</div>
  }

  if (!notebook) {
    return <div className="flex min-h-screen items-center justify-center">Notebook not found</div>
  }

  const activeTranscript = transcripts.find(t => t.id === activeTranscriptId)

  function getSpeakersFromTranscript(transcript: Transcript): string[] {
    if (!transcript.speaker_turns) return []
    const speakers = new Set(transcript.speaker_turns.map((turn: any) => turn.speaker))
    return Array.from(speakers)
  }

  return (
    <>
      {/* Desktop Layout */}
      <div className="desktop-layout h-screen flex flex-col">
        <div className="bg-white border-b px-6 py-3 flex justify-between items-center">
          <div>
            <button onClick={() => router.push('/dashboard')} className="text-blue-500 hover:underline text-sm mr-4">
              ← Dashboard
            </button>
            <h1 className="text-xl font-bold inline">{notebook?.name}</h1>
          </div>
          <div className="text-sm text-gray-500">
            {transcripts.length} meeting{transcripts.length !== 1 ? 's' : ''}
          </div>
        </div>

        <div className="bg-gray-50 border-b px-4 py-2">
          <div {...getRootProps()} className={`cursor-pointer text-center py-1 px-3 rounded-lg text-sm transition-colors inline-block ${uploading ? 'opacity-50' : 'hover:bg-gray-200'}`}>
            <input {...getInputProps()} disabled={uploading} />
            {uploading ? '⏳ Processing...' : '📁 + Upload Audio'}
          </div>
        </div>

        <div className="bg-gray-50 border-b px-4 py-2">
          <div className="flex items-center gap-4">
            {!isRecording && !isConnecting && !liveTranscript && (
              <button onClick={startRecording} className="bg-red-500 text-white px-4 py-1 rounded-lg text-sm hover:bg-red-600">
                🎙️ Record
              </button>
            )}
            
            {(isConnecting || isRecording) && (
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2">
                  <div className={`w-2 h-2 rounded-full ${isRecording ? 'bg-red-500 animate-pulse' : 'bg-yellow-500'}`}></div>
                  <span className="font-mono text-sm">{formatDuration(duration)}</span>
                </div>
                {isRecording && (
                  <button onClick={stopRecording} className="bg-gray-500 text-white px-4 py-1 rounded-lg text-sm hover:bg-gray-600">
                    Stop
                  </button>
                )}
              </div>
            )}
            
            {!isRecording && !isConnecting && liveTranscript && (
              <div className="flex items-center gap-3">
                <span className="text-sm text-gray-600 truncate max-w-md">{liveTranscript.substring(0, 100)}...</span>
                <button onClick={saveLiveRecording} disabled={savingRecording} className="bg-green-500 text-white px-4 py-1 rounded-lg text-sm hover:bg-green-600">
                  {savingRecording ? 'Saving...' : 'Save'}
                </button>
              </div>
            )}
          </div>
        </div>

        <div className="flex-1 flex overflow-hidden">
          <div className="w-80 flex-shrink-0 border-r border-gray-200 overflow-y-auto p-4">
            <h2 className="font-semibold mb-3">📁 Sources</h2>
            {transcripts.map((transcript) => (
              <div
                key={transcript.id}
                onClick={() => setActiveTranscriptId(transcript.id)}
                className={`p-3 rounded-lg cursor-pointer mb-2 ${activeTranscriptId === transcript.id ? 'bg-blue-50 border-l-4 border-blue-500' : 'hover:bg-gray-50'}`}
              >
                <div className="font-medium">{transcript.title || new Date(transcript.meeting_date).toLocaleDateString()}</div>
                <div className="text-xs text-gray-500 mt-1 line-clamp-2">{transcript.cleaned_text?.substring(0, 80)}</div>
              </div>
            ))}
          </div>
          
          <div className="flex-1 flex flex-col">
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {chatMessages.map((msg) => (
                <ModernChatMessage key={msg.id} role={msg.role} content={msg.content} timestamp={new Date(msg.created_at).toLocaleTimeString()} />
              ))}
              {chatLoading && <div className="text-center text-gray-500">Thinking...</div>}
            </div>
            <div className="p-4 border-t">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && sendChatMessage()}
                  placeholder="Ask about this meeting..."
                  className="flex-1 border rounded-xl px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <button onClick={sendChatMessage} disabled={chatLoading} className="bg-blue-500 text-white px-4 py-2 rounded-xl text-sm">Send</button>
              </div>
            </div>
          </div>
          
          <div className="w-96 flex-shrink-0 border-l border-gray-200 overflow-y-auto p-4">
            <h2 className="font-semibold mb-3">🎨 Studio</h2>
            <div className="space-y-2">
              {['briefing', 'actions', 'quiz', 'flashcards', 'timeline'].map((type) => (
                <button
                  key={type}
                  onClick={() => generateStudioContent(type)}
                  className="w-full text-left p-3 rounded-lg bg-gray-50 hover:bg-gray-100 capitalize"
                >
                  {studioLoading === type ? '⏳ Generating...' : `Generate ${type}`}
                </button>
              ))}
            </div>
            {studioContent && (
              <div className="mt-4 p-3 bg-gray-50 rounded-lg">
                <pre className="text-sm whitespace-pre-wrap">{studioContent}</pre>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Mobile Layout */}
      <div className="mobile-layout">
        {/* Header */}
        <div className="sticky top-0 bg-background border-b border-border px-4 py-3 z-40">
          <button onClick={() => router.push('/dashboard')} className="text-primary text-sm mb-2">
            ← Dashboard
          </button>
          <h1 className="text-xl font-bold text-foreground">{notebook?.name}</h1>
        </div>

        {/* Quick Actions */}
        <div className="px-4 py-3 space-y-3">
          <div
            {...getRootProps()}
            className={`modern-card p-4 flex items-center justify-between cursor-pointer ${uploading ? 'opacity-50' : ''}`}
          >
            <div className="flex items-center gap-3">
              <span className="text-2xl">📎</span>
              <div>
                <h3 className="font-semibold text-foreground">Upload File</h3>
                <p className="text-xs text-muted-foreground">Upload audio or video file</p>
              </div>
            </div>
            <input {...getInputProps()} disabled={uploading} />
            <span className="text-muted-foreground">{uploading ? '⏳' : '→'}</span>
          </div>

          <div className="modern-card p-4">
            {!isRecording && !isConnecting && !liveTranscript && (
              <button onClick={startRecording} className="w-full flex items-center gap-3">
                <span className="text-2xl">🎙️</span>
                <div className="flex-1 text-left">
                  <h3 className="font-semibold text-foreground">Quick Record</h3>
                  <p className="text-xs text-muted-foreground">Tap to start recording your meeting</p>
                </div>
                <span className="text-muted-foreground">→</span>
              </button>
            )}
            
            {(isConnecting || isRecording) && (
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className={`w-2 h-2 rounded-full ${isRecording ? 'bg-red-500 animate-pulse' : 'bg-yellow-500'}`}></div>
                  <span className="font-mono">{formatDuration(duration)}</span>
                </div>
                {isRecording && (
                  <button onClick={stopRecording} className="bg-gray-500 text-white px-4 py-2 rounded-lg text-sm">
                    Stop
                  </button>
                )}
              </div>
            )}
            
            {!isRecording && !isConnecting && liveTranscript && (
              <div>
                <p className="text-sm text-muted-foreground mb-2 line-clamp-2">{liveTranscript.substring(0, 100)}...</p>
                <button onClick={saveLiveRecording} disabled={savingRecording} className="w-full bg-green-500 text-white py-2 rounded-lg text-sm">
                  {savingRecording ? 'Saving...' : 'Save Recording'}
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Active Panel */}
        <div className={`mobile-panel px-4 pb-24 ${mobileTab === 'notes' ? '' : 'hidden'}`}>
          <h2 className="font-semibold text-foreground mb-3">Recent Meetings</h2>
          {transcripts.length === 0 ? (
            <div className="text-center text-muted-foreground py-8">No meetings yet. Upload or record above.</div>
          ) : (
            transcripts.map((transcript) => (
              <ModernNoteCard
                key={transcript.id}
                title={transcript.title || new Date(transcript.meeting_date).toLocaleDateString()}
                date={new Date(transcript.meeting_date).toLocaleDateString()}
                preview={transcript.cleaned_text?.substring(0, 100) || 'No transcript available'}
                speakers={getSpeakersFromTranscript(transcript)}
                isActive={activeTranscriptId === transcript.id}
                onClick={() => setActiveTranscriptId(transcript.id)}
              />
            ))
          )}
        </div>

        <div className={`mobile-panel px-4 pb-24 ${mobileTab === 'chat' ? '' : 'hidden'}`}>
          {activeTranscriptId ? (
            <>
              <div className="flex-1 overflow-y-auto space-y-4 mb-4" style={{ maxHeight: 'calc(100vh - 200px)' }}>
                {chatMessages.length === 0 && (
                  <div className="text-center text-muted-foreground py-8">Ask a question about this meeting</div>
                )}
                {chatMessages.map((msg) => (
                  <ModernChatMessage key={msg.id} role={msg.role} content={msg.content} timestamp={new Date(msg.created_at).toLocaleTimeString()} />
                ))}
                {chatLoading && <div className="text-center text-muted-foreground">Thinking...</div>}
              </div>
              <div className="flex gap-2 pt-2">
                <input
                  type="text"
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && sendChatMessage()}
                  placeholder="Ask about this meeting..."
                  className="flex-1 border border-border rounded-xl px-4 py-3 text-sm bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                />
                <button onClick={sendChatMessage} disabled={chatLoading} className="bg-primary text-primary-foreground px-4 py-3 rounded-xl text-sm font-medium">
                  Send
                </button>
              </div>
            </>
          ) : (
            <div className="text-center text-muted-foreground py-8">Select a meeting from Notes tab to start chatting</div>
          )}
        </div>

        <div className={`mobile-panel px-4 pb-24 ${mobileTab === 'studio' ? '' : 'hidden'}`}>
          <h2 className="font-semibold text-foreground mb-3">Generate Content</h2>
          <ModernStudioCard
            icon="📝"
            title="Briefing Doc"
            description="Executive summary of key decisions"
            onClick={() => generateStudioContent('briefing')}
            isLoading={studioLoading === 'briefing'}
          />
          <ModernStudioCard
            icon="✓"
            title="Action Items"
            description="Extract tasks, owners, and deadlines"
            onClick={() => generateStudioContent('actions')}
            isLoading={studioLoading === 'actions'}
          />
          <ModernStudioCard
            icon="📋"
            title="Quiz"
            description="Test knowledge from your meetings"
            onClick={() => generateStudioContent('quiz')}
            isLoading={studioLoading === 'quiz'}
          />
          <ModernStudioCard
            icon="🃏"
            title="Flashcards"
            description="Study key concepts and decisions"
            onClick={() => generateStudioContent('flashcards')}
            isLoading={studioLoading === 'flashcards'}
          />
          <ModernStudioCard
            icon="📊"
            title="Timeline"
            description="Chronological view of events"
            onClick={() => generateStudioContent('timeline')}
            isLoading={studioLoading === 'timeline'}
          />
          
          {studioContent && (
            <div className="modern-card p-4 mt-4">
              <pre className="text-sm whitespace-pre-wrap text-foreground">{studioContent}</pre>
            </div>
          )}
        </div>

        {/* Bottom Tab Bar */}
        <div className="modern-tab-bar">
          <div className="flex max-w-md mx-auto">
            <button onClick={() => setMobileTab('notes')} className={`modern-tab ${mobileTab === 'notes' ? 'active' : ''}`}>
              <span className="modern-tab-icon">📄</span>
              <span>Notes</span>
            </button>
            <button onClick={() => setMobileTab('chat')} className={`modern-tab ${mobileTab === 'chat' ? 'active' : ''}`}>
              <span className="modern-tab-icon">💬</span>
              <span>Chat</span>
            </button>
            <button onClick={() => setMobileTab('studio')} className={`modern-tab ${mobileTab === 'studio' ? 'active' : ''}`}>
              <span className="modern-tab-icon">✨</span>
              <span>Studio</span>
            </button>
          </div>
        </div>
      </div>

      <Toaster position="bottom-right" />
    </>
  )
}
