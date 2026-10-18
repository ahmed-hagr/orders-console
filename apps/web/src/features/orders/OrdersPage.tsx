import { useMemo, useState } from "react";
import { App, Button, Card, Switch, Tag, Typography } from "antd";
import { PlusOutlined } from "@ant-design/icons";
import { StatsBar } from "../stats/StatsBar.tsx";
import { CreateOrderDrawer } from "./CreateOrderDrawer.tsx";
import { OrderFilters } from "./OrderFilters.tsx";
import { OrdersTable } from "./OrdersTable.tsx";
import { useCreateOrder, useDeleteOrder } from "./useOrderMutations.ts";
import { useOrderFilters } from "./useOrderFilters.ts";
import { useOrdersQuery } from "./useOrdersQuery.ts";

export function OrdersPage() {
  const { message } = App.useApp();
  const { filters, setFilters } = useOrderFilters();
  const [slowNetwork, setSlowNetwork] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const query = useOrdersQuery(filters, slowNetwork);
  const create = useCreateOrder();
  const remove = useDeleteOrder();

  const rows = useMemo(() => query.data?.pages.flatMap((p) => p.items) ?? [], [query.data]);
  const switchingFilters = query.isPlaceholderData;

  return (
    <div className="flex flex-col gap-5">
      <StatsBar />

      <Card styles={{ body: { padding: 0 } }}>
        <div className="flex flex-wrap items-end gap-3 border-b border-slate-100 px-4 py-4">
          <div className="flex min-w-0 flex-col">
            <Typography.Title level={3} className="!mb-0">
              Orders
            </Typography.Title>
            <div className="flex items-center gap-2 text-sm text-slate-500">
              <span>Newest data from the server, 50 rows per page</span>
              {(switchingFilters || (query.isFetching && !query.isFetchingNextPage)) && <Tag color="processing">Updating…</Tag>}
            </div>
          </div>
          <div className="flex-1" />
          {import.meta.env.DEV && (
            <label className="flex items-center gap-2 text-sm text-slate-600">
              <Switch size="small" checked={slowNetwork} onChange={setSlowNetwork} />
              Simulate slow network
            </label>
          )}
          <Button type="primary" icon={<PlusOutlined />} onClick={() => setDrawerOpen(true)}>
            New phone order
          </Button>
        </div>

        <div className="border-b border-slate-100 px-4 py-3">
          <OrderFilters filters={filters} onChange={setFilters} />
        </div>

        {query.isError && !query.data ? (
          <div className="p-8 text-center">
            <Typography.Paragraph type="danger">{query.error.message}</Typography.Paragraph>
            <Button onClick={() => void query.refetch()}>Try again</Button>
          </div>
        ) : (
          <div className={switchingFilters ? "opacity-60 transition-opacity" : "transition-opacity"}>
            <OrdersTable
              rows={rows}
              sort={filters.sort}
              onSortChange={(sort) => setFilters({ sort })}
              loading={query.isPending}
              hasNextPage={query.hasNextPage}
              isFetchingNextPage={query.isFetchingNextPage}
              onLoadMore={() => void query.fetchNextPage()}
              onDelete={(o) =>
                remove.mutateAsync(o.id).then(
                  () => message.success(`Order #${o.orderNumber} deleted`),
                  (err: Error) => message.error(err.message),
                )
              }
            />
          </div>
        )}
      </Card>

      <CreateOrderDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)} create={create} />
    </div>
  );
}
