import { AlertTriangle, Info } from "lucide-react";
import { useMemo } from "react";
import { useData } from "../contexts/DataContext";
import { HeaderActionButton } from "./ui/HeaderActionButton";

interface OverviewContextBarProps {
  onOpenRunInfo: () => void;
  runInfoPressed: boolean;
  onOpenAlerts: () => void;
  alertsPressed: boolean;
}

export function OverviewContextBar({
  onOpenRunInfo,
  runInfoPressed,
  onOpenAlerts,
  alertsPressed,
}: OverviewContextBarProps) {
  const { data } = useData();

  const alertCount = useMemo(
    () =>
      (data?.alerts ?? []).filter((alert) =>
        Boolean(alert?.id && alert?.type && alert?.source && alert?.title)
      ).length,
    [data?.alerts]
  );

  const runName = data?.runInfo?.runName ?? data?.name;
  const recordCount = data?.runInfo?.recordCount ?? data?.manifest?.length ?? 0;

  const runMetaParts = [
    recordCount > 0 ? `${recordCount.toLocaleString()} записей` : null,
    data?.runInfo?.normalized ? "нормализовано" : null,
  ].filter(Boolean);

  const runStatusLabel = runMetaParts.length > 0
    ? `${runMetaParts.join(" • ")} · Нажмите для просмотра деталей`
    : "Нажмите для просмотра деталей запуска";

  return (
    <div className="reson-overview-context-bar mb-5">
      <HeaderActionButton
        variant="overview"
        title={runName || "Информация о запуске"}
        hint="Нажмите для просмотра деталей запуска"
        statusLabel={runStatusLabel}
        showStatus
        icon={<Info className="w-4 h-4" />}
        onClick={onOpenRunInfo}
        pressed={runInfoPressed}
      />

      {alertCount > 0 && (
        <HeaderActionButton
          variant="alerts"
          title="Алерты качества"
          hint="Нажмите для просмотра списка проблем"
          statusLabel={`${alertCount} проблем · Нажмите для просмотра деталей`}
          showStatus
          icon={<AlertTriangle className="w-4 h-4" />}
          onClick={onOpenAlerts}
          pressed={alertsPressed}
        />
      )}
    </div>
  );
}
