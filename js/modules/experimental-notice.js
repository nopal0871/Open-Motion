(() => {
  const notice = document.getElementById('experimentalNotice');
  const accept = document.getElementById('experimentalNoticeAccept');
  if (!notice || !accept) return;

  const closeNotice = () => notice.setAttribute('aria-hidden', 'true');
  accept.addEventListener('click', () => {
    closeNotice();
    // V5.32 — PWA promotion is allowed only after the user explicitly accepts
    // the experimental notice. This prevents the install card from competing
    // with the first-run notice or covering the Home UI during startup.
    window.__omsExperimentalNoticeAccepted = true;
    window.dispatchEvent(new CustomEvent('oms:experimental-notice-accepted'));
  });
  notice.addEventListener('click', (event) => {
    if (event.target === notice) closeNotice();
  });
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && notice.getAttribute('aria-hidden') !== 'true') closeNotice();
  });
  requestAnimationFrame(() => accept.focus({ preventScroll: true }));
})();
