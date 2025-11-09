// 에이치브이랩 직인 이미지 (Base64)
export const stampBase64 = "data:image/png;base64," + await (async () => {
  // This will be replaced with actual base64 data
  return "";
})();

// Fallback SVG stamp if PNG fails to load
export const stampSvg = `data:image/svg+xml;base64,${btoa(`<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 100 100">
  <circle cx="50" cy="50" r="40" fill="none" stroke="red" stroke-width="3" opacity="0.8"/>
  <text x="50" y="35" text-anchor="middle" fill="red" font-size="14" font-weight="bold" font-family="sans-serif">김</text>
  <text x="50" y="50" text-anchor="middle" fill="red" font-size="14" font-weight="bold" font-family="sans-serif">상</text>
  <text x="50" y="65" text-anchor="middle" fill="red" font-size="14" font-weight="bold" font-family="sans-serif">준</text>
</svg>`)}`;