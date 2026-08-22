import { trpc } from "@/lib/trpc";
import { ArrowRight, BadgeCheck, BriefcaseBusiness, CalendarClock, Check, ChevronDown, ClipboardCheck, FileCheck2, HardHat, Layers3, MapPin, Menu, ShieldCheck, Truck, UsersRound, Wrench, X } from "lucide-react";
import { FormEvent, useEffect, useState } from "react";
import { toast } from "sonner";
import { useLocation } from "wouter";
import { useAuth } from "@/_core/hooks/useAuth";
import { RENTAL_DURATION_OPTIONS, RENTAL_EQUIPMENT_TYPES, type RentalDuration, type RentalEquipmentType } from "@shared/rentalEnquiryOptions";
import "./RentalLanding.css";

const BOB_MODULE_LIFT = "/assets/cranes/industrial-module-lift.jpeg";
const BOB_MARINE_LIFT = "/assets/cranes/marine-tandem-lift.jpeg";
const BOB_MOUNTAIN_LIFT = "/assets/cranes/mountain-access-lift.jpeg";
const BOB_YACHT_LIFT = "/assets/cranes/yacht-lift.jpeg";
const BOB_URBAN_LIFT = "/assets/cranes/urban-tower-crane.jpeg";
const BOB_AIRCRAFT_LIFT = "/assets/cranes/aircraft-lift.jpeg";
const BOB_PIPELINE_LIFT = "/assets/cranes/pipeline-lift.jpeg";

type EnquiryForm = { contactName: string; companyName: string; email: string; phone: string; projectLocation: string; equipmentInterest: RentalEquipmentType; rentalDuration: RentalDuration; liftDetails: string; };
type RentalEstimateEmailInput = Partial<EnquiryForm>;

export function createRentalEstimateEmailBody(input: RentalEstimateEmailInput = {}) {
  const value = (field: keyof RentalEstimateEmailInput, fallback: string) => input[field]?.trim() || fallback;
  return [
  "Hello BOB Cranes team,",
  "",
  "I would like to request a rental estimate.",
  "",
  `Equipment type: ${value("equipmentInterest", "[Select equipment type]")}`,
  `Rental duration: ${value("rentalDuration", "[Select rental duration]")}`,
  `Project location: ${value("projectLocation", "[City / site]")}`,
  "Required start date: [DD/MM/YYYY]",
  `Additional project requirements: ${value("liftDetails", "[Load, access, crew, documentation or other notes]")}`,
  "",
  "Regards,",
  `Name: ${value("contactName", "[Your name]")}`,
  `Company: ${value("companyName", "[Company name]")}`,
  `Email: ${value("email", "[Email address]")}`,
  `Phone: ${value("phone", "[Phone number]")}`,
  ].join("\n");
}

export function buildRentalEstimateMailto(input: RentalEstimateEmailInput = {}) {
  return `mailto:admin@bobcranes.ae?subject=${encodeURIComponent("Rental Estimate Request")}&body=${encodeURIComponent(createRentalEstimateEmailBody(input))}`;
}

export const RENTAL_ESTIMATE_MAILTO = buildRentalEstimateMailto();

const serviceCards = [
  [Truck, "Mobile crane rental", "Right-sized lifting capacity for planned site movements, maintenance and construction work."],
  [Layers3, "Complex lift planning", "Controlled crane, crew, gear and documentation coordination for demanding scopes."],
  [Wrench, "Lifting gear support", "Inspection-aware equipment selection and clear readiness checks before mobilisation."],
  [UsersRound, "Qualified crew", "Operator, rigger, supervisor and banksman roles aligned to the lift brief."],
  [FileCheck2, "Document control", "Required records, permits and client requirements stay visible in the project route."],
  [BriefcaseBusiness, "Dispatch coordination", "One operating handoff from Sales to the teams responsible for readiness and delivery."],
] as const;

const projectCards = [
  ["/assets/cranes/capability-wind-component-lift.jpeg", "Industrial heavy lift", "Project execution", "Engineered lifting support for complex installation scopes."],
  ["/assets/cranes/capability-highrise-lift.jpeg", "Marine and yacht lifting", "Specialist handling", "Coordinated access, equipment and crew readiness for sensitive waterfront work."],
  ["/assets/cranes/capability-residential-lift.jpeg", "Urban crane deployment", "Site coordination", "A controlled operational route for demanding city-centre project conditions."],
] as const;

const processSteps = [
  ["01", "Share the brief. Plan the lift.", "The project team captures location, timing, equipment and site requirements."],
  ["02", "Coordinate readiness before dispatch.", "Sales and operational departments clarify the assets, crew, gear and documents needed."],
  ["03", "Mobilise with a controlled handoff.", "A booking dossier gives each responsible team a visible operational path."],
] as const;

const testimonialCards = [
  [BOB_MODULE_LIFT, "Industrial installation", "Project delivery team", "A clear route from site constraints to crane, crew and readiness decisions gave our team the confidence to plan the installation properly."],
  [BOB_MARINE_LIFT, "Marine heavy lift", "Marine project team", "The handoff was practical and well coordinated, with the essential equipment, people and readiness checks visible before the lift window."],
  [BOB_URBAN_LIFT, "Urban deployment", "City-centre project team", "BOB helped us frame a workable route around access, timing and the operating conditions that matter on a constrained project site."],
] as const;

const emptyEnquiry: EnquiryForm = { contactName: "", companyName: "", email: "", phone: "", projectLocation: "", equipmentInterest: "Mobile crane", rentalDuration: "To be confirmed", liftDetails: "" };
const scrollToId = (id: string) => document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });

export default function RentalLanding() {
  const [, setLocation] = useLocation();
  const { user } = useAuth();
  const submitEnquiry = trpc.rental.submitEnquiry.useMutation();
  const [menuOpen, setMenuOpen] = useState(false);
  const [form, setForm] = useState<EnquiryForm>(emptyEnquiry);
  const [submittedEnquiry, setSubmittedEnquiry] = useState<{ companyName: string; equipmentInterest: string } | null>(null);
  useEffect(() => {
    if (!user) return;
    setForm(current => ({
      ...current,
      contactName: current.contactName || user.name || "",
      email: current.email || user.email || "",
      companyName: current.companyName || user.companyName || "",
      phone: current.phone || user.phone || "",
    }));
  }, [user?.email, user?.id, user?.name]);
  const fieldErrors = {
    contactName: form.contactName.length > 0 && form.contactName.trim().length < 2 ? "Enter at least two characters." : "",
    companyName: form.companyName.length > 0 && form.companyName.trim().length < 2 ? "Enter your company name." : "",
    email: form.email.length > 0 && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email) ? "Enter a valid work email." : "",
    phone: form.phone.length > 0 && form.phone.trim().length < 7 ? "Enter a valid phone number." : "",
    projectLocation: form.projectLocation.length > 0 && form.projectLocation.trim().length < 2 ? "Add a project location." : "",
    liftDetails: form.liftDetails.length > 0 && form.liftDetails.trim().length < 12 ? "Add at least 12 characters so the Sales team can scope the lift." : "",
  };
  const formReady = Boolean(form.contactName.trim() && form.companyName.trim() && form.email.trim() && form.phone.trim() && form.projectLocation.trim() && form.liftDetails.trim()) && !Object.values(fieldErrors).some(Boolean);
  const updateForm = (field: keyof EnquiryForm, value: string) => { setSubmittedEnquiry(null); setForm(current => ({ ...current, [field]: value })); };
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    try { await submitEnquiry.mutateAsync(form); setSubmittedEnquiry({ companyName: form.companyName, equipmentInterest: form.equipmentInterest }); setForm(emptyEnquiry); toast.success("Rental enquiry received", { description: "Sales has been notified to begin the follow-up." }); }
    catch (error) { toast.error("We could not send the enquiry", { description: error instanceof Error ? error.message : "Please review the form and try again." }); }
  };
  const closeMenuAndScroll = (id: string) => { setMenuOpen(false); scrollToId(id); };
  const openRentalEstimateEmail = () => {
    const emailInput = {
      ...form,
      contactName: user?.name || form.contactName,
      email: user?.email || form.email,
      companyName: user?.companyName || form.companyName,
      phone: user?.phone || form.phone,
    };
    toast.info("Opening your email client", { description: "Your rental estimate request template is ready to review and send." });
    window.location.href = buildRentalEstimateMailto(emailInput);
  };

  return <main className="bob-rental" id="top">
    <header className="bob-nav-shell">
      <div className="bob-nav">
        <button className="bob-brand bob-brand-full" onClick={() => scrollToId("top")} aria-label="Back to BOB Heavy Equipment Rental home"><img src="/assets/bob-logo.webp" alt="BOB Cranes — Lifting Your Expectations" /></button>
        <nav className={menuOpen ? "bob-nav-links open" : "bob-nav-links"} aria-label="Primary navigation">
          <button onClick={() => closeMenuAndScroll("services")}>Services</button><button onClick={() => closeMenuAndScroll("projects")}>Projects</button><button onClick={() => closeMenuAndScroll("process")}>Process</button><button onClick={() => closeMenuAndScroll("enquire")}>Contact</button>
          <button className="bob-nav-portal" onClick={() => setLocation("/login")}>Portal sign in <ArrowRight size={13} /></button>
        </nav>
        <button className="bob-menu" onClick={() => setMenuOpen(open => !open)} aria-label={menuOpen ? "Close navigation" : "Open navigation"}>{menuOpen ? <X /> : <Menu />}</button>
      </div>
    </header>

    <section className="bob-hero">
      <img src={BOB_MODULE_LIFT} alt="BOB Cranes lifting an industrial module on a project site" className="bob-hero-image" />
      <div className="bob-hero-shade" />
      <div className="bob-frame bob-hero-grid">
        <div className="bob-hero-copy"><div className="bob-kicker light"><i /> Strong foundations for controlled lifting</div><h1>Every lift starts with <em>precision</em> planning.</h1><p>BOB Heavy Equipment Rental connects crane capacity, crew readiness, gear inspection and documentation into a clear project handoff.</p><div className="bob-actions"><button className="bob-button accent" onClick={() => scrollToId("enquire")}>Request a rental quote <ArrowRight size={16} /></button><button className="bob-button light" onClick={() => scrollToId("projects")}>Explore capability <ChevronDown size={16} /></button></div></div>
        <aside className="bob-hero-card"><div className="bob-card-label"><BadgeCheck size={15} /> Operations-ready rental route</div><img src={BOB_MARINE_LIFT} alt="BOB Cranes completing a tandem marine heavy lift" /><div><strong>Crane, crew, gear and documents in one plan.</strong><button onClick={() => scrollToId("process")}>See how it works <ArrowRight size={14} /></button></div></aside>
      </div>
    </section>

    <section className="bob-intro bob-section"><div className="bob-frame"><div className="bob-intro-top"><div className="bob-side-signal"><span>BOB</span><small>Operational rental coordination</small></div><div><div className="bob-kicker"><i /> Built for project teams</div><h2>Equipment is only one part of a successful lift.</h2><p>Start with a practical rental brief. The BOB workflow helps the right people coordinate equipment, site needs, personnel and paperwork before mobilisation.</p><button className="bob-inline-action" onClick={() => scrollToId("enquire")}>Discuss your requirement <ArrowRight size={14} /></button></div></div><div className="bob-metric-line" aria-label="Operational rental support"><div><span>01</span><strong>Rental brief</strong><small>Project scope captured</small></div><div><span>02</span><strong>Readiness review</strong><small>Assets and checks aligned</small></div><div><span>03</span><strong>Department handoff</strong><small>Visible working ownership</small></div><div><span>04</span><strong>Dispatch route</strong><small>Booking-led coordination</small></div></div></div></section>

    <section className="bob-services bob-section" id="services"><div className="bob-frame"><div className="bob-section-head"><div><div className="bob-kicker"><i /> Our lift services</div><h2>Rental support that follows the work.</h2></div><button className="bob-inline-action" onClick={() => scrollToId("enquire")}>Start an enquiry <ArrowRight size={14} /></button></div><div className="bob-service-grid">{serviceCards.map(([Icon, title, copy]) => <article key={title}><Icon size={26} /><div><h3>{title}</h3><p>{copy}</p><button onClick={() => scrollToId("enquire")}>Learn more <ArrowRight size={13} /></button></div></article>)}</div><div className="bob-service-callout"><img src={BOB_AIRCRAFT_LIFT} alt="BOB Cranes supporting an aircraft lifting project" /><div><div className="bob-kicker"><i /> Rental planning route</div><h3>Prepare the scope before the crane arrives.</h3><p>Use the public enquiry to start the conversation, then let Sales and Operations turn it into a controlled booking route.</p><button className="bob-button dark" onClick={() => scrollToId("enquire")}>Plan a lift <ArrowRight size={15} /></button></div></div></div></section>

    <section className="bob-projects bob-section" id="projects"><div className="bob-frame"><div className="bob-section-head centered"><div className="bob-kicker"><i /> BOB project capability</div><h2>Equipment and operational support in context.</h2><p>Explore the types of support the BOB team coordinates around the lift—not stock claims or invented project outcomes.</p></div><div className="bob-project-grid">{projectCards.map(([image, title, tag, copy]) => <article key={title}><img src={image} alt={`${title} — BOB Cranes project photography`} loading="lazy" /><div><span>{tag}</span><h3>{title}</h3><p>{copy}</p><button onClick={() => scrollToId("enquire")} aria-label={`Discuss ${title}`}><ArrowRight size={15} /></button></div></article>)}</div></div></section>

    <section className="bob-assurance"><div className="bob-frame bob-assurance-grid"><div className="bob-assurance-cta"><div className="bob-kicker light"><i /> Need to start a lift?</div><h2>Give Sales the operational context, not just a crane size.</h2><p>Each rental enquiry becomes a structured follow-up in the Sales workspace, ready for a named owner and clear next action.</p><button className="bob-button light" onClick={() => scrollToId("enquire")}>Request a rental quote <ArrowRight size={15} /></button></div><div className="bob-assurance-card"><img src={BOB_PIPELINE_LIFT} alt="BOB Cranes lifting a pipeline section on a project site" loading="lazy" /><div className="bob-assurance-points"><span><ShieldCheck size={16} /> Readiness-led coordination</span><span><ClipboardCheck size={16} /> Booking dossier creation</span><span><HardHat size={16} /> Department ownership</span></div></div></div></section>

    <section className="bob-process bob-section" id="process"><div className="bob-frame bob-process-grid"><div><div className="bob-kicker"><i /> The BOB route</div><h2>A simple working process, built for site reality.</h2><p>BOB uses a connected workflow so Sales, documentation, crew, gear and operations work from the same project direction.</p><div className="bob-process-bars">{processSteps.map(([number, title, copy], index) => <article className={`step-${index + 1}`} key={number}><span>{number}</span><div><strong>{title}</strong><small>{copy}</small></div></article>)}</div></div><div className="bob-process-image"><img src={BOB_MOUNTAIN_LIFT} alt="BOB mobile crane working on a mountain access project" loading="lazy" /><div><strong>Booking-led workflow</strong><span>From enquiry to dispatch preparation</span></div></div></div></section>

    <section className="bob-testimonials bob-section" id="testimonials"><div className="bob-frame"><div className="bob-section-head centered"><div className="bob-kicker"><i /> Project-team perspective</div><h2>Built around the conditions that matter on site.</h2><p>Representative project-team feedback, paired with the installation environments BOB supports.</p></div><div className="bob-testimonial-grid">{testimonialCards.map(([image, label, role, quote]) => <article key={label}><img src={image} alt={`${label} supported by BOB Cranes`} loading="lazy" /><div><span>{label}</span><blockquote>“{quote}”</blockquote><footer>{role}</footer></div></article>)}</div><p className="bob-testimonial-note">Representative project-team wording is shown with the installation gallery. Replace with approved client quotations and attribution before using named endorsements.</p></div></section>

    <section className="bob-coverage bob-section"><div className="bob-frame bob-coverage-grid"><div className="bob-coverage-art"><img src={BOB_URBAN_LIFT} alt="BOB mobile crane working on an urban project site" loading="lazy" /><div className="bob-coverage-badge"><MapPin size={18} /><span>Project-led support<br /><b>starts with scope</b></span></div></div><div><div className="bob-kicker"><i /> Support, connected</div><h2>One shared route for the people behind the lift.</h2><p>Our public enquiry begins the coordination conversation. The connected portal then provides workspaces for the teams handling readiness, documents, crew and dispatch.</p><div className="bob-role-grid"><span><BriefcaseBusiness size={15} /> Sales follow-up</span><span><FileCheck2 size={15} /> Documentation</span><span><UsersRound size={15} /> Crew assignment</span><span><Wrench size={15} /> Gear readiness</span><span><ShieldCheck size={15} /> HSE coordination</span><span><CalendarClock size={15} /> Mobilisation plan</span></div></div></div></section>

    <section className="bob-enquiry" id="enquire"><div className="bob-frame bob-enquiry-grid"><div className="bob-enquiry-copy"><div className="bob-kicker light"><i /> Start your rental request</div><h2>Tell us what the project needs.</h2><p>Share the essentials now. Sales receives the complete enquiry as an actionable follow-up rather than an unstructured contact message.</p><div className="bob-enquiry-checks"><span><Check size={15} /> Equipment requirement</span><span><Check size={15} /> Project location and timing</span><span><Check size={15} /> Site and documentation context</span></div></div><form className="bob-enquiry-form" onSubmit={submit} noValidate>{submittedEnquiry && <div className="bob-enquiry-success" role="status"><Check size={16} /><span><strong>Quote request received.</strong> Sales has been notified to follow up with {submittedEnquiry.companyName} about {submittedEnquiry.equipmentInterest}.</span></div>}<div className="bob-form-row"><label><span>Full name</span><input required aria-invalid={Boolean(fieldErrors.contactName)} className={fieldErrors.contactName ? "invalid" : ""} value={form.contactName} onChange={event => updateForm("contactName", event.target.value)} placeholder="Your name" />{fieldErrors.contactName && <small>{fieldErrors.contactName}</small>}</label><label><span>Company</span><input required aria-invalid={Boolean(fieldErrors.companyName)} className={fieldErrors.companyName ? "invalid" : ""} value={form.companyName} onChange={event => updateForm("companyName", event.target.value)} placeholder="Company name" />{fieldErrors.companyName && <small>{fieldErrors.companyName}</small>}</label></div><div className="bob-form-row"><label><span>Work email</span><input required type="email" aria-invalid={Boolean(fieldErrors.email)} className={fieldErrors.email ? "invalid" : ""} value={form.email} onChange={event => updateForm("email", event.target.value)} placeholder="name@company.com" />{fieldErrors.email && <small>{fieldErrors.email}</small>}</label><label><span>Phone</span><input required type="tel" aria-invalid={Boolean(fieldErrors.phone)} className={fieldErrors.phone ? "invalid" : ""} value={form.phone} onChange={event => updateForm("phone", event.target.value)} placeholder="Phone number" />{fieldErrors.phone && <small>{fieldErrors.phone}</small>}</label></div><div className="bob-form-row"><label><span>Project location</span><input required aria-invalid={Boolean(fieldErrors.projectLocation)} className={fieldErrors.projectLocation ? "invalid" : ""} value={form.projectLocation} onChange={event => updateForm("projectLocation", event.target.value)} placeholder="City / site location" />{fieldErrors.projectLocation && <small>{fieldErrors.projectLocation}</small>}</label><label><span>Equipment type</span><select value={form.equipmentInterest} onChange={event => updateForm("equipmentInterest", event.target.value as RentalEquipmentType)}>{RENTAL_EQUIPMENT_TYPES.map(equipmentType => <option key={equipmentType} value={equipmentType}>{equipmentType}</option>)}</select></label></div><div className="bob-form-row"><label><span>Rental duration</span><select value={form.rentalDuration} onChange={event => updateForm("rentalDuration", event.target.value as RentalDuration)}>{RENTAL_DURATION_OPTIONS.map(duration => <option key={duration} value={duration}>{duration}</option>)}</select></label><div className="bob-form-context"><span>Estimate template</span><strong>{user ? "Your signed-in name and email will be included." : "Add your details to pre-fill the email template."}</strong></div></div><label><span>Lift or project details</span><textarea required minLength={12} aria-invalid={Boolean(fieldErrors.liftDetails)} className={fieldErrors.liftDetails ? "invalid" : ""} value={form.liftDetails} onChange={event => updateForm("liftDetails", event.target.value)} placeholder="Describe the load, timing, site access, documentation needs or anything the planning team should know." />{fieldErrors.liftDetails && <small>{fieldErrors.liftDetails}</small>}</label><button className="bob-button accent" type="submit" disabled={submitEnquiry.isPending || !formReady}>{submitEnquiry.isPending ? "Sending enquiry…" : "Send rental enquiry"}<ArrowRight size={16} /></button></form></div></section>

    <footer className="bob-footer"><div className="bob-frame"><div className="bob-final-cta"><div><div className="bob-kicker light"><i /> BOB Heavy Equipment Rental</div><h2>Ready to coordinate the next lift?</h2></div><button className="bob-button accent" onClick={openRentalEstimateEmail} aria-label="Email admin@bobcranes.ae for a rental estimate">Get a rental estimate <ArrowRight size={16} /></button></div><div className="bob-footer-grid"><div><div className="bob-brand bob-brand-full static"><img src="/assets/bob-logo.webp" alt="BOB Cranes — Lifting Your Expectations" /></div><p>Crane rental and coordinated lifting support for project teams that need a more controlled operational path.</p></div><div><h3>Explore</h3><button onClick={() => scrollToId("services")}>Services</button><button onClick={() => scrollToId("projects")}>Capability</button><button onClick={() => scrollToId("process")}>Working process</button></div><div><h3>Start a conversation</h3><button onClick={() => scrollToId("enquire")}>Request quotation</button><button onClick={() => scrollToId("enquire")}>Discuss complex lift</button><button onClick={() => setLocation("/login")}>Operations portal</button></div></div><div className="bob-footer-bottom"><span>© {new Date().getFullYear()} BOB Heavy Equipment Rental. All rights reserved.</span><span>Crane · crew · gear · documents · dispatch</span></div></div></footer>
  </main>;
}
