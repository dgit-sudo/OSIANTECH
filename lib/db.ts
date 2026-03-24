import { Pool } from 'pg';

let pool: Pool | null = null;

export function getPool(): Pool {
  if (!pool) {
    const dbUrl = process.env.SUPABASE_DB_URL || process.env.DATABASE_URL;
    if (!dbUrl) {
      throw new Error('Database URL not configured');
    }
    
    pool = new Pool({
      connectionString: dbUrl,
      ssl: { rejectUnauthorized: false },
    });
  }
  return pool;
}

export async function query(text: string, params?: any[]) {
  const pool = getPool();
  return pool.query(text, params);
}
