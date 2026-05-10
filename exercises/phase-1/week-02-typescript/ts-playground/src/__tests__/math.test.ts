import { describe, it, expect } from 'vitest';
import {add, divide, mod, multiply, subtract} from "../math";

describe('math', () => {
  it('adds two numbers', () => {
    expect(add(2, 3)).toBe(5);
  });

  it('subtracts two numbers', () => {
    expect(subtract(5, 3)).toBe(2);
  });

  it('multiplies, defaulting second arg to 1', () => {
    expect(multiply(7)).toBe(7);
    expect(multiply(7, 3)).toBe(21);
  });

  it('divides two numbers', () => {
    expect(divide(6, 3)).toBe(2);
    expect(() => divide(1, 0)).toThrow();
  });

  it('modulus two numbers', () => {
    expect(mod(5, 2)).toBe(1);
    expect(() => mod(1, 0)).toThrow();
  })
});
