'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import mapData from './phuket.geo.json';
import './phuket-map.css';

export interface MapPin { id: string; lat: number; lng: number; label: string; href?: string; status?: 'free' | 'reserved' | 'closed'; }
export interface MapDistrict { id: string; name: Record<'ru' | 'en', string>; lat: number; lng: number; count?: number; badge?: string; tone?: 'free' | 'paid' | 'off'; home?: boolean; }
export interface PhuketMapProps {
  locale: 'ru' | 'en'; pins: MapPin[]; districts: MapDistrict[]; hoveredId?: string | null; onHover?: (id: string | null) => void;
  selectedDistrict?: string | null; selectedIds?: string[]; onSelectDistrict?: (id: string | null) => void; onPickDistrict?: (id: string) => void;
  fit?: 'pins' | 'island' | { lat: number; lng: number; zoom?: number }; marker?: { lat: number; lng: number; label: string };
  labels: { sea: string; north: string; km: string; zoomIn: string; zoomOut: string; ariaLabel: string; attribution?: string };
  showGrid?: boolean; showRoads?: boolean; interactive?: boolean; className?: string;
}

type Point = { x: number; y: number };
type Camera = { cx: number; cy: number; scale: number };
const COS_LAT = Math.cos((7.95 * Math.PI) / 180);
const EXTENT = { west: 98.20, east: 98.50, south: 7.70, north: 8.18 };
const DEFAULT_CAMERA: Camera = { cx: 98.325, cy: 7.94, scale: 1500 };
const project = (lng: number, lat: number): Point => ({ x: lng * COS_LAT, y: -lat });
const unproject = (x: number, y: number) => ({ lng: x / COS_LAT, lat: -y });
const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
const featurePath = (coordinates: number[][]) => coordinates.map(([lng, lat], i) => `${i ? 'L' : 'M'} ${project(lng, lat).x} ${project(lng, lat).y}`).join(' ');
const polygonPath = (coordinates: number[][][]) => coordinates.map((ring) => `${featurePath(ring)} Z`).join(' ');

function useElementSize(ref: React.RefObject<HTMLDivElement | null>) {
  const [size, setSize] = useState({ width: 640, height: 420 });
  useEffect(() => {
    if (!ref.current) return;
    const observer = new ResizeObserver(([entry]) => setSize({ width: entry.contentRect.width, height: entry.contentRect.height }));
    observer.observe(ref.current);
    return () => observer.disconnect();
  }, [ref]);
  return size;
}

export function PhuketMap({ locale, pins, districts, hoveredId = null, onHover, selectedDistrict = null, selectedIds, onSelectDistrict, onPickDistrict, fit = 'pins', marker, labels, showGrid = true, showRoads = true, interactive = true, className = '' }: PhuketMapProps): React.ReactElement {
  const rootRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const cursorRef = useRef<HTMLSpanElement>(null);
  const dragRef = useRef<{ x: number; y: number; camera: Camera } | null>(null);
  const reducedMotionRef = useRef(false);
  const { width, height } = useElementSize(rootRef);
  const [camera, setCamera] = useState<Camera>(DEFAULT_CAMERA);
  const [isDragging, setIsDragging] = useState(false);

  useEffect(() => { reducedMotionRef.current = window.matchMedia('(prefers-reduced-motion: reduce)').matches; }, []);

  const bounds = useMemo(() => {
    if (fit === 'island') return { cx: 98.325, cy: 7.94, scale: 1500 };
    if (typeof fit === 'object') return { cx: fit.lng, cy: fit.lat, scale: fit.zoom ? 1500 * fit.zoom : 1500 };
    const points = pins.length ? pins : districts;
    if (!points.length) return DEFAULT_CAMERA;
    const lngs = points.map((p) => p.lng), lats = points.map((p) => p.lat);
    const west = Math.min(...lngs), east = Math.max(...lngs), south = Math.min(...lats), north = Math.max(...lats);
    const span = Math.max(east - west, north - south, 0.035);
    return { cx: (west + east) / 2, cy: (south + north) / 2, scale: clamp(Math.min(width / (span * COS_LAT), height / span) * 0.74, 700, 7200) };
  }, [fit, pins, districts, width, height]);

  useEffect(() => {
    setCamera((current) => {
      const next = { cx: bounds.cx, cy: bounds.cy, scale: bounds.scale };
      return current.cx === next.cx && current.cy === next.cy && current.scale === next.scale ? current : next;
    });
  }, [bounds.cx, bounds.cy, bounds.scale]);

  const view = useMemo(() => {
    const center = project(camera.cx, camera.cy);
    return { tx: width / 2 - center.x * camera.scale, ty: height / 2 - center.y * camera.scale };
  }, [camera, width, height]);
  const screen = useCallback((lng: number, lat: number) => { const p = project(lng, lat); return { x: p.x * camera.scale + view.tx, y: p.y * camera.scale + view.ty }; }, [camera.scale, view.tx, view.ty]);

  const zoomAt = (factor: number, anchor?: Point) => setCamera((current) => {
    const oldScale = current.scale, nextScale = clamp(oldScale * factor, 600, 10000);
    if (!anchor) return { ...current, scale: nextScale };
    const mapX = (anchor.x - view.tx) / oldScale, mapY = (anchor.y - view.ty) / oldScale;
    const nextCx = unproject(mapX + (width / 2 - anchor.x) / nextScale, mapY + (height / 2 - anchor.y) / nextScale);
    return { cx: nextCx.lng, cy: nextCx.lat, scale: nextScale };
  });

  const onPointerDown = (event: React.PointerEvent<SVGSVGElement>) => { if (!interactive) return; event.currentTarget.setPointerCapture(event.pointerId); dragRef.current = { x: event.clientX, y: event.clientY, camera }; setIsDragging(true); };
  const onPointerMove = (event: React.PointerEvent<SVGSVGElement>) => {
    if (dragRef.current) {
      const d = dragRef.current;
      setCamera({ ...d.camera, cx: d.camera.cx - (event.clientX - d.x) / (d.camera.scale * COS_LAT), cy: d.camera.cy + (event.clientY - d.y) / d.camera.scale });
    }
    const rect = svgRef.current?.getBoundingClientRect();
    if (rect && cursorRef.current) { const p = unproject((event.clientX - rect.left - view.tx) / camera.scale, (event.clientY - rect.top - view.ty) / camera.scale); cursorRef.current.textContent = `${p.lat.toFixed(4)}°N  ${p.lng.toFixed(4)}°E`; }
  };
  const onPointerUp = () => { dragRef.current = null; setIsDragging(false); };
  const onWheel = (event: React.WheelEvent<SVGSVGElement>) => { if (!interactive) return; event.preventDefault(); const rect = event.currentTarget.getBoundingClientRect(); zoomAt(event.deltaY > 0 ? 0.88 : 1.14, { x: event.clientX - rect.left, y: event.clientY - rect.top }); };

  const onKeyDown = (event: React.KeyboardEvent<SVGSVGElement>) => {
    if (!interactive) return;
    const step = 0.04 / (camera.scale / 1500);
    if (event.key === '+' || event.key === '=') { event.preventDefault(); zoomAt(1.18); }
    else if (event.key === '-') { event.preventDefault(); zoomAt(0.84); }
    else if (event.key === 'ArrowLeft') setCamera((c) => ({ ...c, cx: c.cx - step }));
    else if (event.key === 'ArrowRight') setCamera((c) => ({ ...c, cx: c.cx + step }));
    else if (event.key === 'ArrowUp') setCamera((c) => ({ ...c, cy: c.cy + step }));
    else if (event.key === 'ArrowDown') setCamera((c) => ({ ...c, cy: c.cy - step }));
  };

  const gridStep = camera.scale > 4200 ? 0.01 : camera.scale > 1700 ? 0.05 : 0.1;
  const gridLines = useMemo(() => {
    const lines: React.ReactNode[] = [];
    for (let lng = Math.ceil(EXTENT.west / gridStep) * gridStep; lng <= EXTENT.east; lng += gridStep) { const a = screen(lng, EXTENT.south), b = screen(lng, EXTENT.north); lines.push(<line key={`v${lng}`} x1={a.x} y1={a.y} x2={b.x} y2={b.y} />); }
    for (let lat = Math.ceil(EXTENT.south / gridStep) * gridStep; lat <= EXTENT.north; lat += gridStep) { const a = screen(EXTENT.west, lat), b = screen(EXTENT.east, lat); lines.push(<line key={`h${lat}`} x1={a.x} y1={a.y} x2={b.x} y2={b.y} />); }
    return lines;
  }, [gridStep, screen]);

  const dataFeatures = mapData.features as Array<{ type: string; properties: { kind?: string; highway?: string; ref?: string }; geometry: { type: string; coordinates: unknown } }>;
  const roads = dataFeatures.filter((f) => f.properties.kind === 'road');
  const coasts = dataFeatures.filter((f) => f.properties.kind === 'coast');
  const land = dataFeatures.find((f) => f.properties.kind === 'land');
  const visiblePins = camera.scale < 1100 && pins.length > 200 ? pins.filter((_, i) => i % 3 === 0) : pins;
  const north = screen(camera.cx, camera.cy + 0.055);
  const scaleKm = Math.max(1, Math.round(60 / camera.scale * 1500));
  const scaleWidth = scaleKm * 1000 * camera.scale * COS_LAT / 111320;

  return <div ref={rootRef} className={`phuket-map ${className}`} data-dragging={isDragging}>
    <svg ref={svgRef} className="pm-svg" role="application" aria-label={labels.ariaLabel} tabIndex={interactive ? 0 : -1} viewBox={`0 0 ${Math.max(width, 1)} ${Math.max(height, 1)}`} onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={onPointerUp} onWheel={onWheel} onKeyDown={onKeyDown}>
      <defs><filter id="pm-glow"><feGaussianBlur stdDeviation="2" result="blur" /><feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge></filter></defs>
      <rect className="pm-water" width={width} height={height} />
      {showGrid && <g className="pm-grid">{gridLines}</g>}
      <g className="pm-map-layer">
        {land && <path className="pm-land" d={polygonPath(land.geometry.coordinates as number[][][])} transform={`translate(${view.tx} ${view.ty}) scale(${camera.scale})`} />}
        {showRoads && roads.map((feature, i) => <path key={`r${i}`} className={`pm-road pm-road-${feature.properties.highway ?? 'tertiary'}`} d={featurePath(feature.geometry.coordinates as number[][])} transform={`translate(${view.tx} ${view.ty}) scale(${camera.scale})`} />)}
        {coasts.map((feature, i) => <path key={`c${i}`} className="pm-coast" d={featurePath(feature.geometry.coordinates as number[][])} transform={`translate(${view.tx} ${view.ty}) scale(${camera.scale})`} />)}
      </g>
      <text className="pm-sea-label" x={width * 0.16} y={height * 0.45}>{labels.sea}</text>
      <g className="pm-north" transform={`translate(${north.x} ${north.y})`}><path d="M 0 18 L 0 -18 M 0 -18 L -4 -8 L 0 -11 L 4 -8 Z" /><text x="9" y="-7">{labels.north}</text></g>
      {districts.map((district) => {
        const p = screen(district.lng, district.lat);
        const selected = selectedIds ? selectedIds.includes(district.id) : selectedDistrict === district.id;
        const pick = () => (onPickDistrict ? onPickDistrict(district.id) : onSelectDistrict?.(selected ? null : district.id));
        const caption = district.badge ?? (district.count !== undefined ? String(district.count) : '');
        return <g key={district.id} className={`pm-district ${selected ? 'is-selected' : ''} ${district.tone ? `tone-${district.tone}` : ''}`} transform={`translate(${p.x} ${p.y})`} role="button" tabIndex={0} aria-pressed={selected} aria-label={district.name[locale]} onPointerDown={(e) => e.stopPropagation()} onClick={pick} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); pick(); } }}>
          <circle className="pm-hit" r="20" />
          {district.home && <circle className="pm-home" r="11" />}
          <circle className="pm-dot" r={selected ? 7 : 5} />
          <text x="12" y="4">{district.name[locale]}{caption ? `  ${caption}` : ''}</text>
        </g>;
      })}
      {visiblePins.map((pin) => { const p = screen(pin.lng, pin.lat); const active = hoveredId === pin.id; const body = <g className={`pm-pin pm-pin-${pin.status ?? 'free'} ${active ? 'is-hovered' : ''}`} transform={`translate(${p.x} ${p.y})`} onMouseEnter={() => onHover?.(pin.id)} onMouseLeave={() => onHover?.(null)}><rect x="-23" y="-13" width="46" height="22" rx="4" /><circle className="pm-pin-dot" cx="-16" cy="-2" r="2.5" /><text x="-10" y="3">{pin.label}</text></g>;
        return pin.href ? <a key={pin.id} href={pin.href} aria-label={pin.label}>{body}</a> : <g key={pin.id} role="button" tabIndex={0} aria-label={pin.label}>{body}</g>; })}
      {marker && (() => { const p = screen(marker.lng, marker.lat); return <g className="pm-marker" transform={`translate(${p.x} ${p.y})`}><circle r="12" /><circle r="4" /><text x="16" y="4">{marker.label}</text></g>; })()}
      <g className="pm-scale" transform={`translate(22 ${height - 26})`}><line x1="0" y1="0" x2={scaleWidth} y2="0" /><line x1="0" y1="-4" x2="0" y2="4" /><line x1={scaleWidth} y1="-4" x2={scaleWidth} y2="4" /><text x="0" y="-8">{scaleKm} {labels.km}</text></g>
      <g className="pm-controls" transform={`translate(${width - 42} 14)`}><g role="button" tabIndex={0} aria-label={labels.zoomIn} onClick={() => zoomAt(1.2)} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') zoomAt(1.2); }}><rect x="0" y="0" width="28" height="28" rx="11" /><text x="14" y="20" textAnchor="middle">+</text></g><g role="button" tabIndex={0} aria-label={labels.zoomOut} onClick={() => zoomAt(0.82)} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') zoomAt(0.82); }}><rect x="0" y="0" width="28" height="28" rx="11" /><text x="14" y="20" textAnchor="middle">−</text></g></g>
      {labels.attribution && <text className="pm-attribution" x={width - 10} y={height - 10}>{labels.attribution}</text>}
    </svg>
    <span ref={cursorRef} className="pm-cursor-readout" aria-live="off">—</span>
  </div>;
}
