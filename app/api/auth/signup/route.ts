// API route for user signup
import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { supabase } from '@/lib/supabase'
import { randomBytes } from 'crypto'

export async function POST(req: NextRequest) {
  try {
    const { email, password, username } = await req.json()

    // Validate input
    if (!email || !password || !username) {
      return NextResponse.json(
        { error: 'Email, password, and username are required' },
        { status: 400 }
      )
    }

    // Check if user already exists
    const { data: existingUser } = await supabase
      .from('users')
      .select('id')
      .eq('email', email)
      .single()

    if (existingUser) {
      return NextResponse.json(
        { error: 'User with this email already exists' },
        { status: 409 }
      )
    }

    // Hash password
    const password_hash = await bcrypt.hash(password, 10)

    // Create user
    const { data: newUser, error: createError } = await supabase
      .from('users')
      .insert({
        email,
        password_hash,
        username,
      })
      .select()
      .single()

    if (createError) {
      console.error('Error creating user:', createError)
      console.error('Error details:', JSON.stringify(createError, null, 2))
      return NextResponse.json(
        { error: 'Failed to create user', details: createError.message },
        { status: 500 }
      )
    }

    // Create session
    const session_token = randomBytes(32).toString('hex')
    const expires_at = new Date()
    expires_at.setDate(expires_at.getDate() + 7) // 7 days

    // Get IP address - handle null case for inet type
    const ipHeader = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip')
    const ip_address = ipHeader ? ipHeader.split(',')[0].trim() : null

    const { error: sessionError } = await supabase
      .from('user_sessions')
      .insert({
        user_id: newUser.id,
        session_token,
        expires_at: expires_at.toISOString(),
        ip_address: ip_address,
        user_agent: req.headers.get('user-agent'),
      })

    if (sessionError) {
      console.error('Error creating session:', sessionError)
      return NextResponse.json(
        { error: 'Failed to create session' },
        { status: 500 }
      )
    }

    // Return user data and session token
    const response = NextResponse.json({
      user: {
        id: newUser.id,
        email: newUser.email,
        username: newUser.username,
      },
      session_token,
    })

    // Set cookie
    response.cookies.set('session_token', session_token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7, // 7 days
      path: '/',
    })

    return response
  } catch (error) {
    console.error('Signup error:', error)
    console.error('Error stack:', error instanceof Error ? error.stack : 'No stack trace')
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
