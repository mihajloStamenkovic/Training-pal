import { NavLink } from 'react-router-dom';
import { Target, ListChecks, SlidersHorizontal } from '@phosphor-icons/react';
import styles from './TopNav.module.css';

const tabs = [
  { to: '/', label: 'Today', Icon: Target },
  { to: '/program', label: 'Program', Icon: ListChecks },
  { to: '/settings', label: 'Settings', Icon: SlidersHorizontal },
];

export default function TopNav() {
  return (
    <nav className={styles.nav}>
      {tabs.map(({ to, label, Icon }) => (
        <NavLink
          key={to}
          to={to}
          end={to === '/'}
          aria-label={label}
          className={({ isActive }) => `${styles.tab} ${isActive ? styles.active : ''}`}
        >
          {({ isActive }) => <Icon size={18} weight={isActive ? 'fill' : 'regular'} />}
        </NavLink>
      ))}
    </nav>
  );
}
