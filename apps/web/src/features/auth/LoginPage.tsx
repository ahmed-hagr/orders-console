import { Navigate, useNavigate } from "react-router";
import { Alert, Button, Card, Form, Input, Typography } from "antd";
import { LoginInput } from "@oc/shared";
import { ApiError } from "../../api/client.ts";
import { zodRule } from "../../lib/zodRule.ts";
import { useLogin, useMe } from "./useAuth.ts";

export function LoginPage() {
  const { data: user } = useMe();
  const loginMutation = useLogin();
  const navigate = useNavigate();

  if (user) return <Navigate to="/orders" replace />;

  const error = loginMutation.error;
  const errorText =
    error instanceof ApiError && error.status === 429 ? error.message : error ? "Wrong email or password." : null;

  return (
    <div className="flex min-h-screen items-start justify-center px-4 pt-28">
      <Card className="w-full max-w-sm">
        <Typography.Title level={4} className="!mb-6">
          Sign in to Orders Console
        </Typography.Title>
        <Form<LoginInput>
          layout="vertical"
          requiredMark={false}
          onFinish={(values) =>
            loginMutation.mutate(LoginInput.parse(values), { onSuccess: () => navigate("/orders", { replace: true }) })
          }
        >
          <Form.Item label="Email" name="email" rules={[zodRule(LoginInput.shape.email)]}>
            <Input autoComplete="username" autoFocus />
          </Form.Item>
          <Form.Item label="Password" name="password" rules={[zodRule(LoginInput.shape.password)]}>
            <Input.Password autoComplete="current-password" />
          </Form.Item>
          {errorText && <Alert className="!mb-4" type="error" showIcon message={errorText} />}
          <Button type="primary" htmlType="submit" block size="large" loading={loginMutation.isPending}>
            Sign in
          </Button>
        </Form>
        <div className="mt-6 rounded-md bg-slate-50 p-3 text-xs text-slate-600">
          <div className="mb-1 font-medium text-slate-800">Seeded accounts</div>
          <div className="font-mono">admin@sarh.test · Admin#2026</div>
          <div className="font-mono">agent@sarh.test · Agent#2026</div>
        </div>
      </Card>
    </div>
  );
}
