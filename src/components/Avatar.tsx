import { getAvatarColor, getAvatarIcon } from '../lib/avatar-icons';
import type { Profile } from '../lib/profiles';

type Size = 'xs' | 'sm' | 'md' | 'lg' | 'xl';

const SIZE_MAP: Record<Size, { box: string; icon: string }> = {
  xs: { box: 'w-5 h-5 text-[10px]', icon: 'text-[11px]' },
  sm: { box: 'w-7 h-7 text-xs', icon: 'text-sm' },
  md: { box: 'w-9 h-9 text-sm', icon: 'text-lg' },
  lg: { box: 'w-14 h-14 text-lg', icon: 'text-2xl' },
  xl: { box: 'w-20 h-20 text-2xl', icon: 'text-3xl' },
};

type Props = {
  profile?: Profile | null;
  size?: Size;
  fallbackText?: string;
  className?: string;
};

export default function Avatar({ profile, size = 'md', fallbackText, className = '' }: Props) {
  const sz = SIZE_MAP[size];
  const color = getAvatarColor(profile?.colorKey);

  if (profile?.photo) {
    // 사진은 투명 배경 유지 — 알파 있는 PNG의 뒷부분이 그대로 비치도록
    return (
      <img
        src={profile.photo}
        alt=""
        className={`${sz.box} rounded-full object-cover shrink-0 bg-transparent ${className}`}
      />
    );
  }

  if (profile) {
    const Icon = getAvatarIcon(profile.iconKey);
    return (
      <span
        className={`${sz.box} rounded-full inline-flex items-center justify-center shrink-0 ${className}`}
        style={{ backgroundColor: color.bg, color: color.fg }}
      >
        <Icon className={sz.icon} />
      </span>
    );
  }

  return (
    <span
      className={`${sz.box} rounded-full inline-flex items-center justify-center bg-ink-100 text-ink-500 shrink-0 ${className}`}
    >
      {fallbackText ? fallbackText.charAt(0) : ''}
    </span>
  );
}
