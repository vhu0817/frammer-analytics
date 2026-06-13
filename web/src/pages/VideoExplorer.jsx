import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import {
  Search, ChevronUp, ChevronDown, ChevronsLeft, ChevronsRight,
  ChevronLeft, ChevronRight, Download, Filter, X, Check,
  Circle, CircleCheck, CircleDot,
} from "lucide-react";
import { cn } from "@/lib/utils";
import api from "@/lib/api";
import useFilterStore from "@/stores/filterStore";

const PAGE_SIZES = [25, 50, 100];

const COLUMNS = [
  { key: "video_id", label: "ID", sortable: true, width: "w-16" },
  { key: "client", label: "Client", sortable: true, width: "w-36" },
  { key: "channel", label: "Channel", sortable: true, width: "w-40" },
  { key: "user", label: "User", sortable: true, width: "w-28" },
  { key: "input_type", label: "Input", sortable: true, width: "w-28" },
  { key: "output_type", label: "Output", sortable: true, width: "w-28" },
  { key: "platform", label: "Platform", sortable: true, width: "w-24" },
  { key: "duration_seconds", label: "Duration", sortable: true, width: "w-20" },
  { key: "status", label: "Status", sortable: false, width: "w-24" },
  { key: "uploaded_at", label: "Uploaded", sortable: true, width: "w-28" },
];

const fadeUp = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0 },
};

export default function VideoExplorer() {
  const [videos, setVideos] = useState([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [sortBy, setSortBy] = useState("uploaded_at");
  const [sortDir, setSortDir] = useState("desc");
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);

  // subscribe to filters so we re-fetch when they change
  const clientId = useFilterStore((s) => s.clientId);
  const channelId = useFilterStore((s) => s.channelId);
  const platformId = useFilterStore((s) => s.platformId);

  // debounce search
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 400);
    return () => clearTimeout(t);
  }, [search]);

  // reset to page 1 on search/sort/pageSize/filter change
  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, sortBy, sortDir, pageSize, clientId, channelId, platformId]);

  // fetch videos
  useEffect(() => {
    const params = useFilterStore.getState().toParams();
    const fetchVideos = async () => {
      setLoading(true);
      try {
        const res = await api.get("/api/explorer/videos", {
          params: {
            ...params,
            page,
            per_page: pageSize,
            search: debouncedSearch || undefined,
            sort_by: sortBy,
            sort_dir: sortDir,
          },
        });
        setVideos(res.data.videos);
        setTotal(res.data.total);
        setTotalPages(res.data.total_pages);
      } catch (err) {
        console.error("Failed to load videos", err);
      } finally {
        setLoading(false);
      }
    };
    fetchVideos();
  }, [page, pageSize, debouncedSearch, sortBy, sortDir, clientId, channelId, platformId]);

  // handle column sort
  const handleSort = (key) => {
    if (sortBy === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortBy(key);
      setSortDir("asc");
    }
  };

  // handle CSV export
  const handleExport = async () => {
    setExporting(true);
    try {
      const params = useFilterStore.getState().toParams();
      const res = await api.get("/api/explorer/export", {
        params: {
          ...params,
          search: debouncedSearch || undefined,
        },
        responseType: "blob",
      });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement("a");
      link.href = url;
      link.download = `frammer_export_${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Export failed", err);
    } finally {
      setExporting(false);
    }
  };

  // page range for display
  const startItem = (page - 1) * pageSize + 1;
  const endItem = Math.min(page * pageSize, total);

  return (
    <div className="space-y-4">
      {/* header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Video Explorer</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Browse, search, sort, and export video data
        </p>
      </div>

      {/* toolbar */}
      <motion.div {...fadeUp} transition={{ delay: 0.1 }} className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        {/* search bar */}
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <input
            id="video-search"
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search videos, clients, channels…"
            className="w-full rounded-lg border border-border bg-muted/30 py-2 pl-9 pr-9 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring/30 transition-colors"
          />
          {search && (
            <button
              onClick={() => setSearch("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X className="size-4" />
            </button>
          )}
        </div>

        <div className="flex items-center gap-2">
          {/* page size selector */}
          <select
            id="page-size"
            value={pageSize}
            onChange={(e) => setPageSize(Number(e.target.value))}
            className="rounded-lg border border-border bg-muted/30 px-3 py-1.5 text-xs font-medium text-foreground focus:outline-none focus:ring-2 focus:ring-ring/30"
          >
            {PAGE_SIZES.map((s) => (
              <option key={s} value={s}>{s} per page</option>
            ))}
          </select>

          {/* export button */}
          <button
            id="export-csv"
            onClick={handleExport}
            disabled={exporting}
            className={cn(
              "flex items-center gap-1.5 rounded-lg border border-border bg-muted/30 px-3 py-1.5 text-xs font-medium transition-colors",
              exporting
                ? "text-muted-foreground cursor-wait"
                : "text-foreground hover:bg-muted/50"
            )}
          >
            <Download className="size-3.5" />
            {exporting ? "Exporting…" : "Export CSV"}
          </button>
        </div>
      </motion.div>

      {/* data table */}
      <motion.div {...fadeUp} transition={{ delay: 0.15 }} className="glass-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/10">
                {COLUMNS.map((col) => (
                  <th
                    key={col.key}
                    className={cn(
                      "text-left py-3 px-3 text-xs font-medium text-muted-foreground whitespace-nowrap",
                      col.width,
                      col.sortable && "cursor-pointer select-none hover:text-foreground transition-colors"
                    )}
                    onClick={() => col.sortable && handleSort(col.key)}
                  >
                    <div className="flex items-center gap-1">
                      {col.label}
                      {col.sortable && sortBy === col.key && (
                        sortDir === "asc"
                          ? <ChevronUp className="size-3" />
                          : <ChevronDown className="size-3" />
                      )}
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                // skeleton rows
                Array.from({ length: 8 }).map((_, i) => (
                  <tr key={i} className="border-b border-border/30">
                    {COLUMNS.map((col) => (
                      <td key={col.key} className="py-3 px-3">
                        <div className="h-4 w-16 bg-muted/30 rounded animate-pulse" />
                      </td>
                    ))}
                  </tr>
                ))
              ) : videos.length === 0 ? (
                <tr>
                  <td colSpan={COLUMNS.length} className="py-12 text-center text-muted-foreground">
                    No videos found
                  </td>
                </tr>
              ) : (
                videos.map((video, i) => (
                  <tr
                    key={video.video_id}
                    className={cn(
                      "border-b border-border/30 transition-colors hover:bg-muted/10",
                      i % 2 === 0 && "bg-muted/5"
                    )}
                  >
                    <td className="py-2.5 px-3 tabular-nums text-muted-foreground font-mono text-xs">
                      {video.video_id}
                    </td>
                    <td className="py-2.5 px-3 text-foreground font-medium truncate max-w-[144px]">
                      {video.client}
                    </td>
                    <td className="py-2.5 px-3 text-foreground/80 truncate max-w-[160px]">
                      {video.channel}
                    </td>
                    <td className="py-2.5 px-3 text-foreground/80">
                      {video.user}
                    </td>
                    <td className="py-2.5 px-3">
                      <span className="rounded-md bg-muted/30 px-1.5 py-0.5 text-xs text-muted-foreground">
                        {video.input_type}
                      </span>
                    </td>
                    <td className="py-2.5 px-3">
                      <span className="rounded-md bg-primary/10 px-1.5 py-0.5 text-xs text-primary">
                        {video.output_type}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-foreground/70 text-xs">
                      {video.platform}
                    </td>
                    <td className="py-2.5 px-3 tabular-nums text-foreground/80 text-xs">
                      {formatDuration(video.duration_seconds)}
                    </td>
                    <td className="py-2.5 px-3">
                      <StatusBadge
                        isProcessed={video.is_processed}
                        isPublished={video.is_published}
                      />
                    </td>
                    <td className="py-2.5 px-3 text-xs text-muted-foreground whitespace-nowrap">
                      {formatDate(video.uploaded_at)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* pagination footer */}
        {!loading && total > 0 && (
          <div className="flex items-center justify-between border-t border-border px-4 py-3">
            <p className="text-xs text-muted-foreground">
              Showing <span className="text-foreground font-medium">{startItem}–{endItem}</span> of{" "}
              <span className="text-foreground font-medium">{total.toLocaleString()}</span> videos
            </p>
            <div className="flex items-center gap-1">
              <PaginationButton
                onClick={() => setPage(1)}
                disabled={page === 1}
                label="First"
              >
                <ChevronsLeft className="size-3.5" />
              </PaginationButton>
              <PaginationButton
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                label="Previous"
              >
                <ChevronLeft className="size-3.5" />
              </PaginationButton>

              {/* page numbers */}
              {getPageRange(page, totalPages).map((p) =>
                p === "..." ? (
                  <span key={`dots-${Math.random()}`} className="px-1 text-xs text-muted-foreground">
                    …
                  </span>
                ) : (
                  <button
                    key={p}
                    onClick={() => setPage(p)}
                    className={cn(
                      "size-7 rounded-md text-xs font-medium transition-colors",
                      p === page
                        ? "bg-primary text-primary-foreground"
                        : "text-muted-foreground hover:bg-muted/30 hover:text-foreground"
                    )}
                  >
                    {p}
                  </button>
                )
              )}

              <PaginationButton
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                label="Next"
              >
                <ChevronRight className="size-3.5" />
              </PaginationButton>
              <PaginationButton
                onClick={() => setPage(totalPages)}
                disabled={page === totalPages}
                label="Last"
              >
                <ChevronsRight className="size-3.5" />
              </PaginationButton>
            </div>
          </div>
        )}
      </motion.div>
    </div>
  );
}

// pagination button
function PaginationButton({ children, onClick, disabled, label }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      className={cn(
        "size-7 flex items-center justify-center rounded-md text-xs transition-colors",
        disabled
          ? "text-muted-foreground/30 cursor-not-allowed"
          : "text-muted-foreground hover:bg-muted/30 hover:text-foreground"
      )}
    >
      {children}
    </button>
  );
}

// status badge component
function StatusBadge({ isProcessed, isPublished }) {
  if (isPublished) {
    return (
      <span className="inline-flex items-center gap-1 rounded-md bg-chart-2/15 px-1.5 py-0.5 text-xs text-chart-2">
        <CircleCheck className="size-3" /> Published
      </span>
    );
  }
  if (isProcessed) {
    return (
      <span className="inline-flex items-center gap-1 rounded-md bg-chart-4/15 px-1.5 py-0.5 text-xs text-chart-4">
        <CircleDot className="size-3" /> Processed
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-md bg-muted/30 px-1.5 py-0.5 text-xs text-muted-foreground">
      <Circle className="size-3" /> Pending
    </span>
  );
}

// format seconds to mm:ss
function formatDuration(seconds) {
  if (!seconds) return "—";
  const m = Math.floor(seconds / 60);
  const s = Math.round(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

// format datetime string
function formatDate(dateStr) {
  if (!dateStr) return "—";
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "2-digit",
  });
}

// calculate visible page range (with ellipsis)
function getPageRange(current, total) {
  if (total <= 7) {
    return Array.from({ length: total }, (_, i) => i + 1);
  }

  const pages = [];
  pages.push(1);

  if (current > 3) pages.push("...");

  const start = Math.max(2, current - 1);
  const end = Math.min(total - 1, current + 1);

  for (let i = start; i <= end; i++) {
    pages.push(i);
  }

  if (current < total - 2) pages.push("...");

  pages.push(total);
  return pages;
}
