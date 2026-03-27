'use client';

import styles from './StatusBadge.module.css';

export interface StatusBadgeProps {
  status: 'active' | 'pending' | 'used' | 'expired' | 'cancelled';
  label?: string;
}

const defaultLabels: Record<StatusBadgeProps['status'], string> = {
  active: 'Active',
  pending: 'Pending',
  used: 'Used',
  expired: 'Expired',
  cancelled: 'Cancelled',
};

export function StatusBadge({ status, label }: StatusBadgeProps) {
  return (
    <span className={`${styles.badge} ${styles[status]}`}>
      <span className={styles.dot} />
      {label || defaultLabels[status]}
    </span>
  );
}
