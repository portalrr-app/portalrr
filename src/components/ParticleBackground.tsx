'use client';

import { useEffect, useMemo, useRef } from 'react';

export type ParticleStyle = 'none' | 'constellation' | 'starfield' | 'orbs' | 'portals' | 'grid';

interface Props {
  style: ParticleStyle;
  accent: string;
  intensity?: number;
  cursor?: boolean;
  className?: string;
}

type Particle = {
  x: number; y: number;
  vx: number; vy: number;
  r: number;
  z: number;
  twinkle: number;
  hue: number;
  phase: number;
  speed: number;
  drift: number;
  _gx: number; _gy: number;
};

function parseAccent(hex: string): [number, number, number] {
  const m = /#([\da-f]{2})([\da-f]{2})([\da-f]{2})/i.exec(hex);
  if (!m) return [167, 139, 250];
  return [parseInt(m[1], 16), parseInt(m[2], 16), parseInt(m[3], 16)];
}

export default function ParticleBackground({
  style,
  accent,
  intensity = 1,
  cursor = true,
  className,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const rafRef = useRef<number>(0);
  const mouseRef = useRef({ x: 0.5, y: 0.5 });
  const accentRGB = useMemo(() => parseAccent(accent), [accent]);

  useEffect(() => {
    if (style === 'none') return;
    if (!cursor) return;
    const onMove = (e: MouseEvent) => {
      mouseRef.current.x = e.clientX / window.innerWidth;
      mouseRef.current.y = e.clientY / window.innerHeight;
    };
    const onLeave = () => {
      mouseRef.current = { x: 0.5, y: 0.5 };
    };
    window.addEventListener('mousemove', onMove, { passive: true });
    window.addEventListener('mouseleave', onLeave);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseleave', onLeave);
    };
  }, [style, cursor]);

  useEffect(() => {
    if (style === 'none') return;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d', { alpha: true });
    if (!ctx) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 1.25);

    const state = {
      t: 0,
      w: 0,
      h: 0,
      mx: 0.5,
      my: 0.5,
      particles: [] as Particle[],
    };

    function resize() {
      const r = canvas!.getBoundingClientRect();
      state.w = r.width;
      state.h = r.height;
      canvas!.width = Math.floor(r.width * dpr);
      canvas!.height = Math.floor(r.height * dpr);
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);
      seed();
    }

    function seed() {
      const { w, h } = state;
      const counts: Record<string, number> = {
        constellation: 60,
        starfield: 140,
        orbs: 18,
        portals: 7,
        grid: 0,
      };
      const count = Math.round((counts[style] || 0) * intensity);
      const arr: Particle[] = [];
      for (let i = 0; i < count; i++) {
        if (style === 'orbs') {
          arr.push({
            x: Math.random() * w, y: Math.random() * h,
            r: 100 + Math.random() * 200,
            vx: (Math.random() - 0.5) * 0.12,
            vy: (Math.random() - 0.5) * 0.12,
            hue: Math.random(),
            z: 0, twinkle: 0, phase: 0, speed: 0, drift: 0, _gx: 0, _gy: 0,
          });
        } else if (style === 'portals') {
          arr.push({
            x: Math.random() * w, y: Math.random() * h,
            r: 50 + Math.random() * 70,
            phase: Math.random() * Math.PI * 2,
            speed: 0.2 + Math.random() * 0.4,
            drift: Math.random() * Math.PI * 2,
            vx: 0, vy: 0, z: 0, twinkle: 0, hue: 0, _gx: 0, _gy: 0,
          });
        } else {
          arr.push({
            x: Math.random() * w, y: Math.random() * h,
            z: Math.random(),
            vx: (Math.random() - 0.5) * 0.22,
            vy: (Math.random() - 0.5) * 0.22,
            r: Math.random() * 1.4 + 0.5,
            twinkle: Math.random() * Math.PI * 2,
            hue: 0, phase: 0, speed: 0, drift: 0, _gx: 0, _gy: 0,
          });
        }
      }
      state.particles = arr;
    }

    function step() {
      state.t += 1;
      const targetX = cursor ? mouseRef.current.x : 0.5;
      const targetY = cursor ? mouseRef.current.y : 0.5;
      state.mx += (targetX - state.mx) * 0.06;
      state.my += (targetY - state.my) * 0.06;
      const { w, h, particles } = state;
      const [ar, ag, ab] = accentRGB;
      ctx!.clearRect(0, 0, w, h);

      const gx = state.mx * w, gy = state.my * h;
      const grd = ctx!.createRadialGradient(gx, gy, 0, gx, gy, Math.max(w, h) * 0.7);
      grd.addColorStop(0, `rgba(${ar},${ag},${ab},0.16)`);
      grd.addColorStop(0.4, `rgba(${ar},${ag},${ab},0.04)`);
      grd.addColorStop(1, 'rgba(6,5,8,0)');
      ctx!.fillStyle = grd;
      ctx!.fillRect(0, 0, w, h);

      if (style === 'grid') drawGrid(ctx!, w, h, state.t, ar, ag, ab, state.mx, state.my);
      else if (style === 'constellation') drawConstellation(ctx!, w, h, particles, state.t, ar, ag, ab, state.mx, state.my);
      else if (style === 'orbs') drawOrbs(ctx!, w, h, particles, ar, ag, ab);
      else if (style === 'portals') drawPortals(ctx!, w, h, particles, state.t, ar, ag, ab);
      else if (style === 'starfield') drawStarfield(ctx!, w, h, particles, state.mx, state.my, ar, ag, ab);

      rafRef.current = requestAnimationFrame(step);
    }

    resize();
    window.addEventListener('resize', resize);
    if (!reduced) {
      rafRef.current = requestAnimationFrame(step);
    } else {
      // one static frame
      step();
      cancelAnimationFrame(rafRef.current);
    }
    return () => {
      cancelAnimationFrame(rafRef.current);
      window.removeEventListener('resize', resize);
    };
  }, [style, intensity, cursor, accentRGB]);

  if (style === 'none') return null;
  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className={className}
      style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', display: 'block', pointerEvents: 'none' }}
    />
  );
}

function drawConstellation(ctx: CanvasRenderingContext2D, w: number, h: number, parts: Particle[], t: number, ar: number, ag: number, ab: number, mx: number, my: number) {
  const maxD = 130;
  const cell = maxD;
  const grid = new Map<string, Particle[]>();
  const mxp = mx * w, myp = my * h;
  for (const p of parts) {
    p.x += p.vx;
    p.y += p.vy;
    const dx = mxp - p.x, dy = myp - p.y;
    const d2 = dx * dx + dy * dy;
    if (d2 < 32400) {
      const inv = 0.0012;
      p.x += dx * inv;
      p.y += dy * inv;
    }
    if (p.x < 0) p.x += w; else if (p.x > w) p.x -= w;
    if (p.y < 0) p.y += h; else if (p.y > h) p.y -= h;
    const gx = Math.floor(p.x / cell), gy = Math.floor(p.y / cell);
    const key = gx + ',' + gy;
    let bucket = grid.get(key);
    if (!bucket) { bucket = []; grid.set(key, bucket); }
    bucket.push(p);
    p._gx = gx; p._gy = gy;
  }
  ctx.lineWidth = 1;
  const maxD2 = maxD * maxD;
  for (const p of parts) {
    for (let oy = 0; oy <= 1; oy++) {
      for (let ox = -1; ox <= 1; ox++) {
        if (oy === 0 && ox < 0) continue;
        const key = (p._gx + ox) + ',' + (p._gy + oy);
        const bucket = grid.get(key);
        if (!bucket) continue;
        for (const q of bucket) {
          if (q === p) continue;
          const dx = p.x - q.x, dy = p.y - q.y;
          const d2 = dx * dx + dy * dy;
          if (d2 < maxD2) {
            const alpha = (1 - Math.sqrt(d2) / maxD) * 0.3;
            ctx.strokeStyle = `rgba(${ar},${ag},${ab},${alpha})`;
            ctx.beginPath();
            ctx.moveTo(p.x, p.y);
            ctx.lineTo(q.x, q.y);
            ctx.stroke();
          }
        }
      }
    }
  }
  for (const p of parts) {
    const tw = 0.55 + Math.sin(t * 0.04 + p.twinkle) * 0.35;
    ctx.fillStyle = `rgba(${ar},${ag},${ab},${tw})`;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawStarfield(ctx: CanvasRenderingContext2D, w: number, h: number, parts: Particle[], mx: number, my: number, ar: number, ag: number, ab: number) {
  const cx = w * mx, cy = h * my;
  for (const p of parts) {
    const dx = p.x - cx, dy = p.y - cy;
    const speed = 0.004 * (p.z + 0.2);
    p.x += dx * speed;
    p.y += dy * speed;
    if (p.x < 0 || p.x > w || p.y < 0 || p.y > h) {
      p.x = cx + (Math.random() - 0.5) * 100;
      p.y = cy + (Math.random() - 0.5) * 100;
      p.z = Math.random();
    }
    const a = 0.2 + p.z * 0.7;
    ctx.strokeStyle = `rgba(${ar},${ag},${ab},${a})`;
    ctx.lineWidth = 0.5 + p.z * 1.4;
    ctx.beginPath();
    ctx.moveTo(p.x - dx * speed * 8, p.y - dy * speed * 8);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
  }
}

function drawOrbs(ctx: CanvasRenderingContext2D, w: number, h: number, parts: Particle[], ar: number, ag: number, ab: number) {
  ctx.globalCompositeOperation = 'lighter';
  for (const p of parts) {
    p.x += p.vx;
    p.y += p.vy;
    if (p.x < -p.r) p.x = w + p.r; else if (p.x > w + p.r) p.x = -p.r;
    if (p.y < -p.r) p.y = h + p.r; else if (p.y > h + p.r) p.y = -p.r;
    const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.r);
    const hs = p.hue * 40 - 20;
    const r2 = Math.min(255, ar + hs) | 0;
    const g2 = Math.max(0, ag - hs * 0.5) | 0;
    const b2 = Math.min(255, ab + hs * 0.3) | 0;
    g.addColorStop(0, `rgba(${r2},${g2},${b2},0.28)`);
    g.addColorStop(0.5, `rgba(${r2},${g2},${b2},0.06)`);
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalCompositeOperation = 'source-over';
}

function drawPortals(ctx: CanvasRenderingContext2D, w: number, h: number, parts: Particle[], t: number, ar: number, ag: number, ab: number) {
  ctx.lineWidth = 1.2;
  for (const p of parts) {
    p.drift += 0.003;
    p.x += Math.cos(p.drift) * 0.3;
    p.y += Math.sin(p.drift * 0.8) * 0.3;
    if (p.x < 0) p.x += w; else if (p.x > w) p.x -= w;
    if (p.y < 0) p.y += h; else if (p.y > h) p.y -= h;
    for (let i = 0; i < 3; i++) {
      const phase = (t * 0.01 * p.speed + p.phase + i / 3) % 1;
      const alpha = (1 - phase) * 0.5;
      ctx.strokeStyle = `rgba(${ar},${ag},${ab},${alpha})`;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r * phase, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.fillStyle = `rgba(${ar},${ag},${ab},0.9)`;
    ctx.beginPath();
    ctx.arc(p.x, p.y, 2, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawGrid(ctx: CanvasRenderingContext2D, w: number, h: number, t: number, ar: number, ag: number, ab: number, mx: number, my: number) {
  const size = 48;
  const cx = mx * w, cy = my * h;
  ctx.strokeStyle = `rgba(${ar},${ag},${ab},0.07)`;
  ctx.lineWidth = 1;
  const offset = (t * 0.3) % size;
  ctx.beginPath();
  for (let y = offset; y < h; y += size) {
    ctx.moveTo(0, y);
    ctx.lineTo(w, y);
  }
  for (let x = offset; x < w; x += size) {
    ctx.moveTo(x, 0);
    ctx.lineTo(x, h);
  }
  ctx.stroke();

  const radius = 260, r2 = radius * radius;
  const startX = Math.floor((cx - radius) / size) * size;
  const endX = Math.ceil((cx + radius) / size) * size;
  const startY = Math.floor((cy - radius) / size) * size;
  const endY = Math.ceil((cy + radius) / size) * size;
  for (let x = startX; x <= endX; x += size) {
    for (let y = startY; y <= endY; y += size) {
      const dx = x - cx, dy = y - cy;
      const d2 = dx * dx + dy * dy;
      if (d2 < r2) {
        const a = (1 - Math.sqrt(d2) / radius) * 0.85;
        ctx.fillStyle = `rgba(${ar},${ag},${ab},${a})`;
        ctx.beginPath();
        ctx.arc(x, y, 1.4 + a * 1.4, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }
}
