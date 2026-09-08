/** Require a declared element at the UI boundary, validating its browser type. */
export function requireElement<T extends Element>(
  root: ParentNode,
  selector: string,
  constructor: { new (...args: never[]): T },
): T {
  const element = root.querySelector(selector);
  if (!(element instanceof constructor)) {
    throw new Error(`Missing ${constructor.name}: ${selector}`);
  }
  return element;
}
