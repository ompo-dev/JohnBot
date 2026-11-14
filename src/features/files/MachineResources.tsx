import {
  canAdministerServer,
  MACHINE_ALERT_LEVEL_MAX,
  MACHINE_ALERT_LEVEL_MIN,
  MACHINE_METRICS,
  type MachineAlertSettings,
  type MachineMetric,
  type MachineMetrics,
  machineAlertLevel,
  machineMetricRatio,
  type TeamMemberSummary,
} from "@johnbot/contracts/ipc";
import type { AppTextKey } from "@johnbot/i18n";
import {
  Cpu,
  HardDrive,
  MemoryStick,
  Progress,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  SliderField,
  TriangleAlert,
} from "@johnbot/ui";
import { useText } from "@johnbot/ui/text";
import type { JSX } from "@solidjs/web";
import { createMemo, createSignal, createUniqueId, For, Show } from "solid-js";

export interface MachineResourcesProps {
  /** Null until the first reading arrives. */
  metrics: MachineMetrics | null;
  error?: string | null;
  /** Null while the settings load, or for a viewer who cannot change them. */
  alerts: MachineAlertSettings | null;
  members: readonly TeamMemberSummary[];
  onChangeAlerts: (settings: MachineAlertSettings) => Promise<void>;
}

const METRIC_LABELS = {
  disk: "files.machine.disk",
  memory: "files.machine.memory",
  cpu: "files.machine.cpu",
} as const satisfies Record<MachineMetric, AppTextKey>;

const METRIC_ALERT_LABELS = {
  disk: "files.machine.diskAlert",
  memory: "files.machine.memoryAlert",
  cpu: "files.machine.cpuAlert",
} as const satisfies Record<MachineMetric, AppTextKey>;

const METRIC_ICONS: Record<MachineMetric, (props: { className: string }) => JSX.Element> = {
  disk: (props) => <HardDrive className={props.className} aria-hidden="true" />,
  memory: (props) => <MemoryStick className={props.className} aria-hidden="true" />,
  cpu: (props) => <Cpu className={props.className} aria-hidden="true" />,
};

const LEVEL_FIELDS = {
  disk: "diskPercent",
  memory: "memoryPercent",
  cpu: "cpuPercent",
} as const satisfies Record<MachineMetric, keyof MachineAlertSettings>;

/**
 * The machine part of Server settings > Storage: disk, memory and CPU use of the computer that runs
 * the host, the level at which each one alerts, and the owner or admin who gets the alert.
 */
export function MachineResources(props: MachineResourcesProps) {
  const { t, format } = useText();
  const headingId = `machine-${createUniqueId()}`;
  // A slider moves with the pointer, and its level saves when the user lets go. The record is replaced
  // whole on each move, so the slider reads the new level at once. The sliders stay enabled while a
  // level saves, so keyboard focus stays on the slider.
  const [draftLevels, setDraftLevels] = createSignal<Partial<Record<MachineMetric, number>>>({});
  const level = (metric: MachineMetric): number | null =>
    draftLevels()[metric] ?? (props.alerts ? machineAlertLevel(props.alerts, metric) : null);
  const recipients = createMemo(() =>
    props.members.filter((member) => !member.disabled && canAdministerServer(member.role)),
  );
  const responsible = () => {
    const id = props.alerts?.responsibleMemberId ?? null;
    return recipients().find((member) => member.id === id) ?? recipients().find((member) => member.role === "owner");
  };
  const responsibleName = () => {
    const member = responsible();
    return member ? memberName(member) : "";
  };
  const passed = () =>
    MACHINE_METRICS.filter((metric) => {
      const ratio = props.metrics ? machineMetricRatio(props.metrics, metric) : null;
      const limit = level(metric);
      return ratio !== null && limit !== null && Math.floor(ratio * 100) >= limit;
    });

  async function save(change: Partial<MachineAlertSettings>): Promise<void> {
    const saved = props.alerts;
    if (!saved) return;
    // A member who left or is no longer an admin cannot get the alert, and the host refuses the
    // settings while they name one. The owner gets it then, as the picker shows.
    const stored = saved.responsibleMemberId;
    const stale = stored !== null && props.members.length > 0 && !recipients().some((member) => member.id === stored);
    // The caller shows the new settings at once, so a second change in a row builds on this one.
    await props.onChangeAlerts({ ...saved, ...(stale ? { responsibleMemberId: null } : {}), ...change });
  }

  /** The slider shows its saved level again; another slider that the user still drags keeps its value. */
  const clearDraft = (metric: MachineMetric) =>
    setDraftLevels((levels) => {
      const { [metric]: _, ...rest } = levels;
      return rest;
    });

  return (
    <section className="storage-section machine-resources" aria-labelledby={headingId}>
      <div className="storage-section-heading-row">
        <h3 id={headingId} className="storage-section-heading">
          {t("files.machine.title")}
        </h3>
        <span className="storage-section-aside">{t("files.machine.updates")}</span>
      </div>
      <Show
        when={props.metrics}
        fallback={
          <Show when={props.error}>
            {(error) => (
              <div className="storage-message" role="alert">
                <TriangleAlert className="storage-message-icon" aria-hidden="true" />
                <p className="storage-message-description">{error()}</p>
              </div>
            )}
          </Show>
        }
      >
        {(metrics) => (
          <ul className="machine-resources-metrics">
            <For each={MACHINE_METRICS}>
              {(metric) => {
                const ratio = () => machineMetricRatio(metrics(), metric);
                const percent = () => {
                  const value = ratio();
                  return value === null ? null : Math.floor(value * 100);
                };
                const tone = () => {
                  const value = percent();
                  const limit = level(metric);
                  if (value === null || limit === null || value < limit) return "normal";
                  return value >= Math.max(95, limit + 10) ? "danger" : "warning";
                };
                const Icon = METRIC_ICONS[metric];
                return (
                  <li className="machine-resources-metric" data-tone={tone()}>
                    <Icon className="machine-resources-icon" />
                    <span className="machine-resources-copy">
                      <span className="machine-resources-title">{t(METRIC_LABELS[metric])}</span>
                      <span className="machine-resources-meta">{metricDetail(metrics(), metric)}</span>
                    </span>
                    {/* 0% is a reading too, so the test is for null, not for a falsy value. */}
                    <Show
                      when={percent() !== null}
                      fallback={<span className="machine-resources-meta">{t("files.machine.unknown")}</span>}
                    >
                      {(_) => (
                        <>
                          <span className="machine-resources-bar">
                            <Progress
                              value={percent() ?? 0}
                              aria-label={t(METRIC_LABELS[metric])}
                              getValueLabel={() =>
                                t("files.machine.used", { percent: format.percent((percent() ?? 0) / 100) })
                              }
                            />
                            <Show when={level(metric)} keyed>
                              {(limit) => (
                                <span
                                  className="machine-resources-threshold"
                                  style={{ left: `${limit}%` }}
                                  aria-hidden="true"
                                />
                              )}
                            </Show>
                          </span>
                          <span className="machine-resources-value">{format.percent((percent() ?? 0) / 100)}</span>
                        </>
                      )}
                    </Show>
                  </li>
                );
              }}
            </For>
          </ul>
        )}
      </Show>
      <Show when={passed()[0]} keyed>
        {(metric) => (
          <div className="storage-message machine-resources-alert" role="status">
            <TriangleAlert className="storage-message-icon" aria-hidden="true" />
            <div>
              <p className="storage-message-title">{aboveText(metric)}</p>
              <Show when={responsible()}>
                {(member) => (
                  <p className="storage-message-description">
                    {t("files.machine.alertSent", { name: memberName(member()) })}
                  </p>
                )}
              </Show>
            </div>
          </div>
        )}
      </Show>
      <Show when={props.alerts}>
        <h3 className="storage-section-heading">{t("files.machine.alerts")}</h3>
        <div className="machine-resources-settings">
          <Show when={recipients().length > 0}>
            <div className="machine-resources-setting">
              <span className="machine-resources-copy">
                <span className="machine-resources-title">{t("files.machine.notify")}</span>
                <span className="machine-resources-meta">{t("files.machine.notifyDescription")}</span>
              </span>
              <Select<TeamMemberSummary>
                className="settings-modal-select machine-resources-select"
                options={recipients()}
                optionValue="id"
                optionTextValue={memberName}
                value={responsible() ?? null}
                placement="bottom-end"
                onChange={(member) => {
                  if (member) void save({ responsibleMemberId: member.id });
                }}
                itemComponent={(item) => <SelectItem item={item.item}>{memberName(item.item.rawValue)}</SelectItem>}
              >
                <SelectTrigger size="sm" aria-label={t("files.machine.notifyLabel", { name: responsibleName() })}>
                  <SelectValue<TeamMemberSummary>>
                    {(state) => {
                      const member = state.selectedOption();
                      return member ? memberName(member) : "";
                    }}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent />
              </Select>
            </div>
          </Show>
          <For each={MACHINE_METRICS}>
            {(metric) => (
              <SliderField
                label={t(METRIC_ALERT_LABELS[metric])}
                value={level(metric) ?? MACHINE_ALERT_LEVEL_MAX}
                minValue={MACHINE_ALERT_LEVEL_MIN}
                maxValue={MACHINE_ALERT_LEVEL_MAX}
                formatValue={(value) => t("files.machine.above", { percent: format.percent(value / 100) })}
                onChange={(value) => setDraftLevels((levels) => ({ ...levels, [metric]: value }))}
                onChangeEnd={(value) => {
                  if (props.alerts && value !== machineAlertLevel(props.alerts, metric))
                    void save({ [LEVEL_FIELDS[metric]]: value });
                  clearDraft(metric);
                }}
              />
            )}
          </For>
        </div>
      </Show>
    </section>
  );

  function aboveText(metric: MachineMetric): string {
    const params = { level: format.percent((level(metric) ?? 0) / 100) };
    if (metric === "disk") return t("files.machine.diskAbove", params);
    return metric === "memory" ? t("files.machine.memoryAbove", params) : t("files.machine.cpuAbove", params);
  }

  function metricDetail(metrics: MachineMetrics, metric: MachineMetric): string {
    // A container limit can be part of a core, such as 1.5.
    if (metric === "cpu") {
      const cores = metrics.cpuMillicores / 1000;
      return t("files.machine.cores", { count: cores, cores: format.number(cores, { maximumFractionDigits: 2 }) });
    }
    if (metric === "disk") {
      const { diskUsedBytes: used, diskFreeBytes: free, diskTotalBytes: total } = metrics;
      if (used === null || free === null || total === null) return t("files.machine.unknown");
      return t("files.machine.diskDetail", {
        used: format.fileSize(used),
        total: format.fileSize(total),
        free: format.fileSize(free),
      });
    }
    const { memoryTotalBytes: total, memoryAvailableBytes: free } = metrics;
    if (total === null || free === null) return t("files.machine.unknown");
    return t("files.machine.memoryDetail", {
      used: format.fileSize(Math.max(0, total - free)),
      total: format.fileSize(total),
    });
  }
}

function memberName(member: TeamMemberSummary): string {
  return member.name?.trim() || member.username || member.email || member.id;
}
