import { useEffect, useState } from 'react';

const readIsDark = () => document.documentElement.dataset.theme !== 'light';

// Reads the theme App.jsx stamps onto <html data-theme>. Only needed by consumers
// that must resolve an actual colour value in JS (e.g. Recharts props) rather than
// a Tailwind className, which re-themes on its own via the CSS custom properties.
export const useTheme = () => {
  const [isDark, setIsDark] = useState(readIsDark);

  useEffect(() => {
    const observer = new MutationObserver(() => setIsDark(readIsDark()));
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    return () => observer.disconnect();
  }, []);

  return { isDark };
};
