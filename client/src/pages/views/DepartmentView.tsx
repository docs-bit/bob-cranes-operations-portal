import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { AlertTriangle, ArrowRight, Bell, Check, CheckCircle2, ClipboardCheck, Clock3, FileText, FolderOpen, LayoutDashboard, LoaderCircle, Lock, Plus, Search, Send, Settings, ShieldCheck, Truck, Users, Wrench, X } from "lucide-react";
import { DEPARTMENTS, PARALLEL_WORKSTREAMS, departmentList, type Booking, type DepartmentDashboardConfig, type Stage } from "./shared";
import { PageHeading } from "./OverviewHelpers";
import { MetricCard, StatusBadge } from "./primitives";
import { departmentPortalConfigs, type DepartmentPortalConfig } from "./DepartmentConfig";
import { canDispatch as canDispatchByRule, departmentCompletion, documentCompletion, type DocumentItem } from "@shared/bookingRules";
import { DEPARTMENT_LABEL_TO_CODE, canAccessWorkspaceView } from "@shared/departmentAccess";
import { normalizeDepartmentDashboardConfig, defaultWorkflowChecklist, DEPARTMENT_DASHBOARD_METRICS, DEPARTMENT_DASHBOARD_WIDGETS, type DepartmentDashboardMetric, type DepartmentDashboardWidget, type WorkflowChecklistItem } from "@shared/departmentDashboardRules";
import { ATTENDANCE_CREW_ROSTER } from "@shared/attendanceCrewRoster";
import { trpc } from "@/lib/trpc";

export function DepartmentView({
  department,
  bookings,
  setDetail,
  onAdvance,
  onCompleteWorkstream,
  completedWorkstreams,
}: {
  department: string;
  bookings: Booking[];
  setDetail: (booking: Booking) => void;
  onAdvance: (booking: Booking, config: DepartmentPortalConfig) => void;
  onCompleteWorkstream: (
    booking: Booking,
    config: DepartmentPortalConfig
  ) => void;
  completedWorkstreams: Record<string, string[]>;
}) {
  const [workspaceQuery, setWorkspaceQuery] = useState("");
  const [searchSuggestionsOpen, setSearchSuggestionsOpen] = useState(false);
  const [activeSuggestionIndex, setActiveSuggestionIndex] = useState(-1);
  const [recentSearches, setRecentSearches] = useState<string[]>(() => {
    if (typeof window === "undefined") return [];
    try {
      const stored = JSON.parse(window.localStorage.getItem("bob-department-recent-searches") ?? "[]");
      return Array.isArray(stored) ? stored.filter((value): value is string => typeof value === "string").slice(0, 6) : [];
    } catch {
      return [];
    }
  });
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [priorityFilter, setPriorityFilter] = useState<"all" | Booking["priority"]>("all");
  const [readinessFilter, setReadinessFilter] = useState<"all" | "ready" | "action">("all");
  const departmentCode =
    DEPARTMENT_LABEL_TO_CODE[department] ?? "administrator";
  const config =
    departmentPortalConfigs[departmentCode] ??
    departmentPortalConfigs.administrator;
  const stageNames = useMemo(
    () => [config.entryStage, config.secondaryStage].filter(Boolean) as Stage[],
    [config.entryStage, config.secondaryStage]
  );
  const queue = useMemo(() => {
    const stageQueue = bookings.filter(booking => stageNames.includes(booking.stage));
    return (stageQueue.length
      ? stageQueue
      : bookings.filter(booking => booking.progress < 100)
    ).slice(0, 4);
  }, [bookings, stageNames]);
  const readyCount = queue.filter(booking =>
    config.parallelCode
      ? completedWorkstreams[booking.id]?.includes(config.parallelCode)
      : Boolean(
          booking.stage === config.secondaryStage
            ? config.secondaryNextStage
            : config.nextStage
        )
  ).length;
  const nextStageFor = (booking: Booking) =>
    booking.stage === config.secondaryStage
      ? config.secondaryNextStage
      : config.nextStage;
  const [searchSuggestions, setSearchSuggestions] = useState<Booking[]>([]);
  const [searchSuggestionsLoading, setSearchSuggestionsLoading] = useState(false);
  useEffect(() => {
    const query = workspaceQuery.trim().toLowerCase();
    if (!query) {
      setSearchSuggestions([]);
      setSearchSuggestionsLoading(false);
      return;
    }
    let cancelled = false;
    setSearchSuggestionsLoading(true);
    const timer = window.setTimeout(() => {
      const matches = queue
        .filter(booking => `${booking.id} ${booking.client} ${booking.project} ${booking.site} ${booking.crane}`.toLowerCase().includes(query))
        .slice(0, 5);
      if (!cancelled) {
        setSearchSuggestions(matches);
        setSearchSuggestionsLoading(false);
      }
    }, 180);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [queue, workspaceQuery]);
  const rememberSearch = (term: string) => {
    const normalized = term.trim();
    if (!normalized) return;
    setRecentSearches(previous => {
      const next = [normalized, ...previous.filter(item => item.toLowerCase() !== normalized.toLowerCase())].slice(0, 6);
      window.localStorage.setItem("bob-department-recent-searches", JSON.stringify(next));
      return next;
    });
  };
  useEffect(() => {
    const focusSearch = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (event.key !== "/" || event.metaKey || event.ctrlKey || event.altKey || event.shiftKey || ["INPUT", "TEXTAREA", "SELECT"].includes(target?.tagName ?? "")) return;
      event.preventDefault();
      searchInputRef.current?.focus();
      setSearchSuggestionsOpen(true);
      setActiveSuggestionIndex(searchSuggestions.length ? 0 : -1);
    };
    document.addEventListener("keydown", focusSearch);
    return () => document.removeEventListener("keydown", focusSearch);
  }, [searchSuggestions.length]);
  const selectSuggestion = (booking: Booking) => {
    setWorkspaceQuery(booking.id);
    rememberSearch(booking.id);
    setSearchSuggestionsOpen(false);
    setActiveSuggestionIndex(-1);
  };
  const highlightQuery = (value: string) => {
    const query = workspaceQuery.trim();
    if (!query) return value;
    const start = value.toLowerCase().indexOf(query.toLowerCase());
    if (start < 0) return value;
    return <>{value.slice(0, start)}<mark>{value.slice(start, start + query.length)}</mark>{value.slice(start + query.length)}</>;
  };
  const visibleQueue = queue.filter(booking => {
    const searchText = `${booking.id} ${booking.client} ${booking.project} ${booking.site} ${booking.crane}`.toLowerCase();
    const matchesQuery = searchText.includes(workspaceQuery.trim().toLowerCase());
    const matchesPriority = priorityFilter === "all" || booking.priority === priorityFilter;
    const isReady = config.parallelCode
      ? Boolean(completedWorkstreams[booking.id]?.includes(config.parallelCode))
      : Boolean(nextStageFor(booking));
    const matchesReadiness = readinessFilter === "all" || (readinessFilter === "ready" ? isReady : !isReady);
    return matchesQuery && matchesPriority && matchesReadiness;
  });
  return (
    <div className="content">
      <PageHeading
        eyebrow="Individual department portal"
        title={config.label}
        copy={config.focus}
        action={
          queue[0] ? (
            <button
              className="primary-button"
              onClick={() => setDetail(queue[0])}
            >
              <ClipboardCheck size={14} /> Open priority dossier
            </button>
          ) : (
            <span className="status-badge green">
              <CheckCircle2 size={12} /> Queue clear
            </span>
          )
        }
      />
      <div className="department-portal-banner">
        <div>
          <div className="eyebrow">{config.owner}</div>
          <div className="panel-title">Dedicated {config.label} dashboard</div>
          <div className="panel-meta">
            This portal is linked to the BOB Cranes eight-stage lifecycle. Work
            is released only from the current stage gate.
          </div>
        </div>
        <div className="department-portal-stage">
          <span>{config.readOnly ? "Access mode" : "Stage gate"}</span>
          <strong>
            {config.readOnly ? "Read-only oversight" : config.entryStage}
          </strong>
          {!config.readOnly &&
            nextStageFor(
              queue[0] ?? ({ stage: config.entryStage } as Booking)
            ) && (
              <>
                <ArrowRight size={15} />
                <strong>
                  {nextStageFor(
                    queue[0] ?? ({ stage: config.entryStage } as Booking)
                  )}
                </strong>
              </>
            )}
        </div>
      </div>
      <div className="metric-grid">
        <MetricCard
          label="Stage queue"
          value={`${queue.length}`}
          foot={`${config.entryStage} dossiers`}
          icon={<Clock3 size={13} />}
        />
        <MetricCard
          label="Ready to hand off"
          value={`${readyCount}`}
          foot={
            config.parallelCode
              ? "Workstream evidence complete"
              : "Checklist complete"
          }
          icon={<CheckCircle2 size={13} />}
          tone="green"
        />
        <MetricCard
          label="Compliance watch"
          value="06"
          foot="Certificates due soon"
          icon={<AlertTriangle size={13} />}
        />
        <MetricCard
          label="Notifications"
          value="08"
          foot="In-app + email delivered"
          icon={<Bell size={13} />}
        />
      </div>
      <div className="detail-grid">
        <div className="panel">
          <div className="panel-header">
            <div>
              <div className="panel-title">{config.label} action queue</div>
              <div className="panel-meta">
                {config.readOnly
                  ? "Oversight view; operational actions remain with department supervisors."
                  : "Dossiers at this department’s stage gate are actionable."}
              </div>
            </div>
            <StatusBadge
              value={config.readOnly ? "Read-only" : config.entryStage}
            />
          </div>
          <div className="panel-body">
            <div className="department-workspace-toolbar" role="search" aria-label={`${config.label} operations search and filters`}>
              <div className="department-search-field">
                <label className="department-workspace-search">
                  <Search size={15} aria-hidden="true" />
                  <input
                    ref={searchInputRef}
                    value={workspaceQuery}
                    onChange={event => {
                      setWorkspaceQuery(event.target.value);
                      setSearchSuggestions([]);
                      setSearchSuggestionsLoading(Boolean(event.target.value.trim()));
                      setActiveSuggestionIndex(0);
                      setSearchSuggestionsOpen(true);
                    }}
                    onFocus={() => {
                      setActiveSuggestionIndex(searchSuggestions.length ? 0 : -1);
                      setSearchSuggestionsOpen(true);
                    }}
                    onBlur={() => window.setTimeout(() => setSearchSuggestionsOpen(false), 120)}
                    onKeyDown={event => {
                      if (event.key === "Escape") {
                        setSearchSuggestionsOpen(false);
                        setActiveSuggestionIndex(-1);
                        return;
                      }
                      if (event.key === "Enter" && activeSuggestionIndex < 0 && workspaceQuery.trim()) {
                        rememberSearch(workspaceQuery);
                        setSearchSuggestionsOpen(false);
                        return;
                      }
                      if (!searchSuggestionsOpen || !searchSuggestions.length) return;
                      if (event.key === "ArrowDown") {
                        event.preventDefault();
                        setActiveSuggestionIndex(index => (index + 1) % searchSuggestions.length);
                      } else if (event.key === "ArrowUp") {
                        event.preventDefault();
                        setActiveSuggestionIndex(index => (index - 1 + searchSuggestions.length) % searchSuggestions.length);
                      } else if (event.key === "Enter" && activeSuggestionIndex >= 0) {
                        event.preventDefault();
                        selectSuggestion(searchSuggestions[activeSuggestionIndex]);
                      }
                    }}
                    placeholder="Search dossier, client, site or crane"
                    aria-label="Search operational queue"
                    aria-autocomplete="list"
                    aria-controls="department-search-suggestions"
                    aria-activedescendant={activeSuggestionIndex >= 0 ? `department-search-suggestion-${activeSuggestionIndex}` : undefined}
                  />
                </label>
                {workspaceQuery && <button type="button" className="department-search-clear" aria-label="Clear operational queue search" onMouseDown={event => event.preventDefault()} onClick={() => { setWorkspaceQuery(""); setSearchSuggestions([]); setSearchSuggestionsOpen(false); setActiveSuggestionIndex(-1); searchInputRef.current?.focus(); }}><X size={13} aria-hidden="true" /></button>}
                {searchSuggestionsOpen && (searchSuggestionsLoading || searchSuggestions.length > 0 || (!workspaceQuery.trim() && recentSearches.length > 0)) && (
                  <div id="department-search-suggestions" className="department-search-suggestions" role="listbox" aria-label={workspaceQuery.trim() ? "Matching operations" : "Recent searches"} aria-busy={searchSuggestionsLoading}>
                    {!searchSuggestionsLoading && !workspaceQuery.trim() && recentSearches.length > 0 && <>
                      <div className="department-search-recent-title">Recent searches</div>
                      {recentSearches.map(term => <button type="button" role="option" className="department-search-suggestion" key={`recent-${term}`} onMouseDown={event => event.preventDefault()} onClick={() => { setWorkspaceQuery(term); setSearchSuggestionsOpen(false); rememberSearch(term); }}><strong>{term}</strong><span>Recent search</span></button>)}
                    </>}
                    {searchSuggestionsLoading ? <div className="department-search-loading" role="status"><LoaderCircle size={14} aria-hidden="true" /> Finding matching operations…</div> : searchSuggestions.map((booking, index) => (
                      <button
                        key={`suggestion-${booking.id}-${index}`}
                        id={`department-search-suggestion-${index}`}
                        type="button"
                        role="option"
                        aria-selected={index === activeSuggestionIndex}
                        className={`department-search-suggestion${index === activeSuggestionIndex ? " active" : ""}`}
                        onMouseDown={event => event.preventDefault()}
                        onMouseEnter={() => setActiveSuggestionIndex(index)}
                        onClick={() => selectSuggestion(booking)}
                      >
                        <strong>{highlightQuery(booking.id)}</strong>
                        <span>{highlightQuery(`${booking.client} · ${booking.project}`)}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <select value={priorityFilter} onChange={event => setPriorityFilter(event.target.value as "all" | Booking["priority"])} aria-label="Filter by priority">
                <option value="all">All priorities</option>
                <option value="High">High priority</option>
                <option value="Standard">Standard priority</option>
              </select>
              <select value={readinessFilter} onChange={event => setReadinessFilter(event.target.value as "all" | "ready" | "action")} aria-label="Filter by readiness">
                <option value="all">All readiness</option>
                <option value="ready">Ready to act</option>
                <option value="action">Needs action</option>
              </select>
              <span className="department-filter-result" aria-live="polite">{visibleQueue.length} of {queue.length} dossiers</span>
            </div>
            <div className="compliance-list">
              {visibleQueue.length ? (
                visibleQueue.map((booking, index) => {
                  const parallelDone = config.parallelCode
                    ? completedWorkstreams[booking.id]?.includes(
                        config.parallelCode
                      )
                    : false;
                  const nextStage = nextStageFor(booking);
                  const allParallelDone = PARALLEL_WORKSTREAMS.every(code =>
                    completedWorkstreams[booking.id]?.includes(code)
                  );
                  const canSubmitDocs =
                    config.secondaryNextStage === "All Docs Submitted" &&
                    allParallelDone;
                  return (
                    <div className="department-queue-row" key={`department-queue-${booking.id}-${index}`}>
                      <button
                        className="compliance-row"
                        onClick={() => setDetail(booking)}
                        style={{
                          flex: 1,
                          textAlign: "left",
                          background: "transparent",
                          border: 0,
                          color: "inherit",
                        }}
                      >
                        <div>
                          <div className="compliance-name">
                            {booking.id} · {booking.client}
                          </div>
                          <div className="compliance-sub">
                            {booking.crane} · {booking.site} ·{" "}
                            {booking.priority}
                            {config.parallelCode
                              ? ` · ${parallelDone ? "Workstream complete" : "Evidence required"}`
                              : ""}
                          </div>
                        </div>
                        <div
                          style={{
                            display: "flex",
                            gap: 8,
                            alignItems: "center",
                          }}
                        >
                          <span className="status-badge gray">
                            {booking.progress}%
                          </span>
                          <ArrowRight size={14} color="#777" />
                        </div>
                      </button>
                      {config.readOnly ? (
                        <span className="status-badge blue">
                          Review checklist
                        </span>
                      ) : config.parallelCode ? (
                        <button
                          className="secondary-button compact-button"
                          disabled={parallelDone}
                          onClick={() => onCompleteWorkstream(booking, config)}
                        >
                          {parallelDone
                            ? "Workstream complete"
                            : config.actionLabel}
                        </button>
                      ) : nextStage ? (
                        <button
                          className="secondary-button compact-button"
                          disabled={
                            config.secondaryNextStage ===
                              "All Docs Submitted" && !canSubmitDocs
                          }
                          onClick={() => onAdvance(booking, config)}
                        >
                          {config.secondaryNextStage === "All Docs Submitted" &&
                          !canSubmitDocs
                            ? "Awaiting all departments"
                            : booking.stage === config.secondaryStage
                              ? config.secondaryActionLabel
                              : config.actionLabel}
                        </button>
                      ) : (
                        <span className="status-badge blue">
                          Review checklist
                        </span>
                      )}
                    </div>
                  );
                })
              ) : (
                <div className="empty-state">
                  {queue.length ? "No dossiers match the selected search and filters." : "No dossiers are waiting at this stage gate."}
                </div>
              )}
            </div>
          </div>
        </div>
        <div className="panel">
          <div className="panel-header">
            <div className="panel-title">Working procedure</div>
            <ShieldCheck size={15} color="#138a43" />
          </div>
          <div className="panel-body">
            <div className="department-checklist">
              {config.checklist.map((item, index) => (
                <div className="department-checklist-row" key={item}>
                  <span>{index + 1}</span>
                  <div>
                    <strong>{item}</strong>
                    <small>
                      Evidence remains attached to the booking dossier.
                    </small>
                  </div>
                </div>
              ))}
            </div>
            <div className="notification" style={{ marginTop: 14 }}>
              <div className="title">
                {config.readOnly ? "Oversight rule" : "Flawless handoff rule"}
              </div>
              <div className="body">
                {config.readOnly
                  ? "Administrators monitor the workflow and manage supervisors; stage actions remain with the owning department."
                  : config.parallelCode
                    ? `When this workstream is complete, Documentation receives a persisted notification. All ${PARALLEL_WORKSTREAMS.length} parallel workstreams must be complete before All Docs Submitted.`
                    : `When the checklist is complete, the dossier advances to ${config.nextStage ?? config.secondaryNextStage ?? "the supervisor review queue"}; the next department receives a persisted notification.`}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function DepartmentWorkspaceControls({
  dashboard,
  config,
  canManage,
  canArchiveWorkflows,
  showWorkflow,
}: {
  dashboard: { code: string; name: string };
  config: DepartmentDashboardConfig;
  canManage: boolean;
  canArchiveWorkflows: boolean;
  showWorkflow: boolean;
}) {
  const utils = trpc.useUtils();
  const workflowInput = useMemo(() => ({ departmentCode: dashboard.code }), [dashboard.code]);
  const templatesQuery = trpc.departments.listWorkflowTemplates.useQuery(workflowInput);
  const updateConfig = trpc.departments.updateDashboardConfig.useMutation();
  const createWorkflow = trpc.departments.createWorkflowTemplate.useMutation();
  const setWorkflowActive = trpc.departments.setWorkflowTemplateActive.useMutation();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [templateOpen, setTemplateOpen] = useState(false);
  const [overviewLabel, setOverviewLabel] = useState(config.overviewLabel);
  const [objective, setObjective] = useState(config.objective);
  const [widgets, setWidgets] = useState<DepartmentDashboardWidget[]>(config.widgets);
  const [metrics, setMetrics] = useState<[DepartmentDashboardMetric, DepartmentDashboardMetric]>(config.metrics);
  const [templateName, setTemplateName] = useState("");
  const [templateDescription, setTemplateDescription] = useState("");
  const [checklist, setChecklist] = useState<WorkflowChecklistItem[]>(() => defaultWorkflowChecklist(config.workstream));

  useEffect(() => {
    setOverviewLabel(config.overviewLabel);
    setObjective(config.objective);
    setWidgets(config.widgets);
    setMetrics(config.metrics);
    setChecklist(defaultWorkflowChecklist(config.workstream));
  }, [config]);

  const toggleWidget = (widget: DepartmentDashboardWidget) => {
    setWidgets(current => current.includes(widget) ? current.filter(item => item !== widget) : [...current, widget]);
  };
  const saveConfig = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    try {
      await updateConfig.mutateAsync({ code: dashboard.code, overviewLabel, objective, widgets, metrics });
      await utils.departments.listProvisioned.invalidate();
      toast.success("Dashboard widgets saved", { description: `${dashboard.name} now uses the selected metric and widget layout.` });
      setSettingsOpen(false);
    } catch (error) {
      toast.error("Dashboard configuration could not be saved", { description: error instanceof Error ? error.message : "Review the workspace settings and try again." });
    }
  };
  const createTemplate = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    try {
      await createWorkflow.mutateAsync({ departmentCode: dashboard.code, name: templateName, description: templateDescription, checklist });
      await utils.departments.listWorkflowTemplates.invalidate(workflowInput);
      setTemplateName("");
      setTemplateDescription("");
      setChecklist(defaultWorkflowChecklist(config.workstream));
      setTemplateOpen(false);
      toast.success("Workflow template created", { description: "The required document checklist is now available to this department." });
    } catch (error) {
      toast.error("Workflow template could not be created", { description: error instanceof Error ? error.message : "Review the checklist and try again." });
    }
  };
  const setTemplateStatus = async (id: string, active: boolean) => {
    try {
      await setWorkflowActive.mutateAsync({ id, departmentCode: dashboard.code, active });
      await utils.departments.listWorkflowTemplates.invalidate(workflowInput);
      toast.success(active ? "Workflow restored" : "Workflow archived", { description: "Workflow history has been retained." });
    } catch (error) {
      toast.error("Workflow status could not be updated", { description: error instanceof Error ? error.message : "Please try again." });
    }
  };
  const metricOptions: Array<{ value: DepartmentDashboardMetric; label: string }> = [
    { value: "active_dossiers", label: "Active dossiers" }, { value: "priority_dossiers", label: "Priority dossiers" }, { value: "assigned_team", label: "Assigned team" }, { value: "total_dossiers", label: "Total dossiers" },
  ];

  return <>
    <section className="panel department-workspace-controls" style={{ marginTop: 16 }}>
      <div className="panel-header"><div><div className="panel-title"><Settings size={16} /> Workspace configuration</div><div className="panel-meta">{canManage ? "Select the dashboard widgets and metric emphasis most useful for this department." : "This workspace’s widgets are configured by its supervisor or an administrator."}</div></div>{canManage && <button className="secondary-button compact-button" type="button" onClick={() => setSettingsOpen(open => !open)}>{settingsOpen ? "Close settings" : "Edit widgets"}</button>}</div>
      {settingsOpen && canManage && <form className="panel-body department-config-form" onSubmit={saveConfig}>
        <label className="wide"><span>Workspace title</span><input className="form-input" value={overviewLabel} onChange={event => setOverviewLabel(event.target.value)} minLength={3} maxLength={160} required /></label>
        <label className="wide"><span>Operational objective</span><textarea className="form-textarea" value={objective} onChange={event => setObjective(event.target.value)} minLength={12} maxLength={600} required /></label>
        <div className="wide"><span className="department-control-label">Visible widgets</span><div className="department-widget-options">{DEPARTMENT_DASHBOARD_WIDGETS.map(widget => <label key={widget}><input type="checkbox" checked={widgets.includes(widget)} onChange={() => toggleWidget(widget)} /><span>{widget.replaceAll("_", " ")}</span></label>)}</div></div>
        <label><span>Primary metric</span><select className="form-select" value={metrics[0]} onChange={event => setMetrics([event.target.value as DepartmentDashboardMetric, metrics[1]])}>{metricOptions.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
        <label><span>Secondary metric</span><select className="form-select" value={metrics[1]} onChange={event => setMetrics([metrics[0], event.target.value as DepartmentDashboardMetric])}>{metricOptions.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
        <button className="primary-button" type="submit" disabled={updateConfig.isPending || !widgets.length}>{updateConfig.isPending ? "Saving widgets…" : "Save workspace layout"}</button>
      </form>}
    </section>
    {showWorkflow && <section className="panel department-workflow-library" style={{ marginTop: 16 }}><div className="panel-header"><div><div className="panel-title"><FileText size={16} /> Workflow templates & document checklists</div><div className="panel-meta">Standardise required evidence and assigned-user guidance before work begins.</div></div>{canManage && <button className="secondary-button compact-button" type="button" onClick={() => setTemplateOpen(open => !open)}><Plus size={13} /> {templateOpen ? "Close editor" : "New template"}</button>}</div>
      {templateOpen && canManage && <form className="panel-body department-config-form" onSubmit={createTemplate}><label><span>Template name</span><input className="form-input" value={templateName} onChange={event => setTemplateName(event.target.value)} placeholder="e.g. Standard mobilisation pack" minLength={3} maxLength={160} required /></label><label><span>Purpose</span><input className="form-input" value={templateDescription} onChange={event => setTemplateDescription(event.target.value)} placeholder="When should this checklist be used?" minLength={12} maxLength={800} required /></label><div className="wide"><span className="department-control-label">Required document checklist</span><div className="workflow-checklist-editor">{checklist.map((item, index) => <div key={item.id} className="workflow-checklist-row"><input className="form-input" value={item.label} onChange={event => setChecklist(current => current.map((entry, entryIndex) => entryIndex === index ? { ...entry, label: event.target.value } : entry))} aria-label={`Checklist item ${index + 1}`} /><label className="workflow-required"><input type="checkbox" checked={item.required} onChange={event => setChecklist(current => current.map((entry, entryIndex) => entryIndex === index ? { ...entry, required: event.target.checked } : entry))} /> Required</label><button className="icon-action-button danger" type="button" onClick={() => setChecklist(current => current.length > 1 ? current.filter((_, entryIndex) => entryIndex !== index) : current)} aria-label={`Remove ${item.label}`}><X size={14} /></button></div>)}<button className="secondary-button compact-button" type="button" onClick={() => setChecklist(current => [...current, { id: `custom-${Date.now()}`, label: "New required document", category: "Department", required: true, guidance: "Confirm and attach this document before handoff." }])}><Plus size={13} /> Add checklist item</button></div></div><button className="primary-button" type="submit" disabled={createWorkflow.isPending || !checklist.length}>{createWorkflow.isPending ? "Creating workflow…" : "Create workflow template"}</button></form>}
      <div className="panel-body workflow-template-list">{templatesQuery.isLoading ? <div className="empty-state">Loading workflow templates…</div> : templatesQuery.data?.length ? templatesQuery.data.map(template => { const items = Array.isArray(template.checklist) ? template.checklist as WorkflowChecklistItem[] : []; return <article className={`workflow-template-card ${template.active !== 1 ? "archived" : ""}`} key={template.id}><div className="workflow-template-heading"><div><strong>{template.name}</strong><p>{template.description}</p></div><span className={`status-badge ${template.active === 1 ? "green" : "gray"}`}>{template.active === 1 ? "Active" : "Archived"}</span></div><ul>{items.map(item => <li key={item.id}><Check size={13} />{item.label}{item.required && <span>Required</span>}</li>)}</ul>{canManage && <div className="workflow-template-actions"><button className="secondary-button compact-button" type="button" onClick={() => setChecklist(items.length ? items : defaultWorkflowChecklist(config.workstream))}>Use checklist as a starting point</button>{canArchiveWorkflows && <button className="secondary-button compact-button" type="button" onClick={() => void setTemplateStatus(template.id, template.active !== 1)} disabled={setWorkflowActive.isPending}>{template.active === 1 ? "Archive" : "Restore"}</button>}</div>}</article>; }) : <div className="empty-state">No department workflow templates yet. {canManage ? "Create one to standardise document checks and handoffs." : "Your supervisor can add a template when the department is ready."}</div>}</div>
    </section>}
  </>;
}

export function ProvisionedDepartmentDashboard({
  dashboard,
  bookings,
  canManageTeam,
  canArchiveWorkflows,
  onOpenDossier,
  onManageTeam,
}: {
  dashboard: {
    code: string;
    name: string;
    description: string;
    accent: string;
    dashboardConfig: unknown;
  };
  bookings: Booking[];
  canManageTeam: boolean;
  canArchiveWorkflows: boolean;
  onOpenDossier: (booking: Booking) => void;
  onManageTeam: () => void;
}) {
  const membersQuery = trpc.auth.listUsers.useQuery();
  const config = useMemo(
    () => normalizeDepartmentDashboardConfig(dashboard.dashboardConfig, { name: dashboard.name }),
    [dashboard.dashboardConfig, dashboard.name]
  );
  const activeBookings = bookings.filter((booking) => booking.stage !== "Dispatched");
  const priorityBookings = activeBookings.filter((booking) => booking.priority === "Critical" || booking.priority === "High");
  const departmentMembers = (membersQuery.data ?? []).filter((member) => member.departmentCode === dashboard.code && member.isActive === 1);
  const accentMap: Record<string, string> = { orange: "#d94c12", blue: "#0a66c2", green: "#137a4b", violet: "#6d4ac6" };
  const accent = accentMap[dashboard.accent] ?? accentMap.orange;
  const firstDossier = activeBookings[0] ?? bookings[0];
  const metricValue: Record<DepartmentDashboardMetric, { value: string; foot: string }> = {
    active_dossiers: { value: String(activeBookings.length), foot: "Across active BOB dossiers" },
    priority_dossiers: { value: String(priorityBookings.length), foot: "Priority actions need attention" },
    assigned_team: { value: String(departmentMembers.length), foot: "Named accounts assigned here" },
    total_dossiers: { value: String(bookings.length), foot: "All visible BOB dossiers" },
  };
  const metricLabels: Record<DepartmentDashboardMetric, string> = { active_dossiers: config.primaryMetricLabel, priority_dossiers: config.secondaryMetricLabel, assigned_team: "Active department team", total_dossiers: "Total dossiers" };
  const primaryMetric = config.metrics[0];
  const secondaryMetric = config.metrics[1];
  const visibleWidgets = new Set(config.widgets);
  return <div className="content" data-testid="provisioned-department-dashboard">
    <div className="page-heading" style={{ borderLeft: `4px solid ${accent}`, paddingLeft: 16 }}><div><div className="eyebrow">Provisioned department workspace</div><h1 className="page-title">{dashboard.name}</h1><p className="page-copy">{dashboard.description}</p></div><div className="status-badge blue"><LayoutDashboard size={12} /> Dedicated dashboard</div></div>
    <div className="metric-grid"><MetricCard label={metricLabels[primaryMetric]} value={metricValue[primaryMetric].value} foot={metricValue[primaryMetric].foot} icon={<ClipboardCheck size={13} />} tone="green" /><MetricCard label={metricLabels[secondaryMetric]} value={metricValue[secondaryMetric].value} foot={metricValue[secondaryMetric].foot} icon={<AlertTriangle size={13} />} tone="red" /><MetricCard label="Active department team" value={String(departmentMembers.length)} foot="Named accounts assigned here" icon={<Users size={13} />} tone="green" /><MetricCard label="Workspace status" value="Ready" foot="Dashboard provisioned and isolated" icon={<CheckCircle2 size={13} />} tone="green" /></div>
    <div className="detail-grid">{visibleWidgets.has("team_readiness") && <section className="panel"><div className="panel-header"><div><div className="panel-title">{config.overviewLabel}</div><div className="panel-meta">{config.objective}</div></div><span className="status-badge amber">{config.workstream}</span></div><div className="panel-body"><div className="notification"><div className="title">Controlled department access</div><div className="body">This dashboard is linked to the <strong>{dashboard.code}</strong> department code. Only its assigned users, supervisor, and administrators can open this workspace.</div></div><div className="workflow-actions" style={{ marginTop: 16 }}><button className="primary-button" type="button" onClick={() => firstDossier && onOpenDossier(firstDossier)} disabled={!firstDossier}><ClipboardCheck size={14} /> {config.quickActions[0]}</button><button className="secondary-button" type="button" onClick={onManageTeam} disabled={!canManageTeam}><Users size={14} /> {canManageTeam ? config.quickActions[1] : "Supervisor access required"}</button></div></div></section>}{visibleWidgets.has("handoff_queue") && <section className="panel"><div className="panel-header"><div><div className="panel-title">Department handoff queue</div><div className="panel-meta">Dossiers are shared with the department’s configured operational focus.</div></div><span className="status-badge blue">{activeBookings.length} active</span></div><div className="panel-body activity-list">{activeBookings.slice(0, 4).map((booking, index) => <button className="activity-row" type="button" key={`handoff-${booking.id}-${index}`} onClick={() => onOpenDossier(booking)}><div className="activity-icon" style={{ color: accent }}><ClipboardCheck size={14} /></div><div className="activity-copy"><div><strong>{booking.id}</strong><span className="activity-action">{booking.client}</span></div><p>{booking.project} · {booking.stage}</p></div><span className="status-badge gray">{booking.priority}</span></button>)}{!activeBookings.length && <div className="empty-state">No active dossiers are currently awaiting this department’s attention.</div>}</div></section>}</div>
    <DepartmentWorkspaceControls dashboard={dashboard} config={config} canManage={canManageTeam} canArchiveWorkflows={canArchiveWorkflows} showWorkflow={visibleWidgets.has("workflow_library")} />
  </div>;
}

