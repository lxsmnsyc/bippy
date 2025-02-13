import {
  Fragment,
  jsxDEV as jsxDEVImpl,
  type JSXSource,
} from 'react/jsx-dev-runtime';

export * from 'react/jsx-dev-runtime';

export { Fragment };

export const jsxDEV = (
  type: React.ElementType,
  originalProps: unknown,
  key: React.Key | undefined,
  isStatic: boolean,
  source?: JSXSource,
  self?: unknown,
) => {
  let props = originalProps;
  try {
    if (
      originalProps &&
      typeof originalProps === 'object' &&
      source &&
      String(type) !== 'Symbol(react.fragment)'
    ) {
      // prevent attributes from rendering in DOM for host fibers
      if (typeof type === 'string') {
        const proto = Object.getPrototypeOf(originalProps);
        const descriptors = Object.getOwnPropertyDescriptors(originalProps);
        descriptors.__source = {
          value: source,
          enumerable: false,
          configurable: true,
          writable: true,
        };
        props = Object.create(proto, descriptors);
      } else {
        // @ts-expect-error
        props.__source = source;
      }
    }
  } catch {}
  return jsxDEVImpl(type, props, key, isStatic, source, self);
};
