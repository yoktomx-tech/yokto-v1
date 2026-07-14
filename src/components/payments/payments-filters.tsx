import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export type PaymentsFiltersState = {
  q: string;
  provider: string; // "all" | "stripe" | "spei" | "manual"
  method: string;   // "all" | "card" | "spei" | ...
  range: string;    // "7d" | "30d" | "90d" | "all"
};

type Props = {
  value: PaymentsFiltersState;
  onChange: (v: PaymentsFiltersState) => void;
};

export function PaymentsFilters({ value, onChange }: Props) {
  const set = <K extends keyof PaymentsFiltersState>(k: K, v: PaymentsFiltersState[K]) =>
    onChange({ ...value, [k]: v });

  return (
    <div className="flex flex-col md:flex-row gap-2 md:items-center">
      <div className="relative flex-1 min-w-[220px]">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-yo-t2" />
        <Input
          value={value.q}
          onChange={(e) => set("q", e.target.value)}
          placeholder="Buscar por número, referencia o contraparte…"
          className="pl-9 bg-yo-card border-yo-border"
        />
      </div>

      <Select value={value.provider} onValueChange={(v) => set("provider", v)}>
        <SelectTrigger className="w-full md:w-[160px] bg-yo-card border-yo-border">
          <SelectValue placeholder="Pasarela" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Todas las pasarelas</SelectItem>
          <SelectItem value="stripe">Stripe</SelectItem>
          <SelectItem value="spei">SPEI</SelectItem>
          <SelectItem value="manual">Manual</SelectItem>
        </SelectContent>
      </Select>

      <Select value={value.method} onValueChange={(v) => set("method", v)}>
        <SelectTrigger className="w-full md:w-[160px] bg-yo-card border-yo-border">
          <SelectValue placeholder="Método" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Todos los métodos</SelectItem>
          <SelectItem value="card">Tarjeta</SelectItem>
          <SelectItem value="spei">SPEI</SelectItem>
          <SelectItem value="oxxo">OXXO</SelectItem>
        </SelectContent>
      </Select>

      <Select value={value.range} onValueChange={(v) => set("range", v)}>
        <SelectTrigger className="w-full md:w-[140px] bg-yo-card border-yo-border">
          <SelectValue placeholder="Rango" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="7d">Últimos 7 días</SelectItem>
          <SelectItem value="30d">Últimos 30 días</SelectItem>
          <SelectItem value="90d">Últimos 90 días</SelectItem>
          <SelectItem value="all">Todo</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
}
