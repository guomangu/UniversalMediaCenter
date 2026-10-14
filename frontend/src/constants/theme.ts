import '@/global.css';
import { Platform } from 'react-native';

export const Colors = {
  light: {
    text: '#1e293b',
    textSecondary: '#64748b',
    background: '#f8fafc',
    backgroundElement: 'rgba(255, 255, 255, 0.75)',
    backgroundSelected: 'rgba(226, 232, 240, 0.9)',
    cardBg: 'rgba(255, 255, 255, 0.85)',
    cardBorder: 'rgba(226, 232, 240, 0.8)',
    accent: '#6366f1',
  },
  dark: {
    text: '#f1f5f9',
    textSecondary: '#94a3b8',
    background: '#0f172a',
    backgroundElement: 'rgba(30, 41, 59, 0.75)',
    backgroundSelected: 'rgba(51, 65, 85, 0.9)',
    cardBg: 'rgba(30, 41, 59, 0.85)',
    cardBorder: 'rgba(51, 65, 85, 0.6)',
    accent: '#818cf8',
  },
} as const;

export type ThemeColor = keyof typeof Colors.light;

export const Fonts = Platform.select({
  ios: {
    sans: 'system-ui',
    serif: 'ui-serif',
    rounded: 'ui-rounded',
    mono: 'ui-monospace',
  },
  default: {
    sans: 'normal',
    serif: 'serif',
    rounded: 'normal',
    mono: 'monospace',
  },
  web: {
    sans: 'var(--font-display)',
    serif: 'var(--font-serif)',
    rounded: 'var(--font-rounded)',
    mono: 'var(--font-mono)',
  },
});

export const Spacing = {
  half: 2,
  one: 4,
  two: 8,
  three: 16,
  four: 24,
  five: 32,
  six: 64,
} as const;

export const Radius = {
  sm: 12,
  md: 16,
  lg: 20,
  xl: 24,
  pill: 9999,
} as const;

export const BottomTabInset = Platform.select({ ios: 50, android: 80 }) ?? 0;
export const MaxContentWidth = 1400;
