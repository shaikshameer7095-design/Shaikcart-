// In-memory auth token storage (never stored in localStorage or sessionStorage)
let memoryAuthToken: string | null = null;

// Non-sensitive guest cart identifier kept in memory for anonymous shopping sessions
let guestCartToken: string =
  'guest_' + Math.random().toString(36).slice(2) + Date.now().toString(36);

export function setAuthToken(token: string | null) {
  memoryAuthToken = token;
}

export function getAuthToken(): string | null {
  return memoryAuthToken;
}

export function getGuestCartToken(): string {
  return guestCartToken;
}

export function formatINR(amount: number): string {
  return `₹${Math.round(amount).toLocaleString('en-IN')}`;
}

export class ApiError extends Error {
  status: number;
  code?: string;

  constructor(message: string, status: number, code?: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

export async function apiRequest<T = any>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const headers = new Headers(options.headers || {});
  if (!headers.has('Content-Type') && options.body && typeof options.body === 'string') {
    headers.set('Content-Type', 'application/json');
  }
  if (memoryAuthToken && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${memoryAuthToken}`);
  }
  headers.set('X-Guest-Token', guestCartToken);

  const response = await fetch(path, {
    ...options,
    headers,
  });

  const contentType = response.headers.get('content-type') || '';
  const isJson = contentType.includes('application/json');
  const data = isJson
    ? await response.json().catch(() => ({}))
    : await response.text();

  if (!response.ok) {
    const msg =
      typeof data === 'object' && data && 'error' in data
        ? String((data as any).error)
        : `Request failed (${response.status})`;
    const code = typeof data === 'object' && data && 'code' in data ? String((data as any).code) : undefined;
    throw new ApiError(msg, response.status, code);
  }

  if (path.startsWith('/api/') && !isJson) {
    throw new ApiError('Service is warming up. Please retry in a moment.', 503);
  }

  return data as T;
}

export async function loadRazorpayCheckoutScript(): Promise<boolean> {
  if (typeof window === 'undefined') return false;
  if ((window as any).Razorpay) return true;
  return new Promise((resolve) => {
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.async = true;
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
}
