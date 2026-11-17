import { SCHOOL_LOGO_SRC } from '../components/common/SchoolLogo';

let cachedDataUrl: string | null = null;
let cachedBuffer: ArrayBuffer | null = null;
let pendingDataUrlPromise: Promise<string | null> | null = null;
let pendingBufferPromise: Promise<ArrayBuffer | null> | null = null;

export async function getSchoolLogoArrayBuffer(): Promise<ArrayBuffer | null> {
  if (cachedBuffer) return cachedBuffer;
  if (pendingBufferPromise) return pendingBufferPromise;

  pendingBufferPromise = (async () => {
    try {
      const response = await fetch(SCHOOL_LOGO_SRC, { cache: 'force-cache' });
      if (!response.ok) return null;
      const buf = await response.arrayBuffer();
      cachedBuffer = buf;
      return buf;
    } catch {
      return null;
    } finally {
      pendingBufferPromise = null;
    }
  })();

  return pendingBufferPromise;
}

export async function getSchoolLogoDataUrl(): Promise<string | null> {
  if (cachedDataUrl) return cachedDataUrl;
  if (pendingDataUrlPromise) return pendingDataUrlPromise;

  pendingDataUrlPromise = (async () => {
    try {
      const response = await fetch(SCHOOL_LOGO_SRC, { cache: 'force-cache' });
      if (!response.ok) return null;
      const blob = await response.blob();
      const dataUrl = await new Promise<string | null>((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(typeof reader.result === 'string' ? reader.result : null);
        reader.onerror = () => resolve(null);
        reader.readAsDataURL(blob);
      });
      if (dataUrl) cachedDataUrl = dataUrl;
      return dataUrl;
    } catch {
      return null;
    } finally {
      pendingDataUrlPromise = null;
    }
  })();

  return pendingDataUrlPromise;
}

if (typeof window !== 'undefined') {
  getSchoolLogoDataUrl().catch(() => {});
}
