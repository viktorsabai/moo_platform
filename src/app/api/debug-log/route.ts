import { NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const LOG_PATH = path.join(process.cwd(), '.cursor', 'debug.log')

export async function POST(request: Request) {
  try {
    const raw = await request.text()
    if (!raw?.trim()) return NextResponse.json({ ok: false }, { status: 400 })
    const dir = path.dirname(LOG_PATH)
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
    fs.appendFileSync(LOG_PATH, raw.trim().endsWith('\n') ? raw : raw + '\n')
    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ ok: false }, { status: 500 })
  }
}
