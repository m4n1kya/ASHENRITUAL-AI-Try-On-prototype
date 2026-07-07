import { useEffect, useState } from "react";

/**
 * Returns `true` once the page has scrolled past `threshold` pixels.
 * Used to intensify the navbar's blur/border once the hero has scrolled by.
 */
export function useScrollPosition(threshold = 24): boolean {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > threshold);
    handleScroll();
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, [threshold]);

  return scrolled;
}
