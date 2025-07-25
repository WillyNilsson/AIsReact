import { Platform } from 'react-native';

// API Configuration
export const API_BASE_URL = Platform.select({
  ios: 'http://localhost:8000/api',
  android: 'http://10.0.2.2:8000/api',
  default: 'http://localhost:8000/api',
});

// Colors matching the web app
export const Colors = {
  // Background colors
  backgroundPrimary: '#1a1b26',
  backgroundSecondary: '#24283b',
  backgroundTertiary: '#2f3549',
  
  // Text colors
  textPrimary: '#c0caf5',
  textSecondary: '#9aa5ce',
  textTertiary: '#787c99',
  
  // Brand colors
  brandPrimary: '#7aa2f7',
  brandSecondary: '#5d7bc1',
  brandTertiary: '#89b4fa',
  accent: '#7aa2f7',
  
  // Semantic colors
  success: '#9ece6a',
  successLight: '#b9d87f',
  warning: '#e0af68',
  warningLight: '#e9c37d',
  error: '#f7768e',
  errorLight: '#f98ca4',
  info: '#7dcfff',
  infoLight: '#92d9ff',
  
  // AI Provider colors
  providerOpenai: '#9ece6a',
  providerGoogle: '#7aa2f7',
  providerAnthropic: '#ff9e64',
  providerXai: '#bb9af7',
  providerDeepseek: '#f7768e',
  
  // Component colors
  border: '#414868',
  borderMuted: '#373d52',
  borderEmphasis: '#565f89',
};

// Typography
export const Typography = {
  fontSizes: {
    xs: 12,
    sm: 14,
    base: 16,
    lg: 18,
    xl: 20,
    '2xl': 24,
    '3xl': 30,
    '4xl': 36,
  },
  fontWeights: {
    regular: '400' as const,
    medium: '500' as const,
    semibold: '600' as const,
    bold: '700' as const,
  },
  lineHeights: {
    tight: 1.2,
    base: 1.5,
    relaxed: 1.625,
  },
};

// Spacing
export const Spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  '2xl': 48,
};

// Post Status Colors
export const PostStatusColors = {
  pending_moderation: { bg: '#fef3c7', text: '#92400e' },
  pending_verification: { bg: '#dbeafe', text: '#1e40af' },
  rejected: { bg: '#fee2e2', text: '#991b1b' },
  live: { bg: '#d1fae5', text: '#065f46' },
  disputed: { bg: '#fed7aa', text: '#9a3412' },
  removed: { bg: '#e5e7eb', text: '#374151' },
};