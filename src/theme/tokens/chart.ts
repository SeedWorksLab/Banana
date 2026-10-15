export const chartPaletteLight: readonly string[] = [
  '#8C5A12',
  '#A8323A',
  '#4F7A34',
  '#2C6A66',
  '#3A5A8C',
  '#6B3A7A',
  '#9C3B5A',
  '#5C4620',
];

export const chartPaletteDark: readonly string[] = [
  '#E0B25C',
  '#EE8E8E',
  '#9CCB6B',
  '#6FD0BE',
  '#85A8F0',
  '#C79AE8',
  '#F08CB4',
  '#C9A87E',
];

export type ChartColor =
  | (typeof chartPaletteLight)[number]
  | (typeof chartPaletteDark)[number];
