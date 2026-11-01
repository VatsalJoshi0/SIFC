/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        vai: {
          navy: "#0f172a",
          slate: "#334155",
          fair: "#d97706",
          good: "#0d9488",
          veryGood: "#16a34a",
          surface: "#f8fafc",
          border: "#e2e8f0",
        },
      },
      fontSize: {
        base: ["1rem", { lineHeight: "1.6" }], // 16px min body
      },
    },
  },
  plugins: [],
};
