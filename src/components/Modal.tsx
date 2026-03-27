'use client';

import { HTMLAttributes, forwardRef, useEffect, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import styles from './Modal.module.css';

export interface ModalProps extends HTMLAttributes<HTMLDivElement> {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  description?: string;
  size?: 'sm' | 'md' | 'lg';
}

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

export const Modal = forwardRef<HTMLDivElement, ModalProps>(
  (
    {
      children,
      isOpen,
      onClose,
      title,
      description,
      size = 'md',
      className = '',
      ...props
    },
    ref
  ) => {
    const modalRef = useRef<HTMLDivElement | null>(null);
    const previousFocusRef = useRef<HTMLElement | null>(null);

    const handleKeyDown = useCallback(
      (e: KeyboardEvent) => {
        if (e.key === 'Escape') {
          onClose();
          return;
        }

        // Focus trap
        if (e.key === 'Tab' && modalRef.current) {
          const focusable = modalRef.current.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR);
          if (focusable.length === 0) return;

          const first = focusable[0];
          const last = focusable[focusable.length - 1];

          if (e.shiftKey) {
            if (document.activeElement === first) {
              e.preventDefault();
              last.focus();
            }
          } else {
            if (document.activeElement === last) {
              e.preventDefault();
              first.focus();
            }
          }
        }
      },
      [onClose]
    );

    useEffect(() => {
      if (isOpen) {
        previousFocusRef.current = document.activeElement as HTMLElement;
        document.addEventListener('keydown', handleKeyDown);
        document.body.style.overflow = 'hidden';

        // Focus first focusable element inside modal
        requestAnimationFrame(() => {
          if (modalRef.current) {
            const first = modalRef.current.querySelector<HTMLElement>(FOCUSABLE_SELECTOR);
            if (first) first.focus();
          }
        });
      }
      return () => {
        document.removeEventListener('keydown', handleKeyDown);
        document.body.style.overflow = '';

        // Restore focus to previously focused element
        if (previousFocusRef.current && typeof previousFocusRef.current.focus === 'function') {
          previousFocusRef.current.focus();
        }
      };
    }, [isOpen, handleKeyDown]);

    if (!isOpen) return null;

    const setRefs = (node: HTMLDivElement | null) => {
      modalRef.current = node;
      if (typeof ref === 'function') {
        ref(node);
      } else if (ref) {
        (ref as React.MutableRefObject<HTMLDivElement | null>).current = node;
      }
    };

    const modalContent = (
      <div className={styles.overlay} onClick={onClose}>
        <div
          ref={setRefs}
          className={`${styles.modal} ${styles[size]} ${className}`}
          onClick={(e) => e.stopPropagation()}
          role="dialog"
          aria-modal="true"
          aria-labelledby={title ? 'modal-title' : undefined}
          aria-describedby={description ? 'modal-description' : undefined}
          {...props}
        >
          <button className={styles.closeButton} onClick={onClose} aria-label="Close modal">
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
          {title && (
            <div className={styles.header}>
              <h2 id="modal-title" className={styles.title}>
                {title}
              </h2>
              {description && (
                <p id="modal-description" className={styles.description}>
                  {description}
                </p>
              )}
            </div>
          )}
          <div className={styles.content}>{children}</div>
        </div>
      </div>
    );

    if (typeof window === 'undefined') return null;
    return createPortal(modalContent, document.body);
  }
);

Modal.displayName = 'Modal';
