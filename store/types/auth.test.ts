import { outranks } from './auth';

describe('outranks', () => {
  it('lets a user manage only roles strictly below their own', () => {
    expect(outranks('ADMIN', 'PARENT')).toBe(true);
    expect(outranks('ADMIN', 'EMPLOYEE')).toBe(true);
    expect(outranks('ADMIN', 'ADMIN')).toBe(false);
    expect(outranks('ADMIN', 'DIRECTOR')).toBe(false);
    expect(outranks('DIRECTOR', 'ADMIN')).toBe(true);
    expect(outranks('EMPLOYEE', 'PARENT')).toBe(true);
    expect(outranks('PARENT', null)).toBe(false);
  });
});
