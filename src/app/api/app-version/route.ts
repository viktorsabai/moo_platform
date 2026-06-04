import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

/** Диагностика: какая сборка на сервере (для проверки деплоя). */
export async function GET() {
  return NextResponse.json({
    ok: true,
    subscriptionBuilder: 'v12-delivery-e2e',
    sha: process.env.VERCEL_GIT_COMMIT_SHA ?? null,
    ref: process.env.VERCEL_GIT_COMMIT_REF ?? null,
    deployedAt: process.env.VERCEL_DEPLOYMENT_ID ?? null,
  })
}
