/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        dfrnt: {
          50: "#FFFEE6",
          100: "#FFFDC1",
          200: "#FFEA9C",
          300: "#FEC87D",
          400: "#FA9A65",
          500: "#EF7653",
          600: "#C64F3D",
          700: "#A63B2C",
          800: "#8C2B1F",
          900: "#7D2116",
        },
        dfrntBlue: {
          50: "#F1FCFF",
          100: "#D3ECFF",
          200: "#AAD0FB",
          300: "#79AAED",
          400: "#4882D9",
          500: "#3770C5",
          600: "#32579A",
          700: "#293F6C",
          800: "#182D3F",
          900: "#121826",
        },
      },
      fontFamily: {
        headline: ["Montserrat", "sans-serif"],
        body: ["IBM Plex Sans", "sans-serif"],
        data: ["IBM Plex Sans Condensed", "sans-serif"],
      },
      keyframes: {
        "fade-in": {
          "0%": { opacity: "0", transform: "translateY(8px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
      },
      animation: {
        "fade-in": "fade-in 0.3s ease-out forwards",
      },
    },
  },
  plugins: [require("@tailwindcss/forms"), require("@tailwindcss/typography")],
};
