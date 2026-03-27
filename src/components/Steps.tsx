'use client';

import styles from './Steps.module.css';

export interface StepsProps {
  currentStep: number;
  totalSteps: number;
  labels?: string[];
}

export function Steps({ currentStep, totalSteps, labels }: StepsProps) {
  return (
    <div className={styles.container}>
      {Array.from({ length: totalSteps }, (_, i) => {
        const step = i + 1;
        const isCompleted = step < currentStep;
        const isCurrent = step === currentStep;
        const label = labels?.[i];

        return (
          <div key={step} className={styles.stepWrapper}>
            <div
              className={`${styles.step} ${isCompleted ? styles.completed : ''} ${
                isCurrent ? styles.current : ''
              }`}
            >
              <div className={styles.dot}>
                {isCompleted ? (
                  <svg
                    width="12"
                    height="12"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="3"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                ) : (
                  <span>{step}</span>
                )}
              </div>
              {label && <span className={styles.label}>{label}</span>}
            </div>
            {i < totalSteps - 1 && (
              <div className={`${styles.connector} ${isCompleted ? styles.connectorCompleted : ''}`} />
            )}
          </div>
        );
      })}
    </div>
  );
}
