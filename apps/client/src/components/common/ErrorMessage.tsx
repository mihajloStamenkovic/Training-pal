import styles from './ErrorMessage.module.css';

interface ErrorMessageProps {
  message?: string;
  onRetry: () => void;
}

export default function ErrorMessage({ message, onRetry }: ErrorMessageProps) {
  return (
    <div className={styles.wrap}>
      <p className={styles.text}>{message ?? 'Something went wrong.'}</p>
      <button className={styles.retryBtn} onClick={onRetry}>
        Try Again
      </button>
    </div>
  );
}
