import { SignIn } from '@clerk/clerk-react';
import styles from './SignInScreen.module.css';

export default function SignInScreen() {
  return (
    <div className={styles.page}>
      <SignIn
        routing="hash"
        appearance={{
          variables: {
            colorPrimary: '#22c55e',
            colorBackground: '#141419',
            colorInputBackground: '#1a1a22',
            colorInputText: '#f0f0f5',
            colorText: '#f0f0f5',
            colorTextSecondary: '#8a8a9a',
            borderRadius: '12px',
          },
        }}
      />
    </div>
  );
}
