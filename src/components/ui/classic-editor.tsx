import React, { useRef, useState, useEffect, useCallback } from "react";
import {
  Bold,
  Italic,
  Underline,
  Strikethrough,
  List,
  ListOrdered,
  CheckSquare,
  Quote,
  Code,
  FileCode,
  Link as LinkIcon,
  ImagePlus,
  Undo2,
  Redo2,
  RemoveFormatting,
  Minus,
  Loader2,
  X,
  Check,
} from "lucide-react";
import { cn, isRichHtml } from "@/lib/utils";
import { sanitizeRichHtml } from "@/components/ui/rich-text-display";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface ClassicEditorProps {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  variant?: "full" | "compact";
  rows?: number;
  minHeight?: number | string;
  className?: string;
}

function plainTextToHtml(text: string): string {
  if (!text) return "";
  if (isRichHtml(text)) return sanitizeRichHtml(text);
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\n/g, "<br>");
}

function isEditorHtmlEmpty(html: string): boolean {
  if (!html) return true;
  if (/<img\b/i.test(html)) return false;
  const text = html
    .replace(/<[^>]*>/g, "")
    .replace(/&nbsp;/gi, " ")
    .trim();
  return text.length === 0;
}

async function compressAndResolveImageUrl(file: File): Promise<string> {
  if (!file.type.startsWith("image/")) {
    throw new Error("Please select an image file (PNG, JPG, GIF, WebP)");
  }
  if (file.size > 10 * 1024 * 1024) {
    throw new Error("Image must be smaller than 10MB");
  }

  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const MAX_DIM = 1200;
        let { width, height } = img;
        if (width > MAX_DIM || height > MAX_DIM) {
          if (width >= height) {
            height = Math.round((height * MAX_DIM) / width);
            width = MAX_DIM;
          } else {
            width = Math.round((width * MAX_DIM) / height);
            height = MAX_DIM;
          }
        }
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          resolve(reader.result as string);
          return;
        }
        ctx.drawImage(img, 0, 0, width, height);
        const compressed = canvas.toDataURL("image/webp", 0.82);
        resolve(compressed.startsWith("data:image/webp") ? compressed : canvas.toDataURL("image/jpeg", 0.82));
      };
      img.onerror = () => resolve(reader.result as string);
      img.src = reader.result as string;
    };
    reader.onerror = () => reject(new Error("Failed to read image file"));
    reader.readAsDataURL(file);
  });

  // Attempt upload to Supabase storage if available; fall back to compressed dataUrl
  try {
    const res = await fetch(dataUrl);
    const blob = await res.blob();
    const ext = blob.type === "image/webp" ? "webp" : "jpg";
    const path = `editor-media/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
    const { error: uploadErr } = await supabase.storage
      .from("avatars")
      .upload(path, blob, { contentType: blob.type, upsert: false });
    if (!uploadErr) {
      const { data } = supabase.storage.from("avatars").getPublicUrl(path);
      if (data?.publicUrl) return data.publicUrl;
    }
  } catch {
    // Fallback to inline compressed Data URL seamlessly
  }

  return dataUrl;
}

export const ClassicEditor = React.forwardRef<HTMLDivElement, ClassicEditorProps>(
  (
    {
      id,
      value = "",
      onChange,
      placeholder = "Write something...",
      disabled = false,
      variant = "full",
      rows = 3,
      minHeight,
      className,
    },
    _ref
  ) => {
    const editorRef = useRef<HTMLDivElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const lastEmittedRef = useRef<string>(value || "");
    const savedSelectionRef = useRef<Range | null>(null);

    const [isFocused, setIsFocused] = useState(false);
    const [isDraggingOver, setIsDraggingOver] = useState(false);
    const [uploadingImage, setUploadingImage] = useState(false);
    const [showLinkInput, setShowLinkInput] = useState(false);
    const [linkUrl, setLinkUrl] = useState("");
    const [linkText, setLinkText] = useState("");
    const [blockFormat, setBlockFormat] = useState("p");

    const computedMinHeight =
      minHeight !== undefined
        ? typeof minHeight === "number"
          ? `${minHeight}px`
          : minHeight
        : variant === "compact"
        ? `${Math.max(rows * 26, 68)}px`
        : `${Math.max(rows * 32, 108)}px`;

    // Sync external value changes into contentEditable
    useEffect(() => {
      const el = editorRef.current;
      if (!el) return;
      const incoming = value || "";
      if (incoming !== lastEmittedRef.current) {
        lastEmittedRef.current = incoming;
        el.innerHTML = plainTextToHtml(incoming);
      } else if (incoming === "" && el.innerHTML !== "") {
        el.innerHTML = "";
      }
    }, [value]);

    // Initialize mount content
    useEffect(() => {
      const el = editorRef.current;
      if (!el) return;
      if (value) {
        el.innerHTML = plainTextToHtml(value);
        lastEmittedRef.current = value;
      }
    }, []);

    const emitChange = useCallback(() => {
      const el = editorRef.current;
      if (!el) return;
      const raw = el.innerHTML;
      const normalized = isEditorHtmlEmpty(raw) ? "" : sanitizeRichHtml(raw);
      lastEmittedRef.current = normalized;
      onChange(normalized);
    }, [onChange]);

    const saveSelection = () => {
      const sel = window.getSelection();
      if (sel && sel.rangeCount > 0 && editorRef.current?.contains(sel.anchorNode)) {
        savedSelectionRef.current = sel.getRangeAt(0).cloneRange();
      }
    };

    const restoreSelection = () => {
      const el = editorRef.current;
      if (!el) return;
      el.focus();
      if (savedSelectionRef.current) {
        const sel = window.getSelection();
        if (sel) {
          sel.removeAllRanges();
          sel.addRange(savedSelectionRef.current);
        }
      }
    };

    const exec = (command: string, arg?: string) => {
      if (disabled) return;
      const el = editorRef.current;
      if (!el) return;
      el.focus();
      document.execCommand(command, false, arg);
      emitChange();
    };

    const handleBlockFormatChange = (tag: string) => {
      if (disabled) return;
      setBlockFormat(tag);
      exec("formatBlock", `<${tag}>`);
    };

    const insertHtmlAtCursor = (htmlSnippet: string) => {
      const el = editorRef.current;
      if (!el) return;
      el.focus();
      const sel = window.getSelection();
      if (sel && sel.rangeCount > 0 && el.contains(sel.anchorNode)) {
        document.execCommand("insertHTML", false, htmlSnippet);
      } else {
        el.innerHTML += htmlSnippet;
      }
      emitChange();
    };

    const handleInlineCode = () => {
      if (disabled) return;
      const sel = window.getSelection();
      const selectedText = sel && editorRef.current?.contains(sel.anchorNode) ? sel.toString() : "";
      if (selectedText) {
        insertHtmlAtCursor(`<code>${selectedText.replace(/</g, "&lt;").replace(/>/g, "&gt;")}</code>&nbsp;`);
      } else {
        insertHtmlAtCursor(`<code>code</code>&nbsp;`);
      }
    };

    const handleCodeBlock = () => {
      if (disabled) return;
      const sel = window.getSelection();
      const selectedText = sel && editorRef.current?.contains(sel.anchorNode) ? sel.toString() : "";
      const content = selectedText
        ? selectedText.replace(/</g, "&lt;").replace(/>/g, "&gt;")
        : "// Code snippet";
      insertHtmlAtCursor(`<pre><code>${content}</code></pre><p><br></p>`);
    };

    const handleChecklist = () => {
      if (disabled) return;
      const sel = window.getSelection();
      const selectedText = sel && editorRef.current?.contains(sel.anchorNode) ? sel.toString() : "";
      const label = selectedText
        ? selectedText.replace(/</g, "&lt;").replace(/>/g, "&gt;")
        : "Checklist item";
      insertHtmlAtCursor(
        `<div class="editor-checklist-item" style="display:flex;align-items:center;gap:6px;margin:2px 0;"><input type="checkbox" style="margin:0;cursor:pointer;" /><span>${label}</span></div>`
      );
    };

    const openLinkBar = () => {
      if (disabled) return;
      saveSelection();
      const sel = window.getSelection();
      const selectedText = sel && editorRef.current?.contains(sel.anchorNode) ? sel.toString() : "";
      setLinkText(selectedText);
      setLinkUrl("https://");
      setShowLinkInput((prev) => !prev);
    };

    const applyLink = () => {
      const trimmedUrl = linkUrl.trim();
      if (!trimmedUrl || trimmedUrl === "https://") {
        setShowLinkInput(false);
        return;
      }
      const safeUrl = /^https?:\/\/|^mailto:/i.test(trimmedUrl) ? trimmedUrl : `https://${trimmedUrl}`;
      const display = (linkText.trim() || safeUrl).replace(/</g, "&lt;").replace(/>/g, "&gt;");
      restoreSelection();
      insertHtmlAtCursor(
        `<a href="${safeUrl.replace(/"/g, "&quot;")}" target="_blank" rel="noopener noreferrer">${display}</a>&nbsp;`
      );
      setShowLinkInput(false);
      setLinkUrl("");
      setLinkText("");
    };

    const handleInsertImages = async (files: FileList | File[]) => {
      if (disabled) return;
      const imageFiles = Array.from(files).filter((f) => f.type.startsWith("image/"));
      if (imageFiles.length === 0) return;

      setUploadingImage(true);
      try {
        for (const file of imageFiles) {
          const src = await compressAndResolveImageUrl(file);
          const safeAlt = (file.name || "image").replace(/"/g, "&quot;");
          insertHtmlAtCursor(
            `<p><img src="${src}" alt="${safeAlt}" style="max-width:100%;max-height:320px;border-radius:8px;margin:4px 0;" /></p><p><br></p>`
          );
        }
      } catch (err: any) {
        toast.error(err?.message || "Failed to insert image");
      } finally {
        setUploadingImage(false);
        if (fileInputRef.current) fileInputRef.current.value = "";
      }
    };

    const handlePaste = async (e: React.ClipboardEvent<HTMLDivElement>) => {
      if (disabled) return;
      const items = e.clipboardData?.items;
      if (items) {
        const imageFiles: File[] = [];
        for (let i = 0; i < items.length; i++) {
          const item = items[i];
          if (item.type.startsWith("image/")) {
            const file = item.getAsFile();
            if (file) imageFiles.push(file);
          }
        }
        if (imageFiles.length > 0) {
          e.preventDefault();
          await handleInsertImages(imageFiles);
          return;
        }
      }

      // Clean HTML paste or plain text paste
      e.preventDefault();
      const htmlData = e.clipboardData?.getData("text/html");
      const textData = e.clipboardData?.getData("text/plain") || "";
      if (htmlData) {
        const cleaned = sanitizeRichHtml(htmlData);
        document.execCommand("insertHTML", false, cleaned);
      } else {
        document.execCommand("insertText", false, textData);
      }
      emitChange();
    };

    const handleDrop = async (e: React.DragEvent<HTMLDivElement>) => {
      if (disabled) return;
      setIsDraggingOver(false);
      const files = e.dataTransfer?.files;
      if (files && files.length > 0) {
        const hasImg = Array.from(files).some((f) => f.type.startsWith("image/"));
        if (hasImg) {
          e.preventDefault();
          e.stopPropagation();
          await handleInsertImages(files);
        }
      }
    };

    const handleEditorClick = (e: React.MouseEvent<HTMLDivElement>) => {
      const target = e.target as HTMLElement;
      if (target.tagName === "INPUT" && (target as HTMLInputElement).type === "checkbox") {
        const input = target as HTMLInputElement;
        if (input.checked) {
          input.setAttribute("checked", "checked");
        } else {
          input.removeAttribute("checked");
        }
        emitChange();
      }
    };

    const isEmpty = isEditorHtmlEmpty(value);

    const ToolbarBtn = ({
      onClick,
      title,
      children,
      active = false,
    }: {
      onClick: () => void;
      title: string;
      children: React.ReactNode;
      active?: boolean;
    }) => (
      <button
        type="button"
        disabled={disabled}
        onMouseDown={(e) => {
          e.preventDefault();
          onClick();
        }}
        title={title}
        className={cn(
          "h-7 w-7 inline-flex items-center justify-center rounded-md text-[#4B4B52] hover:bg-black/[0.06] hover:text-[#17171A] transition-colors disabled:opacity-40 disabled:pointer-events-none shrink-0",
          active && "bg-[#FFF1EA] text-[#EB5A1E]"
        )}
      >
        {children}
      </button>
    );

    return (
      <div
        id={id}
        className={cn(
          "rounded-[10px] border bg-background overflow-hidden transition-colors",
          isFocused ? "border-[#EB5A1E]/60 ring-2 ring-[#EB5A1E]/15" : "border-input",
          disabled && "opacity-60 cursor-not-allowed bg-muted/30",
          className
        )}
      >
        {/* Classic Editor Toolbar */}
        <div className="flex flex-wrap items-center gap-0.5 px-2 py-1.5 bg-[#FAFAFB] border-b border-border/80 select-none">
          {variant === "full" && (
            <>
              <select
                disabled={disabled}
                value={blockFormat}
                onChange={(e) => handleBlockFormatChange(e.target.value)}
                className="h-7 px-2 mr-1 rounded-md border border-black/10 bg-white text-[11.5px] font-medium text-[#333338] focus:outline-none cursor-pointer"
                title="Text style"
              >
                <option value="p">Normal</option>
                <option value="h1">Heading 1</option>
                <option value="h2">Heading 2</option>
                <option value="h3">Heading 3</option>
              </select>
              <span className="h-4 w-px bg-border mx-0.5" />
            </>
          )}

          <ToolbarBtn onClick={() => exec("bold")} title="Bold (Ctrl+B)">
            <Bold className="h-3.5 w-3.5" />
          </ToolbarBtn>
          <ToolbarBtn onClick={() => exec("italic")} title="Italic (Ctrl+I)">
            <Italic className="h-3.5 w-3.5" />
          </ToolbarBtn>
          <ToolbarBtn onClick={() => exec("underline")} title="Underline (Ctrl+U)">
            <Underline className="h-3.5 w-3.5" />
          </ToolbarBtn>
          {variant === "full" && (
            <ToolbarBtn onClick={() => exec("strikeThrough")} title="Strikethrough">
              <Strikethrough className="h-3.5 w-3.5" />
            </ToolbarBtn>
          )}

          <span className="h-4 w-px bg-border mx-0.5" />

          <ToolbarBtn onClick={() => exec("insertUnorderedList")} title="Bullet List">
            <List className="h-3.5 w-3.5" />
          </ToolbarBtn>
          <ToolbarBtn onClick={() => exec("insertOrderedList")} title="Numbered List">
            <ListOrdered className="h-3.5 w-3.5" />
          </ToolbarBtn>
          <ToolbarBtn onClick={handleChecklist} title="Insert Checklist">
            <CheckSquare className="h-3.5 w-3.5" />
          </ToolbarBtn>

          <span className="h-4 w-px bg-border mx-0.5" />

          <ToolbarBtn onClick={() => exec("formatBlock", "<blockquote>")} title="Quote">
            <Quote className="h-3.5 w-3.5" />
          </ToolbarBtn>
          <ToolbarBtn onClick={handleInlineCode} title="Inline Code">
            <Code className="h-3.5 w-3.5" />
          </ToolbarBtn>
          {variant === "full" && (
            <ToolbarBtn onClick={handleCodeBlock} title="Code Block">
              <FileCode className="h-3.5 w-3.5" />
            </ToolbarBtn>
          )}
          <ToolbarBtn onClick={openLinkBar} title="Insert Link" active={showLinkInput}>
            <LinkIcon className="h-3.5 w-3.5" />
          </ToolbarBtn>

          {/* Media / Image Upload Button */}
          <ToolbarBtn
            onClick={() => fileInputRef.current?.click()}
            title="Insert Image / Media (or paste / drag & drop)"
          >
            {uploadingImage ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin text-[#EB5A1E]" />
            ) : (
              <ImagePlus className="h-3.5 w-3.5" />
            )}
          </ToolbarBtn>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={(e) => e.target.files && handleInsertImages(e.target.files)}
          />

          {variant === "full" && (
            <>
              <ToolbarBtn onClick={() => exec("insertHorizontalRule")} title="Horizontal Divider">
                <Minus className="h-3.5 w-3.5" />
              </ToolbarBtn>
              <span className="h-4 w-px bg-border mx-0.5" />
              <ToolbarBtn onClick={() => exec("undo")} title="Undo (Ctrl+Z)">
                <Undo2 className="h-3.5 w-3.5" />
              </ToolbarBtn>
              <ToolbarBtn onClick={() => exec("redo")} title="Redo (Ctrl+Y)">
                <Redo2 className="h-3.5 w-3.5" />
              </ToolbarBtn>
              <ToolbarBtn onClick={() => exec("removeFormat")} title="Clear Formatting">
                <RemoveFormatting className="h-3.5 w-3.5" />
              </ToolbarBtn>
            </>
          )}
        </div>

        {/* Inline Link Insertion Bar */}
        {showLinkInput && (
          <div className="flex flex-wrap items-center gap-1.5 px-2.5 py-1.5 bg-[#FFF9F6] border-b border-[#F5D5C4] text-xs">
            <input
              type="text"
              value={linkText}
              onChange={(e) => setLinkText(e.target.value)}
              placeholder="Label (optional)"
              className="h-7 px-2 rounded border border-black/15 bg-white text-xs w-32 focus:outline-none"
            />
            <input
              type="url"
              value={linkUrl}
              onChange={(e) => setLinkUrl(e.target.value)}
              placeholder="https://example.com"
              className="h-7 px-2 rounded border border-black/15 bg-white text-xs flex-1 min-w-[140px] focus:outline-none"
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  applyLink();
                } else if (e.key === "Escape") {
                  setShowLinkInput(false);
                }
              }}
              autoFocus
            />
            <button
              type="button"
              onClick={applyLink}
              className="h-7 px-2.5 rounded bg-[#EB5A1E] text-white font-semibold inline-flex items-center gap-1 hover:bg-[#d64f18]"
            >
              <Check className="h-3 w-3" /> Insert
            </button>
            <button
              type="button"
              onClick={() => setShowLinkInput(false)}
              className="h-7 w-7 rounded hover:bg-black/5 inline-flex items-center justify-center text-muted-foreground"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        )}

        {/* Editable Content Area */}
        <div
          className="relative"
          onDragOver={(e) => {
            if (disabled) return;
            if (e.dataTransfer?.types?.includes("Files")) {
              e.preventDefault();
              setIsDraggingOver(true);
            }
          }}
          onDragLeave={() => setIsDraggingOver(false)}
          onDrop={handleDrop}
        >
          {isEmpty && !isFocused && (
            <div className="pointer-events-none absolute inset-x-3 top-2.5 text-sm text-muted-foreground select-none truncate">
              {placeholder}
            </div>
          )}

          {isDraggingOver && (
            <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center bg-[#FFF1EA]/90 border-2 border-dashed border-[#EB5A1E] rounded-b-[10px] text-xs font-semibold text-[#EB5A1E]">
              Drop image here to insert
            </div>
          )}

          <div
            ref={editorRef}
            contentEditable={!disabled}
            suppressContentEditableWarning
            onFocus={() => setIsFocused(true)}
            onBlur={() => {
              setIsFocused(false);
              saveSelection();
              emitChange();
            }}
            onInput={emitChange}
            onPaste={handlePaste}
            onClick={handleEditorClick}
            onKeyDown={(e) => {
              if (e.key === "Tab") {
                e.preventDefault();
                exec(e.shiftKey ? "outdent" : "indent");
              }
            }}
            style={{ minHeight: computedMinHeight }}
            className={cn(
              "w-full px-3 py-2.5 text-sm outline-none overflow-y-auto max-h-[340px] break-words leading-relaxed",
              "[&_p]:my-1 [&_p:first-child]:mt-0 [&_p:last-child]:mb-0",
              "[&_h1]:text-base [&_h1]:font-bold [&_h1]:mt-2 [&_h1]:mb-1",
              "[&_h2]:text-sm [&_h2]:font-bold [&_h2]:mt-2 [&_h2]:mb-1",
              "[&_h3]:text-xs [&_h3]:font-bold [&_h3]:uppercase [&_h3]:tracking-wide [&_h3]:mt-1.5 [&_h3]:mb-0.5",
              "[&_ul]:list-disc [&_ul]:pl-5 [&_ul]:my-1 [&_ol]:list-decimal [&_ol]:pl-5 [&_ol]:my-1",
              "[&_blockquote]:border-l-2 [&_blockquote]:border-[#EB5A1E] [&_blockquote]:pl-3 [&_blockquote]:italic [&_blockquote]:text-muted-foreground [&_blockquote]:my-1.5",
              "[&_code]:bg-muted [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:rounded [&_code]:text-[0.88em] [&_code]:font-mono",
              "[&_pre]:bg-[#17171A] [&_pre]:text-[#F4F4F6] [&_pre]:p-2.5 [&_pre]:rounded-lg [&_pre]:overflow-x-auto [&_pre]:my-1.5 [&_pre]:text-xs [&_pre]:font-mono [&_pre_code]:bg-transparent [&_pre_code]:p-0 [&_pre_code]:text-inherit",
              "[&_a]:text-[#EB5A1E] [&_a]:underline",
              "[&_hr]:my-2 [&_hr]:border-border",
              "[&_img]:max-w-full [&_img]:max-h-60 [&_img]:w-auto [&_img]:h-auto [&_img]:rounded-lg [&_img]:border [&_img]:border-black/10 [&_img]:my-1.5 [&_img]:object-contain"
            )}
          />
        </div>
      </div>
    );
  }
);

ClassicEditor.displayName = "ClassicEditor";

