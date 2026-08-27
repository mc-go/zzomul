import { useState } from 'react';
import type { BingoBoard } from '../lib/bingo';

// 이달의 쪼물 빙고판 — 아무거나 탭 게임 코너 (계산은 lib/bingo.ts, 저장 없음)
// 칸을 탭하면 아래에 미션 설명이 표시됨 (모바일은 hover/title 툴팁이 없어서 탭 방식 사용)
export default function BingoSection({ board }: { board: BingoBoard }) {
  const [, month] = board.month.split('-');
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const selected = board.cells.find((c) => c.key === selectedKey) ?? null;

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
          <button
            key={cell.key}
            type="button"
            onClick={() => setSelectedKey((prev) => (prev === cell.key ? null : cell.key))}
            className={`rounded-xl border px-1.5 py-2 text-center select-none transition-colors ${
              cell.done
                ? 'border-lime-300 bg-lime-100/80'
                : 'border-ink-100 bg-white'
            } ${selectedKey === cell.key ? 'ring-2 ring-lime-400' : ''}`}
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
          </button>
        ))}
      </div>
      {selected ? (
        <p className="mt-2 rounded-lg border border-lime-200 bg-white px-2.5 py-1.5 text-[11px] text-ink-600 break-keep">
          {selected.emoji} <b className="text-ink-800">{selected.label}</b> — {selected.hint}
          {selected.done ? ' · 달성 완료! ✅' : ''}
        </p>
      ) : null}
      <p className="mt-2 text-center text-[10px] text-ink-400 break-keep">
        {board.full
          ? '🎉 올 클리어! 이번 달 먹부림 만점이에요'
          : board.lines > 0
            ? `🎊 ${board.lines}줄 빙고! 칸을 누르면 미션 설명이 보여요`
            : '먹고 기록하면 자동으로 채워져요 · 칸을 누르면 미션 설명이 보여요'}
      </p>
    </section>
  );
}
