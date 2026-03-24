import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

let coursesCache: any = null;

export async function GET() {
  try {
    if (!coursesCache) {
      const filePath = path.join(process.cwd(), 'public', 'coursesCatalog.json');
      const fileContent = fs.readFileSync(filePath, 'utf-8');
      coursesCache = JSON.parse(fileContent);
    }

    return NextResponse.json(coursesCache);
  } catch (error) {
    console.error('Get courses error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
