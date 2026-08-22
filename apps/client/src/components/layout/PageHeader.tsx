import type { ReactNode } from 'react';
import TopNav from './TopNav';
import styles from './PageHeader.module.css';

interface PageHeaderProps {
  /** The small uppercase context line — date, rotation length, version. */
  eyebrow: ReactNode;
}

export default function PageHeader({ eyebrow }: PageHeaderProps) {
  return (
    <div className={styles.header}>
      <div className={styles.eyebrow}>
        <span className={styles.dash} />
        <span className={styles.eyebrowText}>{eyebrow}</span>
      </div>
      <TopNav />
    </div>
  );
}
