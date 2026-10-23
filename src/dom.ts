export function element<T extends HTMLElement>(selector: string, type: { new(): T }) {
  const node = document.querySelector(selector);
  if (!(node instanceof type)) throw new Error(`Missing element: ${selector}`);
  return node;
}
