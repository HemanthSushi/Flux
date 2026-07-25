/** @type {import('tailwindcss').Config} */
export default {
  darkMode: "class",
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      fontFamily: {
        heading: ["Poppins", "sans-serif"],
        body: ["Manrope", "sans-serif"]
      },
      colors: {
        ink: "#102233",
        cream: "#edf6ff",
        coral: "#ff6b4a",
        mint: "#2fa88f"
      },
      backgroundImage: {
        "panel-light":
          "linear-gradient(150deg, rgba(255,255,255,0.7), rgba(240,248,255,0.7) 58%, rgba(228,244,255,0.72))",
        "panel-dark":
          "linear-gradient(150deg, rgba(15,23,42,0.75), rgba(30,41,59,0.75) 58%, rgba(15,23,42,0.8))"
      },
      boxShadow: {
        soft: "0 10px 25px -5px rgba(15, 23, 42, 0.04), 0 8px 16px -6px rgba(15, 23, 42, 0.04)",
        "soft-dark": "0 10px 25px -5px rgba(0, 0, 0, 0.3), 0 8px 16px -6px rgba(0, 0, 0, 0.3)",
        glass: "0 8px 32px 0 rgba(15, 23, 42, 0.06)",
        "glass-dark": "0 8px 32px 0 rgba(0, 0, 0, 0.25)",
        "glow-mint": "0 0 15px rgba(47, 168, 143, 0.25)",
        "glow-coral": "0 0 15px rgba(255, 107, 74, 0.25)",
        "glow-teal": "0 0 15px rgba(45, 212, 191, 0.25)"
      },
      keyframes: {
        "fade-in-up": {
          "0%": { opacity: "0", transform: "translateY(8px)" },
          "100%": { opacity: "1", transform: "translateY(0)" }
        },
        "pulse-glow": {
          "0%, 100%": { opacity: "0.5", transform: "scale(1)" },
          "50%": { opacity: "0.8", transform: "scale(1.05)" }
        }
      },
      animation: {
        "fade-in-up": "fade-in-up 0.4s ease-out forwards",
        "pulse-glow": "pulse-glow 8s ease-in-out infinite"
      }
    }
  },
  plugins: []
};
