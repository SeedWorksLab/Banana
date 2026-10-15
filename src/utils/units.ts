import type { Unit } from '../models';

export type UnitDimension = 'mass' | 'volume' | 'count';

const MASS_TO_BASE: Record<string, number> = { g: 1, kg: 1000 };
const VOLUME_TO_BASE: Record<string, number> = { ml: 1, l: 1000 };

export function unitDimension(unit: Unit): UnitDimension {
  if (unit in MASS_TO_BASE) return 'mass';
  if (unit in VOLUME_TO_BASE) return 'volume';
  return 'count';
}

export function baseUnit(unit: Unit): Unit {
  const dimension = unitDimension(unit);
  if (dimension === 'mass') return 'g';
  if (dimension === 'volume') return 'ml';
  return unit;
}

export function toBase(quantity: number, unit: Unit): number | null {
  const factor = MASS_TO_BASE[unit] ?? VOLUME_TO_BASE[unit];
  return factor === undefined ? null : quantity * factor;
}

export function fromBase(baseQuantity: number, unit: Unit): number | null {
  const factor = MASS_TO_BASE[unit] ?? VOLUME_TO_BASE[unit];
  return factor === undefined ? null : baseQuantity / factor;
}

export function canMerge(a: Unit, b: Unit): boolean {
  if (a === b) return true;
  return unitDimension(a) === unitDimension(b) && unitDimension(a) !== 'count';
}

export function convert(quantity: number, fromUnit: Unit, toUnit: Unit): number | null {
  if (fromUnit === toUnit) return quantity;
  const base = toBase(quantity, fromUnit);
  if (base === null) return null;
  return fromBase(base, toUnit);
}
