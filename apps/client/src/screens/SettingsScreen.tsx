import { useClerk } from '@clerk/clerk-react';
import PageHeader from '../components/layout/PageHeader';
import styles from './SettingsScreen.module.css';

const VERSION = 'v1.0.0';

export default function SettingsScreen() {
  const clerk = useClerk();

  return (
    <div className="page page-flush">
      <PageHeader eyebrow={VERSION} />

      <h1 className="page-title">Settings</h1>

      <div className={`section-label ${styles.sectionLabel}`}>Account</div>
      <div className={styles.row}>
        <span className={styles.rowLabel}>Sign out</span>
        <button className={styles.rowBtn} onClick={() => clerk.signOut()}>
          Sign out
        </button>
      </div>

      <div className={`section-label ${styles.sectionLabel}`}>Data</div>
      <div className={styles.row}>
        <span className={`${styles.rowLabel} ${styles.rowLabelMuted}`}>Export data</span>
        <span className={styles.tag}>coming soon</span>
      </div>

      <div className={styles.footerRule} />
      <p className={styles.footerText}>
        Training Pal {VERSION}
        <br />
        All data is stored locally on your device.
      </p>
    </div>
  );
}
