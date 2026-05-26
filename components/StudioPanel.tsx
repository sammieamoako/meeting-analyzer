'use client'

import { useState } from 'react'

interface StudioPanelProps {
  transcriptId: string | null
  transcriptContent?: string
}

type ActiveTab = 'briefing' | 'actions' | 'quiz' | 'flashcards' | 'timeline'

export default function StudioPanel({ transcriptId, transcriptContent }: StudioPanelProps) {
  const [activeTab, setActiveTab] = useState<ActiveTab>('briefing')
  const [generating, setGenerating] = useState(false)
  const [generatedContent, setGeneratedContent] = useState<string | null>(null)

  const tabs = [
    { id: 'briefing' as const, label: '📝 Briefing', icon: '📝' },
    { id: 'actions' as const, label: '✓ Actions', icon: '✓' },
    { id: 'quiz' as const, label: '📋 Quiz', icon: '📋' },
    { id: 'flashcards' as const, label: '🃏 Cards', icon: '🃏' },
    { id: 'timeline' as const, label: '📊 Timeline', icon: '📊' },
  ]

  async function generate() {
    if (!transcriptId) return
    
    setGenerating(true)
    setGeneratedContent(null)
    
    const response = await fetch('/api/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        transcriptId,
        type: activeTab
      })
    })
    
    const data = await response.json()
    setGeneratedContent(data.content)
    setGenerating(false)
  }

  if (!transcriptId) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-gray-400">
        <p className="text-lg mb-2">🎨 No source selected</p>
        <p className="text-sm">Select a meeting to generate content</p>
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col border-l border-gray-200 bg-gray-50">
      {/* Header */}
      <div className="p-4 border-b border-gray-200 bg-white">
        <h2 className="font-semibold text-gray-700">🎨 STUDIO</h2>
        <p className="text-xs text-gray-500 mt-1">Generate content from selected meeting</p>
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap gap-1 p-3 border-b border-gray-200 bg-white">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${
              activeTab === tab.id
                ? 'bg-blue-500 text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Content Area */}
      <div className="flex-1 overflow-y-auto p-4">
        <button
          onClick={generate}
          disabled={generating}
          className="w-full bg-green-500 text-white px-4 py-2 rounded-lg hover:bg-green-600 disabled:opacity-50 mb-4"
        >
          {generating ? 'Generating...' : `Generate ${tabs.find(t => t.id === activeTab)?.label}`}
        </button>

        {generatedContent && (
          <div className="bg-white rounded-lg border p-4">
            <pre className="text-sm whitespace-pre-wrap font-sans">
              {generatedContent}
            </pre>
            <button className="mt-3 text-blue-500 text-sm hover:underline">
              Save to notebook
            </button>
          </div>
        )}

        {!generatedContent && !generating && (
          <div className="text-center text-gray-400 text-sm mt-8">
            Click the button above to generate
            <br />
            {activeTab === 'briefing' && '📝 Executive summary of the meeting'}
            {activeTab === 'actions' && '✓ Extract tasks, owners, and deadlines'}
            {activeTab === 'quiz' && '📋 Create a quiz from meeting content'}
            {activeTab === 'flashcards' && '🃏 Generate study cards'}
            {activeTab === 'timeline' && '📊 Create a chronological timeline'}
          </div>
        )}
      </div>
    </div>
  )
}