import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';

// Simple in-memory rate limiter — max 5 wrong attempts per IP per 15 min window
const failMap = new Map<string, { count: number; resetAt: number }>();
const MAX_ATTEMPTS = 5;
const WINDOW_MS = 15 * 60 * 1000; // 15 minutes

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const entry = failMap.get(ip);
  if (!entry || now > entry.resetAt) return false;
  return entry.count >= MAX_ATTEMPTS;
}

function recordFailure(ip: string): void {
  const now = Date.now();
  const entry = failMap.get(ip);
  if (!entry || now > entry.resetAt) {
    failMap.set(ip, { count: 1, resetAt: now + WINDOW_MS });
  } else {
    entry.count += 1;
  }
}

function clearFailures(ip: string): void {
  failMap.delete(ip);
}

export async function POST(req: NextRequest) {
  try {
    const ip =
      req.headers.get('x-forwarded-for')?.split(',')[0].trim() ??
      req.headers.get('x-real-ip') ??
      'unknown';

    if (isRateLimited(ip)) {
      return NextResponse.json(
        { error: 'Too many attempts. Try again in 15 minutes.' },
        { status: 429 }
      );
    }

    const { pin } = await req.json();
    if (!pin || typeof pin !== 'string' || !/^\d{4}$/.test(pin)) {
      return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
    }

    const supabase = createServiceClient();
    const { data: pinSetting } = await supabase
      .from('settings')
      .select('value')
      .eq('key', 'admin_pin')
      .single();

    const adminPin = process.env.ADMIN_PIN ?? pinSetting?.value ?? '1234';

    if (pin !== adminPin) {
      recordFailure(ip);
      return NextResponse.json({ error: 'Invalid PIN' }, { status: 403 });
    }

    clearFailures(ip);
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: 'Auth failed' }, { status: 500 });
  }
}
