/**
 * Line drawings for the six topics. Every stroke has pathLength=1 so CSS can
 * draw it in on hover with one dash rule, whatever its real length.
 */
const GLYPHS: string[][] = [
  // Racing thoughts: a loose knot of thread
  ['M14 46c10-26 40-30 46-12s-22 26-28 10 18-30 34-18 6 30-10 30', 'M62 56c8 2 14-2 18-8'],
  // Close people: two circles that overlap
  ['M44 36a18 18 0 1 1-36 0a18 18 0 1 1 36 0', 'M72 36a18 18 0 1 1-36 0a18 18 0 1 1 36 0'],
  // Being enough: a hand mirror with a small spark
  ['M40 12a17 22 0 1 1 0 44a17 22 0 1 1 0-44', 'M40 56v12', 'M64 14v10M59 19h10'],
  // No strength left: the sun low on the horizon
  ['M8 52h72', 'M22 52a18 18 0 0 1 36 0', 'M40 24v-8M20 32l-5-5M60 32l5-5'],
  // Change: water moving in waves
  ['M6 30c8-8 16-8 24 0s16 8 24 0 16-8 24 0', 'M6 44c8-8 16-8 24 0s16 8 24 0 16-8 24 0', 'M6 58c8-8 16-8 24 0s16 8 24 0 16-8 24 0'],
  // Another way: a path that turns towards a star
  ['M8 62c20 0 18-28 36-28s18-16 30-16', 'M66 12l8 6-8 6', 'M18 22v8M14 26h8'],
];

export function TopicGlyph({ index }: { index: number }) {
  const paths = GLYPHS[index % GLYPHS.length];
  return <svg className="glyph" viewBox="0 0 84 72" fill="none" stroke="currentColor" aria-hidden="true">
    {paths.map((d, i) => <path key={i} d={d} pathLength={1} style={{ animationDelay: `${i * 120}ms` }} />)}
  </svg>;
}
