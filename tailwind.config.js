/** @type {import('tailwindcss').Config} */
export default {
  content: ['./client/index.html', './client/src/**/*.{js,jsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        navy: {
          900: '#1a1f2e',
          950: '#131825',
        },
        shell: {
          50:  '#ecfeff',
          100: '#cffafe',
          200: '#a5f3fc',
          300: '#67e8f9',
          400: '#22d3ee',
          500: '#06b6d4',
          600: '#0891b2',
          700: '#0e7490',
          800: '#155e75',
          900: '#164e63',
        },
        cream: {
          50:  '#fefefe',
          100: '#f8f7f5',
          200: '#f0eeeb',
          300: '#e2dfd9',
        },
      },
      fontSize: {
        'body':    ['18px', { lineHeight: '1.6' }],
        'body-lg': ['20px', { lineHeight: '1.6' }],
        'label':   ['16px', { lineHeight: '1.5' }],
        'h1':      ['32px', { lineHeight: '1.3', fontWeight: '700' }],
        'h2':      ['26px', { lineHeight: '1.3', fontWeight: '600' }],
        'h3':      ['22px', { lineHeight: '1.4', fontWeight: '600' }],
        'small':   ['16px', { lineHeight: '1.5' }],
      },
      spacing: {
        'btn': '48px',
        'input': '52px',
      },
      borderRadius: {
        'friendly': '16px',
      },
    },
  },
  plugins: [],
};
