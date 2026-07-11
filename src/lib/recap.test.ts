import { recapStats } from './recap';

const m = (id: string, steps: number, traveledM: number, isYou = false) => ({
  id,
  name: id[0].toUpperCase() + id.slice(1),
  isYou,
  steps,
  traveledM,
});

describe('recapStats', () => {
  const members = [m('you', 1200, 900, true), m('sarah', 800, 600), m('mike', 0, 5000)];

  it('sums group steps and finds your distance', () => {
    const s = recapStats(members, ['sarah', 'you', 'mike']);
    expect(s.groupSteps).toBe(2000);
    expect(s.youTraveledM).toBe(900);
  });

  it('names first and last arrivals', () => {
    const s = recapStats(members, ['sarah', 'you', 'mike']);
    expect(s.firstName).toBe('Sarah');
    expect(s.lastName).toBe('Mike');
  });

  it('drops last when only one member arrived', () => {
    const s = recapStats(members, ['sarah']);
    expect(s.firstName).toBe('Sarah');
    expect(s.lastName).toBeNull();
  });

  it('handles empty arrival order and missing you', () => {
    const s = recapStats([m('sarah', 100, 80)], []);
    expect(s.firstName).toBeNull();
    expect(s.youTraveledM).toBeNull();
    expect(s.groupSteps).toBe(100);
  });
});
