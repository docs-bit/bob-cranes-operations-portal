import { useParams, useLocation } from "wouter";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { BookingDetail } from "@/pages/views";
import { initialBookings } from "@/pages/views/shared";

export default function BookingDetailPage() {
  const { id } = useParams();
  const [, setLocation] = useLocation();
  const { user } = useAuth();

  // Fetch bookings
  const { data: bookings = initialBookings } = trpc.operations.getBookings.useQuery();

  // Find the specific booking
  const booking = bookings.find((b: any) => b.id === id) as any;

  // Handle back navigation
  const handleBack = () => {
    setLocation("/bookings");
  };

  // Handle booking update
  const handleUpdate = (updatedBooking: any) => {
    // This would call the update mutation
    console.log("Update booking:", updatedBooking);
  };

  if (!booking) {
    return (
      <div className="home">
        <header className="home-header">
          <div className="home-brand">
            <img 
              src="/manus-storage/bob-lifting-your-expectations_2beae224.webp" 
              alt="BOB Cranes" 
              className="home-logo" 
            />
            <div>
              <h1>Booking Not Found</h1>
              <p className="home-meta">The requested booking could not be found</p>
            </div>
          </div>
          <div className="home-header-actions">
            <a href="/bookings" className="secondary-button">
              Back to Bookings
            </a>
          </div>
        </header>
        <main className="home-body">
          <div className="empty-state">
            <p>Booking "{id}" not found.</p>
            <a href="/bookings" className="primary-button">
              View All Bookings
            </a>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="home">
      <header className="home-header">
        <div className="home-brand">
          <img 
            src="/manus-storage/bob-lifting-your-expectations_2beae224.webp" 
            alt="BOB Cranes" 
            className="home-logo" 
          />
          <div>
            <h1>Booking Dossier</h1>
            <p className="home-meta">{booking.id} - {booking.client}</p>
          </div>
        </div>
        <div className="home-header-actions">
          <a href="/bookings" className="secondary-button">
            Back to Bookings
          </a>
          <a href={`/dept/${booking.departmentCode || "documentation"}`} className="secondary-button">
            Department View
          </a>
        </div>
      </header>

      <main className="home-body">
        <BookingDetail
          booking={booking}
          documents={booking.documents || []}
          allocations={[]}
          generatedBy={user?.name || "System"}
          onBack={handleBack}
          onUpdate={handleUpdate}
          onEditAssignment={() => {}}
          onOpenClientPortal={() => {}}
        />
      </main>
    </div>
  );
}
