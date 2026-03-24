import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';

export async function POST(request: NextRequest) {
  try {
    const { uid, email } = await request.json();

    if (!uid || !email) {
      return NextResponse.json({ error: 'Missing uid or email' }, { status: 400 });
    }

    // Upsert user to app_users table
    await query(
      `INSERT INTO app_users (uid, email, created_at, updated_at)
       VALUES ($1, $2, NOW(), NOW())
       ON CONFLICT (uid) DO UPDATE SET updated_at = NOW()`,
      [uid, email]
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Sync user error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
