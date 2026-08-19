import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET() {
  const startedAt = Date.now()
  let database: 'ok' | 'error' = 'ok'
  try {
    await prisma.$queryRaw`SELECT 1`
  } catch {
    database = 'error'
  }
  const ready = database === 'ok'
  return NextResponse.json(
    {
      ok: ready,
      ready,
      service: 'moo-platform',
      environment: process.env.VERCEL_ENV || process.env.NODE_ENV || 'unknown',
      commit: process.env.VERCEL_GIT_COMMIT_SHA || null,
      database,
      checkedAt: new Date().toISOString(),
      latencyMs: Date.now() - startedAt,
    },
    { status: ready ? 200 : 503 },
  )
}
