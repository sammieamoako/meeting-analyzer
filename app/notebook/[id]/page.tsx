'use client'

export const dynamic = 'force-dynamic'

// rest of your notebook code...
'use client'

import { useParams, useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase/client'
import { useDropzone } from 'react-dropzone'
import { Toaster, toast } from 'sonner'
import { useLiveRecording } from '@/hooks/useLiveRecording'
import SourcesPanel from '@/components/SourcesPanel'
import ChatPanel from '@/components/ChatPanel'
import StudioPanel from '@/components/StudioPanel'

export const dynamic = 'force-dynamic'

interface Transcript {
  id: string
  title: string
  meeting_date: string
  cleaned_text: string
  speaker_turns: any
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
      setTranscripts(prev => [])
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

  return (
    <div className="h-screen flex flex-col">
      {/* Header */}
      <div className="bg-white border-b px-6 py-3 flex justify-between items-center">
        <div>
          <button 
            onClick={() => router.push('/dashboard')} 
            className="text-blue-500 hover:underline text-sm mr-4"
          >
            ← Dashboard
          </button>
          <h1 className="text-xl font-bold inline">{notebook?.name}</h1>
        </div>
        <div className="text-sm text-gray-500">
          {transcripts.length} meeting{transcripts.length !== 1 ? 's' : ''}
        </div>
      </div>

      {/* Upload Bar */}
      <div className="bg-gray-50 border-b px-4 py-2">
        <div
          {...getRootProps()}
          className={`cursor-pointer text-center py-1 px-3 rounded-lg text-sm transition-colors inline-block ${
            uploading ? 'opacity-50' : 'hover:bg-gray-200'
          }`}
        >
          <input {...getInputProps()} disabled={uploading} />
          {uploading ? '⏳ Processing...' : '📁 + Upload Audio'}
        </div>
      </div>

      {/* Live Recording Section */}
      <div className="bg-gray-50 border-b px-4 py-2">
        <div className="flex items-center gap-4">
          {!isRecording && !isConnecting && !liveTranscript && (
            <button
              onClick={startRecording}
              className="bg-red-500 text-white px-4 py-1 rounded-lg text-sm hover:bg-red-600"
            >
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
                <button
                  onClick={stopRecording}
                  className="bg-gray-500 text-white px-4 py-1 rounded-lg text-sm hover:bg-gray-600"
                >
                  Stop
                </button>
              )}
            </div>
          )}
          
          {!isRecording && !isConnecting && liveTranscript && (
            <div className="flex items-center gap-3">
              <span className="text-sm text-gray-600 truncate max-w-md">{liveTranscript.substring(0, 100)}...</span>
              <button
                onClick={saveLiveRecording}
                disabled={savingRecording}
                className="bg-green-500 text-white px-4 py-1 rounded-lg text-sm hover:bg-green-600"
              >
                {savingRecording ? 'Saving...' : 'Save'}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Three Columns */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left: Sources */}
        <div className="w-80 flex-shrink-0 border-r border-gray-200">
          <SourcesPanel
            transcripts={transcripts}
            activeTranscriptId={activeTranscriptId}
            onSelectTranscript={setActiveTranscriptId}
          />
        </div>

        {/* Center: Chat */}
        <div className="flex-1 flex flex-col">
          <ChatPanel
            transcriptId={activeTranscriptId}
            transcriptTitle={activeTranscript?.title}
          />
        </div>

        {/* Right: Studio */}
        <div className="w-96 flex-shrink-0 border-l border-gray-200">
          <StudioPanel
            transcriptId={activeTranscriptId}
            transcriptContent={activeTranscript?.cleaned_text}
          />
        </div>
      </div>

      <Toaster position="bottom-right" />
    </div>
  )
}
