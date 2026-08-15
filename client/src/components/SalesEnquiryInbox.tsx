import { trpc } from "@/lib/trpc";
import { ArrowRight, BriefcaseBusiness, CheckCircle2, ClipboardCheck, LoaderCircle, MapPin, RefreshCw, UserRound, X } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import "./SalesEnquiryInbox.css";

const enquiryStatuses = ["all", "New", "In review", "Quoted", "Converted", "Closed"] as const;
type EnquiryStatusFilter = (typeof enquiryStatuses)[number];

type BookingPreview = {
  id: string;
  clientName?: string;
  projectName?: string;
  stage?: string;
  priority?: string;
  mobilizationDate?: string;
  offHireDate?: string;
  projectManager?: string;
  clientContactName?: string;
};

export default function SalesEnquiryInbox({
  actor,
  onOpenBooking,
}: {
  actor: { id: number; role: "admin" | "supervisor" | "user"; departmentCode?: string | null };
  onOpenBooking: (booking: BookingPreview) => void;
}) {
  const utils = trpc.useUtils();
  const [status, setStatus] = useState<EnquiryStatusFilter>("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const listInput = useMemo(() => ({ status }), [status]);
  const enquiriesQuery = trpc.salesEnquiries.list.useQuery(listInput);
  const usersQuery = trpc.auth.listUsers.useQuery(undefined, { enabled: actor.role === "admin" || actor.role === "supervisor" });
  const updateStatus = trpc.salesEnquiries.updateStatus.useMutation();
  const assignOwner = trpc.salesEnquiries.assignOwner.useMutation();
  const convertToBooking = trpc.salesEnquiries.convertToBooking.useMutation();
  const enquiries = enquiriesQuery.data ?? [];
  const selected = enquiries.find(enquiry => enquiry.id === selectedId) ?? null;
  const salesOwners = useMemo(() => (usersQuery.data ?? []).filter(user => user.departmentCode === "sales" && user.isActive === 1), [usersQuery.data]);
  const canAssign = actor.role === "admin" || actor.role === "supervisor";
  const ownerById = useMemo(() => new Map(salesOwners.map(owner => [owner.id, owner])), [salesOwners]);
  const refresh = async () => {
    await Promise.all([utils.salesEnquiries.list.invalidate(), utils.auth.listUsers.invalidate()]);
  };
  const changeStatus = async (id: string, nextStatus: Exclude<EnquiryStatusFilter, "all">) => {
    try {
      await updateStatus.mutateAsync({ id, status: nextStatus });
      await refresh();
      toast.success("Enquiry status updated", { description: `This quote request is now marked ${nextStatus}.` });
    } catch (error) {
      toast.error("Status update failed", { description: error instanceof Error ? error.message : "Please try again." });
    }
  };
  const changeOwner = async (id: string, ownerId: string) => {
    try {
      await assignOwner.mutateAsync({ id, assignedToUserId: ownerId === "unassigned" ? null : Number(ownerId) });
      await refresh();
      toast.success(ownerId === "unassigned" ? "Ownership cleared" : "Sales owner assigned", { description: "The selected owner receives a follow-up notification." });
    } catch (error) {
      toast.error("Owner assignment failed", { description: error instanceof Error ? error.message : "Select an active Sales account and try again." });
    }
  };
  const convert = async (id: string) => {
    try {
      const result = await convertToBooking.mutateAsync({ id });
      await refresh();
      toast.success("Converted to booking", { description: `${result.booking.id} is now ready for Sales to complete.` });
      setSelectedId(null);
      onOpenBooking(result.booking as BookingPreview);
    } catch (error) {
      toast.error("Booking conversion failed", { description: error instanceof Error ? error.message : "Please try again." });
    }
  };

  return <div className="content sales-enquiry-inbox" data-testid="sales-enquiry-inbox">
    <div className="page-heading"><div><div className="eyebrow">Sales follow-up workspace</div><h1 className="page-title">Rental enquiry inbox</h1><p className="page-copy">Review new rental requests, assign a Sales owner, update progress, and convert qualified enquiries into booking dossiers.</p></div><div className="status-badge blue"><BriefcaseBusiness size={12} /> Sales workspace</div></div>
    <div className="metric-grid"><div className="metric-card"><div className="metric-label">Visible requests</div><div className="metric-value">{enquiries.length}</div><div className="metric-foot">Filtered by current status</div></div><div className="metric-card"><div className="metric-label">Needs review</div><div className="metric-value">{enquiries.filter(enquiry => enquiry.status === "New").length}</div><div className="metric-foot">New rental follow-ups</div></div><div className="metric-card"><div className="metric-label">Assigned</div><div className="metric-value">{enquiries.filter(enquiry => enquiry.assignedToUserId).length}</div><div className="metric-foot">Named Sales ownership</div></div><div className="metric-card"><div className="metric-label">Converted</div><div className="metric-value">{enquiries.filter(enquiry => enquiry.status === "Converted").length}</div><div className="metric-foot">Tracked booking dossiers</div></div></div>
    <section className="panel"><div className="panel-header"><div><div className="panel-title"><ClipboardCheck size={16} /> Quote follow-up queue</div><div className="panel-meta">Every request entered from the public rental form appears here with its Sales notification context.</div></div><button type="button" className="secondary-button compact-button" onClick={() => void refresh()} disabled={enquiriesQuery.isFetching}><RefreshCw size={13} /> {enquiriesQuery.isFetching ? "Refreshing…" : "Refresh"}</button></div><div className="panel-body"><div className="sales-enquiry-toolbar"><label><span>Status</span><select className="form-select" value={status} onChange={event => { setStatus(event.target.value as EnquiryStatusFilter); setSelectedId(null); }}><option value="all">All statuses</option><option value="New">New</option><option value="In review">In review</option><option value="Quoted">Quoted</option><option value="Converted">Converted</option><option value="Closed">Closed</option></select></label><span className="status-badge blue">{enquiries.length} results</span></div>{enquiriesQuery.isLoading ? <div className="empty-state">Loading Sales enquiries…</div> : enquiriesQuery.error ? <div className="account-error">Unable to load quote requests. Please refresh the workspace.</div> : enquiries.length ? <div className="sales-enquiry-table-wrap"><table className="sales-enquiry-table"><thead><tr><th>Request</th><th>Project requirement</th><th>Status</th><th>Owner</th><th aria-label="Actions" /></tr></thead><tbody>{enquiries.map(enquiry => { const owner = enquiry.assignedToUserId ? ownerById.get(enquiry.assignedToUserId) : undefined; return <tr key={enquiry.id}><td><strong>{enquiry.companyName}</strong><span>{enquiry.contactName} · {enquiry.email}</span><small>{new Date(enquiry.createdAt).toLocaleDateString()}</small></td><td><strong>{enquiry.equipmentInterest}</strong><span><MapPin size={12} /> {enquiry.projectLocation}</span></td><td><span className={`status-badge ${enquiry.status === "Converted" ? "green" : enquiry.status === "New" ? "amber" : "blue"}`}>{enquiry.status}</span></td><td>{owner ? <span className="sales-owner"><UserRound size={13} /> {owner.name ?? owner.email}</span> : <span className="muted">Unassigned</span>}</td><td><button type="button" className="secondary-button compact-button" onClick={() => setSelectedId(enquiry.id)}>Open <ArrowRight size={13} /></button></td></tr>; })}</tbody></table></div> : <div className="empty-state">No rental enquiries match this status. New public quote requests will appear here automatically.</div>}</div></section>
    {selected && <div className="modal-backdrop" role="presentation" onClick={() => setSelectedId(null)}><section className="sales-enquiry-detail" role="dialog" aria-modal="true" aria-labelledby="sales-enquiry-title" onClick={event => event.stopPropagation()}><div className="sales-enquiry-detail-header"><div><div className="eyebrow">Rental enquiry</div><h2 id="sales-enquiry-title">{selected.companyName}</h2><p>{selected.contactName} · {selected.email} · {selected.phone}</p></div><button className="icon-button" type="button" onClick={() => setSelectedId(null)} aria-label="Close enquiry details"><X size={17} /></button></div><div className="sales-enquiry-detail-grid"><article><span>Requested equipment</span><strong>{selected.equipmentInterest}</strong></article><article><span>Project location</span><strong>{selected.projectLocation}</strong></article><article><span>Follow-up status</span><select className="form-select" value={selected.status} disabled={selected.status === "Converted" || updateStatus.isPending} onChange={event => void changeStatus(selected.id, event.target.value as Exclude<EnquiryStatusFilter, "all">)}><option value="New">New</option><option value="In review">In review</option><option value="Quoted">Quoted</option><option value="Converted">Converted</option><option value="Closed">Closed</option></select></article><article><span>Sales owner</span>{canAssign ? <select className="form-select" value={selected.assignedToUserId?.toString() ?? "unassigned"} disabled={assignOwner.isPending || selected.status === "Converted"} onChange={event => void changeOwner(selected.id, event.target.value)}><option value="unassigned">Unassigned</option>{salesOwners.map(owner => <option key={owner.id} value={owner.id}>{owner.name ?? owner.email}</option>)}</select> : <strong>{selected.assignedToUserId ? ownerById.get(selected.assignedToUserId)?.name ?? "Assigned Sales user" : "Unassigned"}</strong>}</article></div><section className="sales-enquiry-notes"><span>Lift or project details</span><p>{selected.liftDetails}</p></section><div className="sales-enquiry-detail-actions">{selected.convertedBookingId ? <button type="button" className="primary-button" onClick={() => onOpenBooking({ id: selected.convertedBookingId!, clientName: selected.companyName, projectName: `Rental enquiry · ${selected.projectLocation}`, stage: "Created by Salesperson", priority: "Standard", mobilizationDate: "To be confirmed", offHireDate: "To be confirmed", projectManager: "Sales follow-up", clientContactName: selected.contactName })}><CheckCircle2 size={14} /> Open {selected.convertedBookingId}</button> : <button type="button" className="primary-button" disabled={convertToBooking.isPending} onClick={() => void convert(selected.id)}><LoaderCircle size={14} className={convertToBooking.isPending ? "spin" : ""} />{convertToBooking.isPending ? "Converting…" : "Convert to booking"}</button>}<button type="button" className="secondary-button" onClick={() => setSelectedId(null)}>Close</button></div></section></div>}
  </div>;
}
