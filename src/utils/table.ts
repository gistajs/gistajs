export function parseFirstColumn(table: string) {
  return table
    .trim()
    .split('\n')
    .slice(1)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => line.split(/\s+/)[0])
    .filter(Boolean)
}
