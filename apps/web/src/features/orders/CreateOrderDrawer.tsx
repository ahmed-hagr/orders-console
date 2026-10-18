import { useRef } from "react";
import { Alert, App, Button, Drawer, Form, Input, InputNumber, Typography } from "antd";
import { MinusCircleOutlined, PlusOutlined } from "@ant-design/icons";
import { CreateOrderInput, CustomerName, Email, LineItemInput, MAX_ITEMS, Phone, toMinor } from "@oc/shared";
import { ApiError } from "../../api/client.ts";
import { formatSar } from "../../lib/format.ts";
import { zodRule } from "../../lib/zodRule.ts";
import type { useCreateOrder } from "./useOrderMutations.ts";

interface FormValues {
  customerName: string;
  email: string;
  phone?: string;
  items: { name?: string; quantity?: number; unitPrice?: number }[];
}

interface Props {
  open: boolean;
  onClose: () => void;
  create: ReturnType<typeof useCreateOrder>;
}

type FieldName = Parameters<ReturnType<typeof Form.useForm<FormValues>>[0]["setFields"]>[0][number]["name"];
// "items.0.name" from the API -> ["items", 0, "name"] for antd
const fieldPath = (key: string) => key.split(".").map((p) => (/^\d+$/.test(p) ? Number(p) : p)) as FieldName;

export function CreateOrderDrawer({ open, onClose, create }: Props) {
  const [form] = Form.useForm<FormValues>();
  const { message } = App.useApp();
  const items = Form.useWatch("items", form) ?? [];
  const totalMinor = items.reduce((sum, i) => sum + (i?.quantity ?? 0) * toMinor(i?.unitPrice ?? 0), 0);

  // isPending only flips after a re-render, so a fast double-click would get two submits through.
  // This ref closes that gap. It is a usability guard only: the server's idempotency check is the real one.
  const submitting = useRef(false);

  const submit = (values: FormValues) => {
    const parsed = CreateOrderInput.safeParse(values);
    if (!parsed.success || submitting.current) return; // field rules already show the messages
    submitting.current = true;
    create.mutate(parsed.data, {
      onSettled: () => {
        submitting.current = false;
      },
      onSuccess: ({ order, replayed }) => {
        void message.success(replayed ? `Order #${order.orderNumber} was already created. No duplicate made.` : `Order #${order.orderNumber} created`);
        form.resetFields();
        onClose();
      },
      onError: (err) => {
        if (err instanceof ApiError && err.fields) {
          form.setFields(Object.entries(err.fields).map(([k, msg]) => ({ name: fieldPath(k), errors: [msg] })));
        }
      },
    });
  };

  const error = create.error;
  const keyReused = error instanceof ApiError && error.code === "idempotency_key_reused";

  return (
    <Drawer
      title="New phone order"
      open={open}
      onClose={onClose}
      size={520}
      footer={
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-3">
            <div className="flex-1">
              <div className="text-lg font-semibold tabular-nums">{formatSar(totalMinor)}</div>
              <div className="text-xs text-slate-500">The server recalculates this from the items.</div>
            </div>
            <Button onClick={onClose}>Cancel</Button>
            <Button type="primary" loading={create.isPending} onClick={() => form.submit()}>
              Create order
            </Button>
          </div>
          <Typography.Text type="secondary" className="!font-mono !text-[11px]">
            Idempotency-Key {create.idempotencyKey}
          </Typography.Text>
        </div>
      }
    >
      {error && (
        <Alert
          className="!mb-4"
          type="error"
          showIcon
          message={keyReused ? "This order was already submitted with different details" : error.message}
          description={
            keyReused
              ? "An earlier attempt reached the server. Check the list before creating it again."
              : undefined
          }
          action={
            keyReused ? (
              <Button size="small" onClick={create.startOver}>
                Start a new order
              </Button>
            ) : undefined
          }
        />
      )}
      <Form<FormValues>
        form={form}
        layout="vertical"
        requiredMark={false}
        initialValues={{ items: [{ quantity: 1 }] }}
        onFinish={submit}
        disabled={create.isPending}
      >
        <Form.Item label="Customer name" name="customerName" rules={[zodRule(CustomerName)]}>
          <Input autoFocus />
        </Form.Item>
        <div className="grid grid-cols-1 gap-x-3 sm:grid-cols-2">
          <Form.Item label="Email" name="email" rules={[zodRule(Email)]}>
            <Input type="email" />
          </Form.Item>
          <Form.Item label="Phone (optional)" name="phone" rules={[zodRule(Phone)]}>
            <Input type="tel" placeholder="+966 5x xxx xxxx" />
          </Form.Item>
        </div>

        <Typography.Text strong>Items</Typography.Text>
        <Form.List
          name="items"
          rules={[
            {
              validator: async (_r, v: unknown[]) => {
                if (!v || v.length < 1) throw new Error("Add at least one item");
              },
            },
          ]}
        >
          {(fields, { add, remove }, { errors }) => (
            <div className="mt-2 flex flex-col">
              {fields.map(({ key, name }) => (
                <div key={key} className="grid grid-cols-[minmax(0,1fr)_80px_112px_32px] items-start gap-2">
                  <Form.Item name={[name, "name"]} rules={[zodRule(LineItemInput.shape.name)]}>
                    <Input placeholder="Item name" aria-label={`Item ${name + 1} name`} />
                  </Form.Item>
                  <Form.Item name={[name, "quantity"]} rules={[zodRule(LineItemInput.shape.quantity)]}>
                    <InputNumber min={1} max={99} precision={0} placeholder="Qty" className="!w-full" aria-label={`Item ${name + 1} quantity`} />
                  </Form.Item>
                  <Form.Item name={[name, "unitPrice"]} rules={[zodRule(LineItemInput.shape.unitPrice)]}>
                    <InputNumber min={0.01} precision={2} placeholder="Unit SAR" className="!w-full" aria-label={`Item ${name + 1} unit price`} />
                  </Form.Item>
                  <Button
                    type="text"
                    icon={<MinusCircleOutlined />}
                    disabled={fields.length <= 1}
                    onClick={() => remove(name)}
                    aria-label={`Remove item ${name + 1}`}
                  />
                </div>
              ))}
              <Form.ErrorList errors={errors} />
              <Button type="dashed" icon={<PlusOutlined />} disabled={fields.length >= MAX_ITEMS} onClick={() => add({ quantity: 1 })}>
                Add item ({fields.length} of {MAX_ITEMS})
              </Button>
            </div>
          )}
        </Form.List>
      </Form>
    </Drawer>
  );
}
