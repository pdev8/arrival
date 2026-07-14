import { UI } from './colors';
import { HeadlineTone } from './format';

/**
 * A headline's MEANING (lib/format decides that) → the colour it wears.
 *
 * Identity keeps the member's own colour, because that is what tells you whose
 * number you're reading. Nothing currently takes it away except arriving and
 * leaving — both facts about the member, not judgements about them.
 */
export function toneColor(tone: HeadlineTone, memberColor: string): string {
  switch (tone) {
    case 'muted':
      return UI.textDim;
    case 'good':
      return UI.success;
    default:
      return memberColor;
  }
}
