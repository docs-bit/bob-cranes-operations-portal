import React, { useState } from "react";
import { toast } from "sonner";
import { Award, CalendarDays, Plus } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { PageHeading } from "./OverviewHelpers";
import { StatusBadge } from "./primitives";

/**
 * HSE scheduled trainings (PRD v3.0 §12.3): plan sessions, track
 * attendees, and issue certificates that feed certificate-expiry
 * tracking automatically.
 */
export function HSETrainingsView() {
  const trainingsQuery = trpc.operations.listTrainings.useQuery(undefined, {});
  const certsQuery = trpc.operations.listEmployeeCertificates.useQuery(undefined, {});
  const createMutation = trpc.operations.createTraining.useMutation();
  const issueMutation = trpc.operations.issueTrainingCertificates.useMutation();

  const [title, setTitle] = useState("");
  const [trainer, setTrainer] = useState("");
  const [startsAt, setStartsAt] = useState("");
  const [durationMins, setDurationMins] = useState("120");
  const [location, setLocation] = useState("");
  const [attendees, setAttendees] = useState("");
  const [issuesCert, setIssuesCert] = useState(false);
  const [validityMonths, setValidityMonths] = useState("12");
  const [notes, setNotes] = useState("");

  const create = () => {
    if (!title.trim() || !trainer.trim() || !startsAt.trim()) {
      toast.error("Title, trainer, and start required", {
        description: "The schedule needs the basics before it can be saved.",
      });
      return;
    }
    void createMutation
      .mutateAsync({
        title: title.trim(),
        trainer: trainer.trim(),
        startsAt: startsAt.trim(),
        durationMins: Number(durationMins) || null,
        location: location.trim() || null,
        notes: notes.trim() || null,
        certificateIssued: issuesCert ? 1 : 0,
        validityMonths: issuesCert ? Number(validityMonths) || 12 : null,
        attendees: attendees.split(",").map(name => name.trim()).filter(Boolean),
      })
      .then(() => trainingsQuery.refetch())
      .then(() => {
        setTitle(""); setTrainer(""); setStartsAt(""); setDurationMins("120");
        setLocation(""); setAttendees(""); setIssuesCert(false);
        setValidityMonths("12"); setNotes("");
        toast.success("Training scheduled");
      })
      .catch((caught: unknown) => {
        toast.error("Schedule not saved", {
          description: caught instanceof Error ? caught.message : "Please try again.",
        });
      });
  };

  const issue = (trainingId: string, trainingTitle: string) => {
    void issueMutation
      .mutateAsync({ trainingId })
      .then(result => certsQuery.refetch().then(() => result))
      .then(result =>
        toast.success("Certificates issued", {
          description: `${result.count} certificates for "${trainingTitle}" expiring ${result.expiresAt}.`,
        })
      )
      .catch((caught: unknown) => {
        toast.error("Issue failed", {
          description: caught instanceof Error ? caught.message : "Please try again.",
        });
      });
  };

  const trainings = trainingsQuery.data ?? [];
  const certs = certsQuery.data ?? [];

  return (
    <div className="content">
      <PageHeading
        eyebrow="HSE / Safety"
        title="Scheduled trainings"
        copy="Plan sessions and issue certificates — expiry tracking starts the moment training is logged."
      />
      <div className="panel" style={{ marginBottom: 16 }}>
        <div className="panel-header">
          <div className="panel-title">
            <CalendarDays size={15} /> New training session
          </div>
        </div>
        <div className="detail-list">
          <div className="detail-cell">
            <label>Title</label>
            <input aria-label="Training title" value={title} onChange={event => setTitle(event.target.value)} style={{ width: "100%" }} />
          </div>
          <div className="detail-cell">
            <label>Trainer</label>
            <input aria-label="Trainer" value={trainer} onChange={event => setTrainer(event.target.value)} style={{ width: "100%" }} />
          </div>
          <div className="detail-cell">
            <label>Starts (date and time)</label>
            <input aria-label="Training start" value={startsAt} onChange={event => setStartsAt(event.target.value)} placeholder="2026-09-20 09:00" style={{ width: "100%" }} />
          </div>
          <div className="detail-cell">
            <label>Duration (minutes)</label>
            <input aria-label="Duration in minutes" type="number" min={15} value={durationMins} onChange={event => setDurationMins(event.target.value)} style={{ width: "100%" }} />
          </div>
          <div className="detail-cell">
            <label>Location</label>
            <input aria-label="Location" value={location} onChange={event => setLocation(event.target.value)} style={{ width: "100%" }} />
          </div>
          <div className="detail-cell">
            <label>Attendees (comma separated names)</label>
            <input aria-label="Attendees" value={attendees} onChange={event => setAttendees(event.target.value)} style={{ width: "100%" }} />
          </div>
          <div className="detail-cell">
            <label>Certificate</label>
            <label style={{ display: "flex", gap: 6, alignItems: "center", fontSize: 12 }}>
              <input type="checkbox" checked={issuesCert} onChange={event => setIssuesCert(event.target.checked)} />
              Issues a certificate
            </label>
            {issuesCert && (
              <input aria-label="Validity in months" type="number" min={1} max={60} value={validityMonths} onChange={event => setValidityMonths(event.target.value)} style={{ width: "100%", marginTop: 6 }} />
            )}
          </div>
          <div className="detail-cell">
            <label>Notes</label>
            <input aria-label="Training notes" value={notes} onChange={event => setNotes(event.target.value)} style={{ width: "100%" }} />
          </div>
        </div>
        <button type="button" className="primary-button" style={{ marginTop: 12 }} disabled={createMutation.isPending} onClick={create}>
          <Plus size={14} /> Schedule training
        </button>
      </div>
      <div className="panel" style={{ marginBottom: 16 }}>
        <div className="panel-header">
          <div className="panel-title">Upcoming trainings</div>
          <div className="panel-meta">{trainings.length} sessions</div>
        </div>
        {trainingsQuery.isLoading ? (
          <div className="panel-meta" style={{ padding: 12 }}>Loading trainings…</div>
        ) : trainingsQuery.isError ? (
          <div className="panel-meta" style={{ padding: 12 }}>
            Trainings could not be loaded.{" "}
            <button type="button" className="secondary-button" onClick={() => void trainingsQuery.refetch()}>Retry</button>
          </div>
        ) : trainings.length === 0 ? (
          <div className="panel-meta" style={{ padding: 12 }}>No trainings scheduled yet.</div>
        ) : (
          <div className="detail-list">
            {trainings.map(training => (
              <div className="detail-cell" key={training.id}>
                <label>
                  {training.startsAt}
                  {training.location ? ` · ${training.location}` : ""}
                </label>
                <div style={{ display: "flex", gap: 8, alignItems: "center", justifyContent: "space-between" }}>
                  <span>
                    {training.title} · {training.trainer} · {training.attendees.length} attendees
                  </span>
                  <span style={{ display: "flex", gap: 6, alignItems: "center" }}>
                    {training.certificateIssued === 1 && <StatusBadge value="Issues certificate" />}
                    {training.certificateIssued === 1 && (
                      <button type="button" className="secondary-button" disabled={issueMutation.isPending} onClick={() => issue(training.id, training.title)}>
                        <Award size={12} /> Issue certificates
                      </button>
                    )}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      <div className="panel">
        <div className="panel-header">
          <div className="panel-title">
            <Award size={15} /> Issued certificates
          </div>
          <div className="panel-meta">{certs.length} on record</div>
        </div>
        {certs.length === 0 ? (
          <div className="panel-meta" style={{ padding: 12 }}>No certificates issued yet.</div>
        ) : (
          <div className="detail-list">
            {certs.map(cert => (
              <div className="detail-cell" key={cert.id}>
                <label>
                  Expires {cert.expiresAt}
                </label>
                <div>
                  {cert.employeeName} — {cert.trainingTitle} (issued {cert.issuedAt})
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
