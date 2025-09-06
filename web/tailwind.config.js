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
        /* ================================
           UNIVERSAL THEME COLORS
           ================================ */
           
        // Themed Backgrounds
        'bg-primary': 'var(--bg-primary)',
        'bg-secondary': 'var(--bg-secondary)',
        'bg-tertiary': 'var(--bg-tertiary)',
        'bg-quaternary': 'var(--bg-quaternary)',
        
        // Smart Text Colors
        'text-super-light': 'var(--text-super-light)',
        'text-light': 'var(--text-light)',
        'text-neutral': 'var(--text-neutral)',
        'text-dark': 'var(--text-dark)',
        'text-super-dark': 'var(--text-super-dark)',
        
        // Theme-aware Brand Colors
        'brand-primary': 'var(--brand-primary)',
        'brand-primary-dark': 'var(--brand-primary-dark)',
        'brand-primary-light': 'var(--brand-primary-light)',
        'brand-secondary': 'var(--brand-secondary)',
        'brand-secondary-dark': 'var(--brand-secondary-dark)',
        
        // Special Accent (for basket button, etc.)
        'accent-special': 'var(--accent-special)',
        'accent-special-dark': 'var(--accent-special-dark)',
        
        // Fixed Notification Colors
        'success': 'var(--success)',
        'success-dark': 'var(--success-dark)',
        'error': 'var(--error)',
        'error-dark': 'var(--error-dark)',
        'warning': 'var(--warning)',
        'warning-dark': 'var(--warning-dark)',
        'info': 'var(--info)',
        'info-dark': 'var(--info-dark)',
        
        // Glass Effects
        'glass-bg': 'var(--glass-bg)',
        'glass-border': 'var(--glass-border)',
        
        /* ================================
           LEGACY COLORS (shadcn/ui compatibility)
           ================================ */
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
      },
      backgroundImage: {
        'gradient-primary': 'var(--gradient-primary)',
        'gradient-secondary': 'var(--gradient-secondary)',
        'gradient-special': 'var(--gradient-special)',
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      keyframes: {
        "accordion-down": {
          from: { height: "0" },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: "0" },
        },
        "fade-in": {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
        "slide-in-from-top": {
          "0%": { transform: "translateY(-100%)" },
          to: { transform: "translateY(0)" },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
        "fade-in": "fade-in 0.5s ease-out",
        "slide-in-from-top": "slide-in-from-top 0.3s ease-out",
      },
    },
  },
  plugins: [
    require('@tailwindcss/forms'),
    require('@tailwindcss/typography'),
  ],
}