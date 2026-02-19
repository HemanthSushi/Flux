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
          "linear-gradient(150deg, rgba(255,255,255,0.9), rgba(232,244,255,0.9) 58%, rgba(221,241,255,0.92))",
        "panel-dark":
          "linear-gradient(150deg, rgba(16,32,52,0.88), rgba(15,44,74,0.88) 58%, rgba(11,28,48,0.9))"
      },
      boxShadow: {
        soft: "0 14px 32px rgba(18,54,88,0.16)"
      }
    }
  },
  plugins: []
};
