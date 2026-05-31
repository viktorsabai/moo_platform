import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import bcrypt from 'bcryptjs'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function PATCH(request: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 })
  }

  let body: { currentPassword?: string; newPassword?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ ok: false, error: 'invalid_body' }, { status: 400 })
  }

  const newPassword = typeof body.newPassword === 'string' ? body.newPassword.trim() : ''
  if (!newPassword || newPassword.length < 6) {
    return NextResponse.json({ ok: false, error: 'new_password_required' }, { status: 400 })
  }

  const userId = String(session.user.id)
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { passwordHash: true },
  })
  if (!user) {
    return NextResponse.json({ ok: false, error: 'user_not_found' }, { status: 404 })
  }

  const hasExistingPassword = Boolean(user.passwordHash)

  if (hasExistingPassword) {
    const currentPassword = typeof body.currentPassword === 'string' ? body.currentPassword : ''
    if (!currentPassword) {
      return NextResponse.json({ ok: false, error: 'current_password_required' }, { status: 400 })
    }
    const match = await bcrypt.compare(currentPassword, user.passwordHash!)
    if (!match) {
      return NextResponse.json({ ok: false, error: 'wrong_password' }, { status: 401 })
    }
  }

  const passwordHash = await bcrypt.hash(newPassword, 10)
  await prisma.user.update({
    where: { id: userId },
    data: { passwordHash },
  })

  return NextResponse.json({ ok: true })
}
