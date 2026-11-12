/**
 * Stand-ins for `@devvit/web/client` when the game runs outside Reddit
 * (`npm run dev:local`). Only the calls the game uses are implemented.
 */

const toastHost = () => {
  let host = document.getElementById('dev-toast');
  if (!host) {
    host = document.createElement('div');
    host.id = 'dev-toast';
    host.setAttribute('role', 'status');
    host.style.cssText =
      'position:fixed;left:50%;bottom:16px;transform:translateX(-50%);z-index:99;background:#1a1a1b;color:#fff;font:600 14px system-ui;padding:10px 16px;border-radius:10px;max-width:90%;text-align:center;display:none';
    document.body.appendChild(host);
  }
  return host;
};

let toastTimer = 0;

export const showToast = (toast: string | { text: string }) => {
  const host = toastHost();
  host.textContent = typeof toast === 'string' ? toast : toast.text;
  host.style.display = 'block';
  window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => {
    host.style.display = 'none';
  }, 2600);
};

export const requestExpandedMode = (_event: MouseEvent, entry: string) => {
  window.location.href = `/${entry}.html${window.location.search}`;
};

export const navigateToPost = (postId: string) => {
  const params = new URLSearchParams(window.location.search);
  params.set('post', postId);
  params.delete('date');
  window.location.href = `/game.html?${params.toString()}`;
};

export const showLoginPrompt = () =>
  showToast('[dev] Reddit would ask you to log in here.');
