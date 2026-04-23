import * as React from "react";

type SelectContextType = { value?: string; onChange?: (v: string) => void };
const SelectContext = React.createContext<SelectContextType>({});

export function Select({
  value,
  onValueChange,
  children,
}: {
  value?: string;
  onValueChange?: (v: string) => void;
  children: React.ReactNode;
}) {
  return <SelectContext.Provider value={{ value, onChange: onValueChange }}>{children}</SelectContext.Provider>;
}

export function SelectTrigger({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={className}>{children}</div>;
}

export function SelectValue({ placeholder }: { placeholder?: string }) {
  const { value } = React.useContext(SelectContext);
  return <span>{value ?? placeholder}</span>;
}

export function SelectContent({ children }: { children: React.ReactNode }) {
  return <select className="hidden">{children}</select>;
}

export function SelectItem({ value, children }: { value: string; children: React.ReactNode }) {
  const { onChange } = React.useContext(SelectContext);
  return (
    <button
      type="button"
      className="block w-full rounded-sm px-2 py-1 text-left text-sm hover:bg-accent"
      onClick={() => onChange?.(value)}
    >
      {children}
    </button>
  );
}
