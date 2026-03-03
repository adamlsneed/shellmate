import { useRef, useEffect } from 'react';

/**
 * Scroll-to-bottom behavior for chat-like UIs.
 * Returns a ref to place at the bottom of the scrollable area.
 */
export function useScrollToBottom(deps) {
  const ref = useRef(null);
  useEffect(() => {
    ref.current?.scrollIntoView({ behavior: 'smooth' });
  }, deps);
  return ref;
}

/**
 * Auto-focus an input after async operations.
 * Returns a ref for the input and a focus() function.
 */
export function useAutofocus() {
  const ref = useRef(null);
  const focus = () => setTimeout(() => ref.current?.focus(), 100);
  return [ref, focus];
}
