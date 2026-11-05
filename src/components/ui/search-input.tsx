import * as React from "react";
import { Search, X } from "lucide-react";
import { cn } from "@/lib/utils";

export interface SearchInputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "onChange"> {
  value: string;
  onChange?: React.ChangeEventHandler<HTMLInputElement>;
  onValueChange?: (value: string) => void;
  onClear?: () => void;
  containerClassName?: string;
  showClearButton?: boolean;
}

export const SearchInput = React.forwardRef<HTMLInputElement, SearchInputProps>(
  (
    {
      value,
      onChange,
      onValueChange,
      onClear,
      placeholder = "Search…",
      containerClassName,
      className,
      showClearButton = false,
      ...props
    },
    ref
  ) => {
    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      onChange?.(e);
      onValueChange?.(e.target.value);
    };

    const handleClear = () => {
      if (onValueChange) {
        onValueChange("");
      }
      onClear?.();
    };

    return (
      <div
        className={cn(
          "flex-1 min-w-[220px] relative flex items-center bg-white border border-black/[0.08] rounded-[10px] px-3.5 py-2 shadow-sm transition-all focus-within:border-black/20",
          containerClassName
        )}
      >
        <Search className="h-3.5 w-3.5 text-[#8B8B92] shrink-0 mr-2" />
        <input
          ref={ref}
          type="text"
          placeholder={placeholder}
          value={value}
          onChange={handleChange}
          className={cn(
            "w-full bg-transparent border-0 p-0 text-[13px] text-[#17171A] placeholder:text-[#B0B0B6] focus:outline-none font-sans",
            className
          )}
          {...props}
        />
        {showClearButton && value && (
          <button
            type="button"
            onClick={handleClear}
            className="text-[#8B8B92] hover:text-[#17171A] transition-colors p-0.5 rounded-full shrink-0 ml-1.5"
            title="Clear search"
          >
            <X className="h-3 w-3" />
          </button>
        )}
      </div>
    );
  }
);

SearchInput.displayName = "SearchInput";
