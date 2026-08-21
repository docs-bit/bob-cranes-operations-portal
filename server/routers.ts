import { systemRouter } from "./_core/systemRouter";
import { router } from "./_core/trpc";
import * as db from "./db";

// Domain routers
import { authRouter } from "./routers/auth";
import { departmentsRouter } from "./routers/departments";
import { documentsRouter } from "./routers/documents";
import { rentalRouter, salesEnquiriesRouter } from "./routers/sales";
import { operationsRouter } from "./routers/operations";
import { monitoringRouter } from "./routers/monitoring";
import { miscRouter } from "./routers/misc";
import { clientPortalRouter } from "./routers/clientPortal";

db.seedInitialDataIfNeeded().catch(console.error);

export const appRouter = router({
  system: systemRouter,
  auth: authRouter,
  departments: departmentsRouter,
  documents: documentsRouter,
  rental: rentalRouter,
  salesEnquiries: salesEnquiriesRouter,
  operations: operationsRouter,
  runtimeMonitoring: monitoringRouter.runtimeErrors,
  telemetry: monitoringRouter.telemetry,
  filterPresets: miscRouter.filterPresets,
  clientFeedback: miscRouter.clientFeedback,
  clientPortal: clientPortalRouter,
});

export type AppRouter = typeof appRouter;
