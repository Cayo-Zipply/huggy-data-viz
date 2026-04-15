import { forwardRef, useMemo } from "react";
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

export const InputMoedaBRL = forwardRef<HTMLInputElement, InputMoedaBRLProps>(
  function InputMoedaBRL({ value, onChange, placeholder = "0,00", disabled, className, id, hasError }, ref) {
    const centavos = useMemo(() => {
      if (value === null || value === undefined || isNaN(Number(value))) return 0;
      return Math.round(Number(value) * 100);
    }, [value]);

    const displayValue = useMemo(() => {
      if (centavos === 0 && (value === null || value === undefined)) return "";
      return new Intl.NumberFormat("pt-BR", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }).format(centavos / 100);
    }, [centavos, value]);

    function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
      const apenasDigitos = e.target.value.replace(/\D/g, "");
      if (!apenasDigitos) {
        onChange(null);
        return;
      }
      const novoCentavos = parseInt(apenasDigitos, 10);
      onChange(novoCentavos / 100);
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
          inputMode="numeric"
          value={displayValue}
          onChange={handleChange}
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
