import { useEffect, useMemo, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { LuMap, LuX } from 'react-icons/lu';
import { ensureSchema as ensureLunchesSchema, listLunches, type Lunch } from '../lib/lunches';
import {
  averageRating,
  ensureReviewsSchema,
  listAllReviews,
  type LunchReview,
} from '../lib/reviews';
import { normalizeRestaurant } from '../lib/lunch-stats';
import {
  deletePlace,
  ensurePlacesSchema,
  listPlaces,
  upsertPlace,
  type Place,
} from '../lib/places';
import { coordsFromUrl, isNaverLink, resolveNaverLink } from '../lib/place-resolver';
import { isValidParticipantId } from '../lib/members';
import { useAuth } from '../contexts/AuthContext';
import { useProfiles } from '../contexts/ProfilesContext';
import { useAppData } from '../contexts/AppDataContext';

// 지도 탭 — 다녀온(done) 가게 중 좌표(places)가 지정된 곳만 핀으로 표시.
// 좌표 없는 가게는 그냥 생략. 좌표 지정은 "가게 칩 클릭 → 지도 클릭" (멤버만).
// 지도는 Leaflet + OpenStreetMap 타일 — API 키 없이 GitHub Pages에서 동작.

const DEFAULT_CENTER: [number, number] = [37.5665, 126.978]; // 핀 없을 때 서울 중심부
const PIN_COLOR = '#a56a3a'; // tailwind pretzel

type PlaceStat = {
  name: string;
  count: number;
  lunchCount: number;
  dinnerCount: number;
  ratings: number[];
};

export default function MapPage() {
  const { session } = useAuth();
  const { getProfile } = useProfiles();
  const { myEmpNo } = useAppData();
  const me = session?.userId ? String(session.userId) : '';
  const myPid = (me ? getProfile(me)?.empNo : '') || myEmpNo || '';
  const canEdit = isValidParticipantId(myPid);

  const [lunches, setLunches] = useState<Lunch[]>([]);
  const [reviews, setReviews] = useState<Record<number, LunchReview[]>>({});
  const [places, setPlaces] = useState<Place[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  // 네이버 링크 자동 해석 진행 상황 (null = 안 하는 중)
  const [resolving, setResolving] = useState<{ done: number; total: number } | null>(null);
  // 좌표 지정 모드: 칩을 누른 가게 — 다음 지도 클릭 지점이 핀이 됨
  const [assigning, setAssigning] = useState<{ key: string; name: string } | null>(null);
  const assigningRef = useRef(assigning);
  assigningRef.current = assigning;

  const mapDivRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markersRef = useRef<L.LayerGroup | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        await Promise.all([ensureLunchesSchema(), ensureReviewsSchema(), ensurePlacesSchema()]);
        const [rows, revs, pins] = await Promise.all([listLunches(), listAllReviews(), listPlaces()]);
        if (cancelled) return;
        setLunches(rows);
        setReviews(revs);
        setPlaces(pins);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : '불러오기 실패');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // 탭에 들어올 때마다: 핀 없는 가게의 최신 네이버 링크를 자동 해석해 핀 생성 (멤버만).
  // listLunches는 최신순이라 가게별 첫 링크 = 가장 최근 기록의 링크.
  // 실패한 링크는 place-resolver의 세션 캐시가 재시도를 막아서 탭을 오가도 헛돌지 않음.
  useEffect(() => {
    if (!canEdit || !places || lunches.length === 0) return;
    const placed = new Set(places.map((p) => p.nameKey));
    const targets = new Map<string, { name: string; link: string }>();
    for (const l of lunches) {
      if (l.status !== 'done') continue;
      const link = l.link.trim();
      if (!link) continue;
      const key = normalizeRestaurant(l.restaurant);
      if (!key || placed.has(key) || targets.has(key)) continue;
      if (!isNaverLink(link) && !coordsFromUrl(link)) continue;
      targets.set(key, { name: l.restaurant, link });
    }
    if (targets.size === 0) return;
    let cancelled = false;
    (async () => {
      setResolving({ done: 0, total: targets.size });
      let done = 0;
      let found = 0;
      for (const [key, t] of targets) {
        const coord = await resolveNaverLink(t.link);
        if (cancelled) return;
        done += 1;
        setResolving({ done, total: targets.size });
        if (coord) {
          try {
            await upsertPlace(key, t.name, coord.lat, coord.lng);
            found += 1;
          } catch {
            /* 저장 실패한 가게만 건너뜀 */
          }
        }
      }
      if (cancelled) return;
      if (found > 0) setPlaces(await listPlaces());
      setResolving(null);
    })();
    return () => {
      cancelled = true;
    };
  }, [canEdit, lunches, places]);

  // 다녀온 기록을 가게별로 집계 (핀 뱃지의 방문 횟수·팝업의 평균 별점용)
  const stats = useMemo(() => {
    const map: Record<string, PlaceStat> = {};
    for (const l of lunches) {
      if (l.status !== 'done') continue;
      const key = normalizeRestaurant(l.restaurant);
      if (!key) continue;
      const s = (map[key] ??= {
        name: l.restaurant,
        count: 0,
        lunchCount: 0,
        dinnerCount: 0,
        ratings: [],
      });
      s.count += 1;
      if (l.meal === 'dinner') s.dinnerCount += 1;
      else s.lunchCount += 1;
      const r = averageRating(reviews[l.id] ?? []) ?? (l.rating > 0 ? l.rating : null);
      if (r != null) s.ratings.push(r);
    }
    return map;
  }, [lunches, reviews]);

  async function handleAssign(target: { key: string; name: string }, latlng: L.LatLng) {
    try {
      await upsertPlace(target.key, target.name, latlng.lat, latlng.lng);
      setAssigning(null);
      setPlaces(await listPlaces());
    } catch {
      alert('위치 저장에 실패했어요. 다시 시도해 주세요.');
    }
  }

  async function handleRemove(nameKey: string) {
    try {
      await deletePlace(nameKey);
      setPlaces(await listPlaces());
    } catch {
      alert('핀 삭제에 실패했어요. 다시 시도해 주세요.');
    }
  }
  const handleAssignRef = useRef(handleAssign);
  handleAssignRef.current = handleAssign;
  const handleRemoveRef = useRef(handleRemove);
  handleRemoveRef.current = handleRemove;

  // 지도 생성 (1회)
  useEffect(() => {
    if (!mapDivRef.current || mapRef.current) return;
    const map = L.map(mapDivRef.current).setView(DEFAULT_CENTER, 12);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    }).addTo(map);
    markersRef.current = L.layerGroup().addTo(map);
    map.on('click', (e: L.LeafletMouseEvent) => {
      const target = assigningRef.current;
      if (!target) return;
      void handleAssignRef.current(target, e.latlng);
    });
    mapRef.current = map;
    return () => {
      map.remove();
      mapRef.current = null;
      markersRef.current = null;
    };
  }, []);

  // 핀 갱신 — 좌표가 있고 다녀온 기록도 있는 가게만
  useEffect(() => {
    const map = mapRef.current;
    const group = markersRef.current;
    if (!map || !group || !places) return;
    group.clearLayers();
    const pins = places.filter((p) => stats[p.nameKey]);
    for (const p of pins) {
      const s = stats[p.nameKey];
      const avg =
        s.ratings.length > 0 ? s.ratings.reduce((a, b) => a + b, 0) / s.ratings.length : null;
      // 저녁만 간 가게는 🌙, 점심 기록이 하나라도 있으면 🍜
      const pinEmoji = s.lunchCount === 0 && s.dinnerCount > 0 ? '🌙' : '🍜';
      const icon = L.divIcon({
        className: '',
        iconSize: [34, 34],
        iconAnchor: [17, 30],
        popupAnchor: [0, -28],
        html: `<div style="position:relative;width:34px;height:34px;display:flex;align-items:center;justify-content:center;background:#fff;border:2px solid ${PIN_COLOR};border-radius:50% 50% 50% 4px;box-shadow:0 1px 3px rgba(0,0,0,.25);font-size:16px;">${pinEmoji}<span style="position:absolute;top:-6px;right:-6px;min-width:16px;height:16px;padding:0 3px;border-radius:8px;background:${PIN_COLOR};color:#fff;font-size:9px;font-weight:700;display:flex;align-items:center;justify-content:center;">${s.count}</span></div>`,
      });
      // 팝업은 DOM으로 조립 — 가게명이 HTML로 해석되는 걸 막고 삭제 버튼에 핸들러를 단다
      const el = document.createElement('div');
      el.style.fontSize = '12px';
      const title = document.createElement('b');
      title.textContent = s.name;
      el.appendChild(title);
      const meta = document.createElement('div');
      meta.style.cssText = 'color:#666;margin-top:2px;';
      // 점심/저녁이 섞인 가게는 나눠서 표기
      const visits =
        s.lunchCount > 0 && s.dinnerCount > 0
          ? `🍜 점심 ${s.lunchCount} · 🌙 저녁 ${s.dinnerCount}번 다녀옴`
          : `${s.count}번 다녀옴`;
      meta.textContent = `${visits}${avg != null ? ` · ⭐ ${avg.toFixed(1)}` : ''}`;
      el.appendChild(meta);
      if (canEdit) {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.textContent = '핀 삭제';
        btn.style.cssText =
          'margin-top:6px;font-size:10px;color:#b91c1c;text-decoration:underline;background:none;border:none;padding:0;cursor:pointer;';
        btn.onclick = () => {
          if (confirm(`'${s.name}' 핀을 지울까요? (먹기록은 그대로예요)`)) {
            void handleRemoveRef.current(p.nameKey);
          }
        };
        el.appendChild(btn);
      }
      L.marker([p.lat, p.lng], { icon }).bindPopup(el).addTo(group);
    }
    if (pins.length > 0) {
      map.fitBounds(
        L.latLngBounds(pins.map((p) => [p.lat, p.lng] as [number, number])).pad(0.25),
        { maxZoom: 16 },
      );
    }
  }, [places, stats, canEdit]);

  // 다녀왔지만 아직 좌표가 없는 가게 — 방문 많은 순
  const unplaced = useMemo(() => {
    if (!places) return [];
    const placed = new Set(places.map((p) => p.nameKey));
    return Object.entries(stats)
      .filter(([key]) => !placed.has(key))
      .map(([key, s]) => ({ key, name: s.name, count: s.count }))
      .sort((a, b) => b.count - a.count);
  }, [places, stats]);

  const pinCount = places ? places.filter((p) => stats[p.nameKey]).length : 0;

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-semibold tracking-tight inline-flex items-center gap-2">
          <LuMap className="text-pretzel" />
          지도
        </h1>
        <p className="text-xs text-ink-400 mt-0.5">
          {resolving
            ? `🔎 네이버 링크에서 좌표 찾는 중... (${resolving.done}/${resolving.total})`
            : pinCount > 0
              ? `다녀온 가게 ${pinCount}곳`
              : '다녀온 가게들을 지도에 모아봐요'}
        </p>
      </div>

      {error ? (
        <div className="text-xs text-red-600 bg-red-50 border border-red-100 rounded-md px-3 py-2 mb-4">
          {error}
        </div>
      ) : null}

      {assigning ? (
        <div className="mb-3 flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2">
          <p className="flex-1 min-w-0 text-[11px] text-amber-800 break-keep">
            📍 지도를 클릭해 <b>{assigning.name}</b> 위치를 지정해 주세요
          </p>
          <button
            type="button"
            onClick={() => setAssigning(null)}
            className="shrink-0 text-amber-700 hover:text-amber-900 p-1 rounded"
            aria-label="위치 지정 취소"
          >
            <LuX className="text-sm" />
          </button>
        </div>
      ) : null}

      {/* isolate + z-0: leaflet 내부 z-index가 상단 헤더/모달을 덮지 않게 가둠 */}
      <div
        ref={mapDivRef}
        className="h-[55vh] sm:h-[60vh] rounded-2xl overflow-hidden border border-ink-100 shadow-card relative z-0 isolate"
      />

      {canEdit && unplaced.length > 0 ? (
        <div className="mt-3">
          <p className="text-[10px] text-ink-400 break-keep">
            아직 지도에 없는 가게예요 — 누른 다음 지도를 클릭하면 핀이 생겨요
          </p>
          <div className="mt-1.5 flex flex-wrap gap-1">
            {unplaced.map((u) => (
              <button
                key={u.key}
                type="button"
                onClick={() => setAssigning({ key: u.key, name: u.name })}
                className={`rounded-full border px-2.5 py-1 text-[11px] transition-colors break-keep ${
                  assigning?.key === u.key
                    ? 'border-pretzel bg-pretzel/10 text-pretzel font-semibold'
                    : 'border-ink-200 bg-white text-ink-500 hover:border-pretzel/50 hover:text-ink-800'
                }`}
              >
                {u.name}
              </button>
            ))}
          </div>
        </div>
      ) : null}

      <p className="mt-3 text-[10px] text-ink-400 break-keep">
        좌표가 지정된 가게만 표시돼요 (없는 곳은 생략) · 🍜 점심 다녀온 곳 · 🌙 저녁만 간 곳 ·
        핀의 숫자는 다녀온 횟수, 누르면 상세가 보여요
      </p>
    </div>
  );
}
