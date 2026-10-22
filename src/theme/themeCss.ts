import type { ThemeColors } from '../config/types.ts';

const tokenNames: Record<keyof ThemeColors, string> = {
  background: '--c-bg',
  surface: '--c-surface',
  amethyst: '--c-amethyst',
  rose: '--c-rose',
  gold: '--c-gold',
  ivory: '--c-ivory',
};

/**
 * Serialises theme colours into CSS custom properties. The doubled `:root`
 * selector outranks the defaults in tokens.css regardless of stylesheet order.
 */
export function themeToCss(theme: ThemeColors): string {
  const declarations = (Object.keys(tokenNames) as (keyof ThemeColors)[])
    .map((key) => `${tokenNames[key]}:${theme[key]}`)
    .join(';');
  return `:root:root{${declarations}}`;
}
