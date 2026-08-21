import { useParams, useLocation } from "wouter";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { DepartmentView } from "@/pages/views";
import { initialBookings } from "@/pages/views/shared";

export default function DepartmentPage() {
  const { deptCode } = useParams();
  const [, setLocation] = useLocation();
  const { user } = useAuth();

  // Fetch bookings
  const { data: bookings = initialBookings } = trpc.operations.getBookings.useQuery();
  const typedBookings = bookings as any[];

  // Map URL codes to display names
  const departmentMap: Record<string, string> = {
    sales: "Sales & Client Relations",
    documentation: "Documentation & Permits",
    "lifting-gears": "Lifting Gears / Engineering",
    maintenance: "Maintenance",
    crew: "Crew / Workmen Assignment",
    hse: "HSE / Safety",
    accounts: "Accounts",
    hr: "HR",
    transportation: "Transportation",
    administrator: "Administrator / Super Admin",
  };

  const department = departmentMap[deptCode ?? ""] ?? "Administrator / Super Admin";

  // Handle booking detail navigation
  const handleSetDetail = (booking: any) => {
    setLocation(`/bookings/${booking.id}`);
  };

  // Handle stage advancement
  const handleAdvance = (booking: any, config: any) => {
    // This would call the advance mutation
    console.log("Advance booking:", booking.id, config);
  };

  // Handle workstream completion
  const handleCompleteWorkstream = (booking: any, config: any) => {
    // This would call the complete workstream mutation
    console.log("Complete workstream:", booking.id, config);
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
            <h1>{department}</h1>
            <p className="home-meta">Department workspace</p>
          </div>
        </div>
        <div className="home-header-actions">
          <a href="/bookings" className="secondary-button">
            Back to Bookings
          </a>
          <a href="/admin" className="secondary-button">
            Admin Dashboard
          </a>
        </div>
      </header>

      <main className="home-body">
        <DepartmentView
          department={department}
          bookings={typedBookings}
          setDetail={handleSetDetail}
          onAdvance={handleAdvance}
          onCompleteWorkstream={handleCompleteWorkstream}
          completedWorkstreams={{}}
        />
      </main>
    </div>
  );
}
