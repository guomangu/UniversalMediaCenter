import '@/global.css';
import { Platform } from 'react-native';

export const Colors = {
  light: {
    text: '#22262e',
    textSecondary: '#6e7987',
    background: '#232830',
    backgroundElement: 'rgba(45, 52, 63, 0.75)',
    backgroundSelected: 'rgba(60, 69, 82, 0.9)',
    cardBg: 'rgba(38, 44, 53, 0.85)',
    cardBorder: 'rgba(148, 163, 184, 0.15)',
    accent: '#64748b',
  },
  dark: {
    text: '#edeef2',
    textSecondary: '#94a0b0',
    background: '#1d2127',
    backgroundElement: 'rgba(40, 46, 56, 0.75)',
    backgroundSelected: 'rgba(54, 62, 75, 0.9)',
    cardBg: 'rgba(40, 46, 56, 0.85)',
    cardBorder: 'rgba(160, 175, 195, 0.14)',
    accent: '#7e92a8',
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
