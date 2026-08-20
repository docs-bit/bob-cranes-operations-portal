# Graph Report - bob-cranes-operations-portal (4)  (2026-08-20)

## Corpus Check
- 266 files · ~359,409 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 1532 nodes · 2981 edges · 167 communities (82 shown, 85 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS · INFERRED: 13 edges (avg confidence: 0.85)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- Radix UI Components
- Dashboard Layout & Navigation
- Database Access Layer
- Form & Input Components
- App Shell & Error Boundary
- Home Page & Workspace Views
- Database Schema (Drizzle)
- Server Router & Department Rules
- Excel Upload & Data Mapping
- LLM Service Integration
- User Management Views
- Sales Inbox & PDF Generation
- AI Chat & Input Components
- TypeScript Configuration
- Booking Lifecycle & Progress
- Command Palette & Dialog
- Alert Dialog & Pagination
- Charts & Web Vitals Analytics
- Auth Context & Tests
- Attendance & Roster Tracking
- Crew Assignment Workspace
- OAuth & SDK Integration
- Notifications & Training Expiry
- Dev Dependencies Bundle
- Debug Event Collector
- Menu Bar Components
- External Dependencies Bundle
- Maps & Geolocation Service
- Context Menu Components
- Component Architecture Config
- SDK Server Auth
- Account & Activity Rules
- Carousel Components
- Image Generation & Storage
- Department Access Control
- Heartbeat Service
- Crew Availability Rules
- Map View & Composition Hooks
- Form Control Components
- Package Configuration
- Card & NotFound Pages
- Gear Selection & Compliance
- Vehicle Fleet Management
- Local Authentication
- Build Scripts
- Crew Roster Data
- Booking Conflict Detection
- Cookies & Rate Limiting
- tRPC Procedures & Middleware
- Server Bootstrap & Vite
- Voice Transcription Service
- Vite Build & Logging
- System Router & Notifications
- OAuth Service Exchange
- Manus API Types
- Runtime Monitoring Rules
- Toggle Components
- Booking Conflict Rules
- Shared Error Types
- Assignment UI Tests
- Assignment Rules
- Data API & Environment
- Booking CRUD Operations
- Department Dashboard CRUD
- Performance Workspace Tests
- Lighthouse CI Check
- Rental Enquiry CRUD
- Document Metadata CRUD
- Community 68
- Community 69
- Community 70
- Community 71
- Community 72
- Community 73
- Community 74
- Community 75
- Community 76
- Community 77
- Community 78
- Community 79
- Community 80
- Community 81
- Community 82
- Community 83
- Community 84
- Community 85
- Community 86
- Community 87
- Community 88
- Community 89
- Community 90
- Community 91
- Community 92
- Community 93
- Community 94
- Community 95
- Community 96
- Community 97
- Community 98
- Community 99
- Community 100
- Community 101
- Community 102
- Community 103
- Community 104
- Community 105
- Community 106
- Community 107
- Community 108
- Community 109
- Community 110
- Community 111
- Community 112
- Community 113
- Community 114
- Community 115
- Community 116
- Community 117
- Community 118
- Community 119
- Community 120
- Community 121
- Community 122
- Community 123
- Community 124
- Community 125
- Community 126
- Community 127
- Community 128
- Community 129
- Community 130
- Community 131
- Community 132
- Community 133
- Community 134
- Community 135
- Community 136
- Community 137
- Community 138
- Community 139
- Community 140
- Community 141
- Community 142
- Community 143
- Community 144
- Community 145
- Community 146
- Community 147
- Community 148
- Community 150

## God Nodes (most connected - your core abstractions)
1. `cn()` - 275 edges
2. `getDb()` - 78 edges
3. `AppRouter` - 42 edges
4. `DepartmentUsersView()` - 15 edges
5. `compilerOptions` - 15 edges
6. `trpc` - 14 edges
7. `DataUploadCenter()` - 13 edges
8. `Button()` - 13 edges
9. `ENV` - 13 edges
10. `useAuth()` - 12 edges

## Surprising Connections (you probably didn't know these)
- `ProvisionedDepartmentDashboard()` --calls--> `normalizeDepartmentDashboardConfig()`  [EXTRACTED]
  client/src/pages/Home.tsx → shared/departmentDashboardRules.ts
- `CrewView()` --calls--> `focusAssignmentBooking()`  [EXTRACTED]
  client/src/components/CrewAssignmentWorkspace.tsx → shared/assignmentRules.ts
- `CrewView()` --calls--> `buildBulkConflictSummary()`  [EXTRACTED]
  client/src/components/CrewAssignmentWorkspace.tsx → shared/bulkCrewAssignmentRules.ts
- `CrewView()` --calls--> `summarizeAllocationTiming()`  [EXTRACTED]
  client/src/components/CrewAssignmentWorkspace.tsx → shared/crewAssignmentAvailability.ts
- `DepartmentUsersView()` --calls--> `nextAccountActiveState()`  [EXTRACTED]
  client/src/components/DepartmentUsersView.tsx → shared/accountManagementRules.ts

## Import Cycles
- None detected.

## Communities (167 total, 85 thin omitted)

### Community 0 - "Radix UI Components"
Cohesion: 0.04
Nodes (60): Accordion(), AccordionContent(), AccordionItem(), AccordionTrigger(), Alert(), AlertDescription(), AlertTitle(), alertVariants (+52 more)

### Community 1 - "Dashboard Layout & Navigation"
Cohesion: 0.04
Nodes (59): DashboardLayoutContent(), DashboardLayoutContentProps, menuItems, DashboardLayoutSkeleton(), Avatar(), AvatarFallback(), AvatarImage(), DropdownMenu() (+51 more)

### Community 2 - "Database Access Layer"
Cohesion: 0.06
Nodes (71): ActivityLogFilters, addChatMessage(), addNotification(), addUserActivity(), countLocalUsers(), createClientFeedback(), createDepartmentWorkflowTemplate(), createDocumentCategory() (+63 more)

### Community 3 - "Form & Input Components"
Cohesion: 0.06
Nodes (58): ButtonGroup(), ButtonGroupSeparator(), ButtonGroupText(), buttonGroupVariants, Empty(), EmptyContent(), EmptyDescription(), EmptyHeader() (+50 more)

### Community 4 - "App Shell & Error Boundary"
Cohesion: 0.05
Nodes (44): App(), ProtectedPortal(), DashboardLayout(), ErrorBoundary, Props, State, PerformanceTelemetry(), RuntimeErrorDetail (+36 more)

### Community 5 - "Home Page & Workspace Views"
Cohesion: 0.04
Nodes (44): WorkspaceLoadingSkeleton(), allocationMatchesCrew(), Booking, BookingFilter, BookingSort, CLIENT_DOCUMENT_CATEGORIES, ClientDocumentTaxonomy, ClientPortal() (+36 more)

### Community 6 - "Database Schema (Drizzle)"
Cohesion: 0.04
Nodes (46): AuditLogRecord, auditLogs, Booking, BookingCrewAllocation, bookingCrewAllocations, bookings, ChatMessageRecord, chatMessages (+38 more)

### Community 7 - "Server Router & Department Rules"
Cohesion: 0.11
Nodes (29): dashboard, accountInput, AppRouter, lifecycleNotificationDepartment, lifecycleStageDepartment, registrationInput, requireAccountManagementAccess(), requireActiveProvisionedDepartment() (+21 more)

### Community 8 - "Excel Upload & Data Mapping"
Cohesion: 0.12
Nodes (28): DataUploadCenter(), formatBytes(), loadMappingPreferences(), PendingWorkbook, readWorkbook(), storeMappingPreferences(), uploadDepartmentCards, UploadMap (+20 more)

### Community 9 - "LLM Service Integration"
Cohesion: 0.08
Nodes (33): assertApiKey(), computeBackoffDelay(), ensureArray(), FetchInit, fetchWithBackoff(), FileContent, ImageContent, invokeLLM() (+25 more)

### Community 10 - "User Management Views"
Cohesion: 0.11
Nodes (25): AccountEditorForm, AccountForm, activityLabel(), DepartmentForm, DepartmentUsersView(), DepartmentUsersViewProps, displayDate(), displayDateTime() (+17 more)

### Community 11 - "Sales Inbox & PDF Generation"
Cohesion: 0.11
Nodes (26): AssignmentFilter, BookingPreview, enquiryStatuses, EnquiryStatusFilter, SalesEnquiryInbox(), SalesFilterPreset, DispatchBundleBooking, DispatchBundleCrew (+18 more)

### Community 12 - "AI Chat & Input Components"
Cohesion: 0.12
Nodes (22): AIChatBox(), AIChatBoxProps, Message, Badge(), badgeVariants, Button(), Calendar(), CalendarDayButton() (+14 more)

### Community 13 - "TypeScript Configuration"
Cohesion: 0.07
Nodes (30): build, client/src/**/*, dist, dom, dom.iterable, esnext, node, node_modules (+22 more)

### Community 14 - "Booking Lifecycle & Progress"
Cohesion: 0.10
Nodes (27): BookingDetail(), ProgressGraph(), Availability, BOOKING_STAGES, BookingDossier, BookingStage, canAdvanceStage(), canDispatch() (+19 more)

### Community 15 - "Command Palette & Dialog"
Cohesion: 0.11
Nodes (19): ManusDialogProps, Command(), CommandDialog(), CommandEmpty(), CommandGroup(), CommandInput(), CommandItem(), CommandList() (+11 more)

### Community 16 - "Alert Dialog & Pagination"
Cohesion: 0.10
Nodes (17): AlertDialogAction(), AlertDialogCancel(), AlertDialogContent(), AlertDialogDescription(), AlertDialogFooter(), AlertDialogHeader(), AlertDialogOverlay(), AlertDialogTitle() (+9 more)

### Community 17 - "Charts & Web Vitals Analytics"
Cohesion: 0.14
Nodes (18): ChartConfig, ChartContainer(), ChartContext, ChartContextProps, ChartLegendContent(), ChartTooltipContent(), getPayloadConfigFromPayload(), THEMES (+10 more)

### Community 18 - "Auth Context & Tests"
Cohesion: 0.12
Nodes (5): AuthenticatedUser, CookieCall, TrpcContext, enquiry, LOCAL_AUTH_COOKIE_NAME

### Community 19 - "Attendance & Roster Tracking"
Cohesion: 0.21
Nodes (18): attendanceRoster, AttendanceSummaryCard(), AttendanceView(), Overview(), ATTENDANCE_STATUSES, attendanceCompletion(), AttendanceRecord, attendanceRosterKey() (+10 more)

### Community 20 - "Crew Assignment Workspace"
Cohesion: 0.13
Nodes (13): allocationMatches(), Availability, Booking, CrewSearchPreset, CrewView(), csvCell(), CsvColumnKey, DEFAULT_EXPORT_COLUMNS (+5 more)

### Community 21 - "OAuth & SDK Integration"
Cohesion: 0.22
Nodes (13): startLogin(), getQueryParam(), registerOAuthRoutes(), AuthenticatedUser, sdk, SessionPayload, AXIOS_TIMEOUT_MS, COOKIE_NAME (+5 more)

### Community 22 - "Notifications & Training Expiry"
Cohesion: 0.16
Nodes (13): ExpiringCertificatesWidget(), Shell(), bookings, DepartmentNotificationFilter, filterNotifications(), getExpiringTrainingEmployees(), UrgencyFilter, TRAINING_EMPLOYEES (+5 more)

### Community 23 - "Dev Dependencies Bundle"
Cohesion: 0.12
Nodes (17): autoprefixer, jsdom, devDependencies, autoprefixer, jsdom, tailwindcss, @testing-library/user-event, tw-animate-css (+9 more)

### Community 24 - "Debug Event Collector"
Cohesion: 0.24
Nodes (15): compactText(), describeElement(), elText(), formatArg(), formatArgs(), getInputValueSafe(), installUiEventListeners(), nav() (+7 more)

### Community 25 - "Menu Bar Components"
Cohesion: 0.12
Nodes (12): Menubar(), MenubarCheckboxItem(), MenubarContent(), MenubarItem(), MenubarLabel(), MenubarMenu(), MenubarRadioItem(), MenubarSeparator() (+4 more)

### Community 26 - "External Dependencies Bundle"
Cohesion: 0.12
Nodes (17): clsx, drizzle-orm, @hookform/resolvers, next-themes, dependencies, clsx, drizzle-orm, @hookform/resolvers (+9 more)

### Community 27 - "Maps & Geolocation Service"
Cohesion: 0.12
Nodes (16): DirectionsResult, DistanceMatrixResult, ElevationResult, GeocodingResult, getMapsConfig(), LatLng, makeRequest(), MapsConfig (+8 more)

### Community 28 - "Context Menu Components"
Cohesion: 0.12
Nodes (11): ContextMenu(), ContextMenuCheckboxItem(), ContextMenuContent(), ContextMenuItem(), ContextMenuLabel(), ContextMenuRadioItem(), ContextMenuSeparator(), ContextMenuShortcut() (+3 more)

### Community 29 - "Component Architecture Config"
Cohesion: 0.12
Nodes (15): aliases, components, hooks, lib, ui, utils, rsc, $schema (+7 more)

### Community 30 - "SDK Server Auth"
Cohesion: 0.21
Nodes (5): buildCronUser(), isNonEmptyString(), SDKServer, GetUserInfoWithJwtResponse, ForbiddenError()

### Community 31 - "Account & Activity Rules"
Cohesion: 0.22
Nodes (11): canManageAccount(), ManagedAccount, nextAccountActiveState(), requiresDeactivationConfirmation(), accountUpdateNotification(), accountStatusActivity(), profileUpdateActivity(), signInActivity() (+3 more)

### Community 32 - "Carousel Components"
Cohesion: 0.19
Nodes (13): Carousel(), CarouselApi, CarouselContent(), CarouselContext, CarouselContextProps, CarouselItem(), CarouselNext(), CarouselOptions (+5 more)

### Community 33 - "Image Generation & Storage"
Cohesion: 0.23
Nodes (11): generateImage(), GenerateImageOptions, GenerateImageResponse, ImageModelInfo, ListImageModelsResponse, appendHashSuffix(), getForgeConfig(), normalizeKey() (+3 more)

### Community 34 - "Department Access Control"
Cohesion: 0.23
Nodes (9): canAccessDepartment(), canAccessWorkspaceView(), canManageDepartmentUsers(), DEPARTMENT_BY_CODE, DEPARTMENT_LABEL_TO_CODE, DEPARTMENT_WORKSPACE_VIEW, DepartmentAccessUser, DepartmentCode (+1 more)

### Community 35 - "Heartbeat Service"
Cohesion: 0.28
Nodes (12): buildEndpoint(), callForge(), createHeartbeatJob(), deleteHeartbeatJob(), HeartbeatJob, HeartbeatJobInfo, HeartbeatJobUpdate, listHeartbeatJobs() (+4 more)

### Community 36 - "Crew Availability Rules"
Cohesion: 0.23
Nodes (9): dateAvailability(), workspaceSource, home, workspace, allocationAwareAvailability(), AllocationTiming, CrewAvailability, DatedBooking (+1 more)

### Community 37 - "Map View & Composition Hooks"
Cohesion: 0.23
Nodes (9): loadMapScript(), MapView(), MapViewProps, Window, TimerResponse, UseCompositionOptions, UseCompositionReturn, noop (+1 more)

### Community 38 - "Form Control Components"
Cohesion: 0.23
Nodes (10): FormControl(), FormDescription(), FormFieldContext, FormFieldContextValue, FormItem(), FormItemContext, FormItemContextValue, FormLabel() (+2 more)

### Community 39 - "Package Configuration"
Cohesion: 0.18
Nodes (10): license, name, tailwindcss>nanoid, packageManager, wouter@3.7.1, pnpm, overrides, patchedDependencies (+2 more)

### Community 40 - "Card & NotFound Pages"
Cohesion: 0.24
Nodes (8): Card(), CardAction(), CardContent(), CardDescription(), CardFooter(), CardHeader(), CardTitle(), NotFound()

### Community 41 - "Gear Selection & Compliance"
Cohesion: 0.33
Nodes (8): GearCertificateDialog(), GearCreateDialog(), GearView(), canSelectGearForBooking(), formatGearValidityDate(), GearComplianceStatus, gearDocumentStatus(), isValidGearDocumentPeriod()

### Community 42 - "Vehicle Fleet Management"
Cohesion: 0.38
Nodes (7): TransportationFleetPanel(), FleetVehicle, VEHICLE_FLEET, VEHICLE_FLEET_SOURCE, filterVehicleFleet(), parseMulkiyaExpiry(), vehicleRegistrationStatus

### Community 43 - "Local Authentication"
Cohesion: 0.29
Nodes (9): User, createLocalSession(), hashPassword(), normalizeEmail(), readLocalSession(), scryptAsync, sessionKey(), toSessionUser() (+1 more)

### Community 44 - "Build Scripts"
Cohesion: 0.20
Nodes (10): scripts, build, check, db:push, dev, format, lighthouse:ci, start (+2 more)

### Community 45 - "Crew Roster Data"
Cohesion: 0.31
Nodes (6): ATTENDANCE_CREW_ROSTER, AttendanceCrewMember, CREW_ASSIGNMENT_ROSTER, CrewAssignmentMember, isKnownCrewAssignmentMember(), LEGACY_CREW_ASSIGNMENT_ROSTER

### Community 46 - "Booking Conflict Detection"
Cohesion: 0.33
Nodes (8): workspace, buildBulkConflictSummary(), crewConflictBookings(), CrewIdentity, dateRangesOverlap(), isCrewAllocation(), TimelineBooking, toDate()

### Community 47 - "Cookies & Rate Limiting"
Cohesion: 0.22
Nodes (6): getSessionCookieOptions(), isSecureRequest(), LOCAL_HOSTS, buckets, checkTelemetryRateLimit(), writeLocalSession()

### Community 48 - "tRPC Procedures & Middleware"
Cohesion: 0.27
Nodes (8): adminProcedure, protectedProcedure, publicProcedure, requireUser, router, t, NOT_ADMIN_ERR_MSG, UNAUTHED_ERR_MSG

### Community 49 - "Server Bootstrap & Vite"
Cohesion: 0.44
Nodes (7): createContext(), findAvailablePort(), isPortAvailable(), startServer(), registerStorageProxy(), serveStatic(), setupVite()

### Community 50 - "Voice Transcription Service"
Cohesion: 0.28
Nodes (8): getFileExtension(), getLanguageName(), transcribeAudio(), TranscribeOptions, TranscriptionError, TranscriptionResponse, WhisperResponse, WhisperSegment

### Community 51 - "Vite Build & Logging"
Cohesion: 0.28
Nodes (7): ensureLogDir(), LOG_DIR, LogSource, plugins, TRIM_TARGET_BYTES, trimLogFile(), writeToLogFile()

### Community 52 - "System Router & Notifications"
Cohesion: 0.39
Nodes (7): buildEndpointUrl(), isNonEmptyString(), NotificationPayload, notifyOwner(), trimValue(), validatePayload(), systemRouter

### Community 53 - "OAuth Service Exchange"
Cohesion: 0.32
Nodes (3): OAuthService, ExchangeTokenResponse, GetUserInfoResponse

### Community 54 - "Manus API Types"
Cohesion: 0.25
Nodes (7): AuthorizeRequest, AuthorizeResponse, CanAccessRequest, CanAccessResponse, ExchangeTokenRequest, GetUserInfoRequest, GetUserInfoWithJwtRequest

### Community 55 - "Runtime Monitoring Rules"
Cohesion: 0.32
Nodes (6): crewWorkspace, monitoringPanel, reporter, runtimeErrorFingerprint(), RuntimeErrorSource, sanitizeRuntimeMessage()

### Community 56 - "Toggle Components"
Cohesion: 0.43
Nodes (5): ToggleGroup(), ToggleGroupContext, ToggleGroupItem(), Toggle(), toggleVariants

### Community 57 - "Booking Conflict Rules"
Cohesion: 0.52
Nodes (5): BookingWindow, bookingWindowsOverlap(), findEmployeeBookingConflicts(), parseDate(), toggleEmployeeBookingAllocation()

### Community 59 - "Assignment UI Tests"
Cohesion: 0.33
Nodes (4): CrewView, booking, saveCrewAllocations, EmployeeAllocation

### Community 60 - "Assignment Rules"
Cohesion: 0.47
Nodes (4): assignedEmployeeForBooking(), AssignmentAllocation, AssignmentBooking, focusAssignmentBooking()

### Community 62 - "Booking CRUD Operations"
Cohesion: 0.50
Nodes (4): createBooking(), getBookingById(), updateBookingAssignment(), updateBookingStage()

### Community 63 - "Department Dashboard CRUD"
Cohesion: 0.50
Nodes (4): createProvisionedDepartmentDashboard(), getProvisionedDepartmentDashboard(), setProvisionedDepartmentActive(), updateProvisionedDepartmentDashboardConfig()

### Community 64 - "Performance Workspace Tests"
Cohesion: 0.50
Nodes (3): analytics, styles, workspace

### Community 66 - "Rental Enquiry CRUD"
Cohesion: 0.67
Nodes (3): getRentalEnquiryById(), markRentalEnquiryConverted(), updateRentalEnquirySalesContext()

### Community 67 - "Document Metadata CRUD"
Cohesion: 0.67
Nodes (3): listPersistedDocumentMetadata(), normalizeTags(), upsertPersistedDocumentMetadata()

## Knowledge Gaps
- **412 isolated node(s):** `UseAuthOptions`, `AIChatBoxProps`, `Booking`, `Availability`, `CrewSearchPreset` (+407 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **85 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `cn()` connect `Form & Input Components` to `Radix UI Components`, `Dashboard Layout & Navigation`, `Carousel Components`, `App Shell & Error Boundary`, `Map View & Composition Hooks`, `Form Control Components`, `Card & NotFound Pages`, `AI Chat & Input Components`, `Command Palette & Dialog`, `Alert Dialog & Pagination`, `Charts & Web Vitals Analytics`, `Toggle Components`, `Menu Bar Components`, `Context Menu Components`?**
  _High betweenness centrality (0.158) - this node is a cross-community bridge._
- **Why does `useTheme()` connect `Radix UI Components` to `App Shell & Error Boundary`, `Home Page & Workspace Views`, `Notifications & Training Expiry`?**
  _High betweenness centrality (0.045) - this node is a cross-community bridge._
- **Why does `ENV` connect `Data API & Environment` to `Image Generation & Storage`, `Database Access Layer`, `Heartbeat Service`, `LLM Service Integration`, `Local Authentication`, `Voice Transcription Service`, `System Router & Notifications`, `OAuth & SDK Integration`, `Maps & Geolocation Service`?**
  _High betweenness centrality (0.033) - this node is a cross-community bridge._
- **What connects `UseAuthOptions`, `AIChatBoxProps`, `Booking` to the rest of the system?**
  _412 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Radix UI Components` be split into smaller, more focused modules?**
  _Cohesion score 0.04197530864197531 - nodes in this community are weakly interconnected._
- **Should `Dashboard Layout & Navigation` be split into smaller, more focused modules?**
  _Cohesion score 0.042206590151795634 - nodes in this community are weakly interconnected._
- **Should `Database Access Layer` be split into smaller, more focused modules?**
  _Cohesion score 0.056338028169014086 - nodes in this community are weakly interconnected._