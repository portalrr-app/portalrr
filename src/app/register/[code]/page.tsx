'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components';
import FlowBackground from '@/components/FlowBackground';
import { useAppearance } from '@/hooks/useAppearance';
import styles from './page.module.css';

interface InviteInfo {
  serverName: string;
  libraries: string[];
  accessUntil: string | null;
  preRegisterTitle?: string;
  preRegisterSubtitle?: string;
  preRegisterChecklist?: string[];
  requireInviteAcceptance?: boolean;
  captchaEnabled?: boolean;
}

type StepKey = 'invite' | 'rules' | 'details' | 'password';
interface StepMeta { key: StepKey; phase: string; label: string }

export default function RegisterPage() {
  const router = useRouter();
  const params = useParams();
  const code = params.code as string;

  const { appearance } = useAppearance();
  const [stepIdx, setStepIdx] = useState(0);
  const [dir, setDir] = useState<1 | -1>(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [inviteInfo, setInviteInfo] = useState<InviteInfo | null>(null);
  const [invalidInvite, setInvalidInvite] = useState(false);
  const [acceptedRules, setAcceptedRules] = useState<boolean[]>([]);
  const [captchaQuestion, setCaptchaQuestion] = useState('');
  const [captchaAnswer, setCaptchaAnswer] = useState('');

  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const verifiedRef = useRef(false);

  const requirements = useMemo(() => ({
    length: password.length >= 8,
    lowercase: /[a-z]/.test(password),
    uppercase: /[A-Z]/.test(password),
    number: /[0-9]/.test(password),
    special: /[^a-zA-Z0-9]/.test(password),
  }), [password]);

  const metCount = Object.values(requirements).filter(Boolean).length;
  const strengthLabel = metCount === 0 ? '' : metCount <= 2 ? 'Weak' : metCount <= 4 ? 'Medium' : 'Strong';
  const strengthClass = metCount <= 2 ? 'weak' : metCount <= 4 ? 'medium' : 'strong';

  useEffect(() => {
    if (verifiedRef.current) return;
    verifiedRef.current = true;
    (async () => {
      try {
        const res = await fetch(`/api/invites/verify/${code}`);
        if (res.status === 429) return;
        const data = await res.json();
        if (!res.ok || !data.valid) {
          setInvalidInvite(true);
          return;
        }
        setInviteInfo({
          serverName: data.serverName || 'Media Server',
          libraries: data.libraries || [],
          accessUntil: data.accessUntil || null,
          preRegisterTitle: data.preRegisterTitle || 'Before You Start',
          preRegisterSubtitle: data.preRegisterSubtitle || '',
          preRegisterChecklist: data.preRegisterChecklist || [],
          requireInviteAcceptance: data.requireInviteAcceptance || false,
          captchaEnabled: data.captchaEnabled || false,
        });
        setAcceptedRules((data.preRegisterChecklist || []).map(() => false));
        if (data.captchaEnabled) {
          try {
            const c = await fetch(`/api/captcha?scope=register-${code.toUpperCase()}`);
            const cd = await c.json();
            setCaptchaQuestion(cd.question || '');
          } catch { /* ignore */ }
        }
      } catch {
        setInvalidInvite(true);
      }
    })();
  }, [code]);

  const steps: StepMeta[] = useMemo(() => {
    const s: StepMeta[] = [{ key: 'invite', phase: 'Join', label: 'Invite' }];
    const hasRules =
      (inviteInfo?.preRegisterChecklist && inviteInfo.preRegisterChecklist.length > 0) ||
      Boolean(inviteInfo?.requireInviteAcceptance);
    if (hasRules) s.push({ key: 'rules', phase: 'Join', label: 'Rules' });
    s.push({ key: 'details', phase: 'Account', label: 'Details' });
    s.push({ key: 'password', phase: 'Account', label: 'Password' });
    return s;
  }, [inviteInfo]);

  const current = steps[stepIdx];

  const go = (delta: 1 | -1) => {
    const next = Math.max(0, Math.min(steps.length - 1, stepIdx + delta));
    if (next === stepIdx) return;
    setError('');
    setDir(delta);
    setStepIdx(next);
  };

  const jumpTo = (i: number) => {
    if (i === stepIdx) return;
    setError('');
    setDir(i > stepIdx ? 1 : -1);
    setStepIdx(i);
  };

  // Keyboard navigation
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') return;
      if (e.key === 'ArrowLeft' && stepIdx > 0) go(-1);
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [stepIdx, steps.length]);

  const acceptInvite = () => go(1);
  const declineInvite = () => router.push('/');

  const acceptAllRules = () => {
    const allAccepted = acceptedRules.every(Boolean);
    if (!allAccepted && (inviteInfo?.preRegisterChecklist?.length ?? 0) > 0) {
      setError('Please accept each item to continue.');
      return;
    }
    go(1);
  };

  const validateDetails = () => {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError('Enter a valid email.');
      return false;
    }
    if (!/^[a-zA-Z0-9_-]{3,20}$/.test(username)) {
      setError('Username must be 3–20 chars: letters, numbers, _ and –.');
      return false;
    }
    setError('');
    return true;
  };

  const handleDetailsNext = () => {
    if (validateDetails()) go(1);
  };

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!Object.values(requirements).every(Boolean)) {
      setError('Password does not meet all requirements.');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }
    setError('');
    setLoading(true);
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code, email, username, password, captchaAnswer }),
      });
      const data = await res.json();
      if (res.ok) {
        router.push('/onboarding');
      } else {
        // Surface field-level Zod errors so users can see exactly what's wrong
        // ("Validation failed" on its own is unactionable).
        if (Array.isArray(data.errors) && data.errors.length > 0) {
          const detail = data.errors
            .map((e: { field?: string; message?: string }) =>
              e.field ? `${e.field}: ${e.message}` : e.message,
            )
            .filter(Boolean)
            .join(' · ');
          setError(detail || data.message || 'Registration failed');
        } else {
          setError(data.message || 'Registration failed');
        }
      }
    } catch {
      setError('Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (invalidInvite) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', flexDirection: 'column', gap: 16 }}>
        <h2 style={{ color: 'var(--text-primary)', fontSize: 20 }}>Invalid or expired invite</h2>
        <p style={{ color: 'var(--text-secondary)', fontSize: 14 }}>This invite code is no longer valid.</p>
        <Button onClick={() => router.push('/')}>Back to Home</Button>
      </div>
    );
  }

  if (!inviteInfo) return null;

  const accent = appearance?.accentColor || '#A78BFA';
  const particleActive = appearance?.onboardingParticleStyle && appearance.onboardingParticleStyle !== 'none';

  return (
    <div
      className={styles.app}
      data-animations={appearance?.enableAnimations !== false ? 'on' : 'off'}
      data-layout={appearance?.onboardingLayout || 'centered'}
      data-glass={appearance?.onboardingGlass ? 'on' : 'off'}
      data-transition={appearance?.onboardingTransition || 'glide'}
      data-noise={appearance?.enableNoise !== false ? 'on' : 'off'}
    >
      {particleActive && (
        <FlowBackground
          visuals={{
            onboardingParticleStyle: appearance?.onboardingParticleStyle,
            onboardingParticleIntensity: appearance?.onboardingParticleIntensity,
            onboardingParticleCursor: appearance?.onboardingParticleCursor,
          }}
          accent={accent}
          noise={appearance?.enableNoise !== false}
        />
      )}
      {!particleActive && <div className={styles.gradientBg} />}

      <header className={styles.topbar}>
        <Link href="/" className={styles.brand}>
          <div className={styles.brandMark}>
            <PortalrrMark />
          </div>
          <div className={styles.brandText}>
            <div className={styles.brandName}>{appearance?.appName || 'Portalrr'}</div>
            <div className={styles.brandSub}>{inviteInfo.serverName}</div>
          </div>
        </Link>
        <div className={styles.phaseTag}>
          <span className={styles.phaseDot} />
          {current.phase} · {String(stepIdx + 1).padStart(2, '0')}/{String(steps.length).padStart(2, '0')}
        </div>
      </header>

      <nav className={styles.stepper} aria-label="Progress">
        {steps.map((s, i) => (
          <button
            key={s.key}
            type="button"
            className={`${styles.pip} ${i === stepIdx ? styles.pipCurrent : ''} ${i < stepIdx ? styles.pipDone : ''}`}
            onClick={() => jumpTo(i)}
            aria-label={`Step ${i + 1}: ${s.label}`}
            aria-current={i === stepIdx ? 'step' : undefined}
          >
            <span className={styles.pipPhase}>{s.phase}</span>
            <span className={styles.pipLabel}>{s.label}</span>
            <span className={styles.pipBar}><span className={styles.pipFill} /></span>
          </button>
        ))}
      </nav>

      <main className={styles.stage}>
        <div
          className={styles.stageCard}
          key={stepIdx}
          data-dir={dir}
        >
          {current.key === 'invite' && (
            <StepInvite
              info={inviteInfo}
              onAccept={acceptInvite}
              onDecline={declineInvite}
            />
          )}
          {current.key === 'rules' && (
            <StepRules
              info={inviteInfo}
              accepted={acceptedRules}
              setAccepted={setAcceptedRules}
              error={error}
              onBack={() => go(-1)}
              onContinue={acceptAllRules}
            />
          )}
          {current.key === 'details' && (
            <StepDetails
              email={email}
              setEmail={setEmail}
              username={username}
              setUsername={setUsername}
              error={error}
              onBack={() => go(-1)}
              onContinue={handleDetailsNext}
            />
          )}
          {current.key === 'password' && (
            <StepPassword
              password={password}
              setPassword={setPassword}
              confirmPassword={confirmPassword}
              setConfirmPassword={setConfirmPassword}
              requirements={requirements}
              strengthLabel={strengthLabel}
              strengthClass={strengthClass}
              metCount={metCount}
              captchaEnabled={inviteInfo.captchaEnabled || false}
              captchaQuestion={captchaQuestion}
              captchaAnswer={captchaAnswer}
              setCaptchaAnswer={setCaptchaAnswer}
              error={error}
              loading={loading}
              onBack={() => go(-1)}
              onSubmit={handleSubmit}
              submitLabel={appearance?.registerButtonText || 'Create account'}
            />
          )}
        </div>
      </main>
    </div>
  );
}

function StepInvite({
  info,
  onAccept,
  onDecline,
}: {
  info: InviteInfo;
  onAccept: () => void;
  onDecline: () => void;
}) {
  return (
    <div className={styles.paneCenter}>
      <div className={styles.emblem} aria-hidden="true">
        <span className={styles.emblemRing} />
        <span className={`${styles.emblemRing} ${styles.emblemRing2}`} />
        <div className={styles.emblemCore}>
          <PortalrrMark />
        </div>
      </div>
      <div className={styles.kicker}>You&apos;ve been invited</div>
      <h1 className={styles.displayTitle}>Join {info.serverName}.</h1>
      <p className={styles.displaySub}>
        Review what&apos;s included and accept the invite to create your account.
      </p>

      <div className={styles.inviteSummary}>
        {info.libraries.length > 0 && (
          <div className={styles.inviteRow}>
            <span className={styles.inviteLabel}>Libraries</span>
            <span className={styles.inviteValue}>
              {info.libraries.map((l) => (
                <span key={l} className={styles.tag}>{l}</span>
              ))}
            </span>
          </div>
        )}
        <div className={styles.inviteRow}>
          <span className={styles.inviteLabel}>Access until</span>
          <span className={`${styles.inviteValue} ${styles.mono}`}>
            {info.accessUntil
              ? new Date(info.accessUntil).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
              : 'No expiry'}
          </span>
        </div>
      </div>

      <div className={styles.ctaRow}>
        <button type="button" className={styles.ghostBtn} onClick={onDecline}>Decline</button>
        <button type="button" className={styles.ctaPrimary} onClick={onAccept}>
          Accept invite
          <IconArrow />
        </button>
      </div>
    </div>
  );
}

function StepRules({
  info,
  accepted,
  setAccepted,
  error,
  onBack,
  onContinue,
}: {
  info: InviteInfo;
  accepted: boolean[];
  setAccepted: (next: boolean[]) => void;
  error: string;
  onBack: () => void;
  onContinue: () => void;
}) {
  const rules = info.preRegisterChecklist ?? [];
  const requireConfirmation = Boolean(info.requireInviteAcceptance);
  const [finalConfirm, setFinalConfirm] = useState(false);
  const allAccepted = accepted.every(Boolean) && (!requireConfirmation || finalConfirm);

  return (
    <div className={styles.paneLeft}>
      <div className={styles.kicker}>Step 02 · House rules</div>
      <h2 className={styles.sectionTitle}>{info.preRegisterTitle || 'A few things before we continue.'}</h2>
      {info.preRegisterSubtitle && <p className={styles.sectionSub}>{info.preRegisterSubtitle}</p>}

      {rules.length > 0 && (
        <div className={styles.rulesList}>
          {rules.map((rule, i) => (
            <button
              key={i}
              type="button"
              className={`${styles.rule} ${accepted[i] ? styles.ruleOn : ''}`}
              onClick={() => {
                const next = [...accepted];
                next[i] = !next[i];
                setAccepted(next);
              }}
              style={{ ['--r-delay' as string]: `${i * 60}ms` }}
            >
              <span className={styles.ruleCheck}>
                {accepted[i] ? (
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                ) : (
                  <span className={styles.ruleDot} />
                )}
              </span>
              <span className={styles.ruleBody}>
                <span className={styles.ruleText}>{rule}</span>
              </span>
            </button>
          ))}
        </div>
      )}

      {requireConfirmation && (
        <label className={styles.confirmRow}>
          <input
            type="checkbox"
            checked={finalConfirm}
            onChange={(e) => setFinalConfirm(e.target.checked)}
          />
          <span>I understand and accept these invite requirements.</span>
        </label>
      )}

      {error && <div className={styles.formError}>{error}</div>}

      <div className={styles.ctaRow}>
        <button type="button" className={styles.ghostBtn} onClick={onBack}>Back</button>
        <button
          type="button"
          className={styles.ctaPrimary}
          onClick={onContinue}
          disabled={!allAccepted}
        >
          {allAccepted
            ? 'Accept & continue'
            : rules.length > 0
              ? `${accepted.filter(Boolean).length} of ${rules.length} accepted`
              : 'Confirm to continue'}
          <IconArrow />
        </button>
      </div>
    </div>
  );
}

function StepDetails({
  email,
  setEmail,
  username,
  setUsername,
  error,
  onBack,
  onContinue,
}: {
  email: string;
  setEmail: (v: string) => void;
  username: string;
  setUsername: (v: string) => void;
  error: string;
  onBack: () => void;
  onContinue: () => void;
}) {
  return (
    <div className={styles.paneLeft}>
      <div className={styles.kicker}>Step 03 · Your details</div>
      <h2 className={styles.sectionTitle}>Who are you?</h2>
      <p className={styles.sectionSub}>
        Your username becomes your login. Email is used for password resets only.
      </p>

      <div className={styles.fieldGrid}>
        <label className={styles.fld}>
          <span className={styles.fldLabel}>Email</span>
          <span className={styles.fldWrap}>
            <span className={styles.fldIcon}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
                <polyline points="22,6 12,13 2,6" />
              </svg>
            </span>
            <input
              type="email"
              value={email}
              autoFocus
              placeholder="you@example.com"
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
            />
          </span>
        </label>
        <label className={styles.fld}>
          <span className={styles.fldLabel}>Username</span>
          <span className={styles.fldWrap}>
            <span className={styles.fldIcon}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                <circle cx="12" cy="7" r="4" />
              </svg>
            </span>
            <input
              type="text"
              value={username}
              placeholder="jonas"
              onChange={(e) => setUsername(e.target.value.toLowerCase())}
              autoComplete="username"
            />
          </span>
          <span className={styles.fldHint}>3–20 chars · letters, numbers, _ and –</span>
        </label>
      </div>

      {error && <div className={styles.formError}>{error}</div>}

      <div className={styles.ctaRow}>
        <button type="button" className={styles.ghostBtn} onClick={onBack}>Back</button>
        <button type="button" className={styles.ctaPrimary} onClick={onContinue}>
          Continue <IconArrow />
        </button>
      </div>
    </div>
  );
}

function StepPassword({
  password,
  setPassword,
  confirmPassword,
  setConfirmPassword,
  requirements,
  strengthLabel,
  strengthClass,
  metCount,
  captchaEnabled,
  captchaQuestion,
  captchaAnswer,
  setCaptchaAnswer,
  error,
  loading,
  onBack,
  onSubmit,
  submitLabel,
}: {
  password: string;
  setPassword: (v: string) => void;
  confirmPassword: string;
  setConfirmPassword: (v: string) => void;
  requirements: { length: boolean; lowercase: boolean; uppercase: boolean; number: boolean; special: boolean };
  strengthLabel: string;
  strengthClass: 'weak' | 'medium' | 'strong';
  metCount: number;
  captchaEnabled: boolean;
  captchaQuestion: string;
  captchaAnswer: string;
  setCaptchaAnswer: (v: string) => void;
  error: string;
  loading: boolean;
  onBack: () => void;
  onSubmit: (e?: React.FormEvent) => void;
  submitLabel: string;
}) {
  return (
    <form className={styles.paneLeft} onSubmit={onSubmit}>
      <div className={styles.kicker}>Step 04 · Set a password</div>
      <h2 className={styles.sectionTitle}>Lock it down.</h2>
      <p className={styles.sectionSub}>
        This password protects your streams. Make it unique — don&apos;t reuse.
      </p>

      <div className={styles.fieldGrid}>
        <label className={styles.fld}>
          <span className={styles.fldLabel}>Password</span>
          <span className={styles.fldWrap}>
            <span className={styles.fldIcon}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                <path d="M7 11V7a5 5 0 0 1 10 0v4" />
              </svg>
            </span>
            <input
              type="password"
              value={password}
              autoFocus
              placeholder="••••••••••"
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="new-password"
            />
          </span>
        </label>
        <label className={styles.fld}>
          <span className={styles.fldLabel}>Confirm password</span>
          <span className={styles.fldWrap}>
            <span className={styles.fldIcon}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
              </svg>
            </span>
            <input
              type="password"
              value={confirmPassword}
              placeholder="••••••••••"
              onChange={(e) => setConfirmPassword(e.target.value)}
              autoComplete="new-password"
            />
          </span>
        </label>
      </div>

      {password.length > 0 && (
        <div className={styles.strength}>
          <div className={styles.strengthBar}>
            {[1, 2, 3].map((lv) => {
              const on = metCount >= (lv === 1 ? 1 : lv === 2 ? 3 : 5);
              return (
                <div
                  key={lv}
                  className={`${styles.strengthSeg} ${on ? styles[`str_${strengthClass}`] : ''}`}
                />
              );
            })}
          </div>
          <span className={`${styles.strengthLabel} ${styles[`str_${strengthClass}`]}`}>
            {strengthLabel}
          </span>
        </div>
      )}

      <div className={styles.reqs}>
        <Req met={requirements.length}>8+ characters</Req>
        <Req met={requirements.lowercase}>lowercase</Req>
        <Req met={requirements.uppercase}>UPPERCASE</Req>
        <Req met={requirements.number}>number</Req>
        <Req met={requirements.special}>special character</Req>
      </div>

      {captchaEnabled && (
        <label className={styles.fld}>
          <span className={styles.fldLabel}>
            Captcha: {captchaQuestion || 'Loading...'}
          </span>
          <span className={styles.fldWrap}>
            <input
              type="text"
              value={captchaAnswer}
              onChange={(e) => setCaptchaAnswer(e.target.value)}
              placeholder="Your answer"
            />
          </span>
        </label>
      )}

      {error && <div className={styles.formError}>{error}</div>}

      <div className={styles.ctaRow}>
        <button type="button" className={styles.ghostBtn} onClick={onBack}>Back</button>
        <button type="submit" className={styles.ctaPrimary} disabled={loading}>
          {loading ? (
            <>
              <span className={styles.spinner} /> Creating account…
            </>
          ) : (
            <>{submitLabel} <IconArrow /></>
          )}
        </button>
      </div>
    </form>
  );
}

function Req({ met, children }: { met: boolean; children: React.ReactNode }) {
  return (
    <span className={`${styles.req} ${met ? styles.reqMet : ''}`}>
      <span className={styles.reqDot}>
        {met && (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12" />
          </svg>
        )}
      </span>
      {children}
    </span>
  );
}

function IconArrow() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="5" y1="12" x2="19" y2="12" />
      <polyline points="12 5 19 12 12 19" />
    </svg>
  );
}

function PortalrrMark() {
  return (
    <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <rect x="3" y="3" width="18" height="18" rx="4" style={{ fill: 'var(--accent)' }} />
      <rect x="7" y="7" width="10" height="10" rx="2.5" style={{ fill: '#0A0A0A' }} />
      <rect x="9.5" y="9.5" width="5" height="5" rx="1.5" style={{ fill: 'var(--accent)' }} />
    </svg>
  );
}
