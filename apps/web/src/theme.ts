import type { ThemeConfig } from "antd";
import type { OrderStatus } from "@oc/shared";

/** Colors live here once. Tailwind's --color-brand in index.css mirrors colorPrimary. */
export const theme: ThemeConfig = {
  token: {
    colorPrimary: "#0E5E54",
    colorBgLayout: "#EEF2F0",
    borderRadius: 6,
    fontFamily: "'IBM Plex Sans', ui-sans-serif, system-ui, sans-serif",
  },
  components: {
    Layout: { headerBg: "#FFFFFF", headerPadding: "0 24px" },
    Table: { rowHoverBg: "#F5F8F7" },
  },
};

export const statusColor: Record<OrderStatus, string> = {
  pending: "gold",
  paid: "blue",
  shipped: "purple",
  delivered: "green",
  cancelled: "default",
};

export const statusLabel: Record<OrderStatus, string> = {
  pending: "Pending",
  paid: "Paid",
  shipped: "Shipped",
  delivered: "Delivered",
  cancelled: "Cancelled",
};
