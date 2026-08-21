import { useEffect, useState } from "react";
import { useRoute, useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import {
  FileText, LoaderCircle, Lock,
  Send, ShieldCheck, X,
} from "lucide-react";

const CLIENT_SESSION_KEY = "bob_client_portal_session";

type ClientSession = {
  bookingId: string;
  clientEmail: string;
  clientName: string;
  token: string;
};

function readSession(): ClientSession | null {
  try {
    const raw = sessionStorage.getItem(CLIENT_SESSION_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

function writeSession(session: ClientSession) {
  sessionStorage.setItem(CLIENT_SESSION_KEY, JSON.stringify(session));
}

function MagicLinkVerify() {
  const [, params] = useRoute("/client/verify/:token");
  const [, setLocation] = useLocation();
  const verifyMutation = trpc.clientPortal.verifyMagicLink.useMutation();

  useEffect(() => {
    if (!params?.token) return;
    verifyMutation.mutate(
      { token: params.token },
      {
        onSuccess: (data) => {
          writeSession({
            bookingId: data.bookingId,
            clientEmail: data.clientEmail,
            clientName: data.clientName,
            token: data.clientSession,
          });
          setLocation(`/client/${data.bookingId}`);
        },
        onError: () => {},
      }
    );
  }, [params?.token]);

  return (
    <div style={{ minHeight: "100vh", display: "grid", placeItems: "center", background: "#f5f6f8", fontFamily: "Inter, system-ui, sans-serif" }}>
      <div style={{ background: "#fff", borderRadius: 12, padding: 40, textAlign: "center", boxShadow: "0 4px 24px rgba(0,0,0,.08)", maxWidth: 420, width: "100%" }}>
        {verifyMutation.isPending && (
          <>
            <LoaderCircle className="animate-spin" size={32} color="#b45309" style={{ margin: "0 auto 16px" }} />
            <div style={{ fontSize: 16, fontWeight: 600 }}>Verifying your link…</div>
            <div style={{ fontSize: 13, color: "#666", marginTop: 6 }}>This should only take a moment.</div>
          </>
        )}
        {verifyMutation.isError && (
          <>
            <X size={32} color="#b91c1c" style={{ margin: "0 auto 16px" }} />
            <div style={{ fontSize: 16, fontWeight: 600 }}>Link expired or already used</div>
            <div style={{ fontSize: 13, color: "#666", marginTop: 6 }}>Please ask your BOB Cranes contact for a fresh link.</div>
          </>
        )}
      </div>
    </div>
  );
}

function OtpEntry() {
  const [, params] = useRoute("/client/otp/:bookingId");
  const [, setLocation] = useLocation();
  const [otp, setOtp] = useState("");
  const [error, setError] = useState("");
  const verifyMutation = trpc.clientPortal.verifyOtp.useMutation();

  const handleSubmit = () => {
    if (!params?.bookingId || otp.length !== 6) return;
    setError("");
    verifyMutation.mutate(
      { bookingId: params.bookingId, otp },
      {
        onSuccess: (data) => {
          writeSession({
            bookingId: data.bookingId,
            clientEmail: data.clientEmail,
            clientName: data.clientName,
            token: data.clientSession,
          });
          setLocation(`/client/${data.bookingId}`);
        },
        onError: (err) => setError(err.message),
      }
    );
  };

  return (
    <div style={{ minHeight: "100vh", display: "grid", placeItems: "center", background: "#f5f6f8", fontFamily: "Inter, system-ui, sans-serif" }}>
      <div style={{ background: "#fff", borderRadius: 12, padding: 40, boxShadow: "0 4px 24px rgba(0,0,0,.08)", maxWidth: 420, width: "100%" }}>
        <ShieldCheck size={28} color="#b45309" style={{ margin: "0 auto 12px" }} />
        <div style={{ fontSize: 16, fontWeight: 600, textAlign: "center", marginBottom: 4 }}>Enter your OTP code</div>
        <div style={{ fontSize: 13, color: "#666", textAlign: "center", marginBottom: 20 }}>Check your email for a 6-digit code.</div>
        <input
          type="text"
          inputMode="numeric"
          maxLength={6}
          value={otp}
          onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))}
          onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
          placeholder="000000"
          style={{
            width: "100%", padding: "12px 16px", fontSize: 20, letterSpacing: 6,
            textAlign: "center", border: "1px solid #ddd", borderRadius: 8,
            fontFamily: "monospace", marginBottom: 16,
          }}
        />
        {error && <div style={{ fontSize: 12, color: "#b91c1c", marginBottom: 12, textAlign: "center" }}>{error}</div>}
        <button
          onClick={handleSubmit}
          disabled={otp.length !== 6 || verifyMutation.isPending}
          style={{
            width: "100%", padding: "12px 0", fontSize: 14, fontWeight: 600,
            background: "#b45309", color: "#fff", border: "none", borderRadius: 8,
            cursor: otp.length !== 6 ? "not-allowed" : "pointer", opacity: otp.length !== 6 ? 0.5 : 1,
          }}
        >
          {verifyMutation.isPending ? "Verifying…" : "Verify code"}
        </button>
      </div>
    </div>
  );
}

function ClientDashboard({ bookingId }: { bookingId: string }) {
  const [, setLocation] = useLocation();
  const session = readSession();
  const [tab, setTab] = useState<"summary" | "documents" | "chat">("summary");
  const [message, setMessage] = useState("");

  const clientToken = session?.token ?? "";

  const bq = trpc.clientPortal.getBookingSummary.useQuery(
    { bookingId, clientSession: clientToken },
    { enabled: !!bookingId && !!clientToken }
  );
  const dq = trpc.clientPortal.getDocuments.useQuery(
    { bookingId, clientSession: clientToken },
    { enabled: !!bookingId && !!clientToken && tab === "documents" }
  );
  const cq = trpc.clientPortal.getChatMessages.useQuery(
    { bookingId, clientSession: clientToken },
    { enabled: !!bookingId && !!clientToken && tab === "chat", refetchInterval: tab === "chat" ? 5000 : false }
  );
  const sm = trpc.clientPortal.sendChatMessage.useMutation({
    onSuccess: () => { setMessage(""); cq.refetch(); },
  });

  if (!clientToken) {
    return (
      <div style={{ minHeight: "100vh", display: "grid", placeItems: "center", background: "#f5f6f8", fontFamily: "Inter, system-ui, sans-serif" }}>
        <div style={{ textAlign: "center" }}>
          <Lock size={32} color="#999" style={{ margin: "0 auto 12px" }} />
          <div style={{ fontSize: 16, fontWeight: 600 }}>Session expired</div>
          <div style={{ fontSize: 13, color: "#666", marginTop: 4 }}>Please use the link provided by your BOB Cranes contact.</div>
        </div>
      </div>
    );
  }

  if (bq.isLoading) return (<div style={{ minHeight: "100vh", display: "grid", placeItems: "center", background: "#f5f6f8" }}><LoaderCircle className="animate-spin" size={28} color="#b45309" /></div>);
  const b = bq.data;
  if (!b) return (<div style={{ minHeight: "100vh", display: "grid", placeItems: "center", background: "#f5f6f8", fontFamily: "Inter, system-ui, sans-serif" }}><div style={{ textAlign: "center" }}><Lock size={32} color="#999" style={{ margin: "0 auto 12px" }} /><div style={{ fontSize: 16, fontWeight: 600 }}>Booking not found</div></div></div>);

  return (<div style={{ minHeight: "100vh", background: "#f5f6f8", fontFamily: "Inter, system-ui, sans-serif" }}>
    <div style={{ background: "#171b22", color: "#fff", padding: "16px 24px", display: "flex", alignItems: "center", gap: 12 }}>
      <div style={{ width: 32, height: 32, borderRadius: 8, background: "#b45309", display: "grid", placeItems: "center", fontSize: 13, fontWeight: 700 }}>BOB</div>
      <div><div style={{ fontSize: 14, fontWeight: 600 }}>Client Portal</div><div style={{ fontSize: 11, color: "#8b95a3" }}>{b.clientName} · {b.projectName}</div></div>
      <div style={{ flex: 1 }} />
      <button onClick={() => { sessionStorage.removeItem(CLIENT_SESSION_KEY); setLocation("/"); }} style={{ fontSize: 12, color: "#8b95a3", background: "none", border: "none", cursor: "pointer" }}>Sign out</button>
    </div>
    <div style={{ background: "#fff", borderBottom: "1px solid #e3e6ea", padding: "0 24px", display: "flex" }}>
      {(["summary", "documents", "chat"] as const).map((t) => (<button key={t} onClick={() => setTab(t)} style={{ padding: "12px 16px", fontSize: 13, fontWeight: tab === t ? 600 : 400, color: tab === t ? "#b45309" : "#666", background: "none", border: "none", borderBottom: tab === t ? "2px solid #b45309" : "2px solid transparent", cursor: "pointer", textTransform: "capitalize" }}>{t}</button>))}
    </div>
    <div style={{ maxWidth: 800, margin: "0 auto", padding: 24 }}>
      {tab === "summary" && (<div style={{ background: "#fff", borderRadius: 10, border: "1px solid #e3e6ea", padding: 24 }}>
        <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 16 }}>Booking Summary</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px 24px", fontSize: 13 }}>
          {[["Booking ID", b.id], ["Status", b.stage], ["Client", b.clientName], ["Project", b.projectName], ["Project Manager", b.projectManager], ["Priority", b.priority], ["Mobilization", b.mobilizationDate], ["Off-hire", b.offHireDate]].map(([label, val]) => (<div key={label}><span style={{ color: "#666" }}>{label}</span><div style={{ fontWeight: 600 }}>{val}</div></div>))}
        </div>
      </div>)}
      {tab === "documents" && (<div style={{ background: "#fff", borderRadius: 10, border: "1px solid #e3e6ea", padding: 24 }}>
        <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 16 }}>Documents</div>
        {dq.isLoading ? <div style={{ textAlign: "center", padding: 20, color: "#666" }}>Loading…</div> : dq.data?.length ? (<div style={{ display: "flex", flexDirection: "column", gap: 8 }}>{dq.data.map((doc: any) => (<div key={doc.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 14px", border: "1px solid #e3e6ea", borderRadius: 8, fontSize: 13 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}><FileText size={14} color="#888" /><div><div style={{ fontWeight: 600 }}>{doc.name}</div><div style={{ fontSize: 11, color: "#666" }}>{doc.departmentCode}</div></div></div>
          <span style={{ fontSize: 11, fontWeight: 600, padding: "3px 10px", borderRadius: 20, background: doc.state === "Approved" ? "#eaf6ee" : doc.state === "Uploaded" ? "#eef2fe" : "#fdf3e7", color: doc.state === "Approved" ? "#15803d" : doc.state === "Uploaded" ? "#1d4ed8" : "#b45309" }}>{doc.state}</span>
        </div>))}</div>) : <div style={{ textAlign: "center", padding: 20, color: "#666" }}>No documents yet.</div>}
      </div>)}
      {tab === "chat" && (<div style={{ background: "#fff", borderRadius: 10, border: "1px solid #e3e6ea", overflow: "hidden" }}>
        <div style={{ padding: "16px 24px", borderBottom: "1px solid #e3e6ea", fontSize: 16, fontWeight: 700 }}>Chat</div>
        <div style={{ padding: 16, minHeight: 300, maxHeight: 400, overflowY: "auto" }}>
          {cq.data?.length ? cq.data.map((msg: any) => (<div key={msg.id} style={{ marginBottom: 12, display: "flex", flexDirection: "column", alignItems: msg.team === "client" ? "flex-end" : "flex-start" }}>
            <div style={{ fontSize: 11, color: "#666", marginBottom: 2 }}>{msg.sender}</div>
            <div style={{ padding: "8px 14px", borderRadius: 12, fontSize: 13, maxWidth: "75%", background: msg.team === "client" ? "#b45309" : "#f0f2f5", color: msg.team === "client" ? "#fff" : "#14171c" }}>{msg.body}</div>
          </div>)) : <div style={{ textAlign: "center", color: "#666", padding: 40, fontSize: 13 }}>No messages yet.</div>}
        </div>
        <div style={{ padding: 12, borderTop: "1px solid #e3e6ea", display: "flex", gap: 8 }}>
          <input value={message} onChange={(e) => setMessage(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && message.trim()) sm.mutate({ bookingId, clientSession: clientToken, body: message.trim() }); }} placeholder="Type a message…" style={{ flex: 1, padding: "10px 14px", border: "1px solid #ddd", borderRadius: 8, fontSize: 13 }} />
          <button onClick={() => { if (message.trim()) sm.mutate({ bookingId, clientSession: clientToken, body: message.trim() }); }} disabled={!message.trim()} style={{ padding: "10px 16px", background: "#b45309", color: "#fff", border: "none", borderRadius: 8, cursor: message.trim() ? "pointer" : "not-allowed", opacity: message.trim() ? 1 : 0.5 }}><Send size={14} /></button>
        </div>
      </div>)}
    </div>
  </div>);
}

export default function ClientPortalPage() {
  const [mv] = useRoute("/client/verify/:token");
  const [mo] = useRoute("/client/otp/:bookingId");
  const [md, mdParams] = useRoute("/client/:bookingId");
  if (mv) return <MagicLinkVerify />;
  if (mo) return <OtpEntry />;
  if (md && mdParams) return <ClientDashboard bookingId={mdParams.bookingId} />;
  return (<div style={{ minHeight: "100vh", display: "grid", placeItems: "center", background: "#f5f6f8", fontFamily: "Inter, system-ui, sans-serif" }}><div style={{ textAlign: "center" }}><Lock size={32} color="#999" style={{ margin: "0 auto 12px" }} /><div style={{ fontSize: 16, fontWeight: 600 }}>Client Portal</div><div style={{ fontSize: 13, color: "#666", marginTop: 4 }}>Please use the link provided by your BOB Cranes contact.</div></div></div>);
}
