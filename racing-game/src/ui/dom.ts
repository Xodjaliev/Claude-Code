type Child = Node | string | number | null | undefined | false;

export interface Props {
  class?: string;
  style?: string;
  title?: string;
  onClick?: (e: MouseEvent) => void;
  [key: string]: unknown;
}

/** Tiny hyperscript helper: h('div', { class: 'x', onClick }, 'text', child) */
export function h<K extends keyof HTMLElementTagNameMap>(tag: K, props?: Props | null, ...children: (Child | Child[])[]): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  if (props) {
    for (const [k, v] of Object.entries(props)) {
      if (v === undefined || v === null || v === false) continue;
      if (k === 'class') el.className = String(v);
      else if (k === 'style') el.setAttribute('style', String(v));
      else if (k === 'onClick') el.addEventListener('click', v as (e: Event) => void);
      else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2).toLowerCase(), v as EventListener);
      else if (k in el && typeof v !== 'string') (el as unknown as Record<string, unknown>)[k] = v;
      else el.setAttribute(k, String(v));
    }
  }
  append(el, children);
  return el;
}

function append(el: HTMLElement, children: (Child | Child[])[]): void {
  for (const c of children) {
    if (Array.isArray(c)) append(el, c);
    else if (c === null || c === undefined || c === false) continue;
    else el.appendChild(typeof c === 'string' || typeof c === 'number' ? document.createTextNode(String(c)) : c);
  }
}

/** Skewed button whose label stays upright. */
export function button(label: Child | Child[], onClick: () => void, cls = ''): HTMLButtonElement {
  return h('button', { class: `btn ${cls}`.trim(), onClick: () => onClick() }, h('span', null, ...(Array.isArray(label) ? label : [label])));
}

export function clear(el: HTMLElement): void {
  while (el.firstChild) el.removeChild(el.firstChild);
}

export function statBar(base: number, bonus: number, preview = 0, max = 12): HTMLElement {
  const pct = (v: number) => `${Math.max(0, Math.min(100, (v / max) * 100))}%`;
  return h(
    'div',
    { class: 'stat-bar' },
    h('div', { class: 'preview', style: `width:${pct(base + bonus + preview)}` }),
    h('div', { class: 'bonus', style: `width:${pct(base + bonus)}` }),
    h('div', { class: 'base', style: `width:${pct(base)}` }),
  );
}

export function segmented<T extends string | number>(options: { value: T; label: string }[], current: T, onChange: (v: T) => void): HTMLElement {
  const wrap = h('div', { class: 'segmented' });
  const render = (cur: T) => {
    clear(wrap);
    for (const o of options) {
      wrap.appendChild(
        h(
          'button',
          {
            class: o.value === cur ? 'active' : '',
            onClick: () => {
              onChange(o.value);
              render(o.value);
            },
          },
          o.label,
        ),
      );
    }
  };
  render(current);
  return wrap;
}

export function toggle(on: boolean, onChange: (v: boolean) => void): HTMLElement {
  const el = h('button', { class: `toggle ${on ? 'on' : ''}`, 'aria-pressed': String(on) });
  let state = on;
  el.addEventListener('click', () => {
    state = !state;
    el.classList.toggle('on', state);
    el.setAttribute('aria-pressed', String(state));
    onChange(state);
  });
  return el;
}

export function slider(value: number, min: number, max: number, step: number, onInput: (v: number) => void): HTMLInputElement {
  const el = h('input', { type: 'range', min: String(min), max: String(max), step: String(step) }) as HTMLInputElement;
  el.value = String(value);
  el.addEventListener('input', () => onInput(Number(el.value)));
  return el;
}
