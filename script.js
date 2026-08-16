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

let hashTarget = null;
try {
  hashTarget = window.location.hash ? document.getElementById(decodeURIComponent(window.location.hash.slice(1))) : null;
} catch {
  hashTarget = null;
}
if (hashTarget instanceof HTMLDetailsElement) hashTarget.open = true;

const copyButtons = document.querySelectorAll('[data-copy-text]');

copyButtons.forEach((button) => {
  button.addEventListener('click', async () => {
    const originalLabel = button.textContent;

    try {
      const value = button.dataset.copyText;
      if (!value) return;

      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(value);
      } else {
        const input = document.createElement('textarea');
        input.value = value;
        input.setAttribute('readonly', '');
        input.style.position = 'fixed';
        input.style.opacity = '0';
        document.body.append(input);
        input.select();
        document.execCommand('copy');
        input.remove();
      }

      button.textContent = '已复制';
    } catch {
      button.textContent = '请手动复制';
    }

    window.setTimeout(() => {
      button.textContent = originalLabel;
    }, 1800);
  });
});
