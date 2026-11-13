import * as React from "react";
import * as TooltipPrimitive from "@radix-ui/react-tooltip";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

type TruncatedTitleElement = "span" | "div" | "p" | "h1" | "h2" | "h3" | "h4";

export interface TruncatedTitleProps
  extends Omit<React.HTMLAttributes<HTMLElement>, "title"> {
  /** Full title text shown in the floating hover card when truncated. Also rendered as content if `children` is omitted. */
  text: string;
  /** Optional custom content (e.g. text + inline badge). Defaults to `text`. */
  children?: React.ReactNode;
  /** HTML element to render. Defaults to "span". */
  as?: TruncatedTitleElement;
  /** Preferred side for the floating card. Defaults to "top". */
  side?: "top" | "right" | "bottom" | "left";
  /** Hover delay in ms. Defaults to 200. */
  delayDuration?: number;
}

/**
 * Renders a title with its existing truncation classes intact and displays the
 * full `text` inside a light floating card on hover—only when the rendered
 * content is actually overflowing/ellipsized.
 */
export const TruncatedTitle = React.forwardRef<HTMLElement, TruncatedTitleProps>(
  (
    {
      text,
      children,
      as: Component = "span",
      className,
      side = "top",
      delayDuration = 200,
      onMouseEnter,
      onFocus,
      ...props
    },
    forwardedRef
  ) => {
    const innerRef = React.useRef<HTMLElement | null>(null);
    const [isTruncated, setIsTruncated] = React.useState(false);

    const setRefs = React.useCallback(
      (node: HTMLElement | null) => {
        innerRef.current = node;
        if (typeof forwardedRef === "function") {
          forwardedRef(node);
        } else if (forwardedRef) {
          (forwardedRef as React.MutableRefObject<HTMLElement | null>).current = node;
        }
      },
      [forwardedRef]
    );

    const checkTruncation = React.useCallback(() => {
      const el = innerRef.current;
      if (!el) return;
      const truncated =
        el.scrollWidth > el.clientWidth + 1 ||
        el.scrollHeight > el.clientHeight + 1;
      setIsTruncated(truncated);
    }, []);

    const handleMouseEnter = React.useCallback(
      (e: React.MouseEvent<HTMLElement>) => {
        checkTruncation();
        onMouseEnter?.(e);
      },
      [checkTruncation, onMouseEnter]
    );

    const handleFocus = React.useCallback(
      (e: React.FocusEvent<HTMLElement>) => {
        checkTruncation();
        onFocus?.(e);
      },
      [checkTruncation, onFocus]
    );

    const triggerElement = (
      <Component
        ref={setRefs as React.Ref<never>}
        className={className}
        onMouseEnter={handleMouseEnter}
        onFocus={handleFocus}
        {...props}
      >
        {children ?? text}
      </Component>
    );

    if (!text) {
      return triggerElement;
    }

    return (
      <Tooltip delayDuration={delayDuration}>
        <TooltipTrigger asChild>{triggerElement}</TooltipTrigger>
        {isTruncated && (
          <TooltipPrimitive.Portal>
            <TooltipContent
              side={side}
              sideOffset={6}
              className={cn(
                "z-[100] max-w-[320px] rounded-lg border border-black/[0.08] bg-white px-3 py-1.5 text-xs font-medium leading-snug text-[#17171A] shadow-[0_8px_24px_rgba(0,0,0,0.12)] break-words whitespace-normal",
                "dark:border-white/10 dark:bg-popover dark:text-popover-foreground"
              )}
            >
              {text}
            </TooltipContent>
          </TooltipPrimitive.Portal>
        )}
      </Tooltip>
    );
  }
);

TruncatedTitle.displayName = "TruncatedTitle";
