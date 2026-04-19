-- Onboarding visual tweaks: particle background, layout, transition, glass.
-- Reuses existing accentColor, enableNoise, enableAnimations, borderRadius for
-- accent/noise/animate-in/radius so admins already have one control surface.

ALTER TABLE "Settings" ADD COLUMN "onboardingParticleStyle"     TEXT NOT NULL DEFAULT 'constellation';
ALTER TABLE "Settings" ADD COLUMN "onboardingParticleIntensity" REAL NOT NULL DEFAULT 1.0;
ALTER TABLE "Settings" ADD COLUMN "onboardingParticleCursor"    BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "Settings" ADD COLUMN "onboardingLayout"            TEXT NOT NULL DEFAULT 'centered';
ALTER TABLE "Settings" ADD COLUMN "onboardingTransition"        TEXT NOT NULL DEFAULT 'glide';
ALTER TABLE "Settings" ADD COLUMN "onboardingGlass"             BOOLEAN NOT NULL DEFAULT false;
