import { NextResponse } from 'next/server';

export async function GET() {
  const keyId = process.env.RAZORPAY_KEY_ID ?? 'NOT SET';
  const secretLen = process.env.RAZORPAY_KEY_SECRET?.length ?? 0;
  const secretPreview = process.env.RAZORPAY_KEY_SECRET
    ? process.env.RAZORPAY_KEY_SECRET.slice(0, 4) + '***' + process.env.RAZORPAY_KEY_SECRET.slice(-3)
    : 'NOT SET';
  return NextResponse.json({ keyId, secretLen, secretPreview });
}
