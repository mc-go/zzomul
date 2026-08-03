import { useRef, useState, type FormEvent, type ChangeEvent } from 'react';
import { LuUpload, LuX } from 'react-icons/lu';
import Avatar from './Avatar';
import {
  AVATAR_COLORS,
  AVATAR_ICON_KEYS,
  getAvatarColor,
  getAvatarIcon,
} from '../lib/avatar-icons';
import { fileToSquareDataUrl } from '../lib/image';
import type { Profile } from '../lib/profiles';

type Props = {
  profileId: string;
  displayName?: string;
  initial: Profile | null;
  onClose: () => void;
  onSubmit: (update: {
    empNo: string;
    iconKey: string;
    colorKey: string;
    photo: string;
    statusMessage: string;
  }) => Promise<void>;
};

const STATUS_MAX = 40;

export default function ProfileEditor({ profileId, displayName, initial, onClose, onSubmit }: Props) {
  const [empNo, setEmpNo] = useState<string>(initial?.empNo ?? '');
  const [iconKey, setIconKey] = useState<string>(initial?.iconKey ?? 'user');
  const [colorKey, setColorKey] = useState<string>(initial?.colorKey ?? 'slate');
  const [photo, setPhoto] = useState<string>(initial?.photo ?? '');
  const [statusMessage, setStatusMessage] = useState<string>(initial?.statusMessage ?? '');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const previewProfile: Profile = {
    id: profileId,
    empNo,
    name: initial?.name ?? '',
    iconKey,
    colorKey,
    photo,
    statusMessage: '',
    statusDate: null,
    updatedAt: '',
  };

  async function handleFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      const dataUrl = await fileToSquareDataUrl(file, 200, 0.85);
      setPhoto(dataUrl);
    } catch (err) {
      setErr(err instanceof Error ? err.message : '이미지 처리 실패');
    }
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    if (statusMessage.length > STATUS_MAX) {
      setErr(`상태 메시지는 ${STATUS_MAX}자 이내로 써 주세요.`);
      return;
    }
    setBusy(true);
    setErr(null);
    try {
      await onSubmit({
        empNo: empNo.trim(),
        iconKey,
        colorKey,
        photo: photo.trim(),
        statusMessage: statusMessage.trim(),
      });
    } catch (e) {
      setErr(e instanceof Error ? e.message : '저장 실패');
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-40 flex items-end sm:items-center justify-center bg-ink-900/40 backdrop-blur-sm p-0 sm:p-4">
      <div
        className="w-full sm:max-w-md bg-white rounded-t-2xl sm:rounded-2xl shadow-lg border border-ink-100 max-h-[90vh] flex flex-col"
        role="dialog"
        aria-modal="true"
      >
        <header className="flex items-center justify-between px-5 py-4 border-b border-ink-100">
          <h2 className="text-base font-semibold">프로필 편집</h2>
          <button
            type="button"
            onClick={onClose}
            className="text-ink-400 hover:text-ink-900 p-1 rounded"
            aria-label="닫기"
          >
            <LuX />
          </button>
        </header>

        <div className="p-5 space-y-5 overflow-y-auto">
          <div className="flex items-center gap-4">
            <Avatar profile={previewProfile} size="xl" />
            <div className="min-w-0">
              <p className="text-sm font-semibold text-ink-900 truncate">
                {displayName ?? profileId}
              </p>
              <p className="text-[11px] text-ink-400 mt-0.5">
                {photo ? '사진 있음' : `${getAvatarIcon(iconKey).name ?? iconKey} · ${getAvatarColor(colorKey).key}`}
              </p>
            </div>
          </div>

          <FieldBlock label="본인 사번" hint="캘린더 표시 연동용. 한 번만 설정.">
            <input
              type="text"
              value={empNo}
              onChange={(e) => setEmpNo(e.target.value.trim())}
              placeholder="예: 2023124"
              inputMode="numeric"
              className="w-full h-10 px-3 rounded-md border border-ink-200 text-sm placeholder-ink-300"
            />
          </FieldBlock>

          <FieldBlock label="상태 메시지" hint={`매일 자정 자동 초기화 · ${statusMessage.length}/${STATUS_MAX}`}>
            <input
              type="text"
              value={statusMessage}
              onChange={(e) => setStatusMessage(e.target.value.slice(0, STATUS_MAX))}
              placeholder="오늘의 한마디"
              className="w-full h-10 px-3 rounded-md border border-ink-200 text-sm placeholder-ink-300"
            />
          </FieldBlock>

          <FieldBlock label="사진 (선택)" hint="URL을 붙여넣거나 파일을 업로드하세요">
            <div className="space-y-2">
              <input
                type="url"
                value={photo.startsWith('data:') ? '' : photo}
                onChange={(e) => setPhoto(e.target.value)}
                placeholder="https://... (GitHub, imgur 등)"
                className="w-full h-10 px-3 rounded-md border border-ink-200 text-sm placeholder-ink-300"
              />
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  className="inline-flex items-center gap-1.5 h-9 px-3 rounded-md border border-ink-200 text-ink-700 text-xs font-medium hover:bg-ink-50"
                >
                  <LuUpload className="text-sm" />
                  파일 업로드
                </button>
                {photo ? (
                  <button
                    type="button"
                    onClick={() => setPhoto('')}
                    className="text-xs text-ink-500 hover:text-red-600 px-2 py-1.5"
                  >
                    사진 지우기
                  </button>
                ) : null}
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*"
                  onChange={handleFile}
                  className="hidden"
                />
              </div>
            </div>
          </FieldBlock>

          <FieldBlock label="아이콘" hint="사진 없을 때 대신 표시돼요">
            <div className="grid grid-cols-6 gap-2">
              {AVATAR_ICON_KEYS.map((k) => {
                const Icon = getAvatarIcon(k);
                const active = iconKey === k;
                return (
                  <button
                    key={k}
                    type="button"
                    onClick={() => setIconKey(k)}
                    className={`aspect-square rounded-md border inline-flex items-center justify-center transition-colors ${
                      active
                        ? 'bg-ink-900 text-white border-ink-900'
                        : 'bg-white text-ink-600 border-ink-200 hover:border-ink-400'
                    }`}
                    aria-label={k}
                  >
                    <Icon className="text-lg" />
                  </button>
                );
              })}
            </div>
          </FieldBlock>

          <FieldBlock label="배경색">
            <div className="grid grid-cols-6 gap-2">
              {AVATAR_COLORS.map((c) => {
                const active = colorKey === c.key;
                return (
                  <button
                    key={c.key}
                    type="button"
                    onClick={() => setColorKey(c.key)}
                    className={`aspect-square rounded-md border-2 transition-transform ${
                      active ? 'border-ink-900 scale-105' : 'border-transparent hover:scale-105'
                    }`}
                    style={{ backgroundColor: c.bg }}
                    aria-label={c.key}
                  />
                );
              })}
            </div>
          </FieldBlock>

          {err ? (
            <div className="text-xs text-red-600 bg-red-50 border border-red-100 rounded-md px-3 py-2">
              {err}
            </div>
          ) : null}
        </div>

        <footer className="flex items-center justify-end gap-2 px-5 py-3 border-t border-ink-100 bg-white">
          <button
            type="button"
            onClick={onClose}
            className="h-10 px-4 text-sm rounded-md text-ink-500 hover:text-ink-900 hover:bg-ink-50"
          >
            취소
          </button>
          <button
            type="submit"
            onClick={submit}
            disabled={busy}
            className="h-10 px-4 text-sm rounded-md bg-ink-900 text-white hover:bg-ink-700 disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {busy ? '저장 중...' : '저장'}
          </button>
        </footer>
      </div>
    </div>
  );
}

function FieldBlock({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="flex items-baseline justify-between mb-1.5">
        <span className="text-xs font-medium text-ink-500">{label}</span>
        {hint ? <span className="text-[10px] text-ink-400">{hint}</span> : null}
      </div>
      {children}
    </div>
  );
}
