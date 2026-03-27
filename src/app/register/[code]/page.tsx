'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { Button, Input, Steps } from '@/components';
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

export default function RegisterPage() {
  const router = useRouter();
  const params = useParams();
  const code = params.code as string;

  const { appearance } = useAppearance();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [inviteInfo, setInviteInfo] = useState<InviteInfo | null>(null);
  const [acceptedChecklist, setAcceptedChecklist] = useState(false);
  const [captchaQuestion, setCaptchaQuestion] = useState('');
  const [captchaAnswer, setCaptchaAnswer] = useState('');

  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const [passwordStrength, setPasswordStrength] = useState(0);
  const [requirements, setRequirements] = useState({
    length: false,
    lowercase: false,
    uppercase: false,
    number: false,
    special: false,
  });
  const [invalidInvite, setInvalidInvite] = useState(false);
  const verifiedRef = useRef(false);

  useEffect(() => {
    if (verifiedRef.current) return;
    verifiedRef.current = true;
    verifyInvite();
  }, [code]);

  useEffect(() => {
    const newRequirements = {
      length: password.length >= 8,
      lowercase: /[a-z]/.test(password),
      uppercase: /[A-Z]/.test(password),
      number: /[0-9]/.test(password),
      special: /[^a-zA-Z0-9]/.test(password),
    };
    setRequirements(newRequirements);

    const metCount = Object.values(newRequirements).filter(Boolean).length;
    setPasswordStrength(metCount);

    if (password.length === 0) {
      setPasswordStrength(0);
    } else if (metCount <= 2) {
      setPasswordStrength(1);
    } else if (metCount <= 4) {
      setPasswordStrength(2);
    } else {
      setPasswordStrength(3);
    }
  }, [password]);

  const verifyInvite = async () => {
    try {
      const res = await fetch(`/api/invites/verify/${code}`);
      if (res.status === 429) {
        return;
      }
      const data = await res.json();
      if (!res.ok || !data.valid) {
        setInvalidInvite(true);
      } else {
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
        if (data.captchaEnabled) {
          fetchCaptcha();
        }
      }
    } catch {
      setInvalidInvite(true);
    }
  };

  const fetchCaptcha = async () => {
    try {
      const res = await fetch(`/api/captcha?scope=register-${code.toUpperCase()}`);
      const data = await res.json();
      setCaptchaQuestion(data.question || '');
    } catch {
      setCaptchaQuestion('');
    }
  };

  const validateStep1 = () => {
    if (!email.trim()) {
      setError('Email is required');
      return false;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError('Please enter a valid email');
      return false;
    }
    if (!username.trim()) {
      setError('Username is required');
      return false;
    }
    if (!/^[a-zA-Z0-9_-]{3,20}$/.test(username)) {
      setError('Username must be 3-20 characters: letters, numbers, underscores, and dashes');
      return false;
    }
    setError('');
    return true;
  };

  const validateStep2 = () => {
    if (!password) {
      setError('Password is required');
      return false;
    }
    if (!Object.values(requirements).every(Boolean)) {
      setError('Password does not meet all requirements');
      return false;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return false;
    }
    setError('');
    return true;
  };

  const handleNext = () => {
    if (showIntroStep) {
      if (step === 1) {
        if (inviteInfo?.requireInviteAcceptance && !acceptedChecklist) {
          setError('You must confirm that you understand the invite instructions.');
          return;
        }
        setError('');
        setStep(2);
        return;
      }

      if (step === 2 && validateStep1()) {
        setStep(3);
      }
    } else if (step === 1 && validateStep1()) {
      setStep(2);
    }
  };

  const handleBack = () => {
    setStep((prev) => Math.max(1, prev - 1));
    setError('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateStep2()) return;

    setLoading(true);
    setError('');

    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code,
          email,
          username,
          password,
          captchaAnswer,
        }),
      });

      const data = await res.json();

      if (res.ok) {
        router.push('/onboarding');
      } else {
        setError(data.message || 'Registration failed');
      }
    } catch {
      setError('Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const getStrengthLabel = () => {
    if (passwordStrength === 0) return '';
    if (passwordStrength === 1) return 'Weak';
    if (passwordStrength === 2) return 'Medium';
    return 'Strong';
  };

  const getStrengthClass = () => {
    if (passwordStrength === 1) return 'weak';
    if (passwordStrength === 2) return 'medium';
    if (passwordStrength === 3) return 'strong';
    return '';
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

  if (!inviteInfo) {
    return null;
  }

  const showIntroStep =
    Boolean(inviteInfo.requireInviteAcceptance) ||
    Boolean(inviteInfo.preRegisterSubtitle) ||
    Boolean(inviteInfo.preRegisterChecklist && inviteInfo.preRegisterChecklist.length > 0);

  const totalSteps = showIntroStep ? 3 : 2;
  const labels = showIntroStep ? ['Intro', 'Account', 'Password'] : ['Account', 'Password'];
  const isAccountStep = showIntroStep ? step === 2 : step === 1;
  const isPasswordStep = showIntroStep ? step === 3 : step === 2;

  return (
    <div
      className={styles.container}
      data-animations={appearance?.enableAnimations !== false ? 'on' : 'off'}
      data-card-width={appearance?.cardWidth || 'default'}
      data-button-style={appearance?.buttonStyle || 'rounded'}
      data-input-style={appearance?.inputStyle || 'outlined'}
    >
      <div
        className={styles.background}
        data-bg-style={appearance?.backgroundStyle || 'gradient'}
        data-gradient-dir={appearance?.gradientDirection || 'top'}
        data-noise={appearance?.enableNoise !== false ? 'on' : 'off'}
        style={{
          ...(appearance?.backgroundStyle === 'image' && appearance.backgroundImageUrl
            ? { backgroundImage: `url(${appearance.backgroundImageUrl})` }
            : {}),
          ...({ '--bg-overlay-opacity': appearance?.backgroundOverlay ?? 0.7 } as React.CSSProperties),
        }}
      />

      <div className={styles.content}>
        <Link href="/" className={styles.backLink}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="19" y1="12" x2="5" y2="12" />
            <polyline points="12 19 5 12 12 5" />
          </svg>
          Back
        </Link>

        <div className={styles.header}>
          <h1 className={styles.title}>{appearance?.registerTitle || 'Create Your Account'}</h1>
          <p className={styles.subtitle}>
            Joining {inviteInfo.serverName}
          </p>
        </div>

        <div className={styles.card} data-card-style={appearance?.cardStyle || 'bordered'}>
          <div className={styles.stepsWrapper}>
            <Steps currentStep={step} totalSteps={totalSteps} labels={labels} />
          </div>

          <form onSubmit={handleSubmit} className={styles.form}>
            <div className={styles.stepContent} key={step}>
              {showIntroStep && step === 1 && (
                <>
                  <div className={styles.requirements}>
                    <Requirement label={inviteInfo.preRegisterTitle || 'Before You Start'} met />
                    {inviteInfo.preRegisterSubtitle && (
                      <div className={styles.requirement} style={{ alignItems: 'flex-start' }}>
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <circle cx="12" cy="12" r="10" />
                        </svg>
                        {inviteInfo.preRegisterSubtitle}
                      </div>
                    )}
                    {inviteInfo.preRegisterChecklist?.map((item) => (
                      <Requirement key={item} label={item} met={acceptedChecklist} />
                    ))}
                  </div>
                  {inviteInfo.requireInviteAcceptance && (
                    <label className={styles.requirement} style={{ cursor: 'pointer' }}>
                      <input
                        type="checkbox"
                        checked={acceptedChecklist}
                        onChange={(e) => setAcceptedChecklist(e.target.checked)}
                      />
                      I understand and accept these invite requirements.
                    </label>
                  )}
                  {error && <div className={styles.requirements}>{error}</div>}
                  <div className={styles.actions}>
                    <Button type="button" fullWidth onClick={handleNext}>
                      Continue
                    </Button>
                  </div>
                </>
              )}

              {isAccountStep && (
                <>
                  <Input
                    label="Email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    error={error && isAccountStep ? error : ''}
                    autoComplete="email"
                    autoFocus
                  />
                  <Input
                    label="Username"
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value.toLowerCase())}
                    error={error && isAccountStep ? error : ''}
                    autoComplete="username"
                  />
                  <div className={styles.actions}>
                    {showIntroStep && (
                      <Button type="button" variant="secondary" onClick={handleBack}>
                        Back
                      </Button>
                    )}
                    <Button type="button" fullWidth onClick={handleNext}>
                      Continue
                    </Button>
                  </div>
                </>
              )}

              {isPasswordStep && (
                <>
                  <Input
                    label="Password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    error={error && isPasswordStep ? error : ''}
                    autoComplete="new-password"
                    autoFocus
                  />
                  {password.length > 0 && (
                    <div className={styles.passwordStrength}>
                      <div className={styles.strengthBar}>
                        {[1, 2, 3].map((level) => (
                          <div
                            key={level}
                            className={`${styles.strengthSegment} ${
                              passwordStrength >= level ? `${styles.active} ${getStrengthClass()}` : ''
                            }`}
                          />
                        ))}
                      </div>
                      {passwordStrength > 0 && (
                        <span className={styles.strengthText}>
                          {getStrengthLabel()}
                        </span>
                      )}
                    </div>
                  )}
                  <div className={styles.requirements}>
                    <Requirement label="At least 8 characters" met={requirements.length} />
                    <Requirement label="One lowercase letter" met={requirements.lowercase} />
                    <Requirement label="One uppercase letter" met={requirements.uppercase} />
                    <Requirement label="One number" met={requirements.number} />
                    <Requirement label="One special character" met={requirements.special} />
                  </div>
                  <Input
                    label="Confirm Password"
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    error={error && isPasswordStep ? error : ''}
                    autoComplete="new-password"
                  />
                  {inviteInfo.captchaEnabled && (
                    <Input
                      label={`Captcha: ${captchaQuestion || 'Loading...'}`}
                      type="text"
                      value={captchaAnswer}
                      onChange={(e) => setCaptchaAnswer(e.target.value)}
                      error={error && isPasswordStep ? error : ''}
                    />
                  )}
                  <div className={styles.actions}>
                    <Button type="button" variant="secondary" onClick={handleBack}>
                      Back
                    </Button>
                    <Button type="submit" loading={loading}>
                      {appearance?.registerButtonText || 'Create Account'}
                    </Button>
                  </div>
                </>
              )}
            </div>
          </form>
        </div>
      </div>

      <div className={styles.branding} data-portalrr-branding="">
        Powered by&nbsp;<span className={styles.brandingName}>Portalrr</span>
      </div>
    </div>
  );
}

function Requirement({ label, met }: { label: string; met: boolean }) {
  return (
    <div className={`${styles.requirement} ${met ? styles.met : styles.unmet}`}>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        {met ? (
          <polyline points="20 6 9 17 4 12" />
        ) : (
          <circle cx="12" cy="12" r="10" />
        )}
      </svg>
      {label}
    </div>
  );
}
