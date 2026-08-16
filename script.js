document.documentElement.classList.add('js');

const revealItems = document.querySelectorAll('.reveal');

if ('IntersectionObserver' in window) {
  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;

        entry.target.classList.add('is-visible');
        observer.unobserve(entry.target);
      });
    },
    { rootMargin: '0px 0px -8% 0px', threshold: 0.12 },
  );

  revealItems.forEach((item) => observer.observe(item));
} else {
  revealItems.forEach((item) => item.classList.add('is-visible'));
}

const downloadGrid = document.querySelector('[data-download-grid]');

if (downloadGrid) {
  const userAgent = `${navigator.userAgent} ${navigator.platform}`.toLowerCase();
  const preferredPlatform = userAgent.includes('mac') ? 'macos' : userAgent.includes('win') ? 'windows' : null;

  if (preferredPlatform) {
    const preferredCards = [...downloadGrid.querySelectorAll(`[data-platform="${preferredPlatform}"]`)];
    preferredCards.reverse().forEach((card) => downloadGrid.prepend(card));
    preferredCards[0]?.classList.add('is-recommended');
  }
}

let hashTarget = null;
try {
  hashTarget = window.location.hash ? document.getElementById(decodeURIComponent(window.location.hash.slice(1))) : null;
} catch {
  hashTarget = null;
}
if (hashTarget instanceof HTMLDetailsElement) hashTarget.open = true;
