import { Tag } from "antd";
import type { OrderStatus } from "@oc/shared";
import { statusColor, statusLabel } from "../theme.ts";

export const StatusTag = ({ status }: { status: OrderStatus }) => (
  <Tag color={statusColor[status]} className="!m-0">
    {statusLabel[status]}
  </Tag>
);
