import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { StopCategory } from '../demo/data';

type MciName = keyof typeof MaterialCommunityIcons.glyphMap;

export const CATEGORY_ICON: Record<StopCategory, MciName> = {
  gas: 'gas-station',
  coffee: 'coffee',
  food: 'silverware-fork-knife',
  restroom: 'human-male-female',
  scenic: 'camera-outline',
  other: 'map-marker',
};

export const CATEGORY_LABEL: Record<StopCategory, string> = {
  gas: 'Gas',
  coffee: 'Coffee',
  food: 'Food',
  restroom: 'Restroom',
  scenic: 'Scenic',
  other: 'Other',
};

export const STATE_ICON: Record<'driving' | 'walking' | 'stopped' | 'arrived', MciName> = {
  driving: 'car',
  walking: 'walk',
  stopped: 'pause',
  arrived: 'flag-checkered',
};
