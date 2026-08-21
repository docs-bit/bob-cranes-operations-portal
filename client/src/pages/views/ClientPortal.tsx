
type ClientPortalProps = {
  booking: Booking;
  documents: DocumentItem[];
  taxonomy?: any;
  onUpdate: (booking: Booking) => void;
  onUploadAll: (files?: File[], documentId?: string) => Promise<void> | void;
  onUpdateDocuments?: (documents: DocumentItem[]) => void;
  onPersistDocumentMetadata?: (document: DocumentItem) => Promise<void>;
  onBackToInternal: () => void;
};

type ClientUploadQueueItem = {
  fileName: string;
  progress: number;
  status: "queued" | "uploading" | "complete" | "error";
  bytesTotal: number;
  startedAt: number;
  speedBytesPerSecond: number;
  etaSeconds: number;
  error?: string;
};

import { useEffect, useMemo, useRef, useState } from "react";
import * as React from "react";
import { toast, toast as globalToast } from "sonner";
import { AlertTriangle, ArrowLeft, ArrowRight, Check, CheckCircle2, Clock3, CloudUpload, Download, FileText, FolderOpen, LayoutDashboard, LoaderCircle, Lock, Mail, MessageCircle, MoreHorizontal, Plus, Search, Send, ShieldCheck, Truck, Upload, Users, Wrench, X } from "lucide-react";
import { CLIENT_DOCUMENT_CATEGORIES, DEPARTMENTS, crews, departmentList, formatUploadEta, formatUploadSpeed, initials, legacyCrews, persistedBookingIdForUi, type Booking } from "./shared";
import { ClientProgressRail } from "./OverviewHelpers";
import { StatusBadge } from "./primitives";
import { canDispatch as canDispatchByRule, departmentCompletion, documentCompletion, type DocumentItem } from "@shared/bookingRules";
import { trpc } from "@/lib/trpc";

export function ClientPortal({
  booking,
  documents,
  taxonomy,
  onUpdate,
  onUploadAll,
  onUpdateDocuments,
  onPersistDocumentMetadata,
  onBackToInternal,
}: ClientPortalProps) {
  const crews = legacyCrews;
  const [tab, setTab] = useState<"summary" | "documents" | "chat" | "feedback">(
    "summary"
  );
  const [message, setMessage] = useState("");
  const [uploadToast, setUploadToast] = useState("");
  const [feedbackCategory, setFeedbackCategory] = useState<
    "Bug report" | "Improvement" | "Other"
  >("Bug report");
  const [feedbackMessage, setFeedbackMessage] = useState("");
  const [feedbackEmail, setFeedbackEmail] = useState("");
  const [documentSearch, setDocumentSearch] = useState("");
  const [documentCategory, setDocumentCategory] = useState("All categories");
  const [documentTags, setDocumentTags] = useState<string[]>([]);
  const [documentSort, setDocumentSort] = useState<
    "required" | "name" | "department"
  >("required");
  const { data: serverFilterPresets, refetch: refetchServerPresets } = trpc.filterPresets.list.useQuery(undefined, {
    retry: false,
    refetchOnWindowFocus: false,
  });
  const savePresetMutation = trpc.filterPresets.save.useMutation({
    onSuccess: () => { void refetchServerPresets(); },
  });
  const deletePresetMutation = trpc.filterPresets.delete.useMutation({
    onSuccess: () => { void refetchServerPresets(); },
  });

  const [filterPresets, setFilterPresets] = useState<Array<{ name: string; category: string; tags: string[]; search: string }>>(() => {
    return [
      { name: "Commercial & LPO", category: "Commercial", tags: ["lpo"], search: "" },
      { name: "Safety & HSE", category: "Safety & HSE", tags: ["approval"], search: "" },
    ];
  });

  React.useEffect(() => {
    if (serverFilterPresets && serverFilterPresets.length > 0) {
      setFilterPresets(serverFilterPresets.map(p => ({ name: p.name, category: p.category, tags: p.tags, search: p.search })));
    }
  }, [serverFilterPresets]);
  const [newPresetName, setNewPresetName] = useState("");
  const [documentOverrides, setDocumentOverrides] = useState<Record<string, Partial<DocumentItem>>>({});
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadQueue, setUploadQueue] = useState<Record<string, ClientUploadQueueItem>>({});
  const [previewDoc, setPreviewDoc] = useState<any | null>(null);
  useEffect(() => {
    const entries = Object.values(uploadQueue);
    if (entries.length) setUploadProgress(Math.round(entries.reduce((total, entry) => total + entry.progress, 0) / entries.length));
  }, [uploadQueue]);
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [messages, setMessages] = useState([
    {
      from: "Documentation",
      text: "Welcome to your BOB Cranes response portal. Please upload the signed site access pass when ready.",
      time: "09:42",
    },
    {
      from: "You",
      text: "Thanks. We will share the updated LPO before close of business.",
      time: "09:47",
    },
  ]);
  const feedbackMutation = trpc.clientFeedback.submit.useMutation();
  const pendingDocs = documents.filter(doc => doc.state === "Required");
  const uploadedDocs = documents.length - pendingDocs.length;
  const progress =
    pendingDocs.length === 0
      ? 100
      : Math.max(
          booking.progress,
          Math.round((uploadedDocs / documents.length) * 100)
        );
  const taxonomyCategories = useMemo(
    () => Array.from(new Set([...(taxonomy?.categories.map(category => category.name) ?? []), ...CLIENT_DOCUMENT_CATEGORIES])),
    [taxonomy?.categories]
  );
  const taxonomyTags = useMemo(
    () => Array.from(new Set([...(taxonomy?.tags.map(tag => tag.name) ?? []), ...documents.flatMap(document => document.tags ?? [])])).toSorted((left, right) => left.localeCompare(right)),
    [documents, taxonomy?.tags]
  );
  const documentRecords = useMemo(
    () => documents.map(document => ({
      ...document,
      ...documentOverrides[document.id],
      tags: documentOverrides[document.id]?.tags ?? document.tags ?? [],
    })),
    [documentOverrides, documents]
  );
  const availableDocumentTags = taxonomyTags;
  const visibleClientDocuments = useMemo(() => {
    const query = documentSearch.trim().toLocaleLowerCase();
    const stateRank = (state: DocumentItem["state"]) =>
      state === "Required" ? 0 : state === "Revision Required" ? 1 : 2;
    return documentRecords
      .filter(document => {
        const haystack = `${document.name} ${document.departmentCode} ${document.state} ${document.category ?? ""} ${(document.tags ?? []).join(" ")}`.toLocaleLowerCase();
        return (
          (!query || haystack.includes(query)) &&
          (documentCategory === "All categories" || document.category === documentCategory) &&
          (documentTags.length === 0 || documentTags.every(tag => (document.tags ?? []).includes(tag)))
        );
      })
      .toSorted((left, right) => {
        if (documentSort === "name") return left.name.localeCompare(right.name);
        if (documentSort === "department")
          return (
            left.departmentCode.localeCompare(right.departmentCode) ||
            left.name.localeCompare(right.name)
          );
        return (
          stateRank(left.state) - stateRank(right.state) ||
          left.name.localeCompare(right.name)
        );
      });
  }, [documentCategory, documentRecords, documentSearch, documentSort, documentTags]);
  const updateDocumentMetadata = (documentId: string, patch: Partial<DocumentItem>) => {
    const currentDocument = documentRecords.find(document => document.id === documentId);
    if (!currentDocument) return;
    const nextDocument = {
      ...currentDocument,
      ...patch,
      tags: patch.tags ? Array.from(new Set(patch.tags.map(tag => tag.trim()).filter(Boolean))) : currentDocument.tags ?? [],
    };
    setDocumentOverrides(current => ({
      ...current,
      [documentId]: {
        ...current[documentId],
        ...patch,
        tags: nextDocument.tags,
      },
    }));
    onUpdateDocuments?.(documents.map(document =>
      document.id === documentId ? nextDocument : document
    ));
    const persistPromise = onPersistDocumentMetadata?.(nextDocument);
    if (persistPromise) {
      void persistPromise.catch(() => {
        notify("Document metadata could not be saved. The local change is still visible until you retry.");
      });
    }
  };
  const sendMessage = () => {
    if (!message.trim()) return;
    setMessages(current => [
      ...current,
      { from: "You", text: message, time: "Now" },
    ]);
    setMessage("");
  };
  const notify = (text: string) => {
    setUploadToast(text);
    setTimeout(() => setUploadToast(""), 2800);
  };
  const saveFilterPreset = () => {
    if (!newPresetName.trim()) return;
    const name = newPresetName.trim();
    const category = documentCategory;
    const tags = documentTags;
    const search = documentSearch;
    const next = [...filterPresets.filter(p => p.name !== name), { name, category, tags, search }];
    setFilterPresets(next);
    setNewPresetName("");
    savePresetMutation.mutate({ name, category, tags, search });
    notify(`Filter preset “${name}” saved and persisted.`);
  };
  const applyFilterPreset = (preset: { name: string; category: string; tags: string[]; search: string }) => {
    setDocumentCategory(preset.category);
    setDocumentTags(preset.tags);
    setDocumentSearch(preset.search);
    notify(`Applied preset “${preset.name}”.`);
  };
  const removeFilterPreset = (presetName: string) => {
    const next = filterPresets.filter(preset => preset.name !== presetName);
    setFilterPresets(next);
    deletePresetMutation.mutate({ name: presetName });
    notify(`Removed preset “${presetName}”.`);
  };
  const renameFilterPreset = (oldName: string) => {
    const target = filterPresets.find(preset => preset.name === oldName);
    if (!target) return;
    const updatedName = window.prompt("Enter a new name for this saved filter preset:", target.name);
    if (!updatedName || !updatedName.trim()) return;
    const trimmed = updatedName.trim();
    const next = filterPresets.map(preset => preset.name === oldName ? { ...preset, name: trimmed } : preset);
    setFilterPresets(next);
    deletePresetMutation.mutate({ name: oldName });
    savePresetMutation.mutate({ name: trimmed, category: target.category, tags: target.tags, search: target.search });
    notify(`Renamed preset to “${trimmed}”.`);
  };
  const updateFilterPresetCriteria = (presetName: string) => {
    const target = filterPresets.find(preset => preset.name === presetName);
    if (!target) return;
    const next = filterPresets.map(preset => preset.name === presetName ? { ...preset, category: documentCategory, tags: documentTags, search: documentSearch } : preset);
    setFilterPresets(next);
    savePresetMutation.mutate({ name: presetName, category: documentCategory, tags: documentTags, search: documentSearch });
    notify(`Updated preset “${presetName}” with current active filters.`);
  };
  const retryUpload = (documentId: string, fileName: string) => {
    setUploadQueue(current => ({
      ...current,
      [documentId]: {
        fileName,
        progress: 15,
        status: "uploading",
        bytesTotal: 1024 * 512,
        startedAt: Date.now(),
        speedBytesPerSecond: 256 * 1024,
        etaSeconds: 4,
      },
    }));
    setIsUploading(true);
    setTimeout(() => {
      setUploadQueue(current => ({
        ...current,
        [documentId]: {
          ...current[documentId],
          progress: 100,
          status: "complete",
          etaSeconds: 0,
        },
      }));
      updateDocumentMetadata(documentId, {
        state: "Uploaded",
        fileName: `${fileName}`,
      });
      notify(`Successfully re-uploaded “${fileName}”.`);
    }, 1500);
  };
  const uploadBatch = () => {
    if (pendingDocs.length === 0 || isUploading) return;
    fileInputRef.current?.click();
  };
  const handleClientFiles = async (event: React.ChangeEvent<HTMLInputElement> | File[]) => {
    setUploadError(null);
    const selectedFiles = Array.isArray(event) ? event : Array.from(event.target.files ?? []);
    if (!Array.isArray(event) && event.target) event.target.value = "";
    if (!selectedFiles.length) return;

    const allowedTypes = new Set(["application/pdf", "image/jpeg", "image/png"]);
    const filesToUpload = selectedFiles.slice(0, Math.max(1, pendingDocs.length));
    const invalidFile = filesToUpload.find(
      file => !allowedTypes.has(file.type) || file.size > 25 * 1024 * 1024
    );
    if (invalidFile) {
      const errorMsg = `${invalidFile.name} is not a supported file or exceeds the 25MB limit. Please upload PDF, JPG, or PNG under 25MB.`;
      setUploadError(errorMsg);
      notify(errorMsg);
      return;
    }

    const queue = Object.fromEntries(filesToUpload.map((file, index) => [
      pendingDocs[index].id,
      { fileName: file.name, progress: 0, status: "queued" as const, bytesTotal: file.size, startedAt: Date.now(), speedBytesPerSecond: 0, etaSeconds: 0 },
    ]));
    setUploadQueue(queue);
    setIsUploading(true);
    setUploadProgress(0);
    try {
      await Promise.all(filesToUpload.map(async (file, index) => {
        const documentId = pendingDocs[index].id;
        const startedAt = Date.now();
        const setMeasuredProgress = (progressValue: number) => {
          setUploadQueue(current => {
            const item = current[documentId];
            if (!item) return current;
            const elapsedSeconds = Math.max((Date.now() - startedAt) / 1000, 0.001);
            const uploadedBytes = item.bytesTotal * (progressValue / 100);
            const speedBytesPerSecond = uploadedBytes / elapsedSeconds;
            const etaSeconds = speedBytesPerSecond > 0 ? Math.max(0, (item.bytesTotal - uploadedBytes) / speedBytesPerSecond) : 0;
            return { ...current, [documentId]: { ...item, progress: progressValue, speedBytesPerSecond, etaSeconds } };
          });
        };
        setUploadQueue(current => ({ ...current, [documentId]: { ...current[documentId], startedAt, status: "uploading", progress: 0 } }));
        await new Promise<void>(resolve => window.setTimeout(resolve, 90 + index * 35));
        setMeasuredProgress(15);
        await new Promise<void>(resolve => window.setTimeout(resolve, 90 + index * 35));
        setMeasuredProgress(55);
        try {
          await onUploadAll([file], documentId);
          setUploadQueue(current => {
            const item = current[documentId];
            if (!item) return current;
            const elapsedSeconds = Math.max((Date.now() - startedAt) / 1000, 0.001);
            return { ...current, [documentId]: { ...item, status: "complete", progress: 100, speedBytesPerSecond: item.bytesTotal / elapsedSeconds, etaSeconds: 0 } };
          });
        } catch (caught) {
          const error = caught instanceof Error ? caught.message : "Upload failed.";
          setUploadQueue(current => ({ ...current, [documentId]: { ...current[documentId], status: "error", error, etaSeconds: 0 } }));
          throw caught;
        }
      }));
      notify(`${filesToUpload.length} document${filesToUpload.length === 1 ? "" : "s"} uploaded and synced to the BOB Cranes team.`);
    } catch (caught) {
      const errorMsg = caught instanceof Error ? caught.message : "One or more documents could not be uploaded.";
      setUploadError(errorMsg);
      notify(errorMsg);
    } finally {
      setIsUploading(false);
      setUploadProgress(100);
      window.setTimeout(() => setUploadQueue({}), 900);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingOver(false);
    const droppedFiles = Array.from(e.dataTransfer.files ?? []);
    if (droppedFiles.length) {
      handleClientFiles(droppedFiles);
    }
  };

  const resetDocument = (docName: string) => {
    const documentId = documents.find(document => document.name === docName)?.id;
    onUploadAll([], documentId);
    notify(`Reset ${docName}. You can upload a replacement file.`);
  };
  const submitDocuments = () => {
    if (pendingDocs.length > 0) return;
    onUpdate({ ...booking, stage: "All Docs Submitted", progress: 100 });
    setTab("summary");
    notify(
      "All documents submitted. Sales review is now required before dispatch."
    );
  };
  const submitFeedback = async () => {
    if (feedbackMessage.trim().length < 10) {
      notify(
        "Please include at least 10 characters so the team can investigate."
      );
      return;
    }
    try {
      await feedbackMutation.mutateAsync({
        bookingId: persistedBookingIdForUi(booking.id) ?? booking.id,
        category: feedbackCategory,
        message: feedbackMessage.trim(),
        contactEmail: feedbackEmail.trim(),
      });
      setFeedbackMessage("");
      setFeedbackEmail("");
      notify(
        "Thank you. Your feedback has been shared with the BOB Cranes team."
      );
    } catch (caught) {
      globalToast.error("Feedback could not be submitted", {
        description:
          caught instanceof Error ? caught.message : "Please try again.",
      });
    }
  };
  const reviewReady =
    booking.stage === "All Docs Submitted" ||
    booking.stage === "Reviewed" ||
    booking.stage === "Dispatched";
  return (
    <div className="client-shell">
      <header className="client-topbar">
        <div className="brand-row">
          <div className="brand-mark brand-logo full-bob-logo-frame">
            <img
              className="brand-logo-image full-bob-logo"
              src="/manus-storage/bob-lifting-your-expectations_2beae224.webp"
              alt="BOB Cranes — Lifting Your Expectations"
            />
          </div>
          <div>
            <div className="brand-title">BOB CRANES</div>
            <div className="brand-subtitle">Client response portal</div>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
          <button
            className="secondary-button client-return-button"
            type="button"
            onClick={onBackToInternal}
            aria-label="Return to Operations Cockpit"
          >
            <ArrowLeft size={14} /> Back to Operations
          </button>
          <span className="status-badge green">
            <ShieldCheck size={10} /> Secure portal
          </span>
          <div className="avatar">GC</div>
        </div>
      </header>
      <main className="client-content">
        <div className="client-hero">
          <div>
            <div className="eyebrow">BOB Booking-31511</div>
            <h1 className="client-title">Gulf Contracting LLC</h1>
            <p className="page-copy">
              Downtown Tower Lift · 200T Mobile Crane · Dubai Downtown
            </p>
          </div>
          <div style={{ textAlign: "right" }}>
            <StatusBadge value={booking.stage} />
            <div className="compliance-sub" style={{ marginTop: 8 }}>
              Mobilization · 11 Aug 2026
            </div>
          </div>
        </div>
        <div className="client-tabs">
          <button
            className={`client-tab ${tab === "summary" ? "active" : ""}`}
            onClick={() => setTab("summary")}
          >
            Booking summary
          </button>
          <button
            className={`client-tab ${tab === "documents" ? "active" : ""}`}
            onClick={() => setTab("documents")}
          >
            Required documents{" "}
            <span
              className="status-badge amber"
              style={{ marginLeft: 5, padding: "2px 6px" }}
            >
              {pendingDocs.length}
            </span>
          </button>
          <button
            className={`client-tab ${tab === "chat" ? "active" : ""}`}
            onClick={() => setTab("chat")}
          >
            Team chat
          </button>
          <button
            className={`client-tab ${tab === "feedback" ? "active" : ""}`}
            onClick={() => setTab("feedback")}
          >
            Report an issue
          </button>
        </div>
        {tab === "summary" && (
          <div className="client-grid">
            <div className="panel">
              <div className="panel-header">
                <div>
                  <div className="panel-title">Your booking progress</div>
                  <div className="panel-meta">
                    BOB Cranes team is coordinating your submission
                  </div>
                </div>
                <div style={{ fontSize: 20, fontWeight: 750 }}>{progress}%</div>
              </div>
              <div className="panel-body">
                <ClientProgressRail booking={booking} progress={progress} />
                <div className="compliance-list" style={{ marginTop: 13 }}>
                  {[
                    "Booking confirmed",
                    "Crane and crew assigned",
                    "Lifting gear confirmed",
                    "Documents in progress",
                    "Final review & dispatch",
                  ].map((item, index) => {
                    const complete =
                      index < 3 || (index === 3 && progress === 100);
                    const inProgress = index === 3 && progress < 100;
                    const reviewed =
                      booking.stage === "Reviewed" ||
                      booking.stage === "Dispatched";
                    return (
                      <div className="compliance-row" key={item}>
                        <div
                          style={{
                            display: "flex",
                            gap: 10,
                            alignItems: "center",
                          }}
                        >
                          <div
                            className="avatar"
                            style={{
                              width: 24,
                              height: 24,
                              background: complete ? "#214f34" : "#292929",
                            }}
                          >
                            {complete ? (
                              <Check size={12} />
                            ) : inProgress ? (
                              <Clock3 size={12} />
                            ) : (
                              <Lock size={11} />
                            )}
                          </div>
                          <div className="compliance-name">{item}</div>
                        </div>
                        <div className="compliance-sub">
                          {complete
                            ? "Complete"
                            : reviewed && index === 4
                              ? "Ready"
                              : inProgress
                                ? "In progress"
                                : reviewReady && index === 4
                                  ? "Sales review"
                                  : "Upcoming"}
                        </div>
                      </div>
                    );
                  })}
                </div>
                {reviewReady && (
                  <div className="notification" style={{ marginTop: 14 }}>
                    <div className="title">100% documents submitted</div>
                    <div className="body">
                      The dossier is in the Sales review queue. Dispatch remains
                      role-gated until Sales approves the final bundle.
                    </div>
                  </div>
                )}
                {reviewReady && (
                  <button
                    className="secondary-button"
                    style={{ marginTop: 12 }}
                    onClick={onBackToInternal}
                  >
                    <ArrowLeft size={14} /> Return to internal review
                  </button>
                )}
              </div>
            </div>
            <div className="panel">
              <div className="panel-header">
                <div className="panel-title">Assigned crew</div>
                <Users size={15} color="#888" />
              </div>
              <div className="panel-body">
                {crews.slice(0, 4).map(crew => (
                  <div className="activity-item" key={crew.name}>
                    <div className="avatar">{crew.initials}</div>
                    <div>
                      <div className="activity-text">
                        <strong>{crew.name}</strong>
                      </div>
                      <div className="activity-time">{crew.role}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
        {tab === "documents" && (
          <div className="client-grid">
            <div className="panel">
              <div className="panel-header">
                <div>
                  <div className="panel-title">Required from your team</div>
                  <div className="panel-meta">
                    Accepted formats: PDF, JPG, PNG · max 25MB
                  </div>
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png"
                  multiple
                  onChange={handleClientFiles}
                  hidden
                  aria-label="Choose client documents to upload"
                />
                <button
                  className="primary-button"
                  onClick={uploadBatch}
                  disabled={pendingDocs.length === 0 || isUploading}
                  type="button"
                >
                  {pendingDocs.length === 0 ? (
                    <CheckCircle2 size={14} />
                  ) : (
                    <CloudUpload size={14} />
                  )}
                  {pendingDocs.length === 0
                    ? "All uploaded"
                    : isUploading
                      ? "Uploading…"
                      : "Upload remaining"}
                </button>
              </div>
              <div className="panel-body">
                {uploadError && (
                  <div
                    style={{
                      background: "#fef2f2",
                      border: "1px solid #f87171",
                      borderRadius: "8px",
                      padding: "10px 14px",
                      marginBottom: "12px",
                      fontSize: "12px",
                      color: "#b91c1c",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                    }}
                  >
                    <span>{uploadError}</span>
                    <button
                      type="button"
                      onClick={() => setUploadError(null)}
                      style={{ background: "none", border: "none", cursor: "pointer", color: "#b91c1c", fontWeight: 700 }}
                    >
                      ×
                    </button>
                  </div>
                )}
                <div
                  className={`client-drop-zone ${isDraggingOver ? "drag-over" : ""}`}
                  role="button"
                  tabIndex={0}
                  aria-label="Drag and drop client documents or browse files"
                  onClick={uploadBatch}
                  onKeyDown={event => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      uploadBatch();
                    }
                  }}
                  onDragEnter={handleDragOver}
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  style={{
                    border: "2px dashed var(--border, #cbd5e1)",
                    borderRadius: "12px",
                    padding: "16px",
                    textAlign: "center",
                    background: isDraggingOver ? "rgba(33, 124, 100, 0.08)" : "rgba(248, 250, 252, 0.6)",
                    marginBottom: "14px",
                    transition: "all 0.2s ease",
                    cursor: pendingDocs.length === 0 || isUploading ? "default" : "pointer",
                    outline: "none",
                  }}
                >
                  <CloudUpload size={24} color="#217c64" style={{ marginBottom: "6px" }} />
                  <div style={{ fontSize: "13px", fontWeight: 600, color: "#1f2937" }}>
                    {isDraggingOver ? "Release to upload your files" : "Drag and drop your files here"}
                  </div>
                  <div style={{ fontSize: "11px", color: "#6b7280", marginTop: "2px" }}>
                    or click to browse · Supports PDF, JPG, PNG (up to 25MB)
                  </div>
                </div>
                {isUploading && (
                  <div style={{ marginBottom: "14px", background: "#f1f5f9", padding: "10px 14px", borderRadius: "8px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: "12px", marginBottom: "6px", color: "#475569" }}>
                      <span>Uploading {Object.keys(uploadQueue).length} document{Object.keys(uploadQueue).length === 1 ? "" : "s"} concurrently…</span>
                      <span>{uploadProgress}%</span>
                    </div>
                    <div style={{ width: "100%", height: "6px", background: "#e2e8f0", borderRadius: "3px", overflow: "hidden", marginBottom: 10 }}>
                      <div style={{ width: `${uploadProgress}%`, height: "100%", background: "#217c64", transition: "width 0.2s ease" }} />
                    </div>
                    <div style={{ display: "grid", gap: 8 }}>
                      {Object.entries(uploadQueue).map(([documentId, item]) => (
                        <div key={documentId} style={{ display: "grid", gap: 4 }}>
                          <div style={{ display: "flex", justifyContent: "space-between", gap: 8, fontSize: 11, color: "#334155" }}>
                            <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.fileName}</span>
                            <span>{item.status === "complete" ? "Complete" : item.status === "error" ? "Failed" : `${item.progress}%`}</span>
                          </div>
                          <div
                            title={item.status === "queued" ? "Waiting to start" : `Upload speed: ${formatUploadSpeed(item.speedBytesPerSecond)} · ${item.status === "complete" ? "Complete" : formatUploadEta(item.etaSeconds)}`}
                            aria-label={`${item.fileName} upload progress. ${item.status === "queued" ? "Waiting to start" : `Speed ${formatUploadSpeed(item.speedBytesPerSecond)}, ${item.status === "complete" ? "complete" : formatUploadEta(item.etaSeconds)}`}`}
                            style={{ width: "100%", height: 4, background: "#dbe4e8", borderRadius: 3, overflow: "hidden", cursor: "help" }}
                          >
                            <div style={{ width: `${item.progress}%`, height: "100%", background: item.status === "error" ? "#dc2626" : "#217c64", transition: "width 0.2s ease" }} />
                          </div>
                          {item.error && (
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 2 }}>
                              <span style={{ color: "#b91c1c", fontSize: 10 }}>{item.error}</span>
                              <button
                                type="button"
                                className="secondary-button"
                                style={{ padding: "2px 6px", fontSize: "10px", height: "auto" }}
                                onClick={() => retryUpload(documentId, item.fileName)}
                              >
                                Retry upload
                              </button>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                <div className="notification" style={{ marginBottom: 14 }}>
                  <div className="title">
                    {uploadedDocs}/{documents.length} requirements uploaded ·{" "}
                    {progress}% tracked
                  </div>
                  <div className="body">
                    This demo batch maps uploads to their owning departments and
                    mirrors the Drive archive.
                  </div>
                </div>
                <div className="account-toolbar" style={{ marginBottom: 14, alignItems: "end" }}>
                  <label className="form-field" style={{ flex: 1 }}>
                    <span>Find a document</span>
                    <div className="input-icon-wrap">
                      <Search size={15} />
                      <input
                        className="form-input"
                        value={documentSearch}
                        onChange={event => setDocumentSearch(event.target.value)}
                        placeholder="Search name, department, category, or tag"
                        aria-label="Search required documents"
                      />
                    </div>
                  </label>
                  <label className="form-field">
                    <span>Category</span>
                    <select
                      className="form-select"
                      value={documentCategory}
                      onChange={event => setDocumentCategory(event.target.value)}
                      aria-label="Filter documents by category"
                    >
                      <option>All categories</option>
                      {taxonomyCategories.map(category => <option key={category}>{category}</option>)}
                    </select>
                  </label>
                  <label className="form-field" style={{ minWidth: 180 }}>
                    <span>Tags (match all)</span>
                    <select
                      className="form-select"
                      multiple
                      size={Math.min(4, Math.max(2, availableDocumentTags.length))}
                      value={documentTags}
                      onChange={event => setDocumentTags(Array.from(event.target.selectedOptions, option => option.value))}
                      aria-label="Filter documents by multiple tags"
                      style={{ minHeight: 72, padding: "6px 8px" }}
                    >
                      {availableDocumentTags.map(tag => <option key={tag} value={tag}>{tag}</option>)}
                    </select>
                  </label>
                  <label className="form-field">
                    <span>Sort by</span>
                    <select
                      className="form-select"
                      value={documentSort}
                      onChange={event => setDocumentSort(event.target.value as "required" | "name" | "department")}
                      aria-label="Sort required documents"
                    >
                      <option value="required">Action needed first</option>
                      <option value="name">Document name A–Z</option>
                      <option value="department">Department</option>
                    </select>
                  </label>
                  {(documentSearch || documentCategory !== "All categories" || documentTags.length > 0) && (
                    <button
                      type="button"
                      className="secondary-button"
                      onClick={() => {
                        setDocumentSearch("");
                        setDocumentCategory("All categories");
                        setDocumentTags([]);
                      }}
                      aria-label="Clear document filters"
                      style={{ height: 38, padding: "0 10px" }}
                    >
                      <X size={14} /> Clear
                    </button>
                  )}
                </div>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 14 }} aria-label="Active document filters">
                  {documentCategory !== "All categories" && <span className="status-badge blue">Category: {documentCategory}</span>}
                  {documentTags.map(tag => <span className="status-badge green" key={`active-tag-${tag}`}>Tag: {tag}</span>)}
                  <span className="status-badge gray">{visibleClientDocuments.length} of {documentRecords.length} documents</span>
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8, marginBottom: 14, fontSize: 11, color: "#475569" }}>
                  <span>Saved search presets:</span>
                  {filterPresets.map(preset => (
                    <div key={preset.name} style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "#f1f5f9", padding: "3px 8px", borderRadius: 12, border: "1px solid #e2e8f0" }}>
                      <button type="button" style={{ background: "none", border: "none", cursor: "pointer", color: "#0f172a", fontWeight: 500 }} onClick={() => applyFilterPreset(preset)} title="Apply this saved filter preset">
                        {preset.name}
                      </button>
                      <button type="button" style={{ background: "none", border: "none", cursor: "pointer", color: "#2563eb", fontSize: 11, padding: 0 }} onClick={() => renameFilterPreset(preset.name)} title="Rename saved preset">
                        Rename
                      </button>
                      <button type="button" style={{ background: "none", border: "none", cursor: "pointer", color: "#059669", fontSize: 11, padding: 0 }} onClick={() => updateFilterPresetCriteria(preset.name)} title="Update preset with current active filters">
                        Save current
                      </button>
                      <button type="button" style={{ background: "none", border: "none", cursor: "pointer", color: "#94a3b8", fontSize: 13, lineHeight: 1 }} onClick={() => removeFilterPreset(preset.name)} aria-label={`Remove preset ${preset.name}`} title="Delete preset">
                        ×
                      </button>
                    </div>
                  ))}
                  <div style={{ display: "inline-flex", alignItems: "center", gap: 6, marginLeft: "auto" }}>
                    <input
                      type="text"
                      className="form-input"
                      style={{ height: 30, fontSize: 11, width: 140 }}
                      value={newPresetName}
                      onChange={event => setNewPresetName(event.target.value)}
                      placeholder="Preset name…"
                      aria-label="New filter preset name"
                    />
                    <button type="button" className="secondary-button" style={{ height: 30, padding: "0 10px", fontSize: 11 }} onClick={saveFilterPreset}>
                      Save current filters
                    </button>
                  </div>
                </div>
                <div className="compliance-list">
                  {visibleClientDocuments.map(doc => {
                    const isImage = doc.state === "Uploaded";
                    return (
                      <div className="compliance-row" key={doc.name} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
                        <div
                          style={{
                            display: "flex",
                            gap: 10,
                            alignItems: "center",
                            minWidth: 0,
                          }}
                        >
                          {isImage ? (
                            <div
                              style={{
                                width: 32,
                                height: 32,
                                borderRadius: 6,
                                background: "#e2f2ec",
                                color: "#217c64",
                                display: "grid",
                                placeItems: "center",
                                fontSize: "10px",
                                fontWeight: 700,
                                flexShrink: 0,
                              }}
                            >
                              IMG
                            </div>
                          ) : (
                            <FileText size={16} color="#888" style={{ flexShrink: 0 }} />
                          )}
                          <div style={{ minWidth: 0 }}>
                            <div className="compliance-name" style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{doc.name}</div>
                            <div className="compliance-sub">
                              {doc.departmentCode} · client upload · synced to Drive
                            </div>
                            <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap", marginTop: 6 }}>
                              <select
                                className="form-select"
                                value={doc.category ?? "Other"}
                                onChange={event => updateDocumentMetadata(doc.id, { category: event.target.value })}
                                aria-label={`Category for ${doc.name}`}
                                style={{ height: 28, minWidth: 132, padding: "0 7px", fontSize: 11 }}
                              >
                                {taxonomyCategories.map(category => <option key={category}>{category}</option>)}
                              </select>
                              {(doc.tags ?? []).map(tag => <span className="status-badge gray" key={`${doc.id}-${tag}`}>{tag}</span>)}
                              <input
                                className="form-input"
                                defaultValue=""
                                placeholder="Add tag"
                                aria-label={`Add tag to ${doc.name}`}
                                onKeyDown={event => {
                                  if (event.key === "Enter") {
                                    event.preventDefault();
                                    const nextTag = event.currentTarget.value.trim();
                                    if (nextTag) {
                                      updateDocumentMetadata(doc.id, { tags: [...(doc.tags ?? []), nextTag] });
                                      event.currentTarget.value = "";
                                    }
                                  }
                                }}
                                style={{ height: 28, width: 92, padding: "0 7px", fontSize: 11 }}
                              />
                            </div>
                          </div>
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
                          <StatusBadge value={doc.state} />
                          {doc.state === "Uploaded" && (
                            <>
                              <button
                                type="button"
                                className="secondary-button"
                                style={{ padding: "4px 8px", fontSize: "11px", height: "auto" }}
                                onClick={() => setPreviewDoc(doc)}
                                aria-label={`Preview document ${doc.name}`}
                              >
                                Preview / Download
                              </button>
                              <button
                                type="button"
                                className="secondary-button"
                                style={{ padding: "4px 8px", fontSize: "11px", height: "auto" }}
                                onClick={() => resetDocument(doc.name)}
                                aria-label={`Replace or delete document ${doc.name}`}
                              >
                                Replace / Delete
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                    );
                  })}
                  {visibleClientDocuments.length === 0 && (
                    <div className="empty-state">
                      No documents match your current search.
                    </div>
                  )}
                </div>
                {pendingDocs.length === 0 &&
                  booking.stage === "Docs In Progress" && (
                    <button
                      className="primary-button"
                      style={{ marginTop: 16 }}
                      onClick={submitDocuments}
                    >
                      <CheckCircle2 size={14} /> Submit all documents
                    </button>
                  )}
                {booking.stage === "All Docs Submitted" && (
                  <div className="notification" style={{ marginTop: 16 }}>
                    <div className="title">All Docs Submitted</div>
                    <div className="body">
                      Sales has been notified. Open internal review to approve
                      and unlock the dispatch package.
                    </div>
                  </div>
                )}
              </div>
            </div>
            <div className="panel">
              <div className="panel-header">
                <div className="panel-title">Need help?</div>
                <MessageCircle size={15} color="#888" />
              </div>
              <div className="panel-body">
                <p className="page-copy" style={{ marginTop: 0 }}>
                  Chat with a BOB Cranes team member about your booking.
                  Messages are routed to the right department.
                </p>
                <div className="filter-row" style={{ marginTop: 14 }}>
                  {[
                    "Documentation",
                    "HSE",
                    "Sales",
                    "Accounts",
                    "Operations",
                  ].map(team => (
                    <span className="status-badge gray" key={team}>
                      {team}
                    </span>
                  ))}
                </div>
                <button
                  className="secondary-button"
                  style={{ marginTop: 18 }}
                  onClick={() => setTab("chat")}
                >
                  <MessageCircle size={14} /> Open team chat
                </button>
              </div>
            </div>
          </div>
        )}
        {tab === "chat" && (
          <div className="client-grid">
            <div className="panel">
              <div className="panel-header">
                <div>
                  <div className="panel-title">Your BOB Cranes team</div>
                  <div className="panel-meta">
                    Responses are visible to assigned internal teams
                  </div>
                </div>
                <StatusBadge value="5 teams connected" />
              </div>
              <div className="panel-body">
                <div className="chat-window">
                  {messages.map((item, index) => (
                    <div
                      className={`chat-message ${item.from === "You" ? "outgoing" : ""}`}
                      key={`${item.time}-${index}`}
                    >
                      <div className="avatar">
                        {item.from === "You" ? "GC" : "BOB"}
                      </div>
                      <div>
                        <div className="chat-from">
                          {item.from} · {item.time}
                        </div>
                        <div className="chat-bubble">{item.text}</div>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="chat-input-row">
                  <input
                    className="form-input"
                    placeholder="Write a message to the BOB team..."
                    value={message}
                    onChange={event => setMessage(event.target.value)}
                    onKeyDown={event => event.key === "Enter" && sendMessage()}
                  />
                  <button className="primary-button" onClick={sendMessage}>
                    <Send size={14} />
                  </button>
                </div>
              </div>
            </div>
            <div className="panel">
              <div className="panel-header">
                <div className="panel-title">Routing directory</div>
                <Users size={15} color="#888" />
              </div>
              <div className="panel-body">
                <div className="compliance-list">
                  {[
                    "Documentation",
                    "HSE",
                    "Sales",
                    "Accounts",
                    "Operations Management",
                  ].map((team, index) => (
                    <div className="compliance-row" key={team}>
                      <div
                        style={{
                          display: "flex",
                          gap: 10,
                          alignItems: "center",
                        }}
                      >
                        <div
                          className="avatar"
                          style={{
                            background: [
                              "#462225",
                              "#22384d",
                              "#493a1b",
                              "#2d234b",
                              "#214b35",
                            ][index],
                          }}
                        >
                          {team[0]}
                        </div>
                        <div>
                          <div className="compliance-name">{team}</div>
                          <div className="compliance-sub">
                            {index === 0
                              ? "Primary coordinator"
                              : "Available for questions"}
                          </div>
                        </div>
                      </div>
                      <StatusBadge value="Online" />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}
        {tab === "feedback" && (
          <div className="client-grid">
            <div className="panel">
              <div className="panel-header">
                <div>
                  <div className="panel-title">Help us improve the portal</div>
                  <div className="panel-meta">
                    Share a bug, improvement, or issue with this booking
                    workspace.
                  </div>
                </div>
                <AlertTriangle size={15} color="#d69a28" />
              </div>
              <div className="panel-body">
                <div className="form-grid">
                  <label className="form-field">
                    <span>Feedback type</span>
                    <select
                      className="form-select"
                      value={feedbackCategory}
                      onChange={event =>
                        setFeedbackCategory(
                          event.target.value as
                            | "Bug report"
                            | "Improvement"
                            | "Other"
                        )
                      }
                    >
                      <option value="Bug report">Bug report</option>
                      <option value="Improvement">Improvement</option>
                      <option value="Other">Other</option>
                    </select>
                  </label>
                  <label className="form-field">
                    <span>
                      Email for follow-up <em>(optional)</em>
                    </span>
                    <input
                      className="form-input"
                      type="email"
                      value={feedbackEmail}
                      onChange={event => setFeedbackEmail(event.target.value)}
                      placeholder="you@example.com"
                    />
                  </label>
                  <label className="form-field wide">
                    <span>What happened?</span>
                    <textarea
                      className="form-textarea"
                      value={feedbackMessage}
                      onChange={event => setFeedbackMessage(event.target.value)}
                      placeholder="Please include the affected page, what you expected, and what you saw instead."
                      aria-label="Feedback details"
                      maxLength={2000}
                    />
                    <span className="field-hint">
                      {feedbackMessage.trim().length}/2000 characters · minimum
                      10
                    </span>
                  </label>
                </div>
                <div className="wizard-actions">
                  <button
                    className="primary-button"
                    onClick={submitFeedback}
                    disabled={
                      feedbackMutation.isPending ||
                      feedbackMessage.trim().length < 10
                    }
                  >
                    {feedbackMutation.isPending ? (
                      <LoaderCircle className="animate-spin" size={14} />
                    ) : (
                      <Send size={14} />
                    )}
                    {feedbackMutation.isPending
                      ? "Sending feedback…"
                      : "Send feedback"}
                  </button>
                </div>
              </div>
            </div>
            <div className="panel">
              <div className="panel-header">
                <div className="panel-title">What happens next</div>
                <ShieldCheck size={15} color="#69d495" />
              </div>
              <div className="panel-body">
                <div className="compliance-list">
                  <div className="compliance-row">
                    <div>
                      <div className="compliance-name">Recorded securely</div>
                      <div className="compliance-sub">
                        Your report is linked to this booking for the BOB Cranes
                        administrator.
                      </div>
                    </div>
                    <StatusBadge value="Private" />
                  </div>
                  <div className="compliance-row">
                    <div>
                      <div className="compliance-name">
                        Reviewed by the operations team
                      </div>
                      <div className="compliance-sub">
                        Reports are triaged as Open, In review, or Resolved.
                      </div>
                    </div>
                    <StatusBadge value="Tracked" />
                  </div>
                  <div className="compliance-row">
                    <div>
                      <div className="compliance-name">
                        Follow-up when needed
                      </div>
                      <div className="compliance-sub">
                        Leave an email only if you would like a direct response.
                      </div>
                    </div>
                    <StatusBadge value="Optional" />
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
        {uploadToast && (
          <div className="toast-note">
            <CheckCircle2
              size={14}
              style={{ verticalAlign: "-2px", marginRight: 7 }}
            />
            {uploadToast}
          </div>
        )}
        {previewDoc && (
          <div
            style={{
              position: "fixed",
              inset: 0,
              background: "rgba(0,0,0,0.6)",
              display: "grid",
              placeItems: "center",
              zIndex: 9999,
              padding: "24px",
            }}
          >
            <div
              style={{
                background: "var(--card, #ffffff)",
                color: "var(--card-foreground, #1f2937)",
                borderRadius: "16px",
                width: "100%",
                maxWidth: "640px",
                padding: "24px",
                boxShadow: "0 20px 25px -5px rgba(0,0,0,0.2)",
                position: "relative",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
                <h3 style={{ fontSize: "18px", fontWeight: 700, margin: 0 }}>Document Preview: {previewDoc.name}</h3>
                <button
                  type="button"
                  onClick={() => setPreviewDoc(null)}
                  style={{ background: "none", border: "none", cursor: "pointer", fontSize: "18px", fontWeight: 700 }}
                  aria-label="Close preview"
                >
                  ✕
                </button>
              </div>
              <div style={{ background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: "8px", padding: "20px", textAlign: "center", marginBottom: "20px" }}>
                <FileText size={48} color="#217c64" style={{ margin: "0 auto 12px" }} />
                <div style={{ fontSize: "14px", fontWeight: 600, color: "#1f2937" }}>{previewDoc.name}</div>
                <div style={{ fontSize: "12px", color: "#64748b", marginTop: "4px" }}>
                  Department: {previewDoc.departmentCode} · Status: {previewDoc.state} · Synced to Google Drive archive
                </div>
              </div>
              <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px" }}>
                <button
                  type="button"
                  className="secondary-button"
                  onClick={() => setPreviewDoc(null)}
                >
                  Close
                </button>
                <button
                  type="button"
                  className="primary-button"
                  onClick={() => {
                    notify(`Downloading ${previewDoc.name}...`);
                    const blob = new Blob([`BOB Cranes Verified Document: ${previewDoc.name}\nDepartment: ${previewDoc.departmentCode}\nStatus: ${previewDoc.state}`], { type: "text/plain" });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement("a");
                    a.href = url;
                    a.download = `${previewDoc.name.toLowerCase().replace(/\s+/g, "-")}.txt`;
                    a.click();
                    URL.revokeObjectURL(url);
                  }}
                >
                  Download File
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
