'use client'

import { useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabase/client'

function CallbackContent() {
  const router = useRouter()
  const searchParams = useSearchParams()

  useEffect(() => {
    const handleCallback = async () => {
      const code = searchParams.get('code')
      
      if (!code) {
        router.push('/')
        return
      }
      
      const { error } = await supabase.auth.exchangeCodeForSession(code)
      
      if (error) {
        console.error('Exchange error:', error.message)
        router.push('/?error=' + encodeURIComponent(error.message))
      } else {
        router.push('/dashboard')
      }
    }
    
    handleCallback()
  }, [searchParams, router])

  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="text-lg">Completing login...</div>
    </div>
  )
}

export default function CallbackPage() {
  return (
    <Suspense fallback={<div className="flex min-h-screen items-center justify-center">Loading...</div>}>
      <CallbackContent />
    </Suspense>
  )
}
