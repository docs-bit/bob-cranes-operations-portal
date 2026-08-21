// View components
export { Shell } from "./Shell";
export { Wizard } from "./Wizard";
export { ClientPortal } from "./ClientPortal";
export { Overview } from "./Overview";
export { BookingsView } from "./BookingsView";
export { DocsView } from "./DocsView";
export { TrainingView } from "./TrainingView";
export { GearView } from "./GearView";
export { BookingDetail } from "./BookingDetail";
export { AttendanceView } from "./AttendanceView";
export { DepartmentView, ProvisionedDepartmentDashboard } from "./DepartmentView";

// Shared types, constants, and helpers
export {
  type View,
  type Booking,
  type Stage,
  type ClientDocumentTaxonomy,
  initialBookings,
  initialUploadDocuments,
  persistedBookingIdForUi,
  uiBookingIdForPersisted,
} from "./shared";
