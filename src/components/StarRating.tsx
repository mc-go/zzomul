import { useState } from 'react';
import { LuStar } from 'react-icons/lu';

type Props = {
  value: number;
  onChange?: (v: number) => void;
  size?: 'sm' | 'md' | 'lg';
  readOnly?: boolean;
};

const SIZE_CLASS = {
  sm: 'text-sm',
  md: 'text-lg',
  lg: 'text-2xl',
};

export default function StarRating({ value, onChange, size = 'md', readOnly = false }: Props) {
  const [hover, setHover] = useState<number | null>(null);
  const display = hover ?? value;

  function set(v: number) {
    if (readOnly) return;
    onChange?.(Math.max(0, Math.min(5, Math.round(v * 2) / 2)));
  }

  return (
    <div
      className="inline-flex items-center gap-0.5"
      onMouseLeave={() => setHover(null)}
    >
      {[1, 2, 3, 4, 5].map((n) => {
        const fillAmount = Math.max(0, Math.min(1, display - (n - 1)));
        // Snap fill to 0, 0.5, or 1
        const step: 0 | 0.5 | 1 = fillAmount >= 0.75 ? 1 : fillAmount >= 0.25 ? 0.5 : 0;
        return (
          <StarSlot
            key={n}
            step={step}
            sizeClass={SIZE_CLASS[size]}
            readOnly={readOnly}
            onHoverHalf={() => setHover(n - 0.5)}
            onHoverFull={() => setHover(n)}
            onClickHalf={() => set(n - 0.5)}
            onClickFull={() => set(n)}
          />
        );
      })}
    </div>
  );
}

function StarSlot({
  step,
  sizeClass,
  readOnly,
  onHoverHalf,
  onHoverFull,
  onClickHalf,
  onClickFull,
}: {
  step: 0 | 0.5 | 1;
  sizeClass: string;
  readOnly: boolean;
  onHoverHalf: () => void;
  onHoverFull: () => void;
  onClickHalf: () => void;
  onClickFull: () => void;
}) {
  const filledClass = 'fill-amber-400 text-amber-400';
  const emptyClass = 'fill-transparent text-ink-200';

  return (
    <span className="relative inline-block">
      <LuStar className={`${sizeClass} ${emptyClass}`} strokeWidth={1.5} />
      {step > 0 ? (
        <span
          className="absolute inset-0 pointer-events-none overflow-hidden"
          style={{ width: step === 0.5 ? '50%' : '100%' }}
          aria-hidden
        >
          <LuStar className={`${sizeClass} ${filledClass}`} strokeWidth={1.5} />
        </span>
      ) : null}
      {!readOnly ? (
        <>
          <button
            type="button"
            aria-label="반쪽"
            className="absolute left-0 top-0 bottom-0 w-1/2 z-10 cursor-pointer"
            onMouseEnter={onHoverHalf}
            onClick={onClickHalf}
          />
          <button
            type="button"
            aria-label="한 칸"
            className="absolute right-0 top-0 bottom-0 w-1/2 z-10 cursor-pointer"
            onMouseEnter={onHoverFull}
            onClick={onClickFull}
          />
        </>
      ) : null}
    </span>
  );
}
