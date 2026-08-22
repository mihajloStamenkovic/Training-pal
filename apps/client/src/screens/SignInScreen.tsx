import { SignIn } from '@clerk/clerk-react';
import styles from './SignInScreen.module.css';

export default function SignInScreen() {
  return (
    <div className={styles.page}>
      <div className={styles.glow} />
      <div className={styles.inner}>
        <div className={styles.eyebrow}>
          <span className={styles.dash} />
          Training Pal
        </div>

        <div className={styles.body}>
          <h1 className={styles.headline}>
            Log the set.
            <br />
            Nothing else.
          </h1>
          <p className={styles.sub}>
            Your rotation, your last numbers, and a rest timer. No feed, no streaks, no coaching.
          </p>

          <div className={styles.form}>
            <SignIn
              routing="hash"
              appearance={{
                variables: {
                  colorPrimary: '#9184d9',
                  colorBackground: '#161826',
                  colorInputBackground: 'transparent',
                  colorInputText: '#e9e9ed',
                  colorText: '#e9e9ed',
                  colorTextSecondary: 'rgba(233,233,237,.55)',
                  borderRadius: '8px',
                  fontFamily: "'Inter', system-ui, sans-serif",
                },
                elements: {
                  // The headline above already says what this is, so Clerk's
                  // own header and card chrome come off.
                  rootBox: { width: '100%' },
                  cardBox: { boxShadow: 'none', border: 'none', width: '100%' },
                  card: {
                    background: 'transparent',
                    boxShadow: 'none',
                    border: 'none',
                    padding: '0',
                  },
                  header: { display: 'none' },
                  formFieldLabel: {
                    fontSize: '10px',
                    letterSpacing: '0.1em',
                    textTransform: 'uppercase',
                    color: 'rgba(233,233,237,.45)',
                    fontWeight: '500',
                  },
                  formFieldInput: {
                    background: 'transparent',
                    border: 'none',
                    borderBottom: '1px solid rgba(233,233,237,.16)',
                    borderRadius: '0',
                    padding: '0 0 9px',
                    fontSize: '16px',
                    boxShadow: 'none',
                  },
                  formButtonPrimary: {
                    background: 'transparent',
                    border: '1px solid #9184d9',
                    color: '#9184d9',
                    boxShadow: 'none',
                    minHeight: '56px',
                    fontSize: '16px',
                    fontWeight: '500',
                    textTransform: 'none',
                  },
                  socialButtonsBlockButton: {
                    background: 'transparent',
                    border: '1px solid rgba(233,233,237,.16)',
                    color: '#e9e9ed',
                    minHeight: '52px',
                    fontSize: '14.5px',
                    fontWeight: '500',
                  },
                  dividerLine: { background: 'rgba(233,233,237,.14)' },
                  dividerText: {
                    fontSize: '10px',
                    letterSpacing: '0.1em',
                    textTransform: 'uppercase',
                    color: 'rgba(233,233,237,.4)',
                  },
                  footer: { background: 'transparent' },
                  footerActionText: { fontSize: '12.5px', color: 'rgba(233,233,237,.45)' },
                  footerActionLink: { color: '#9184d9', fontWeight: '500' },
                },
              }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
