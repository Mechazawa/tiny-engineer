export const $ = (selector, root = document) => root.querySelector(selector);
export const $$ = (selector, root = document) => root.querySelectorAll(selector);

export function element(tag, className, text) {
  const node = document.createElement(tag);

  node.className = className;

  if (text != null) {
    node.textContent = text;
  }

  return node;
}
