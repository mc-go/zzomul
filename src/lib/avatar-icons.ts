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

// 실제 색은 index.css의 --av-{key}-bg/fg 변수 (테마별로 다름 — 모노 테마는 회색 단계로 구분)
const avatarColor = (key: string): AvatarColor => ({
  key,
  bg: `var(--av-${key}-bg)`,
  fg: `var(--av-${key}-fg)`,
});

export const AVATAR_COLORS: AvatarColor[] = [
  avatarColor('slate'),
  avatarColor('gray'),
  avatarColor('amber'),
  avatarColor('orange'),
  avatarColor('rose'),
  avatarColor('pink'),
  avatarColor('purple'),
  avatarColor('blue'),
  avatarColor('sky'),
  avatarColor('teal'),
  avatarColor('green'),
  avatarColor('lime'),
];

export const DEFAULT_COLOR_KEY = 'slate';

export function getAvatarColor(key: string | null | undefined): AvatarColor {
  return AVATAR_COLORS.find((c) => c.key === key) ?? AVATAR_COLORS[0];
}
