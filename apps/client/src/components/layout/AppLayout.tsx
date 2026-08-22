import { Outlet } from 'react-router-dom';
import BottomTabBar from './BottomTabBar';
import { TOP_NAV } from './nav';
import styles from './AppLayout.module.css';

export default function AppLayout() {
  return (
    <div className={styles.layout}>
      <main className={styles.content}>
        <Outlet />
      </main>
      {/* The top nav lives in each page's header row (see PageHeader), so
          there is nothing to render down here while TOP_NAV is on. */}
      {!TOP_NAV && <BottomTabBar />}
    </div>
  );
}
