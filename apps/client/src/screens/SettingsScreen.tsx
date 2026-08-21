import { useClerk } from '@clerk/clerk-react';
import styles from './SettingsScreen.module.css';

export default function SettingsScreen() {
  const clerk = useClerk();

  return (
    <div className="page">
      <h1 className="page-title">Settings</h1>

      <div className={styles.sections}>
        <div className={styles.section}>
          <h2 className={styles.sectionTitle}>Account</h2>
          <button className={styles.exportBtn} onClick={() => clerk.signOut()}>
            Sign Out
          </button>
        </div>

        <div className={styles.section}>
          <h2 className={styles.sectionTitle}>Data</h2>
          <button className={styles.exportBtn} disabled>
            Export Data (Coming Soon)
          </button>
        </div>

        <div className={styles.footer}>
          <p className={styles.version}>Training Pal v1.0.0</p>
          <p className={styles.footerText}>
            All data is stored locally on your device.
          </p>
        </div>
      </div>
    </div>
  );
}
