'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

export const dynamic = 'force-dynamic'

export default function DashboardPage() {
  const [notebooks, setNotebooks] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [user, setUser] = useState<any>(null)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()

  useEffect(() => {
    const checkUser = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      
      if (!session) {
        router.replace('/')
        return
      }
      
      setUser(session.user)
      await loadNotebooks()
      setLoading(false)
    }
    
    checkUser()
  }, [router])

  async function loadNotebooks() {
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) return
    
    const { data, error } = await supabase
      .from('notebooks')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
    
    if (error) {
      console.error('Error loading notebooks:', error)
      setError(error.message)
    } else {
      setNotebooks(data || [])
    }
  }

  async function createNotebook() {
    const name = prompt('Notebook name?')
    if (!name) return
    
    setError(null)
    
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    
    if (userError || !user) {
      setError('You must be logged in')
      return
    }
    
    const { error } = await supabase
      .from('notebooks')
      .insert({ 
        name: name,
        user_id: user.id
      })
    
    if (error) {
      console.error('Error creating notebook:', error)
      setError(`Failed to create notebook: ${error.message}`)
    } else {
      await loadNotebooks()
    }
  }

  async function deleteNotebook(id: string, e: React.MouseEvent) {
    e.stopPropagation()
    
    const confirmed = confirm('Are you sure you want to delete this notebook? All meetings inside will also be deleted.')
    if (!confirmed) return
    
    const { error } = await supabase
      .from('notebooks')
      .delete()
      .eq('id', id)
    
    if (error) {
      console.error('Error deleting notebook:', error)
      setError(`Failed to delete notebook: ${error.message}`)
    } else {
      await loadNotebooks()
    }
  }

  async function signOut() {
    await supabase.auth.signOut()
    router.push('/')
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-lg">Loading...</div>
      </div>
    )
  }

  return (
    <div className="p-8">
      <div className="mb-8 flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold">Your Notebooks</h1>
          <p className="text-sm text-gray-500">Welcome, {user?.email}</p>
        </div>
        <div className="space-x-2">
          <button
            onClick={createNotebook}
            className="rounded-lg bg-blue-500 px-4 py-2 text-white hover:bg-blue-600"
          >
            New Notebook
          </button>
          <button
            onClick={signOut}
            className="rounded-lg bg-gray-500 px-4 py-2 text-white hover:bg-gray-600"
          >
            Sign Out
          </button>
        </div>
      </div>
      
      {error && (
        <div className="mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded">
          {error}
        </div>
      )}
      
      {notebooks.length === 0 ? (
        <div className="text-center py-12 text-gray-500 border rounded-lg">
          No notebooks yet. Click "New Notebook" to get started.
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {notebooks.map((notebook) => (
            <div
              key={notebook.id}
              onClick={() => router.push(`/notebook/${notebook.id}`)}
              className="cursor-pointer rounded-lg border p-4 hover:shadow-lg transition-shadow relative group"
            >
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <h2 className="font-semibold">{notebook.name}</h2>
                  <p className="text-sm text-gray-500">
                    {new Date(notebook.created_at).toLocaleDateString()}
                  </p>
                </div>
                <button
                  onClick={(e) => deleteNotebook(notebook.id, e)}
                  className="text-red-500 hover:text-red-700 opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  🗑️
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
