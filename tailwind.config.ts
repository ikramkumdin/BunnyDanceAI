import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: "#8B5CF6", // Vibrant purple
          dark: "#7C3AED", // Darker purple
          light: "#A78BFA", // Lighter purple
        },
        accent: {
          DEFAULT: "#EC4899", // Keep pink as accent
          dark: "#DB2777",
          light: "#F472B6",
        },
        secondary: {
          DEFAULT: "#6366F1", // Indigo - softer than primary purple
          dark: "#4F46E5",
          light: "#818CF8",
        },
        dark: {
          DEFAULT: "#0F172A", // Darker slate
          light: "#1E293B",
          lighter: "#334155",
        },
      },
    },
  },
  plugins: [],
};
export default config;

