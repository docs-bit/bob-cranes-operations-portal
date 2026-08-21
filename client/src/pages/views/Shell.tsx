import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { AlertTriangle, ArrowLeft, ArrowRight, Bell, BriefcaseBusiness, CalendarDays, CheckCircle2, ChevronDown, ClipboardCheck, Download, FileCheck2, FileText, FolderOpen, Gauge, HardHat, Landmark, LayoutDashboard, Lock, LoaderCircle, LogOut, Mail, MapPin, MessageCircle, MoreHorizontal, Moon, Plus, Search, Send, Settings, ShieldCheck, Sun, TrendingUp, Truck, Users, UserCog, Wrench, Upload, X } from "lucide-react";
import { DEPARTMENTS, type View, type Booking, initials, statusTone } from "./shared";
import { canAccessWorkspaceView, roleLabel } from "@shared/departmentAccess";
import { filterNotifications } from "@shared/notificationAndExpiryRules";
import { useTheme } from "@/contexts/ThemeContext";
import { trpc } from "@/lib/trpc";

export function Shell({
  children,
  view,
  setView,
  onBack,
  onClient,
  onDepartment,
  provisionedDashboards = [],
  activeProvisionedDepartmentCode = null,
  onProvisionedDashboard = () => undefined,
  departmentLabel,
  bookings,
  onOpenDossier,
  user,
  onSignOut,
}: {
  children: React.ReactNode;
  view: View;
  setView: (view: View) => void;
  onBack: () => void;
  onClient: () => void;
  onDepartment: (department: string) => void;
  provisionedDashboards?: Array<{ code: string; name: string; accent: string }>;
  activeProvisionedDepartmentCode?: string | null;
  onProvisionedDashboard?: (departmentCode: string) => void;
  departmentLabel: string | null;
  bookings: Booking[];
  onOpenDossier: (booking: Booking) => void;
  user: {
    id: number;
    name: string | null;
    email: string | null;
    companyName?: string | null;
    phone?: string | null;
    role: "admin" | "supervisor" | "user";
    departmentCode: string | null;
    supervisorId?: number | null;
  };
  onSignOut: () => Promise<void>;
}) {
  const { theme, toggleTheme } = useTheme();
  const [notificationOpen, setNotificationOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [moreActionsOpen, setMoreActionsOpen] = useState(false);
  const [dossierSearchOpen, setDossierSearchOpen] = useState(false);
  const [dossierSearchQuery, setDossierSearchQuery] = useState("");
  const canSearchDossiers = view === "overview" || view === "bookings" || view === "detail";
  const dossierSearchResults = useMemo(() => {
    const query = dossierSearchQuery.trim().toLowerCase();
    if (!query) return bookings.slice(0, 6);
    return bookings
      .filter(booking =>
        [
          booking.id,
          booking.client,
          booking.project,
          booking.crane,
          booking.site,
          booking.stage,
          booking.priority,
        ].some(value => value.toLowerCase().includes(query))
      )
      .slice(0, 6);
  }, [bookings, dossierSearchQuery]);
  const openDossierSearch = () => {
    setDossierSearchQuery("");
    setDossierSearchOpen(true);
  };
  const chooseDossierSearchResult = (booking: Booking) => {
    setDossierSearchOpen(false);
    setDossierSearchQuery("");
    onOpenDossier(booking);
  };
  useEffect(() => {
    const handleShortcut = (event: KeyboardEvent) => {
      if (canSearchDossiers && (event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        openDossierSearch();
      }
      if (event.key === "Escape") setDossierSearchOpen(false);
    };
    window.addEventListener("keydown", handleShortcut);
    return () => window.removeEventListener("keydown", handleShortcut);
  }, [canSearchDossiers]);
  useEffect(() => {
    if (!canSearchDossiers) setDossierSearchOpen(false);
  }, [canSearchDossiers]);
  const notificationInput = useMemo(
    () =>
      user.role === "admin"
        ? undefined
        : { departmentCode: user.departmentCode ?? undefined },
    [user.role, user.departmentCode]
  );
  const notificationsQuery =
    trpc.operations.getNotifications.useQuery(notificationInput);
  const clearNotificationsMutation =
    trpc.operations.clearNotifications.useMutation();
  const utils = trpc.useUtils();
  const updateMyContactDetails = trpc.auth.updateMyContactDetails.useMutation();
  const [profileContact, setProfileContact] = useState({
    companyName: user.companyName ?? "",
    phone: user.phone ?? "",
  });
  useEffect(() => {
    setProfileContact({ companyName: user.companyName ?? "", phone: user.phone ?? "" });
  }, [user.companyName, user.phone]);
  const saveProfileContactDetails = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    try {
      await updateMyContactDetails.mutateAsync(profileContact);
      await utils.auth.me.invalidate();
      toast.success("Profile contact details saved", { description: "Your company and phone can now pre-fill rental estimate emails." });
    } catch (caught) {
      toast.error("Profile update failed", { description: caught instanceof Error ? caught.message : "Please try again." });
    }
  };
  const notificationItems = notificationsQuery.data ?? [];
  const [urgencyFilter, setUrgencyFilter] = useState<
    "All" | "High" | "Warning" | "Standard"
  >("All");
  const [deptFilter, setDeptFilter] = useState<
    "All" | "Documentation" | "HSE" | "Crew" | "Accounts" | "Transportation"
  >("All");
  const filteredNotifications = useMemo(
    () => filterNotifications(notificationItems, urgencyFilter, deptFilter),
    [notificationItems, urgencyFilter, deptFilter]
  );
  const unreadNotifications = notificationItems.filter(
    item => item.read !== 1
  ).length;
  const handleClearNotifications = async () => {
    try {
      await clearNotificationsMutation.mutateAsync({
        departmentCode:
          user.role === "admin"
            ? undefined
            : (user.departmentCode ?? undefined),
      });
      await utils.operations.getNotifications.invalidate();
      toast.success("Notifications cleared", {
        description: "All unread items have been marked as read.",
      });
    } catch (caught) {
      toast.error("Could not clear notifications", {
        description:
          caught instanceof Error ? caught.message : "Please try again.",
      });
    }
  };
  const [avatarTone, setAvatarTone] = useState("blue");
  const avatarTones = [
    { id: "blue", color: "#0a66c2" },
    { id: "teal", color: "#0b8f87" },
    { id: "violet", color: "#7457c8" },
    { id: "amber", color: "#c68116" },
  ];
  useEffect(() => {
    try {
      const saved = localStorage.getItem(`bob-avatar-tone-${user.id}`);
      if (saved && avatarTones.some(tone => tone.id === saved))
        setAvatarTone(saved);
    } catch {}
  }, [user.id]);
  useEffect(() => {
    try {
      localStorage.setItem(`bob-avatar-tone-${user.id}`, avatarTone);
    } catch {}
  }, [avatarTone, user.id]);
  const avatarStyle = {
    background:
      avatarTones.find(tone => tone.id === avatarTone)?.color ?? "#0a66c2",
    color: "#fff",
  };
  const navItems: { id: View; label: string; icon: React.ReactNode }[] = [
    { id: "overview", label: "Operations Cockpit", icon: <LayoutDashboard /> },
    { id: "bookings", label: "Booking Dossiers", icon: <ClipboardCheck /> },
    { id: "docs", label: "Documents & Compliance", icon: <FileCheck2 /> },
    { id: "crew", label: "Crew Assignment", icon: <Users /> },
    { id: "gear", label: "Lifting Gears", icon: <Wrench /> },
    { id: "attendance", label: "Attendance", icon: <CalendarDays /> },
    { id: "training", label: "Training Register", icon: <FileCheck2 /> },
    { id: "uploads", label: "Excel Data Uploads", icon: <FolderOpen /> },
  ];
  const visibleNavItems = navItems.filter(item =>
    canAccessWorkspaceView(user, item.id)
  );
  const departmentItems = [
    {
      label: "Sales & Client Relations",
      code: "sales",
      icon: <ClipboardCheck />,
    },
    {
      label: "Documentation & Permits",
      code: "documentation",
      icon: <FileText />,
    },
    {
      label: "Lifting Gears / Engineering",
      code: "lifting-gears",
      icon: <Wrench />,
    },
    { label: "Maintenance", code: "maintenance", icon: <Gauge /> },
    { label: "Crew / Workmen Assignment", code: "crew", icon: <Users /> },
    { label: "HSE / Safety", code: "hse", icon: <ShieldCheck /> },
    { label: "Accounts", code: "accounts", icon: <Landmark /> },
    { label: "HR", code: "hr", icon: <CalendarDays /> },
    { label: "Transportation", code: "transportation", icon: <Truck /> },
    {
      label: "Administrator / Super Admin",
      code: "administrator",
      icon: <Settings />,
    },
  ] as const;
  const permittedDepartments =
    user.role === "admin"
      ? departmentItems
      : departmentItems.filter(
          department => department.code === user.departmentCode
        );
  const permittedProvisionedDashboards =
    user.role === "admin"
      ? provisionedDashboards
      : provisionedDashboards.filter(
          department => department.code === user.departmentCode
        );
  const userName = user.name?.trim() || "BOB Cranes user";
  const userDepartment =
    user.role === "admin"
      ? "Administrator"
      : (provisionedDashboards.find(department => department.code === user.departmentCode)
          ?.name ?? DEPARTMENTS.find(department => department.code === user.departmentCode)
          ?.label ?? "Department user");
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-row">
            <div className="brand-mark brand-logo full-bob-logo-frame">
              <img
                className="brand-logo-image full-bob-logo"
                src="/manus-storage/bob-lifting-your-expectations_2beae224.webp"
                alt="BOB Cranes — Lifting Your Expectations"
              />
            </div>
            <div className="brand-copy">
              <div className="brand-title">BOB CRANES</div>
              <div className="brand-subtitle">Operations Control</div>
            </div>
          </div>
        </div>
        <nav className="nav">
          <div className="nav-section">Workspace</div>
          {visibleNavItems.map(item => (
            <button
              key={item.id}
              className={`nav-item ${view === item.id || (view === "detail" && item.id === "bookings") ? "active" : ""}`}
              onClick={() => setView(item.id)}
            >
              {item.icon}
              <span>{item.label}</span>
            </button>
          ))}
          <div className="nav-section" style={{ marginTop: 22 }}>
            Departments
          </div>
          {permittedDepartments.map(department => (
            <button
              className={`nav-item ${view === "department" && departmentLabel === department.label ? "active" : ""}`}
              key={department.code}
              onClick={() => onDepartment(department.label)}
            >
              {department.icon}
              <span>{department.label}</span>
            </button>
          ))}
          {permittedProvisionedDashboards.map(department => (
            <button
              className={`nav-item ${view === "provisioned-dashboard" && activeProvisionedDepartmentCode === department.code ? "active" : ""}`}
              key={department.code}
              onClick={() => onProvisionedDashboard(department.code)}
            >
              <LayoutDashboard />
              <span>{department.name}</span>
            </button>
          ))}
          {user.role === "admin" && (
            <>
              <div className="nav-section" style={{ marginTop: 22 }}>
                Administration
              </div>
              <button className="nav-item" onClick={() => setView("overview")}>
                <Gauge />
                <span>Fleet & Utilization</span>
              </button>
              <button
                className={`nav-item ${view === "supervisor-audit" ? "active" : ""}`}
                onClick={() => setView("supervisor-audit")}
              >
                <ShieldCheck />
                <span>Supervisor Audit</span>
              </button>
              <button
                className={`nav-item ${view === "web-vitals" ? "active" : ""}`}
                onClick={() => setView("web-vitals")}
              >
                <TrendingUp />
                <span>Web Vitals Analytics</span>
              </button>
              <button
                className="nav-item"
                onClick={() => {
                  setProfileOpen(false);
                  setView("users");
                  window.setTimeout(() => {
                    document.getElementById("dashboard-greeting-settings")?.scrollIntoView({
                      behavior: "smooth",
                      block: "start",
                    });
                  }, 0);
                }}
              >
                <Settings />
                <span>System Settings</span>
              </button>
            </>
          )}
          {user.role !== "user" && (
            <button
              className={`nav-item ${view === "users" ? "active" : ""}`}
              onClick={() => setView("users")}
            >
              <UserCog />
              <span>
                {user.role === "admin"
                  ? "Department Users"
                  : "My Department Users"}
              </span>
            </button>
          )}
          {(user.role === "admin" || user.departmentCode === "sales") && (
            <>
              <div className="nav-section" style={{ marginTop: 22 }}>
                Client tools
              </div>
              <button
                className={`nav-item ${view === "sales-enquiries" ? "active" : ""}`}
                onClick={() => setView("sales-enquiries")}
              >
                <BriefcaseBusiness />
                <span>Sales Enquiries</span>
              </button>
              <button className="nav-item" onClick={onClient}>
                <MessageCircle />
                <span>Client Portal Preview</span>
              </button>
            </>
          )}
        </nav>
        <div className="sidebar-footer">
          <button
            type="button"
            className="workspace-theme-toggle"
            onClick={toggleTheme}
            aria-pressed={theme === "dark"}
            aria-label={`Switch departmental workspace to ${theme === "dark" ? "light" : "dark"} mode`}
          >
            {theme === "dark" ? <Sun size={15} aria-hidden="true" /> : <Moon size={15} aria-hidden="true" />}
            <span>{theme === "dark" ? "Light workspace" : "Dark workspace"}</span>
          </button>
          <div className="profile-menu-wrap">
            <button
              className="user-mini"
              onClick={() => setProfileOpen(open => !open)}
              aria-expanded={profileOpen}
              aria-label="Open profile menu"
            >
              <div className="avatar" style={avatarStyle}>
                {initials(userName)}
              </div>
              <div className="user-copy">
                <div className="user-name">{userName}</div>
                <div className="user-role">{userDepartment}</div>
              </div>
              <ChevronDown size={14} />
            </button>
            {profileOpen && (
              <div className="profile-menu">
                <div className="profile-menu-heading">
                  <div className="profile-identity">
                    <div className="avatar" style={avatarStyle}>
                      {initials(userName)}
                    </div>
                    <div>
                      <strong>{userName}</strong>
                      <span>{user.email ?? "No email on record"}</span>
                    </div>
                  </div>
                  <div className="profile-details">
                    <span>
                      <strong>Department</strong>
                      {userDepartment}
                    </span>
                    <span>
                      <strong>Role</strong>
                      {roleLabel(user.role)}
                    </span>
                  </div>
                </div>
                <div className="avatar-customizer">
                  <div className="profile-detail-label">Customize avatar</div>
                  <div className="avatar-choice-row">
                    {avatarTones.map(tone => (
                      <button
                        type="button"
                        key={tone.id}
                        className={`avatar-choice ${avatarTone === tone.id ? "selected" : ""}`}
                        style={{ background: tone.color }}
                        onClick={() => setAvatarTone(tone.id)}
                        aria-label={`Use ${tone.id} avatar color`}
                        aria-pressed={avatarTone === tone.id}
                      />
                    ))}
                  </div>
                </div>
                <form className="profile-contact-settings" onSubmit={saveProfileContactDetails}>
                  <div className="profile-detail-label">Rental estimate contact</div>
                  <label><span>Company</span><input value={profileContact.companyName} onChange={event => setProfileContact(current => ({ ...current, companyName: event.target.value }))} maxLength={160} placeholder="Optional company name" /></label>
                  <label><span>Phone</span><input value={profileContact.phone} onChange={event => setProfileContact(current => ({ ...current, phone: event.target.value }))} maxLength={48} placeholder="Optional phone number" /></label>
                  <button type="submit" disabled={updateMyContactDetails.isPending}>{updateMyContactDetails.isPending ? "Saving contact…" : "Save contact details"}</button>
                </form>
                {user.role !== "user" && (
                  <button
                    onClick={() => {
                      setProfileOpen(false);
                      setView("users");
                    }}
                  >
                    <UserCog size={15} />
                    Manage department users
                  </button>
                )}
                <button className="profile-signout" onClick={onSignOut}>
                  <LogOut size={15} />
                  <span>Sign out</span>
                  <small>Return to login</small>
                </button>
              </div>
            )}
          </div>
        </div>
      </aside>
      <main className="main-shell">
        <header className="topbar">
          <div className="topbar-leading">
            {view !== "overview" && (
              <button
                className="back-button"
                onClick={onBack}
                aria-label="Go back"
              >
                <ArrowLeft size={15} />
                <span>Back</span>
              </button>
            )}
            <div className="breadcrumb">
              BOB Cranes /{" "}
              <strong>
                {view === "overview"
                  ? "Operations Cockpit"
                  : view === "wizard"
                    ? "New Booking"
                    : view === "detail"
                      ? "Booking Dossier"
                  : view === "department"
                        ? departmentLabel
                        : view === "provisioned-dashboard"
                          ? provisionedDashboards.find(department => department.code === activeProvisionedDepartmentCode)?.name ?? "Department dashboard"
                        : view === "training"
                          ? "Training Register"
                          : view === "uploads"
                            ? "Excel Data Uploads"
                            : view === "supervisor-audit"
                              ? "Supervisor Permissions Audit"
                              : view[0].toUpperCase() + view.slice(1)}
              </strong>
            </div>
          </div>
          <div className="topbar-actions">
            <button
              type="button"
              className="icon-button header-theme-toggle"
              onClick={toggleTheme}
              aria-pressed={theme === "dark"}
              aria-label={`Switch application to ${theme === "dark" ? "light" : "dark"} mode`}
              title={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
            >
              {theme === "dark" ? <Sun size={16} aria-hidden="true" /> : <Moon size={16} aria-hidden="true" />}
            </button>
            {canSearchDossiers && <><button
              type="button"
              className="search-pill search-launcher"
              onClick={openDossierSearch}
              aria-label="Open booking dossier search"
              aria-expanded={dossierSearchOpen}
            >
              <Search size={14} /> Search dossiers{" "}
              <span style={{ marginLeft: "auto", color: "#555" }}>⌘ K</span>
            </button>
            {dossierSearchOpen && (
              <div
                className="header-dossier-search"
                role="dialog"
                aria-label="Search booking dossiers"
              >
                <div className="header-dossier-search-input">
                  <Search size={15} aria-hidden="true" />
                  <input
                    autoFocus
                    value={dossierSearchQuery}
                    onChange={event => setDossierSearchQuery(event.target.value)}
                    onKeyDown={event => {
                      if (event.key === "Enter" && dossierSearchResults[0]) {
                        chooseDossierSearchResult(dossierSearchResults[0]);
                      }
                    }}
                    placeholder="Search ID, client, project, crane, site, or stage"
                    aria-label="Search booking dossiers"
                  />
                  <button
                    type="button"
                    className="icon-button"
                    onClick={() => setDossierSearchOpen(false)}
                    aria-label="Close booking dossier search"
                  >
                    <X size={15} />
                  </button>
                </div>
                <div className="header-dossier-search-summary">
                  {dossierSearchQuery.trim()
                    ? `${dossierSearchResults.length} matching dossier${dossierSearchResults.length === 1 ? "" : "s"}`
                    : "Recent dossiers"}
                </div>
                <div className="header-dossier-search-results">
                  {dossierSearchResults.length ? (
                    dossierSearchResults.map((booking, index) => (
                      <button
                        type="button"
                        className="header-dossier-search-result"
                        key={`dossier-search-${booking.id}-${index}`}
                        onClick={() => chooseDossierSearchResult(booking)}
                      >
                        <span>
                          <strong>{booking.id}</strong>
                          <small>
                            {booking.client} · {booking.project}
                          </small>
                        </span>
                        <span className="status-badge gray">{booking.stage}</span>
                      </button>
                    ))
                  ) : (
                    <div className="header-dossier-search-empty">
                      No booking dossiers match this search.
                    </div>
                  )}
                </div>
              </div>
            )}</>}
            <div className="notification-wrap">
              <button
                className="icon-button notification-trigger"
                aria-label="Open notifications"
                aria-expanded={notificationOpen}
                onClick={() => setNotificationOpen(value => !value)}
              >
                <Bell size={16} />
                {unreadNotifications > 0 && (
                  <span className="notification-count">
                    {unreadNotifications > 9 ? "9+" : unreadNotifications}
                  </span>
                )}
              </button>
              {notificationOpen && (
                <div
                  className="notification-dropdown"
                  role="dialog"
                  aria-label="Notifications"
                >
                  <div className="notification-dropdown-header">
                    <div>
                      <strong>Notifications</strong>
                      <span>
                        {unreadNotifications
                          ? `${unreadNotifications} new`
                          : "All caught up"}
                      </span>
                    </div>
                    <div
                      style={{ display: "flex", gap: 6, alignItems: "center" }}
                    >
                      <button
                        className="secondary-button"
                        style={{
                          fontSize: 11,
                          padding: "2px 8px",
                          height: "auto",
                          background: "#1f2937",
                          color: "#fff",
                          borderColor: "#374151",
                        }}
                        onClick={handleClearNotifications}
                        disabled={clearNotificationsMutation.isPending}
                      >
                        {clearNotificationsMutation.isPending
                          ? "Clearing…"
                          : "Mark all read"}
                      </button>
                      {unreadNotifications > 0 && (
                        <button
                          className="secondary-button"
                          style={{
                            fontSize: 11,
                            padding: "2px 8px",
                            height: "auto",
                          }}
                          onClick={handleClearNotifications}
                          disabled={clearNotificationsMutation.isPending}
                        >
                          Clear all
                        </button>
                      )}
                    </div>
                  </div>
                  <div
                    className="notification-filter-bar"
                    style={{
                      padding: "8px 12px",
                      borderBottom: "1px solid #2a2a2a",
                      display: "flex",
                      gap: 6,
                      flexWrap: "wrap",
                    }}
                  >
                    <select
                      className="attendance-select compact"
                      value={urgencyFilter}
                      onChange={e => setUrgencyFilter(e.target.value as any)}
                      aria-label="Filter notifications by urgency"
                      style={{ fontSize: 11, padding: "2px 6px" }}
                    >
                      <option value="All">Urgency: All</option>
                      <option value="High">High</option>
                      <option value="Warning">Warning</option>
                      <option value="Standard">Standard</option>
                    </select>
                    <select
                      className="attendance-select compact"
                      value={deptFilter}
                      onChange={e => setDeptFilter(e.target.value as any)}
                      aria-label="Filter notifications by department"
                      style={{ fontSize: 11, padding: "2px 6px" }}
                    >
                      <option value="All">Dept: All</option>
                      <option value="Documentation">Documentation</option>
                      <option value="HSE">HSE</option>
                      <option value="Crew">Crew</option>
                      <option value="Accounts">Accounts</option>
                      <option value="Transportation">Transportation</option>
                    </select>
                  </div>
                  {notificationsQuery.error ? (
                    <div className="notification-empty notification-error">
                      Unable to load notifications.
                    </div>
                  ) : filteredNotifications.length ? (
                    <div className="notification-stack">
                      {filteredNotifications.slice(0, 8).map(item => (
                        <div
                          className={`notification ${item.read === 1 ? "notification-read" : "notification-unread"}`}
                          key={item.id}
                        >
                          <div className="notification-title-row">
                            <div className="title">{item.title}</div>
                            {item.read !== 1 && (
                              <span className="notification-dot" />
                            )}
                          </div>
                          <div className="body">{item.body}</div>
                          <time>
                            {new Date(item.createdAt).toLocaleString("en-GB", {
                              day: "2-digit",
                              month: "short",
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </time>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="notification-empty">
                      <Bell size={16} />
                      No notifications match this filter.
                    </div>
                  )}
                </div>
              )}
            </div>
            <div className="more-actions-wrap">
              <button
                className="icon-button"
                aria-label="Open more actions"
                aria-expanded={moreActionsOpen}
                onClick={() => setMoreActionsOpen(open => !open)}
              >
                <MoreHorizontal size={17} />
              </button>
              {moreActionsOpen && (
                <div className="more-actions-menu" role="menu">
                  <button
                    type="button"
                    onClick={() => {
                      setMoreActionsOpen(false);
                      setView("overview");
                    }}
                  >
                    <LayoutDashboard size={14} /> Open operations cockpit
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setMoreActionsOpen(false);
                      if (user.role === "admin") setView("bookings");
                      else
                        toast.info("Dossier queue restricted", {
                          description:
                            "Your department workspace opens dossiers through its assigned workflow.",
                        });
                    }}
                  >
                    <ClipboardCheck size={14} /> Open dossier queue
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setMoreActionsOpen(false);
                      onClient();
                    }}
                  >
                    <MessageCircle size={14} /> Open client portal
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>
        {children}
      </main>
    </div>
  );
}

