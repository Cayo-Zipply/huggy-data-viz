import { forwardRef, useEffect, useState } from "react";
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

function parseValorBR(raw: string): number | null {
  if (!raw) return null;
  const cleaned = raw.replace(/[^\d.,-]/g, "").trim();
  if (!cleaned) return null;

  if (cleaned.includes(",")) {
    const normalized = cleaned.replace(/\./g, "").replace(",", ".");
    const n = parseFloat(normalized);
    return Number.isFinite(n) ? n : null;
  }

  if (cleaned.includes(".")) {
    const parts = cleaned.split(".");
    if (parts.length > 2 || (parts[1] && parts[1].length === 3)) {
      const n = parseFloat(cleaned.replace(/\./g, ""));
      return Number.isFinite(n) ? n : null;
    }
    const n = parseFloat(cleaned);
    return Number.isFinite(n) ? n : null;
  }

  const n = parseFloat(cleaned);
  return Number.isFinite(n) ? n : null;
}

function formatPtBR(valor: number): string {
  return new Intl.NumberFormat("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(valor);
}

export const InputMoedaBRL = forwardRef<HTMLInputElement, InputMoedaBRLProps>(
  function InputMoedaBRL(
    { value, onChange, placeholder = "0,00", disabled, className, id, hasError },
    ref
  ) {
    const [display, setDisplay] = useState("");
    const [focused, setFocused] = useState(false);

    useEffect(() => {
      if (focused) return;
      if (value === null || value === undefined || isNaN(Number(value))) {
        setDisplay("");
      } else if (Number(value) === 0) {
        setDisplay("");
      } else {
        setDisplay(formatPtBR(Number(value)));
      }
    }, [value, focused]);

    function handleFocus(e: React.FocusEvent<HTMLInputElement>) {
      setFocused(true);
      if (value !== null && value !== undefined && Number(value) > 0) {
        const str = String(Number(value)).replace(".", ",");
        setDisplay(str);
        requestAnimationFrame(() => e.target.select());
      } else {
        setDisplay("");
      }
    }

    function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
      const raw = e.target.value.replace(/[^\d.,\s]/g, "");
      setDisplay(raw);
    }

    function handleBlur() {
      setFocused(false);
      const parsed = parseValorBR(display);
      if (parsed === null) {
        onChange(null);
        setDisplay("");
      } else {
        onChange(parsed);
        setDisplay(formatPtBR(parsed));
      }
    }

    function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
      if (e.key === "Enter") {
        (e.target as HTMLInputElement).blur();
      }
    }

    return (
      <div className="relative">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground font-medium select-none pointer-events-none">
          R$
        </span>
        <input
          ref={ref}
          id={id}
          type="text"
          inputMode="decimal"
          autoComplete="off"
          value={display}
          onChange={handleChange}
          onFocus={handleFocus}
          onBlur={handleBlur}
          onKeyDown={handleKeyDown}
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
