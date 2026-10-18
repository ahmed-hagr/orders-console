import { useEffect, useState } from "react";
import { Input, Segmented } from "antd";
import { ORDER_STATUSES, type OrderStatus } from "@oc/shared";
import { useDebouncedValue } from "../../hooks/useDebouncedValue.ts";
import { statusLabel } from "../../theme.ts";
import type { OrderFilters as Filters } from "./useOrderFilters.ts";

const ALL = "all";
const statusOptions = [
  { label: "All", value: ALL },
  ...ORDER_STATUSES.map((s) => ({ label: statusLabel[s], value: s })),
];

interface Props {
  filters: Filters;
  onChange: (patch: Partial<Filters>) => void;
}

export function OrderFilters({ filters, onChange }: Props) {
  const [search, setSearch] = useState(filters.q);
  const debounced = useDebouncedValue(search.trim(), 250);

  useEffect(() => {
    if (debounced !== filters.q) onChange({ q: debounced });
  }, [debounced, filters.q, onChange]);

  return (
    <div className="flex flex-wrap items-center gap-3">
      <Input.Search
        aria-label="Search by customer name or email"
        placeholder="Name or email, starts with…"
        allowClear
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        onSearch={(v) => onChange({ q: v.trim() })}
        className="min-w-0 flex-[1_1_260px]"
      />
      <div className="max-w-full overflow-x-auto">
        <Segmented
          aria-label="Status filter"
          options={statusOptions}
          value={filters.status ?? ALL}
          onChange={(v) => onChange({ status: v === ALL ? undefined : (v as OrderStatus) })}
        />
      </div>
    </div>
  );
}
