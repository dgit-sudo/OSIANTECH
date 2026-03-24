import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { verifyFirebaseToken, getAuthToken } from '@/lib/auth';

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ uid: string }> }
) {
  const { uid } = await context.params;

  try {
    const result = await query(
      `SELECT * FROM user_purchases WHERE uid = $1 ORDER BY purchase_date DESC`,
      [uid]
    );
    return NextResponse.json({ purchases: result.rows });
  } catch (error) {
    console.error('Get purchases error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(
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
    if (!user || user.uid !== uid) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    if (user.deleted) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const { course_id, course_title } = await request.json();

    if (!course_id || !course_title) {
      return NextResponse.json({ error: 'Missing course_id or course_title' }, { status: 400 });
    }

    // Check if already purchased
    const existingResult = await query(
      `SELECT * FROM user_purchases WHERE uid = $1 AND course_id = $2`,
      [uid, course_id]
    );

    if (existingResult.rows.length > 0) {
      return NextResponse.json({ error: 'Course already purchased' }, { status: 409 });
    }

    // Insert purchase
    const result = await query(
      `INSERT INTO user_purchases (uid, course_id, course_title, purchase_date, created_at)
       VALUES ($1, $2, $3, NOW(), NOW())
       RETURNING *`,
      [uid, course_id, course_title]
    );

    return NextResponse.json(result.rows[0], { status: 201 });
  } catch (error) {
    console.error('Create purchase error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
