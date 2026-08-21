import { useLocation } from "wouter";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { BookingsView } from "@/pages/views";
import { initialBookings } from "@/pages/views/shared";

export default function BookingsPage() {
  const [, setLocation] = useLocation();
  const { user } = useAuth();

  // Fetch bookings
  const { data: bookings = initialBookings } = trpc.operations.getBookings.useQuery();
  const typedBookings = bookings as any[];

  // Handle booking detail navigation
  const handleSetDetail = (booking: any) => {
    setLocation(`/bookings/${booking.id}`);
  };

  // Handle booking selection
  const handleSelectBooking = (bookingId: string) => {
    setLocation(`/bookings/${bookingId}`);
  };

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
            <h1>Bookings Pipeline</h1>
            <p className="home-meta">Kanban view of all bookings</p>
          </div>
        </div>
        <div className="home-header-actions">
          <a href="/admin" className="secondary-button">
            Admin Dashboard
          </a>
        </div>
      </header>

      <main className="home-body">
        <BookingsView
          bookings={typedBookings}
          setView={() => {}}
          setDetail={handleSetDetail}
        />
      </main>
    </div>
  );
}
