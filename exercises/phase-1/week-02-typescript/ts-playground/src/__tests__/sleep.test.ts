import {describe, it, expect, test} from 'vitest';
import {fetchGreeting, fetchGreetings} from '../sleep';

describe('fetchGreeting', () => {
  it('returns the greeting after a delay', async () => {
    await expect(fetchGreeting('Marcin')).resolves.toBe('Hello, Marcin!');
  });

  it('rejects on empty name', async () => {
    await expect(fetchGreeting('')).rejects.toThrow('name required');
  });

  test.each([
    {
      label: 'many users',
      names: ['Marek', 'Max'],
      expected: ['Hello, Marek!', 'Hello, Max!'],
    },
    {
      label: 'one user',
      names: ['Marek'],
      expected: ['Hello, Marek!'],
    },
    {
      label: 'no users',
      names: [],
      expected: [],
    },
  ])('returns the greeting names after a delay', async ({ names, expected }) => {
    await expect(fetchGreetings(names)).resolves.toEqual(expected);
  })
});
