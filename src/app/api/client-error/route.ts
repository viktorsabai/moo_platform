import { NextResponse } from 'next/server'

export const runtime = 'nodejs'

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => null)
    // eslint-disable-next-line no-console
    console.error('[client-error]', JSON.stringify(body))
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error('[client-error] failed to read body', e)
  }
  return NextResponse.json({ ok: true })
}

