import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  try {
    const transcriptId = request.nextUrl.searchParams.get('transcriptId')
    if (!transcriptId) return NextResponse.json([])
    
    const supabase = await createClient()
    const { data, error } = await supabase
      .from('chat_messages')
      .select('*')
      .eq('transcript_id', transcriptId)
      .order('created_at', { ascending: true })
    
    if (error) return NextResponse.json([])
    return NextResponse.json(data || [])
  } catch (error) {
    return NextResponse.json([])
  }
}

export async function POST(request: NextRequest) {
  try {
    const { transcriptId, message } = await request.json()
    if (!transcriptId || !message) {
      return NextResponse.json({ error: 'Missing fields' }, { status: 400 })
    }
    
    const supabase = await createClient()
    const { data: transcript } = await supabase
      .from('transcripts')
      .select('cleaned_text, title')
      .eq('id', transcriptId)
      .single()
    
    if (!transcript) {
      return NextResponse.json({ error: 'Transcript not found' }, { status: 404 })
    }
    
    await supabase.from('chat_messages').insert({
      transcript_id: transcriptId,
      role: 'user',
      content: message
    })
    
    const geminiApiKey = process.env.GEMINI_API_KEY
    const prompt = "Answer this question based ONLY on the meeting transcript below.\n\nMeeting: " + (transcript.title || 'Meeting') + "\n\nTranscript:\n" + (transcript.cleaned_text || '') + "\n\nQuestion: " + message + "\n\nAnswer concisely based on the transcript. If not found, say so."
    
    let aiReply = "Sorry, I couldn't answer that."
    
    if (geminiApiKey) {
      const geminiResponse = await fetch(
        "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=" + geminiApiKey,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{
              parts: [{ text: prompt }]
            }]
          })
        }
      )
      
      const geminiData = await geminiResponse.json()
      aiReply = geminiData.candidates?.[0]?.content?.parts?.[0]?.text || aiReply
    }
    
    await supabase.from('chat_messages').insert({
      transcript_id: transcriptId,
      role: 'assistant',
      content: aiReply
    })
    
    return NextResponse.json({ reply: aiReply })
  } catch (error) {
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
