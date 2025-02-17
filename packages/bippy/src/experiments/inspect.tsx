import {
  detectReactBuildType,
  type Fiber,
  getDisplayName,
  getFiberFromHostInstance,
  getLatestFiber,
  getRDTHook,
  hasRDTHook,
  isInstrumentationActive,
} from '../index.js';
import { getFiberSource, type FiberSource } from '../source.js';
// biome-ignore lint/style/useImportType: needed for jsx
import React, {
  useEffect,
  useState,
  useImperativeHandle as useImperativeHandleOriginal,
  forwardRef,
} from 'react';
import ReactDOM from 'react-dom';
import { Inspector as ReactInspector } from 'react-inspector';

const useImperativeHandlePolyfill = (
  ref: React.RefCallback<unknown> | React.RefObject<unknown>,
  init: () => unknown,
  deps: React.DependencyList,
) => {
  // biome-ignore lint/correctness/useExhaustiveDependencies: biome is wrong
  useEffect(() => {
    if (ref) {
      if (typeof ref === 'function') {
        ref(init());
      } else if (typeof ref === 'object' && 'current' in ref) {
        ref.current = init();
      }
    }
  }, deps);
};

const useImperativeHandle =
  useImperativeHandleOriginal || useImperativeHandlePolyfill;

// biome-ignore lint/suspicious/noExplicitAny: OK
const throttle = (fn: (...args: any[]) => void, wait: number) => {
  let timeout: ReturnType<typeof setTimeout> | null = null;
  return function (this: unknown) {
    if (!timeout) {
      timeout = setTimeout(() => {
        // biome-ignore lint/style/noArguments: perf
        fn.apply(this, arguments as unknown as unknown[]);
        timeout = null;
      }, wait);
    }
  };
};

export interface InspectorProps {
  enabled?: boolean;
  children?: React.ReactNode;
  dangerouslyRunInProduction?: boolean;
}

export interface InspectorHandle {
  enable: () => void;
  disable: () => void;
  inspectElement: (element: Element) => void;
}

export const RawInspector = forwardRef<InspectorHandle, InspectorProps>(
  (
    { enabled = true, dangerouslyRunInProduction = false }: InspectorProps,
    ref,
  ) => {
    const [element, setElement] = useState<Element | null>(null);
    const [currentFiber, setCurrentFiber] = useState<Fiber | null>(null);
    const [currentFiberSource, setCurrentFiberSource] =
      useState<FiberSource | null>(null);
    const [rect, setRect] = useState<DOMRect | null>(null);
    const [isActive, setIsActive] = useState(true);
    const [isEnabled, setIsEnabled] = useState(enabled);
    const [position, setPosition] = useState({ top: 0, left: 0 });

    useImperativeHandle(ref, () => ({
      enable: () => setIsEnabled(true),
      disable: () => {
        setIsEnabled(false);
        setElement(null);
        setRect(null);
      },
      inspectElement: (element: Element) => {
        if (!isEnabled) return;
        setElement(element);
        setRect(element.getBoundingClientRect());
      },
    }));

    useEffect(() => {
      (async () => {
        if (!element) return;
        const fiber = getFiberFromHostInstance(element);
        if (!fiber) return;
        const latestFiber = getLatestFiber(fiber);
        const source = await getFiberSource(latestFiber);
        setCurrentFiber(latestFiber);
        if (source) {
          setCurrentFiberSource(source);
        }
      })();
    }, [element]);

    useEffect(() => {
      const handleMouseMove = (event: globalThis.MouseEvent) => {
        const isActive = isInstrumentationActive() || hasRDTHook();
        if (!isActive) {
          setIsActive(false);
          return;
        }

        if (!dangerouslyRunInProduction) {
          const rdtHook = getRDTHook();
          for (const renderer of rdtHook.renderers.values()) {
            const buildType = detectReactBuildType(renderer);
            if (buildType === 'production') {
              setIsActive(false);
              return;
            }
          }
        }

        if (!isEnabled) {
          setElement(null);
          setRect(null);
          return;
        }

        const element = document.elementFromPoint(event.clientX, event.clientY);
        if (!element) return;
        setElement(element);
        setRect(element.getBoundingClientRect());
      };

      const throttledMouseMove = throttle(handleMouseMove, 16);
      document.addEventListener('mousemove', throttledMouseMove);
      return () =>
        document.removeEventListener('mousemove', throttledMouseMove);
    }, [isEnabled, dangerouslyRunInProduction]);

    useEffect(() => {
      if (!rect) return;

      const padding = 10;
      const inspectorWidth = 400;
      const inspectorHeight = 320;

      let left = rect.left + rect.width + padding;
      let top = rect.top;

      if (left + inspectorWidth > window.innerWidth) {
        left = Math.max(padding, rect.left - inspectorWidth - padding);
      }

      if (top >= rect.top && top <= rect.bottom) {
        if (rect.bottom + inspectorHeight + padding <= window.innerHeight) {
          top = rect.bottom + padding;
        } else if (rect.top - inspectorHeight - padding >= 0) {
          top = rect.top - inspectorHeight - padding;
        } else {
          top = window.innerHeight - inspectorHeight - padding;
        }
      }

      top = Math.max(
        padding,
        Math.min(top, window.innerHeight - inspectorHeight - padding),
      );
      left = Math.max(
        padding,
        Math.min(left, window.innerWidth - inspectorWidth - padding),
      );

      setPosition({ top, left });
    }, [rect]);

    if (!rect || !isActive || !isEnabled) return null;

    if (!currentFiber) return null;

    return (
      <>
        <div
          style={{
            position: 'fixed',
            backgroundColor: '#242424',
            color: '#FFF',
            zIndex: 50,
            padding: '1ch',
            width: '50ch',
            height: '40ch',
            transition: 'all 150ms',
            overflow: 'auto',
            boxShadow: '0 1px 3px 0 rgb(0 0 0 / 0.3)',
            border: '1px solid #282828',
            opacity: rect ? 1 : 0,
            transform: rect ? 'translateY(0)' : 'translateY(10px)',
            pointerEvents: rect ? 'auto' : 'none',
            top: position.top,
            left: position.left,
          }}
        >
          <h3
            style={{
              fontSize: '0.875rem',
              backgroundColor: '#242424',
              color: '#FFF',
              padding: '0 0.5ch',
              borderRadius: '0.125rem',
              width: 'fit-content',
              margin: 0,
            }}
          >
            {`<${getDisplayName(currentFiber.type) || 'unknown'}>`}
          </h3>
          <div style={{ marginTop: '1ch' }}>
            {currentFiber && (
              <ReactInspector
                theme="chromeDark"
                data={currentFiber}
                expandLevel={1}
                table={false}
              />
            )}
          </div>
        </div>
        <div
          style={{
            position: 'fixed',
            zIndex: 40,
            pointerEvents: 'none',
            transition: 'all 150ms',
            border: '1px dashed #505050',
            left: rect.left,
            top: rect.top,
            width: rect.width,
            height: rect.height,
            opacity: rect ? 1 : 0,
          }}
        />
      </>
    );
  },
);

export const Inspector = forwardRef<InspectorHandle, InspectorProps>(
  (props, ref) => {
    const [root, setRoot] = useState<ShadowRoot | null>(null);

    useEffect(() => {
      const div = document.createElement('div');
      document.body.appendChild(div);
      const shadowRoot = div.attachShadow({ mode: 'open' });
      setRoot(shadowRoot);

      return () => {
        document.body.removeChild(div);
      };
    }, []);

    if (!root) return null;

    return ReactDOM.createPortal(<RawInspector ref={ref} {...props} />, root);
  },
);

export default Inspector;
