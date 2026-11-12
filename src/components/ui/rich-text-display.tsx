import React, { useState } from "react";
import { cn, isRichHtml, stripHtml, truncateWords } from "@/lib/utils";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";

export interface RichTextDisplayProps {
  content: string | null | undefined;
  className?: string;
  emptyText?: string;
  collapsible?: boolean;
  collapseWords?: number;
  expanded?: boolean;
  onExpandedChange?: (expanded: boolean) => void;
}

export function sanitizeRichHtml(rawHtml: string): string {
  if (!rawHtml) return "";
  return rawHtml
    .replace(/<\s*(script|iframe|object|embed|style|meta|link)[^>]*>[\s\S]*?<\s*\/\s*\1\s*>/gi, "")
    .replace(/<\s*(script|iframe|object|embed|meta|link)[^>]*\/?>/gi, "")
    .replace(/\son[a-z]+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, "")
    .replace(/(href|src)\s*=\s*(?:"\s*javascript:[^"]*"|'\s*javascript:[^']*')/gi, '$1="#"');
}

function renderPlainTextWithLinks(text: string) {
  const urlRegex = /(https?:\/\/[^\s]+)/g;
  const parts = text.split(urlRegex);
  return parts.map((part, i) =>
    urlRegex.test(part) ? (
      <a
        key={i}
        href={part}
        target="_blank"
        rel="noopener noreferrer"
        className="text-primary underline hover:opacity-80 break-all"
      >
        {part}
      </a>
    ) : (
      <span key={i}>{part}</span>
    )
  );
}

export function RichTextDisplay({
  content,
  className,
  emptyText,
  collapsible = false,
  collapseWords = 20,
  expanded: controlledExpanded,
  onExpandedChange,
}: RichTextDisplayProps) {
  const [internalExpanded, setInternalExpanded] = useState(false);
  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null);

  const isExpanded = controlledExpanded !== undefined ? controlledExpanded : internalExpanded;
  const setExpanded = (val: boolean) => {
    if (onExpandedChange) onExpandedChange(val);
    else setInternalExpanded(val);
  };

  if (!content || (!stripHtml(content) && !/<img\b/i.test(content))) {
    if (!emptyText) return null;
    return <span className={cn("text-muted-foreground", className)}>{emptyText}</span>;
  }

  const plainWordsCount = stripHtml(content).split(/\s+/).filter(Boolean).length;
  const hasImages = /<img\b/i.test(content);
  const shouldCanCollapse = collapsible && (plainWordsCount > collapseWords || hasImages);

  if (shouldCanCollapse && !isExpanded) {
    return (
      <div className={cn("text-sm", className)}>
        <p className="inline">{truncateWords(content, collapseWords)}</p>
        {hasImages && (
          <span className="ml-1.5 inline-flex items-center rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
            + media
          </span>
        )}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setExpanded(true);
          }}
          className="ml-2 text-xs font-medium text-foreground underline hover:text-primary"
        >
          Show more
        </button>
      </div>
    );
  }

  const handleContainerClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement;
    if (target.tagName === "IMG") {
      e.stopPropagation();
      const src = (target as HTMLImageElement).src;
      if (src) setLightboxSrc(src);
    } else if (target.tagName === "A") {
      e.stopPropagation();
    }
  };

  return (
    <>
      <div className={cn("rich-text-display", className)} onClick={handleContainerClick}>
        {isRichHtml(content) ? (
          <div
            className={cn(
              "max-w-none break-words leading-relaxed",
              "[&_p]:my-1 [&_p:first-child]:mt-0 [&_p:last-child]:mb-0",
              "[&_h1]:text-base [&_h1]:font-bold [&_h1]:mt-2 [&_h1]:mb-1",
              "[&_h2]:text-sm [&_h2]:font-bold [&_h2]:mt-2 [&_h2]:mb-1",
              "[&_h3]:text-xs [&_h3]:font-bold [&_h3]:uppercase [&_h3]:tracking-wide [&_h3]:mt-1.5 [&_h3]:mb-0.5",
              "[&_ul]:list-disc [&_ul]:pl-5 [&_ul]:my-1.5 [&_ol]:list-decimal [&_ol]:pl-5 [&_ol]:my-1.5",
              "[&_li]:my-0.5",
              "[&_blockquote]:border-l-2 [&_blockquote]:border-[#EB5A1E] [&_blockquote]:pl-3 [&_blockquote]:italic [&_blockquote]:text-muted-foreground [&_blockquote]:my-1.5",
              "[&_code]:bg-muted [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:rounded [&_code]:text-[0.88em] [&_code]:font-mono",
              "[&_pre]:bg-[#17171A] [&_pre]:text-[#F4F4F6] [&_pre]:p-3 [&_pre]:rounded-lg [&_pre]:overflow-x-auto [&_pre]:my-2 [&_pre]:text-xs [&_pre]:font-mono [&_pre_code]:bg-transparent [&_pre_code]:p-0 [&_pre_code]:text-inherit",
              "[&_a]:text-[#EB5A1E] [&_a]:underline hover:[&_a]:opacity-80",
              "[&_hr]:my-2.5 [&_hr]:border-border",
              "[&_img]:max-w-full [&_img]:max-h-72 [&_img]:w-auto [&_img]:h-auto [&_img]:rounded-lg [&_img]:border [&_img]:border-black/10 [&_img]:my-2 [&_img]:cursor-zoom-in [&_img]:object-contain [&_img]:bg-white"
            )}
            dangerouslySetInnerHTML={{ __html: sanitizeRichHtml(content) }}
          />
        ) : (
          <div className="whitespace-pre-wrap break-words">{renderPlainTextWithLinks(content)}</div>
        )}

        {shouldCanCollapse && isExpanded && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setExpanded(false);
            }}
            className="mt-1.5 inline-block text-xs font-medium text-foreground underline hover:text-primary"
          >
            Show less
          </button>
        )}
      </div>

      <Dialog open={!!lightboxSrc} onOpenChange={(open) => !open && setLightboxSrc(null)}>
        <DialogContent className="max-w-4xl p-2 bg-black/95 border-white/10">
          <DialogTitle className="sr-only">Image Preview</DialogTitle>
          {lightboxSrc && (
            <div className="flex items-center justify-center max-h-[85vh] overflow-auto p-2">
              <img
                src={lightboxSrc}
                alt="Attachment preview"
                className="max-w-full max-h-[80vh] object-contain rounded-md"
              />
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

