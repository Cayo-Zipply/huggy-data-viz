import { forwardRef, useState, useEffect } from "react";
import { cn } from "@/lib/utils";

type InputMoedaBRLProps = {
  value: number | null | undefined;
  onChange: (valor: number | null) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  id?: string;
  hasError?: boolean;
};

function formatBRL(v: number): string {
  return new Intl.NumberFormat("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(v);
}

function parseBRL(raw: string): number | null {
  const cleaned = raw.trim();
  if (!cleaned) return null;
  // Remove dots (thousands sep), replace comma with dot (decimal sep)
  const normalized = cleaned.replace(/\./g, "").replace(",", ".");
  const num = parseFloat(normalized);
  if (isNaN(num)) return null;
  return num;
}

export const InputMoedaBRL = forwardRef<HTMLInputElement, InputMoedaBRLProps>(
  function InputMoedaBRL({ value, onChange, placeholder = "0,00", disabled, className, id, hasError }, ref) {
    const [display, setDisplay] = useState(() =>
      value != null && !isNaN(Number(value)) ? formatBRL(Number(value)) : ""
    );
    const [focused, setFocused] = useState(false);

    // Sync display when value changes externally (and not focused)
    useEffect(() => {
      if (focused) return;
      if (value != null && !isNaN(Number(value))) {
        setDisplay(formatBRL(Number(value)));
      } else {
        setDisplay("");
      }
    }, [value, focused]);

    function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
      // Allow free typing — only digits, dots, commas
      setDisplay(e.target.value);
    }

    function handleBlur() {
      setFocused(false);
      const parsed = parseBRL(display);
      onChange(parsed);
      if (parsed != null) {
        setDisplay(formatBRL(parsed));
      }
    }

    function handleFocus() {
      setFocused(true);
    }

    return (
      <div className="relative">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground font-medium select-none">
          R$
        </span>
        <input
          ref={ref}
          id={id}
          type="text"
          inputMode="decimal"
          value={display}
          onChange={handleChange}
          onBlur={handleBlur}
          onFocus={handleFocus}
          placeholder={placeholder}
          disabled={disabled}
          className={cn(
            "w-full text-sm bg-muted/50 border rounded-md pl-9 pr-3 py-2 text-foreground focus:outline-none focus:ring-1 focus:ring-primary",
            hasError ? "border-red-500" : "border-border",
            className
          )}
        />
      </div>
    );
  }
);
