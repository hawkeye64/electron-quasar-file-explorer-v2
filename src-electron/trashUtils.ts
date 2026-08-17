export function parseTrashItemCount(output: string): number {
  const count = Number.parseInt(output.trim(), 10)
  return Number.isInteger(count) && count >= 0 ? count : 0
}
