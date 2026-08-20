import { useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";
import { toast } from "sonner";
import { ArrowRight, Check, Download, Filter, FolderOpen, MoreHorizontal, Plus, Search, X } from "lucide-react";
import { stages, stageShort, type Booking, type BookingFilter, type BookingSort, type Stage, type View } from "./shared";
import { PageHeading } from "./OverviewHelpers";
import { StatusBadge } from "./primitives";
import { embedBobFullLogo, drawBobDocumentLogo } from "@/lib/pdfBrand";

function parseBookingListParams(search: string): {
  query: string;
  filter: BookingFilter;
  sortBy: BookingSort;
} {
  const params = new URLSearchParams(search);
  const query = params.get("q") ?? "";
  const filterValue = params.get("filter");
  const sortValue = params.get("sort");
  const filter: BookingFilter =
    filterValue === "critical" || filterValue === "mobilizing"
      ? filterValue
      : "all";
  const sortBy: BookingSort =
    sortValue === "date-desc" ||
    sortValue === "status" ||
    sortValue === "id-asc" ||
    sortValue === "id-desc"
      ? sortValue
      : "date-asc";
  return { query, filter, sortBy };
}

export function BookingsListSkeleton() {
  return (
    <div className="table-wrap bookings-list-skeleton" role="status" aria-live="polite" aria-label="Loading booking dossiers">
      <table className="data-table" aria-hidden="true">
        <thead>
          <tr>
            <th>Dossier</th>
            <th>Client / Project</th>
            <th>Crane & Site</th>
            <th>Lifecycle stage</th>
            <th>Docs</th>
            <th>Mobilization</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: 5 }, (_, index) => (
            <tr key={`booking-skeleton-${index}`}>
              <td><span className="booking-list-skeleton-bar wide" /></td>
              <td>
                <span className="booking-list-skeleton-bar medium" />
                <span className="booking-list-skeleton-bar short" />
              </td>
              <td>
                <span className="booking-list-skeleton-bar medium" />
                <span className="booking-list-skeleton-bar short" />
              </td>
              <td><span className="booking-list-skeleton-pill" /></td>
              <td>
                <span className="booking-list-skeleton-bar medium" />
                <span className="booking-list-skeleton-bar short" />
              </td>
              <td><span className="booking-list-skeleton-bar short" /></td>
              <td><span className="booking-list-skeleton-dot" /></td>
            </tr>
          ))}
        </tbody>
      </table>
      <span className="sr-only">Loading booking dossiers…</span>
    </div>
  );
}

export function BookingsEmptyState({
  query,
  filter,
  onReset,
}: {
  query: string;
  filter: BookingFilter;
  onReset: () => void;
}) {
  const hasCriteria = Boolean(query.trim()) || filter !== "all";
  return (
    <div className="booking-empty-state" role="status" aria-live="polite">
      <div className="booking-empty-illustration" aria-hidden="true">
        <div className="booking-empty-orbit orbit-one" />
        <div className="booking-empty-orbit orbit-two" />
        <div className="booking-empty-icon"><FolderOpen size={30} /></div>
      </div>
      <strong>{hasCriteria ? "No booking dossiers found" : "No booking dossiers yet"}</strong>
      <p>
        {query.trim()
          ? `We couldn’t find a dossier matching “${query.trim()}”.`
          : filter !== "all"
            ? "No dossiers match the selected booking filter right now."
            : "New booking dossiers will appear here as the sales team creates them."}
      </p>
      {hasCriteria && (
        <button type="button" className="secondary-button compact-button" onClick={onReset}>
          Clear search and filters
        </button>
      )}
    </div>
  );
}

export function BookingsView({
  bookings,
  setView,
  setDetail,
  isLoading,
}: {
  bookings: Booking[];
  setView: (view: View) => void;
  setDetail: (booking: Booking) => void;
  isLoading?: boolean;
}) {
  const [location] = useLocation();
  const locationSearch = location.includes("?")
    ? location.slice(location.indexOf("?") + 1)
    : "";
  const initialParams = useMemo(
    () => parseBookingListParams(locationSearch),
    [locationSearch]
  );
  const [filter, setFilter] = useState<BookingFilter>(initialParams.filter);
  const [query, setQuery] = useState(initialParams.query);
  const [sortBy, setSortBy] = useState<BookingSort>(initialParams.sortBy);
  const [bookingPage, setBookingPage] = useState(1);
  const [bookingsPerPage, setBookingsPerPage] = useState<10 | 20 | 50>(() => {
    if (typeof window === "undefined") return 10;
    const stored = Number(window.localStorage.getItem("bob-bookings-page-size-v1"));
    return stored === 20 || stored === 50 ? stored : 10;
  });

  useEffect(() => {
    const nextParams = parseBookingListParams(locationSearch);
    setQuery(current => current === nextParams.query ? current : nextParams.query);
    setFilter(current => current === nextParams.filter ? current : nextParams.filter);
    setSortBy(current => current === nextParams.sortBy ? current : nextParams.sortBy);
  }, [locationSearch]);

  useEffect(() => {
    const params = new URLSearchParams(locationSearch);
    if (query.trim()) params.set("q", query.trim()); else params.delete("q");
    if (filter !== "all") params.set("filter", filter); else params.delete("filter");
    if (sortBy !== "date-asc") params.set("sort", sortBy); else params.delete("sort");
    const pathname = location.split("?")[0] || "/portal";
    const nextLocation = params.toString() ? `${pathname}?${params.toString()}` : pathname;
    if (nextLocation !== location) {
      window.history.replaceState(window.history.state, "", nextLocation);
    }
  }, [filter, location, locationSearch, query, sortBy]);

  const visibleBookings = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    const filtered = bookings.filter(booking => {
      const matchesFilter =
        filter === "all" ||
        (filter === "critical"
          ? booking.priority === "Critical"
          : booking.progress < 100);
      const matchesQuery =
        !normalized ||
        [
          booking.id,
          booking.client,
          booking.project,
          booking.crane,
          booking.site,
          booking.stage,
          booking.priority,
        ].some(value => value.toLowerCase().includes(normalized));
      return matchesFilter && matchesQuery;
    });

    return filtered.sort((left, right) => {
      if (sortBy === "status") {
        return stages.indexOf(left.stage) - stages.indexOf(right.stage);
      }
      if (sortBy === "id-asc" || sortBy === "id-desc") {
        const result = left.id.localeCompare(right.id, undefined, { numeric: true });
        return sortBy === "id-desc" ? -result : result;
      }
      const leftDate = Date.parse(left.mob);
      const rightDate = Date.parse(right.mob);
      const result =
        (Number.isNaN(leftDate) ? Number.MAX_SAFE_INTEGER : leftDate) -
        (Number.isNaN(rightDate) ? Number.MAX_SAFE_INTEGER : rightDate);
      return sortBy === "date-desc" ? -result : result;
    });
  }, [bookings, filter, query, sortBy]);

  const totalBookingPages = Math.max(1, Math.ceil(visibleBookings.length / bookingsPerPage));
  const paginatedBookings = useMemo(
    () => visibleBookings.slice((bookingPage - 1) * bookingsPerPage, bookingPage * bookingsPerPage),
    [bookingPage, bookingsPerPage, visibleBookings]
  );

  useEffect(() => {
    setBookingPage(current => Math.min(current, totalBookingPages));
  }, [totalBookingPages]);

  useEffect(() => {
    setBookingPage(1);
  }, [bookingsPerPage, filter, query, sortBy]);

  useEffect(() => {
    try {
      window.localStorage.setItem("bob-bookings-page-size-v1", String(bookingsPerPage));
    } catch {
      // Local storage may be unavailable in privacy-restricted browser contexts.
    }
  }, [bookingsPerPage]);

  const exportBookings = () => {
    const quote = (value: string | number) => `"${String(value).replace(/"/g, '""')}"`;
    const rows = visibleBookings.map(booking => [
      booking.id,
      booking.client,
      booking.project,
      booking.crane,
      booking.site,
      booking.stage,
      booking.priority,
      booking.progress,
      booking.mob,
      booking.offHire,
    ]);
    const csv = [
      ["Booking ID", "Client", "Project", "Crane", "Site", "Status", "Priority", "Documents %", "Mobilization", "Off-hire"],
      ...rows,
    ].map(row => row.map(quote).join(",")).join("\r\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `bob-bookings-${filter}-${sortBy}-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    toast.success(`${visibleBookings.length} booking${visibleBookings.length === 1 ? "" : "s"} exported to CSV`);
  };

  const exportBookingsPdf = async () => {
    try {
      const { PDFDocument, StandardFonts, rgb } = await import("pdf-lib");
      const pdfDoc = await PDFDocument.create();
      const bold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
      const logo = await embedBobFullLogo(pdfDoc);
      let page = pdfDoc.addPage([842, 595]); // A4 landscape
      const { height } = page.getSize();
      const logoWidth = drawBobDocumentLogo({ page, logo, bold, x: 40, y: height - 88, maxWidth: 150, maxHeight: 54 });
      const headerX = 40 + logoWidth + 18;
      const generatedAt = new Date().toLocaleString();
      
      page.drawText("Filtered Booking Dossiers Report", { x: headerX, y: height - 45, size: 18, color: rgb(0.12, 0.35, 0.28) });
      page.drawText(`Generated: ${generatedAt} · Filter: ${filter} · Sorted: ${sortBy} · Total: ${visibleBookings.length} dossiers`, { x: headerX, y: height - 66, size: 10, color: rgb(0.4, 0.4, 0.4) });
      
      let y = height - 118;
      page.drawText("ID", { x: 40, y, size: 10, color: rgb(0.2, 0.2, 0.2) });
      page.drawText("Client / Project", { x: 120, y, size: 10, color: rgb(0.2, 0.2, 0.2) });
      page.drawText("Crane & Site", { x: 320, y, size: 10, color: rgb(0.2, 0.2, 0.2) });
      page.drawText("Stage", { x: 520, y, size: 10, color: rgb(0.2, 0.2, 0.2) });
      page.drawText("Mobilization", { x: 680, y, size: 10, color: rgb(0.2, 0.2, 0.2) });
      
      y -= 16;
      page.drawLine({ start: { x: 40, y }, end: { x: 800, y }, thickness: 1, color: rgb(0.8, 0.85, 0.83) });
      y -= 20;
      
      for (const booking of visibleBookings.slice(0, 22)) {
        if (y < 50) {
          page = pdfDoc.addPage([842, 595]);
          y = height - 50;
        }
        page.drawText(booking.id, { x: 40, y, size: 9, color: rgb(0.1, 0.1, 0.1) });
        page.drawText(`${booking.client} (${booking.project ?? ""})`.slice(0, 45), { x: 120, y, size: 9, color: rgb(0.1, 0.1, 0.1) });
        page.drawText(`${booking.crane ?? ""} · ${booking.site ?? ""}`.slice(0, 45), { x: 320, y, size: 9, color: rgb(0.1, 0.1, 0.1) });
        page.drawText(booking.stage ?? "Draft", { x: 520, y, size: 9, color: rgb(0.1, 0.1, 0.1) });
        page.drawText(booking.mob, { x: 680, y, size: 9, color: rgb(0.1, 0.1, 0.1) });
        y -= 22;
      }
      
      const pdfBytes = await pdfDoc.save();
      const blob = new Blob([pdfBytes.buffer as ArrayBuffer], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `bob-bookings-report-${new Date().toISOString().slice(0, 10)}.pdf`;
      link.click();
      URL.revokeObjectURL(url);
      toast.success(`${visibleBookings.length} booking dossiers exported to PDF.`);
    } catch (err) {
      console.error(err);
      toast.error("PDF export failed. Please try CSV export.");
    }
  };

  return (
    <div className="content">
      <PageHeading
        eyebrow="Dossier management"
        title="Booking dossiers"
        copy="Search, filter, and open the operating record for every active and dispatched job."
        action={
          <button className="primary-button" onClick={() => setView("wizard")}>
            <Plus size={15} /> New booking
          </button>
        }
      />
      <div className="panel">
        <div className="panel-header booking-list-header">
          <div className="filter-row">
            <button
              className={`filter-chip ${filter === "all" ? "selected" : ""}`}
              onClick={() => setFilter("all")}
              aria-pressed={filter === "all"}
            >
              All statuses
            </button>
            <button
              className={`filter-chip ${filter === "critical" ? "selected" : ""}`}
              onClick={() => setFilter("critical")}
              aria-pressed={filter === "critical"}
            >
              Critical priority
            </button>
            <button
              className={`filter-chip ${filter === "mobilizing" ? "selected" : ""}`}
              onClick={() => setFilter("mobilizing")}
              aria-pressed={filter === "mobilizing"}
            >
              Mobilizing this week
            </button>
          </div>
          <div className="booking-list-tools">
            <label className="search-pill booking-search">

              <Search size={14} aria-hidden="true" />
              <input
                value={query}
                onChange={event => setQuery(event.target.value)}
                placeholder="Search client, project, or ID"
                aria-label="Search booking dossiers by client, project, or booking ID"
              />
              {query && (
                <button
                  type="button"
                  className="booking-search-clear"
                  onClick={() => setQuery("")}
                  aria-label="Clear booking search"
                >
                  <X size={13} />
                </button>
              )}
            </label>
            <div style={{ display: "flex", gap: 6 }}>
              <button
                type="button"
                className="secondary-button booking-export-button"
                onClick={exportBookings}
                disabled={!visibleBookings.length || isLoading}
                aria-label="Export filtered booking dossiers to CSV"
              >
                <Download size={14} /> Export CSV
              </button>
              <button
                type="button"
                className="secondary-button booking-export-button"
                onClick={exportBookingsPdf}
                disabled={!visibleBookings.length || isLoading}
                aria-label="Export filtered booking dossiers to PDF"
              >
                <Download size={14} /> Export PDF
              </button>
            </div>
            <label className="booking-sort-control">
              <span>Sort by</span>
              <select
                value={sortBy}
                onChange={event => setSortBy(event.target.value as BookingSort)}
                aria-label="Sort booking dossiers"
              >
                <option value="date-asc">Mobilization date · earliest</option>
                <option value="date-desc">Mobilization date · latest</option>
                <option value="status">Workflow status</option>
                <option value="id-asc">Booking ID · A–Z</option>
                <option value="id-desc">Booking ID · Z–A</option>
              </select>
            </label>
          </div>
        </div>
        {isLoading ? (
          <BookingsListSkeleton />
        ) : (
          <div className="table-wrap" aria-live="polite">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Dossier</th>
                  <th>Client / Project</th>
                  <th>Crane & Site</th>
                  <th>Lifecycle stage</th>
                  <th>Docs</th>
                  <th>Mobilization</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {paginatedBookings.map((booking, index) => (
                  <tr
                    key={`booking-table-${booking.id}-${index}`}
                    onClick={() => setDetail(booking)}
                    style={{ cursor: "pointer" }}
                    tabIndex={0}
                    onKeyDown={event => {
                      if (event.key === "Enter" || event.key === " ")
                        setDetail(booking);
                    }}
                  >
                    <td>
                      <strong style={{ color: "#ef7377" }}>{booking.id}</strong>
                      <div className="muted">Created by Sales</div>
                    </td>
                    <td>
                      <strong>{booking.client}</strong>
                      <div className="muted">{booking.project}</div>
                    </td>
                    <td>
                      <strong>{booking.crane}</strong>
                      <div className="muted">{booking.site}</div>
                    </td>
                    <td>
                      <StatusBadge value={booking.stage} />
                    </td>
                    <td style={{ minWidth: 100 }}>
                      <div className="progress-track">
                        <div
                          className={`progress-fill ${booking.progress === 100 ? "green" : ""}`}
                          style={{ width: `${booking.progress}%` }}
                        />
                      </div>
                      <div className="muted" style={{ marginTop: 4 }}>
                        {booking.progress}% complete
                      </div>
                    </td>
                    <td>{booking.mob}</td>
                    <td>
                      <ArrowRight size={15} color="#777" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {visibleBookings.length === 0 && (
              <BookingsEmptyState
                query={query}
                filter={filter}
                onReset={() => {
                  setQuery("");
                  setFilter("all");
                  setSortBy("date-asc");
                }}
              />
            )}
            {visibleBookings.length > 0 && (
              <div className="booking-pagination" aria-label="Bookings pagination">
                <span className="muted">
                  Showing {(bookingPage - 1) * bookingsPerPage + 1}–{Math.min(bookingPage * bookingsPerPage, visibleBookings.length)} of {visibleBookings.length} bookings
                </span>
                <div className="booking-pagination-controls">
                  <label className="booking-page-size-control">
                    <span className="muted">Rows</span>
                    <select
                      value={bookingsPerPage}
                      onChange={event => setBookingsPerPage(Number(event.target.value) as 10 | 20 | 50)}
                      aria-label="Bookings per page"
                    >
                      <option value={10}>10</option>
                      <option value={20}>20</option>
                      <option value={50}>50</option>
                    </select>
                  </label>
                  <button
                    type="button"
                    className="secondary-button compact-button"
                    onClick={() => setBookingPage(page => Math.max(1, page - 1))}
                    disabled={bookingPage === 1}
                    aria-label="Previous bookings page"
                  >
                    Previous
                  </button>
                  <span className="booking-pagination-page">Page {bookingPage} of {totalBookingPages}</span>
                  <button
                    type="button"
                    className="secondary-button compact-button"
                    onClick={() => setBookingPage(page => Math.min(totalBookingPages, page + 1))}
                    disabled={bookingPage === totalBookingPages}
                    aria-label="Next bookings page"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

