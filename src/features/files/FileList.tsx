import { canPreviewAttachment } from "@johnbot/contracts/ipc";
import type { AppTextKey } from "@johnbot/i18n";
import {
  Badge,
  Button,
  buttonVariants,
  ConfirmDialog,
  Download,
  DropdownMenu,
  Ellipsis,
  ExternalLink,
  FolderOpen,
  Input,
  MessageCircle,
  RefreshCw,
  Search,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Skeleton,
  Trash2,
  TriangleAlert,
} from "@johnbot/ui";
import type { AgentProfile } from "@johnbot/ui/data";
import { useText } from "@johnbot/ui/text";
import { Dynamic } from "@solidjs/web";
import { createMemo, createSignal, createStore, For, Show } from "solid-js";
import { fileBadge } from "../conversation/AttachmentCards";
import { attachmentReferenceBadge, attachmentReferenceTone } from "../conversation/AttachmentReference";
import {
  FILE_SORTS,
  FILE_TYPE_FILTERS,
  type FileQuery,
  type FileSort,
  fileCountLabel,
  fileDayLabel,
  fileTypeCounts,
  groupFilesByDay,
  queryFiles,
  type StoredFileAction,
  type StoredFileRow,
} from "./files-view";

export interface FileListProps {
  /** Accessible name of the list, such as "Files in Chief". */
  label: string;
  files: readonly StoredFileRow[];
  /** Names the agent on each row. Leave it out where the list already belongs to one agent. */
  agents?: readonly AgentProfile[] | undefined;
  /** Show the chat each file belongs to. Off in the chat's own panel. */
  showConversation?: boolean;
  /** Narrow layout for the chat side panel: filters scroll, rows drop the chat column. */
  compact?: boolean;
  /** Day headings between rows. Applies to the "Newest" order only. */
  groupByDay?: boolean;
  /** Level of the day headings: one below the nearest heading of the caller. Default 4. */
  groupHeadingLevel?: 3 | 4;
  loading?: boolean | undefined;
  error?: string | null | undefined;
  onRetry?: (() => void) | undefined;
  initialQuery?: Partial<FileQuery>;
  /** The clock for day labels, so a story does not depend on the day it runs. */
  now?: Date | undefined;
  emptyTitle?: string;
  emptyDescription?: string;
  /** The viewer can delete files. A row also needs `deletable`. Off for a member of a remote server. */
  canDelete?: boolean | undefined;
  onPreview: (file: StoredFileRow) => void;
  onAction: (file: StoredFileRow, action: StoredFileAction) => void | Promise<void>;
}

const LOADING_ROWS = [0, 1, 2, 3, 4];

/**
 * The file browser every Files surface shares: Storage in Settings, an agent's Files, and a chat's
 * Files panel. It owns the search, type filter and order; the caller owns the data and every action.
 */
export function FileList(props: FileListProps) {
  const { t, format, errorMessage } = useText();
  const [query, setQuery] = createStore<FileQuery>({
    search: props.initialQuery?.search ?? "",
    type: props.initialQuery?.type ?? "all",
    sort: props.initialQuery?.sort ?? "newest",
  });
  const [pendingDelete, setPendingDelete] = createSignal<StoredFileRow | null>(null);
  const [deleteError, setDeleteError] = createSignal<string | null>(null);
  const now = () => props.now ?? new Date();
  const labelOf = (key: AppTextKey | undefined) => (key ? t(key) : undefined);
  const searched = createMemo(() => queryFiles(props.files, { ...query, type: "all" }));
  const counts = createMemo(() => fileTypeCounts(searched()));
  const visible = createMemo(() => queryFiles(props.files, { ...query }));
  const groups = createMemo(() =>
    props.groupByDay && query.sort === "newest"
      ? groupFilesByDay(visible(), now(), t, format)
      : [{ key: "all", label: "", files: visible() }],
  );
  const filtered = () => query.search.trim() !== "" || query.type !== "all";
  const agentName = (agentId: string | null) =>
    agentId ? (props.agents?.find((agent) => agent.id === agentId)?.name ?? null) : null;

  const clearFilters = () =>
    setQuery((draft) => {
      draft.search = "";
      draft.type = "all";
    });

  async function confirmDelete(): Promise<void> {
    const file = pendingDelete();
    if (!file) return;
    setDeleteError(null);
    try {
      await props.onAction(file, "delete");
      setPendingDelete(null);
    } catch (caught) {
      setDeleteError(errorMessage(caught, t("files.delete.failed")));
    }
  }

  return (
    <section className="file-list" data-compact={props.compact ? "true" : undefined} aria-label={props.label}>
      <div className="file-list-toolbar">
        <div className="file-list-search">
          <Search className="file-list-search-icon" aria-hidden="true" />
          <Input
            type="search"
            size="sm"
            className="file-list-search-input"
            placeholder={t("files.list.search")}
            aria-label={t("files.list.search")}
            value={query.search}
            onValueChange={(value) =>
              setQuery((draft) => {
                draft.search = value;
              })
            }
          />
        </div>
        <Select<FileSort>
          options={FILE_SORTS.map((sort) => sort.value)}
          value={query.sort}
          onChange={(value) => {
            if (value)
              setQuery((draft) => {
                draft.sort = value;
              });
          }}
          itemComponent={(itemProps) => (
            <SelectItem item={itemProps.item}>
              {labelOf(FILE_SORTS.find((sort) => sort.value === itemProps.item.rawValue)?.label)}
            </SelectItem>
          )}
        >
          <SelectTrigger size="sm" className="file-list-sort" aria-label={t("files.list.sort")}>
            <SelectValue<FileSort>>
              {(selection) => labelOf(FILE_SORTS.find((sort) => sort.value === selection.selectedOption())?.label)}
            </SelectValue>
          </SelectTrigger>
          <SelectContent />
        </Select>
      </div>
      <fieldset className="file-list-filters" aria-label={t("files.list.type")}>
        <For each={FILE_TYPE_FILTERS.filter((filter) => filter.value === "all" || counts()[filter.value] > 0)}>
          {(filter) => (
            <Button
              type="button"
              size="xs"
              variant="ghost"
              className="file-list-filter"
              aria-pressed={query.type === filter.value ? "true" : "false"}
              data-cuelume-tap="select"
              onClick={() =>
                setQuery((draft) => {
                  draft.type = filter.value;
                })
              }
            >
              {t(filter.label)}
              <span className="file-list-filter-count">{counts()[filter.value]}</span>
            </Button>
          )}
        </For>
      </fieldset>

      <Show
        when={!props.loading}
        fallback={
          <div className="file-list-rows" role="status" aria-busy="true" aria-label={t("files.list.loading")}>
            <For each={LOADING_ROWS}>{() => <Skeleton className="file-list-skeleton" />}</For>
          </div>
        }
      >
        <Show
          when={!props.error}
          fallback={
            <div className="file-list-message" role="alert">
              <TriangleAlert className="file-list-message-icon" data-tone="danger" aria-hidden="true" />
              <p className="file-list-message-title">{t("files.list.loadFailed")}</p>
              <p className="file-list-message-description">{props.error}</p>
              <Show when={props.onRetry}>
                <Button type="button" size="sm" variant="secondary" onClick={() => props.onRetry?.()}>
                  <RefreshCw className="files-button-icon" aria-hidden="true" />
                  {t("common.tryAgain")}
                </Button>
              </Show>
            </div>
          }
        >
          <Show
            when={props.files.length > 0}
            fallback={
              <div className="file-list-message">
                <p className="file-list-message-title">{props.emptyTitle ?? t("files.list.emptyTitle")}</p>
                <p className="file-list-message-description">
                  {props.emptyDescription ?? t("files.list.emptyDescription")}
                </p>
              </div>
            }
          >
            <Show
              when={visible().length > 0}
              fallback={
                <div className="file-list-message">
                  <p className="file-list-message-title">{t("files.list.noMatches")}</p>
                  <Show when={filtered()}>
                    <Button type="button" size="sm" variant="secondary" onClick={clearFilters}>
                      {t("files.list.clearFilters")}
                    </Button>
                  </Show>
                </div>
              }
            >
              <p className="file-list-summary" aria-live="polite">
                {fileCountLabel(visible().length, t)} ·{" "}
                {format.fileSize(visible().reduce((sum, file) => sum + file.size, 0))}
              </p>
              <For each={groups()}>
                {(group) => (
                  <div className="file-list-group">
                    <Show when={group.label}>
                      <Dynamic component={props.groupHeadingLevel === 3 ? "h3" : "h4"} className="file-list-group-heading">
                        {group.label}
                      </Dynamic>
                    </Show>
                    <ul className="file-list-rows">
                      <For each={group.files}>
                        {(file) => (
                          <FileRow
                            file={file}
                            agentName={agentName(file.agentId)}
                            showConversation={props.showConversation !== false && !props.compact}
                            canDelete={props.canDelete === true && file.deletable}
                            dateLabel={
                              group.label
                                ? format.date(new Date(file.createdAt), {
                                    hour: "numeric",
                                    minute: "2-digit",
                                  })
                                : fileDayLabel(file.createdAt, now(), t, format)
                            }
                            onPreview={() => props.onPreview(file)}
                            onAction={(action) => {
                              if (action === "delete") {
                                setDeleteError(null);
                                setPendingDelete(file);
                              } else void props.onAction(file, action);
                            }}
                          />
                        )}
                      </For>
                    </ul>
                  </div>
                )}
              </For>
            </Show>
          </Show>
        </Show>
      </Show>

      <ConfirmDialog
        open={pendingDelete() !== null}
        onCancel={() => setPendingDelete(null)}
        onConfirm={confirmDelete}
        title={
          pendingDelete()?.status === "available" ? t("files.delete.titleAvailable") : t("files.delete.titleRemoved")
        }
        description={
          pendingDelete()?.status === "available"
            ? t("files.delete.descriptionAvailable", { name: pendingDelete()?.name ?? "" })
            : t("files.delete.descriptionRemoved", { name: pendingDelete()?.name ?? "" })
        }
        confirmLabel={pendingDelete()?.status === "available" ? t("common.delete") : t("common.remove")}
        pendingLabel={pendingDelete()?.status === "available" ? t("files.delete.deleting") : t("files.delete.removing")}
        error={deleteError() ?? undefined}
      />
    </section>
  );
}

function FileRow(props: {
  file: StoredFileRow;
  agentName: string | null;
  showConversation: boolean;
  canDelete: boolean;
  dateLabel: string;
  onPreview: () => void;
  onAction: (action: StoredFileAction) => void;
}) {
  const { t, format } = useText();
  const available = () => props.file.status === "available";
  const meta = () =>
    [
      format.fileSize(props.file.size),
      props.showConversation ? props.file.conversation?.title : null,
      props.agentName,
      props.dateLabel,
    ].filter(Boolean);

  return (
    <li className="file-row" data-status={props.file.status}>
      <Button
        type="button"
        variant="ghost"
        className="file-row-main"
        disabled={!available()}
        aria-label={
          canPreviewAttachment(props.file)
            ? t("attachment.preview", { name: props.file.name })
            : t("attachment.open", { name: props.file.name })
        }
        onClick={props.onPreview}
      >
        <FileVisual file={props.file} />
        <span className="file-row-copy">
          <span className="file-row-name" title={props.file.name}>
            {props.file.name}
          </span>
          <span className="file-row-meta">
            <For each={meta()}>
              {(part, index) => (
                <>
                  <Show when={index() > 0}>
                    <span aria-hidden="true"> · </span>
                  </Show>
                  <span className="file-row-meta-part">{part}</span>
                </>
              )}
            </For>
          </span>
        </span>
      </Button>
      <FileStatusBadge status={props.file.status} />
      <FileRowMenu file={props.file} canDelete={props.canDelete} onAction={props.onAction} />
    </li>
  );
}

function FileVisual(props: { file: StoredFileRow }) {
  return (
    <Show
      when={props.file.previewKind === "image" && props.file.previewUrl && props.file.status === "available"}
      fallback={
        <span
          className="files-file-visual"
          data-file-tone={attachmentReferenceTone(props.file.name)}
          data-status={props.file.status}
          aria-hidden="true"
        >
          {attachmentReferenceBadge(props.file.name) ?? fileBadge(props.file)}
        </span>
      }
    >
      <span className="files-file-visual files-file-thumbnail" aria-hidden="true">
        <img src={props.file.previewUrl ?? ""} alt="" />
      </span>
    </Show>
  );
}

function FileStatusBadge(props: { status: StoredFileRow["status"] }) {
  const { t } = useText();
  return (
    <Show when={props.status !== "available"}>
      <Badge
        className="file-row-status"
        variant={
          props.status === "missing" ? "warning-light" : props.status === "failed" ? "destructive-light" : "info-light"
        }
      >
        {props.status === "missing"
          ? t("files.status.missing")
          : props.status === "failed"
            ? t("files.status.failed")
            : t("files.status.remote")}
      </Badge>
    </Show>
  );
}

function FileRowMenu(props: { file: StoredFileRow; canDelete: boolean; onAction: (action: StoredFileAction) => void }) {
  const { t } = useText();
  const status = () => props.file.status;
  return (
    <DropdownMenu.Root placement="bottom-end" gutter={4}>
      <DropdownMenu.Trigger
        className={`${buttonVariants({ variant: "ghost", size: "icon-sm" })} file-row-menu-trigger`}
        aria-label={t("files.action.moreActions", { name: props.file.name })}
      >
        <Ellipsis aria-hidden="true" />
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content>
          <Show when={status() === "available"}>
            <DropdownMenu.Item onSelect={() => props.onAction("open")}>
              <ExternalLink aria-hidden="true" />
              {t("common.open")}
            </DropdownMenu.Item>
            <DropdownMenu.Item onSelect={() => props.onAction("reveal")}>
              <FolderOpen aria-hidden="true" />
              {t("files.action.reveal")}
            </DropdownMenu.Item>
          </Show>
          <Show when={status() === "available" || status() === "remote"}>
            <DropdownMenu.Item onSelect={() => props.onAction("download")}>
              <Download aria-hidden="true" />
              {t("common.download")}
            </DropdownMenu.Item>
          </Show>
          <Show when={status() === "failed"}>
            <DropdownMenu.Item onSelect={() => props.onAction("retry")}>
              <RefreshCw aria-hidden="true" />
              {t("common.tryAgain")}
            </DropdownMenu.Item>
          </Show>
          <Show when={props.file.conversation && props.file.messageId}>
            <DropdownMenu.Item onSelect={() => props.onAction("show-in-chat")}>
              <MessageCircle aria-hidden="true" />
              {t("files.action.showInChat")}
            </DropdownMenu.Item>
          </Show>
          <Show when={props.canDelete}>
            <DropdownMenu.Separator />
            <DropdownMenu.Item className="ui-action-menu-danger" onSelect={() => props.onAction("delete")}>
              <Trash2 aria-hidden="true" />
              {status() === "available" ? t("common.delete") : t("common.remove")}
            </DropdownMenu.Item>
          </Show>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
