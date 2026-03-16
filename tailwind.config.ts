import type { Config } from 'tailwindcss'

export default {
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#4F46E5', // indigo-600
          light: '#6366F1',   // indigo-500
          dark: '#3730A3',    // indigo-800
        },
        layout: {
          background: '#F9FAFB', // gray-50
          sidebar: '#FFFFFF',
          border: '#E5E7EB',     // gray-200
        },
      },
      boxShadow: {
        soft: '0 1px 3px rgba(15, 23, 42, 0.06)',
      },
      borderRadius: {
        xl: '0.75rem',
      },
    },
  },
} satisfies Config

