type TooltipPayloadItem = {
  name?: string;
  value?: number | string;
};

type ChartTooltipProps = {
  active?: boolean;
  label?: string;
  payload?: TooltipPayloadItem[];
  formatter: (value: number) => string;
};

export function ChartTooltip({ active, label, payload, formatter }: ChartTooltipProps) {
  if (!active || !payload?.length) {
    return null;
  }

  return (
    <div className="rounded-xl border border-border bg-popover px-3 py-2 text-sm text-popover-foreground">
      {label ? <p className="font-medium text-foreground">{label}</p> : null}
      <div className="mt-2 space-y-1">
        {payload.map((item) => (
          <div key={`${item.name}-${item.value}`} className="flex items-center justify-between gap-4">
            <span className="text-muted-foreground">{item.name}</span>
            <span className="font-medium text-foreground">
              {typeof item.value === "number" ? formatter(item.value) : item.value}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
