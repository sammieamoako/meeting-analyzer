import { useState, useRef, useCallback } from 'react'

interface UseLiveRecordingOptions {
  onTranscriptUpdate?: (transcript: string, speaker: number, isFinal: boolean) => void
  onError?: (error: string) => void
}

export function useLiveRecording(options: UseLiveRecordingOptions = {}) {
  const [isRecording, setIsRecording] = useState(false)
  const [isConnecting, setIsConnecting] = useState(false)
  const [duration, setDuration] = useState(0)
  const [liveTranscript, setLiveTranscript] = useState('')
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const websocketRef = useRef<WebSocket | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const durationIntervalRef = useRef<NodeJS.Timeout | null>(null)

  const startRecording = useCallback(async () => {
    setIsConnecting(true)
    setLiveTranscript('')
    setDuration(0)
    
    try {
      // Request microphone access
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          sampleRate: 16000
        } 
      })
      streamRef.current = stream
      
      // Open WebSocket to Deepgram
      const deepgramUrl = `wss://api.deepgram.com/v1/listen?diarize=true&punctuate=true&smart_format=true&encoding=linear16&sample_rate=16000`
      const ws = new WebSocket(deepgramUrl, [
        'token',
        process.env.NEXT_PUBLIC_DEEPGRAM_API_KEY || ''
      ])
      websocketRef.current = ws
      
      ws.onopen = () => {
        console.log('WebSocket connected')
        setIsConnecting(false)
        setIsRecording(true)
        
        // Start duration timer
        durationIntervalRef.current = setInterval(() => {
          setDuration(prev => prev + 1)
        }, 1000)
        
        // Set up MediaRecorder
        const mediaRecorder = new MediaRecorder(stream, {
          mimeType: 'audio/webm',
          audioBitsPerSecond: 32000
        })
        mediaRecorderRef.current = mediaRecorder
        
        mediaRecorder.ondataavailable = async (event) => {
          if (event.data.size > 0 && ws.readyState === WebSocket.OPEN) {
            // Convert to base64 and send
            const reader = new FileReader()
            reader.onload = () => {
              const base64 = (reader.result as string).split(',')[1]
              ws.send(JSON.stringify({ type: 'data', data: base64 }))
            }
            reader.readAsDataURL(event.data)
          }
        }
        
        mediaRecorder.start(1000) // Send chunks every second
      }
      
      ws.onmessage = (event) => {
        const data = JSON.parse(event.data)
        if (data.type === 'Results') {
          const transcript = data.channel?.alternatives[0]?.transcript || ''
          const speaker = data.channel?.alternatives[0]?.speaker || 0
          const isFinal = data.is_final || false
          
          setLiveTranscript(prev => {
            if (isFinal) {
              return prev ? prev + ' ' + transcript : transcript
            }
            return prev
          })
          
          options.onTranscriptUpdate?.(transcript, speaker, isFinal)
        }
      }
      
      ws.onerror = (error) => {
        console.error('WebSocket error:', error)
        options.onError?.('Connection error')
        stopRecording()
      }
      
    } catch (error) {
      console.error('Error starting recording:', error)
      options.onError?.('Could not access microphone')
      setIsConnecting(false)
    }
  }, [options])
  
  const stopRecording = useCallback(() => {
    // Stop timer
    if (durationIntervalRef.current) {
      clearInterval(durationIntervalRef.current)
      durationIntervalRef.current = null
    }
    
    // Stop MediaRecorder
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop()
    }
    
    // Close WebSocket
    if (websocketRef.current && websocketRef.current.readyState === WebSocket.OPEN) {
      websocketRef.current.send(JSON.stringify({ type: 'CloseStream' }))
      websocketRef.current.close()
    }
    
    // Stop microphone tracks
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop())
    }
    
    setIsRecording(false)
    mediaRecorderRef.current = null
    websocketRef.current = null
    streamRef.current = null
  }, [])
  
  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  }
  
  return {
    isRecording,
    isConnecting,
    duration,
    liveTranscript,
    startRecording,
    stopRecording,
    formatDuration
  }
}