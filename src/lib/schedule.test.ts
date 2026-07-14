import {
  ONTIME_BAND_MIN,
  formatClockTime,
  formatMeetTime,
  resolveMeetTime,
  splitClock,
  punctuality,
  slackLabel,
  slackMin,
  untilLabel,
} from './schedule';

/** a fixed local wall-clock instant so these never depend on when they run */
const at = (h: number, m = 0, day = 14) => new Date(2026, 6, day, h, m, 0, 0).getTime();
const SEVEN_PM = at(19);


describe('slackMin — the number the app exists to show', () => {
  it('is positive when you will beat the meeting', () => {
    // 6:30, meeting at 7:00, you are 20 min out → 10 min early
    expect(slackMin(20, SEVEN_PM, at(18, 30))).toBeCloseTo(10, 5);
  });

  it('is negative when you will not', () => {
    // 6:30, meeting at 7:00, you are 45 min out → 15 min late
    expect(slackMin(45, SEVEN_PM, at(18, 30))).toBeCloseTo(-15, 5);
  });

  it('has no answer without a meeting time — and no answer is not "on time"', () => {
    expect(slackMin(12, null, at(18, 30))).toBeNull();
  });

  it('has no answer without an ETA (free roam: there is nowhere to be)', () => {
    expect(slackMin(null, SEVEN_PM, at(18, 30))).toBeNull();
  });

  it('keeps counting down while you stand still — lateness accrues by itself', () => {
    const stuck = 20; // not moving, ETA frozen
    const early = slackMin(stuck, SEVEN_PM, at(18, 30))!;
    const later = slackMin(stuck, SEVEN_PM, at(18, 50))!;
    expect(later).toBeLessThan(early);
    expect(punctuality(early)).toBe('early');
    expect(punctuality(later)).toBe('late');
  });
});

describe('punctuality', () => {
  it('does not cry wolf over ninety seconds', () => {
    expect(punctuality(-1.5)).toBe('ontime');
    expect(punctuality(1.5)).toBe('ontime');
    expect(punctuality(0)).toBe('ontime');
  });
  it('calls it past the band', () => {
    expect(punctuality(-(ONTIME_BAND_MIN + 0.1))).toBe('late');
    expect(punctuality(ONTIME_BAND_MIN + 0.1)).toBe('early');
  });
});

describe('slackLabel', () => {
  it('says the thing that makes you text the group', () => {
    expect(slackLabel(-8)).toBe('8 min late');
    expect(slackLabel(4)).toBe('4 min early');
    expect(slackLabel(0)).toBe('on time');
  });
  it('goes compact for map tags and rail chips', () => {
    expect(slackLabel(-8, true)).toBe('8 late');
    expect(slackLabel(4, true)).toBe('4 early');
  });
  it('switches to hours rather than printing "94 min late"', () => {
    expect(slackLabel(-94)).toBe('1.6 hr late');
    expect(slackLabel(-94, true)).toBe('1.6h late');
  });
  it('never says "0 min late" — that is on time, or it is a minute', () => {
    expect(slackLabel(-2.4)).toBe('2 min late');
    expect(slackLabel(-2.01)).toBe('2 min late');
  });
});

describe('formatClockTime / formatMeetTime', () => {
  it('reads like a clock, not an ISO string', () => {
    expect(formatClockTime(at(19, 0))).toBe('7:00 PM');
    expect(formatClockTime(at(9, 5))).toBe('9:05 AM');
  });
  it('handles the two times a 12-hour clock gets wrong', () => {
    expect(formatClockTime(at(0, 30))).toBe('12:30 AM'); // midnight is 12, not 0
    expect(formatClockTime(at(12, 0))).toBe('12:00 PM'); // noon is PM
  });
  it('says "tomorrow" when the session straddles midnight', () => {
    // 11pm now, meeting at 1am — "1:00 AM" alone would be a lie by 22 hours
    expect(formatMeetTime(at(1, 0, 15), at(23, 0, 14))).toBe('1:00 AM tomorrow');
  });
  it('stays quiet when the meeting is today', () => {
    expect(formatMeetTime(at(19, 0), at(18, 0))).toBe('7:00 PM');
  });
});

describe('untilLabel', () => {
  it('counts down', () => {
    expect(untilLabel(at(19, 0), at(18, 35))).toBe('in 25 min');
    expect(untilLabel(at(19, 0), at(17, 50))).toBe('in 1h 10m');
    expect(untilLabel(at(19, 0), at(18, 0))).toBe('in 1h');
  });
  it('stops at now rather than counting up into the past', () => {
    expect(untilLabel(at(19, 0), at(19, 30))).toBe('now');
  });
});

describe('splitClock — what a person types', () => {
  it('breaks a time into hour, minute, meridiem', () => {
    expect(splitClock(at(19, 30))).toEqual({ hour12: 7, minute: 30, pm: true });
    expect(splitClock(at(9, 5))).toEqual({ hour12: 9, minute: 5, pm: false });
  });
  it('gets midnight and noon right, where a 12-hour clock usually breaks', () => {
    expect(splitClock(at(0, 15))).toEqual({ hour12: 12, minute: 15, pm: false });
    expect(splitClock(at(12, 15))).toEqual({ hour12: 12, minute: 15, pm: true });
  });
});

describe('resolveMeetTime — the instant someone MEANS when they type a time', () => {
  it('resolves a time later today', () => {
    expect(resolveMeetTime(7, 30, true, at(18, 0))).toBe(at(19, 30));
  });

  it('rolls a time that has already gone by into TOMORROW', () => {
    // 11pm, typing "1:00 AM". A naive setHours puts the meeting 22 hours in the
    // PAST — where it's unreachable and every member reads as infinitely late.
    const meet = resolveMeetTime(1, 0, false, at(23, 0, 14));
    expect(meet).toBe(at(1, 0, 15)); // the 15th, not the 14th
    expect(meet).toBeGreaterThan(at(23, 0, 14));
  });

  it('never resolves into the past, whatever you type', () => {
    const now = at(14, 30);
    for (let h = 1; h <= 12; h++) {
      for (const pm of [false, true]) {
        expect(resolveMeetTime(h, 0, pm, now)).toBeGreaterThan(now);
      }
    }
  });

  it('clamps a fat-fingered digit instead of producing a nonsense meeting', () => {
    expect(formatClockTime(resolveMeetTime(13, 0, true, at(1, 0)))).toBe('12:00 PM');
    expect(formatClockTime(resolveMeetTime(7, 75, true, at(1, 0)))).toBe('7:59 PM');
    expect(formatClockTime(resolveMeetTime(0, 0, false, at(1, 0)))).toBe('12:00 AM');
  });

  it('round-trips with splitClock', () => {
    const meet = resolveMeetTime(8, 45, true, at(12, 0));
    expect(splitClock(meet)).toEqual({ hour12: 8, minute: 45, pm: true });
  });
});
