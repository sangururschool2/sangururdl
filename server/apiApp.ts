import express, { Request, Response, NextFunction, Express } from 'express';
import path from 'path';
import os from 'os';
import { fileURLToPath } from 'url';
import crypto from 'crypto';
import fs from 'fs';
import dotenv from 'dotenv';
import { initializeApp, getApps, FirebaseApp } from 'firebase/app';
import {
  getFirestore,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  collection,
  query,
  where,
  getDocs,
  runTransaction,
  Firestore,
} from 'firebase/firestore';
import {
  initializeApp as initializeAdminApp,
  getApps as getAdminApps,
  cert,
  App as AdminApp,
} from 'firebase-admin/app';
import {
  getFirestore as getAdminFirestore,
  Firestore as AdminFirestore,
} from 'firebase-admin/firestore';
import { getAuth as getAdminAuth, Auth as AdminAuth } from 'firebase-admin/auth';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

interface FirebaseWebConfig {
  projectId: string;
  appId: string;
  apiKey: string;
  authDomain: string;
  firestoreDatabaseId: string;
  storageBucket?: string;
  messagingSenderId?: string;
}

function loadFirebaseConfig(): FirebaseWebConfig {
  const candidates = [
    path.resolve(process.cwd(), 'firebase-applet-config.json'),
    path.resolve(__dirname, '..', 'firebase-applet-config.json'),
    path.resolve(__dirname, 'firebase-applet-config.json'),
  ];

  let fileConfig: Partial<FirebaseWebConfig> = {};
  for (const candidate of candidates) {
    try {
      if (fs.existsSync(candidate)) {
        fileConfig = JSON.parse(fs.readFileSync(candidate, 'utf-8'));
        break;
      }
    } catch {
      // Try next path candidate
    }
  }

  return {
    projectId:
      process.env.FIREBASE_PROJECT_ID ||
      process.env.VITE_FIREBASE_PROJECT_ID ||
      fileConfig.projectId ||
      '',
    appId:
      process.env.FIREBASE_APP_ID ||
      process.env.VITE_FIREBASE_APP_ID ||
      fileConfig.appId ||
      '',
    apiKey:
      process.env.FIREBASE_API_KEY ||
      process.env.VITE_FIREBASE_API_KEY ||
      fileConfig.apiKey ||
      '',
    authDomain:
      process.env.FIREBASE_AUTH_DOMAIN ||
      process.env.VITE_FIREBASE_AUTH_DOMAIN ||
      fileConfig.authDomain ||
      '',
    firestoreDatabaseId:
      process.env.FIREBASE_DATABASE_ID ||
      process.env.VITE_FIREBASE_DATABASE_ID ||
      fileConfig.firestoreDatabaseId ||
      '(default)',
    storageBucket:
      process.env.FIREBASE_STORAGE_BUCKET ||
      process.env.VITE_FIREBASE_STORAGE_BUCKET ||
      fileConfig.storageBucket ||
      '',
    messagingSenderId:
      process.env.FIREBASE_MESSAGING_SENDER_ID ||
      process.env.VITE_FIREBASE_MESSAGING_SENDER_ID ||
      fileConfig.messagingSenderId ||
      '',
  };
}

const firebaseConfig = loadFirebaseConfig();

// Session token signing secret (HMAC-SHA256)
// In Netlify production, set SESSION_SECRET (32+ chars) in Site Configuration -> Environment variables.
const IS_PRODUCTION = process.env.NODE_ENV === 'production' || process.env.NETLIFY === 'true';
const ENV_SESSION_SECRET = process.env.SESSION_SECRET?.trim() || '';
const SESSION_SECRET_CONFIGURED = ENV_SESSION_SECRET.length >= 16;

const SESSION_SECRET = (() => {
  if (SESSION_SECRET_CONFIGURED) {
    return ENV_SESSION_SECRET;
  }
  if (IS_PRODUCTION) {
    console.warn(
      'SDLR Security Alert: SESSION_SECRET env var is missing or under 16 characters in production. Configure SESSION_SECRET in Netlify Environment variables.'
    );
    return crypto.randomBytes(32).toString('hex');
  }
  // Local non-production fallback: persist a random secret in OS temp dir (never derived from public Firebase config)
  const devSecretFile = path.join(os.tmpdir(), '.sdlr_dev_session_secret');
  try {
    if (fs.existsSync(devSecretFile)) {
      const existing = fs.readFileSync(devSecretFile, 'utf-8').trim();
      if (existing.length >= 32) return existing;
    }
    const generated = crypto.randomBytes(32).toString('hex');
    fs.writeFileSync(devSecretFile, generated, { mode: 0o600 });
    return generated;
  } catch {
    return crypto.randomBytes(32).toString('hex');
  }
})();

const SESSION_TTL_MS = 12 * 60 * 60 * 1000; // 12 hours
const BOOTSTRAP_ADMIN_EMAIL = 'sangururschool10@gmail.com';
const DEFAULT_INITIAL_PASSWORD = '123456789';
const DEFAULT_TEACHER_UID = 'teacher_default_staff';
const DEFAULT_TEACHER_USERNAME = 'Teacher';

interface SessionPayload {
  sub: string;
  role: 'learner';
  digitalId: string;
  iat: number;
  exp: number;
}

interface TeacherSessionPayload {
  sub: string;
  role: 'teacher' | 'admin' | 'super_admin';
  username: string;
  iat: number;
  exp: number;
}

interface AuthenticatedLearnerRequest extends Request {
  authLearner?: any;
}

interface AuthenticatedTeacherRequest extends Request {
  authTeacher?: {
    uid: string;
    fullName: string;
    role: 'teacher' | 'admin' | 'super_admin';
    email?: string;
  };
}

// Unified Admin / Client Firestore Adapter
interface DocSnapshotLike {
  exists: boolean;
  id: string;
  data: () => Record<string, any> | undefined;
}

interface ServerDbAdapter {
  mode: 'admin' | 'client';
  getDoc: (colName: string, docId: string) => Promise<DocSnapshotLike>;
  setDoc: (colName: string, docId: string, data: Record<string, any>) => Promise<void>;
  updateDoc: (colName: string, docId: string, data: Record<string, any>) => Promise<void>;
  getCollectionDocs: (colName: string) => Promise<Array<{ id: string; data: () => Record<string, any> }>>;
  queryWhere: (
    colName: string,
    filters: Array<[string, '==' | 'array-contains', any]>
  ) => Promise<Array<{ id: string; data: () => Record<string, any> }>>;
  runTransaction: <T>(
    fn: (tx: {
      get: (colName: string, docId: string) => Promise<DocSnapshotLike>;
      set: (colName: string, docId: string, data: Record<string, any>) => void;
    }) => Promise<T>
  ) => Promise<T>;
}

let cachedAdminApp: AdminApp | null = null;
let cachedAdminDb: AdminFirestore | null = null;
let cachedAdminAuth: AdminAuth | null = null;
let cachedClientDb: Firestore | null = null;

function initAdminServices(): { adminDb: AdminFirestore; adminAuth: AdminAuth } | null {
  if (cachedAdminDb && cachedAdminAuth) {
    return { adminDb: cachedAdminDb, adminAuth: cachedAdminAuth };
  }

  const rawJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON?.trim();
  if (!rawJson) return null;

  try {
    const parsed = JSON.parse(rawJson);
    if (typeof parsed.private_key === 'string') {
      parsed.private_key = parsed.private_key.replace(/\\n/g, '\n');
    }

    const existing = getAdminApps().find((a) => a.name === 'SDLR_ADMIN_APP');
    cachedAdminApp =
      existing ||
      initializeAdminApp(
        {
          credential: cert(parsed),
          projectId: firebaseConfig.projectId || parsed.project_id,
          storageBucket: firebaseConfig.storageBucket,
        },
        'SDLR_ADMIN_APP'
      );

    cachedAdminDb = getAdminFirestore(cachedAdminApp, firebaseConfig.firestoreDatabaseId);
    cachedAdminAuth = getAdminAuth(cachedAdminApp);
    return { adminDb: cachedAdminDb, adminAuth: cachedAdminAuth };
  } catch (err) {
    console.error('Could not initialize Firebase Admin SDK from FIREBASE_SERVICE_ACCOUNT_JSON:', err);
    return null;
  }
}

function getClientDb(): Firestore | null {
  if (cachedClientDb) return cachedClientDb;
  if (!firebaseConfig.projectId || !firebaseConfig.apiKey) {
    console.warn('Could not initialize server Firestore: missing Firebase configuration');
    return null;
  }
  try {
    const existingApp = getApps().find((a: FirebaseApp) => a.name === 'SERVER_APP') || getApps()[0];
    const fbApp = existingApp || initializeApp(firebaseConfig, 'SERVER_APP');
    cachedClientDb = getFirestore(fbApp, firebaseConfig.firestoreDatabaseId);
    return cachedClientDb;
  } catch (e) {
    console.warn('Could not initialize server Firestore from config:', e);
    return null;
  }
}

function getServerDbAdapter(): { db: ServerDbAdapter | null; adminAuth: AdminAuth | null } {
  const adminServices = initAdminServices();
  if (adminServices) {
    const { adminDb, adminAuth } = adminServices;
    const adapter: ServerDbAdapter = {
      mode: 'admin',
      async getDoc(colName, docId) {
        const snap = await adminDb.collection(colName).doc(docId).get();
        return {
          exists: snap.exists,
          id: snap.id,
          data: () => snap.data(),
        };
      },
      async setDoc(colName, docId, data) {
        await adminDb.collection(colName).doc(docId).set(data);
      },
      async updateDoc(colName, docId, data) {
        await adminDb.collection(colName).doc(docId).update(data);
      },
      async getCollectionDocs(colName) {
        const snap = await adminDb.collection(colName).get();
        return snap.docs.map((d) => ({ id: d.id, data: () => d.data() }));
      },
      async queryWhere(colName, filters) {
        let q: FirebaseFirestore.Query = adminDb.collection(colName);
        for (const [field, op, val] of filters) {
          q = q.where(field, op, val);
        }
        const snap = await q.get();
        return snap.docs.map((d) => ({ id: d.id, data: () => d.data() }));
      },
      async runTransaction(fn) {
        return adminDb.runTransaction(async (tx) => {
          const wrappedTx = {
            async get(colName: string, docId: string): Promise<DocSnapshotLike> {
              const snap = await tx.get(adminDb.collection(colName).doc(docId));
              return { exists: snap.exists, id: snap.id, data: () => snap.data() };
            },
            set(colName: string, docId: string, data: Record<string, any>) {
              tx.set(adminDb.collection(colName).doc(docId), data);
            },
          };
          return fn(wrappedTx);
        });
      },
    };
    return { db: adapter, adminAuth };
  }

  const clientDb = getClientDb();
  if (!clientDb) return { db: null, adminAuth: null };

  const adapter: ServerDbAdapter = {
    mode: 'client',
    async getDoc(colName, docId) {
      const snap = await getDoc(doc(clientDb, colName, docId));
      return {
        exists: snap.exists(),
        id: snap.id,
        data: () => snap.data(),
      };
    },
    async setDoc(colName, docId, data) {
      await setDoc(doc(clientDb, colName, docId), data);
    },
    async updateDoc(colName, docId, data) {
      await updateDoc(doc(clientDb, colName, docId), data);
    },
    async getCollectionDocs(colName) {
      const snap = await getDocs(collection(clientDb, colName));
      return snap.docs.map((d) => ({ id: d.id, data: () => d.data() }));
    },
    async queryWhere(colName, filters) {
      let q: any = collection(clientDb, colName);
      for (const [field, op, val] of filters) {
        q = query(q, where(field, op, val));
      }
      const snap = await getDocs(q);
      return snap.docs.map((d: any) => ({ id: d.id, data: () => d.data() }));
    },
    async runTransaction(fn) {
      return runTransaction(clientDb, async (tx) => {
        const wrappedTx = {
          async get(colName: string, docId: string): Promise<DocSnapshotLike> {
            const snap = await tx.get(doc(clientDb, colName, docId));
            return { exists: snap.exists(), id: snap.id, data: () => snap.data() };
          },
          set(colName: string, docId: string, data: Record<string, any>) {
            tx.set(doc(clientDb, colName, docId), data);
          },
        };
        return fn(wrappedTx);
      });
    },
  };
  return { db: adapter, adminAuth: null };
}

function formatServerFirestoreError(err: any, db: ServerDbAdapter | null, fallbackMsg: string): { status: number; message: string } {
  const msg = String(err?.message || err || '');
  const code = String(err?.code || '');
  if (
    code === 'permission-denied' ||
    msg.includes('PERMISSION_DENIED') ||
    msg.includes('Missing or insufficient permissions')
  ) {
    if (db?.mode !== 'admin') {
      return {
        status: 503,
        message:
          'Server Firestore access was denied by security rules. Configure FIREBASE_SERVICE_ACCOUNT_JSON in Netlify Environment Variables (or sign in with Google Staff Account).',
      };
    }
    return {
      status: 403,
      message: 'Firestore security rules denied this server operation.',
    };
  }
  return {
    status: 500,
    message: msg || fallbackMsg,
  };
}

function createSessionToken(learnerDocId: string, digitalId: string): { token: string; expiresAt: number } {
  const now = Date.now();
  const expiresAt = now + SESSION_TTL_MS;
  const payload: SessionPayload = {
    sub: learnerDocId,
    role: 'learner',
    digitalId,
    iat: now,
    exp: expiresAt,
  };
  const encoded = Buffer.from(JSON.stringify(payload), 'utf-8').toString('base64url');
  const sig = crypto.createHmac('sha256', SESSION_SECRET).update(encoded).digest('base64url');
  return { token: `${encoded}.${sig}`, expiresAt };
}

function verifySessionToken(token: string): SessionPayload | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 2) return null;
    const [encoded, sig] = parts;
    const expectedSig = crypto.createHmac('sha256', SESSION_SECRET).update(encoded).digest('base64url');
    const sigBuf = Buffer.from(sig);
    const expectedBuf = Buffer.from(expectedSig);
    if (sigBuf.length !== expectedBuf.length || !crypto.timingSafeEqual(sigBuf, expectedBuf)) {
      return null;
    }
    const payload = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf-8')) as SessionPayload;
    if (!payload.sub || payload.role !== 'learner' || !payload.exp || Date.now() > payload.exp) {
      return null;
    }
    return payload;
  } catch {
    return null;
  }
}

function createTeacherSessionToken(
  teacherUid: string,
  username: string,
  role: 'teacher' | 'admin' | 'super_admin'
): { token: string; expiresAt: number } {
  const now = Date.now();
  const expiresAt = now + SESSION_TTL_MS;
  const payload: TeacherSessionPayload = {
    sub: teacherUid,
    role,
    username,
    iat: now,
    exp: expiresAt,
  };
  const encoded = Buffer.from(JSON.stringify(payload), 'utf-8').toString('base64url');
  const sig = crypto.createHmac('sha256', SESSION_SECRET).update(encoded).digest('base64url');
  return { token: `${encoded}.${sig}`, expiresAt };
}

function verifyTeacherSessionToken(token: string): TeacherSessionPayload | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 2) return null;
    const [encoded, sig] = parts;
    const expectedSig = crypto.createHmac('sha256', SESSION_SECRET).update(encoded).digest('base64url');
    const sigBuf = Buffer.from(sig);
    const expectedBuf = Buffer.from(expectedSig);
    if (sigBuf.length !== expectedBuf.length || !crypto.timingSafeEqual(sigBuf, expectedBuf)) {
      return null;
    }
    const payload = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf-8')) as TeacherSessionPayload;
    if (
      !payload.sub ||
      !['teacher', 'admin', 'super_admin'].includes(payload.role) ||
      !payload.exp ||
      Date.now() > payload.exp
    ) {
      return null;
    }
    return payload;
  } catch {
    return null;
  }
}

// Verify Firebase Auth ID tokens server-side (via Admin SDK if available, else Identity Toolkit)
async function verifyFirebaseIdToken(
  idToken: string,
  adminAuth: AdminAuth | null
): Promise<{ uid: string; email: string; emailVerified: boolean; displayName?: string } | null> {
  if (!idToken) return null;
  if (adminAuth) {
    try {
      const decoded = await adminAuth.verifyIdToken(idToken);
      return {
        uid: decoded.uid,
        email: decoded.email || '',
        emailVerified: Boolean(decoded.email_verified || decoded.firebase?.sign_in_provider === 'custom'),
        displayName: decoded.name,
      };
    } catch {
      return null;
    }
  }

  if (!firebaseConfig.apiKey) return null;
  try {
    const response = await fetch(
      `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${encodeURIComponent(firebaseConfig.apiKey)}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idToken }),
      }
    );
    if (!response.ok) return null;
    const data = (await response.json()) as {
      users?: Array<{
        localId?: string;
        email?: string;
        emailVerified?: boolean;
        displayName?: string;
        disabled?: boolean;
      }>;
    };
    const user = data.users?.[0];
    if (!user || !user.localId || user.disabled) return null;
    return {
      uid: user.localId,
      email: user.email || '',
      emailVerified: Boolean(user.emailVerified),
      displayName: user.displayName,
    };
  } catch {
    return null;
  }
}

function generateSalt(): string {
  return crypto.randomBytes(16).toString('hex');
}

function hashPassword(password: string, salt: string): string {
  return crypto.pbkdf2Sync(password, salt, 1000, 64, 'sha512').toString('hex');
}

function getNairobiDateString(): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Africa/Nairobi',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date());

  const year = parts.find((p) => p.type === 'year')?.value;
  const month = parts.find((p) => p.type === 'month')?.value;
  const day = parts.find((p) => p.type === 'day')?.value;
  return `${year}-${month}-${day}`;
}

let defaultTeacherEnsured = false;
let defaultTeacherBootstrapPromise: Promise<void> | null = null;

async function ensureDefaultTeacherAccount(db: ServerDbAdapter | null): Promise<void> {
  if (!db || defaultTeacherEnsured) return;
  if (defaultTeacherBootstrapPromise) return defaultTeacherBootstrapPromise;

  const initialTeacherPassword = process.env.DEFAULT_TEACHER_PASSWORD || 'Sangurur@2026';

  defaultTeacherBootstrapPromise = (async () => {
    try {
      const now = new Date().toISOString();
      const teacherSnap = await db.getDoc('teachers', DEFAULT_TEACHER_UID);
      if (!teacherSnap.exists) {
        await db.setDoc('teachers', DEFAULT_TEACHER_UID, {
          uid: DEFAULT_TEACHER_UID,
          username: DEFAULT_TEACHER_USERNAME,
          email: 'teacher@sangururschool.edu.ke',
          fullName: 'Sangurur Staff Teacher',
          role: 'teacher',
          active: true,
          createdAt: now,
          updatedAt: now,
        });
      }

      const credSnap = await db.getDoc('teacherCredentials', DEFAULT_TEACHER_UID);
      if (!credSnap.exists) {
        const salt = generateSalt();
        const passwordHash = hashPassword(initialTeacherPassword, salt);
        await db.setDoc('teacherCredentials', DEFAULT_TEACHER_UID, {
          id: DEFAULT_TEACHER_UID,
          username: DEFAULT_TEACHER_USERNAME,
          teacherUid: DEFAULT_TEACHER_UID,
          passwordHash,
          salt,
          active: true,
          createdAt: now,
          updatedAt: now,
        });
      }
      defaultTeacherEnsured = true;
    } catch (err) {
      console.warn('Default teacher bootstrap notice:', err);
    } finally {
      defaultTeacherBootstrapPromise = null;
    }
  })();

  return defaultTeacherBootstrapPromise;
}

async function allocateDigitalIds(db: ServerDbAdapter | null, count: number): Promise<string[]> {
  if (!db) {
    return Array.from({ length: count }, (_, idx) => `SG-LRN-2026-${String(idx + 1).padStart(3, '0')}`);
  }

  let bootstrapMax = 0;
  const preSnap = await db.getDoc('counters', 'learner_digital_id_2026');
  if (!preSnap.exists) {
    const learnersDocs = await db.getCollectionDocs('learners');
    learnersDocs.forEach((d) => {
      const data = d.data();
      const idStr = String(data.digitalId || data.learnerId || data.username || '');
      const match = idStr.match(/^SG-LRN-2026-(\d+)$/i) || idStr.match(/(\d+)$/);
      if (match) {
        const num = parseInt(match[1], 10);
        if (!isNaN(num) && num > bootstrapMax) {
          bootstrapMax = num;
        }
      }
    });
  }

  const startSeq = await db.runTransaction(async (tx) => {
    const counterDoc = await tx.get('counters', 'learner_digital_id_2026');
    const existingData = counterDoc.data();
    const currentSeq = counterDoc.exists
      ? Math.max(Number(existingData?.lastSeq) || 0, bootstrapMax)
      : bootstrapMax;
    const nextLast = currentSeq + count;
    tx.set('counters', 'learner_digital_id_2026', {
      lastSeq: nextLast,
      updatedAt: new Date().toISOString(),
    });
    return currentSeq + 1;
  });

  return Array.from({ length: count }, (_, i) => `SG-LRN-2026-${String(startSeq + i).padStart(3, '0')}`);
}

async function writeAuditLog(
  db: ServerDbAdapter | null,
  entry: {
    actorId: string;
    actorName: string;
    actorRole: string;
    action: string;
    targetEntity: string;
    targetId: string;
    details: string;
  }
) {
  if (!db) return;
  try {
    const logId = `log_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`;
    await db.setDoc('auditLogs', logId, {
      id: logId,
      ...entry,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    console.warn('Audit log write notice:', err);
  }
}

export function createApiApp(): Express {
  const app = express();
  const { db, adminAuth } = getServerDbAdapter();

  app.set('trust proxy', 1);
  app.use(express.json({ limit: '4mb' }));

  // Normalize incoming Netlify Functions path (/.netlify/functions/api/...) -> /api/...
  app.use((req: Request, _res: Response, next: NextFunction) => {
    if (req.url.startsWith('/.netlify/functions/api')) {
      const suffix = req.url.slice('/.netlify/functions/api'.length);
      req.url = suffix ? `/api${suffix.startsWith('/') ? suffix : `/${suffix}`}` : '/api';
    }
    next();
  });

  async function requireLearnerAuth(req: AuthenticatedLearnerRequest, res: Response, next: NextFunction) {
    try {
      const authHeader = req.headers.authorization || '';
      const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
      if (!token) {
        return res.status(401).json({ error: 'Authentication required. Please sign in again.' });
      }
      const payload = verifySessionToken(token);
      if (!payload) {
        return res.status(401).json({ error: 'Session expired or invalid. Please sign in again.' });
      }
      if (!db) {
        return res.status(503).json({ error: 'Database service unavailable' });
      }
      const snap = await db.getDoc('learners', payload.sub);
      if (!snap.exists) {
        return res.status(401).json({ error: 'Learner account no longer exists.' });
      }
      const data = snap.data() || {};
      if (data.status === 'INACTIVE' || data.active === false) {
        return res.status(403).json({ error: 'Learner account is inactive. Please contact your school administrator.' });
      }
      if (data.sessionRevokedAt && payload.iat < Number(data.sessionRevokedAt)) {
        return res.status(401).json({ error: 'Session has been logged out or reset. Please sign in again.' });
      }
      req.authLearner = {
        id: snap.id,
        digitalId: data.digitalId || data.learnerId,
        learnerId: data.digitalId || data.learnerId,
        fullName: data.fullName,
        username: data.username || data.digitalId || data.learnerId,
        assignedCohortIds: data.assignedCohortIds || [],
        mustChangePassword: data.mustChangePassword ?? data.isFirstLogin ?? true,
        isFirstLogin: data.mustChangePassword ?? data.isFirstLogin ?? true,
        status: data.status || 'ACTIVE',
        gender: data.gender,
        age: data.age,
        passwordHash: data.passwordHash,
        salt: data.salt,
      };
      next();
    } catch (err: any) {
      const formatted = formatServerFirestoreError(err, db, 'Session validation error');
      return res.status(formatted.status).json({ error: formatted.message });
    }
  }

  async function requireTeacherAuth(req: AuthenticatedTeacherRequest, res: Response, next: NextFunction) {
    try {
      const authHeader = req.headers.authorization || '';
      const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
      if (!token) {
        return res.status(401).json({ error: 'Staff authentication required. Please sign in again.' });
      }
      if (!db) {
        return res.status(503).json({ error: 'Database service unavailable' });
      }

      const staffPayload = verifyTeacherSessionToken(token);
      if (staffPayload) {
        const teacherSnap = await db.getDoc('teachers', staffPayload.sub);
        if (!teacherSnap.exists) {
          return res.status(401).json({ error: 'Teacher account no longer exists.' });
        }
        const teacherData = teacherSnap.data() || {};
        if (teacherData.active === false) {
          return res.status(403).json({ error: 'Teacher account is inactive.' });
        }
        if (teacherData.sessionRevokedAt && staffPayload.iat < Number(teacherData.sessionRevokedAt)) {
          return res.status(401).json({ error: 'Teacher session has been signed out. Please sign in again.' });
        }
        req.authTeacher = {
          uid: teacherSnap.id,
          fullName: teacherData.fullName || 'Sangurur Staff Teacher',
          role: teacherData.role || 'teacher',
          email: teacherData.email,
        };
        return next();
      }

      const fbUser = await verifyFirebaseIdToken(token, adminAuth);
      if (!fbUser || !fbUser.emailVerified) {
        return res.status(401).json({ error: 'Staff session expired or invalid. Please sign in again.' });
      }

      const teacherSnap = await db.getDoc('teachers', fbUser.uid);
      const isBootstrapAdmin = fbUser.email === BOOTSTRAP_ADMIN_EMAIL;

      if (!teacherSnap.exists && !isBootstrapAdmin) {
        return res.status(403).json({ error: 'Access denied: staff teacher profile not authorized.' });
      }

      const teacherData = teacherSnap.exists ? teacherSnap.data() || null : null;
      if (teacherData && teacherData.active === false) {
        return res.status(403).json({ error: 'Teacher account is inactive. Please contact your school administrator.' });
      }

      req.authTeacher = {
        uid: fbUser.uid,
        fullName: teacherData?.fullName || fbUser.displayName || 'Staff Teacher',
        role: teacherData?.role || (isBootstrapAdmin ? 'admin' : 'teacher'),
        email: fbUser.email,
      };
      return next();
    } catch (err: any) {
      const formatted = formatServerFirestoreError(err, db, 'Staff authorization error');
      return res.status(formatted.status).json({ error: formatted.message });
    }
  }

  // Health Check
  app.get('/api/health', (_req: Request, res: Response) => {
    res.json({
      status: 'ok',
      app: 'Sangurur Digital Learner Register (SDLR)',
      school: 'Sangurur Comprehensive School',
      motto: 'THINK, CODE, CHANGE THE WORLD',
      timezone: 'Africa/Nairobi',
      serverTimeEAT: new Date().toLocaleString('en-KE', { timeZone: 'Africa/Nairobi' }),
      projectId: firebaseConfig.projectId || null,
      firestoreDatabaseId: firebaseConfig.firestoreDatabaseId || null,
      storageBucket: firebaseConfig.storageBucket || null,
      firestoreConfigured: Boolean(db),
      adminSdkActive: Boolean(adminAuth),
      sessionSecretConfigured: SESSION_SECRET_CONFIGURED,
    });
  });

  // Explicit Stateless Session Revocation on Logout
  app.post('/api/auth/logout', async (req: Request, res: Response) => {
    try {
      const authHeader = req.headers.authorization || '';
      const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
      if (!token || !db) {
        return res.json({ success: true });
      }
      const revokedAt = Date.now();
      const teacherPayload = verifyTeacherSessionToken(token);
      if (teacherPayload) {
        await db.updateDoc('teachers', teacherPayload.sub, { sessionRevokedAt: revokedAt }).catch(() => {});
        return res.json({ success: true });
      }
      const learnerPayload = verifySessionToken(token);
      if (learnerPayload) {
        await db.updateDoc('learners', learnerPayload.sub, { sessionRevokedAt: revokedAt }).catch(() => {});
        return res.json({ success: true });
      }
      return res.json({ success: true });
    } catch {
      return res.json({ success: true });
    }
  });

  // Teacher Authentication: Username + Password Login
  app.post('/api/auth/teacher-login', async (req: Request, res: Response) => {
    try {
      if (IS_PRODUCTION && !SESSION_SECRET_CONFIGURED) {
        return res.status(503).json({
          error: 'Server SESSION_SECRET is not configured. Set a 32+ character SESSION_SECRET in Netlify Environment Variables.',
        });
      }
      const username = req.body.username;
      const password = req.body.password;
      if (!username || !password) {
        return res.status(400).json({ error: 'Username and password are required.' });
      }

      if (!db) {
        return res.status(503).json({ error: 'Database service unavailable' });
      }

      await ensureDefaultTeacherAccount(db);

      const cleanUsername = String(username).trim();
      const credDocId =
        cleanUsername.toLowerCase() === DEFAULT_TEACHER_USERNAME.toLowerCase()
          ? DEFAULT_TEACHER_UID
          : `teacher_${cleanUsername.toLowerCase().replace(/[^a-z0-9_-]/g, '_')}`;

      const credSnap = await db.getDoc('teacherCredentials', credDocId);
      if (!credSnap.exists) {
        return res.status(401).json({ error: 'Invalid teacher username or password.' });
      }

      const credData = credSnap.data() || {};
      if (credData.active === false) {
        return res.status(403).json({ error: 'Teacher account is inactive. Please contact the school administrator.' });
      }

      const expectedUsername = String(credData.username || DEFAULT_TEACHER_USERNAME);
      if (cleanUsername.toLowerCase() !== expectedUsername.toLowerCase()) {
        return res.status(401).json({ error: 'Invalid teacher username or password.' });
      }

      const computedHash = hashPassword(String(password), String(credData.salt || ''));
      const computedBuf = Buffer.from(computedHash, 'utf8');
      const storedBuf = Buffer.from(String(credData.passwordHash || ''), 'utf8');
      const isPasswordValid =
        computedBuf.length > 0 &&
        computedBuf.length === storedBuf.length &&
        crypto.timingSafeEqual(computedBuf, storedBuf);

      if (!isPasswordValid) {
        return res.status(401).json({ error: 'Invalid teacher username or password.' });
      }

      const teacherUid = String(credData.teacherUid || DEFAULT_TEACHER_UID);
      const teacherSnap = await db.getDoc('teachers', teacherUid);
      const teacherData = teacherSnap.exists ? teacherSnap.data() || null : null;

      if (teacherData && teacherData.active === false) {
        return res.status(403).json({ error: 'Teacher profile is inactive. Please contact the school administrator.' });
      }

      const teacherRole: 'teacher' | 'admin' | 'super_admin' =
        teacherData?.role === 'admin' || teacherData?.role === 'super_admin'
          ? teacherData.role
          : 'teacher';

      const teacherProfile = {
        uid: teacherUid,
        username: expectedUsername,
        email: teacherData?.email || 'teacher@sangururschool.edu.ke',
        fullName: teacherData?.fullName || 'Sangurur Staff Teacher',
        role: teacherRole,
        phone: teacherData?.phone,
        active: teacherData?.active ?? true,
        createdAt: teacherData?.createdAt || new Date().toISOString(),
        updatedAt: teacherData?.updatedAt,
      };

      const { token, expiresAt } = createTeacherSessionToken(teacherUid, expectedUsername, teacherRole);

      let firebaseCustomToken: string | undefined;
      if (adminAuth) {
        try {
          firebaseCustomToken = await adminAuth.createCustomToken(teacherUid, {
            role: teacherRole,
            username: expectedUsername,
            email_verified: true,
          });
        } catch (tokenErr) {
          console.warn('Could not mint Firebase custom token for staff teacher:', tokenErr);
        }
      }

      await writeAuditLog(db, {
        actorId: teacherProfile.uid,
        actorName: teacherProfile.fullName,
        actorRole: teacherRole,
        action: 'TEACHER_LOGIN',
        targetEntity: 'teacher',
        targetId: teacherProfile.uid,
        details: `Staff teacher authenticated with username '${expectedUsername}'.`,
      });

      return res.json({
        success: true,
        teacher: teacherProfile,
        token,
        firebaseCustomToken,
        expiresAt,
      });
    } catch (err: any) {
      console.error('Teacher login error:', err);
      const formatted = formatServerFirestoreError(err, db, 'Internal teacher login error');
      return res.status(formatted.status).json({ error: formatted.message });
    }
  });

  // Validate and refresh active teacher credential session against Firestore
  app.get('/api/auth/teacher-session', async (req: Request, res: Response) => {
    try {
      const authHeader = req.headers.authorization || '';
      const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
      if (!token) {
        return res.status(401).json({ error: 'Teacher authentication required.' });
      }

      const payload = verifyTeacherSessionToken(token);
      if (!payload) {
        return res.status(401).json({ error: 'Teacher session expired or invalid. Please sign in again.' });
      }

      if (!db) {
        return res.status(503).json({ error: 'Database service unavailable' });
      }

      const teacherSnap = await db.getDoc('teachers', payload.sub);
      if (!teacherSnap.exists) {
        return res.status(401).json({ error: 'Teacher account no longer exists.' });
      }

      const teacherData = teacherSnap.data() || {};
      if (teacherData.active === false) {
        return res.status(403).json({ error: 'Teacher account is inactive.' });
      }
      if (teacherData.sessionRevokedAt && payload.iat < Number(teacherData.sessionRevokedAt)) {
        return res.status(401).json({ error: 'Teacher session has been signed out. Please sign in again.' });
      }

      let firebaseCustomToken: string | undefined;
      if (adminAuth) {
        try {
          firebaseCustomToken = await adminAuth.createCustomToken(teacherSnap.id, {
            role: teacherData.role || 'teacher',
            username: teacherData.username || payload.username,
            email_verified: true,
          });
        } catch {
          // ignore
        }
      }

      return res.json({
        success: true,
        firebaseCustomToken,
        teacher: {
          uid: teacherSnap.id,
          username: teacherData.username || payload.username,
          email: teacherData.email || 'teacher@sangururschool.edu.ke',
          fullName: teacherData.fullName || 'Sangurur Staff Teacher',
          role: teacherData.role || 'teacher',
          phone: teacherData.phone,
          active: teacherData.active ?? true,
          createdAt: teacherData.createdAt || new Date().toISOString(),
          updatedAt: teacherData.updatedAt,
        },
      });
    } catch (err: any) {
      const formatted = formatServerFirestoreError(err, db, 'Teacher session validation error');
      return res.status(formatted.status).json({ error: formatted.message });
    }
  });

  // Learner Authentication: Digital ID (Username) + Password Login
  app.post('/api/auth/learner-login', async (req: Request, res: Response) => {
    try {
      if (IS_PRODUCTION && !SESSION_SECRET_CONFIGURED) {
        return res.status(503).json({
          error: 'Server SESSION_SECRET is not configured. Set a 32+ character SESSION_SECRET in Netlify Environment Variables.',
        });
      }
      const username = req.body.username || req.body.digitalId;
      const password = req.body.password;
      if (!username || !password) {
        return res.status(400).json({ error: 'Digital ID / Username and password are required' });
      }

      if (!db) {
        return res.status(503).json({ error: 'Database service unavailable' });
      }

      const cleanUsername = String(username).trim();
      const cleanUpper = cleanUsername.toUpperCase();
      const cleanLower = cleanUsername.toLowerCase();

      let matches = await db.queryWhere('learners', [['username', '==', cleanUsername]]);
      if (matches.length === 0) {
        matches = await db.queryWhere('learners', [['username', '==', cleanUpper]]);
      }
      if (matches.length === 0) {
        matches = await db.queryWhere('learners', [['username', '==', cleanLower]]);
      }
      if (matches.length === 0) {
        matches = await db.queryWhere('learners', [['digitalId', '==', cleanUpper]]);
      }
      if (matches.length === 0) {
        matches = await db.queryWhere('learners', [['learnerId', '==', cleanUpper]]);
      }

      if (matches.length === 0) {
        return res.status(401).json({ error: 'Invalid Digital ID or password. Please verify with your teacher.' });
      }

      const learnerDoc = matches[0];
      const learnerData = learnerDoc.data() || {};

      if (learnerData.status === 'INACTIVE' || learnerData.active === false) {
        return res.status(403).json({ error: 'Learner account is inactive. Please contact your school administrator.' });
      }

      let isValid = false;
      if (learnerData.passwordHash && learnerData.salt) {
        const computedHash = hashPassword(String(password), learnerData.salt);
        const computedBuf = Buffer.from(computedHash, 'utf8');
        const storedBuf = Buffer.from(String(learnerData.passwordHash), 'utf8');
        isValid =
          computedBuf.length > 0 &&
          computedBuf.length === storedBuf.length &&
          crypto.timingSafeEqual(computedBuf, storedBuf);
      } else {
        isValid = String(password) === DEFAULT_INITIAL_PASSWORD;
      }

      if (!isValid) {
        return res.status(401).json({ error: 'Invalid Digital ID or password. Please check your access slip.' });
      }

      const mustChangePassword = learnerData.mustChangePassword ?? learnerData.isFirstLogin ?? true;
      const digitalId = learnerData.digitalId || learnerData.learnerId;

      const learnerProfile = {
        id: learnerDoc.id,
        digitalId,
        learnerId: digitalId,
        fullName: learnerData.fullName,
        username: learnerData.username || digitalId,
        assignedCohortIds: learnerData.assignedCohortIds || [],
        mustChangePassword,
        isFirstLogin: mustChangePassword,
        status: learnerData.status || 'ACTIVE',
        gender: learnerData.gender,
        age: learnerData.age,
        schoolName: learnerData.schoolName || 'Sangurur Comprehensive School',
        grade: learnerData.grade || null,
      };

      const { token, expiresAt } = createSessionToken(learnerDoc.id, digitalId);

      let firebaseCustomToken: string | undefined;
      if (adminAuth) {
        try {
          firebaseCustomToken = await adminAuth.createCustomToken(learnerDoc.id, {
            role: 'learner',
            digitalId,
            email_verified: true,
          });
        } catch (tokenErr) {
          console.warn('Could not mint Firebase custom token for learner:', tokenErr);
        }
      }

      return res.json({
        success: true,
        learner: learnerProfile,
        mustChangePassword,
        token,
        firebaseCustomToken,
        expiresAt,
      });
    } catch (err: any) {
      console.error('Login error:', err);
      const formatted = formatServerFirestoreError(err, db, 'Internal login error');
      return res.status(formatted.status).json({ error: formatted.message });
    }
  });

  // Validate and refresh active learner session against Firestore
  app.get('/api/auth/learner-session', requireLearnerAuth, (req: AuthenticatedLearnerRequest, res: Response) => {
    const { passwordHash, salt, ...safeProfile } = req.authLearner;
    return res.json({
      success: true,
      learner: safeProfile,
    });
  });

  // Learner Password Change (Mandatory on first login, or voluntary with currentPassword)
  app.post('/api/auth/learner-change-password', requireLearnerAuth, async (req: AuthenticatedLearnerRequest, res: Response) => {
    try {
      if (!db) {
        return res.status(503).json({ error: 'Database service unavailable' });
      }
      const authLearner = req.authLearner;
      const { learnerId, currentPassword, newPassword } = req.body;

      if (learnerId && learnerId !== authLearner.id) {
        return res.status(403).json({ error: 'Cannot change password for another learner account.' });
      }

      if (!newPassword || typeof newPassword !== 'string') {
        return res.status(400).json({ error: 'New password is required' });
      }

      if (newPassword === DEFAULT_INITIAL_PASSWORD) {
        return res.status(400).json({
          error: 'Your new password cannot be the default password (123456789). Please choose a private secure password.',
        });
      }

      if (newPassword.length < 6) {
        return res.status(400).json({ error: 'New password must be at least 6 characters long' });
      }

      if (!authLearner.mustChangePassword) {
        if (!currentPassword) {
          return res.status(400).json({ error: 'Current password is required to update your password.' });
        }
        const computedCurrent = authLearner.salt
          ? hashPassword(String(currentPassword), authLearner.salt)
          : null;
        if (!computedCurrent || computedCurrent !== authLearner.passwordHash) {
          return res.status(401).json({ error: 'Current password is incorrect.' });
        }
      }

      const newSalt = generateSalt();
      const newHash = hashPassword(newPassword, newSalt);
      const revokedBeforeNew = Date.now();

      await db.updateDoc('learners', authLearner.id, {
        passwordHash: newHash,
        salt: newSalt,
        mustChangePassword: false,
        isFirstLogin: false,
        status: 'ACTIVE',
        sessionRevokedAt: revokedBeforeNew,
        updatedAt: new Date().toISOString(),
      });

      const refreshedSession = createSessionToken(
        authLearner.id,
        authLearner.digitalId || authLearner.learnerId
      );

      await writeAuditLog(db, {
        actorId: authLearner.id,
        actorName: authLearner.fullName,
        actorRole: 'learner',
        action: 'LEARNER_PASSWORD_CHANGED',
        targetEntity: 'learner',
        targetId: authLearner.id,
        details: `Learner ${authLearner.fullName} (${authLearner.digitalId}) updated their password; default credentials invalidated.`,
      });

      return res.json({
        success: true,
        token: refreshedSession.token,
        expiresAt: refreshedSession.expiresAt,
        message: 'Password changed successfully. Default password is now invalidated.',
      });
    } catch (err: any) {
      console.error('Password change error:', err);
      const formatted = formatServerFirestoreError(err, db, 'Error updating password');
      return res.status(formatted.status).json({ error: formatted.message });
    }
  });

  // Scoped Learner Endpoints (Strictly enforces assigned cohorts)
  app.get('/api/learner/cohorts', requireLearnerAuth, async (req: AuthenticatedLearnerRequest, res: Response) => {
    try {
      if (!db) {
        return res.status(503).json({ error: 'Database service unavailable' });
      }
      const assignedIds: string[] = req.authLearner.assignedCohortIds || [];
      if (assignedIds.length === 0) {
        return res.json({ success: true, cohorts: [] });
      }
      const docs = await db.getCollectionDocs('cohorts');
      const cohorts = docs
        .map((d) => ({ ...d.data(), id: d.id }))
        .filter((c: any) => assignedIds.includes(c.id) || assignedIds.includes(c.code));
      return res.json({ success: true, cohorts });
    } catch (err: any) {
      const formatted = formatServerFirestoreError(err, db, 'Failed to load assigned cohorts');
      return res.status(formatted.status).json({ error: formatted.message });
    }
  });

  app.get('/api/learner/registers', requireLearnerAuth, async (req: AuthenticatedLearnerRequest, res: Response) => {
    try {
      if (!db) {
        return res.status(503).json({ error: 'Database service unavailable' });
      }
      const cohortId = req.query.cohortId ? String(req.query.cohortId) : undefined;
      const assignedIds: string[] = req.authLearner.assignedCohortIds || [];

      if (cohortId) {
        let isMember = assignedIds.includes(cohortId);
        if (!isMember) {
          const cohortSnap = await db.getDoc('cohorts', cohortId);
          if (cohortSnap.exists) {
            const cohortCode = cohortSnap.data()?.code;
            if (cohortCode && assignedIds.includes(cohortCode)) {
              isMember = true;
            }
          }
        }
        if (!isMember) {
          return res.status(403).json({ error: 'Access denied: you are not assigned to this cohort.' });
        }
      }

      const filters: Array<[string, '==' | 'array-contains', any]> = [
        ['learnerDocId', '==', req.authLearner.id],
      ];
      if (cohortId) {
        filters.push(['cohortId', '==', cohortId]);
      }

      const docs = await db.queryWhere('dailyRegisters', filters);
      const registers = docs
        .map((d) => ({ ...d.data(), id: d.id }))
        .sort((a: any, b: any) => String(b.timestamp || '').localeCompare(String(a.timestamp || '')));
      return res.json({ success: true, registers });
    } catch (err: any) {
      const formatted = formatServerFirestoreError(err, db, 'Failed to load learner registers');
      return res.status(formatted.status).json({ error: formatted.message });
    }
  });

  app.get('/api/learner/feedback', requireLearnerAuth, async (req: AuthenticatedLearnerRequest, res: Response) => {
    try {
      if (!db) {
        return res.status(503).json({ error: 'Database service unavailable' });
      }
      const docs = await db.queryWhere('teacherFeedback', [['learnerDocId', '==', req.authLearner.id]]);
      const feedback = docs
        .map((d) => ({ ...d.data(), id: d.id }))
        .sort((a: any, b: any) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')));
      return res.json({ success: true, feedback });
    } catch (err: any) {
      const formatted = formatServerFirestoreError(err, db, 'Failed to load teacher feedback');
      return res.status(formatted.status).json({ error: formatted.message });
    }
  });

  app.get('/api/learner/timetable', requireLearnerAuth, async (req: AuthenticatedLearnerRequest, res: Response) => {
    try {
      if (!db) {
        return res.status(503).json({ error: 'Database service unavailable' });
      }
      const cohortId = req.query.cohortId ? String(req.query.cohortId).trim() : '';
      if (!cohortId) {
        return res.status(400).json({ error: 'Cohort ID is required.' });
      }

      const assignedIds: string[] = req.authLearner.assignedCohortIds || [];
      let isMember = assignedIds.includes(cohortId);
      if (!isMember) {
        const cohortSnap = await db.getDoc('cohorts', cohortId);
        if (cohortSnap.exists && cohortSnap.data()?.code && assignedIds.includes(cohortSnap.data()?.code)) {
          isMember = true;
        }
      }
      if (!isMember) {
        return res.status(403).json({ error: 'Access denied: you are not assigned to this cohort.' });
      }

      const docs = await db.queryWhere('weeklyTimetables', [['cohortId', '==', cohortId]]);
      const entries = docs
        .map((d) => ({ ...d.data(), id: d.id }))
        .sort((a: any, b: any) => {
          if (a.startDate !== b.startDate) return String(a.startDate || '').localeCompare(String(b.startDate || ''));
          return (Number(a.weekNumber) || 0) - (Number(b.weekNumber) || 0);
        });
      return res.json({ success: true, entries });
    } catch (err: any) {
      const formatted = formatServerFirestoreError(err, db, 'Failed to load weekly timetable');
      return res.status(formatted.status).json({ error: formatted.message });
    }
  });

  app.get('/api/learner/settings', requireLearnerAuth, async (_req: AuthenticatedLearnerRequest, res: Response) => {
    const defaultSettings = {
      id: 'school_config',
      schoolName: 'Sangurur Comprehensive School',
      schoolMotto: 'THINK, CODE, CHANGE THE WORLD',
      timezone: 'Africa/Nairobi',
      allowLearnerReflections: true,
      lateCutoffTime: '08:30',
      attendanceCutoffTime: '16:30',
      contactEmail: 'sangururschool10@gmail.com',
    };
    try {
      if (!db) return res.json({ success: true, settings: defaultSettings });
      const snap = await db.getDoc('schoolSettings', 'school_config');
      return res.json({
        success: true,
        settings: snap.exists ? { ...defaultSettings, ...snap.data() } : defaultSettings,
      });
    } catch {
      return res.json({ success: true, settings: defaultSettings });
    }
  });

  // Create Single Learner (Authenticated Teacher Only)
  app.post('/api/learners/create', requireTeacherAuth, async (req: AuthenticatedTeacherRequest, res: Response) => {
    try {
      const authTeacher = req.authTeacher!;
      const {
        fullName,
        cohortId,
        gender,
        age,
        schoolName,
        grade,
        guardianContact,
        customDigitalId,
      } = req.body;

      if (!fullName || !String(fullName).trim() || !cohortId) {
        return res.status(400).json({ error: 'Full name and cohort assignment are required' });
      }

      if (!db) {
        return res.status(503).json({ error: 'Database service unavailable' });
      }

      const cohortSnap = await db.getDoc('cohorts', String(cohortId));
      if (!cohortSnap.exists) {
        return res.status(404).json({ error: 'Selected cohort was not found.' });
      }
      const hasSchoolWideAccess =
        authTeacher.role === 'admin' ||
        authTeacher.role === 'super_admin' ||
        authTeacher.uid === DEFAULT_TEACHER_UID;
      if (!hasSchoolWideAccess && cohortSnap.data()?.teacherId !== authTeacher.uid) {
        return res.status(403).json({ error: 'Access denied: you are not assigned to this cohort.' });
      }

      let digitalId = '';
      if (customDigitalId && String(customDigitalId).trim()) {
        digitalId = String(customDigitalId).trim().toUpperCase();
        const dupDocs = await db.queryWhere('learners', [['digitalId', '==', digitalId]]);
        if (dupDocs.length > 0) {
          return res.status(409).json({ error: `Digital ID ${digitalId} is already assigned to another learner.` });
        }
      } else {
        [digitalId] = await allocateDigitalIds(db, 1);
      }

      const username = digitalId;
      const learnerId = digitalId;

      const initialPassword = DEFAULT_INITIAL_PASSWORD;
      const salt = generateSalt();
      const passwordHash = hashPassword(initialPassword, salt);

      const normalizedSchool =
        schoolName && String(schoolName).trim()
          ? String(schoolName).trim().slice(0, 128)
          : 'Sangurur Comprehensive School';
      const normalizedGrade =
        grade && String(grade).trim() ? String(grade).trim().slice(0, 64) : null;

      const docId = `learner_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`;
      const newLearner = {
        id: docId,
        fullName: String(fullName).trim(),
        digitalId,
        learnerId,
        username,
        gender: gender || null,
        age: age ? Number(age) : null,
        schoolName: normalizedSchool,
        grade: normalizedGrade,
        guardianContact: guardianContact || null,
        assignedCohortIds: [cohortId],
        mustChangePassword: true,
        isFirstLogin: true,
        status: 'ACTIVE',
        active: true,
        passwordHash,
        salt,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      await db.setDoc('learners', docId, newLearner);

      const memberId = `mem_${cohortId}_${docId}`;
      await db.setDoc('cohortMembers', memberId, {
        id: memberId,
        cohortId,
        learnerId: docId,
        learnerName: newLearner.fullName,
        learnerCode: digitalId,
        joinedAt: new Date().toISOString(),
        status: 'active',
      });

      await writeAuditLog(db, {
        actorId: authTeacher.uid,
        actorName: authTeacher.fullName,
        actorRole: authTeacher.role,
        action: 'CREATE_LEARNER',
        targetEntity: 'learner',
        targetId: docId,
        details: `Registered learner ${newLearner.fullName} with Digital ID ${digitalId} in cohort ${cohortId}.`,
      });

      return res.json({
        success: true,
        learner: {
          ...newLearner,
          passwordHash: undefined,
          salt: undefined,
          initialPassword: DEFAULT_INITIAL_PASSWORD,
        },
      });
    } catch (err: any) {
      console.error('Create learner error:', err);
      const formatted = formatServerFirestoreError(err, db, 'Error creating learner');
      return res.status(formatted.status).json({ error: formatted.message });
    }
  });

  // Bulk Import Learners (Authenticated Teacher Only)
  app.post('/api/learners/bulk-import', requireTeacherAuth, async (req: AuthenticatedTeacherRequest, res: Response) => {
    try {
      const authTeacher = req.authTeacher!;
      const { cohortId, learners } = req.body;
      if (!cohortId || !Array.isArray(learners) || learners.length === 0) {
        return res.status(400).json({ error: 'Cohort ID and a list of learners are required' });
      }

      if (!db) {
        return res.status(503).json({ error: 'Database service unavailable' });
      }

      const cohortSnap = await db.getDoc('cohorts', String(cohortId));
      if (!cohortSnap.exists) {
        return res.status(404).json({ error: 'Selected cohort was not found.' });
      }
      const hasSchoolWideAccess =
        authTeacher.role === 'admin' ||
        authTeacher.role === 'super_admin' ||
        authTeacher.uid === DEFAULT_TEACHER_UID;
      if (!hasSchoolWideAccess && cohortSnap.data()?.teacherId !== authTeacher.uid) {
        return res.status(403).json({ error: 'Access denied: you are not assigned to this cohort.' });
      }

      const validItems = learners.filter((item: any) => String(item?.fullName || '').trim().length > 0);
      if (validItems.length === 0) {
        return res.status(400).json({ error: 'No valid learner rows found in upload.' });
      }

      const allocatedIds = await allocateDigitalIds(db, validItems.length);

      const createdList: any[] = [];
      const errors: string[] = [];

      for (let i = 0; i < validItems.length; i++) {
        const item = validItems[i];
        try {
          const fullName = String(item.fullName).trim();
          const digitalId = allocatedIds[i];
          const username = digitalId;
          const learnerId = digitalId;

          const salt = generateSalt();
          const passwordHash = hashPassword(DEFAULT_INITIAL_PASSWORD, salt);

          const docId = `learner_${Date.now()}_${i}_${crypto.randomBytes(3).toString('hex')}`;
          const normalizedSchool =
            item.schoolName && String(item.schoolName).trim()
              ? String(item.schoolName).trim().slice(0, 128)
              : 'Sangurur Comprehensive School';
          const normalizedGrade =
            item.grade && String(item.grade).trim()
              ? String(item.grade).trim().slice(0, 64)
              : null;

          const newLearner = {
            id: docId,
            fullName,
            digitalId,
            learnerId,
            username,
            gender: item.gender || null,
            age: item.age ? Number(item.age) : null,
            schoolName: normalizedSchool,
            grade: normalizedGrade,
            guardianContact: item.guardianContact || null,
            assignedCohortIds: [cohortId],
            mustChangePassword: true,
            isFirstLogin: true,
            status: 'ACTIVE',
            active: true,
            passwordHash,
            salt,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          };

          await db.setDoc('learners', docId, newLearner);

          const memberId = `mem_${cohortId}_${docId}`;
          await db.setDoc('cohortMembers', memberId, {
            id: memberId,
            cohortId,
            learnerId: docId,
            learnerName: fullName,
            learnerCode: digitalId,
            joinedAt: new Date().toISOString(),
            status: 'active',
          });

          createdList.push({
            ...newLearner,
            passwordHash: undefined,
            salt: undefined,
            initialPassword: DEFAULT_INITIAL_PASSWORD,
          });
        } catch (err: any) {
          errors.push(`Error registering ${item.fullName}: ${err.message}`);
        }
      }

      await writeAuditLog(db, {
        actorId: authTeacher.uid,
        actorName: authTeacher.fullName,
        actorRole: authTeacher.role,
        action: 'BULK_IMPORT_LEARNERS',
        targetEntity: 'cohort',
        targetId: cohortId,
        details: `Bulk imported ${createdList.length} learners into cohort ${cohortId} (${allocatedIds[0]} to ${allocatedIds[allocatedIds.length - 1]}).`,
      });

      return res.json({
        success: true,
        createdCount: createdList.length,
        learners: createdList,
        errors,
      });
    } catch (err: any) {
      console.error('Bulk import error:', err);
      const formatted = formatServerFirestoreError(err, db, 'Error processing bulk import');
      return res.status(formatted.status).json({ error: formatted.message });
    }
  });

  // Teacher Resets Learner Password to Default Password (Authenticated Teacher Only)
  app.post('/api/learners/reset-password', requireTeacherAuth, async (req: AuthenticatedTeacherRequest, res: Response) => {
    try {
      if (!db) {
        return res.status(503).json({ error: 'Database service unavailable' });
      }
      const authTeacher = req.authTeacher!;
      const { learnerId } = req.body;
      if (!learnerId) return res.status(400).json({ error: 'Learner ID is required' });

      const snap = await db.getDoc('learners', learnerId);

      if (!snap.exists) {
        return res.status(404).json({ error: 'Learner account not found' });
      }

      const learnerData = snap.data() || {};
      const hasSchoolWideAccess =
        authTeacher.role === 'admin' ||
        authTeacher.role === 'super_admin' ||
        authTeacher.uid === DEFAULT_TEACHER_UID;

      if (!hasSchoolWideAccess) {
        const assignedCohortIds: string[] = Array.isArray(learnerData.assignedCohortIds)
          ? learnerData.assignedCohortIds
          : [];
        const teacherCohorts = await db.queryWhere('cohorts', [['teacherId', '==', authTeacher.uid]]);
        const allowedKeys = new Set<string>();
        teacherCohorts.forEach((c) => {
          allowedKeys.add(c.id);
          if (c.data()?.code) allowedKeys.add(c.data()?.code);
        });
        const ownsAnyLearnerCohort = assignedCohortIds.some((cid) => allowedKeys.has(cid));
        if (!ownsAnyLearnerCohort) {
          return res.status(403).json({ error: 'Access denied: learner is not enrolled in any of your cohorts.' });
        }
      }

      const salt = generateSalt();
      const passwordHash = hashPassword(DEFAULT_INITIAL_PASSWORD, salt);

      await db.updateDoc('learners', learnerId, {
        passwordHash,
        salt,
        mustChangePassword: true,
        isFirstLogin: true,
        status: 'ACTIVE',
        active: true,
        sessionRevokedAt: Date.now(),
        updatedAt: new Date().toISOString(),
      });

      await writeAuditLog(db, {
        actorId: authTeacher.uid,
        actorName: authTeacher.fullName,
        actorRole: authTeacher.role,
        action: 'RESET_LEARNER_PASSWORD',
        targetEntity: 'learner',
        targetId: learnerId,
        details: `Authorised password reset to default '123456789' with mustChangePassword=true for ${learnerData.fullName} (Digital ID: ${learnerData.digitalId || learnerData.learnerId})`,
      });

      return res.json({
        success: true,
        digitalId: learnerData.digitalId || learnerData.learnerId,
        learnerName: learnerData.fullName,
        initialPassword: DEFAULT_INITIAL_PASSWORD,
        message: 'Password reset to default 123456789. Audit log entry recorded.',
      });
    } catch (err: any) {
      const formatted = formatServerFirestoreError(err, db, 'Error resetting password');
      return res.status(formatted.status).json({ error: formatted.message });
    }
  });

  // Daily Register Submission (Strictly authenticated learner)
  app.post('/api/attendance/submit', requireLearnerAuth, async (req: AuthenticatedLearnerRequest, res: Response) => {
    try {
      if (!db) {
        return res.status(503).json({ error: 'Database service unavailable' });
      }
      const authLearner = req.authLearner;
      if (authLearner.mustChangePassword) {
        return res.status(403).json({ error: 'You must complete your mandatory password change before submitting a register.' });
      }

      const {
        cohortId,
        cohortCode,
        learnerDocId,
        date: requestedDate,
        status,
        didStudy = true,
        nonStudyReason,
        topicId,
        topicTitle,
        topicDescription,
        learningAreaId,
        learningAreaTitle,
        moduleId,
        moduleTitle,
        understandingLevel,
        reflectionLearned,
        reflectionActivity,
        reflectionDifficult,
        reflectionTeacherExplain,
      } = req.body;

      if (!cohortId || !status) {
        return res.status(400).json({ error: 'Cohort and attendance status are required' });
      }

      if (learnerDocId && learnerDocId !== authLearner.id) {
        return res.status(403).json({ error: 'Cannot submit attendance for another learner.' });
      }

      const nairobiToday = getNairobiDateString();
      const targetDate = requestedDate ? String(requestedDate).trim() : nairobiToday;

      if (!/^\d{4}-\d{2}-\d{2}$/.test(targetDate)) {
        return res.status(400).json({ error: 'Invalid date format. Expected YYYY-MM-DD.' });
      }
      const [yy, mm, dd] = targetDate.split('-').map(Number);
      const calCheck = new Date(Date.UTC(yy, mm - 1, dd));
      if (
        calCheck.getUTCFullYear() !== yy ||
        calCheck.getUTCMonth() !== mm - 1 ||
        calCheck.getUTCDate() !== dd
      ) {
        return res.status(400).json({ error: `Invalid calendar date: ${targetDate}` });
      }
      if (targetDate > nairobiToday) {
        return res.status(400).json({ error: `Cannot submit register for a future date (${targetDate}).` });
      }
      if (targetDate < '2020-01-01') {
        return res.status(400).json({ error: 'Selected date is out of valid range.' });
      }

      const isPreviousDay = targetDate < nairobiToday;

      const cohortSnap = await db.getDoc('cohorts', String(cohortId));
      if (!cohortSnap.exists) {
        return res.status(404).json({ error: 'Cohort not found.' });
      }
      const cohortData = cohortSnap.data() || {};
      if (cohortData.status !== 'active') {
        return res.status(403).json({ error: 'Attendance cannot be submitted to an archived or inactive cohort.' });
      }

      const assignedIds: string[] = authLearner.assignedCohortIds || [];
      if (!assignedIds.includes(cohortId) && !assignedIds.includes(cohortData.code)) {
        return res.status(403).json({ error: 'Access denied: you are not assigned to this cohort.' });
      }

      if (!['present', 'late'].includes(status)) {
        return res.status(400).json({ error: 'Learners can only submit Present or Late attendance' });
      }

      const studied = didStudy !== false;
      const cleanNonStudyReason = !studied
        ? String(nonStudyReason || '').trim().slice(0, 256)
        : null;

      if (!studied && !cleanNonStudyReason) {
        return res.status(400).json({
          error: 'Please select or enter a reason explaining why you did not study (e.g., Power blackout).',
        });
      }

      const validUnderstanding = studied
        ? ['excellent', 'good', 'fair', 'needs_support'].includes(understandingLevel)
          ? understandingLevel
          : 'good'
        : null;

      let allowReflections = true;
      try {
        const settSnap = await db.getDoc('schoolSettings', 'school_config');
        if (settSnap.exists && settSnap.data()?.allowLearnerReflections === false) {
          allowReflections = false;
        }
      } catch {
        // default true
      }

      const docId = `reg_${cohortId}_${authLearner.id}_${targetDate}`;

      const payload: any = {
        id: docId,
        cohortId,
        cohortCode: cohortCode || cohortData.code || 'COHORT',
        learnerDocId: authLearner.id,
        learnerId: authLearner.digitalId || authLearner.learnerId,
        learnerName: authLearner.fullName,
        date: targetDate,
        timestamp: new Date().toISOString(),
        status,
        didStudy: studied,
        nonStudyReason: cleanNonStudyReason,
        verificationStatus: 'pending_verification',
        learningAreaId: studied && learningAreaId ? String(learningAreaId).slice(0, 128) : null,
        learningAreaTitle: studied && learningAreaTitle ? String(learningAreaTitle).slice(0, 128) : null,
        moduleId: studied && moduleId ? String(moduleId).slice(0, 128) : null,
        moduleTitle: studied && moduleTitle ? String(moduleTitle).slice(0, 128) : null,
        topicId: studied && topicId ? String(topicId).slice(0, 128) : null,
        topicTitle: studied && topicTitle ? String(topicTitle).slice(0, 128) : null,
        topicDescription: studied && topicDescription ? String(topicDescription).slice(0, 512) : null,
        understandingLevel: validUnderstanding,
        reflectionLearned: allowReflections && reflectionLearned ? String(reflectionLearned).slice(0, 1024) : null,
        reflectionActivity: allowReflections && reflectionActivity ? String(reflectionActivity).slice(0, 1024) : null,
        reflectionDifficult: allowReflections && reflectionDifficult ? String(reflectionDifficult).slice(0, 1024) : null,
        reflectionTeacherExplain:
          allowReflections && reflectionTeacherExplain ? String(reflectionTeacherExplain).slice(0, 1024) : null,
        correctionHistory: [],
      };

      const txResult = await db.runTransaction(async (tx) => {
        const existingSnap = await tx.get('dailyRegisters', docId);
        if (existingSnap.exists) {
          const existingData = existingSnap.data() || {};
          if (!isPreviousDay) {
            return { conflict: existingData, blocked: false, updated: false, saved: null };
          }
          if (['absent', 'excused'].includes(existingData.status)) {
            return { conflict: existingData, blocked: true, updated: false, saved: null };
          }
          const mergedPrevious = {
            ...existingData,
            status: existingData.verificationStatus === 'corrected' ? existingData.status : status,
            didStudy: studied,
            nonStudyReason: cleanNonStudyReason,
            learningAreaId: payload.learningAreaId,
            learningAreaTitle: payload.learningAreaTitle,
            moduleId: payload.moduleId,
            moduleTitle: payload.moduleTitle,
            topicId: payload.topicId,
            topicTitle: payload.topicTitle,
            topicDescription: payload.topicDescription,
            understandingLevel: validUnderstanding,
            reflectionLearned: payload.reflectionLearned ?? existingData.reflectionLearned ?? null,
            reflectionActivity: payload.reflectionActivity ?? existingData.reflectionActivity ?? null,
            reflectionDifficult: payload.reflectionDifficult ?? existingData.reflectionDifficult ?? null,
            reflectionTeacherExplain:
              payload.reflectionTeacherExplain ?? existingData.reflectionTeacherExplain ?? null,
            timestamp: existingData.timestamp || new Date().toISOString(),
          };
          tx.set('dailyRegisters', docId, mergedPrevious);
          return { conflict: null, blocked: false, updated: true, saved: mergedPrevious };
        }

        tx.set('dailyRegisters', docId, payload);
        return { conflict: null, blocked: false, updated: false, saved: payload };
      });

      if (txResult.blocked) {
        return res.status(403).json({
          error: `A teacher marked you ${txResult.conflict?.status?.toUpperCase()} on ${targetDate}. Please contact your teacher to correct attendance.`,
        });
      }

      if (txResult.conflict) {
        return res.status(409).json({
          error: 'Your register for today has already been submitted.',
          alreadySubmitted: true,
          submission: txResult.conflict,
        });
      }

      if (isPreviousDay) {
        await writeAuditLog(db, {
          actorId: authLearner.id,
          actorName: authLearner.fullName,
          actorRole: 'learner',
          action: txResult.updated ? 'LEARNER_UPDATE_PREVIOUS_DAY_REGISTER' : 'LEARNER_SUBMIT_PREVIOUS_DAY_REGISTER',
          targetEntity: 'dailyRegister',
          targetId: docId,
          details: `${txResult.updated ? 'Updated' : 'Submitted'} register for ${targetDate}: status=${txResult.saved.status}, didStudy=${studied}${
            cleanNonStudyReason
              ? `, reason=${cleanNonStudyReason}`
              : `, area=${payload.learningAreaTitle || 'General'}, topic=${payload.topicTitle || 'N/A'}, understanding=${validUnderstanding}`
          }.`,
        });
      }

      return res.json({
        success: true,
        updated: txResult.updated,
        message: isPreviousDay
          ? txResult.updated
            ? `Previous day (${targetDate}) learning record updated successfully!`
            : `Previous day (${targetDate}) register submitted successfully!`
          : 'Daily register submitted successfully!',
        register: txResult.saved,
      });
    } catch (err: any) {
      console.error('Attendance submit error:', err);
      const formatted = formatServerFirestoreError(err, db, 'Failed to submit daily register');
      return res.status(formatted.status).json({ error: formatted.message });
    }
  });

  // Bulk Upload Historical / Previous Dates Attendance Register (Authenticated Teacher Only)
  app.post('/api/attendance/bulk-upload', requireTeacherAuth, async (req: AuthenticatedTeacherRequest, res: Response) => {
    try {
      const authTeacher = req.authTeacher!;
      const {
        cohortId,
        entries,
        conflictMode = 'skip',
        sessionLabel,
      } = req.body;

      if (!Array.isArray(entries) || entries.length === 0) {
        return res.status(400).json({ error: 'At least one attendance entry is required for upload.' });
      }

      if (!db) {
        return res.status(503).json({ error: 'Database service unavailable' });
      }

      const [cohortsDocs, learnersDocs] = await Promise.all([
        db.getCollectionDocs('cohorts'),
        db.getCollectionDocs('learners'),
      ]);

      const cohortsById = new Map<string, any>();
      const cohortsByCode = new Map<string, any>();
      cohortsDocs.forEach((d) => {
        const c: Record<string, any> = { ...d.data(), id: d.id };
        cohortsById.set(d.id, c);
        if (c.code) cohortsByCode.set(String(c.code).trim().toUpperCase(), c);
      });

      const hasSchoolWideAccess =
        authTeacher.role === 'admin' ||
        authTeacher.role === 'super_admin' ||
        authTeacher.uid === DEFAULT_TEACHER_UID;

      const defaultCohort = cohortId ? cohortsById.get(String(cohortId)) : null;
      if (cohortId && !defaultCohort) {
        return res.status(404).json({ error: 'Selected target cohort was not found.' });
      }
      if (defaultCohort && !hasSchoolWideAccess && defaultCohort.teacherId !== authTeacher.uid) {
        return res.status(403).json({ error: 'Access denied: you are not assigned to this cohort.' });
      }

      const learnersList = learnersDocs.map((d) => ({ ...d.data(), id: d.id }));
      const learnersByDigitalId = new Map<string, any>();
      learnersList.forEach((l: any) => {
        const keys = [l.digitalId, l.learnerId, l.username, l.id].filter(Boolean);
        keys.forEach((k) => learnersByDigitalId.set(String(k).trim().toUpperCase(), l));
      });

      const nairobiToday = getNairobiDateString();
      const cleanSessionLabel = sessionLabel ? String(sessionLabel).trim().slice(0, 120) : '';
      const mode: 'skip' | 'overwrite' = conflictMode === 'overwrite' ? 'overwrite' : 'skip';

      let createdCount = 0;
      let updatedCount = 0;
      let skippedCount = 0;
      const errors: string[] = [];
      const skipped: string[] = [];
      const uploadedDates = new Set<string>();

      for (let i = 0; i < entries.length; i++) {
        const item = entries[i];
        const rowNum = item?.rowNumber || i + 1;

        const dateStr = String(item?.date || '').trim();
        if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
          errors.push(`Row ${rowNum}: Invalid date "${dateStr}". Expected YYYY-MM-DD.`);
          continue;
        }

        const [yy, mm, dd] = dateStr.split('-').map(Number);
        const checkDate = new Date(Date.UTC(yy, mm - 1, dd));
        if (
          checkDate.getUTCFullYear() !== yy ||
          checkDate.getUTCMonth() !== mm - 1 ||
          checkDate.getUTCDate() !== dd
        ) {
          errors.push(`Row ${rowNum}: Non-existent calendar date "${dateStr}".`);
          continue;
        }

        if (dateStr > nairobiToday) {
          errors.push(`Row ${rowNum}: Date ${dateStr} is in the future (today is ${nairobiToday}).`);
          continue;
        }

        const status = String(item?.status || '').trim().toLowerCase();
        if (!['present', 'late', 'absent', 'excused'].includes(status)) {
          errors.push(`Row ${rowNum}: Invalid status "${item?.status}".`);
          continue;
        }

        let targetCohort = defaultCohort;
        if (item?.cohortCode) {
          const byCode = cohortsByCode.get(String(item.cohortCode).trim().toUpperCase());
          if (byCode) {
            targetCohort = byCode;
          } else if (!targetCohort) {
            errors.push(`Row ${rowNum}: Cohort code "${item.cohortCode}" was not found.`);
            continue;
          }
        }
        if (!targetCohort) {
          errors.push(`Row ${rowNum}: No target cohort specified.`);
          continue;
        }
        if (!hasSchoolWideAccess && targetCohort.teacherId !== authTeacher.uid) {
          errors.push(`Row ${rowNum}: Access denied for cohort "${targetCohort.code}".`);
          continue;
        }

        const rawId = item?.learnerId ? String(item.learnerId).trim().toUpperCase() : '';
        const rawName = item?.learnerName ? String(item.learnerName).trim().toLowerCase() : '';

        let matchedLearner = rawId ? learnersByDigitalId.get(rawId) : undefined;
        if (!matchedLearner && rawName) {
          matchedLearner =
            learnersList.find(
              (l: any) =>
                String(l.fullName || '').trim().toLowerCase() === rawName &&
                Array.isArray(l.assignedCohortIds) &&
                (l.assignedCohortIds.includes(targetCohort.id) || l.assignedCohortIds.includes(targetCohort.code))
            ) ||
            learnersList.find((l: any) => String(l.fullName || '').trim().toLowerCase() === rawName);
        }

        if (!matchedLearner) {
          errors.push(
            `Row ${rowNum}: Learner "${item?.learnerId || item?.learnerName || 'Unknown'}" was not found in registered learners.`
          );
          continue;
        }

        const docId = `reg_${targetCohort.id}_${matchedLearner.id}_${dateStr}`;
        const existingSnap = await db.getDoc('dailyRegisters', docId);

        const learnerDigitalId = matchedLearner.digitalId || matchedLearner.learnerId;
        const validUnderstanding = ['excellent', 'good', 'fair', 'needs_support'].includes(
          String(item?.understandingLevel || '').trim()
        )
          ? String(item.understandingLevel).trim()
          : null;
        const noteText = item?.teacherNote
          ? String(item.teacherNote).trim().slice(0, 1024)
          : cleanSessionLabel
          ? `Historical Excel Upload (${cleanSessionLabel})`
          : 'Historical Excel Register Upload';
        const topicText = item?.topicTitle
          ? String(item.topicTitle).trim().slice(0, 128)
          : cleanSessionLabel || null;

        if (existingSnap.exists) {
          if (mode === 'skip') {
            skippedCount++;
            skipped.push(`Row ${rowNum}: ${matchedLearner.fullName} (${dateStr}) already exists`);
            continue;
          }

          const existingData = existingSnap.data() || {};
          const prevHistory = Array.isArray(existingData.correctionHistory) ? existingData.correctionHistory : [];
          const correctionEntry = {
            correctedBy: authTeacher.uid,
            correctedByName: authTeacher.fullName,
            timestamp: new Date().toISOString(),
            previousStatus: existingData.status,
            newStatus: status,
            reason: noteText,
          };

          await db.updateDoc('dailyRegisters', docId, {
            cohortId: targetCohort.id,
            cohortCode: targetCohort.code || 'COHORT',
            learnerDocId: matchedLearner.id,
            learnerId: learnerDigitalId,
            learnerName: matchedLearner.fullName,
            date: dateStr,
            status,
            verificationStatus: 'corrected',
            topicTitle: topicText ?? existingData.topicTitle ?? null,
            understandingLevel: validUnderstanding ?? existingData.understandingLevel ?? null,
            teacherNote: noteText,
            reviewedBy: authTeacher.uid,
            reviewedAt: new Date().toISOString(),
            correctionHistory: [...prevHistory, correctionEntry],
          });

          updatedCount++;
          uploadedDates.add(dateStr);
        } else {
          await db.setDoc('dailyRegisters', docId, {
            id: docId,
            cohortId: targetCohort.id,
            cohortCode: targetCohort.code || 'COHORT',
            learnerDocId: matchedLearner.id,
            learnerId: learnerDigitalId,
            learnerName: matchedLearner.fullName,
            date: dateStr,
            timestamp: `${dateStr}T08:00:00+03:00`,
            status,
            verificationStatus: 'verified',
            topicTitle: topicText,
            understandingLevel: validUnderstanding,
            teacherNote: noteText,
            reviewedBy: authTeacher.uid,
            reviewedAt: new Date().toISOString(),
            correctionHistory: [],
          });

          createdCount++;
          uploadedDates.add(dateStr);
        }
      }

      const sortedDates = Array.from(uploadedDates).sort();
      const dateSpan =
        sortedDates.length > 0
          ? sortedDates.length === 1
            ? sortedDates[0]
            : `${sortedDates[0]} to ${sortedDates[sortedDates.length - 1]}`
          : 'none';

      if (createdCount > 0 || updatedCount > 0) {
        await writeAuditLog(db, {
          actorId: authTeacher.uid,
          actorName: authTeacher.fullName,
          actorRole: authTeacher.role,
          action: 'BULK_UPLOAD_HISTORICAL_REGISTER',
          targetEntity: 'dailyRegister',
          targetId: defaultCohort?.id || 'multi_cohort',
          details: `Uploaded previous dates Excel register${cleanSessionLabel ? ` (${cleanSessionLabel})` : ''}: ${createdCount} created, ${updatedCount} updated, ${skippedCount} skipped. Dates: ${dateSpan}.`,
        });
      }

      return res.json({
        success: true,
        createdCount,
        updatedCount,
        skippedCount,
        failedCount: errors.length,
        errors,
        skipped,
        uploadedDates: sortedDates,
      });
    } catch (err: any) {
      console.error('Historical attendance upload error:', err);
      const formatted = formatServerFirestoreError(err, db, 'Failed to upload historical attendance register');
      return res.status(formatted.status).json({ error: formatted.message });
    }
  });

  return app;
}
