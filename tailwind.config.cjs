/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: "class",
  content: ["./index.html", "./src/**/*.{js,jsx,ts,tsx}"],
  theme: {
    extend: {
      colors: {
        meeps: {
          primary: "#4F46E5",
          secondary: "#6366F1",
        },
      },
    },
  },
  plugins: [require("@tailwindcss/typography")],
};
