import { useState } from "react";
import { Alert, Button, Card, Skeleton, Statistic } from "antd";
import { ORDER_STATUSES } from "@oc/shared";
import { formatSar } from "../../lib/format.ts";
import { statusLabel } from "../../theme.ts";
import { useStats } from "./useStats.ts";

const GRID = "grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-7";

export function StatsBar() {
  const stats = useStats();
  const [retried, setRetried] = useState(false);

  if (stats.isPending) {
    return (
      <section aria-label="Order stats" aria-busy="true" className="flex flex-col gap-2">
        <div className="text-sm text-slate-500">
          Loading stats. This takes a few seconds; the list below works meanwhile.
        </div>
        <div className={GRID}>
          {Array.from({ length: 6 }, (_, i) => (
            <Card key={i} size="small">
              <Skeleton active title={false} paragraph={{ rows: 2 }} />
            </Card>
          ))}
        </div>
      </section>
    );
  }

  if (stats.isError) {
    return (
      <Alert
        type="error"
        showIcon
        message={retried ? "Stats are still unavailable" : "Stats did not load"}
        description={
          retried ? "The retry failed too. The order list is not affected; reload the page later." : stats.error.message
        }
        action={
          !retried && (
            <Button
              danger
              onClick={() => {
                setRetried(true);
                void stats.refetch();
              }}
            >
              Retry
            </Button>
          )
        }
      />
    );
  }

  const { byStatus, revenueTodayMinor } = stats.data;
  return (
    <section aria-label="Order stats" className={GRID}>
      {ORDER_STATUSES.map((s) => (
        <Card key={s} size="small">
          <Statistic title={statusLabel[s]} value={byStatus[s]} />
        </Card>
      ))}
      <Card size="small" className="col-span-2 sm:col-span-1 xl:col-span-2">
        <Statistic title="Revenue today (excl. cancelled)" value={formatSar(revenueTodayMinor)} />
      </Card>
    </section>
  );
}
