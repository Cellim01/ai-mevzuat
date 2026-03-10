/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        obsidian: {
          950: "#050508",
          900: "#0a0a10",
          800: "#111118",
          700: "#18181f",
          600: "#22222c",
        },
        gold: {
          50:  "#fdf9ed",
          100: "#f9efc5",
          200: "#f3da87",
          300: "#e8c04a",
          400: "#d4a017",
          500: "#b8860b",
          600: "#966b07",
          700: "#724f08",
        },
        slate2: {
          400: "#a0a0b0",
          300: "#c0c0cc",
          200: "#d8d8e4",
        }
      },
      fontFamily: {
        display: ["'Cormorant Garamond'", "Georgia", "serif"],
        body:    ["'DM Sans'", "sans-serif"],
        mono:    ["'JetBrains Mono'", "monospace"],
      },
      animation: {
        "fade-up":    "fadeUp 0.8s ease forwards",
        "fade-in":    "fadeIn 1s ease forwards",
        "line-grow":  "lineGrow 1.2s ease forwards",
        "shimmer":    "shimmer 2.5s linear infinite",
        "float":      "float 6s ease-in-out infinite",
        "pulse-slow": "pulse 4s ease-in-out infinite",
      },
      keyframes: {
        fadeUp: {
          "0%":   { opacity: "0", transform: "translateY(30px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        fadeIn: {
          "0%":   { opacity: "0" },
          "100%": { opacity: "1" },
        },
        lineGrow: {
          "0%":   { width: "0%" },
          "100%": { width: "100%" },
        },
        shimmer: {
          "0%":   { backgroundPosition: "-200% center" },
          "100%": { backgroundPosition: "200% center" },
        },
        float: {
          "0%, 100%": { transform: "translateY(0px)" },
          "50%":      { transform: "translateY(-12px)" },
        },
      },
      backgroundImage: {
        "gold-gradient": "linear-gradient(135deg, #d4a017 0%, #f3da87 50%, #b8860b 100%)",
        "hero-mesh":     "radial-gradient(ellipse at 20% 50%, rgba(180,130,20,0.08) 0%, transparent 60%), radial-gradient(ellipse at 80% 20%, rgba(180,130,20,0.05) 0%, transparent 50%)",
        "card-shine":    "linear-gradient(135deg, rgba(255,255,255,0.04) 0%, transparent 60%)",
      },
    },
  },
  plugins: [],
};
