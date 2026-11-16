import { convert } from '../../src/utils/units';

it('converts compatible weight and volume without crossing dimensions', () => {
  expect(convert(0.5, 'kg', 'g')).toBe(500);
  expect(convert(500, 'ml', 'l')).toBe(0.5);
  expect(convert(500, 'g', 'ml')).toBeNull();
  expect(convert(0.5, 'l', 'kg')).toBeNull();
  expect(convert(1, 'pack', 'piece')).toBeNull();
  expect(convert(2, 'piece', 'piece')).toBe(2);
});
