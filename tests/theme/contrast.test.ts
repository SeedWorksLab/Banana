import { lightColors, darkColors } from '../../src/theme/tokens/colors';
import { chartPaletteLight, chartPaletteDark } from '../../src/theme/tokens/chart';

function luminance(hex: string): number {
  const [red, green, blue] = [1, 3, 5].map((index) => {
    const value = parseInt(hex.slice(index, index + 2), 16) / 255;
    return value <= 0.04045 ? value / 12.92 : Math.pow((value + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
}
function ratio(a: string, b: string): number {
  const values = [luminance(a), luminance(b)];
  return (Math.max(...values) + 0.05) / (Math.min(...values) + 0.05);
}

it.each([
  { scheme: 'light', tokens: lightColors, palette: chartPaletteLight },
  { scheme: 'dark', tokens: darkColors, palette: chartPaletteDark },
])('$scheme documented theme pairs retain WCAG AA contrast', ({ tokens, palette }) => {
  for (const text of ['primary', 'secondary', 'tertiary'] as const) {
    expect(ratio(tokens.text[text], tokens.surfaces.surface)).toBeGreaterThanOrEqual(4.5);
  }
  for (const name of ['primary', 'secondary', 'water', 'warm'] as const) {
    for (const surface of ['surface', 'background', 'surfaceSecondary'] as const) {
      expect(ratio(tokens[name].base, tokens.surfaces[surface])).toBeGreaterThanOrEqual(4.5);
    }
    expect(ratio(tokens.text.onAccent, tokens[name].base)).toBeGreaterThanOrEqual(4.5);
    expect(ratio(tokens[name].base, tokens[name].light)).toBeGreaterThanOrEqual(3);
  }
  for (const name of ['success', 'warning', 'error', 'info'] as const) {
    expect(ratio(tokens.semantic[name], tokens.surfaces.surface)).toBeGreaterThanOrEqual(4.5);
  }
  for (const color of palette) expect(ratio(color, tokens.surfaces.surface)).toBeGreaterThanOrEqual(3);
});
