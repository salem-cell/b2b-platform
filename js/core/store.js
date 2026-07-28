// ============================================================
// مخزن الحالة المركزي — نمط بسيط: حالة واحدة + مشتركون
// كل تعديل يمر عبر setState ويعيد رسم الواجهة
// ============================================================

const listeners = new Set();
let state = null;

export function initState(initial) {
  state = initial;
}

export function getState() {
  return state;
}

export function setState(patch) {
  state = { ...state, ...(typeof patch === 'function' ? patch(state) : patch) };
  listeners.forEach((fn) => fn(state));
}

export function subscribe(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
