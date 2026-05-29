/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      maxWidth: {
        // rem 단위로 정의해 root font-size 스케일을 따라간다.
        // 640px @ 16px base = 40rem. 28px 캡에서는 1120px까지 확장.
        mobile: '40rem',
      },
    },
  },
  plugins: [],
};
