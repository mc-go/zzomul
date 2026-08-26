import type { BingoBoard } from '../lib/bingo';

// 이달의 쪼물 빙고판 — 아무거나 탭 게임 코너 (계산은 lib/bingo.ts, 저장 없음)
export default function BingoSection({ board }: { board: BingoBoard }) {
  const [, month] = board.month.split('-');
  return (
    <section className="rounded-2xl border border-lime-200 bg-gradient-to-b from-lime-50/70 to-white px-4 py-3">
      <header className="flex items-center flex-wrap gap-x-2 gap-y-1 mb-2">
        <h2 className="text-sm font-bold text-ink-900">🎯 {Number(month)}월의 쪼물 빙고</h2>
        <span className="text-[11px] text-ink-500">
          {board.doneCount}/9칸{board.lines > 0 ? ` · ${board.lines}줄!` : ''}
        </span>
      </header>
      <div className="grid grid-cols-3 gap-1.5">
        {board.cells.map((cell) => (
          <div
            key={cell.key}
            title={cell.hint}
            className={`rounded-xl border px-1.5 py-2 text-center transition-colors ${
              cell.done
                ? 'border-lime-300 bg-lime-100/80'
                : 'border-ink-100 bg-white'
            }`}
          >
            <p className={`text-lg leading-none ${cell.done ? '' : 'opacity-40 grayscale'}`}>
              {cell.done ? '✅' : cell.emoji}
            </p>
            <p
              className={`mt-1 text-[10px] leading-tight break-keep ${
                cell.done ? 'text-lime-800 font-semibold' : 'text-ink-500'
              }`}
            >
              {cell.label}
            </p>
          </div>
        ))}
      </div>
      <p className="mt-2 text-center text-[10px] text-ink-400 break-keep">
        {board.full
          ? '🎉 올 클리어! 이번 달 먹부림 만점이에요'
          : board.lines > 0
            ? `🎊 ${board.lines}줄 빙고! 칸을 길게 누르면 미션 설명이 보여요`
            : '먹고 기록하면 자동으로 채워져요 · 칸을 길게 누르면 미션 설명이 보여요'}
      </p>
    </section>
  );
}
