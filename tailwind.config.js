/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./ui/**/*.{html,ts,js}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['system-ui', 'sans-serif'],
      }
    },
  },
  plugins: [],
}
