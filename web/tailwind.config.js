/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        ford: {
          blue: '#003478',
          'blue-light': '#0047a8',
        },
        'ford-blue': '#003478',
        'ford-blue-light': '#0047a8',
        // iOS 26 Inspired Colors - Unified with Ford Blue
        ios: {
          primary: '#003478',
          'primary-dark': '#002a5c',
          'primary-light': '#0047a8',
          secondary: '#5856D6',
          success: '#34C759',
          warning: '#FF9500',
          error: '#FF3B30',
          gray: {
            1: '#F2F2F7',
            2: '#E5E5EA',
            3: '#D1D1D6',
            4: '#C7C7CC',
            5: '#AEAEB2',
            6: '#8E8E93',
            7: '#636366',
            8: '#48484A',
            9: '#3A3A3C',
            10: '#1C1C1E',
          },
          bg: {
            primary: '#FFFFFF',
            secondary: '#F2F2F7',
            tertiary: '#FFFFFF',
            grouped: '#F2F2F7',
          },
          text: {
            primary: '#000000',
            secondary: '#3A3A3C',
            tertiary: '#8E8E93',
            quaternary: '#C7C7CC',
          }
        }
      },
      animation: {
        'fade-in': 'fadeIn 800ms ease-out both',
        'pulse-slow': 'pulseSlow 1600ms ease-in-out infinite',
        'float': 'float 3s ease-in-out infinite',
        'shimmer': 'shimmer 2s linear infinite',
        'slide-up': 'slideUp 600ms ease-out both',
        'slide-down': 'slideDown 600ms ease-out both',
        'scale-in': 'scaleIn 500ms ease-out both',
        'bounce-gentle': 'bounceGentle 2s ease-in-out infinite',
      },
      keyframes: {
        fadeIn: {
          'from': { opacity: '0', transform: 'translateY(6px)' },
          'to': { opacity: '1', transform: 'translateY(0)' },
        },
        pulseSlow: {
          '0%, 100%': { opacity: '0.7', transform: 'scale(1)' },
          '50%': { opacity: '1', transform: 'scale(1.05)' },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%': { transform: 'translateY(-10px)' },
        },
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
        slideUp: {
          'from': { opacity: '0', transform: 'translateY(30px)' },
          'to': { opacity: '1', transform: 'translateY(0)' },
        },
        slideDown: {
          'from': { opacity: '0', transform: 'translateY(-30px)' },
          'to': { opacity: '1', transform: 'translateY(0)' },
        },
        scaleIn: {
          'from': { opacity: '0', transform: 'scale(0.9)' },
          'to': { opacity: '1', transform: 'scale(1)' },
        },
        bounceGentle: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-5px)' },
        },
      },
      backdropBlur: {
        xs: '2px',
      },
      boxShadow: {
        'glass': '0 8px 32px rgba(0, 0, 0, 0.08), 0 2px 8px rgba(0, 0, 0, 0.04), inset 0 1px 0 rgba(255, 255, 255, 0.6)',
        'glass-hover': '0 16px 48px rgba(0, 0, 0, 0.12), 0 4px 16px rgba(0, 0, 0, 0.06), inset 0 1px 0 rgba(255, 255, 255, 0.6)',
        'soft': '0 4px 20px rgba(0, 0, 0, 0.06)',
        'soft-lg': '0 8px 30px rgba(0, 0, 0, 0.08)',
        // iOS 26 Inspired Shadows
        'ios-sm': '0 1px 3px rgba(0, 0, 0, 0.1)',
        'ios-md': '0 4px 12px rgba(0, 0, 0, 0.15)',
        'ios-lg': '0 8px 25px rgba(0, 0, 0, 0.15)',
        'ios-xl': '0 16px 40px rgba(0, 0, 0, 0.2)',
      },
    },
  },
  plugins: [],
}
