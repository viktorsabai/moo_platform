import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

/** Диагностика: какая сборка на сервере (для проверки деплоя). */
export async function GET() {
  const ref = process.env.VERCEL_GIT_COMMIT_REF ?? null
  return NextResponse.json({
    ok: true,
    environment: ref === 'test' ? 'test' : 'production',
    subscriptionBuilder: 'v13-admin-lk-v2',
    sha: process.env.VERCEL_GIT_COMMIT_SHA ?? null,
    ref,
    deployedAt: process.env.VERCEL_DEPLOYMENT_ID ?? null,
  })
}
