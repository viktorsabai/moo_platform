/**
 * CSV parser: handles BOM, comma or semicolon delimiter.
 * Returns array of rows, each row is string[].
 */
export function parseCsv(text: string): string[][] {
  let s = text.trim()
  if (s.charCodeAt(0) === 0xfeff) s = s.slice(1) // UTF-8 BOM
  const lines = s.split(/\r?\n/)
  const delimiter = lines[0]?.includes(';') ? ';' : ','
  return lines.map((line) => line.split(delimiter).map((cell) => cell.trim().replace(/^["']|["']$/g, '')))
}
