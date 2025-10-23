// API route to get current user session
import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function GET(req: NextRequest) {
  try {
    const session_token = req.cookies.get('session_token')?.value

    if (!session_token) {
      return NextResponse.json({ user: null })
    }

    // Get session and check if it's valid
    const { data: session, error: sessionError } = await supabase
      .from('user_sessions')
      .select('*, users(*)')
      .eq('session_token', session_token)
      .single()

    if (sessionError || !session) {
      return NextResponse.json({ user: null })
    }

    // Check if session is expired
    if (new Date(session.expires_at) < new Date()) {
      // Delete expired session
      await supabase
        .from('user_sessions')
        .delete()
        .eq('session_token', session_token)

      return NextResponse.json({ user: null })
    }

    // Update last_accessed
    await supabase
      .from('user_sessions')
      .update({ last_accessed: new Date().toISOString() })
      .eq('session_token', session_token)

    // Return user data
    return NextResponse.json({
      user: {
        id: session.users.id,
        email: session.users.email,
        username: session.users.username,
      },
    })
  } catch (error) {
    console.error('Get user error:', error)
    return NextResponse.json({ user: null })
  }
}
