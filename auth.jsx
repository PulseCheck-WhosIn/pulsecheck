import { useState, useEffect, createContext, useContext } from "react";

// ── Brand tokens (match main app) ─────────────────────────────────────────────
const T = {
  bg:"#0f1117", surface:"#181c27", surface2:"#1e2333", border:"#2a2f42",
  text:"#e8eaf0", muted:"#6b7194", accent:"#6366f1",
  green:"#4ade80", greenBg:"#0d2318", greenBorder:"#1a4d30",
  red:"#f87171", redBg:"#200d0d", redBorder:"#4a1515",
  orange:"#fb923c", navy:"#0D1321",
};

const FONT = `
@import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800&family=DM+Mono:wght@400;500&display=swap');
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0;}
body{font-family:'DM Sans',sans-serif;background:${T.bg};color:${T.text};}
input,select,textarea,button{font-family:'DM Sans',sans-serif;}
`;

// ── Supabase client (lightweight, no SDK needed) ──────────────────────────────
// In production replace SUPABASE_URL and SUPABASE_ANON_KEY with env vars
const SUPABASE_URL  = "https://vqhlstrvkrujahhinpbu.supabase.co";
const SUPABASE_ANON = (window.PULSECHECK_CONFIG||{}).SUPABASE_ANON || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZxaGxzdHJ2a3J1amFoaGlucGJ1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODEwMzE4MzksImV4cCI6MjA5NjYwNzgzOX0.GiE_KDM3QGcMYy3ZPtE9ZYy3gbmvpkrw4pdtAbPPuAM";

async function sbAuth(path, body) {
  const res = await fetch(`${SUPABASE_URL}/auth/v1${path}`, {
    method: "POST",
    headers: {
      "apikey":       SUPABASE_ANON,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  return res.json();
}

async function sbGet(path, token) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1${path}`, {
    headers: {
      "apikey":        SUPABASE_ANON,
      "Authorization": `Bearer ${token}`,
      "Content-Type":  "application/json",
    },
  });
  if (!res.ok) return null;
  return res.json();
}

async function sbPost(path, body, token) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1${path}`, {
    method: "POST",
    headers: {
      "apikey":        SUPABASE_ANON,
      "Authorization": `Bearer ${token}`,
      "Content-Type":  "application/json",
      "Prefer":        "return=minimal",
    },
    body: JSON.stringify(body),
  });
  return res.ok;
}

// ── Auth Context ──────────────────────────────────────────────────────────────
const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [session,  setSession]  = useState(null);   // Supabase session
  const [profile,  setProfile]  = useState(null);   // gym_users row + gym info
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState(null);

  useEffect(() => {
    // Check stored session on mount
    const stored = localStorage.getItem("pc_session");
    if (stored) {
      try {
        const s = JSON.parse(stored);
        if (new Date(s.expires_at * 1000) > new Date()) {
          setSession(s);
          loadProfile(s.access_token);
        } else {
          localStorage.removeItem("pc_session");
          setLoading(false);
        }
      } catch {
        setLoading(false);
      }
    } else {
      setLoading(false);
    }
  }, []);

  async function loadProfile(token) {
    try {
      const data = await sbGet("/rpc/current_user_profile", token);
      setProfile(data);
    } catch (e) {
      console.error("Profile load failed", e);
    } finally {
      setLoading(false);
    }
  }

  async function signIn(email, password) {
    setError(null);
    const data = await sbAuth("/token?grant_type=password", { email, password });
    if (data.error) { setError(data.error_description || data.error); return false; }
    localStorage.setItem("pc_session", JSON.stringify(data));
    setSession(data);
    await loadProfile(data.access_token);
    return true;
  }

  async function signOut() {
    localStorage.removeItem("pc_session");
    setSession(null);
    setProfile(null);
  }

  const isOwner   = profile?.role === "owner";
  const isTrainer = profile?.role === "trainer";
  const canAccess = (route) => {
    const trainerRoutes = ["members","today","suspensions","departures","alerts"];
    const ownerRoutes   = [...trainerRoutes,"dashboard","growth","bizhealth","analytics","settings","users","billing","integrations"];
    return isOwner ? ownerRoutes.includes(route) : trainerRoutes.includes(route);
  };

  return (
    <AuthContext.Provider value={{ session, profile, loading, error, setError, signIn, signOut, isOwner, isTrainer, canAccess }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);

// ── Shared input style ────────────────────────────────────────────────────────
const inputStyle = {
  width:"100%", background:T.surface2, border:`1px solid ${T.border}`,
  borderRadius:8, padding:"10px 14px", color:T.text, fontSize:13, outline:"none",
};
const labelStyle = { fontSize:12, color:T.muted, fontWeight:600, marginBottom:5, display:"block" };
const btnPrimary = {
  width:"100%", background:T.accent, color:"white", border:"none",
  borderRadius:8, padding:"12px", fontSize:14, fontWeight:700, cursor:"pointer",
  transition:"opacity 0.15s",
};
const btnSecondary = {
  width:"100%", background:"transparent", color:T.muted,
  border:`1px solid ${T.border}`, borderRadius:8, padding:"12px",
  fontSize:13, fontWeight:600, cursor:"pointer",
};

// ── Logo mark ─────────────────────────────────────────────────────────────────
function LogoMark({ size=36 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" fill="none">
      <defs><linearGradient id="alg" x1="0" y1="0" x2="100" y2="100" gradientUnits="userSpaceOnUse">
        <stop stopColor="#6366f1"/><stop offset="1" stopColor="#a5b4fc"/>
      </linearGradient></defs>
      <rect width="100" height="100" rx="24" fill="url(#alg)"/>
      <polyline points="10,58 26,58 34,36 42,66 50,26 58,50 66,44 80,44"
        stroke="white" strokeWidth="5.5" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
      <line x1="52" y1="74" x2="90" y2="34" stroke="white" strokeWidth="3.5" strokeOpacity="0.45" strokeLinecap="round"/>
      <polygon points="90,34 79,31 87,43" fill="white" fillOpacity="0.7"/>
    </svg>
  );
}

function AuthShell({ children, title, sub }) {
  return (
    <div style={{minHeight:"100vh",background:T.bg,display:"flex",alignItems:"center",justifyContent:"center",padding:20}}>
      <style>{FONT}</style>
      <div style={{width:"100%",maxWidth:420}}>
        <div style={{textAlign:"center",marginBottom:32}}>
          <div style={{display:"flex",justifyContent:"center",marginBottom:12}}><LogoMark size={48}/></div>
          <div style={{fontWeight:800,fontSize:22,color:T.text,letterSpacing:"-0.5px"}}>PulseCheck</div>
          <div style={{fontSize:11,color:T.muted,marginTop:2}}>WHO'S IN. WHO'S DRIFTING. WHO NEEDS YOU.</div>
        </div>
        <div style={{background:T.surface,border:`1px solid ${T.border}`,borderRadius:14,padding:"28px 28px"}}>
          {title && <div style={{fontWeight:700,fontSize:18,color:T.text,marginBottom:4}}>{title}</div>}
          {sub   && <div style={{fontSize:12,color:T.muted,marginBottom:22}}>{sub}</div>}
          {children}
        </div>
        <div style={{textAlign:"center",marginTop:16,fontSize:11,color:T.muted}}>
          © 2026 PulseCheck · Member Health Intelligence
        </div>
      </div>
    </div>
  );
}

// ── Sign In ───────────────────────────────────────────────────────────────────
export function SignIn({ onSignUp, onForgot }) {
  const { signIn, error, setError } = useAuth();
  const [email,    setEmail]    = useState("");
  const [password, setPassword] = useState("");
  const [loading,  setLoading]  = useState(false);

  async function handle(e) {
    e.preventDefault();
    setLoading(true);
    await signIn(email, password);
    setLoading(false);
  }

  return (
    <AuthShell title="Welcome back" sub="Sign in to your PulseCheck account">
      {error && (
        <div style={{background:T.redBg,border:`1px solid ${T.redBorder}`,borderRadius:8,padding:"10px 14px",marginBottom:16,fontSize:12,color:T.red}}>
          {error}
        </div>
      )}
      <form onSubmit={handle}>
        <div style={{marginBottom:16}}>
          <label style={labelStyle}>Email</label>
          <input style={inputStyle} type="email" value={email} onChange={e=>setEmail(e.target.value)}
            placeholder="you@yourgym.com" required
            onFocus={e=>e.target.style.borderColor=T.accent}
            onBlur={e=>e.target.style.borderColor=T.border}/>
        </div>
        <div style={{marginBottom:8}}>
          <label style={labelStyle}>Password</label>
          <input style={inputStyle} type="password" value={password} onChange={e=>setPassword(e.target.value)}
            placeholder="••••••••" required
            onFocus={e=>e.target.style.borderColor=T.accent}
            onBlur={e=>e.target.style.borderColor=T.border}/>
        </div>
        <div style={{textAlign:"right",marginBottom:20}}>
          <button type="button" onClick={onForgot}
            style={{fontSize:12,color:T.muted,background:"none",border:"none",cursor:"pointer"}}>
            Forgot password?
          </button>
        </div>
        <button type="submit" style={{...btnPrimary,opacity:loading?0.6:1}} disabled={loading}>
          {loading ? "Signing in…" : "Sign In →"}
        </button>
      </form>
      <div style={{textAlign:"center",marginTop:18,fontSize:12,color:T.muted}}>
        New gym?{" "}
        <button onClick={onSignUp}
          style={{color:T.accent,background:"none",border:"none",cursor:"pointer",fontWeight:600,fontSize:12}}>
          Set up your account
        </button>
      </div>
    </AuthShell>
  );
}

// ── Owner Sign Up (gym onboarding) ────────────────────────────────────────────
export function SignUp({ onSignIn }) {
  const [step,    setStep]    = useState(1);  // 1=account, 2=gym, 3=platform, 4=done
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState(null);
  const [form,    setForm]    = useState({
    name:"", email:"", password:"", confirm:"",
    gymName:"", location:"",
    platform:"hapana", accessId:"", siteId:"",
  });

  function set(k, v) { setForm(f => ({...f, [k]: v})); }

  const stepLabels = ["Account","Your Gym","Connect Platform","Done"];

  async function submit() {
    setLoading(true); setError(null);
    try {
      // 1. Create Supabase auth user
      const authData = await sbAuth("/signup", { email: form.email, password: form.password });
      if (authData.error) throw new Error(authData.error_description || authData.error);

      // 2. Create gym + user records via edge function (has service key)
      const res = await fetch(`${SUPABASE_URL}/functions/v1/onboard-gym`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${authData.access_token}`,
          "Content-Type":  "application/json",
        },
        body: JSON.stringify({
          ownerName:   form.name,
          gymName:     form.gymName,
          location:    form.location,
          platform:    form.platform,
          accessId:    form.accessId,
          siteId:      form.siteId,
        }),
      });
      if (!res.ok) throw new Error("Gym setup failed. Please try again.");
      setStep(4);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  const inputF = (k, type="text", placeholder="") => (
    <input style={inputStyle} type={type} value={form[k]} onChange={e=>set(k,e.target.value)}
      placeholder={placeholder} required
      onFocus={e=>e.target.style.borderColor=T.accent}
      onBlur={e=>e.target.style.borderColor=T.border}/>
  );

  return (
    <AuthShell title="Set up PulseCheck" sub={`Step ${step} of 3 — ${stepLabels[step-1]}`}>
      {/* Step progress */}
      <div style={{display:"flex",gap:6,marginBottom:24}}>
        {[1,2,3].map(s => (
          <div key={s} style={{flex:1,height:3,borderRadius:99,
            background: s <= step ? T.accent : T.border, transition:"background 0.3s"}}/>
        ))}
      </div>

      {error && (
        <div style={{background:T.redBg,border:`1px solid ${T.redBorder}`,borderRadius:8,
          padding:"10px 14px",marginBottom:16,fontSize:12,color:T.red}}>
          {error}
        </div>
      )}

      {/* Step 1 — Account */}
      {step === 1 && (
        <div>
          <div style={{marginBottom:16}}>
            <label style={labelStyle}>Your Name</label>
            {inputF("name","text","Mic Smith")}
          </div>
          <div style={{marginBottom:16}}>
            <label style={labelStyle}>Email</label>
            {inputF("email","email","you@yourgym.com")}
          </div>
          <div style={{marginBottom:16}}>
            <label style={labelStyle}>Password</label>
            {inputF("password","password","Min 8 characters")}
          </div>
          <div style={{marginBottom:24}}>
            <label style={labelStyle}>Confirm Password</label>
            {inputF("confirm","password","Repeat password")}
          </div>
          <button style={btnPrimary}
            onClick={() => {
              if (!form.name||!form.email||!form.password) return setError("Please fill all fields");
              if (form.password !== form.confirm) return setError("Passwords don't match");
              if (form.password.length < 8) return setError("Password must be 8+ characters");
              setError(null); setStep(2);
            }}>
            Continue →
          </button>
        </div>
      )}

      {/* Step 2 — Gym details */}
      {step === 2 && (
        <div>
          <div style={{marginBottom:16}}>
            <label style={labelStyle}>Gym Name</label>
            {inputF("gymName","text","Fitstop Sippy Downs")}
          </div>
          <div style={{marginBottom:24}}>
            <label style={labelStyle}>Location</label>
            {inputF("location","text","Sippy Downs, QLD, Australia")}
          </div>
          <div style={{display:"flex",gap:10}}>
            <button style={{...btnSecondary,flex:1}} onClick={() => setStep(1)}>← Back</button>
            <button style={{...btnPrimary,flex:2}}
              onClick={() => {
                if (!form.gymName) return setError("Please enter your gym name");
                setError(null); setStep(3);
              }}>
              Continue →
            </button>
          </div>
        </div>
      )}

      {/* Step 3 — Platform connection */}
      {step === 3 && (
        <div>
          <div style={{marginBottom:16}}>
            <label style={labelStyle}>Booking Platform</label>
            <select style={inputStyle} value={form.platform} onChange={e=>set("platform",e.target.value)}>
              <option value="hapana">Hapana</option>
              <option value="mindbody">Mindbody</option>
              <option value="glofox">Glofox</option>
              <option value="pike13">Pike13</option>
              <option value="manual">Manual / CSV Upload</option>
            </select>
          </div>
          {form.platform !== "manual" && (
            <>
              <div style={{marginBottom:16}}>
                <label style={labelStyle}>API Access ID / Key</label>
                {inputF("accessId","password","Your platform API key")}
                <div style={{fontSize:10,color:T.muted,marginTop:5}}>
                  Stored encrypted. Never visible after saving.
                </div>
              </div>
              <div style={{marginBottom:16}}>
                <label style={labelStyle}>Site ID / Business ID</label>
                {inputF("siteId","text","Your site or location ID")}
              </div>
            </>
          )}
          <div style={{background:T.surface2,border:`1px solid ${T.border}`,borderRadius:8,
            padding:"10px 12px",marginBottom:20,fontSize:11,color:T.muted,lineHeight:1.6}}>
            🔒 Your API credentials are encrypted and stored securely. They are never exposed to the frontend and only used by our sync service.
          </div>
          <div style={{display:"flex",gap:10}}>
            <button style={{...btnSecondary,flex:1}} onClick={() => setStep(2)}>← Back</button>
            <button style={{...btnPrimary,flex:2,opacity:loading?0.6:1}} disabled={loading}
              onClick={submit}>
              {loading ? "Setting up…" : "Launch PulseCheck 🚀"}
            </button>
          </div>
        </div>
      )}

      {/* Step 4 — Done */}
      {step === 4 && (
        <div style={{textAlign:"center",padding:"8px 0"}}>
          <div style={{fontSize:48,marginBottom:12}}>🎉</div>
          <div style={{fontWeight:700,fontSize:16,color:T.text,marginBottom:8}}>You're all set!</div>
          <div style={{fontSize:12,color:T.muted,lineHeight:1.6,marginBottom:24}}>
            Your gym is connected. We're syncing your member data now — this takes about 30 seconds.
          </div>
          <button style={btnPrimary} onClick={onSignIn}>Open PulseCheck →</button>
        </div>
      )}

      {step === 1 && (
        <div style={{textAlign:"center",marginTop:18,fontSize:12,color:T.muted}}>
          Already have an account?{" "}
          <button onClick={onSignIn}
            style={{color:T.accent,background:"none",border:"none",cursor:"pointer",fontWeight:600,fontSize:12}}>
            Sign in
          </button>
        </div>
      )}
    </AuthShell>
  );
}

// ── Forgot Password ───────────────────────────────────────────────────────────
export function ForgotPassword({ onBack }) {
  const [email,   setEmail]   = useState("");
  const [sent,    setSent]    = useState(false);
  const [loading, setLoading] = useState(false);

  async function handle(e) {
    e.preventDefault();
    setLoading(true);
    await sbAuth("/recover", { email });
    setSent(true);
    setLoading(false);
  }

  return (
    <AuthShell title="Reset password" sub="We'll send a reset link to your email">
      {sent ? (
        <div style={{textAlign:"center",padding:"8px 0"}}>
          <div style={{fontSize:40,marginBottom:12}}>📧</div>
          <div style={{fontSize:13,color:T.text,marginBottom:20,lineHeight:1.6}}>
            Reset link sent to <strong>{email}</strong>. Check your inbox.
          </div>
          <button style={btnSecondary} onClick={onBack}>Back to Sign In</button>
        </div>
      ) : (
        <form onSubmit={handle}>
          <div style={{marginBottom:20}}>
            <label style={labelStyle}>Email</label>
            <input style={inputStyle} type="email" value={email} onChange={e=>setEmail(e.target.value)}
              placeholder="you@yourgym.com" required
              onFocus={e=>e.target.style.borderColor=T.accent}
              onBlur={e=>e.target.style.borderColor=T.border}/>
          </div>
          <button type="submit" style={{...btnPrimary,opacity:loading?0.6:1}} disabled={loading}>
            {loading ? "Sending…" : "Send Reset Link"}
          </button>
          <button type="button" style={{...btnSecondary,marginTop:10}} onClick={onBack}>
            Back to Sign In
          </button>
        </form>
      )}
    </AuthShell>
  );
}

// ── Accept Invitation (trainer signup) ───────────────────────────────────────
export function AcceptInvite({ token }) {
  const { signIn } = useAuth();
  const [invite,  setInvite]  = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving,  setSaving]  = useState(false);
  const [error,   setError]   = useState(null);
  const [form,    setForm]    = useState({ name:"", password:"", confirm:"" });

  useEffect(() => {
    // Look up invitation by token
    fetch(`${SUPABASE_URL}/rest/v1/invitations?token=eq.${token}&select=*,gyms(name,slug)`, {
      headers: { "apikey": SUPABASE_ANON }
    })
    .then(r => r.json())
    .then(data => {
      const inv = data?.[0];
      if (!inv || inv.status !== "pending" || new Date(inv.expires_at) < new Date()) {
        setError("This invitation is invalid or has expired.");
      } else {
        setInvite(inv);
      }
      setLoading(false);
    })
    .catch(() => { setError("Could not load invitation."); setLoading(false); });
  }, [token]);

  async function accept(e) {
    e.preventDefault();
    if (form.password !== form.confirm) return setError("Passwords don't match");
    if (form.password.length < 8) return setError("Password must be 8+ characters");
    setSaving(true); setError(null);

    try {
      // Create auth user
      const authData = await sbAuth("/signup", { email: invite.email, password: form.password });
      if (authData.error) throw new Error(authData.error_description || authData.error);

      // Accept invite via edge function
      const res = await fetch(`${SUPABASE_URL}/functions/v1/accept-invite`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${authData.access_token}`,
          "Content-Type":  "application/json",
        },
        body: JSON.stringify({ token, name: form.name }),
      });
      if (!res.ok) throw new Error("Could not accept invitation. Please try again.");

      // Sign in
      await signIn(invite.email, form.password);
    } catch (e) {
      setError(e.message);
      setSaving(false);
    }
  }

  if (loading) return (
    <AuthShell>
      <div style={{textAlign:"center",color:T.muted,padding:"20px 0"}}>Loading invitation…</div>
    </AuthShell>
  );

  if (error && !invite) return (
    <AuthShell title="Invalid Invitation">
      <div style={{color:T.red,fontSize:13,textAlign:"center"}}>{error}</div>
    </AuthShell>
  );

  return (
    <AuthShell
      title={`Join ${invite?.gyms?.name || "PulseCheck"}`}
      sub={`You've been invited as a ${invite?.role || "trainer"}. Set up your account below.`}>
      {error && (
        <div style={{background:T.redBg,border:`1px solid ${T.redBorder}`,borderRadius:8,
          padding:"10px 14px",marginBottom:16,fontSize:12,color:T.red}}>{error}</div>
      )}
      <form onSubmit={accept}>
        <div style={{background:T.surface2,border:`1px solid ${T.border}`,borderRadius:8,
          padding:"10px 14px",marginBottom:16,fontSize:12,color:T.muted}}>
          Joining as: <strong style={{color:T.text}}>{invite?.email}</strong>
        </div>
        <div style={{marginBottom:16}}>
          <label style={labelStyle}>Your Name</label>
          <input style={inputStyle} type="text" value={form.name}
            onChange={e=>setForm(f=>({...f,name:e.target.value}))}
            placeholder="Your full name" required
            onFocus={e=>e.target.style.borderColor=T.accent}
            onBlur={e=>e.target.style.borderColor=T.border}/>
        </div>
        <div style={{marginBottom:16}}>
          <label style={labelStyle}>Password</label>
          <input style={inputStyle} type="password" value={form.password}
            onChange={e=>setForm(f=>({...f,password:e.target.value}))}
            placeholder="Min 8 characters" required
            onFocus={e=>e.target.style.borderColor=T.accent}
            onBlur={e=>e.target.style.borderColor=T.border}/>
        </div>
        <div style={{marginBottom:24}}>
          <label style={labelStyle}>Confirm Password</label>
          <input style={inputStyle} type="password" value={form.confirm}
            onChange={e=>setForm(f=>({...f,confirm:e.target.value}))}
            placeholder="Repeat password" required
            onFocus={e=>e.target.style.borderColor=T.accent}
            onBlur={e=>e.target.style.borderColor=T.border}/>
        </div>
        <button type="submit" style={{...btnPrimary,opacity:saving?0.6:1}} disabled={saving}>
          {saving ? "Setting up…" : "Accept Invitation →"}
        </button>
      </form>
    </AuthShell>
  );
}

// ── Settings — Owner only ─────────────────────────────────────────────────────
export function Settings() {
  const { profile, session } = useAuth();
  const [activeTab,  setActiveTab]  = useState("users");
  const [users,      setUsers]      = useState([]);
  const [inviteEmail,setInviteEmail]= useState("");
  const [inviteRole, setInviteRole] = useState("trainer");
  const [inviting,   setInviting]   = useState(false);
  const [inviteSent, setInviteSent] = useState(false);
  const [targets,    setTargets]    = useState({ "Legacy M:M":3, "12 Month":3, "6 Month":3, "M:M":3, "2x Per Week":2, "21 Day Starter":3, "default":3 });
  const [settingsSaved, setSettingsSaved] = useState(false);

  useEffect(() => {
    if (!session) return;
    sbGet(`/gym_users?gym_id=eq.${profile?.gym_id}&order=role.asc,name.asc`, session.access_token)
      .then(data => setUsers(data || []));
  }, [session, profile]);

  async function sendInvite() {
    if (!inviteEmail) return;
    setInviting(true);
    const ok = await sbPost("/invitations", {
      gym_id:     profile?.gym_id,
      invited_by: profile?.id,
      email:      inviteEmail.toLowerCase().trim(),
      role:       inviteRole,
    }, session.access_token);
    if (ok) { setInviteSent(true); setInviteEmail(""); setTimeout(() => setInviteSent(false), 3000); }
    setInviting(false);
  }

  async function changeRole(userId, newRole) {
    await fetch(`${SUPABASE_URL}/rest/v1/gym_users?id=eq.${userId}`, {
      method: "PATCH",
      headers: {
        "apikey": SUPABASE_ANON,
        "Authorization": `Bearer ${session.access_token}`,
        "Content-Type": "application/json",
        "Prefer": "return=minimal",
      },
      body: JSON.stringify({ role: newRole }),
    });
    setUsers(u => u.map(x => x.id === userId ? {...x, role: newRole} : x));
  }

  async function removeUser(userId) {
    if (!confirm("Remove this user from your gym?")) return;
    await fetch(`${SUPABASE_URL}/rest/v1/gym_users?id=eq.${userId}`, {
      method: "DELETE",
      headers: { "apikey": SUPABASE_ANON, "Authorization": `Bearer ${session.access_token}` },
    });
    setUsers(u => u.filter(x => x.id !== userId));
  }

  const TABS = [
    { id:"users",       label:"👥 Users",       ownerOnly:true  },
    { id:"targets",     label:"🎯 Session Targets" },
    { id:"integration", label:"🔌 Integration",  ownerOnly:true  },
    { id:"billing",     label:"💳 Billing",       ownerOnly:true  },
    { id:"gym",         label:"🏋️ Gym Profile",  ownerOnly:true  },
  ];

  const roleColors = {
    owner:   { bg:"#1a1a2e", color:"#a5b4fc", border:"#3a3a5c" },
    trainer: { bg:"#0d2318", color:"#4ade80", border:"#1a4d30" },
  };

  return (
    <div style={{maxWidth:760,margin:"0 auto",padding:"0 0 40px"}}>
      {/* Tab bar */}
      <div style={{display:"flex",gap:2,borderBottom:`1px solid ${T.border}`,marginBottom:24,overflowX:"auto"}}>
        {TABS.map(t => (
          <button key={t.id} onClick={() => setActiveTab(t.id)}
            style={{fontSize:12,fontWeight:600,padding:"10px 16px",border:"none",background:"none",
              cursor:"pointer",whiteSpace:"nowrap",fontFamily:"'DM Sans',sans-serif",
              borderBottom:activeTab===t.id?`2px solid ${T.accent}`:"2px solid transparent",
              color:activeTab===t.id?T.text:T.muted,marginBottom:-1}}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Users tab */}
      {activeTab === "users" && (
        <div>
          <div style={{fontWeight:700,fontSize:15,color:T.text,marginBottom:4}}>Team Members</div>
          <div style={{fontSize:12,color:T.muted,marginBottom:20}}>
            Manage who has access to your PulseCheck account.
          </div>

          {/* Invite */}
          <div style={{background:T.surface,border:`1px solid ${T.border}`,borderRadius:12,padding:"18px 20px",marginBottom:20}}>
            <div style={{fontWeight:600,fontSize:13,color:T.text,marginBottom:12}}>Invite a Team Member</div>
            <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
              <input value={inviteEmail} onChange={e=>setInviteEmail(e.target.value)}
                placeholder="trainer@yourgym.com"
                style={{...inputStyle,flex:"1 1 200px"}}
                onFocus={e=>e.target.style.borderColor=T.accent}
                onBlur={e=>e.target.style.borderColor=T.border}/>
              <select value={inviteRole} onChange={e=>setInviteRole(e.target.value)}
                style={{...inputStyle,width:"auto",flex:"0 0 120px"}}>
                <option value="trainer">Trainer</option>
                <option value="owner">Owner</option>
              </select>
              <button onClick={sendInvite} disabled={inviting||!inviteEmail}
                style={{...btnPrimary,width:"auto",padding:"10px 20px",opacity:inviting||!inviteEmail?0.5:1,flex:"0 0 auto"}}>
                {inviteSent ? "✓ Sent!" : inviting ? "Sending…" : "Send Invite"}
              </button>
            </div>
            <div style={{fontSize:11,color:T.muted,marginTop:8}}>
              They'll receive an email with a link to set up their account. Expires in 7 days.
            </div>
          </div>

          {/* User list */}
          <div style={{background:T.surface,border:`1px solid ${T.border}`,borderRadius:12,overflow:"hidden"}}>
            {users.map((u, i) => {
              const rc = roleColors[u.role] || roleColors.trainer;
              const isYou = u.auth_user_id === session?.user?.id;
              return (
                <div key={u.id} style={{display:"flex",alignItems:"center",gap:12,padding:"14px 18px",
                  borderBottom:i<users.length-1?`1px solid ${T.border}`:"none"}}>
                  {/* Avatar */}
                  <div style={{width:36,height:36,borderRadius:"50%",background:T.accent+"44",
                    display:"flex",alignItems:"center",justifyContent:"center",
                    fontSize:13,fontWeight:700,color:T.accent,flexShrink:0}}>
                    {u.name?.split(" ").map(p=>p[0]).join("").slice(0,2).toUpperCase() || "??"}
                  </div>
                  {/* Info */}
                  <div style={{flex:1}}>
                    <div style={{fontWeight:600,fontSize:13,color:T.text}}>
                      {u.name} {isYou && <span style={{fontSize:10,color:T.muted}}>(you)</span>}
                    </div>
                    <div style={{fontSize:11,color:T.muted}}>{u.email}</div>
                  </div>
                  {/* Role badge */}
                  <span style={{fontSize:10,fontWeight:700,padding:"2px 9px",borderRadius:99,
                    background:rc.bg,color:rc.color,border:`1px solid ${rc.border}`,textTransform:"uppercase",letterSpacing:"0.06em"}}>
                    {u.role}
                  </span>
                  {/* Actions (not for yourself) */}
                  {!isYou && (
                    <div style={{display:"flex",gap:6}}>
                      <select value={u.role} onChange={e=>changeRole(u.id,e.target.value)}
                        style={{fontSize:11,background:T.surface2,border:`1px solid ${T.border}`,
                          color:T.muted,padding:"4px 8px",borderRadius:6,cursor:"pointer"}}>
                        <option value="trainer">Trainer</option>
                        <option value="owner">Owner</option>
                      </select>
                      <button onClick={()=>removeUser(u.id)}
                        style={{fontSize:11,background:"transparent",border:`1px solid ${T.border}`,
                          color:T.muted,padding:"4px 10px",borderRadius:6,cursor:"pointer"}}
                        onMouseEnter={e=>{e.target.style.color="#f87171";e.target.style.borderColor="#4a1515";}}
                        onMouseLeave={e=>{e.target.style.color=T.muted;e.target.style.borderColor=T.border;}}>
                        Remove
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
            {users.length === 0 && (
              <div style={{padding:24,textAlign:"center",color:T.muted,fontSize:13}}>
                No team members yet. Send your first invite above.
              </div>
            )}
          </div>
        </div>
      )}

      {/* Session targets tab */}
      {activeTab === "targets" && (
        <div>
          <div style={{fontWeight:700,fontSize:15,color:T.text,marginBottom:4}}>Session Targets</div>
          <div style={{fontSize:12,color:T.muted,marginBottom:20}}>
            Set the weekly session target per membership type. This determines green / amber / red status.
          </div>
          <div style={{background:T.surface,border:`1px solid ${T.border}`,borderRadius:12,overflow:"hidden"}}>
            {Object.entries(targets).map(([pkg, val], i, arr) => (
              <div key={pkg} style={{display:"flex",alignItems:"center",justifyContent:"space-between",
                padding:"14px 18px",borderBottom:i<arr.length-1?`1px solid ${T.border}`:"none"}}>
                <div>
                  <div style={{fontWeight:600,fontSize:13,color:T.text}}>{pkg === "default" ? "All other memberships" : pkg}</div>
                  <div style={{fontSize:11,color:T.muted}}>Target sessions per week</div>
                </div>
                <div style={{display:"flex",alignItems:"center",gap:10}}>
                  <button onClick={()=>setTargets(t=>({...t,[pkg]:Math.max(1,val-1)}))}
                    style={{width:28,height:28,borderRadius:6,border:`1px solid ${T.border}`,
                      background:T.surface2,color:T.text,cursor:"pointer",fontSize:16}}>−</button>
                  <span style={{fontWeight:700,fontSize:18,color:T.accent,fontFamily:"'DM Mono',monospace",
                    width:24,textAlign:"center"}}>{val}</span>
                  <button onClick={()=>setTargets(t=>({...t,[pkg]:Math.min(7,val+1)}))}
                    style={{width:28,height:28,borderRadius:6,border:`1px solid ${T.border}`,
                      background:T.surface2,color:T.text,cursor:"pointer",fontSize:16}}>+</button>
                </div>
              </div>
            ))}
          </div>
          <button onClick={()=>setSettingsSaved(true)}
            style={{...btnPrimary,marginTop:16,opacity:1}}>
            {settingsSaved ? "✓ Saved" : "Save Targets"}
          </button>
        </div>
      )}

      {/* Integration tab */}
      {activeTab === "integration" && (
        <div>
          <div style={{fontWeight:700,fontSize:15,color:T.text,marginBottom:4}}>Platform Integration</div>
          <div style={{fontSize:12,color:T.muted,marginBottom:20}}>
            Your booking platform connection. Syncs every 15 minutes.
          </div>
          <div style={{background:T.surface,border:`1px solid ${T.border}`,borderRadius:12,padding:"18px 20px",marginBottom:16}}>
            <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:16}}>
              <div>
                <div style={{fontWeight:600,fontSize:13,color:T.text}}>Hapana</div>
                <div style={{fontSize:11,color:T.muted}}>{profile?.gym_name}</div>
              </div>
              <span style={{fontSize:10,fontWeight:700,padding:"3px 10px",borderRadius:99,
                background:T.greenBg,color:T.green,border:`1px solid ${T.greenBorder}`}}>
                CONNECTED
              </span>
            </div>
            <div style={{fontSize:11,color:T.muted,marginBottom:8}}>
              Last synced: {profile?.last_synced_at ? new Date(profile.last_synced_at).toLocaleString("en-AU") : "Never"}
            </div>
            <button style={{...btnSecondary,width:"auto",padding:"8px 16px",fontSize:12}}>
              Sync Now
            </button>
          </div>
          <div style={{fontSize:11,color:T.muted,lineHeight:1.6}}>
            🔒 API credentials are stored encrypted and never exposed to the browser. To update credentials, contact support.
          </div>
        </div>
      )}

      {/* Billing tab */}
      {activeTab === "billing" && (
        <div>
          <div style={{fontWeight:700,fontSize:15,color:T.text,marginBottom:4}}>Billing</div>
          <div style={{fontSize:12,color:T.muted,marginBottom:20}}>Your PulseCheck subscription.</div>
          <div style={{background:T.surface,border:`1px solid ${T.border}`,borderRadius:12,padding:"20px"}}>
            <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:16}}>
              <div>
                <div style={{fontWeight:700,fontSize:16,color:T.text}}>PulseCheck Standard</div>
                <div style={{fontSize:12,color:T.muted}}>Single location · Unlimited coaches</div>
              </div>
              <div style={{textAlign:"right"}}>
                <div style={{fontWeight:800,fontSize:22,color:T.accent}}>$149</div>
                <div style={{fontSize:11,color:T.muted}}>+ GST / month</div>
              </div>
            </div>
            <div style={{borderTop:`1px solid ${T.border}`,paddingTop:14,display:"flex",gap:12}}>
              <button style={{...btnSecondary,width:"auto",padding:"8px 16px",fontSize:12}}>
                Manage Billing
              </button>
              <button style={{...btnSecondary,width:"auto",padding:"8px 16px",fontSize:12,color:"#f87171"}}>
                Cancel Subscription
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Gym profile tab */}
      {activeTab === "gym" && (
        <div>
          <div style={{fontWeight:700,fontSize:15,color:T.text,marginBottom:4}}>Gym Profile</div>
          <div style={{fontSize:12,color:T.muted,marginBottom:20}}>Your gym details shown across PulseCheck.</div>
          <div style={{background:T.surface,border:`1px solid ${T.border}`,borderRadius:12,padding:"18px 20px"}}>
            {[
              {label:"Gym Name",  val:profile?.gym_name  || ""},
              {label:"Location",  val:"Sippy Downs, QLD"     },
              {label:"Timezone",  val:"Australia/Brisbane"    },
            ].map(f => (
              <div key={f.label} style={{marginBottom:16}}>
                <label style={labelStyle}>{f.label}</label>
                <input defaultValue={f.val} style={inputStyle}
                  onFocus={e=>e.target.style.borderColor=T.accent}
                  onBlur={e=>e.target.style.borderColor=T.border}/>
              </div>
            ))}
            <button style={{...btnPrimary,marginTop:4}}>Save Changes</button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Auth Router — wraps the whole app ─────────────────────────────────────────
export function AuthRouter({ children }) {
  const { session, profile, loading } = useAuth();
  const [screen, setScreen] = useState("signin"); // signin | signup | forgot | invite

  // Check for invite token in URL
  const urlParams  = new URLSearchParams(typeof window !== "undefined" ? window.location.search : "");
  const inviteToken = urlParams.get("invite");

  if (loading) {
    return (
      <div style={{minHeight:"100vh",background:T.bg,display:"flex",alignItems:"center",justifyContent:"center"}}>
        <style>{FONT}</style>
        <div style={{textAlign:"center"}}>
          <LogoMark size={44}/>
          <div style={{color:T.muted,fontSize:12,marginTop:12}}>Loading…</div>
        </div>
      </div>
    );
  }

  if (inviteToken && !session) {
    return <AcceptInvite token={inviteToken}/>;
  }

  if (!session || !profile) {
    if (screen === "signup")  return <SignUp   onSignIn={()=>setScreen("signin")}/>;
    if (screen === "forgot")  return <ForgotPassword onBack={()=>setScreen("signin")}/>;
    return <SignIn onSignUp={()=>setScreen("signup")} onForgot={()=>setScreen("forgot")}/>;
  }

  return children;
}

// Export for HTML script tag usage
if (typeof window !== 'undefined') {
  window.PulseCheckAuth = { AuthProvider, AuthRouter, useAuth, Settings, SignIn, SignUp };
}
