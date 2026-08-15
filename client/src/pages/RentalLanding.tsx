import { trpc } from "@/lib/trpc";
import {
  ArrowRight,
  BadgeCheck,
  Check,
  ChevronDown,
  ClipboardCheck,
  HardHat,
  Menu,
  ShieldCheck,
  Truck,
  X,
} from "lucide-react";
import { FormEvent, useState } from "react";
import { toast } from "sonner";
import { useLocation } from "wouter";
import "./RentalLanding.css";

const equipmentCategories = [
  {
    eyebrow: "01 · Mobile cranes",
    title: "Reach every point on site.",
    copy: "Mobile lifting support for planned construction, maintenance and day-to-day project requirements.",
    image: "/manus-storage/bob-bridge-project_264a6ce0.webp",
    tone: "dark",
  },
  {
    eyebrow: "02 · Complex lifts",
    title: "Built for controlled heavy lifts.",
    copy: "Crawler-crane support, engineered lifting arrangements and coordinated site mobilisation for demanding scope.",
    image: "/manus-storage/bob-mobile-fleet-hero_7ad7f04b.webp",
    tone: "light",
  },
  {
    eyebrow: "03 · Transport & support",
    title: "The lift is only the start.",
    copy: "Trailers, lifting gear, qualified crew and clear documentation stay connected throughout the project handoff.",
    image: "/manus-storage/bob-bridge-lift_9aaf9ad5.jpg",
    tone: "dark",
  },
] as const;

const rentalPlans = [
  {
    label: "Flexible hire",
    title: "Equipment rental",
    copy: "For defined scopes that need the right asset, transparent documentation requirements and responsive coordination.",
    points: ["Mobile crane options", "Lifting gear coordination", "Planned dispatch support"],
    cta: "Discuss equipment hire",
    featured: false,
  },
  {
    label: "Most requested",
    title: "Managed lifting service",
    copy: "A coordinated lifting package with crane, crew, gear, compliance preparation and live operational handoffs.",
    points: ["Certified crew allocation", "Project documentation workflow", "Mobilisation readiness review"],
    cta: "Plan a managed lift",
    featured: true,
  },
  {
    label: "Complex projects",
    title: "Engineered lift support",
    copy: "For multi-party or high-control work requiring tailored planning, evidence checks and escalation visibility.",
    points: ["Scope & lift review", "Multi-department coordination", "Dispatch-ready dossier"],
    cta: "Speak to operations",
    featured: false,
  },
] as const;

const processSteps = [
  ["01", "Brief the lift", "Share the site, timing, equipment need and project constraints. Our team captures the operational brief in one place."],
  ["02", "Review readiness", "We align equipment, crew, lifting gear and the documentation path needed for a clear mobilisation decision."],
  ["03", "Mobilise with control", "The working team receives a connected dossier, visible responsibilities and live department handoffs."],
  ["04", "Close out clearly", "Completion, off-hire and final records stay traceable for the project team and future reference."],
] as const;

type EnquiryForm = {
  contactName: string;
  companyName: string;
  email: string;
  phone: string;
  projectLocation: string;
  equipmentInterest: string;
  liftDetails: string;
};

const emptyEnquiry: EnquiryForm = {
  contactName: "",
  companyName: "",
  email: "",
  phone: "",
  projectLocation: "",
  equipmentInterest: "Mobile crane rental",
  liftDetails: "",
};

function scrollToId(id: string) {
  document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
}

export default function RentalLanding() {
  const [, setLocation] = useLocation();
  const submitEnquiry = trpc.rental.submitEnquiry.useMutation();
  const [menuOpen, setMenuOpen] = useState(false);
  const [form, setForm] = useState<EnquiryForm>(emptyEnquiry);

  const updateForm = (field: keyof EnquiryForm, value: string) =>
    setForm(current => ({ ...current, [field]: value }));

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    try {
      await submitEnquiry.mutateAsync(form);
      setForm(emptyEnquiry);
      toast.success("Rental enquiry received", {
        description: "The BOB team has the project brief and can follow up with the next steps.",
      });
    } catch (error) {
      toast.error("We could not send the enquiry", {
        description: error instanceof Error ? error.message : "Please review the form and try again.",
      });
    }
  };

  const closeMenuAndScroll = (id: string) => {
    setMenuOpen(false);
    scrollToId(id);
  };

  return (
    <main className="rental-landing">
      <header className="rental-header">
        <button className="rental-brand" onClick={() => scrollToId("top")} aria-label="Back to BOB Heavy Equipment Rental home">
          <img src="/manus-storage/bob-cranes-mark_c80bfee2.png" alt="" />
          <span>BOB <b>HEAVY EQUIPMENT</b></span>
        </button>
        <nav className={`rental-nav ${menuOpen ? "open" : ""}`} aria-label="Primary navigation">
          <button onClick={() => closeMenuAndScroll("fleet")}>Fleet</button>
          <button onClick={() => closeMenuAndScroll("services")}>Services</button>
          <button onClick={() => closeMenuAndScroll("how-it-works")}>How it works</button>
          <button onClick={() => closeMenuAndScroll("enquire")}>Contact</button>
          <button className="rental-nav-portal" onClick={() => setLocation("/login")}>Portal sign in <ArrowRight size={14} /></button>
        </nav>
        <button className="rental-menu-button" onClick={() => setMenuOpen(open => !open)} aria-label={menuOpen ? "Close navigation" : "Open navigation"} aria-expanded={menuOpen}>{menuOpen ? <X /> : <Menu />}</button>
      </header>

      <section className="rental-hero" id="top">
        <div className="rental-hero-image" />
        <div className="rental-hero-scrim" />
        <div className="rental-container rental-hero-content">
          <div className="rental-eyebrow rental-eyebrow-light"><span /> BOB Heavy Equipment Rental</div>
          <h1>Every lift deserves <em>more</em> than equipment.</h1>
          <p>Crane rental, lifting support and controlled project handoffs for teams that need readiness, traceability and practical site coordination.</p>
          <div className="rental-hero-actions">
            <button className="rental-button rental-button-light" onClick={() => scrollToId("enquire")}>Request a rental quote <ArrowRight size={16} /></button>
            <button className="rental-button rental-button-ghost" onClick={() => scrollToId("fleet")}>Explore the fleet <ChevronDown size={16} /></button>
          </div>
        </div>
        <aside className="rental-hero-proof" aria-label="Operational highlights">
          <div><BadgeCheck size={16} /><span>Equipment-led planning</span></div>
          <div><ShieldCheck size={16} /><span>Document-controlled readiness</span></div>
          <div><HardHat size={16} /><span>Coordinated crew support</span></div>
          <div><Truck size={16} /><span>Transport and mobilisation</span></div>
        </aside>
      </section>

      <section className="rental-intro rental-section">
        <div className="rental-container">
          <div className="rental-statement-panel">
            <div>
              <div className="rental-eyebrow"><span /> Lift readiness, connected</div>
              <h2>One operational path from enquiry to off-hire.</h2>
            </div>
            <p>BOB aligns equipment availability, crew assignments, lifting gear validity, client documentation and department actions in a connected operational workflow.</p>
          </div>
          <div className="rental-metric-strip" aria-label="BOB rental service highlights">
            <div><strong>Crane</strong><span>rental options</span></div>
            <div><strong>Crew</strong><span>readiness checks</span></div>
            <div><strong>Gear</strong><span>certificate control</span></div>
            <div><strong>Docs</strong><span>dispatch workflow</span></div>
          </div>
        </div>
      </section>

      <section className="rental-section rental-fleet-section" id="fleet">
        <div className="rental-container">
          <div className="rental-section-heading rental-section-heading-split">
            <div><div className="rental-eyebrow"><span /> Equipment capability</div><h2>Fleet support for the work in front of you.</h2></div>
            <p>Choose the support level that matches your lifting scope. Every enquiry begins with a practical review of site context, timing and required documentation.</p>
          </div>
          <div className="rental-equipment-grid">
            {equipmentCategories.map((category, index) => (
              <article className={`rental-equipment-card rental-equipment-card-${index + 1} ${category.tone}`} key={category.title}>
                <img src={category.image} alt="" loading={index === 0 ? "eager" : "lazy"} />
                <div className="rental-equipment-overlay" />
                <div className="rental-equipment-copy">
                  <div className="rental-card-eyebrow">{category.eyebrow}</div>
                  <h3>{category.title}</h3>
                  <p>{category.copy}</p>
                  <button onClick={() => scrollToId("enquire")}>Discuss this requirement <ArrowRight size={15} /></button>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="rental-band">
        <img src="/manus-storage/bob-bridge-project_264a6ce0.webp" alt="BOB Cranes supporting a bridge construction lift" loading="lazy" />
        <div className="rental-band-overlay" />
        <div className="rental-container rental-band-content">
          <div className="rental-eyebrow rental-eyebrow-light"><span /> Lift operations support</div>
          <h2>From the first brief to a dispatch-ready lift.</h2>
          <p>Equipment matters. So do the crew, the documents, the inspection status and the people who own each next step.</p>
          <button className="rental-button rental-button-light" onClick={() => scrollToId("how-it-works")}>See the process <ArrowRight size={16} /></button>
        </div>
      </section>

      <section className="rental-section rental-services" id="services">
        <div className="rental-container">
          <div className="rental-section-heading centered"><div className="rental-eyebrow"><span /> Rental support options</div><h2>A clearer way to plan lifting support.</h2><p>Start with the service model that best matches your scope. The BOB team can then shape the operational detail around the project.</p></div>
          <div className="rental-plan-grid">
            {rentalPlans.map(plan => (
              <article className={`rental-plan ${plan.featured ? "featured" : ""}`} key={plan.title}>
                <span className="rental-plan-label">{plan.label}</span>
                <h3>{plan.title}</h3>
                <p>{plan.copy}</p>
                <ul>{plan.points.map(point => <li key={point}><Check size={14} />{point}</li>)}</ul>
                <button onClick={() => scrollToId("enquire")}>{plan.cta}<ArrowRight size={15} /></button>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="rental-section rental-process" id="how-it-works">
        <div className="rental-container">
          <div className="rental-process-feature">
            <img src="/manus-storage/bob-mobile-fleet-hero_7ad7f04b.webp" alt="BOB Cranes mobile crane fleet" loading="lazy" />
            <div><div className="rental-eyebrow"><span /> BOB lift protocol</div><h2>Work through each stage with confidence.</h2><p>BOB’s operations portal turns the project brief into a visible workflow, giving the right department the right responsibility at the right time.</p><button className="rental-text-link" onClick={() => setLocation("/login")}>Access the operations portal <ArrowRight size={15} /></button></div>
          </div>
          <div className="rental-process-list">
            {processSteps.map(([number, title, copy]) => <article key={number}><span>{number}</span><div><h3>{title}</h3><p>{copy}</p></div></article>)}
          </div>
        </div>
      </section>

      <section className="rental-confidence">
        <div className="rental-container rental-confidence-grid">
          <div><div className="rental-eyebrow"><span /> Practical project controls</div><h2>Information that stays connected to the lift.</h2><p>Our operational model gives project teams one place to coordinate the equipment, people and documents required before dispatch.</p><button className="rental-button rental-button-dark" onClick={() => scrollToId("enquire")}>Start a rental enquiry <ArrowRight size={16} /></button></div>
          <div className="rental-confidence-list">
            <div><ClipboardCheck size={18} /><span><strong>Clear documentation route</strong><small>Requirements, uploads and approvals can be tracked in a project dossier.</small></span></div>
            <div><ShieldCheck size={18} /><span><strong>Compliance-aware selection</strong><small>Equipment and lifting gear can be checked against recorded inspection validity.</small></span></div>
            <div><HardHat size={18} /><span><strong>Role-based coordination</strong><small>Sales, documentation, HSE and operations teams can work in their own connected spaces.</small></span></div>
          </div>
        </div>
      </section>

      <section className="rental-enquiry" id="enquire">
        <div className="rental-container rental-enquiry-grid">
          <div className="rental-enquiry-copy"><div className="rental-eyebrow rental-eyebrow-light"><span /> Plan your next lift</div><h2>Tell us what the project needs.</h2><p>Share the essential project information and the BOB team can begin the right rental and readiness conversation.</p><div className="rental-enquiry-points"><span><Check size={15} />Equipment and capacity requirement</span><span><Check size={15} />Project location and mobilisation window</span><span><Check size={15} />Site, crew and documentation considerations</span></div></div>
          <form className="rental-enquiry-form" onSubmit={submit}>
            <div className="rental-form-row"><label><span>Full name</span><input required value={form.contactName} onChange={event => updateForm("contactName", event.target.value)} placeholder="Your name" /></label><label><span>Company</span><input required value={form.companyName} onChange={event => updateForm("companyName", event.target.value)} placeholder="Company name" /></label></div>
            <div className="rental-form-row"><label><span>Work email</span><input required type="email" value={form.email} onChange={event => updateForm("email", event.target.value)} placeholder="name@company.com" /></label><label><span>Phone</span><input required type="tel" value={form.phone} onChange={event => updateForm("phone", event.target.value)} placeholder="Phone number" /></label></div>
            <div className="rental-form-row"><label><span>Project location</span><input required value={form.projectLocation} onChange={event => updateForm("projectLocation", event.target.value)} placeholder="City / site location" /></label><label><span>Equipment interest</span><select value={form.equipmentInterest} onChange={event => updateForm("equipmentInterest", event.target.value)}><option>Mobile crane rental</option><option>Crawler crane / complex lift</option><option>Transport and trailers</option><option>Lifting gear and rigging</option><option>Managed lifting service</option></select></label></div>
            <label><span>Lift or project details</span><textarea required minLength={12} value={form.liftDetails} onChange={event => updateForm("liftDetails", event.target.value)} placeholder="Describe the load, timing, site access, documentation needs or anything the planning team should know." /></label>
            <button className="rental-button rental-button-dark" type="submit" disabled={submitEnquiry.isPending}>{submitEnquiry.isPending ? "Sending enquiry…" : "Send rental enquiry"}<ArrowRight size={16} /></button>
          </form>
        </div>
      </section>

      <footer className="rental-footer">
        <div className="rental-container">
          <div className="rental-final-cta"><div><div className="rental-eyebrow rental-eyebrow-light"><span /> BOB Heavy Equipment Rental</div><h2>Ready to coordinate the next lift?</h2></div><div><button className="rental-button rental-button-light" onClick={() => scrollToId("enquire")}>Request a rental quote <ArrowRight size={16} /></button><button className="rental-button rental-button-ghost" onClick={() => setLocation("/login")}>Portal sign in <ArrowRight size={16} /></button></div></div>
          <div className="rental-footer-grid"><div><div className="rental-brand rental-brand-static"><img src="/manus-storage/bob-cranes-mark_c80bfee2.png" alt="BOB Cranes" /><span>BOB <b>HEAVY EQUIPMENT</b></span></div><p>Crane rental and coordinated lifting support for project teams that need a more controlled operational path.</p></div><div><h3>Equipment</h3><button onClick={() => scrollToId("fleet")}>Mobile cranes</button><button onClick={() => scrollToId("fleet")}>Crawler cranes</button><button onClick={() => scrollToId("fleet")}>Transport & trailers</button><button onClick={() => scrollToId("fleet")}>Lifting gear</button></div><div><h3>Services</h3><button onClick={() => scrollToId("services")}>Equipment rental</button><button onClick={() => scrollToId("services")}>Managed lifting</button><button onClick={() => scrollToId("how-it-works")}>Project workflow</button><button onClick={() => setLocation("/login")}>Operations portal</button></div><div><h3>Start a conversation</h3><button onClick={() => scrollToId("enquire")}>Request a quotation</button><button onClick={() => scrollToId("enquire")}>Discuss a complex lift</button><button onClick={() => scrollToId("enquire")}>Plan mobilisation</button></div></div>
          <div className="rental-footer-bottom"><span>© {new Date().getFullYear()} BOB Heavy Equipment Rental. All rights reserved.</span><span>Operational support for crane, crew, gear and documentation coordination.</span></div>
        </div>
      </footer>
    </main>
  );
}
