import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ uid: string; courseId: string }> }
) {
  const { uid, courseId } = await context.params;

  try {
    const result = await query(
      `SELECT * FROM user_purchases WHERE uid = $1 AND course_id = $2`,
      [uid, courseId]
    );

    if (result.rows.length === 0) {
      return NextResponse.json({ purchased: false });
    }

    return NextResponse.json({ purchased: true, purchase: result.rows[0] });
  } catch (error) {
    console.error('Check purchase error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
