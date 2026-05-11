export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function fetchGreeting(name: string): Promise<string> {
  await sleep(10);
  if (!name) throw new Error('name required');
  return `Hello, ${name}!`;
}

export async function fetchGreetings(names: string[]): Promise<string[]> {
  return Promise.all(names.map<Promise<string>>((name: string) => fetchGreeting(name)))
}
