import React from 'react';
import noop from 'lodash/noop';
import { getScrollParent } from './util';

export type Options = {
    enabled?: boolean;
    intensity?: number; // Intensity factor to ramp up scroll speed as the cursor moves deeper into the scroll gutter
    onScroll?: (x: number, y: number) => void;
    reference: Element | null;
    size?: number; // Size of the invisible zone within the component where mouse events will trigger auto-scroll
};

export default function useAutoScroll(options: Options): void {
    const { enabled, intensity = 0.2, onScroll = noop, reference, size = 50 } = options;

    // Create refs to store un-rendered data, references, and state
    const handleRef = React.useRef<number | null>(null);
    const parentRef = React.useRef<Element | null>(null);
    const parentRectRef = React.useRef<DOMRect | null>(null);
    const positionXRef = React.useRef<number | null>(null);
    const positionYRef = React.useRef<number | null>(null);

    // Create handlers to be called when autoscroll is enabled
    const checkStep = (callback: () => void): void => {
        handleRef.current = window.requestAnimationFrame(callback);
    };
    const checkScroll = (): void => {
        const { current: parent } = parentRef;
        const { current: parentRect } = parentRectRef;
        const { current: positionX } = positionXRef;
        const { current: positionY } = positionYRef;

        if (!parent || !parentRect || positionX === null || positionY === null) {
            return checkStep(checkScroll);
        }

        // Calculate the inner scroll gutters for the scroll parent
        const edgeBottom = parentRect.bottom - size;
        const edgeLeft = parentRect.left + size;
        const edgeRight = parentRect.right - size;
        const edgeTop = parentRect.top + size;

        // Check if the current position is within any of the gutters
        const isEdgeBottom = positionY > edgeBottom;
        const isEdgeLeft = positionX < edgeLeft;
        const isEdgeRight = positionX > edgeRight;
        const isEdgeTop = positionY < edgeTop;

        if (!isEdgeBottom && !isEdgeLeft && !isEdgeRight && !isEdgeTop) {
            return checkStep(checkScroll);
        }

        let nextScrollLeft = parent.scrollLeft;
        let nextScrollTop = parent.scrollTop;

        if (isEdgeLeft) {
            nextScrollLeft -= (edgeLeft - positionX) * intensity;
        } else if (isEdgeRight) {
            nextScrollLeft += (positionX - edgeRight) * intensity;
        }

        if (isEdgeTop) {
            nextScrollTop -= (edgeTop - positionY) * intensity;
        } else if (isEdgeBottom) {
            nextScrollTop += (positionY - edgeBottom) * intensity;
        }

        // Sanitize inputs and use legacy scroll APIs for better browser support and smoother scrolling
        parent.scrollLeft = Math.max(0, Math.min(Math.round(nextScrollLeft), parent.scrollWidth));
        parent.scrollTop = Math.max(0, Math.min(Math.round(nextScrollTop), parent.scrollHeight));

        // Inform the parent of the scroll change, if any
        onScroll(positionX, positionY);

        return checkStep(checkScroll);
    };

    // Event Handlers
    const handleMouseMove = ({ clientX, clientY }: MouseEvent): void => {
        positionXRef.current = clientX;
        positionYRef.current = clientY;
    };
    const handleTouchMove = ({ targetTouches }: TouchEvent): void => {
        positionXRef.current = targetTouches[0].clientX;
        positionYRef.current = targetTouches[0].clientY;
    };

    // Create reference to scroll parent on mount
    React.useEffect(() => {
        if (reference) {
            parentRef.current = getScrollParent(reference);
            parentRectRef.current = parentRef.current.getBoundingClientRect(); // Cache to improve performance
        }
    }, [reference]);

    // Create document-level event handlers for mouse/touch move
    React.useEffect(() => {
        if (enabled) {
            document.addEventListener('mousemove', handleMouseMove);
            document.addEventListener('touchmove', handleTouchMove);

            checkStep(checkScroll);
        }

        return (): void => {
            const { current: handle } = handleRef;

            // Cancel the scroll check loop
            if (handle) {
                window.cancelAnimationFrame(handle);
            }

            // Destroy stale references
            handleRef.current = null;
            positionXRef.current = null;
            positionYRef.current = null;

            // Destroy event listeners to avoid leaks
            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('touchmove', handleTouchMove);
        };
    }, [enabled]); // eslint-disable-line react-hooks/exhaustive-deps
}
