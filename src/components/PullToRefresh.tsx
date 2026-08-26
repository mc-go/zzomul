import { useEffect, useRef, useState } from 'react';
import { GiPretzel } from 'react-icons/gi';

// 홈 화면 앱(standalone)에서만 동작하는 당겨서 새로고침.
// iOS 전체화면 웹앱엔 브라우저의 당겨서 새로고침이 없어서 직접 구현 —
// 일반 브라우저에선 기본 기능이 있으므로 아무것도 하지 않는다.
// 모달(role="dialog")이나 지도(leaflet) 위에서의 드래그는 오작동 방지를 위해 무시.

const PULL_THRESHOLD = 70; // 이만큼 당기면 놓을 때 새로고침
const PULL_MAX = 110;

export default function PullToRefresh() {
  const [pull, setPull] = useState(0);
  const [reloading, setReloading] = useState(false);
  const pullRef = useRef(0);
  const startYRef = useRef<number | null>(null);

  useEffect(() => {
    const standalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      (navigator as unknown as { standalone?: boolean }).standalone === true;
    if (!standalone) return;

    const update = (v: number) => {
      pullRef.current = v;
      setPull(v);
    };

    const onStart = (e: TouchEvent) => {
      if (window.scrollY > 0) return;
      const target = e.target as Element | null;
      if (target?.closest('[role="dialog"], .leaflet-container')) return;
      startYRef.current = e.touches[0].clientY;
    };
    const onMove = (e: TouchEvent) => {
      if (startYRef.current === null) return;
      const dy = e.touches[0].clientY - startYRef.current;
      if (dy <= 0 || window.scrollY > 0) {
        update(0);
        return;
      }
      // 절반만 따라오게 해서 당기는 저항감
      update(Math.min(dy / 2, PULL_MAX));
    };
    const onEnd = () => {
      startYRef.current = null;
      if (pullRef.current >= PULL_THRESHOLD) {
        setReloading(true);
        window.location.reload();
      } else {
        update(0);
      }
    };

    window.addEventListener('touchstart', onStart, { passive: true });
    window.addEventListener('touchmove', onMove, { passive: true });
    window.addEventListener('touchend', onEnd, { passive: true });
    window.addEventListener('touchcancel', onEnd, { passive: true });
    return () => {
      window.removeEventListener('touchstart', onStart);
      window.removeEventListener('touchmove', onMove);
      window.removeEventListener('touchend', onEnd);
      window.removeEventListener('touchcancel', onEnd);
    };
  }, []);

  if (pull <= 0 && !reloading) return null;
  const armed = pull >= PULL_THRESHOLD;

  return (
    <div
      className="fixed top-0 inset-x-0 z-50 flex justify-center pointer-events-none"
      style={{
        transform: `translateY(${Math.round(pull) - 44}px)`,
        opacity: Math.min(pull / PULL_THRESHOLD, 1),
        transition: pull === 0 ? 'transform 200ms ease, opacity 200ms ease' : undefined,
      }}
      aria-hidden
    >
      {/* 임계치를 넘으면 테두리 색으로 "놓으면 새로고침" 신호 */}
      <div
        className={`w-10 h-10 rounded-full bg-white border shadow-lg flex items-center justify-center ${
          armed ? 'border-pretzel' : 'border-ink-200'
        }`}
      >
        <GiPretzel
          className={`text-xl text-pretzel ${reloading ? 'animate-spinonce' : ''}`}
          style={{ transform: reloading ? undefined : `rotate(${pull * 3}deg)` }}
        />
      </div>
    </div>
  );
}
