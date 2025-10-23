// API route for signout
import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function POST(req: NextRequest) {
  try {
    const session_token = req.cookies.get('session_token')?.value

    if (session_token) {
      // Delete session from database
      await supabase
        .from('user_sessions')
        .delete()
        .eq('session_token', session_token)
    }

    // Clear cookie
    const response = NextResponse.json({ success: true })
    response.cookies.delete('session_token')

    return response
  } catch (error) {
    console.error('Signout error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
