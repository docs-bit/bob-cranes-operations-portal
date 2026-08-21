import { useEffect, useState } from "react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import {
  type Booking,
  type Stage,
  initialBookings,
  uiBookingIdForPersisted,
} from "@/pages/views/shared";
import { type EmployeeAllocation } from "@shared/bookingConflictRules";

const DEFAULT_ALLOCATIONS: EmployeeAllocation[] = [
  { employeeName: "Vineeth Vijayan", crewId: "cr-1", bookingId: "BOB Booking-31511" },
  { employeeName: "Anoop Panikashery", crewId: "cr-2", bookingId: "BOB Booking-31511" },
  { employeeName: "Vijayakumar", crewId: "cr-3", bookingId: "BOB Booking-31511" },
  { employeeName: "Amal Krishnan", crewId: "cr-4", bookingId: "BOB Booking-31511" },
];

export function useBookingWorkspace() {
  const advanceBookingStageMutation = trpc.operations.advanceBookingStage.useMutation();
  const completeWorkstreamMutation = trpc.operations.completeBookingWorkstream.useMutation();
  const crewAllocationsQuery = trpc.operations.getCrewAllocations.useQuery();

  const [bookingsLoading, setBookingsLoading] = useState(true);
  const [bookings, setBookings] = useState<Booking[]>(() =>
    Array.from(new Map(initialBookings.map((b) => [b.id, b])).values())
  );
  const [allocations, setAllocations] = useState<EmployeeAllocation[]>(DEFAULT_ALLOCATIONS);
  const [completedWorkstreams, setCompletedWorkstreams] = useState<Record<string, string[]>>({});

  useEffect(() => {
    const timer = window.setTimeout(() => setBookingsLoading(false), 220);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (crewAllocationsQuery.data) {
      setAllocations(
        crewAllocationsQuery.data.map((a) => ({
          employeeName: a.crewName,
          crewId: a.crewId,
          bookingId: uiBookingIdForPersisted(a.bookingId),
        }))
      );
    }
  }, [crewAllocationsQuery.data]);

  const clientBooking =
    bookings.find((b) => b.id === "BOB Booking-31511") ?? bookings[0];

  const updateBooking = (nextBooking: Booking) => {
    setBookings((current) => [
      nextBooking,
      ...current.filter((item) => item.id !== nextBooking.id),
    ]);
  };

  const createBooking = (booking: Booking) => {
    setBookings((current) => [
      booking,
      ...current.filter((item) => item.id !== booking.id),
    ]);
  };

  const advanceDepartmentBooking = async (
    booking: Booking,
    config: { nextStage?: string; secondaryStage?: string; secondaryNextStage?: string }
  ) => {
    const nextStage =
      booking.stage === config.secondaryStage
        ? config.secondaryNextStage
        : config.nextStage;
    if (!nextStage) return;
    try {
      const result = await advanceBookingStageMutation.mutateAsync({
        id: booking.id,
        currentStage: booking.stage,
        nextStage,
      });
      const nextBooking = {
        ...booking,
        stage: result.stage as Stage,
        progress: Math.min(100, Math.max(booking.progress + 12, booking.progress)),
      };
      setBookings((current) => [
        nextBooking,
        ...current.filter((item) => item.id !== nextBooking.id),
      ]);
      toast.success(`Dossier moved to ${result.stage}`, {
        description: `${result.notifications.length} department notifications persisted.`,
      });
      return nextBooking;
    } catch (caught) {
      toast.error("Workflow handoff blocked", {
        description: caught instanceof Error ? caught.message : "The dossier could not be advanced.",
      });
      return null;
    }
  };

  const completeDepartmentWorkstream = async (
    booking: Booking,
    config: { parallelCode?: string }
  ) => {
    if (!config.parallelCode) return;
    try {
      await completeWorkstreamMutation.mutateAsync({
        id: booking.id,
        workstream: config.parallelCode,
        stage: booking.stage,
      });
      setCompletedWorkstreams((current) => ({
        ...current,
        [booking.id]: Array.from(
          new Set([...(current[booking.id] ?? []), config.parallelCode!])
        ),
      }));
      toast.success("Workstream completed", {
        description: "Documentation has been notified to review the evidence.",
      });
    } catch (caught) {
      toast.error("Workstream completion blocked", {
        description: caught instanceof Error ? caught.message : "The workstream could not be completed.",
      });
    }
  };

  return {
    bookings,
    setBookings,
    bookingsLoading,
    allocations,
    setAllocations,
    completedWorkstreams,
    clientBooking,

    updateBooking,
    createBooking,
    advanceDepartmentBooking,
    completeDepartmentWorkstream,
  };
}
