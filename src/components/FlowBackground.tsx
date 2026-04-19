'use client';

import ParticleBackground, { type ParticleStyle } from './ParticleBackground';

export interface FlowVisuals {
  onboardingParticleStyle: ParticleStyle;
  onboardingParticleIntensity: number;
  onboardingParticleCursor: boolean;
  onboardingGlass: boolean;
}

interface Props {
  visuals: Partial<FlowVisuals>;
  accent: string;
  noise?: boolean;
}

export default function FlowBackground({ visuals, accent, noise = true }: Props) {
  const particle = visuals.onboardingParticleStyle ?? 'constellation';
  const intensity = visuals.onboardingParticleIntensity ?? 1;
  const cursor = visuals.onboardingParticleCursor ?? true;

  return (
    <>
      {particle !== 'none' && (
        <div
          aria-hidden="true"
          style={{ position: 'absolute', inset: 0, zIndex: 0, pointerEvents: 'none' }}
        >
          <ParticleBackground
            style={particle}
            accent={accent}
            intensity={intensity}
            cursor={cursor}
          />
        </div>
      )}
      <div
        aria-hidden="true"
        style={{
          position: 'absolute',
          inset: 0,
          zIndex: 1,
          pointerEvents: 'none',
          background:
            'radial-gradient(ellipse 120% 80% at 50% 110%, rgba(6,5,8,0.82) 0%, transparent 60%),' +
            'radial-gradient(ellipse 120% 80% at 50% -10%, rgba(6,5,8,0.5) 0%, transparent 50%)',
        }}
      />
      {noise && (
        <div
          aria-hidden="true"
          style={{
            position: 'absolute',
            inset: 0,
            zIndex: 1,
            pointerEvents: 'none',
            opacity: 0.04,
            mixBlendMode: 'overlay',
            backgroundImage:
              "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")",
          }}
        />
      )}
    </>
  );
}
