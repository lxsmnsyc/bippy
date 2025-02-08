// Note: do not import React in this file
// since it will be executed before the react devtools hook is created

import * as errorStackParser from 'error-stack-parser-es/lite';
import type * as React from 'react';
import { type RawSourceMap, SourceMapConsumer } from 'source-map-js';
import {
  BIPPY_INSTRUMENTATION_STRING,
  getRDTHook,
  hasRDTHook,
  isReactRefresh,
  isRealReactDevtools,
} from './rdt-hook.js';
import type {
  ContextDependency,
  Fiber,
  FiberRoot,
  MemoizedState,
  ReactDevToolsGlobalHook,
  ReactRenderer,
} from './types.js';

// https://github.com/facebook/react/blob/main/packages/react-reconciler/src/ReactWorkTags.js
export const FunctionComponentTag = 0;
export const ClassComponentTag = 1;
export const HostRootTag = 3;
export const HostComponentTag = 5;
export const HostTextTag = 6;
export const FragmentTag = 7;
export const ContextConsumerTag = 9;
export const ForwardRefTag = 11;
export const SuspenseComponentTag = 13;
export const MemoComponentTag = 14;
export const SimpleMemoComponentTag = 15;
export const DehydratedSuspenseComponentTag = 18;
export const OffscreenComponentTag = 22;
export const LegacyHiddenComponentTag = 23;
export const HostHoistableTag = 26;
export const HostSingletonTag = 27;

export const CONCURRENT_MODE_NUMBER = 0xeacf;
export const ELEMENT_TYPE_SYMBOL_STRING = 'Symbol(react.element)';
export const TRANSITIONAL_ELEMENT_TYPE_SYMBOL_STRING =
  'Symbol(react.transitional.element)';
export const CONCURRENT_MODE_SYMBOL_STRING = 'Symbol(react.concurrent_mode)';
export const DEPRECATED_ASYNC_MODE_SYMBOL_STRING = 'Symbol(react.async_mode)';

// https://github.com/facebook/react/blob/main/packages/react-reconciler/src/ReactFiberFlags.js
const PerformedWork = 0b1;
const Placement = 0b10;
const Hydrating = 0b1000000000000;
const Update = 0b100;
const Cloned = 0b1000;
const ChildDeletion = 0b10000;
const ContentReset = 0b100000;
const Snapshot = 0b10000000000;
const Visibility = 0b10000000000000;
const MutationMask =
  Placement |
  Update |
  ChildDeletion |
  ContentReset |
  Hydrating |
  Visibility |
  Snapshot;

/**
 * Returns `true` if object is a React Element.
 *
 * @see https://react.dev/reference/react/isValidElement
 */
export const isValidElement = (
  element: unknown,
): element is React.ReactElement =>
  typeof element === 'object' &&
  element != null &&
  '$$typeof' in element &&
  // react 18 uses Symbol.for('react.element'), react 19 uses Symbol.for('react.transitional.element')
  [
    ELEMENT_TYPE_SYMBOL_STRING,
    TRANSITIONAL_ELEMENT_TYPE_SYMBOL_STRING,
  ].includes(String(element.$$typeof));

/**
 * Returns `true` if object is a React Fiber.
 */
export const isValidFiber = (fiber: unknown): fiber is Fiber =>
  typeof fiber === 'object' &&
  fiber != null &&
  'tag' in fiber &&
  'stateNode' in fiber &&
  'return' in fiber &&
  'child' in fiber &&
  'sibling' in fiber &&
  'flags' in fiber;

/**
 * Returns `true` if fiber is a host fiber. Host fibers are DOM nodes in react-dom, `View` in react-native, etc.
 *
 * @see https://reactnative.dev/architecture/glossary#host-view-tree-and-host-view
 */
export const isHostFiber = (fiber: Fiber): boolean => {
  switch (fiber.tag) {
    case HostComponentTag:
    // @ts-expect-error: it exists
    case HostHoistableTag:
    // @ts-expect-error: it exists
    case HostSingletonTag:
      return true;
    default:
      return typeof fiber.type === 'string';
  }
};
/**
 * Returns `true` if fiber is a composite fiber. Composite fibers are fibers that can render (like functional components, class components, etc.)
 *
 * @see https://reactnative.dev/architecture/glossary#react-composite-components
 */
export const isCompositeFiber = (fiber: Fiber): boolean => {
  switch (fiber.tag) {
    case FunctionComponentTag:
    case ClassComponentTag:
    case SimpleMemoComponentTag:
    case MemoComponentTag:
    case ForwardRefTag:
      return true;
    default:
      return false;
  }
};

/**
 * Traverses up or down a {@link Fiber}'s contexts, return `true` to stop and select the current and previous context value.
 */
export const traverseContexts = (
  fiber: Fiber,
  selector: (
    nextValue: ContextDependency<unknown> | null | undefined,
    prevValue: ContextDependency<unknown> | null | undefined,
    // biome-ignore lint/suspicious/noConfusingVoidType: optional return
  ) => boolean | void,
): boolean => {
  try {
    const nextDependencies = fiber.dependencies;
    const prevDependencies = fiber.alternate?.dependencies;

    if (!nextDependencies || !prevDependencies) return false;
    if (
      typeof nextDependencies !== 'object' ||
      !('firstContext' in nextDependencies) ||
      typeof prevDependencies !== 'object' ||
      !('firstContext' in prevDependencies)
    ) {
      return false;
    }
    let nextContext: ContextDependency<unknown> | null | undefined =
      nextDependencies.firstContext;
    let prevContext: ContextDependency<unknown> | null | undefined =
      prevDependencies.firstContext;
    while (
      (nextContext &&
        typeof nextContext === 'object' &&
        'memoizedValue' in nextContext) ||
      (prevContext &&
        typeof prevContext === 'object' &&
        'memoizedValue' in prevContext)
    ) {
      if (selector(nextContext, prevContext) === true) return true;

      nextContext = nextContext?.next;
      prevContext = prevContext?.next;
    }
  } catch {}
  return false;
};

/**
 * Traverses up or down a {@link Fiber}'s states, return `true` to stop and select the current and previous state value. This stores both state values and effects.
 */
export const traverseState = (
  fiber: Fiber,
  selector: (
    nextValue: MemoizedState | null | undefined,
    prevValue: MemoizedState | null | undefined,
    // biome-ignore lint/suspicious/noConfusingVoidType: optional return
  ) => boolean | void,
): boolean => {
  try {
    let nextState: MemoizedState | null | undefined = fiber.memoizedState;
    let prevState: MemoizedState | null | undefined =
      fiber.alternate?.memoizedState;

    while (nextState || prevState) {
      if (selector(nextState, prevState) === true) return true;

      nextState = nextState?.next;
      prevState = prevState?.next;
    }
  } catch {}
  return false;
};

/**
 * Traverses up or down a {@link Fiber}'s props, return `true` to stop and select the current and previous props value.
 */
export const traverseProps = (
  fiber: Fiber,
  selector: (
    propName: string,
    nextValue: unknown,
    prevValue: unknown,
    // biome-ignore lint/suspicious/noConfusingVoidType: may or may not exist
  ) => boolean | void,
): boolean => {
  try {
    const nextProps = fiber.memoizedProps;
    const prevProps = fiber.alternate?.memoizedProps || {};

    const allKeys = new Set([
      ...Object.keys(prevProps),
      ...Object.keys(nextProps),
    ]);

    for (const propName of allKeys) {
      const prevValue = prevProps?.[propName];
      const nextValue = nextProps?.[propName];

      if (selector(propName, nextValue, prevValue) === true) return true;
    }
  } catch {}
  return false;
};

/**
 * Returns `true` if the {@link Fiber} has rendered. Note that this does not mean the fiber has rendered in the current commit, just that it has rendered in the past.
 */
export const didFiberRender = (fiber: Fiber): boolean => {
  const nextProps = fiber.memoizedProps;
  const prevProps = fiber.alternate?.memoizedProps || {};
  const flags =
    fiber.flags ?? (fiber as unknown as { effectTag: number }).effectTag ?? 0;

  switch (fiber.tag) {
    case ClassComponentTag:
    case FunctionComponentTag:
    case ContextConsumerTag:
    case ForwardRefTag:
    case MemoComponentTag:
    case SimpleMemoComponentTag: {
      return (flags & PerformedWork) === PerformedWork;
    }
    default:
      // Host nodes (DOM, root, etc.)
      if (!fiber.alternate) return true;
      return (
        prevProps !== nextProps ||
        fiber.alternate.memoizedState !== fiber.memoizedState ||
        fiber.alternate.ref !== fiber.ref
      );
  }
};

/**
 * Returns `true` if the {@link Fiber} has committed. Note that this does not mean the fiber has committed in the current commit, just that it has committed in the past.
 */
export const didFiberCommit = (fiber: Fiber): boolean => {
  return Boolean(
    (fiber.flags & (MutationMask | Cloned)) !== 0 ||
      (fiber.subtreeFlags & (MutationMask | Cloned)) !== 0,
  );
};

/**
 * Returns all host {@link Fiber}s that have committed and rendered.
 */
export const getMutatedHostFibers = (fiber: Fiber): Fiber[] => {
  const mutations: Fiber[] = [];
  const stack: Fiber[] = [fiber];

  while (stack.length) {
    const node = stack.pop();
    if (!node) continue;

    if (isHostFiber(node) && didFiberCommit(node) && didFiberRender(node)) {
      mutations.push(node);
    }

    if (node.child) stack.push(node.child);
    if (node.sibling) stack.push(node.sibling);
  }

  return mutations;
};

/**
 * Returns the stack of {@link Fiber}s from the current fiber to the root fiber.
 *
 * @example
 * ```ts
 * [fiber, fiber.return, fiber.return.return, ...]
 * ```
 */
export const getFiberStack = (fiber: Fiber): Fiber[] => {
  const stack: Fiber[] = [];
  let currentFiber = fiber;
  while (currentFiber.return) {
    stack.push(currentFiber);
    currentFiber = currentFiber.return;
  }
  return stack;
};

/**
 * Returns `true` if the {@link Fiber} should be filtered out during reconciliation.
 */
export const shouldFilterFiber = (fiber: Fiber): boolean => {
  switch (fiber.tag) {
    case DehydratedSuspenseComponentTag:
      // TODO: ideally we would show dehydrated Suspense immediately.
      // However, it has some special behavior (like disconnecting
      // an alternate and turning into real Suspense) which breaks DevTools.
      // For now, ignore it, and only show it once it gets hydrated.
      // https://github.com/bvaughn/react-devtools-experimental/issues/197
      return true;

    case HostTextTag:
    case FragmentTag:
    case LegacyHiddenComponentTag:
    case OffscreenComponentTag:
      return true;

    case HostRootTag:
      // It is never valid to filter the root element.
      return false;

    default: {
      const symbolOrNumber =
        typeof fiber.type === 'object' && fiber.type !== null
          ? fiber.type.$$typeof
          : fiber.type;

      const typeSymbol =
        typeof symbolOrNumber === 'symbol'
          ? symbolOrNumber.toString()
          : symbolOrNumber;

      switch (typeSymbol) {
        case CONCURRENT_MODE_NUMBER:
        case CONCURRENT_MODE_SYMBOL_STRING:
        case DEPRECATED_ASYNC_MODE_SYMBOL_STRING:
          return true;

        default:
          return false;
      }
    }
  }
};

/**
 * Returns the nearest host {@link Fiber} to the current {@link Fiber}.
 */
export const getNearestHostFiber = (
  fiber: Fiber,
  ascending = false,
): Fiber | null => {
  let hostFiber = traverseFiber(fiber, isHostFiber, ascending);
  if (!hostFiber) {
    hostFiber = traverseFiber(fiber, isHostFiber, !ascending);
  }
  return hostFiber;
};

/**
 * Returns all host {@link Fiber}s in the tree that are associated with the current {@link Fiber}.
 */
export const getNearestHostFibers = (fiber: Fiber): Fiber[] => {
  const hostFibers: Fiber[] = [];
  const stack: Fiber[] = [];

  if (isHostFiber(fiber)) {
    hostFibers.push(fiber);
  } else if (fiber.child) {
    stack.push(fiber.child);
  }

  while (stack.length) {
    const currentNode = stack.pop();
    if (!currentNode) break;
    if (isHostFiber(currentNode)) {
      hostFibers.push(currentNode);
    } else if (currentNode.child) {
      stack.push(currentNode.child);
    }

    if (currentNode.sibling) {
      stack.push(currentNode.sibling);
    }
  }

  return hostFibers;
};

/**
 * Traverses up or down a {@link Fiber}, return `true` to stop and select a node.
 */
export const traverseFiber = (
  fiber: Fiber | null,
  // biome-ignore lint/suspicious/noConfusingVoidType: may or may not exist
  selector: (node: Fiber) => boolean | void,
  ascending = false,
): Fiber | null => {
  if (!fiber) return null;
  if (selector(fiber) === true) return fiber;

  let child = ascending ? fiber.return : fiber.child;
  while (child) {
    const match = traverseFiber(child, selector, ascending);
    if (match) return match;

    child = ascending ? null : child.sibling;
  }
  return null;
};

/**
 * Returns the timings of the {@link Fiber}.
 *
 * @example
 * ```ts
 * const { selfTime, totalTime } = getTimings(fiber);
 * console.log(selfTime, totalTime);
 * ```
 */
export const getTimings = (
  fiber?: Fiber | null | undefined,
): { selfTime: number; totalTime: number } => {
  const totalTime = fiber?.actualDuration ?? 0;
  let selfTime = totalTime;
  // TODO: calculate a DOM time, which is just host component summed up
  let child = fiber?.child ?? null;
  while (totalTime > 0 && child != null) {
    selfTime -= child.actualDuration ?? 0;
    child = child.sibling;
  }
  return { selfTime, totalTime };
};

/**
 * Returns `true` if the {@link Fiber} uses React Compiler's memo cache.
 */
export const hasMemoCache = (fiber: Fiber): boolean => {
  return Boolean(
    (fiber.updateQueue as unknown as { memoCache: unknown })?.memoCache,
  );
};

type FiberType =
  | React.ComponentType<unknown>
  | React.ForwardRefExoticComponent<unknown>
  | React.MemoExoticComponent<React.ComponentType<unknown>>;

/**
 * Returns the type (e.g. component definition) of the {@link Fiber}
 */
export const getType = (type: unknown): React.ComponentType<unknown> | null => {
  const currentType = type as FiberType;
  if (typeof currentType === 'function') {
    return currentType;
  }
  if (typeof currentType === 'object' && currentType) {
    // memo / forwardRef case
    return getType(
      (currentType as React.MemoExoticComponent<React.ComponentType<unknown>>)
        .type ||
        (currentType as { render: React.ComponentType<unknown> }).render,
    );
  }
  return null;
};

/**
 * Returns the display name of the {@link Fiber}.
 */
export const getDisplayName = (type: unknown): string | null => {
  const currentType = type as FiberType;
  if (
    typeof currentType !== 'function' &&
    !(typeof currentType === 'object' && currentType)
  ) {
    return null;
  }
  const name = currentType.displayName || currentType.name || null;
  if (name) return name;
  const unwrappedType = getType(currentType);
  if (!unwrappedType) return null;
  return unwrappedType.displayName || unwrappedType.name || null;
};

/**
 * Returns the build type of the React renderer.
 */
export const detectReactBuildType = (
  renderer: ReactRenderer,
): 'development' | 'production' => {
  try {
    if (typeof renderer.version === 'string' && renderer.bundleType > 0) {
      return 'development';
    }
  } catch {}
  return 'production';
};

/**
 * Returns `true` if bippy's instrumentation is active.
 */
export const isInstrumentationActive = (): boolean => {
  const rdtHook = getRDTHook();
  return (
    Boolean(rdtHook._instrumentationIsActive) ||
    isRealReactDevtools() ||
    isReactRefresh()
  );
};

export type RenderPhase = 'mount' | 'update' | 'unmount';

export type RenderHandler = <S>(
  fiber: Fiber,
  phase: RenderPhase,
  state?: S,
) => unknown;

let fiberId = 0;
export const fiberIdMap = new WeakMap<Fiber, number>();

export const setFiberId = (fiber: Fiber, id: number = fiberId++): void => {
  fiberIdMap.set(fiber, id);
};

// react fibers are double buffered, so the alternate fiber may
// be switched to the current fiber and vice versa.
// fiber === fiber.alternate.alternate
export const getFiberId = (fiber: Fiber): number => {
  let id = fiberIdMap.get(fiber);
  if (!id && fiber.alternate) {
    id = fiberIdMap.get(fiber.alternate);
  }
  if (!id) {
    id = fiberId++;
    setFiberId(fiber, id);
  }
  return id;
};

interface FiberSource {
  fileName: string;
  lineNumber: number;
  columnNumber: number;
}

let reentry = false;

const describeBuiltInComponentFrame = (name: string): string => {
  return `\n    in ${name}`;
};

const disableLogs = () => {
  // Temporarily disable console.error/warn
  const prev = {
    error: console.error,
    warn: console.warn,
  };
  console.error = () => {};
  console.warn = () => {};
  return prev;
};

const reenableLogs = (prev: {
  error: typeof console.error;
  warn: typeof console.warn;
}) => {
  console.error = prev.error;
  console.warn = prev.warn;
};

const INLINE_SOURCEMAP_REGEX = /^data:application\/json[^,]+base64,/;
const SOURCEMAP_REGEX =
  /(?:\/\/[@#][ \t]+sourceMappingURL=([^\s'"]+?)[ \t]*$)|(?:\/\*[@#][ \t]+sourceMappingURL=([^*]+?)[ \t]*(?:\*\/)[ \t]*$)/;

async function getSourceMap(url: string, content: string) {
  const lines = content.split('\n');
  let sourceMapUrl: string | undefined;
  for (let i = lines.length - 1; i >= 0 && !sourceMapUrl; i--) {
    const result = lines[i].match(SOURCEMAP_REGEX);
    if (result) {
      sourceMapUrl = result[1];
    }
  }

  if (!sourceMapUrl) {
    return null;
  }

  if (
    !(INLINE_SOURCEMAP_REGEX.test(sourceMapUrl) || sourceMapUrl.startsWith('/'))
  ) {
    // Resolve path if it's a relative access
    const parsedURL = url.split('/');
    parsedURL[parsedURL.length - 1] = sourceMapUrl;
    sourceMapUrl = parsedURL.join('/');
  }
  const response = await fetch(sourceMapUrl);
  const rawSourceMap: RawSourceMap = await response.json();

  return new SourceMapConsumer(rawSourceMap);
}

function getActualFileSource(path: string): string {
  if (path.startsWith('file://')) {
    return `/_build/@fs${path.substring('file://'.length)}`;
  }
  return path;
}

const parseStackFrame = async (frame: string): Promise<FiberSource | null> => {
  const source = errorStackParser.parseStack(frame);

  if (!source.length) {
    return null;
  }

  // Handle both absolute and relative paths

  const { file, line, col } = source[0];

  if (!file || !line) {
    return null;
  }

  console.debug('[bippy] Parsing stack frame:', source[0]);

  const fileName = file || '';
  const lineNumber = line || 0;
  const columnNumber = col || 0;

  const response = await fetch(getActualFileSource(fileName));
  if (response.ok) {
    const content = await response.text();
    const sourcemap = await getSourceMap(fileName, content);

    if (sourcemap) {
      const result = sourcemap.originalPositionFor({
        line: lineNumber,
        column: columnNumber,
      });
      return {
        fileName: result.source || '',
        lineNumber: result.line || 0,
        columnNumber: result.column || 0,
      };
    }
  }
  return {
    fileName,
    lineNumber,
    columnNumber,
  };
};

// https://github.com/hoxyq/react/blob/e450e6b97653fc5b7a56ec700e87546abfd91aa3/packages/react-devtools-shared/src/backend/DevToolsComponentStackFrame.js#L67
function describeNativeComponentFrame(
  fn: React.ComponentType<unknown>,
  construct: boolean,
  currentDispatcherRef: React.MutableRefObject<unknown>,
) {
  if (!fn || reentry) {
    return '';
  }

  const previousPrepareStackTrace = Error.prepareStackTrace;
  Error.prepareStackTrace = undefined;
  reentry = true;

  const previousDispatcher = currentDispatcherRef.current;
  currentDispatcherRef.current = null;
  const prevLogs = disableLogs();

  const RunInRootFrame = {
    DetermineComponentFrameRoot(): [string | null, string | null] {
      let control: Error | undefined;
      try {
        // Handle both class and function components
        if (construct) {
          // For class components, we need to create an instance
          const Fake = () => {
            throw Error();
          };
          Object.defineProperty(Fake.prototype, 'props', {
            set: () => {
              throw Error();
            },
          });
          if (typeof Reflect === 'object' && Reflect.construct) {
            try {
              Reflect.construct(Fake, []);
            } catch (x) {
              control = x as Error;
            }
            Reflect.construct(fn as new () => unknown, [], Fake);
          } else {
            try {
              Fake.call(null);
            } catch (x) {
              control = x as Error;
            }
            (fn as new () => unknown).call(Fake.prototype);
          }
        } else {
          try {
            throw Error();
          } catch (x) {
            control = x as Error;
          }
          const maybePromise = (fn as () => unknown)();

          if (
            maybePromise &&
            typeof maybePromise === 'object' &&
            'catch' in maybePromise &&
            typeof maybePromise.catch === 'function'
          ) {
            maybePromise.catch(() => {});
          }
        }
      } catch (sample) {
        if (
          sample instanceof Error &&
          control &&
          control.stack &&
          sample.stack
        ) {
          return [sample.stack, control.stack];
        }
      }
      return [null, null];
    },
  };

  (
    RunInRootFrame.DetermineComponentFrameRoot as React.ComponentType<unknown>
  ).displayName = 'DetermineComponentFrameRoot';
  const namePropDescriptor = Object.getOwnPropertyDescriptor(
    RunInRootFrame.DetermineComponentFrameRoot,
    'name',
  );
  if (namePropDescriptor?.configurable) {
    Object.defineProperty(RunInRootFrame.DetermineComponentFrameRoot, 'name', {
      value: 'DetermineComponentFrameRoot',
    });
  }

  try {
    const [sampleStack, controlStack] =
      RunInRootFrame.DetermineComponentFrameRoot();
    if (sampleStack && controlStack) {
      const sampleLines = sampleStack.split('\n');
      const controlLines = controlStack.split('\n');
      let s = 0;
      let c = 0;
      while (
        s < sampleLines.length &&
        !sampleLines[s].includes('DetermineComponentFrameRoot')
      ) {
        s++;
      }
      while (
        c < controlLines.length &&
        !controlLines[c].includes('DetermineComponentFrameRoot')
      ) {
        c++;
      }
      if (s === sampleLines.length || c === controlLines.length) {
        s = sampleLines.length - 1;
        c = controlLines.length - 1;
        while (s >= 1 && c >= 0 && sampleLines[s] !== controlLines[c]) {
          c--;
        }
      }
      for (; s >= 1 && c >= 0; s--, c--) {
        if (sampleLines[s] !== controlLines[c]) {
          if (s !== 1 || c !== 1) {
            do {
              s--;
              c--;
              if (c < 0 || sampleLines[s] !== controlLines[c]) {
                // biome-ignore lint/style/useTemplate: <explanation>
                let frame = '\n' + sampleLines[s].replace(' at new ', ' at ');
                if (fn.displayName && frame.includes('<anonymous>')) {
                  frame = frame.replace('<anonymous>', fn.displayName);
                }
                return frame;
              }
            } while (s >= 1 && c >= 0);
          }
          break;
        }
      }
    }
  } finally {
    reentry = false;
    Error.prepareStackTrace = previousPrepareStackTrace;
    currentDispatcherRef.current = previousDispatcher;
    reenableLogs(prevLogs);
  }

  const name = fn ? fn.displayName || fn.name : '';
  const syntheticFrame = name ? describeBuiltInComponentFrame(name) : '';
  return syntheticFrame;
}

// Make getFiberSource async to handle file fetching
export const getFiberSource = async (
  fiber: Fiber,
): Promise<FiberSource | null> => {
  const rdtHook = getRDTHook();
  let currentDispatcherRef: React.MutableRefObject<unknown> | undefined;
  for (const renderer of rdtHook.renderers.values()) {
    // biome-ignore lint/suspicious/noExplicitAny: <explanation>
    currentDispatcherRef = (renderer as any).currentDispatcherRef;
    if (currentDispatcherRef) {
      break;
    }
  }
  if (!currentDispatcherRef) {
    return null;
  }

  // If no debug source, try to get it from the component function
  const componentFunction = isHostFiber(fiber)
    ? getType(
        traverseFiber(
          fiber,
          (f) => {
            if (isCompositeFiber(f)) return true;
          },
          true,
        ),
      )
    : getType(fiber.type);
  if (!componentFunction || reentry) {
    return null;
  }

  const frame = describeNativeComponentFrame(
    componentFunction,
    fiber.tag === ClassComponentTag,
    currentDispatcherRef,
  );
  return parseStackFrame(frame);
};

export const mountFiberRecursively = (
  onRender: RenderHandler,
  firstChild: Fiber,
  traverseSiblings: boolean,
): void => {
  let fiber: Fiber | null = firstChild;

  while (fiber != null) {
    if (!fiberIdMap.has(fiber)) {
      getFiberId(fiber);
    }
    const shouldIncludeInTree = !shouldFilterFiber(fiber);
    if (shouldIncludeInTree && didFiberRender(fiber)) {
      onRender(fiber, 'mount');
    }

    if (fiber.tag === SuspenseComponentTag) {
      const isTimedOut = fiber.memoizedState !== null;
      if (isTimedOut) {
        // Special case: if Suspense mounts in a timed-out state,
        // get the fallback child from the inner fragment and mount
        // it as if it was our own child. Updates handle this too.
        const primaryChildFragment = fiber.child;
        const fallbackChildFragment = primaryChildFragment
          ? primaryChildFragment.sibling
          : null;
        if (fallbackChildFragment) {
          const fallbackChild = fallbackChildFragment.child;
          if (fallbackChild !== null) {
            mountFiberRecursively(onRender, fallbackChild, false);
          }
        }
      } else {
        let primaryChild: Fiber | null = null;
        const areSuspenseChildrenConditionallyWrapped =
          (OffscreenComponentTag as number) === -1;
        if (areSuspenseChildrenConditionallyWrapped) {
          primaryChild = fiber.child;
        } else if (fiber.child !== null) {
          primaryChild = fiber.child.child;
        }
        if (primaryChild !== null) {
          mountFiberRecursively(onRender, primaryChild, false);
        }
      }
    } else if (fiber.child != null) {
      mountFiberRecursively(onRender, fiber.child, true);
    }
    fiber = traverseSiblings ? fiber.sibling : null;
  }
};

export const updateFiberRecursively = (
  onRender: RenderHandler,
  nextFiber: Fiber,
  prevFiber: Fiber,
  parentFiber: Fiber | null,
): void => {
  if (!fiberIdMap.has(nextFiber)) {
    getFiberId(nextFiber);
  }
  if (!prevFiber) return;
  if (!fiberIdMap.has(prevFiber)) {
    getFiberId(prevFiber);
  }

  const isSuspense = nextFiber.tag === SuspenseComponentTag;

  const shouldIncludeInTree = !shouldFilterFiber(nextFiber);
  if (shouldIncludeInTree && didFiberRender(nextFiber)) {
    onRender(nextFiber, 'update');
  }

  // The behavior of timed-out Suspense trees is unique.
  // Rather than unmount the timed out content (and possibly lose important state),
  // React re-parents this content within a hidden Fragment while the fallback is showing.
  // This behavior doesn't need to be observable in the DevTools though.
  // It might even result in a bad user experience for e.g. node selection in the Elements panel.
  // The easiest fix is to strip out the intermediate Fragment fibers,
  // so the Elements panel and Profiler don't need to special case them.
  // Suspense components only have a non-null memoizedState if they're timed-out.
  const prevDidTimeout = isSuspense && prevFiber.memoizedState !== null;
  const nextDidTimeOut = isSuspense && nextFiber.memoizedState !== null;

  // The logic below is inspired by the code paths in updateSuspenseComponent()
  // inside ReactFiberBeginWork in the React source code.
  if (prevDidTimeout && nextDidTimeOut) {
    // Fallback -> Fallback:
    // 1. Reconcile fallback set.
    const nextFallbackChildSet = nextFiber.child?.sibling ?? null;
    // Note: We can't use nextFiber.child.sibling.alternate
    // because the set is special and alternate may not exist.
    const prevFallbackChildSet = prevFiber.child?.sibling ?? null;

    if (nextFallbackChildSet !== null && prevFallbackChildSet !== null) {
      updateFiberRecursively(
        onRender,
        nextFallbackChildSet,
        prevFallbackChildSet,
        nextFiber,
      );
    }
  } else if (prevDidTimeout && !nextDidTimeOut) {
    // Fallback -> Primary:
    // 1. Unmount fallback set
    // Note: don't emulate fallback unmount because React actually did it.
    // 2. Mount primary set
    const nextPrimaryChildSet = nextFiber.child;

    if (nextPrimaryChildSet !== null) {
      mountFiberRecursively(onRender, nextPrimaryChildSet, true);
    }
  } else if (!prevDidTimeout && nextDidTimeOut) {
    // Primary -> Fallback:
    // 1. Hide primary set
    // This is not a real unmount, so it won't get reported by React.
    // We need to manually walk the previous tree and record unmounts.
    unmountFiberChildrenRecursively(onRender, prevFiber);

    // 2. Mount fallback set
    const nextFallbackChildSet = nextFiber.child?.sibling ?? null;

    if (nextFallbackChildSet !== null) {
      mountFiberRecursively(onRender, nextFallbackChildSet, true);
    }
  } else if (nextFiber.child !== prevFiber.child) {
    // Common case: Primary -> Primary.
    // This is the same code path as for non-Suspense fibers.

    // If the first child is different, we need to traverse them.
    // Each next child will be either a new child (mount) or an alternate (update).
    let nextChild = nextFiber.child;

    while (nextChild) {
      // We already know children will be referentially different because
      // they are either new mounts or alternates of previous children.
      // Schedule updates and mounts depending on whether alternates exist.
      // We don't track deletions here because they are reported separately.
      if (nextChild.alternate) {
        const prevChild = nextChild.alternate;

        updateFiberRecursively(
          onRender,
          nextChild,
          prevChild,
          shouldIncludeInTree ? nextFiber : parentFiber,
        );
      } else {
        mountFiberRecursively(onRender, nextChild, false);
      }

      // Try the next child.
      nextChild = nextChild.sibling;
    }
  }
};

export const unmountFiber = (onRender: RenderHandler, fiber: Fiber): void => {
  const isRoot = fiber.tag === HostRootTag;

  if (isRoot || !shouldFilterFiber(fiber)) {
    onRender(fiber, 'unmount');
  }
};

export const unmountFiberChildrenRecursively = (
  onRender: RenderHandler,
  fiber: Fiber,
): void => {
  // We might meet a nested Suspense on our way.
  const isTimedOutSuspense =
    fiber.tag === SuspenseComponentTag && fiber.memoizedState !== null;
  let child = fiber.child;

  if (isTimedOutSuspense) {
    // If it's showing fallback tree, let's traverse it instead.
    const primaryChildFragment = fiber.child;
    const fallbackChildFragment = primaryChildFragment?.sibling ?? null;

    // Skip over to the real Fiber child.
    child = fallbackChildFragment?.child ?? null;
  }

  while (child !== null) {
    // Record simulated unmounts children-first.
    // We skip nodes without return because those are real unmounts.
    if (child.return !== null) {
      unmountFiber(onRender, child);
      unmountFiberChildrenRecursively(onRender, child);
    }

    child = child.sibling;
  }
};

let commitId = 0;
const rootInstanceMap = new WeakMap<
  FiberRoot,
  {
    prevFiber: Fiber | null;
    id: number;
  }
>();

/**
 * Creates a fiber visitor function. Must pass a fiber root and a render handler.
 * @example
 * traverseRenderedFibers(root, (fiber, phase) => {
 *   console.log(phase)
 * })
 */
export const traverseRenderedFibers = (
  root: FiberRoot,
  onRender: RenderHandler,
): void => {
  const fiber = 'current' in root ? root.current : root;

  let rootInstance = rootInstanceMap.get(root);

  if (!rootInstance) {
    rootInstance = { prevFiber: null, id: commitId++ };
    rootInstanceMap.set(root, rootInstance);
  }

  const { prevFiber } = rootInstance;
  // if fiberRoot don't have current instance, means it's been unmounted
  if (!fiber) {
    unmountFiber(onRender, fiber);
  } else if (prevFiber !== null) {
    const wasMounted =
      prevFiber &&
      prevFiber.memoizedState != null &&
      prevFiber.memoizedState.element != null &&
      // A dehydrated root is not considered mounted
      prevFiber.memoizedState.isDehydrated !== true;
    const isMounted =
      fiber.memoizedState != null &&
      fiber.memoizedState.element != null &&
      // A dehydrated root is not considered mounted
      fiber.memoizedState.isDehydrated !== true;

    if (!wasMounted && isMounted) {
      mountFiberRecursively(onRender, fiber, false);
    } else if (wasMounted && isMounted) {
      updateFiberRecursively(onRender, fiber, fiber.alternate, null);
    } else if (wasMounted && !isMounted) {
      unmountFiber(onRender, fiber);
    }
  } else {
    mountFiberRecursively(onRender, fiber, true);
  }

  rootInstance.prevFiber = fiber;
};

/**
 * @deprecated use `traverseRenderedFibers` instead
 */
export const createFiberVisitor = ({
  onRender,
}: {
  onRender: RenderHandler;
  onError: (error: unknown) => unknown;
}): (<S>(_rendererID: number, root: FiberRoot | Fiber, _state?: S) => void) => {
  return <S>(_rendererID: number, root: FiberRoot | Fiber, _state?: S) => {
    traverseRenderedFibers(root, onRender);
  };
};

export interface InstrumentationOptions {
  onCommitFiberRoot?: (
    rendererID: number,
    root: FiberRoot,
    // biome-ignore lint/suspicious/noConfusingVoidType: may be undefined
    priority: void | number,
  ) => unknown;
  onCommitFiberUnmount?: (rendererID: number, fiber: Fiber) => unknown;
  onPostCommitFiberRoot?: (rendererID: number, root: FiberRoot) => unknown;
  onActive?: () => unknown;
  name?: string;
}

/**
 * Instruments the DevTools hook.
 * @example
 * const hook = instrument({
 *   onActive() {
 *     console.log('initialized');
 *   },
 *   onCommitFiberRoot(rendererID, root) {
 *     console.log('fiberRoot', root.current)
 *   },
 * });
 */
export const instrument = (
  options: InstrumentationOptions,
): ReactDevToolsGlobalHook => {
  return getRDTHook(() => {
    const rdtHook = getRDTHook();

    options.onActive?.();

    rdtHook._instrumentationSource =
      options.name ?? BIPPY_INSTRUMENTATION_STRING;

    const prevOnCommitFiberRoot = rdtHook.onCommitFiberRoot;
    if (options.onCommitFiberRoot) {
      rdtHook.onCommitFiberRoot = (
        rendererID: number,
        root: FiberRoot,
        // biome-ignore lint/suspicious/noConfusingVoidType: may be undefined
        priority: void | number,
      ) => {
        if (prevOnCommitFiberRoot)
          prevOnCommitFiberRoot(rendererID, root, priority);
        options.onCommitFiberRoot?.(rendererID, root, priority);
      };
    }

    const prevOnCommitFiberUnmount = rdtHook.onCommitFiberUnmount;
    if (options.onCommitFiberUnmount) {
      rdtHook.onCommitFiberUnmount = (rendererID: number, root: FiberRoot) => {
        if (prevOnCommitFiberUnmount)
          prevOnCommitFiberUnmount(rendererID, root);
        options.onCommitFiberUnmount?.(rendererID, root);
      };
    }

    const prevOnPostCommitFiberRoot = rdtHook.onPostCommitFiberRoot;
    if (options.onPostCommitFiberRoot) {
      rdtHook.onPostCommitFiberRoot = (rendererID: number, root: FiberRoot) => {
        if (prevOnPostCommitFiberRoot)
          prevOnPostCommitFiberRoot(rendererID, root);
        options.onPostCommitFiberRoot?.(rendererID, root);
      };
    }
  });
};

export const getFiberFromHostInstance = <T>(hostInstance: T): Fiber | null => {
  const rdtHook = getRDTHook();
  for (const renderer of rdtHook.renderers.values()) {
    try {
      const fiber = renderer.findFiberByHostInstance?.(hostInstance);
      if (fiber) return fiber;
    } catch {}
  }

  if (typeof hostInstance === 'object' && hostInstance != null) {
    if ('_reactRootContainer' in hostInstance) {
      // biome-ignore lint/suspicious/noExplicitAny: OK
      return (hostInstance._reactRootContainer as any)?._internalRoot?.current
        ?.child;
    }

    for (const key in hostInstance) {
      if (
        key.startsWith('__reactInternalInstance$') ||
        key.startsWith('__reactFiber')
      ) {
        return (hostInstance[key] || null) as Fiber | null;
      }
    }
  }
  return null;
};

export const INSTALL_ERROR = new Error();

export const secure = (
  options: InstrumentationOptions,
  secureOptions: {
    minReactMajorVersion?: number;
    dangerouslyRunInProduction?: boolean;
    onError?: (error?: unknown) => unknown;
    installCheckTimeout?: number;
    isProduction?: boolean;
  } = {},
): InstrumentationOptions => {
  const onActive = options.onActive;
  const isRDTHookInstalled = hasRDTHook();
  const isUsingRealReactDevtools = isRealReactDevtools();
  const isUsingReactRefresh = isReactRefresh();
  let timeout: number | undefined;
  let isProduction = secureOptions.isProduction ?? false;

  options.onActive = () => {
    clearTimeout(timeout);
    let isSecure = true;
    try {
      const rdtHook = getRDTHook();

      for (const renderer of rdtHook.renderers.values()) {
        const [majorVersion] = renderer.version.split('.');
        if (Number(majorVersion) < (secureOptions.minReactMajorVersion ?? 17)) {
          isSecure = false;
        }
        const buildType = detectReactBuildType(renderer);
        if (buildType !== 'development') {
          isProduction = true;
          if (!secureOptions.dangerouslyRunInProduction) {
            isSecure = false;
          }
        }
      }
    } catch (err) {
      secureOptions.onError?.(err);
    }

    if (!isSecure) {
      options.onCommitFiberRoot = undefined;
      options.onCommitFiberUnmount = undefined;
      options.onPostCommitFiberRoot = undefined;
      options.onActive = undefined;
      return;
    }
    onActive?.();

    try {
      const onCommitFiberRoot = options.onCommitFiberRoot;
      if (onCommitFiberRoot) {
        options.onCommitFiberRoot = (rendererID, root, priority) => {
          try {
            onCommitFiberRoot(rendererID, root, priority);
          } catch (err) {
            secureOptions.onError?.(err);
          }
        };
      }

      const onCommitFiberUnmount = options.onCommitFiberUnmount;
      if (onCommitFiberUnmount) {
        options.onCommitFiberUnmount = (rendererID, root) => {
          try {
            onCommitFiberUnmount(rendererID, root);
          } catch (err) {
            secureOptions.onError?.(err);
          }
        };
      }

      const onPostCommitFiberRoot = options.onPostCommitFiberRoot;
      if (onPostCommitFiberRoot) {
        options.onPostCommitFiberRoot = (rendererID, root) => {
          try {
            onPostCommitFiberRoot(rendererID, root);
          } catch (err) {
            secureOptions.onError?.(err);
          }
        };
      }
    } catch (err) {
      secureOptions.onError?.(err);
    }
  };

  if (
    !isRDTHookInstalled &&
    !isUsingRealReactDevtools &&
    !isUsingReactRefresh
  ) {
    timeout = setTimeout(() => {
      if (!isProduction) {
        secureOptions.onError?.(INSTALL_ERROR);
      }
      stop();
    }, secureOptions.installCheckTimeout ?? 100) as unknown as number;
  }

  return options;
};

/**
 * a wrapper around the {@link instrument} function that sets the `onCommitFiberRoot` hook.
 *
 * @example
 * onCommitFiberRoot((root) => {
 *   console.log(root.current);
 * });
 */
export const onCommitFiberRoot = (
  handler: (root: FiberRoot) => void,
): ReactDevToolsGlobalHook => {
  return instrument(
    secure({
      onCommitFiberRoot: (_, root) => {
        handler(root);
      },
    }),
  );
};

export * from './install-hook-script-string.js';
export * from './rdt-hook.js';
export type * from './types.js';
