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

const src = (f: string) => readFileSync(join(DIR, f), 'utf8');
const tsx = readdirSync(DIR).filter((f) => f.endsWith('.tsx'));

/** owns a `<Modal>`, so it owns a backdrop and can get the order wrong */
const overlays = tsx.filter((f) => src(f).includes('<Modal'));
/** anything a user can DISMISS — including the cards that borrow AnchoredCard's
 *  backdrop rather than rendering their own. Coverage is about what a thumb can
 *  touch, not about which file happens to contain the word "Modal". */
const dismissible = tsx.filter((f) => src(f).includes('<Modal') || src(f).includes('AnchoredCard'));

/** strip comments — this file's own rule is quoted in most of them */
const code = (s: string) =>
  s
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, '')
    .replace(/^\s*\/\/.*$/gm, '');

describe('sheet contract: a tappable panel is never under its own backdrop', () => {
  it('still covers every dismissible surface (a refactor must not empty this suite)', () => {
    // Deliberately counts DISMISSIBLE, not <Modal>. Moving the sheets onto a
    // shared AnchoredCard is exactly the kind of change that would have shrunk a
    // <Modal>-based count while leaving coverage intact — and a guard that cries
    // wolf at a healthy refactor is a guard people delete.
    expect(dismissible.length).toBeGreaterThanOrEqual(5);
    expect(overlays.length).toBeGreaterThanOrEqual(1);
  });

  it.each(overlays)('%s renders its backdrop BEFORE the panel', (file) => {
    const body = code(src(file));

    const backdrop = body.indexOf('styles.backdrop');
    if (backdrop === -1) return; // delegates its backdrop to AnchoredCard

    // the panel is whatever the overlay actually draws: a Glass card, or the
    // animated wrapper holding one
    const panel = Math.min(
      ...[body.indexOf('<Glass'), body.indexOf('<Animated.View')].filter((i) => i > -1)
    );
    expect(panel).toBeGreaterThan(-1);

    // If this fails: move <Pressable style={styles.backdrop} …/> above the panel.
    // The sheet will look identical and start working.
    expect(backdrop).toBeLessThan(panel);
  });

  it.each(overlays)('%s gives its backdrop the whole modal to catch taps in', (file) => {
    if (!src(file).includes('styles.backdrop')) return;
    expect(src(file)).toMatch(/backdrop:\s*\{\s*flex:\s*1/);
  });

  it.each(dismissible)('%s HAS a backdrop — its own, or AnchoredCard’s', (file) => {
    const own = src(file).includes('styles.backdrop');
    const borrowed = src(file).includes('AnchoredCard');
    expect(own || borrowed).toBe(true); // otherwise there is no way to dismiss it
  });
});
