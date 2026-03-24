import { NextRequest } from 'next/server';

export async function verifyFirebaseToken(token: string): Promise<any> {
  if (!token) {
    return null;
  }

  try {
    const response = await fetch(
      `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${process.env.FIREBASE_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idToken: token }),
      }
    );

    if (!response.ok) {
      return null;
    }

    const data = await response.json();
    if (data.users && data.users[0]) {
      const user = data.users[0];
      return {
        uid: user.localId,
        email: user.email,
        deleted: user.disabled,
      };
    }

    return null;
  } catch (err) {
    console.error('Token verification error:', err);
    return null;
  }
}

export function getAuthToken(request: NextRequest): string | null {
  const authHeader = request.headers.get('authorization');
  if (!authHeader) return null;
  
  const parts = authHeader.split(' ');
  if (parts.length !== 2 || parts[0] !== 'Bearer') return null;
  
  return parts[1];
}
