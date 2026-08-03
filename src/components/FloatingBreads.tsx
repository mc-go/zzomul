import type { ComponentType, CSSProperties, SVGProps } from 'react';
import { LuCroissant, LuCookie } from 'react-icons/lu';

// 배경에 구름처럼 흘러가는 선 드로잉 음식들.
// Tabler/Lucide 아이콘의 원본 패스를 그대로 쓰되, 가는 선(1.3)으로 디테일을 얹은 커스텀 버전.
// 버블티·햄버거·도넛·만두는 64 그리드 자체 제작(선 굵기를 세트에 맞춤).
// 좌측 화면 밖 → 우측 화면 밖으로 이동(animate-cloud)하며, 위아래로 통통(animate-bob).
// 음수 delay = 애니메이션 중간부터 시작이라 처음부터 화면 곳곳에 퍼져 있음.

type BreadProps = SVGProps<SVGSVGElement>;

// 24 그리드(라이브러리 패스용): 외곽 2 + 디테일 1.3
function libSvgProps(props: BreadProps): BreadProps {
  return {
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 2,
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
    ...props,
  };
}

// 64 그리드(자체 제작용): 외곽 5.3(=2×64/24) + 디테일 3.5
function customSvgProps(props: BreadProps): BreadProps {
  return {
    viewBox: '0 0 64 64',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 5.3,
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
    ...props,
  };
}

function Dot({ cx, cy, r = 2.2 }: { cx: number; cy: number; r?: number }) {
  return <circle cx={cx} cy={cy} r={r} fill="currentColor" stroke="none" />;
}

// ── 24 그리드: 라이브러리 원형 + 디테일 ──

// 🍞 식빵 (Tabler Bread 원본 + 참깨 점 + 버터 조각)
function BreadIcon(props: BreadProps) {
  return (
    <svg {...libSvgProps(props)}>
      <path d="M18 4a3 3 0 0 1 2 5.235v8.765a2 2 0 0 1 -2 2h-12a2 2 0 0 1 -2 -2v-8.764a3 3 0 0 1 1.824 -5.231h12.176v-.005" />
      <path d="M9 9.5v.01M13 8.5v.01M16 10.5v.01" />
      <rect x="9" y="12.2" width="5.2" height="3.8" rx="0.9" strokeWidth={1.5} />
    </svg>
  );
}

// 🥖 바게트 (Tabler Baguette + 참깨)
function BaguetteIcon(props: BreadProps) {
  return (
    <svg {...libSvgProps(props)}>
      <path d="M5.628 11.283l5.644 -5.637c2.665 -2.663 5.924 -3.747 8.663 -1.205l.188 .181a2.987 2.987 0 0 1 0 4.228l-11.287 11.274a3 3 0 0 1 -4.089 .135l-.143 -.135c-2.728 -2.724 -1.704 -6.117 1.024 -8.841" />
      <path d="M9.5 7.5l1.5 3.5M6.5 10.5l1.5 3.5M12.5 4.5l1.5 3.5" />
      <Dot cx={14.8} cy={9.8} r={0.55} />
      <Dot cx={11.8} cy={12.8} r={0.55} />
    </svg>
  );
}

// 🎂 케이크 (Tabler Cake + 딸기 필링)
function CakeIcon(props: BreadProps) {
  return (
    <svg {...libSvgProps(props)}>
      <path d="M3 20h18v-8a3 3 0 0 0 -3 -3h-12a3 3 0 0 0 -3 3v8" />
      <path d="M3 14.803c.312 .135 .654 .204 1 .197a2.4 2.4 0 0 0 2 -1a2.4 2.4 0 0 1 2 -1a2.4 2.4 0 0 1 2 1a2.4 2.4 0 0 0 2 1a2.4 2.4 0 0 0 2 -1a2.4 2.4 0 0 1 2 -1a2.4 2.4 0 0 1 2 1a2.4 2.4 0 0 0 2 1c.35 .007 .692 -.062 1 -.197" />
      <path d="M12 4l1.465 1.638a2 2 0 1 1 -3.015 .099l1.55 -1.737" />
      <Dot cx={7} cy={17.3} r={0.55} />
      <Dot cx={12} cy={17.3} r={0.55} />
      <Dot cx={17} cy={17.3} r={0.55} />
    </svg>
  );
}

// 🍜 라면 (Tabler BowlChopsticks + 무늬선/받침)
function RamenIcon(props: BreadProps) {
  return (
    <svg {...libSvgProps(props)}>
      <path d="M4 11h16a1 1 0 0 1 1 1v.5c0 1.5 -2.517 5.573 -4 6.5v1a1 1 0 0 1 -1 1h-8a1 1 0 0 1 -1 -1v-1c-1.687 -1.054 -4 -5 -4 -6.5v-.5a1 1 0 0 1 1 -1" />
      <path d="M19 7l-14 1M19 2l-14 3" />
      <path d="M6.5 14.5c3.7 1.3 7.3 1.3 11 0" strokeWidth={1.3} />
    </svg>
  );
}

// 🍳 계란후라이 (Tabler EggFried + 노른자 윤기)
function FriedEggIcon(props: BreadProps) {
  return (
    <svg {...libSvgProps(props)}>
      <path d="M9 12a3 3 0 1 0 6 0a3 3 0 1 0 -6 0" />
      <path d="M14 3a5 5 0 0 1 4.872 6.13a3 3 0 0 1 .178 5.681a3 3 0 1 1 -4.684 3.626a5 5 0 1 1 -8.662 -5a5 5 0 1 1 4.645 -8.856a4.982 4.982 0 0 1 3.651 -1.585l0 .004" />
      <Dot cx={10.9} cy={10.9} r={0.55} />
      <Dot cx={6.9} cy={9.2} r={0.45} />
      <Dot cx={15.6} cy={15.2} r={0.45} />
    </svg>
  );
}

// 🍎 사과 (Lucide Apple + 잎사귀)
function AppleIcon(props: BreadProps) {
  return (
    <svg {...libSvgProps(props)}>
      <path d="M12 20.94c1.5 0 2.75 1.06 4 1.06 3 0 6-8 6-12.22A4.91 4.91 0 0 0 17 5c-2.22 0-4 1.44-5 2-1-.56-2.78-2-5-2a4.9 4.9 0 0 0-5 4.78C2 14 5 22 8 22c1.25 0 2.5-1.06 4-1.06Z" />
      <path d="M10 2c1 .5 2 2 2 5" />
      <ellipse cx="14.6" cy="3.6" rx="2.3" ry="1.2" transform="rotate(-35 14.6 3.6)" strokeWidth={1.3} />
    </svg>
  );
}

// 🍕 피자 (Lucide Pizza — 원본 토핑 스타일에 맞춰 토핑 한 조각 추가)
function PizzaIcon(props: BreadProps) {
  return (
    <svg {...libSvgProps(props)}>
      <path d="m12 14-1 1M13.75 18.25l-1.25 1.42" />
      <path d="M17.775 5.654a15.68 15.68 0 0 0-12.121 12.12" />
      <path d="M18.8 9.3a1 1 0 0 0 2.1 7.7" />
      <path d="M21.964 20.732a1 1 0 0 1-1.232 1.232l-18-5a1 1 0 0 1-.695-1.232A19.68 19.68 0 0 1 15.732 2.037a1 1 0 0 1 1.232.695z" />
      <path d="m8.6 16.6-1 1" />
    </svg>
  );
}

// ☕ 커피 (Lucide Coffee + 라떼 하트)
function CoffeeIcon(props: BreadProps) {
  return (
    <svg {...libSvgProps(props)}>
      <path d="M10 2v2M14 2v2M6 2v2" />
      <path d="M16 8a1 1 0 0 1 1 1v8a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4V9a1 1 0 0 1 1-1h14a4 4 0 1 1 0 8h-1" />
      <path
        d="M10 12.9c-.6-.8-2-.3-2 .7 0 1 1.4 1.7 2 2.3.6-.6 2-1.3 2-2.3 0-1-1.4-1.5-2-.7Z"
        strokeWidth={1.3}
      />
    </svg>
  );
}

// 🍦 아이스크림 (Lucide IceCreamCone + 콘 격자/스프링클)
function IceCreamIcon(props: BreadProps) {
  return (
    <svg {...libSvgProps(props)}>
      <path d="m7 11 4.08 10.35a1 1 0 0 0 1.84 0L17 11" />
      <path d="M17 7A5 5 0 0 0 7 7" />
      <path d="M17 7a2 2 0 0 1 0 4H7a2 2 0 0 1 0-4" />
      <path d="M9.2 13.5l5 4.3M14.8 13.5l-5 4.3" strokeWidth={1.3} />
      <Dot cx={10.2} cy={4.6} r={0.55} />
      <Dot cx={13.6} cy={5.4} r={0.55} />
    </svg>
  );
}

// 🍰 조각케이크 (Lucide CakeSlice + 체리 + 딸기 필링)
function CakeSliceIcon(props: BreadProps) {
  return (
    <svg {...libSvgProps(props)}>
      <path d="M7.2 7.9 3 11v9c0 .6.4 1 1 1h16c.6 0 1-.4 1-1v-9c0-2-3-6-7-8l-3.6 2.6" />
      <path d="M16 13H3M16 17H3" />
      <circle cx="10.3" cy="3.9" r="1.3" strokeWidth={1.3} />
      <path d="M10.9 2.7q.5-1.2 1.7-1.6" strokeWidth={1.3} />
      <Dot cx={6} cy={15} r={0.55} />
      <Dot cx={10} cy={15} r={0.55} />
      <Dot cx={13.5} cy={15} r={0.55} />
    </svg>
  );
}

// ── 64 그리드: 자체 제작 ──

// 🧋 버블티: 돔 뚜껑 + 빨대 + 물결 음료선 + 펄
function DrinkIcon(props: BreadProps) {
  return (
    <svg {...customSvgProps(props)}>
      <path d="M20 18c1.5-4.5 6-7 12-7s10.5 2.5 12 7" />
      <path d="M18 18h28" />
      <path d="M37 18l4-14 6 2" strokeWidth={4} />
      <path d="M20 18l3 34c.3 3 2.7 5 5.7 5h6.6c3 0 5.4-2 5.7-5l3-34" />
      <path d="M23.5 32c3 1.6 6 1.6 8.7 0s5.7-1.6 8.5 0" strokeWidth={3.5} />
      <Dot cx={27} cy={47} />
      <Dot cx={33} cy={49.5} />
      <Dot cx={38} cy={46} />
    </svg>
  );
}

// 🍔 햄버거: 참깨 윗빵 + 양상추 물결 + 패티 + 아랫빵
function BurgerIcon(props: BreadProps) {
  return (
    <svg {...customSvgProps(props)}>
      <path d="M12 26c0-9 9-14 20-14s20 5 20 14H12Z" />
      <Dot cx={24} cy={18} r={1.8} />
      <Dot cx={32} cy={16} r={1.8} />
      <Dot cx={40} cy={18} r={1.8} />
      <path d="M12 30c3 2.5 6.5 2.5 9.5 0s6.5-2.5 9.5 0 6.5 2.5 9.5 0 6.5-2.5 9.5 0" strokeWidth={4} />
      <path d="M13.5 36.5h37" strokeWidth={4} />
      <path d="M13 42h38c0 4-3 7-7 7H20c-4 0-7-3-7-7Z" />
    </svg>
  );
}

// 🍩 도넛 (Lucide Donut 원본 — 한 입 베어문 링 + 점 스프링클)
function DonutIcon(props: BreadProps) {
  return (
    <svg {...libSvgProps(props)}>
      <path d="M20.5 10a2.5 2.5 0 0 1-2.4-3H18a2.95 2.95 0 0 1-2.6-4.4 10 10 0 1 0 6.3 7.1c-.3.2-.8.3-1.2.3" />
      <circle cx="12" cy="12" r="3" />
      <path d="M7.2 9v.01M6.2 14.2v.01M10 17.6v.01M15.5 16.5v.01M17.7 11.6v.01" />
    </svg>
  );
}

// 🥟 만두: 통통한 반달 + 부채꼴 주름 + 김
function DumplingIcon(props: BreadProps) {
  return (
    <svg {...customSvgProps(props)}>
      <path d="M8 41c0-13 10.5-21 24-21s24 8 24 21c0 2.8-2 4.5-4.5 4.5h-39C10 45.5 8 43.8 8 41Z" />
      <path d="M20 24l-4.5 7.5M28 21.5l-2.5 8.5M36 21.5l2.5 8.5M44 24l4.5 7.5" strokeWidth={3.5} />
      <path d="M26 12.5c-1.5-2.2 1.2-3.6 0-6.5M38 12.5c-1.5-2.2 1.2-3.6 0-6.5" strokeWidth={3.5} />
    </svg>
  );
}

type FloatingItem = {
  Icon: ComponentType<{ className?: string; style?: CSSProperties }>;
  top: string;
  size: string; // w/h 클래스
  color: string;
  duration: string; // 수평 이동 주기 (화면 통과 시간)
  delay: string; // 음수 = 중간 지점부터 시작
  bobDuration: string; // 위아래 둥실 주기
  bobDelay: string;
};

const BREADS: FloatingItem[] = [
  // 이동 속도는 전부 150s로 동일 → 상대 위치가 영원히 유지돼서 서로 겹치지 않음.
  // 시작 가로 위치 = -delay/150. 세로(top) 순서대로 황금비(0.382)씩 어긋나게 배치해서
  // 아이콘 키(세로 범위)가 겹치는 어떤 쌍도 가로로 최소 15vw 이상 떨어져 있음.
  // 항목을 추가/수정할 땐 top 순서 기준 progression을 유지할 것.
  { Icon: CoffeeIcon, top: '4%', size: 'w-14 h-14', color: 'text-ink-200', duration: '150s', delay: '-7.5s', bobDuration: '2.3s', bobDelay: '-0.2s' },
  { Icon: BreadIcon, top: '8%', size: 'w-32 h-32', color: 'text-pretzel/20', duration: '150s', delay: '-64.8s', bobDuration: '2.4s', bobDelay: '0s' },
  { Icon: CakeIcon, top: '12%', size: 'w-14 h-14', color: 'text-pretzel/15', duration: '150s', delay: '-122.1s', bobDuration: '2.2s', bobDelay: '-0.6s' },
  { Icon: LuCookie, top: '16%', size: 'w-20 h-20', color: 'text-ink-200', duration: '150s', delay: '-29.4s', bobDuration: '2s', bobDelay: '-0.5s' },
  { Icon: IceCreamIcon, top: '20%', size: 'w-14 h-14', color: 'text-pretzel/20', duration: '150s', delay: '-86.7s', bobDuration: '1.9s', bobDelay: '-1s' },
  { Icon: DonutIcon, top: '24%', size: 'w-24 h-24', color: 'text-ink-200', duration: '150s', delay: '-144s', bobDuration: '1.9s', bobDelay: '-0.7s' },
  { Icon: DrinkIcon, top: '28%', size: 'w-16 h-16', color: 'text-ink-200', duration: '150s', delay: '-51.3s', bobDuration: '1.9s', bobDelay: '-1.4s' },
  { Icon: LuCroissant, top: '32%', size: 'w-36 h-36', color: 'text-pretzel/15', duration: '150s', delay: '-108.6s', bobDuration: '2.8s', bobDelay: '-1.3s' },
  { Icon: BurgerIcon, top: '36%', size: 'w-16 h-16', color: 'text-ink-200', duration: '150s', delay: '-15.9s', bobDuration: '2.6s', bobDelay: '-0.5s' },
  { Icon: AppleIcon, top: '40%', size: 'w-20 h-20', color: 'text-pretzel/20', duration: '150s', delay: '-73.2s', bobDuration: '2.2s', bobDelay: '-1.5s' },
  { Icon: BreadIcon, top: '44%', size: 'w-14 h-14', color: 'text-pretzel/20', duration: '150s', delay: '-130.5s', bobDuration: '2.4s', bobDelay: '-0.3s' },
  { Icon: BaguetteIcon, top: '48%', size: 'w-28 h-28', color: 'text-ink-200', duration: '150s', delay: '-37.8s', bobDuration: '2.1s', bobDelay: '-0.4s' },
  { Icon: CakeSliceIcon, top: '52%', size: 'w-14 h-14', color: 'text-pretzel/15', duration: '150s', delay: '-95.1s', bobDuration: '2.1s', bobDelay: '-1.6s' },
  { Icon: CakeIcon, top: '56%', size: 'w-24 h-24', color: 'text-pretzel/20', duration: '150s', delay: '-2.4s', bobDuration: '1.8s', bobDelay: '-1s' },
  { Icon: LuCookie, top: '60%', size: 'w-16 h-16', color: 'text-pretzel/15', duration: '150s', delay: '-59.7s', bobDuration: '2.1s', bobDelay: '-1.7s' },
  { Icon: DrinkIcon, top: '64%', size: 'w-20 h-20', color: 'text-ink-200', duration: '150s', delay: '-117s', bobDuration: '2.5s', bobDelay: '-0.2s' },
  { Icon: DumplingIcon, top: '66%', size: 'w-14 h-14', color: 'text-ink-200', duration: '150s', delay: '-24.3s', bobDuration: '2.4s', bobDelay: '-0.9s' },
  { Icon: AppleIcon, top: '68%', size: 'w-14 h-14', color: 'text-ink-200', duration: '150s', delay: '-81.6s', bobDuration: '1.8s', bobDelay: '-0.8s' },
  { Icon: PizzaIcon, top: '72%', size: 'w-32 h-32', color: 'text-pretzel/15', duration: '150s', delay: '-138.9s', bobDuration: '2.6s', bobDelay: '-1.8s' },
  { Icon: FriedEggIcon, top: '74%', size: 'w-14 h-14', color: 'text-pretzel/20', duration: '150s', delay: '-46.2s', bobDuration: '1.8s', bobDelay: '-1.3s' },
  { Icon: DonutIcon, top: '77%', size: 'w-16 h-16', color: 'text-pretzel/20', duration: '150s', delay: '-103.5s', bobDuration: '2.5s', bobDelay: '-1.1s' },
  { Icon: RamenIcon, top: '82%', size: 'w-36 h-36', color: 'text-pretzel/10', duration: '150s', delay: '-10.8s', bobDuration: '2.3s', bobDelay: '-0.9s' },
  { Icon: RamenIcon, top: '85%', size: 'w-14 h-14', color: 'text-pretzel/15', duration: '150s', delay: '-68.1s', bobDuration: '2.2s', bobDelay: '-0.4s' },
  { Icon: FriedEggIcon, top: '88%', size: 'w-24 h-24', color: 'text-ink-200', duration: '150s', delay: '-125.4s', bobDuration: '2s', bobDelay: '-1.2s' },
  { Icon: LuCroissant, top: '92%', size: 'w-14 h-14', color: 'text-ink-200', duration: '150s', delay: '-32.7s', bobDuration: '2s', bobDelay: '-1.9s' },
  { Icon: PizzaIcon, top: '94%', size: 'w-14 h-14', color: 'text-ink-200', duration: '150s', delay: '-90s', bobDuration: '2s', bobDelay: '-1.5s' },
];

export default function FloatingBreads() {
  return (
    // top-14 = 상단 메뉴 배너 높이(h-14) — 배너 뒤로는 아이콘이 지나가지 않음
    <div className="fixed inset-x-0 top-14 bottom-0 -z-10 pointer-events-none overflow-hidden" aria-hidden>
      {BREADS.map(({ Icon, top, size, color, duration, delay, bobDuration, bobDelay }, i) => (
        // 바깥 span: 수평 흐름(cloud) / 안쪽 아이콘: 위아래 둥실둥실(bob)
        // animation 을 인라인 shorthand로 지정 — 클래스 캐스케이드/스타일 병합 문제로 인해
        // 특정 세션(예: 게스트 첫 마운트)에서 애니메이션이 정지하는 이슈 방지.
        <span
          key={i}
          className="absolute left-0"
          style={{
            top,
            animation: `cloud ${duration} linear ${delay} infinite`,
            willChange: 'transform',
          }}
        >
          <Icon
            className={`${size} ${color}`}
            style={{
              animation: `bob ${bobDuration} ease-in-out ${bobDelay} infinite`,
              willChange: 'transform',
            }}
          />
        </span>
      ))}
    </div>
  );
}
