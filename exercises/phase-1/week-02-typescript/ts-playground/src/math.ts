export function add(a: number, b: number): number {
  return a + b;
}

export function multiply(a: number, b: number = 1): number {
  return a * b;
}

export function subtract(a: number, b: number): number {
  return a - b;
}

export function divide(a: number, b: number): number {
  if (b === 0)  throw new Error('Cannot divide');

  return a / b;
}

export function mod(a: number, b: number): number {
  if (b === 0)  throw new Error('Cannot modulus');

  return a % b;
}
