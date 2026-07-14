import { forwardRef } from "react";
import { Search, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SECTOR_UI_CFG, STATUS_CFG, type UiStatus, type SectorUiId } from "@/lib/tx-catalog";

export type TxFiltersState = {
  q: string;
  status: UiStatus | "ALL";
  sector: SectorUiId | "ALL";
  dateRange: "ALL" | "7D" | "30D" | "90D";
};

export const EMPTY_FILTERS: TxFiltersState = {
  q: "",
  status: "ALL",
  sector: "ALL",
  dateRange: "ALL",
};

type Props = {
  value: TxFiltersState;
  onChange: (v: TxFiltersState) => void;
};

export const TransactionsFilters = forwardRef<HTMLInputElement, Props>(function TransactionsFilters({ value, onChange }, ref) {
  const active =
    value.q.trim() !== "" ||
    value.status !== "ALL" ||
    value.sector !== "ALL" ||
    value.dateRange !== "ALL";

  return (
    <div className="surface-card p-3 flex flex-col md:flex-row gap-2 md:items-center">
      <div className="relative flex-1 min-w-0">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-yo-txt-3 pointer-events-none" />
        <Input
          ref={ref}
          value={value.q}
          onChange={(e) => onChange({ ...value, q: e.target.value })}
          placeholder="Buscar por ID, contraparte, RFC, monto o nombre de operación… ( / )"
          className="pl-9 h-9 text-sm"
        />
      </div>

      <div className="flex flex-wrap gap-2">
        <Select value={value.status} onValueChange={(v) => onChange({ ...value, status: v as TxFiltersState["status"] })}>
          <SelectTrigger className="h-9 w-[160px] text-sm">
            <SelectValue placeholder="Estado" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">Todos los estados</SelectItem>
            {(Object.keys(STATUS_CFG) as UiStatus[]).map((k) => (
              <SelectItem key={k} value={k}>{STATUS_CFG[k].label}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={value.sector} onValueChange={(v) => onChange({ ...value, sector: v as TxFiltersState["sector"] })}>
          <SelectTrigger className="h-9 w-[170px] text-sm">
            <SelectValue placeholder="Sector" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">Todos los sectores</SelectItem>
            {(Object.keys(SECTOR_UI_CFG) as SectorUiId[]).map((k) => (
              <SelectItem key={k} value={k}>
                {SECTOR_UI_CFG[k].emoji} {SECTOR_UI_CFG[k].label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={value.dateRange} onValueChange={(v) => onChange({ ...value, dateRange: v as TxFiltersState["dateRange"] })}>
          <SelectTrigger className="h-9 w-[140px] text-sm">
            <SelectValue placeholder="Fecha" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">Cualquier fecha</SelectItem>
            <SelectItem value="7D">Últimos 7 días</SelectItem>
            <SelectItem value="30D">Últimos 30 días</SelectItem>
            <SelectItem value="90D">Últimos 90 días</SelectItem>
          </SelectContent>
        </Select>

        {active && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onChange(EMPTY_FILTERS)}
            className="h-9 text-yo-txt-2"
          >
            <X className="h-3.5 w-3.5 mr-1" />
            Limpiar
          </Button>
        )}
      </div>
    </div>
  );
});
