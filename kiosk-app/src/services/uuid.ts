export function createClientUuid(): string {
  const randomHex = (length: number) =>
    Array.from({ length }, () => Math.floor(Math.random() * 16).toString(16)).join("");

  return [
    randomHex(8),
    randomHex(4),
    `4${randomHex(3)}`,
    `${(8 + Math.floor(Math.random() * 4)).toString(16)}${randomHex(3)}`,
    randomHex(12),
  ].join("-");
}
