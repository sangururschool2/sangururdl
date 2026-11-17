import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import {
  auth,
  googleProvider,
  signInWithPopup,
  signOut as fbSignOut,
  db,
} from '../services/firebase';
import {
  onAuthStateChanged,
  signInWithCustomToken,
  User as FirebaseUser,
} from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { Teacher, Learner, Cohort, UserRole } from '../types';

const LEARNER_SESSION_KEY = 'sdlr_learner_session';
const TEACHER_SESSION_KEY = 'sdlr_teacher_session';

interface StoredLearnerSession {
  token: string;
  expiresAt: number;
  learner: Learner;
}

interface StoredTeacherSession {
  token: string;
  expiresAt: number;
  teacher: Teacher;
}

interface AuthContextType {
  firebaseUser: FirebaseUser | null;
  role: UserRole | null;
  teacherProfile: Teacher | null;
  teacherToken: string | null;
  learnerProfile: Learner | null;
  learnerToken: string | null;
  activeCohort: Cohort | null;
  loading: boolean;
  loginWithGoogle: () => Promise<void>;
  loginAsTeacher: (username: string, password: string) => Promise<void>;
  loginAsLearner: (
    username: string,
    password: string
  ) => Promise<{ success: boolean; isFirstLogin: boolean; learner: Learner }>;
  changeLearnerPassword: (newPassword: string, currentPassword?: string) => Promise<void>;
  setActiveCohort: (cohort: Cohort | null) => void;
  logout: () => Promise<void>;
  refreshLearnerData: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

async function readApiJson(response: Response): Promise<any> {
  const raw = await response.text();
  if (!raw) return {};
  try {
    return JSON.parse(raw);
  } catch {
    const isHtml = raw.trim().startsWith('<');
    throw new Error(
      isHtml
        ? `Authentication endpoint returned an unexpected HTML response (HTTP ${response.status}). Ensure Netlify Functions / Express API routes are active.`
        : `Server returned invalid JSON response (HTTP ${response.status}).`
    );
  }
}

function readStoredLearnerSession(): StoredLearnerSession | null {
  try {
    const raw = localStorage.getItem(LEARNER_SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed && parsed.token && parsed.learner && parsed.expiresAt) {
      if (Date.now() > parsed.expiresAt) {
        localStorage.removeItem(LEARNER_SESSION_KEY);
        return null;
      }
      return parsed as StoredLearnerSession;
    }
    localStorage.removeItem(LEARNER_SESSION_KEY);
    return null;
  } catch {
    localStorage.removeItem(LEARNER_SESSION_KEY);
    return null;
  }
}

function readStoredTeacherSession(): StoredTeacherSession | null {
  try {
    const raw = localStorage.getItem(TEACHER_SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed && parsed.token && parsed.teacher && parsed.expiresAt) {
      if (Date.now() > parsed.expiresAt) {
        localStorage.removeItem(TEACHER_SESSION_KEY);
        return null;
      }
      return parsed as StoredTeacherSession;
    }
    localStorage.removeItem(TEACHER_SESSION_KEY);
    return null;
  } catch {
    localStorage.removeItem(TEACHER_SESSION_KEY);
    return null;
  }
}

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [role, setRole] = useState<UserRole | null>(null);
  const [teacherProfile, setTeacherProfile] = useState<Teacher | null>(null);
  const [teacherToken, setTeacherToken] = useState<string | null>(null);
  const [learnerProfile, setLearnerProfile] = useState<Learner | null>(null);
  const [learnerToken, setLearnerToken] = useState<string | null>(null);
  const [activeCohort, setActiveCohort] = useState<Cohort | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const googleSignInInFlightRef = useRef<boolean>(false);

  // Restore and live-validate learner session with server on mount
  useEffect(() => {
    let cancelled = false;

    async function validateSavedLearner() {
      const saved = readStoredLearnerSession();
      if (!saved) return;

      try {
        const res = await fetch('/api/auth/learner-session', {
          headers: { Authorization: `Bearer ${saved.token}` },
        });
        if (!res.ok) {
          localStorage.removeItem(LEARNER_SESSION_KEY);
          if (!cancelled) {
            setLearnerProfile(null);
            setLearnerToken(null);
            setRole((prev) => (prev === 'learner' ? null : prev));
          }
          return;
        }
        const data = await readApiJson(res);
        if (!cancelled && data.learner) {
          const updatedSession: StoredLearnerSession = {
            token: saved.token,
            expiresAt: saved.expiresAt,
            learner: data.learner,
          };
          localStorage.setItem(LEARNER_SESSION_KEY, JSON.stringify(updatedSession));
          setLearnerToken(saved.token);
          setLearnerProfile(data.learner);
          setRole('learner');
        }
      } catch {
        if (!cancelled) {
          setLearnerToken(saved.token);
          setLearnerProfile(saved.learner);
          setRole('learner');
        }
      }
    }

    validateSavedLearner();
    return () => {
      cancelled = true;
    };
  }, []);

  // Restore and live-validate saved teacher credential session with server on mount
  useEffect(() => {
    let cancelled = false;

    async function validateSavedTeacher() {
      const saved = readStoredTeacherSession();
      if (!saved) return;

      try {
        const res = await fetch('/api/auth/teacher-session', {
          headers: { Authorization: `Bearer ${saved.token}` },
        });
        if (!res.ok) {
          localStorage.removeItem(TEACHER_SESSION_KEY);
          if (!cancelled) {
            setTeacherToken(null);
            setTeacherProfile(null);
            setRole((prev) => (prev && prev !== 'learner' ? null : prev));
          }
          return;
        }
        const data = await readApiJson(res);
        if (!cancelled && data.teacher) {
          if (data.firebaseCustomToken && !auth.currentUser) {
            signInWithCustomToken(auth, data.firebaseCustomToken).catch(() => {});
          }
          const updatedSession: StoredTeacherSession = {
            token: saved.token,
            expiresAt: saved.expiresAt,
            teacher: data.teacher,
          };
          localStorage.setItem(TEACHER_SESSION_KEY, JSON.stringify(updatedSession));
          setTeacherToken(saved.token);
          setTeacherProfile(data.teacher);
          setRole(data.teacher.role || 'teacher');
        }
      } catch {
        if (!cancelled) {
          setTeacherToken(saved.token);
          setTeacherProfile(saved.teacher);
          setRole(saved.teacher.role || 'teacher');
        }
      }
    }

    validateSavedTeacher();
    return () => {
      cancelled = true;
    };
  }, []);

  // Monitor Firebase Auth state for Google Staff Sign-In (preserving custom-token staff/learner sessions)
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        const isGoogleProvider = user.providerData?.some((p) => p.providerId === 'google.com');

        // Custom-token sessions are managed explicitly by loginAsTeacher / loginAsLearner
        if (!isGoogleProvider) {
          setFirebaseUser(user);
          setLoading(false);
          return;
        }

        setFirebaseUser(user);
        localStorage.removeItem(LEARNER_SESSION_KEY);
        localStorage.removeItem(TEACHER_SESSION_KEY);
        setLearnerProfile(null);
        setLearnerToken(null);
        setTeacherToken(null);

        try {
          const teacherDocRef = doc(db, 'teachers', user.uid);
          const snap = await getDoc(teacherDocRef);

          const isBootstrapAdmin = user.email === 'sangururschool10@gmail.com';

          if (snap.exists()) {
            const data = snap.data() as Teacher;
            setTeacherProfile(data);
            setRole(data.role || 'teacher');
          } else {
            const newTeacher: Teacher = {
              uid: user.uid,
              email: user.email || 'teacher@sangururschool.edu.ke',
              fullName: user.displayName || (isBootstrapAdmin ? 'School Administrator' : 'Staff Teacher'),
              role: isBootstrapAdmin ? 'admin' : 'teacher',
              active: true,
              createdAt: new Date().toISOString(),
            };
            await setDoc(teacherDocRef, newTeacher);
            setTeacherProfile(newTeacher);
            setRole(newTeacher.role);
          }
        } catch (err) {
          console.error('Error fetching teacher profile:', err);
          setTeacherProfile({
            uid: user.uid,
            email: user.email || 'teacher@sangurur.ac.ke',
            fullName: user.displayName || 'Staff Teacher',
            role: user.email === 'sangururschool10@gmail.com' ? 'admin' : 'teacher',
            active: true,
            createdAt: new Date().toISOString(),
          });
          setRole(user.email === 'sangururschool10@gmail.com' ? 'admin' : 'teacher');
        }
      } else {
        setFirebaseUser(null);
        const savedLearner = readStoredLearnerSession();
        const savedTeacher = readStoredTeacherSession();
        if (!savedLearner && !savedTeacher) {
          setTeacherProfile(null);
          setTeacherToken(null);
          setRole(null);
        }
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // Teacher Google Auth Login
  const loginWithGoogle = async () => {
    if (googleSignInInFlightRef.current) {
      return;
    }
    googleSignInInFlightRef.current = true;
    try {
      await signInWithPopup(auth, googleProvider);
      localStorage.removeItem(LEARNER_SESSION_KEY);
      localStorage.removeItem(TEACHER_SESSION_KEY);
      setLearnerProfile(null);
      setLearnerToken(null);
      setTeacherToken(null);
    } catch (err: unknown) {
      const code =
        typeof err === 'object' && err !== null && 'code' in err
          ? String((err as { code?: unknown }).code || '')
          : '';

      if (code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request') {
        throw new Error(
          'Google Sign-In popup was closed before completing sign-in. Click "Sign In with Google Staff Account" again to continue.'
        );
      }
      if (code === 'auth/popup-blocked') {
        throw new Error(
          'Google Sign-In popup was blocked by your browser. Please allow popups for this site and try again.'
        );
      }
      if (code === 'auth/unauthorized-domain') {
        throw new Error(
          'This domain is not authorized for Google Sign-In in Firebase Authentication settings.'
        );
      }
      if (code === 'auth/network-request-failed') {
        throw new Error(
          'Network error while connecting to Google Sign-In. Please check your internet connection and try again.'
        );
      }

      const fallbackMessage =
        err instanceof Error && err.message
          ? err.message
          : 'Google Sign-In could not be completed. Please try again.';
      console.warn('Google Sign-In issue:', code || fallbackMessage);
      throw new Error(fallbackMessage);
    } finally {
      googleSignInInFlightRef.current = false;
    }
  };

  // Teacher Username & Password Login
  const loginAsTeacher = async (username: string, password: string) => {
    const response = await fetch('/api/auth/teacher-login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    });

    const data = await readApiJson(response);
    if (!response.ok) {
      throw new Error(data.error || `Failed to authenticate teacher account (HTTP ${response.status})`);
    }

    if (data.firebaseCustomToken) {
      try {
        await signInWithCustomToken(auth, data.firebaseCustomToken);
      } catch (customErr) {
        console.warn('Firebase custom token sign-in notice:', customErr);
      }
    }

    const sessionObj: StoredTeacherSession = {
      token: data.token,
      expiresAt: data.expiresAt || Date.now() + 12 * 60 * 60 * 1000,
      teacher: data.teacher,
    };

    localStorage.removeItem(LEARNER_SESSION_KEY);
    setLearnerProfile(null);
    setLearnerToken(null);
    setTeacherProfile(data.teacher);
    setTeacherToken(data.token);
    setRole(data.teacher.role || 'teacher');
    localStorage.setItem(TEACHER_SESSION_KEY, JSON.stringify(sessionObj));
  };

  // Learner Login
  const loginAsLearner = async (username: string, password: string) => {
    const response = await fetch('/api/auth/learner-login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    });

    const data = await readApiJson(response);
    if (!response.ok) {
      throw new Error(data.error || `Failed to authenticate learner account (HTTP ${response.status})`);
    }

    if (data.firebaseCustomToken) {
      try {
        await signInWithCustomToken(auth, data.firebaseCustomToken);
      } catch (customErr) {
        console.warn('Firebase custom token sign-in notice:', customErr);
      }
    }

    const sessionObj: StoredLearnerSession = {
      token: data.token,
      expiresAt: data.expiresAt || Date.now() + 12 * 60 * 60 * 1000,
      learner: data.learner,
    };

    localStorage.removeItem(TEACHER_SESSION_KEY);
    setTeacherProfile(null);
    setTeacherToken(null);
    setLearnerProfile(data.learner);
    setLearnerToken(data.token);
    setRole('learner');
    localStorage.setItem(LEARNER_SESSION_KEY, JSON.stringify(sessionObj));

    return {
      success: true,
      isFirstLogin: Boolean(data.learner.mustChangePassword || data.learner.isFirstLogin),
      learner: data.learner,
    };
  };

  // Change Learner Password
  const changeLearnerPassword = async (newPassword: string, currentPassword?: string) => {
    if (!learnerProfile || !learnerToken) {
      throw new Error('Active learner session not found. Please sign in again.');
    }

    const res = await fetch('/api/auth/learner-change-password', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${learnerToken}`,
      },
      body: JSON.stringify({
        learnerId: learnerProfile.id,
        currentPassword,
        newPassword,
      }),
    });

    const data = await readApiJson(res);
    if (!res.ok) {
      throw new Error(data.error || 'Could not change password');
    }

    const updated: Learner = {
      ...learnerProfile,
      mustChangePassword: false,
      isFirstLogin: false,
    };
    setLearnerProfile(updated);

    const nextToken = data.token || learnerToken;
    const nextExpiresAt = data.expiresAt || readStoredLearnerSession()?.expiresAt || Date.now() + 12 * 60 * 60 * 1000;
    if (data.token) {
      setLearnerToken(data.token);
    }

    localStorage.setItem(
      LEARNER_SESSION_KEY,
      JSON.stringify({ token: nextToken, expiresAt: nextExpiresAt, learner: updated })
    );
  };

  const refreshLearnerData = async () => {
    if (!learnerToken) return;
    try {
      const res = await fetch('/api/auth/learner-session', {
        headers: { Authorization: `Bearer ${learnerToken}` },
      });
      if (!res.ok) {
        await logout();
        return;
      }
      const data = await readApiJson(res);
      if (data.learner) {
        setLearnerProfile(data.learner);
        const saved = readStoredLearnerSession();
        if (saved) {
          localStorage.setItem(
            LEARNER_SESSION_KEY,
            JSON.stringify({ ...saved, learner: data.learner })
          );
        }
      }
    } catch (e) {
      console.error('Error refreshing learner data:', e);
    }
  };

  // Logout (invalidates server session token + clears local state + Firebase Auth)
  const logout = async () => {
    const activeToken = teacherToken || learnerToken;
    localStorage.removeItem(LEARNER_SESSION_KEY);
    localStorage.removeItem(TEACHER_SESSION_KEY);
    setLearnerProfile(null);
    setLearnerToken(null);
    setTeacherProfile(null);
    setTeacherToken(null);
    setActiveCohort(null);
    setRole(null);
    try {
      if (activeToken) {
        await fetch('/api/auth/logout', {
          method: 'POST',
          headers: { Authorization: `Bearer ${activeToken}` },
        }).catch(() => {});
      }
      if (auth.currentUser) {
        await fbSignOut(auth);
      }
    } catch (e) {
      console.warn('Signout warning:', e);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        firebaseUser,
        role,
        teacherProfile,
        teacherToken,
        learnerProfile,
        learnerToken,
        activeCohort,
        loading,
        loginWithGoogle,
        loginAsTeacher,
        loginAsLearner,
        changeLearnerPassword,
        setActiveCohort,
        logout,
        refreshLearnerData,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
