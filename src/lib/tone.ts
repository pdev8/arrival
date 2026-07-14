import { UI } from './colors';
import { HeadlineTone } from './format';

/**
 * A headline's MEANING (lib/format decides that) → the colour it wears.
 *
 * Identity keeps the member's own colour, because that is what tells you whose
 * number you're reading. Only a real problem takes it away — being late is the
 * one thing worth interrupting identity for.
 */
export function toneColor(tone: HeadlineTone, memberColor: string): string {
  switch (tone) {
    case 'muted':
      return UI.textDim;
    case 'good':
      return UI.success;
    case 'bad':
      return UI.danger;
    default:
      return memberColor;
  }
}
