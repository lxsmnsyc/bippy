// Note: do not import React in this file
// since it will be executed before the react devtools hook is created

import type * as React from "react";
import type { Fiber as ReactFiber, FiberRoot } from "react-reconciler";

export type { FiberRoot };

/**
 * Represents a react-internal Fiber node.
 */
// biome-ignore lint/suspicious/noExplicitAny: stateNode is not typed in react-reconciler
export type Fiber<T = any> = Omit<ReactFiber, "stateNode"> & {
	stateNode: T;
};

// https://github.com/facebook/react/blob/6a4b46cd70d2672bc4be59dcb5b8dede22ed0cef/packages/react-devtools-shared/src/backend/types.js
export interface ReactRenderer {
	version: string;
	bundleType: 0 /* PROD */ | 1 /* DEV */;
}

export interface ReactDevToolsGlobalHook {
	checkDCE: (fn: unknown) => void;
	supportsFiber: boolean;
	supportsFlight: boolean;
	renderers: Map<number, ReactRenderer>;
	hasUnsupportedRendererAttached: boolean;
	onCommitFiberRoot: (
		rendererID: number,
		root: FiberRoot,
		// biome-ignore lint/suspicious/noConfusingVoidType: may or may not exist
		priority: void | number,
	) => void;
	onCommitFiberUnmount: (rendererID: number, fiber: Fiber) => void;
	onPostCommitFiberRoot: (rendererID: number, root: FiberRoot) => void;
	inject: (renderer: ReactRenderer) => number;
	_instrumentationSource?: string;
	_instrumentationIsActive?: boolean;
}

export const version = process.env.VERSION;
export const BIPPY_INSTRUMENTATION_STRING = `bippy-${version}`;
export const ClassComponentTag = 1;
export const FunctionComponentTag = 0;
export const ContextConsumerTag = 9;
export const SuspenseComponentTag = 13;
export const OffscreenComponentTag = 22;
export const ForwardRefTag = 11;
export const MemoComponentTag = 14;
export const SimpleMemoComponentTag = 15;
export const HostComponentTag = 5;
export const HostHoistableTag = 26;
export const HostSingletonTag = 27;
export const DehydratedSuspenseComponent = 18;
export const HostText = 6;
export const Fragment = 7;
export const LegacyHiddenComponent = 23;
export const OffscreenComponent = 22;
export const HostRoot = 3;
export const CONCURRENT_MODE_NUMBER = 0xeacf;
export const ELEMENT_TYPE_SYMBOL_STRING = "Symbol(react.element)";
export const TRANSITIONAL_ELEMENT_TYPE_SYMBOL_STRING =
	"Symbol(react.transitional.element)";
export const CONCURRENT_MODE_SYMBOL_STRING = "Symbol(react.concurrent_mode)";
export const DEPRECATED_ASYNC_MODE_SYMBOL_STRING = "Symbol(react.async_mode)";

// https://github.com/facebook/react/blob/main/packages/react-reconciler/src/ReactFiberFlags.js
export const PerformedWork = 0b1;
export const Placement = 0b10;
export const DidCapture = 0b10000000;
export const Hydrating = 0b1000000000000;
export const Update = 0b100;
export const Cloned = 0b1000;
export const ChildDeletion = 0b10000;
export const ContentReset = 0b100000;
export const Ref = 0b1000000000;
export const Snapshot = 0b10000000000;
export const Visibility = 0b10000000000000;
export const MutationMask =
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
	typeof element === "object" &&
	element != null &&
	"$$typeof" in element &&
	// react 18 uses Symbol.for('react.element'), react 19 uses Symbol.for('react.transitional.element')
	[
		ELEMENT_TYPE_SYMBOL_STRING,
		TRANSITIONAL_ELEMENT_TYPE_SYMBOL_STRING,
	].includes(String(element.$$typeof));

/**
 * Returns `true` if object is a React Fiber.
 */
export const isValidFiber = (fiber: unknown): fiber is Fiber =>
	typeof fiber === "object" &&
	fiber != null &&
	"tag" in fiber &&
	"stateNode" in fiber &&
	"return" in fiber &&
	"child" in fiber &&
	"sibling" in fiber &&
	"flags" in fiber;

/**
 * Returns `true` if fiber is a host fiber. Host fibers are DOM nodes in react-dom, `View` in react-native, etc.
 *
 * @see https://reactnative.dev/architecture/glossary#host-view-tree-and-host-view
 */
export const isHostFiber = (fiber: Fiber) =>
	fiber.tag === HostComponentTag ||
	// @ts-expect-error: it exists
	fiber.tag === HostHoistableTag ||
	// @ts-expect-error: it exists
	fiber.tag === HostSingletonTag ||
	typeof fiber.type === "string";

/**
 * Returns `true` if fiber is a composite fiber. Composite fibers are fibers that can render (like functional components, class components, etc.)
 *
 * @see https://reactnative.dev/architecture/glossary#react-composite-components
 */
export const isCompositeFiber = (fiber: Fiber) =>
	fiber.tag === FunctionComponentTag ||
	fiber.tag === ClassComponentTag ||
	fiber.tag === SimpleMemoComponentTag ||
	fiber.tag === MemoComponentTag ||
	fiber.tag === ForwardRefTag;

interface FiberContext {
	context: React.Context<unknown>;
	memoizedValue: unknown;
}

/**
 * Traverses up or down a {@link Fiber}'s contexts, return `true` to stop and select the current and previous context value.
 */
export const traverseContexts = (
	fiber: Fiber,
	selector: (
		nextValue: FiberContext,
		prevValue: FiberContext,
		// biome-ignore lint/suspicious/noConfusingVoidType: <explanation>
	) => boolean | void,
) => {
	try {
		const nextDependencies = fiber.dependencies;
		const prevDependencies = fiber.alternate?.dependencies;

		if (!nextDependencies || !prevDependencies) return false;
		if (
			typeof nextDependencies !== "object" ||
			!("firstContext" in nextDependencies) ||
			typeof prevDependencies !== "object" ||
			!("firstContext" in prevDependencies)
		) {
			return false;
		}
		let nextContext = nextDependencies.firstContext;
		let prevContext = prevDependencies.firstContext;
		while (
			nextContext &&
			typeof nextContext === "object" &&
			"memoizedValue" in nextContext &&
			prevContext &&
			typeof prevContext === "object" &&
			"memoizedValue" in prevContext
		) {
			if (
				selector(
					nextContext as unknown as FiberContext,
					prevContext as unknown as FiberContext,
				) === true
			)
				return true;

			nextContext = nextContext.next;
			prevContext = prevContext.next;
		}
	} catch {
		/**/
	}
	return false;
};

/**
 * Traverses up or down a {@link Fiber}'s states, return `true` to stop and select the current and previous state value.
 */
export const traverseState = (
	fiber: Fiber,
	selector: (
		prevValue: { memoizedState: unknown },
		nextValue: { memoizedState: unknown },
		// biome-ignore lint/suspicious/noConfusingVoidType: <explanation>
	) => boolean | void,
) => {
	try {
		let prevState = fiber.memoizedState;
		let nextState = fiber.alternate?.memoizedState;

		while (prevState && nextState) {
			if (selector(prevState, nextState) === true) return true;

			prevState = prevState.next;
			nextState = nextState.next;
		}
	} catch {
		/**/
	}

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
) => {
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
	} catch {
		/**/
	}
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
		(fiber.flags & (Update | Placement | ChildDeletion)) !== 0 ||
			(fiber.subtreeFlags & (Update | Placement | ChildDeletion)) !== 0,
	);
};

/**
 * Returns all host {@link Fiber}s that have committed and rendered.
 */
export const getMutatedHostFibers = (fiber: Fiber): Array<Fiber> => {
	const mutations: Array<Fiber> = [];
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
export const getFiberStack = (fiber: Fiber) => {
	const stack: Array<Fiber> = [];
	let currentFiber = fiber;
	while (currentFiber.return) {
		stack.push(currentFiber);
		currentFiber = currentFiber.return;
	}
	const newStack = new Array(stack.length);
	for (let i = 0; i < stack.length; i++) {
		newStack[i] = stack[stack.length - i - 1];
	}
	return newStack;
};

/**
 * Returns `true` if the {@link Fiber} should be filtered out during reconciliation.
 */
export const shouldFilterFiber = (fiber: Fiber) => {
	switch (fiber.tag) {
		case DehydratedSuspenseComponent:
			// TODO: ideally we would show dehydrated Suspense immediately.
			// However, it has some special behavior (like disconnecting
			// an alternate and turning into real Suspense) which breaks DevTools.
			// For now, ignore it, and only show it once it gets hydrated.
			// https://github.com/bvaughn/react-devtools-experimental/issues/197
			return true;

		case HostText:
		case Fragment:
		case LegacyHiddenComponent:
		case OffscreenComponent:
			return true;

		case HostRoot:
			// It is never valid to filter the root element.
			return false;

		default: {
			const symbolOrNumber =
				typeof fiber.type === "object" && fiber.type !== null
					? fiber.type.$$typeof
					: fiber.type;

			const typeSymbol =
				typeof symbolOrNumber === "symbol"
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
export const getNearestHostFiber = (fiber: Fiber, ascending = false) => {
	let hostFiber = traverseFiber(fiber, isHostFiber, ascending);
	if (!hostFiber) {
		hostFiber = traverseFiber(fiber, isHostFiber, !ascending);
	}
	return hostFiber;
};

/**
 * Returns all host {@link Fiber}s in the tree that are associated with the current {@link Fiber}.
 */
export const getNearestHostFibers = (fiber: Fiber) => {
	const hostFibers: Array<Fiber> = [];

	const traverse = (node: Fiber | null) => {
		let currentNode = node;
		while (currentNode) {
			if (isHostFiber(currentNode)) {
				hostFibers.push(currentNode);
			} else if (currentNode.child) {
				traverse(currentNode.child);
			}
			currentNode = currentNode.sibling;
		}
	};

	traverse(fiber);

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
export const getTimings = (fiber?: Fiber | null | undefined) => {
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
export const hasMemoCache = (fiber: Fiber) => {
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
	if (typeof currentType === "function") {
		return currentType;
	}
	if (typeof currentType === "object" && currentType) {
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
		typeof currentType !== "function" &&
		!(typeof currentType === "object" && currentType)
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
 * Returns `true` if the DevTools backend is injected.
 */
export const isUsingRDT = () => "reactDevtoolsAgent" in getRDTHook();

/**
 * Returns the build type of the React renderer.
 */
export const detectReactBuildType = (renderer: ReactRenderer) => {
	try {
		if (typeof renderer.version === "string" && renderer.bundleType > 0) {
			return "development";
		}
	} catch {
		/**/
	}
	return "production";
};

const checkDCE = (fn: unknown) => {
	try {
		const code = Function.prototype.toString.call(fn);
		if (code.indexOf("^_^") > -1) {
			setTimeout(() => {
				throw new Error(
					"React is running in production mode, but dead code " +
						"elimination has not been applied. Read how to correctly " +
						"configure React for production: " +
						"https://reactjs.org/link/perf-use-production-build",
				);
			});
		}
	} catch {
		/**/
	}
};

const NO_OP = () => {
	/**/
};

/**
 * Installs the React DevTools global hook.
 */
export const installRDTHook = (onActive?: () => unknown) => {
	const renderers = new Map<number, ReactRenderer>();
	let i = 0;
	const rdtHook: ReactDevToolsGlobalHook = {
		checkDCE,
		supportsFiber: true,
		supportsFlight: true,
		hasUnsupportedRendererAttached: false,
		renderers,
		onCommitFiberRoot: NO_OP,
		onCommitFiberUnmount: NO_OP,
		onPostCommitFiberRoot: NO_OP,
		inject(renderer) {
			const nextID = ++i;
			renderers.set(nextID, renderer);
			if (!rdtHook._instrumentationIsActive) {
				rdtHook._instrumentationIsActive = true;
				onActive?.();
			}
			return nextID;
		},
		_instrumentationSource: BIPPY_INSTRUMENTATION_STRING,
		_instrumentationIsActive: false,
	};
	try {
		Object.defineProperty(globalThis, "__REACT_DEVTOOLS_GLOBAL_HOOK__", {
			value: rdtHook,
		});
	} catch {
		// this will fail if RDT already installed the hook
	}
	return rdtHook;
};

/**
 * Returns the current React DevTools global hook.
 */
export const getRDTHook = (onActive?: () => unknown) => {
	let rdtHook = globalThis.__REACT_DEVTOOLS_GLOBAL_HOOK__;
	if (rdtHook) onActive?.();

	if (
		!Object.prototype.hasOwnProperty.call(
			globalThis,
			"__REACT_DEVTOOLS_GLOBAL_HOOK__",
		)
	) {
		rdtHook = installRDTHook(onActive);
	}
	return rdtHook;
};

/**
 * Returns `true` if bippy's instrumentation is active.
 */
export const isInstrumentationActive = () => {
	const rdtHook = getRDTHook();
	return Boolean(rdtHook._instrumentationIsActive) || isUsingRDT();
};

export type RenderPhase = "mount" | "update" | "unmount";

export type RenderHandler = <S>(
	fiber: Fiber,
	phase: RenderPhase,
	state?: S,
) => unknown;

export const mountFiberRecursively = (
	onRender: RenderHandler,
	firstChild: Fiber,
	traverseSiblings: boolean,
) => {
	let fiber: Fiber | null = firstChild;

	while (fiber != null) {
		const shouldIncludeInTree = !shouldFilterFiber(fiber);
		if (shouldIncludeInTree && didFiberRender(fiber)) {
			onRender(fiber, "mount");
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
) => {
	if (!prevFiber) return;

	const isSuspense = nextFiber.tag === SuspenseComponentTag;

	const shouldIncludeInTree = !shouldFilterFiber(nextFiber);
	if (shouldIncludeInTree && didFiberRender(nextFiber)) {
		onRender(nextFiber, "update");
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

export const unmountFiber = (onRender: RenderHandler, fiber: Fiber) => {
	const isRoot = fiber.tag === HostRoot;

	if (isRoot || !shouldFilterFiber(fiber)) {
		onRender(fiber, "unmount");
	}
};

export const unmountFiberChildrenRecursively = (
	onRender: RenderHandler,
	fiber: Fiber,
) => {
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
 * Creates a fiber visitor function.
 * @example
 * const visitor = createFiberVisitor({
 *   onRender(fiber, phase) {
 *     console.log(phase)
 *   },
 * });
 */
export const createFiberVisitor = ({
	onRender: onRenderWithoutState,
	onError,
}: {
	onRender: RenderHandler;
	onError: (error: unknown) => unknown;
}) => {
	return <S>(_rendererID: number, root: FiberRoot, state?: S) => {
		const rootFiber = root.current;
		const onRender = (fiber: Fiber, phase: RenderPhase) =>
			onRenderWithoutState<S>(fiber, phase, state);

		let rootInstance = rootInstanceMap.get(root);

		if (!rootInstance) {
			rootInstance = { prevFiber: null, id: commitId++ };
			rootInstanceMap.set(root, rootInstance);
		}

		const { prevFiber } = rootInstance;
		try {
			// if fiberRoot don't have current instance, means it's been unmounted
			if (!rootFiber) {
				unmountFiber(onRender, root);
			} else if (prevFiber !== null) {
				const wasMounted =
					prevFiber &&
					prevFiber.memoizedState != null &&
					prevFiber.memoizedState.element != null &&
					// A dehydrated root is not considered mounted
					prevFiber.memoizedState.isDehydrated !== true;
				const isMounted =
					rootFiber.memoizedState != null &&
					rootFiber.memoizedState.element != null &&
					// A dehydrated root is not considered mounted
					rootFiber.memoizedState.isDehydrated !== true;

				if (!wasMounted && isMounted) {
					mountFiberRecursively(onRender, rootFiber, false);
				} else if (wasMounted && isMounted) {
					updateFiberRecursively(
						onRender,
						rootFiber,
						rootFiber.alternate,
						null,
					);
				} else if (wasMounted && !isMounted) {
					unmountFiber(onRender, rootFiber);
				}
			} else {
				mountFiberRecursively(onRender, rootFiber, false);
			}
		} catch (err) {
			onError(err);
		}
		rootInstance.prevFiber = rootFiber;
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
export const instrument = (options: InstrumentationOptions) => {
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

export const secure = (
	options: InstrumentationOptions,
): InstrumentationOptions => {
	const onActive = options.onActive;

	options.onActive = () => {
		let isSecure = true;
		try {
			onActive?.();
			const rdtHook = getRDTHook();

			for (const renderer of rdtHook.renderers.values()) {
				const [majorVersion] = renderer.version.split(".");
				if (Number(majorVersion) < 17) {
					isSecure = false;
				}
				const buildType = detectReactBuildType(renderer);
				if (buildType !== "development") {
					isSecure = false;
				}
			}
		} catch {}

		if (!isSecure) {
			options.onCommitFiberRoot = undefined;
			options.onCommitFiberUnmount = undefined;
			options.onPostCommitFiberRoot = undefined;
			options.onActive = undefined;
			return;
		}

		const onCommitFiberRoot = options.onCommitFiberRoot;
		if (onCommitFiberRoot) {
			options.onCommitFiberRoot = (rendererID, root, priority) => {
				try {
					return onCommitFiberRoot(rendererID, root, priority);
				} catch {}
			};
		}

		const onCommitFiberUnmount = options.onCommitFiberUnmount;
		if (onCommitFiberUnmount) {
			options.onCommitFiberUnmount = (rendererID, root) => {
				try {
					return onCommitFiberUnmount(rendererID, root);
				} catch {}
			};
		}

		const onPostCommitFiberRoot = options.onPostCommitFiberRoot;
		if (onPostCommitFiberRoot) {
			options.onPostCommitFiberRoot = (rendererID, root) => {
				try {
					return onPostCommitFiberRoot(rendererID, root);
				} catch {}
			};
		}
	};

	return options;
};