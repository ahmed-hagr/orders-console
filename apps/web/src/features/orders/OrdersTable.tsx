import { Button, Popconfirm, Table, Typography, type TableProps } from "antd";
import { DeleteOutlined } from "@ant-design/icons";
import type { OrderDTO, OrderSort } from "@oc/shared";
import { StatusTag } from "../../components/StatusTag.tsx";
import { formatDate, formatSar } from "../../lib/format.ts";
import { AdminOnly } from "../auth/AdminOnly.tsx";

interface Props {
  rows: OrderDTO[];
  sort: OrderSort;
  onSortChange: (sort: OrderSort) => void;
  loading: boolean;
  hasNextPage: boolean;
  isFetchingNextPage: boolean;
  onLoadMore: () => void;
  onDelete: (order: OrderDTO) => Promise<unknown>;
}

const SCROLL_Y = 560;
const LOAD_MORE_THRESHOLD_PX = 300;

type SortField = "date" | "amount";
const orderFor = (sort: OrderSort, field: SortField) =>
  sort.startsWith(field) ? (sort.endsWith("asc") ? "ascend" : "descend") : null;

export function OrdersTable({
  rows,
  sort,
  onSortChange,
  loading,
  hasNextPage,
  isFetchingNextPage,
  onLoadMore,
  onDelete,
}: Props) {
  const columns: TableProps<OrderDTO>["columns"] = [
    {
      title: "Order",
      dataIndex: "orderNumber",
      width: 110,
      render: (n: number) => <span className="font-mono text-[13px]">#{n}</span>,
    },
    {
      title: "Customer",
      key: "customer",
      width: 280,
      render: (_, o) => (
        <div className="min-w-0">
          <div className="truncate font-medium">{o.customerName}</div>
          <div className="truncate text-xs text-slate-500">{o.email}</div>
        </div>
      ),
    },
    { title: "Items", key: "items", width: 70, align: "right", render: (_, o) => o.items.length },
    { title: "Status", dataIndex: "status", width: 120, render: (s: OrderDTO["status"]) => <StatusTag status={s} /> },
    {
      title: "Total",
      key: "amount",
      dataIndex: "totalMinor",
      width: 140,
      align: "right",
      sorter: true,
      sortOrder: orderFor(sort, "amount"),
      sortDirections: ["descend", "ascend", "descend"],
      render: (m: number) => <span className="font-medium tabular-nums">{formatSar(m)}</span>,
    },
    {
      title: "Created (AST)",
      key: "date",
      dataIndex: "createdAt",
      width: 180,
      sorter: true,
      sortOrder: orderFor(sort, "date"),
      sortDirections: ["descend", "ascend", "descend"],
      render: (iso: string) => <span className="tabular-nums text-slate-600">{formatDate(iso)}</span>,
    },
    {
      title: <span className="sr-only">Actions</span>,
      key: "actions",
      width: 70,
      align: "right",
      render: (_, o) => (
        <AdminOnly>
          <Popconfirm
            title={`Delete order #${o.orderNumber}?`}
            description="It is soft-deleted and logged with your user."
            okText="Delete order"
            cancelText="Keep it"
            okButtonProps={{ danger: true }}
            onConfirm={() => onDelete(o)}
          >
            <Button
              size="small"
              danger
              type="text"
              icon={<DeleteOutlined />}
              aria-label={`Delete order #${o.orderNumber}`}
            />
          </Popconfirm>
        </AdminOnly>
      ),
    },
  ];

  return (
    <div className="flex flex-col">
      <Table<OrderDTO>
        virtual
        rowKey="id"
        size="middle"
        columns={columns}
        dataSource={rows}
        pagination={false}
        loading={loading}
        scroll={{ x: 980, y: SCROLL_Y }}
        showSorterTooltip={false}
        locale={{ emptyText: "No orders match these filters. Clear the search or pick another status." }}
        onChange={(_p, _f, sorter) => {
          const s = Array.isArray(sorter) ? sorter[0] : sorter;
          const field: SortField = s?.columnKey === "amount" ? "amount" : "date";
          onSortChange(`${field}_${s?.order === "ascend" ? "asc" : "desc"}`);
        }}
        onScroll={(e) => {
          const el = e.currentTarget;
          if (
            hasNextPage &&
            !isFetchingNextPage &&
            el.scrollHeight - el.scrollTop - el.clientHeight < LOAD_MORE_THRESHOLD_PX
          ) {
            onLoadMore();
          }
        }}
      />
      <div className="flex flex-wrap items-center gap-3 border-t border-slate-100 px-4 py-3 text-sm text-slate-500">
        <span className="tabular-nums">
          {rows.length.toLocaleString("en-US")} loaded{hasNextPage ? ", scroll for more" : ", end of results"}
        </span>
        <div className="flex-1" />
        {hasNextPage && (
          <Button onClick={onLoadMore} loading={isFetchingNextPage}>
            Load next 50
          </Button>
        )}
        {!hasNextPage && rows.length > 0 && <Typography.Text type="secondary">That's everything.</Typography.Text>}
      </div>
    </div>
  );
}
