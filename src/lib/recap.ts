/** The numbers a completed session earned — shared by the dock recap, the
 *  archive view, and the shareable card. Pure, so it's tested once. */

interface RecapMember {
  id: string;
  name: string;
  isYou?: boolean;
  steps: number;
  traveledM: number;
}

export interface RecapStats {
  groupSteps: number;
  youTraveledM: number | null;
  firstName: string | null;
  lastName: string | null;
}

export function recapStats(members: RecapMember[], arrivalOrder: string[]): RecapStats {
  const byId = new Map(members.map((m) => [m.id, m]));
  const first = byId.get(arrivalOrder[0]) ?? null;
  const last = byId.get(arrivalOrder[arrivalOrder.length - 1]) ?? null;
  const you = members.find((m) => m.isYou || m.id === 'you') ?? null;
  return {
    groupSteps: members.reduce((s, m) => s + m.steps, 0),
    youTraveledM: you ? you.traveledM : null,
    firstName: first ? first.name : null,
    lastName: last && last !== first ? last.name : null,
  };
}
