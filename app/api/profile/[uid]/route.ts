import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { verifyFirebaseToken, getAuthToken } from '@/lib/auth';

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ uid: string }> }
) {
  const { uid } = await context.params;

  try {
    const result = await query('SELECT * FROM user_profiles WHERE uid = $1', [uid]);
    if (result.rows.length === 0) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
    }
    return NextResponse.json(result.rows[0]);
  } catch (error) {
    console.error('Get profile error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PUT(
  request: NextRequest,
  context: { params: Promise<{ uid: string }> }
) {
  const { uid } = await context.params;
  const token = getAuthToken(request);

  try {
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = await verifyFirebaseToken(token);
    if (!user) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    if (user.uid !== uid && user.uid !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();
    const { name, age, nationality, phone_number, gender, city, education, email } = body;

    const updateResult = await query(
      `INSERT INTO user_profiles (uid, name, age, nationality, phone_number, gender, city, education, email, completed_profile, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, true, NOW(), NOW())
       ON CONFLICT (uid) DO UPDATE SET
         name = COALESCE($2, user_profiles.name),
         age = COALESCE($3, user_profiles.age),
         nationality = COALESCE($4, user_profiles.nationality),
         phone_number = COALESCE($5, user_profiles.phone_number),
         gender = COALESCE($6, user_profiles.gender),
         city = COALESCE($7, user_profiles.city),
         education = COALESCE($8, user_profiles.education),
         email = COALESCE($9, user_profiles.email),
         completed_profile = true,
         updated_at = NOW()
       RETURNING *`,
      [uid, name, age, nationality, phone_number, gender, city, education, email]
    );

    return NextResponse.json(updateResult.rows[0]);
  } catch (error) {
    console.error('Update profile error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
