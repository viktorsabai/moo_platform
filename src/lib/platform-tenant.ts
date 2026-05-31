/**
 * Multi-tenant MOO: do not silently make the first user OWNER of `default`.
 * Enable only for local/demo via UFO_ALLOW_AUTO_DEFAULT_OWNER=true.
 */
export function allowAutoDefaultOwner(): boolean {
  const v = String(process.env.UFO_ALLOW_AUTO_DEFAULT_OWNER || '').toLowerCase()
  return v === 'true' || v === '1' || v === 'yes'
}
