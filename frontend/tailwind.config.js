/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        pnb: {
          red: '#A31F37',   // Official PNB Maroon/Red
          gold: '#F4A018',  // Official PNB Yellow/Gold
          dark: '#0f172a',  // Enterprise Slate for Sidebar
          light: '#f8fafc', // Clean background
        }
      }
    },
  },
  plugins: [],
}