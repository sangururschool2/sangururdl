import { auth } from '../services/firebase';

export async function getTeacherAuthHeaders(
  teacherToken?: string | null
): Promise<Record<string, string>> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  if (teacherToken) {
    headers.Authorization = `Bearer ${teacherToken}`;
    return headers;
  }

  if (auth.currentUser) {
    const idToken = await auth.currentUser.getIdToken();
    headers.Authorization = `Bearer ${idToken}`;
    return headers;
  }

  throw new Error('Staff authentication required. Please sign in again.');
}
