const { PrismaClient } = require('@prisma/client')
const { put } = require('@vercel/blob')

const prisma = new PrismaClient()

function parseDataImage(dataUrl) {
  const match = /^data:(image\/[a-zA-Z0-9.+-]+);base64,([\s\S]+)$/.exec(String(dataUrl || '').trim())
  if (!match) return null
  const mime = match[1]
  const ext = mime.includes('png') ? 'png' : mime.includes('webp') ? 'webp' : mime.includes('gif') ? 'gif' : 'jpg'
  return { mime, bytes: Buffer.from(match[2], 'base64'), ext }
}

async function main() {
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    throw new Error('BLOB_READ_WRITE_TOKEN is required')
  }

  let totalMigrated = 0
  let totalSkipped = 0
  for (;;) {
    const dishes = await prisma.dish.findMany({
      where: { image: { startsWith: 'data:image/' } },
      select: { id: true, restaurantId: true, image: true, updatedAt: true },
      take: 20,
      orderBy: { updatedAt: 'asc' },
    })
    if (dishes.length === 0) break

    for (const dish of dishes) {
      const parsed = parseDataImage(dish.image)
      if (!parsed || parsed.bytes.length === 0) {
        totalSkipped += 1
        continue
      }
      const blob = await put(
        `menu/${dish.restaurantId}/${dish.id}-${new Date(dish.updatedAt).getTime()}.${parsed.ext}`,
        parsed.bytes,
        {
          access: 'public',
          contentType: parsed.mime,
        }
      )
      await prisma.dish.update({
        where: { id: dish.id },
        data: { image: blob.url },
      })
      totalMigrated += 1
      process.stdout.write(`migrated=${totalMigrated} skipped=${totalSkipped}\r`)
    }
  }

  const remaining = await prisma.dish.count({ where: { image: { startsWith: 'data:image/' } } })
  console.log(JSON.stringify({ ok: true, migrated: totalMigrated, skipped: totalSkipped, remaining }))
}

main()
  .catch((error) => {
    console.error(error)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
