/** Require a declared element at the UI boundary, validating its browser type. */
export function requireElement<T extends Element>(
  root: ParentNode,
  selector: string,
  elementType: { new (...args: never[]): T },
): T {
  const element = root.querySelector(selector);
  if (!(element instanceof elementType)) {
    throw new Error(`Missing ${elementType.name}: ${selector}`);
  }
  return element;
}

/** Avoid unchanged text mutations in sampled UI readouts. */
export function writeText(element: Element, text: string): void {
  if (element.textContent !== text) element.textContent = text;
}
