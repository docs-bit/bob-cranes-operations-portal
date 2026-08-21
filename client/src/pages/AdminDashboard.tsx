import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { useQuery } from "@tanstack/react-query";
import { 
  BarChart3, 
  Building2, 
  Settings, 
  Users, 
  FileText, 
  AlertTriangle,
  CheckCircle2,
  Clock,
  Truck,
  Wrench
} from "lucide-react";

export default function AdminDashboard() {
  const { user } = useAuth();
  
  // Check if user is admin
  if (!user || user.role !== "admin") {
    return (
      <div className="auth-page">
        <div className="auth-card">
          <h1>Access Denied</h1>
          <p>You need administrator privileges to access this page.</p>
        </div>
      </div>
    );
  }

  // Fetch dashboard data
  const { data: bookings = [] } = trpc.operations.getBookings.useQuery();
  const { data: crew = [] } = trpc.operations.getCrew.useQuery();
  const { data: gears = [] } = trpc.operations.getGears.useQuery();
  const { data: equipment = [] } = trpc.operations.getEquipment.useQuery();

  // Calculate KPIs
  const totalBookings = bookings.length;
  const activeBookings = bookings.filter((b: any) => b.stage !== "Dispatched").length;
  const dispatchedBookings = bookings.filter((b: any) => b.stage === "Dispatched").length;
  const criticalBookings = bookings.filter((b: any) => b.priority === "Critical").length;
  const totalCrew = crew.length;
  const totalGears = gears.length;
  const totalEquipment = equipment.length;

  // Department stats
  const departments = [
    { code: "sales", label: "Sales & Client Relations", icon: Users },
    { code: "documentation", label: "Documentation & Permits", icon: FileText },
    { code: "lifting-gears", label: "Lifting Gears / Engineering", icon: Wrench },
    { code: "maintenance", label: "Maintenance", icon: Settings },
    { code: "crew", label: "Crew / Workmen Assignment", icon: Users },
    { code: "hse", label: "HSE / Safety", icon: AlertTriangle },
    { code: "accounts", label: "Accounts", icon: BarChart3 },
    { code: "hr", label: "HR", icon: Users },
    { code: "transportation", label: "Transportation", icon: Truck },
  ];

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
            <h1>Admin Dashboard</h1>
            <p className="home-meta">System administration and configuration</p>
          </div>
        </div>
        <div className="home-header-actions">
          <span className="status-badge green">System Online</span>
        </div>
      </header>

      <main className="home-body">
        {/* KPI Section */}
        <section className="dashboard-grid">
          <div className="metric-card">
            <div className="metric-icon blue">
              <FileText size={20} />
            </div>
            <div className="metric-content">
              <div className="metric-value">{totalBookings}</div>
              <div className="metric-label">Total Bookings</div>
            </div>
          </div>
          
          <div className="metric-card">
            <div className="metric-icon amber">
              <Clock size={20} />
            </div>
            <div className="metric-content">
              <div className="metric-value">{activeBookings}</div>
              <div className="metric-label">Active Bookings</div>
            </div>
          </div>
          
          <div className="metric-card">
            <div className="metric-icon green">
              <CheckCircle2 size={20} />
            </div>
            <div className="metric-content">
              <div className="metric-value">{dispatchedBookings}</div>
              <div className="metric-label">Dispatched</div>
            </div>
          </div>
          
          <div className="metric-card">
            <div className="metric-icon red">
              <AlertTriangle size={20} />
            </div>
            <div className="metric-content">
              <div className="metric-value">{criticalBookings}</div>
              <div className="metric-label">Critical Priority</div>
            </div>
          </div>
        </section>

        {/* Resource Overview */}
        <section className="dashboard-grid">
          <div className="metric-card">
            <div className="metric-icon blue">
              <Users size={20} />
            </div>
            <div className="metric-content">
              <div className="metric-value">{totalCrew}</div>
              <div className="metric-label">Total Crew</div>
            </div>
          </div>
          
          <div className="metric-card">
            <div className="metric-icon amber">
              <Wrench size={20} />
            </div>
            <div className="metric-content">
              <div className="metric-value">{totalGears}</div>
              <div className="metric-label">Lifting Gears</div>
            </div>
          </div>
          
          <div className="metric-card">
            <div className="metric-icon green">
              <Truck size={20} />
            </div>
            <div className="metric-content">
              <div className="metric-value">{totalEquipment}</div>
              <div className="metric-label">Equipment</div>
            </div>
          </div>
        </section>

        {/* Department Management */}
        <section className="panel">
          <div className="panel-header">
            <div className="panel-title">Department Management</div>
          </div>
          <div className="panel-body">
            <div className="data-table-container">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Department</th>
                    <th>Code</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {departments.map((dept) => (
                    <tr key={dept.code}>
                      <td>
                        <div className="department-cell">
                          <dept.icon size={16} />
                          <span>{dept.label}</span>
                        </div>
                      </td>
                      <td>
                        <code className="department-code">{dept.code}</code>
                      </td>
                      <td>
                        <span className="status-badge green">Active</span>
                      </td>
                      <td>
                        <a href={`/dept/${dept.code}`} className="secondary-button compact-button">
                          View Dashboard
                        </a>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        {/* Integration Status */}
        <section className="panel">
          <div className="panel-header">
            <div className="panel-title">Integration Status</div>
          </div>
          <div className="panel-body">
            <div className="integration-grid">
              <div className="integration-card">
                <div className="integration-icon">
                  <Building2 size={24} />
                </div>
                <div className="integration-info">
                  <h3>Google Drive</h3>
                  <p>Auto-create folders on booking creation</p>
                  <span className="status-badge amber">Configuration Required</span>
                </div>
              </div>
              
              <div className="integration-card">
                <div className="integration-icon">
                  <FileText size={24} />
                </div>
                <div className="integration-info">
                  <h3>Email Dispatch</h3>
                  <p>Send branded emails with PDF bundles</p>
                  <span className="status-badge amber">Configuration Required</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Quick Actions */}
        <section className="panel">
          <div className="panel-header">
            <div className="panel-title">Quick Actions</div>
          </div>
          <div className="panel-body">
            <div className="action-grid">
              <a href="/bookings" className="action-card">
                <FileText size={24} />
                <span>View All Bookings</span>
              </a>
              <a href="/dept/documentation" className="action-card">
                <FileText size={24} />
                <span>Documentation Console</span>
              </a>
              <a href="/dept/crew" className="action-card">
                <Users size={24} />
                <span>Crew Management</span>
              </a>
              <a href="/dept/lifting-gears" className="action-card">
                <Wrench size={24} />
                <span>Gear Compliance</span>
              </a>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
