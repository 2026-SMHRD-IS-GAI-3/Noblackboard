const modalCleanup = new WeakMap();

export function showToast(element, message, duration = 2000) {
  if (!element) return;
  window.clearTimeout(Number(element.dataset.toastTimer || 0));
  element.textContent = message;
  element.classList.add("show");
  const timer = window.setTimeout(() => element.classList.remove("show"), duration);
  element.dataset.toastTimer = String(timer);
}

export function setModalOpen(modal, isOpen, { initialFocus } = {}) {
  if (!modal) return;
  modalCleanup.get(modal)?.();
  modalCleanup.delete(modal);
  modal.classList.toggle("show", isOpen);
  modal.setAttribute("aria-hidden", String(!isOpen));
  if (!isOpen) return;

  const previousFocus = document.activeElement;
  const focusable = () => Array.from(modal.querySelectorAll(
    'button:not([disabled]), input:not([disabled]), select:not([disabled]), [href], [tabindex]:not([tabindex="-1"])'
  )).filter((element) => !element.hidden);
  (initialFocus || focusable()[0])?.focus?.();

  const onKeydown = (event) => {
    if (event.key === "Escape") {
      setModalOpen(modal, false);
      previousFocus?.focus?.();
      return;
    }
    if (event.key !== "Tab") return;
    const items = focusable();
    if (!items.length) return;
    const first = items[0];
    const last = items[items.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  };
  modal.addEventListener("keydown", onKeydown);
  modalCleanup.set(modal, () => modal.removeEventListener("keydown", onKeydown));
}
