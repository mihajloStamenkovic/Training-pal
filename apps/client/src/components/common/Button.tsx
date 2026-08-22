import type { ButtonHTMLAttributes } from 'react';
import styles from './Button.module.css';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  fullWidth?: boolean;
  /** The one action a screen exists for — taller, slightly larger label. */
  lead?: boolean;
}

export default function Button({
  variant = 'primary',
  fullWidth = false,
  lead = false,
  className = '',
  children,
  ...props
}: ButtonProps) {
  return (
    <button
      className={`${styles.btn} ${styles[variant]} ${fullWidth ? styles.full : ''} ${lead ? styles.lead : ''} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}
