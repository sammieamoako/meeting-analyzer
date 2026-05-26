import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(request: NextRequest) {
  console.log('Generate API called')
  
  try {
    const { transcriptId, type } = await request.json()
    console.log('Type:', type, 'TranscriptId:', transcriptId)
    
    if (!transcriptId || !type) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }
    
    const supabase = await createClient()
    const { data: transcript, error } = await supabase
      .from('transcripts')
      .select('cleaned_text, title')
      .eq('id', transcriptId)
      .single()
    
    if (error || !transcript) {
      console.error('Transcript not found:', error)
      return NextResponse.json({ error: 'Transcript not found' }, { status: 404 })
    }
    
    const transcriptText = transcript.cleaned_text || ''
    const meetingTitle = transcript.title || 'Meeting'
    
    let prompt = ''
    if (type === 'briefing') {
      prompt = "You are a professional meeting assistant. Create an executive briefing document from the following meeting transcript.\n\nMeeting: " + meetingTitle + "\n\nTranscript:\n" + transcriptText + "\n\nPlease provide:\n1. Executive Summary (2-3 sentences)\n2. Key Topics Discussed (bullet points)\n3. Main Decisions Made (bullet points)\n4. Action Items (with owners if mentioned)\n5. Next Steps\n\nFormat clearly with markdown headings."
    } else if (type === 'actions') {
      prompt = "Extract all action items from this meeting transcript.\n\nMeeting: " + meetingTitle + "\n\nTranscript:\n" + transcriptText + "\n\nFor each action item, identify:\n- What needs to be done\n- Who is responsible (if mentioned)\n- Deadline (if mentioned)\n\nFormat as a numbered checklist."
    } else if (type === 'quiz') {
      prompt = "Create a 5-question quiz based on this meeting transcript.\n\nMeeting: " + meetingTitle + "\n\nTranscript:\n" + transcriptText + "\n\nFor each question:\n1. Write a clear multiple-choice question\n2. Provide 4 options (A, B, C, D)\n3. Indicate the correct answer\n4. Add a brief explanation"
    } else if (type === 'flashcards') {
      prompt = "Create 6 flashcards for studying the key points from this meeting transcript.\n\nMeeting: " + meetingTitle + "\n\nTranscript:\n" + transcriptText
    } else if (type === 'timeline') {
      prompt = "Create a chronological timeline of key events, decisions, and milestones from this meeting transcript.\n\nMeeting: " + meetingTitle + "\n\nTranscript:\n" + transcriptText
    } else {
      prompt = "Summarize this meeting transcript in 3-5 bullet points:\n\n" + transcriptText
    }
    
    const geminiApiKey = process.env.GEMINI_API_KEY
    if (!geminiApiKey) {
      return NextResponse.json({ error: 'AI service not configured' }, { status: 500 })
    }
    
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
    const content = geminiData.candidates?.[0]?.content?.parts?.[0]?.text || 'Failed to generate content.'
    
    console.log('Generation successful, length:', content.length)
    
    return NextResponse.json({ content })
  } catch (error) {
    console.error('Generation error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
