import React, { useEffect, useState } from "react";
import { toast } from "sonner";
import { useLocation } from "wouter";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { type DocumentItem } from "@shared/bookingRules";
import { dateKey, type AttendanceRecord } from "@shared/attendanceRules";
import {
  canAccessWorkspaceView,
  DEPARTMENT_LABEL_TO_CODE,
} from "@shared/departmentAccess";
import { canAccessProvisionedDepartmentDashboard } from "@shared/departmentDashboardRules";
import { useBookingWorkspace } from "./_hooks/useBookingWorkspace";
import { CrewView as CrewAssignmentWorkspace } from "@/components/CrewAssignmentWorkspace";

export const CrewView = CrewAssignmentWorkspace;

import DataUploadCenter, { type UploadMap } from "@/components/DataUploadCenter";
import DepartmentUsersView from "@/components/DepartmentUsersView";
import SalesEnquiryInbox from "@/components/SalesEnquiryInbox";
import WorkspaceLoadingSkeleton from "@/components/WorkspaceLoadingSkeleton";
import WebVitalsAnalyticsView from "@/components/WebVitalsAnalyticsView";
import SupervisorPermissionsAudit from "@/components/SupervisorPermissionsAudit";
import "./DepartmentWorkspace.css";

import {
  Shell, Wizard, ClientPortal, Overview, BookingsView, DocsView,
  TrainingView, GearView, BookingDetail, AttendanceView,
  DepartmentView, ProvisionedDepartmentDashboard,
  type View, type Booking, type Stage, type ClientDocumentTaxonomy,
  initialBookings, initialUploadDocuments,
  persistedBookingIdForUi, uiBookingIdForPersisted,
} from "./views";

export default function Home() {
  const [location, setLocation] = useLocation();
  const { user, logout } = useAuth();
  const isClient = location.startsWith("/client");
  const clientDocumentBookingId = persistedBookingIdForUi("BOB Booking-31511") ?? "BOB-59116";
  const clientTaxonomyQuery = trpc.documents.getTaxonomy.useQuery(undefined, { enabled: Boolean(user && isClient) });
  const clientMetadataQuery = trpc.documents.getMetadata.useQuery(
    { bookingId: clientDocumentBookingId },
    { enabled: Boolean(user && isClient) }
  );
  const saveDocumentMetadataMutation = trpc.documents.saveMetadata.useMutation();
  const deleteDocumentMetadataMutation = trpc.documents.deleteMetadata.useMutation();

  const {
    bookings, setBookings, bookingsLoading, allocations, setAllocations,
    completedWorkstreams, clientBooking,
    updateBooking, createBooking: createBookingBase,
    advanceDepartmentBooking: advanceDepartmentBookingBase,
    completeDepartmentWorkstream: completeDepartmentWorkstreamBase,
  } = useBookingWorkspace();

  const provisionedDashboardsQuery = trpc.departments.listProvisioned.useQuery(undefined, { enabled: Boolean(user) });
  const dashboardGreetingQuery = trpc.auth.getDashboardGreeting.useQuery(undefined, { enabled: Boolean(user) });
  const canViewSalesEnquiries = Boolean(user && (user.role === "admin" || user.departmentCode === "sales"));
  const salesEnquiriesQuery = trpc.salesEnquiries.list.useQuery(
    { status: "all" },
    { enabled: canViewSalesEnquiries }
  );
  const salesSlaQuery = trpc.salesEnquiries.getSlaConfig.useQuery(undefined, { enabled: canViewSalesEnquiries });
  const salesSlaConfig = salesSlaQuery.data ?? { warningHours: 4, criticalHours: 24 };
  const unassignedSalesEnquiries = (salesEnquiriesQuery.data ?? []).filter(
    enquiry => !enquiry.assignedToUserId && enquiry.status !== "Converted" && enquiry.status !== "Closed"
  );
  const unassignedRentalEnquiries = unassignedSalesEnquiries.length;
  const unassignedOldestWaitHours = unassignedSalesEnquiries.length
    ? Math.max(0, (Date.now() - Math.min(...unassignedSalesEnquiries.map(enquiry => new Date(enquiry.createdAt).getTime()))) / 3_600_000)
    : 0;

  const [view, setView] = useState<View>(() =>
    location === "/uploads" ? "uploads"
      : location === "/attendance" ? "attendance"
        : location === "/training" ? "training"
          : location === "/crew" ? "crew"
            : location === "/gear" ? "gear"
              : "overview"
  );
  const [workspaceLoading, setWorkspaceLoading] = useState(false);

  const [uploadDocuments, setUploadDocuments] = useState<DocumentItem[]>(initialUploadDocuments);
  const [attendanceRecords, setAttendanceRecords] = useState<Record<string, AttendanceRecord>>({});
  const [selectedAttendanceDate, setSelectedAttendanceDate] = useState(() => dateKey(new Date()));


  const [uploadRecords, setUploadRecords] = useState<UploadMap>({});
  const [selectedTrainingEmployeeId, setSelectedTrainingEmployeeId] = useState<string | null>(null);
  const [activeBooking, setActiveBooking] = useState<Booking | null>(null);
  const [activeDepartment, setActiveDepartment] = useState<string | null>(null);
  const [activeProvisionedDepartmentCode, setActiveProvisionedDepartmentCode] = useState<string | null>(null);
  const [focusedAssignmentBookingId, setFocusedAssignmentBookingId] = useState<string | null>(null);
  const [assignmentSavedMessage, setAssignmentSavedMessage] = useState<string | null>(null);


  useEffect(() => {
    if (view !== "department" && view !== "provisioned-dashboard") {
      setWorkspaceLoading(false);
      return;
    }
    setWorkspaceLoading(true);
    const timer = window.setTimeout(() => setWorkspaceLoading(false), 160);
    return () => window.clearTimeout(timer);
  }, [activeDepartment, activeProvisionedDepartmentCode, view]);



  useEffect(() => {
    if (!isClient || !clientMetadataQuery.data?.length) return;
    const persistedById = new Map(clientMetadataQuery.data.map(record => [record.id, record]));
    setUploadDocuments(current => {
      let changed = false;
      const next = current.map(document => {
        const persisted = persistedById.get(document.id);
        if (!persisted) return document;
        const hydrated = {
          ...document,
          state: persisted.state as DocumentItem["state"],
          category: persisted.category ?? document.category,
          tags: persisted.tags ?? document.tags ?? [],
          fileName: persisted.fileName ?? document.fileName,
          fileType: persisted.fileType ?? document.fileType,
          fileSize: persisted.fileSize ?? document.fileSize,
        };
        if (JSON.stringify(hydrated) !== JSON.stringify(document)) changed = true;
        return hydrated;
      });
      return changed ? next : current;
    });
  }, [clientMetadataQuery.data, isClient]);

  const persistClientDocumentMetadata = async (document: DocumentItem) => {
    await saveDocumentMetadataMutation.mutateAsync({
      id: document.id,
      bookingId: clientDocumentBookingId,
      name: document.name,
      departmentCode: document.departmentCode,
      state: document.state,
      category: document.category ?? null,
      tags: document.tags ?? [],
      fileName: document.fileName ?? null,
      fileType: document.fileType ?? null,
      fileSize: document.fileSize ?? null,
    });
    await clientMetadataQuery.refetch();
  };

  if (isClient && clientBooking)
    return (
      <ClientPortal
        booking={clientBooking}
        documents={uploadDocuments}
        taxonomy={clientTaxonomyQuery.data}
        onUpdate={updateBooking}
        onUpdateDocuments={setUploadDocuments}
        onPersistDocumentMetadata={persistClientDocumentMetadata}
        onUploadAll={async (files, documentId) => {
          if (documentId && (!files || files.length === 0)) {
            const existing = uploadDocuments.find(document => document.id === documentId);
            setUploadDocuments(current => current.map(doc =>
              doc.id === documentId
                ? { ...doc, state: "Required", fileName: undefined, fileType: undefined, fileSize: undefined }
                : doc
            ));
            await deleteDocumentMetadataMutation.mutateAsync({ id: documentId });
            if (existing) await clientMetadataQuery.refetch();
            return;
          }
          const filesToUpload = files ?? [];
          if (!filesToUpload.length) return;
          if (documentId) {
            const target = uploadDocuments.find(document => document.id === documentId);
            const file = filesToUpload[0];
            if (!target) return;
            const nextDocument = { ...target, state: "Uploaded" as const, fileName: file.name, fileType: file.type, fileSize: file.size };
            setUploadDocuments(current => current.map(document => document.id === documentId ? nextDocument : document));
            await persistClientDocumentMetadata(nextDocument);
            return;
          }
          const assignments = uploadDocuments.filter(document => document.state === "Required").slice(0, filesToUpload.length).map((document, index) => ({ document, file: filesToUpload[index] }));
          setUploadDocuments(current => current.map(document => {
            const assignment = assignments.find(item => item.document.id === document.id);
            return assignment ? { ...document, state: "Uploaded", fileName: assignment.file.name, fileType: assignment.file.type, fileSize: assignment.file.size } : document;
          }));
          await Promise.all(assignments.map(({ document, file }) => persistClientDocumentMetadata({ ...document, state: "Uploaded", fileName: file.name, fileType: file.type, fileSize: file.size })));
        }}
        onBackToInternal={() => setLocation("/")}
      />
    );

  const openDetail = (booking: Booking) => {
    setActiveBooking(booking);
    setView("detail");
  };

  const createBooking = (booking: Booking) => {
    createBookingBase(booking);
    setActiveBooking(booking);
    setView("detail");
  };

  const advanceDepartmentBooking = async (booking: Booking, config: any) => {
    const nextBooking = await advanceDepartmentBookingBase(booking, config);
    if (nextBooking) {
      setActiveBooking(nextBooking);
      setView("detail");
    }
  };

  const openDepartment = (department: string) => {
    const departmentCode = DEPARTMENT_LABEL_TO_CODE[department];
    if (!user || (user.role !== "admin" && user.departmentCode !== departmentCode)) return;
    setActiveDepartment(department);
    setActiveBooking(null);
    setView("department");
  };

  const openProvisionedDashboard = (departmentCode: string) => {
    if (!user || !canAccessProvisionedDepartmentDashboard(user, departmentCode)) return;
    const exists = (provisionedDashboardsQuery.data ?? []).some((dashboard) => dashboard.code === departmentCode);
    if (!exists) return;
    setActiveBooking(null);
    setActiveDepartment(null);
    setActiveProvisionedDepartmentCode(departmentCode);
    setView("provisioned-dashboard");
  };

  const signOut = async () => {
    await logout();
    setLocation("/login");
  };

  const canView = (nextView: View) => {
    if (nextView === "sales-enquiries") {
      return Boolean(user && (user.role === "admin" || user.departmentCode === "sales"));
    }
    if (nextView === "web-vitals") return Boolean(user?.role === "admin");
    if (nextView === "provisioned-dashboard") {
      return Boolean(user && activeProvisionedDepartmentCode && canAccessProvisionedDepartmentDashboard(user, activeProvisionedDepartmentCode));
    }
    return canAccessWorkspaceView(user ?? { role: "user", departmentCode: null }, nextView);
  };

  useEffect(() => {
    if (user && !canView(view)) setView("overview");
  }, [user, view]);

  useEffect(() => {
    if (!user || user.role === "admin" || view !== "overview") return;
    const dashboard = (provisionedDashboardsQuery.data ?? []).find((item) => item.code === user.departmentCode);
    if (!dashboard) return;
    setActiveProvisionedDepartmentCode(dashboard.code);
    setView("provisioned-dashboard");
  }, [provisionedDashboardsQuery.data, user, view]);

  if (!user) return null;

  const guardedSetView = (nextView: View) => {
    if (nextView !== "crew") setFocusedAssignmentBookingId(null);
    setActiveBooking(null);
    setActiveDepartment(null);
    if (nextView !== "provisioned-dashboard") setActiveProvisionedDepartmentCode(null);
    setView(canView(nextView) ? nextView : "overview");
  };

  const activeProvisionedDashboard = (provisionedDashboardsQuery.data ?? []).find((dashboard) => dashboard.code === activeProvisionedDepartmentCode) ?? null;

  return (
    <Shell
      view={view}
      setView={guardedSetView}
      onBack={() => {
        if (view === "crew" && focusedAssignmentBookingId) {
          setActiveBooking(bookings.find(booking => booking.id === focusedAssignmentBookingId) ?? null);
          setFocusedAssignmentBookingId(null);
          setActiveDepartment(null);
          setView("detail");
          return;
        }
        setActiveBooking(null);
        setActiveDepartment(null);
        setActiveProvisionedDepartmentCode(null);
        setView(view === "detail" ? "bookings" : "overview");
      }}
      onClient={() => setLocation("/client/portal-bob-31511")}
      onDepartment={openDepartment}
      provisionedDashboards={provisionedDashboardsQuery.data ?? []}
      activeProvisionedDepartmentCode={activeProvisionedDepartmentCode}
      onProvisionedDashboard={openProvisionedDashboard}
      departmentLabel={activeDepartment}
      bookings={bookings}
      onOpenDossier={openDetail}
      user={user}
      onSignOut={signOut}
    >
      {view === "overview" && (
        <Overview
          bookings={bookings}
          documents={uploadDocuments}
          setView={guardedSetView}
          setDetail={openDetail}
          attendanceRecords={attendanceRecords}
          setAttendanceRecords={setAttendanceRecords}
          user={user}
          greetingTemplate={dashboardGreetingQuery.data?.template}
          unassignedRentalEnquiries={unassignedRentalEnquiries}
          unassignedOldestWaitHours={unassignedOldestWaitHours}
          salesSlaConfig={salesSlaConfig}
          canViewSalesEnquiries={canViewSalesEnquiries}
          onSelectEmployee={employeeId => {
            setSelectedTrainingEmployeeId(employeeId);
            setView("training");
          }}
        />
      )}
      {view === "bookings" && user.role === "admin" && (
        <BookingsView bookings={bookings} setView={guardedSetView} setDetail={openDetail} isLoading={bookingsLoading} />
      )}
      {view === "wizard" && (user.role === "admin" || user.departmentCode === "sales") && (
        <Wizard onCreated={createBooking} onCancel={() => guardedSetView("overview")} />
      )}
      {view === "docs" && (user.role === "admin" || user.departmentCode === "documentation" || user.departmentCode === "hse") && (
        <DocsView bookings={bookings} setDetail={openDetail} />
      )}
      {view === "crew" && (user.role === "admin" || user.departmentCode === "crew") && (
        <CrewView
          bookings={bookings}
          allocations={allocations}
          setAllocations={setAllocations}
          focusedBookingId={focusedAssignmentBookingId}
          onOpenDossier={(bookingId) => {
            const booking = bookings.find((candidate) => candidate.id === bookingId);
            if (!booking) return;
            setFocusedAssignmentBookingId(null);
            setActiveBooking(booking);
            setView("detail");
          }}
          onAddWorkman={() => {
            if (canView("users")) {
              setView("users");
            } else {
              toast.info("Supervisor access required", {
                description: "Only a Crew supervisor or administrator can add workmen accounts.",
              });
            }
          }}
          onAllocationSaved={({ bookingId, employeeName, action }) => {
            setAssignmentSavedMessage(`${employeeName} was ${action === "saved" ? "assigned to" : "removed from"} ${bookingId}.`);
          }}
        />
      )}
      {view === "gear" && (user.role === "admin" || user.departmentCode === "lifting-gears") && (
        <GearView />
      )}
      {view === "attendance" && (user.role === "admin" || user.departmentCode === "hr") && (
        <AttendanceView
          records={attendanceRecords}
          setRecords={setAttendanceRecords}
          selectedDate={selectedAttendanceDate}
          setSelectedDate={setSelectedAttendanceDate}
        />
      )}
      {view === "training" && (
        <TrainingView selectedEmployeeId={selectedTrainingEmployeeId} />
      )}
      {view === "uploads" && (user.role === "admin" || user.departmentCode === "accounts") && (
        <DataUploadCenter uploads={uploadRecords} setUploads={setUploadRecords} />
      )}
      {view === "users" && user.role !== "user" && (
        <DepartmentUsersView actor={user} onOpenDashboard={openProvisionedDashboard} />
      )}
      {view === "supervisor-audit" && user.role === "admin" && (
        <SupervisorPermissionsAudit />
      )}
      {view === "web-vitals" && user.role === "admin" && (
        <WebVitalsAnalyticsView />
      )}
      {view === "department" && activeDepartment && (
        workspaceLoading ? <WorkspaceLoadingSkeleton title={`Loading ${activeDepartment} workspace…`} /> : <>
          <DepartmentView
            department={activeDepartment}
            bookings={bookings}
            setDetail={openDetail}
            onAdvance={advanceDepartmentBooking}
            onCompleteWorkstream={completeDepartmentWorkstreamBase}
            completedWorkstreams={completedWorkstreams}
          />
        </>
      )}
      {view === "provisioned-dashboard" && activeProvisionedDashboard && (
        workspaceLoading ? <WorkspaceLoadingSkeleton title={`Loading ${activeProvisionedDashboard.name} workspace…`} /> : <ProvisionedDepartmentDashboard
          dashboard={activeProvisionedDashboard}
          bookings={bookings}
          canManageTeam={user.role === "admin" || user.role === "supervisor"}
          canArchiveWorkflows={user.role === "admin"}
          onOpenDossier={openDetail}
          onManageTeam={() => guardedSetView("users")}
        />
      )}
      {view === "sales-enquiries" && (user.role === "admin" || user.departmentCode === "sales") && (
        <SalesEnquiryInbox
          actor={user}
          onOpenBooking={booking => {
            const convertedBooking: Booking = {
              id: booking.id,
              client: booking.clientName ?? "Rental enquiry client",
              project: booking.projectName ?? "Rental enquiry conversion",
              crane: "To be confirmed",
              site: "To be confirmed",
              stage: (booking.stage as Stage | undefined) ?? "Created by Salesperson",
              priority: (booking.priority as Booking["priority"] | undefined) ?? "Standard",
              progress: 0,
              mob: booking.mobilizationDate ?? "To be confirmed",
              offHire: booking.offHireDate ?? "To be confirmed",
              pm: booking.projectManager ?? "Sales follow-up",
              crew: booking.clientContactName ?? "",
            };
            setBookings(current => [convertedBooking, ...current.filter(item => item.id !== convertedBooking.id)]);
            openDetail(convertedBooking);
          }}
        />
      )}
      {view === "detail" && activeBooking && (
        <BookingDetail
          booking={activeBooking}
          documents={uploadDocuments}
          allocations={allocations}
          assignmentSavedMessage={assignmentSavedMessage}
          generatedBy={user.name ?? user.email ?? "BOB Cranes Operations"}
          onUpdate={updateBooking}
          onOpenClientPortal={() => setLocation("/client/portal-bob-31511")}
          onEditAssignment={() => {
            if (!canView("crew")) {
              toast.error("Crew assignment access required", {
                description: "Open this action from an administrator or Crew department account.",
              });
              return;
            }
            setAssignmentSavedMessage(null);
            setFocusedAssignmentBookingId(activeBooking.id);
            setActiveBooking(null);
            setActiveDepartment(null);
            setView("crew");
          }}
          onBack={() => {
            setAssignmentSavedMessage(null);
            setFocusedAssignmentBookingId(null);
            setActiveBooking(null);
            setView("overview");
          }}
        />
      )}
      <div style={{ color: "#555", fontSize: 10, textAlign: "right", padding: "10px 0 0" }}>
        System status: operational · {bookings.length} dossiers in view · v3.0
      </div>
    </Shell>
  );
}
