import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';

/**
 * THE BACKDROP GOES FIRST.
 *
 * Every overlay in this app is a transparent `<Modal>` holding two things: a
 * full-screen `<Pressable style={{flex:1}}>` that closes it, and the panel
 * itself. Render the backdrop AFTER the panel and it sits on top of it — and
 * because it's transparent, everything still LOOKS right. The panel is visible,
 * beautifully animated, and completely dead: every tap on it lands on the
 * backdrop and closes the sheet.
 *
 * That is not hypothetical. DestinationSheet shipped this way and destination
 * search was inert for an entire release, because the PR was merged without a
 * device pass — and a broken sheet is indistinguishable from a working one until
 * a thumb touches it. MeetTimeSheet then inherited the same mistake.
 *
 * A screenshot can't catch this. A type can't catch this. This can.
 *
 * We scan by CONTENT (does the file render a <Modal>?), never by filename. The
 * first version of this test globbed `*Sheet.tsx`, and when the two guilty
 * components were refactored to share an AnchoredCard, the rule silently stopped
 * being enforced on the exact files it existed for.
 */

const DIR = join(__dirname, 'components');

const overlays = readdirSync(DIR)
  .filter((f) => f.endsWith('.tsx'))
  .filter((f) => readFileSync(join(DIR, f), 'utf8').includes('<Modal'));

/** strip comments — this file's own rule is quoted in most of them */
const code = (s: string) =>
  s
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, '')
    .replace(/^\s*\/\/.*$/gm, '');

describe('sheet contract: a tappable panel is never under its own backdrop', () => {
  it('finds the overlays (a refactor must not silently empty this suite)', () => {
    expect(overlays.length).toBeGreaterThanOrEqual(4);
    // the two that shipped the bug must be in scope, however they're built today
    const src = overlays.map((f) => readFileSync(join(DIR, f), 'utf8')).join('\n');
    expect(src).toMatch(/backdrop/);
  });

  it.each(overlays)('%s renders its backdrop BEFORE the panel', (file) => {
    const src = code(readFileSync(join(DIR, file), 'utf8'));

    const backdrop = src.indexOf('styles.backdrop');
    if (backdrop === -1) return; // delegates its backdrop to AnchoredCard

    // the panel is whatever the overlay actually draws: a Glass card, or the
    // animated wrapper holding one
    const panel = Math.min(
      ...[src.indexOf('<Glass'), src.indexOf('<Animated.View')].filter((i) => i > -1)
    );
    expect(panel).toBeGreaterThan(-1);

    // If this fails: move <Pressable style={styles.backdrop} …/> above the panel.
    // The sheet will look identical and start working.
    expect(backdrop).toBeLessThan(panel);
  });

  it.each(overlays)('%s gives its backdrop the whole modal to catch taps in', (file) => {
    const src = readFileSync(join(DIR, file), 'utf8');
    if (!src.includes('styles.backdrop')) return;
    expect(src).toMatch(/backdrop:\s*\{\s*flex:\s*1/);
  });

  it('every overlay HAS a backdrop — its own, or AnchoredCard’s', () => {
    for (const file of overlays) {
      const src = readFileSync(join(DIR, file), 'utf8');
      const own = src.includes('styles.backdrop');
      const borrowed = src.includes('AnchoredCard');
      expect(own || borrowed).toBe(true); // otherwise there's no way to dismiss it
    }
  });
});
