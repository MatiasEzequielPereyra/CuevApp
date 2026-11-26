export function installedMode() {
  return window.matchMedia("(display-mode: standalone)").matches
    || window.matchMedia("(display-mode: fullscreen)").matches
    || (navigator as Navigator & { standalone?: boolean }).standalone === true;
}

export function isAppleMobile() {
  const ua = navigator.userAgent;
  return /iPhone|iPad|iPod/i.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
}
