import { SignIn } from '@clerk/clerk-react';
import styles from './SignInScreen.module.css';

/**
 * Mirrors theme.css. Clerk derives shades from `variables` colours, so those
 * have to be real values rather than var() references — keeping them named
 * here at least means one place to change when the theme moves.
 */
const palette = {
  accent: '#9184d9',
  ground: '#161826',
  text: '#e9e9ed',
  textSecondary: 'rgba(233,233,237,.55)',
  divider: 'rgba(233,233,237,.14)',
  dividerText: 'rgba(233,233,237,.4)',
} as const;

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
                  colorPrimary: palette.accent,
                  colorBackground: palette.ground,
                  colorInputBackground: 'transparent',
                  colorInputText: palette.text,
                  colorText: palette.text,
                  colorTextSecondary: palette.textSecondary,
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
                    color: 'var(--text-muted)',
                    fontWeight: '500',
                  },
                  formFieldInput: {
                    background: 'transparent',
                    border: 'none',
                    borderBottom: '1px solid var(--border)',
                    borderRadius: '0',
                    padding: '0 0 9px',
                    fontSize: '16px',
                    boxShadow: 'none',
                  },
                  formButtonPrimary: {
                    background: 'transparent',
                    border: '1px solid var(--accent)',
                    color: 'var(--accent)',
                    boxShadow: 'none',
                    minHeight: '56px',
                    fontSize: '16px',
                    fontWeight: '500',
                    textTransform: 'none',
                  },
                  socialButtonsBlockButton: {
                    background: 'transparent',
                    border: '1px solid var(--border)',
                    color: 'var(--text-primary)',
                    minHeight: '52px',
                    fontSize: '14.5px',
                    fontWeight: '500',
                  },
                  dividerLine: { background: palette.divider },
                  dividerText: {
                    fontSize: '10px',
                    letterSpacing: '0.1em',
                    textTransform: 'uppercase',
                    color: palette.dividerText,
                  },
                  footer: { background: 'transparent' },
                  footerActionText: { fontSize: '12.5px', color: 'var(--text-muted)' },
                  footerActionLink: { color: 'var(--accent)', fontWeight: '500' },
                },
              }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
