import type { ReactNode } from "react";
import { Button, Layout, Space, Tag, Typography } from "antd";
import { LogoutOutlined } from "@ant-design/icons";
import { useLogout, useMe } from "../features/auth/useAuth.ts";

export function AppLayout({ children }: { children: ReactNode }) {
  const { data: user } = useMe();
  const logout = useLogout();

  return (
    <Layout className="min-h-screen">
      <Layout.Header className="flex items-center gap-4 border-b border-slate-200">
        <div className="flex size-8 items-center justify-center rounded-md bg-brand font-mono text-sm text-white">
          OC
        </div>
        <Typography.Text strong className="!text-base">
          Orders Console
        </Typography.Text>
        <div className="flex-1" />
        {user && (
          <Space size="middle" wrap>
            <span className="hidden font-mono text-sm text-slate-600 sm:inline">{user.email}</span>
            <Tag color={user.role === "admin" ? "geekblue" : "default"}>{user.role}</Tag>
            <Button icon={<LogoutOutlined />} onClick={() => logout.mutate()} loading={logout.isPending}>
              Sign out
            </Button>
          </Space>
        )}
      </Layout.Header>
      <Layout.Content className="mx-auto w-full max-w-[1440px] px-4 py-6 sm:px-6">{children}</Layout.Content>
    </Layout>
  );
}
