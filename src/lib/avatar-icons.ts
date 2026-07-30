import {
  LuUser,
  LuCat,
  LuDog,
  LuRabbit,
  LuBird,
  LuFish,
  LuTurtle,
  LuSquirrel,
  LuGhost,
  LuStar,
  LuHeart,
  LuFlame,
  LuLeaf,
  LuFlower,
  LuSparkles,
  LuGem,
  LuMoon,
  LuSun,
  LuCloud,
  LuCoffee,
  LuIceCreamCone,
  LuCookie,
  LuTreePine,
} from 'react-icons/lu';
import { GiPretzel } from 'react-icons/gi';
import type { IconType } from 'react-icons';

export const AVATAR_ICONS: Record<string, IconType> = {
  user: LuUser,
  cat: LuCat,
  dog: LuDog,
  rabbit: LuRabbit,
  bird: LuBird,
  fish: LuFish,
  turtle: LuTurtle,
  squirrel: LuSquirrel,
  ghost: LuGhost,
  star: LuStar,
  heart: LuHeart,
  flame: LuFlame,
  leaf: LuLeaf,
  flower: LuFlower,
  sparkles: LuSparkles,
  gem: LuGem,
  moon: LuMoon,
  sun: LuSun,
  cloud: LuCloud,
  coffee: LuCoffee,
  icecream: LuIceCreamCone,
  cookie: LuCookie,
  tree: LuTreePine,
  pretzel: GiPretzel,
};

export const AVATAR_ICON_KEYS = Object.keys(AVATAR_ICONS);

export const DEFAULT_ICON_KEY = 'user';

export function getAvatarIcon(key: string | null | undefined): IconType {
  return AVATAR_ICONS[key ?? ''] ?? AVATAR_ICONS[DEFAULT_ICON_KEY];
}

export type AvatarColor = { key: string; bg: string; fg: string };

export const AVATAR_COLORS: AvatarColor[] = [
  { key: 'slate', bg: '#e2e8f0', fg: '#334155' },
  { key: 'gray', bg: '#e5e7eb', fg: '#374151' },
  { key: 'amber', bg: '#fef3c7', fg: '#92400e' },
  { key: 'orange', bg: '#ffedd5', fg: '#9a3412' },
  { key: 'rose', bg: '#ffe4e6', fg: '#9f1239' },
  { key: 'pink', bg: '#fce7f3', fg: '#9d174d' },
  { key: 'purple', bg: '#ede9fe', fg: '#5b21b6' },
  { key: 'blue', bg: '#dbeafe', fg: '#1e40af' },
  { key: 'sky', bg: '#e0f2fe', fg: '#075985' },
  { key: 'teal', bg: '#ccfbf1', fg: '#115e59' },
  { key: 'green', bg: '#d1fae5', fg: '#065f46' },
  { key: 'lime', bg: '#ecfccb', fg: '#3f6212' },
];

export const DEFAULT_COLOR_KEY = 'slate';

export function getAvatarColor(key: string | null | undefined): AvatarColor {
  return AVATAR_COLORS.find((c) => c.key === key) ?? AVATAR_COLORS[0];
}
