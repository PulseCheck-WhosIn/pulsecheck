import { useState, useEffect, createContext, useContext } from "react";

// ── Brand tokens (match main app) ─────────────────────────────────────────────
const T = {
  bg: "#0f1117",
  surface: "#181c27",
  surface2: "#1e2333",
  border: "#2a2f42",
  text: "#e8eaf0",
  muted: "#6b7194",
  accent: "#6366f1",
  green: "#4ade80",
  greenBg: "#0d2318",
  greenBorder: "#1a4d30",
  red: "#f87171",
  redBg: "#200d0d",
  redBorder: "#4a1515",
  orange: "#fb923c",
  navy: "#0D1321"
};
const FONT = `
@import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800&family=DM+Mono:wght@400;500&display=swap');
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0;}
body{font-family:'DM Sans',sans-serif;background:${T.bg};color:${T.text};}
input,select,textarea,button{font-family:'DM Sans',sans-serif;}
`;

// ── Supabase client (lightweight, no SDK needed) ──────────────────────────────
// In production replace SUPABASE_URL and SUPABASE_ANON_KEY with env vars
const SUPABASE_URL = "https://vqhlstrvkrujahhinpbu.supabase.co";
const SUPABASE_ANON = (window.PULSECHECK_CONFIG || {}).SUPABASE_ANON || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZxaGxzdHJ2a3J1amFoaGlucGJ1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODEwMzE4MzksImV4cCI6MjA5NjYwNzgzOX0.GiE_KDM3QGcMYy3ZPtE9ZYy3gbmvpkrw4pdtAbPPuAM";
async function sbAuth(path, body) {
  const res = await fetch(`${SUPABASE_URL}/auth/v1${path}`, {
    method: "POST",
    headers: {
      "apikey": SUPABASE_ANON,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(body)
  });
  return res.json();
}
async function sbGet(path, token) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1${path}`, {
    headers: {
      "apikey": SUPABASE_ANON,
      "Authorization": `Bearer ${token}`,
      "Content-Type": "application/json"
    }
  });
  if (!res.ok) return null;
  return res.json();
}
async function sbPost(path, body, token) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1${path}`, {
    method: "POST",
    headers: {
      "apikey": SUPABASE_ANON,
      "Authorization": `Bearer ${token}`,
      "Content-Type": "application/json",
      "Prefer": "return=minimal"
    },
    body: JSON.stringify(body)
  });
  return res.ok;
}

// ── Auth Context ──────────────────────────────────────────────────────────────
const SessionContext = /*#__PURE__*/createContext(null);
function AppShell({
  children
}) {
  const [session, setSession] = useState(null); // Supabase session
  const [profile, setProfile] = useState(null); // gym_users row + gym info
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
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
    const data = await sbAuth("/token?grant_type=password", {
      email,
      password
    });
    if (data.error) {
      setError(data.error_description || data.error);
      return false;
    }
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
  const isOwner = profile?.role === "owner";
  const isTrainer = profile?.role === "trainer";
  const canAccess = route => {
    const trainerRoutes = ["members", "today", "suspensions", "departures", "alerts"];
    const ownerRoutes = [...trainerRoutes, "dashboard", "growth", "bizhealth", "analytics", "settings", "users", "billing", "integrations"];
    return isOwner ? ownerRoutes.includes(route) : trainerRoutes.includes(route);
  };
  return /*#__PURE__*/React.createElement(SessionContext.Provider, {
    value: {
      session,
      profile,
      loading,
      error,
      setError,
      signIn,
      signOut,
      isOwner,
      isTrainer,
      canAccess
    }
  }, children);
}
const useSession = () => useContext(SessionContext);

// ── Shared input style ────────────────────────────────────────────────────────
const inputStyle = {
  width: "100%",
  background: T.surface2,
  border: `1px solid ${T.border}`,
  borderRadius: 8,
  padding: "10px 14px",
  color: T.text,
  fontSize: 13,
  outline: "none"
};
const labelStyle = {
  fontSize: 12,
  color: T.muted,
  fontWeight: 600,
  marginBottom: 5,
  display: "block"
};
const btnPrimary = {
  width: "100%",
  background: T.accent,
  color: "white",
  border: "none",
  borderRadius: 8,
  padding: "12px",
  fontSize: 14,
  fontWeight: 700,
  cursor: "pointer",
  transition: "opacity 0.15s"
};
const btnSecondary = {
  width: "100%",
  background: "transparent",
  color: T.muted,
  border: `1px solid ${T.border}`,
  borderRadius: 8,
  padding: "12px",
  fontSize: 13,
  fontWeight: 600,
  cursor: "pointer"
};

// ── Logo mark ─────────────────────────────────────────────────────────────────
function LogoMark({
  size = 36
}) {
  return /*#__PURE__*/React.createElement("svg", {
    width: size,
    height: size,
    viewBox: "0 0 100 100",
    fill: "none"
  }, /*#__PURE__*/React.createElement("defs", null, /*#__PURE__*/React.createElement("linearGradient", {
    id: "alg",
    x1: "0",
    y1: "0",
    x2: "100",
    y2: "100",
    gradientUnits: "userSpaceOnUse"
  }, /*#__PURE__*/React.createElement("stop", {
    stopColor: "#6366f1"
  }), /*#__PURE__*/React.createElement("stop", {
    offset: "1",
    stopColor: "#a5b4fc"
  }))), /*#__PURE__*/React.createElement("rect", {
    width: "100",
    height: "100",
    rx: "24",
    fill: "url(#alg)"
  }), /*#__PURE__*/React.createElement("polyline", {
    points: "10,58 26,58 34,36 42,66 50,26 58,50 66,44 80,44",
    stroke: "white",
    strokeWidth: "5.5",
    strokeLinecap: "round",
    strokeLinejoin: "round",
    fill: "none"
  }), /*#__PURE__*/React.createElement("line", {
    x1: "52",
    y1: "74",
    x2: "90",
    y2: "34",
    stroke: "white",
    strokeWidth: "3.5",
    strokeOpacity: "0.45",
    strokeLinecap: "round"
  }), /*#__PURE__*/React.createElement("polygon", {
    points: "90,34 79,31 87,43",
    fill: "white",
    fillOpacity: "0.7"
  }));
}
function AuthShell({
  children,
  title,
  sub
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      minHeight: "100vh",
      background: T.bg,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      padding: 20
    }
  }, /*#__PURE__*/React.createElement("style", null, FONT), /*#__PURE__*/React.createElement("div", {
    style: {
      width: "100%",
      maxWidth: 420
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      textAlign: "center",
      marginBottom: 32
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      justifyContent: "center",
      marginBottom: 12
    }
  }, /*#__PURE__*/React.createElement(LogoMark, {
    size: 48
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      fontWeight: 800,
      fontSize: 22,
      color: T.text,
      letterSpacing: "-0.5px"
    }
  }, "PulseCheck"), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 11,
      color: T.muted,
      marginTop: 2
    }
  }, "WHO'S IN. WHO'S DRIFTING. WHO NEEDS YOU.")), /*#__PURE__*/React.createElement("div", {
    style: {
      background: T.surface,
      border: `1px solid ${T.border}`,
      borderRadius: 14,
      padding: "28px 28px"
    }
  }, title && /*#__PURE__*/React.createElement("div", {
    style: {
      fontWeight: 700,
      fontSize: 18,
      color: T.text,
      marginBottom: 4
    }
  }, title), sub && /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 12,
      color: T.muted,
      marginBottom: 22
    }
  }, sub), children), /*#__PURE__*/React.createElement("div", {
    style: {
      textAlign: "center",
      marginTop: 16,
      fontSize: 11,
      color: T.muted
    }
  }, "\xA9 2026 PulseCheck \xB7 Member Health Intelligence")));
}

// ── Sign In ───────────────────────────────────────────────────────────────────
function SignIn({
  onSignUp,
  onForgot
}) {
  const {
    signIn,
    error,
    setError
  } = useSession();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  async function handle(e) {
    e.preventDefault();
    setLoading(true);
    await signIn(email, password);
    setLoading(false);
  }
  return /*#__PURE__*/React.createElement(AuthShell, {
    title: "Welcome back",
    sub: "Sign in to your PulseCheck account"
  }, error && /*#__PURE__*/React.createElement("div", {
    style: {
      background: T.redBg,
      border: `1px solid ${T.redBorder}`,
      borderRadius: 8,
      padding: "10px 14px",
      marginBottom: 16,
      fontSize: 12,
      color: T.red
    }
  }, error), /*#__PURE__*/React.createElement("form", {
    onSubmit: handle
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      marginBottom: 16
    }
  }, /*#__PURE__*/React.createElement("label", {
    style: labelStyle
  }, "Email"), /*#__PURE__*/React.createElement("input", {
    style: inputStyle,
    type: "email",
    value: email,
    onChange: e => setEmail(e.target.value),
    placeholder: "you@yourgym.com",
    required: true,
    onFocus: e => e.target.style.borderColor = T.accent,
    onBlur: e => e.target.style.borderColor = T.border
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      marginBottom: 8
    }
  }, /*#__PURE__*/React.createElement("label", {
    style: labelStyle
  }, "Password"), /*#__PURE__*/React.createElement("input", {
    style: inputStyle,
    type: "password",
    value: password,
    onChange: e => setPassword(e.target.value),
    placeholder: "\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022",
    required: true,
    onFocus: e => e.target.style.borderColor = T.accent,
    onBlur: e => e.target.style.borderColor = T.border
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      textAlign: "right",
      marginBottom: 20
    }
  }, /*#__PURE__*/React.createElement("button", {
    type: "button",
    onClick: onForgot,
    style: {
      fontSize: 12,
      color: T.muted,
      background: "none",
      border: "none",
      cursor: "pointer"
    }
  }, "Forgot password?")), /*#__PURE__*/React.createElement("button", {
    type: "submit",
    style: {
      ...btnPrimary,
      opacity: loading ? 0.6 : 1
    },
    disabled: loading
  }, loading ? "Signing in…" : "Sign In →")), /*#__PURE__*/React.createElement("div", {
    style: {
      textAlign: "center",
      marginTop: 18,
      fontSize: 12,
      color: T.muted
    }
  }, "New gym?", " ", /*#__PURE__*/React.createElement("button", {
    onClick: onSignUp,
    style: {
      color: T.accent,
      background: "none",
      border: "none",
      cursor: "pointer",
      fontWeight: 600,
      fontSize: 12
    }
  }, "Set up your account")));
}

// ── Owner Sign Up (gym onboarding) ────────────────────────────────────────────
function SignUp({
  onSignIn
}) {
  const [step, setStep] = useState(1); // 1=account, 2=gym, 3=platform, 4=done
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
    confirm: "",
    gymName: "",
    location: "",
    platform: "hapana",
    accessId: "",
    siteId: ""
  });
  function set(k, v) {
    setForm(f => ({
      ...f,
      [k]: v
    }));
  }
  const stepLabels = ["Account", "Your Gym", "Connect Platform", "Done"];
  async function submit() {
    setLoading(true);
    setError(null);
    try {
      // 1. Create Supabase auth user
      const authData = await sbAuth("/signup", {
        email: form.email,
        password: form.password
      });
      if (authData.error) throw new Error(authData.error_description || authData.error);

      // 2. Create gym + user records via edge function (has service key)
      const res = await fetch(`${SUPABASE_URL}/functions/v1/onboard-gym`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${authData.access_token}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          ownerName: form.name,
          gymName: form.gymName,
          location: form.location,
          platform: form.platform,
          accessId: form.accessId,
          siteId: form.siteId
        })
      });
      if (!res.ok) throw new Error("Gym setup failed. Please try again.");
      setStep(4);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }
  const inputF = (k, type = "text", placeholder = "") => /*#__PURE__*/React.createElement("input", {
    style: inputStyle,
    type: type,
    value: form[k],
    onChange: e => set(k, e.target.value),
    placeholder: placeholder,
    required: true,
    onFocus: e => e.target.style.borderColor = T.accent,
    onBlur: e => e.target.style.borderColor = T.border
  });
  return /*#__PURE__*/React.createElement(AuthShell, {
    title: "Set up PulseCheck",
    sub: `Step ${step} of 3 — ${stepLabels[step - 1]}`
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      gap: 6,
      marginBottom: 24
    }
  }, [1, 2, 3].map(s => /*#__PURE__*/React.createElement("div", {
    key: s,
    style: {
      flex: 1,
      height: 3,
      borderRadius: 99,
      background: s <= step ? T.accent : T.border,
      transition: "background 0.3s"
    }
  }))), error && /*#__PURE__*/React.createElement("div", {
    style: {
      background: T.redBg,
      border: `1px solid ${T.redBorder}`,
      borderRadius: 8,
      padding: "10px 14px",
      marginBottom: 16,
      fontSize: 12,
      color: T.red
    }
  }, error), step === 1 && /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: {
      marginBottom: 16
    }
  }, /*#__PURE__*/React.createElement("label", {
    style: labelStyle
  }, "Your Name"), inputF("name", "text", "Mic Smith")), /*#__PURE__*/React.createElement("div", {
    style: {
      marginBottom: 16
    }
  }, /*#__PURE__*/React.createElement("label", {
    style: labelStyle
  }, "Email"), inputF("email", "email", "you@yourgym.com")), /*#__PURE__*/React.createElement("div", {
    style: {
      marginBottom: 16
    }
  }, /*#__PURE__*/React.createElement("label", {
    style: labelStyle
  }, "Password"), inputF("password", "password", "Min 8 characters")), /*#__PURE__*/React.createElement("div", {
    style: {
      marginBottom: 24
    }
  }, /*#__PURE__*/React.createElement("label", {
    style: labelStyle
  }, "Confirm Password"), inputF("confirm", "password", "Repeat password")), /*#__PURE__*/React.createElement("button", {
    style: btnPrimary,
    onClick: () => {
      if (!form.name || !form.email || !form.password) return setError("Please fill all fields");
      if (form.password !== form.confirm) return setError("Passwords don't match");
      if (form.password.length < 8) return setError("Password must be 8+ characters");
      setError(null);
      setStep(2);
    }
  }, "Continue \u2192")), step === 2 && /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: {
      marginBottom: 16
    }
  }, /*#__PURE__*/React.createElement("label", {
    style: labelStyle
  }, "Gym Name"), inputF("gymName", "text", "Fitstop Sippy Downs")), /*#__PURE__*/React.createElement("div", {
    style: {
      marginBottom: 24
    }
  }, /*#__PURE__*/React.createElement("label", {
    style: labelStyle
  }, "Location"), inputF("location", "text", "Sippy Downs, QLD, Australia")), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      gap: 10
    }
  }, /*#__PURE__*/React.createElement("button", {
    style: {
      ...btnSecondary,
      flex: 1
    },
    onClick: () => setStep(1)
  }, "\u2190 Back"), /*#__PURE__*/React.createElement("button", {
    style: {
      ...btnPrimary,
      flex: 2
    },
    onClick: () => {
      if (!form.gymName) return setError("Please enter your gym name");
      setError(null);
      setStep(3);
    }
  }, "Continue \u2192"))), step === 3 && /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: {
      marginBottom: 16
    }
  }, /*#__PURE__*/React.createElement("label", {
    style: labelStyle
  }, "Booking Platform"), /*#__PURE__*/React.createElement("select", {
    style: inputStyle,
    value: form.platform,
    onChange: e => set("platform", e.target.value)
  }, /*#__PURE__*/React.createElement("option", {
    value: "hapana"
  }, "Hapana"), /*#__PURE__*/React.createElement("option", {
    value: "mindbody"
  }, "Mindbody"), /*#__PURE__*/React.createElement("option", {
    value: "glofox"
  }, "Glofox"), /*#__PURE__*/React.createElement("option", {
    value: "pike13"
  }, "Pike13"), /*#__PURE__*/React.createElement("option", {
    value: "manual"
  }, "Manual / CSV Upload"))), form.platform !== "manual" && /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("div", {
    style: {
      marginBottom: 16
    }
  }, /*#__PURE__*/React.createElement("label", {
    style: labelStyle
  }, "API Access ID / Key"), inputF("accessId", "password", "Your platform API key"), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 10,
      color: T.muted,
      marginTop: 5
    }
  }, "Stored encrypted. Never visible after saving.")), /*#__PURE__*/React.createElement("div", {
    style: {
      marginBottom: 16
    }
  }, /*#__PURE__*/React.createElement("label", {
    style: labelStyle
  }, "Site ID / Business ID"), inputF("siteId", "text", "Your site or location ID"))), /*#__PURE__*/React.createElement("div", {
    style: {
      background: T.surface2,
      border: `1px solid ${T.border}`,
      borderRadius: 8,
      padding: "10px 12px",
      marginBottom: 20,
      fontSize: 11,
      color: T.muted,
      lineHeight: 1.6
    }
  }, "\uD83D\uDD12 Your API credentials are encrypted and stored securely. They are never exposed to the frontend and only used by our sync service."), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      gap: 10
    }
  }, /*#__PURE__*/React.createElement("button", {
    style: {
      ...btnSecondary,
      flex: 1
    },
    onClick: () => setStep(2)
  }, "\u2190 Back"), /*#__PURE__*/React.createElement("button", {
    style: {
      ...btnPrimary,
      flex: 2,
      opacity: loading ? 0.6 : 1
    },
    disabled: loading,
    onClick: submit
  }, loading ? "Setting up…" : "Launch PulseCheck 🚀"))), step === 4 && /*#__PURE__*/React.createElement("div", {
    style: {
      textAlign: "center",
      padding: "8px 0"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 48,
      marginBottom: 12
    }
  }, "\uD83C\uDF89"), /*#__PURE__*/React.createElement("div", {
    style: {
      fontWeight: 700,
      fontSize: 16,
      color: T.text,
      marginBottom: 8
    }
  }, "You're all set!"), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 12,
      color: T.muted,
      lineHeight: 1.6,
      marginBottom: 24
    }
  }, "Your gym is connected. We're syncing your member data now \u2014 this takes about 30 seconds."), /*#__PURE__*/React.createElement("button", {
    style: btnPrimary,
    onClick: onSignIn
  }, "Open PulseCheck \u2192")), step === 1 && /*#__PURE__*/React.createElement("div", {
    style: {
      textAlign: "center",
      marginTop: 18,
      fontSize: 12,
      color: T.muted
    }
  }, "Already have an account?", " ", /*#__PURE__*/React.createElement("button", {
    onClick: onSignIn,
    style: {
      color: T.accent,
      background: "none",
      border: "none",
      cursor: "pointer",
      fontWeight: 600,
      fontSize: 12
    }
  }, "Sign in")));
}

// ── Forgot Password ───────────────────────────────────────────────────────────
function ForgotPassword({
  onBack
}) {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);
  async function handle(e) {
    e.preventDefault();
    setLoading(true);
    await sbAuth("/recover", {
      email
    });
    setSent(true);
    setLoading(false);
  }
  return /*#__PURE__*/React.createElement(AuthShell, {
    title: "Reset password",
    sub: "We'll send a reset link to your email"
  }, sent ? /*#__PURE__*/React.createElement("div", {
    style: {
      textAlign: "center",
      padding: "8px 0"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 40,
      marginBottom: 12
    }
  }, "\uD83D\uDCE7"), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 13,
      color: T.text,
      marginBottom: 20,
      lineHeight: 1.6
    }
  }, "Reset link sent to ", /*#__PURE__*/React.createElement("strong", null, email), ". Check your inbox."), /*#__PURE__*/React.createElement("button", {
    style: btnSecondary,
    onClick: onBack
  }, "Back to Sign In")) : /*#__PURE__*/React.createElement("form", {
    onSubmit: handle
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      marginBottom: 20
    }
  }, /*#__PURE__*/React.createElement("label", {
    style: labelStyle
  }, "Email"), /*#__PURE__*/React.createElement("input", {
    style: inputStyle,
    type: "email",
    value: email,
    onChange: e => setEmail(e.target.value),
    placeholder: "you@yourgym.com",
    required: true,
    onFocus: e => e.target.style.borderColor = T.accent,
    onBlur: e => e.target.style.borderColor = T.border
  })), /*#__PURE__*/React.createElement("button", {
    type: "submit",
    style: {
      ...btnPrimary,
      opacity: loading ? 0.6 : 1
    },
    disabled: loading
  }, loading ? "Sending…" : "Send Reset Link"), /*#__PURE__*/React.createElement("button", {
    type: "button",
    style: {
      ...btnSecondary,
      marginTop: 10
    },
    onClick: onBack
  }, "Back to Sign In")));
}

// ── Accept Invitation (trainer signup) ───────────────────────────────────────
function AcceptInvite({
  token
}) {
  const {
    signIn
  } = useSession();
  const [invite, setInvite] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [form, setForm] = useState({
    name: "",
    password: "",
    confirm: ""
  });
  useEffect(() => {
    // Look up invitation by token
    fetch(`${SUPABASE_URL}/rest/v1/invitations?token=eq.${token}&select=*,gyms(name,slug)`, {
      headers: {
        "apikey": SUPABASE_ANON
      }
    }).then(r => r.json()).then(data => {
      const inv = data?.[0];
      if (!inv || inv.status !== "pending" || new Date(inv.expires_at) < new Date()) {
        setError("This invitation is invalid or has expired.");
      } else {
        setInvite(inv);
      }
      setLoading(false);
    }).catch(() => {
      setError("Could not load invitation.");
      setLoading(false);
    });
  }, [token]);
  async function accept(e) {
    e.preventDefault();
    if (form.password !== form.confirm) return setError("Passwords don't match");
    if (form.password.length < 8) return setError("Password must be 8+ characters");
    setSaving(true);
    setError(null);
    try {
      // Create auth user
      const authData = await sbAuth("/signup", {
        email: invite.email,
        password: form.password
      });
      if (authData.error) throw new Error(authData.error_description || authData.error);

      // Accept invite via edge function
      const res = await fetch(`${SUPABASE_URL}/functions/v1/accept-invite`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${authData.access_token}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          token,
          name: form.name
        })
      });
      if (!res.ok) throw new Error("Could not accept invitation. Please try again.");

      // Sign in
      await signIn(invite.email, form.password);
    } catch (e) {
      setError(e.message);
      setSaving(false);
    }
  }
  if (loading) return /*#__PURE__*/React.createElement(AuthShell, null, /*#__PURE__*/React.createElement("div", {
    style: {
      textAlign: "center",
      color: T.muted,
      padding: "20px 0"
    }
  }, "Loading invitation\u2026"));
  if (error && !invite) return /*#__PURE__*/React.createElement(AuthShell, {
    title: "Invalid Invitation"
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      color: T.red,
      fontSize: 13,
      textAlign: "center"
    }
  }, error));
  return /*#__PURE__*/React.createElement(AuthShell, {
    title: `Join ${invite?.gyms?.name || "PulseCheck"}`,
    sub: `You've been invited as a ${invite?.role || "trainer"}. Set up your account below.`
  }, error && /*#__PURE__*/React.createElement("div", {
    style: {
      background: T.redBg,
      border: `1px solid ${T.redBorder}`,
      borderRadius: 8,
      padding: "10px 14px",
      marginBottom: 16,
      fontSize: 12,
      color: T.red
    }
  }, error), /*#__PURE__*/React.createElement("form", {
    onSubmit: accept
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      background: T.surface2,
      border: `1px solid ${T.border}`,
      borderRadius: 8,
      padding: "10px 14px",
      marginBottom: 16,
      fontSize: 12,
      color: T.muted
    }
  }, "Joining as: ", /*#__PURE__*/React.createElement("strong", {
    style: {
      color: T.text
    }
  }, invite?.email)), /*#__PURE__*/React.createElement("div", {
    style: {
      marginBottom: 16
    }
  }, /*#__PURE__*/React.createElement("label", {
    style: labelStyle
  }, "Your Name"), /*#__PURE__*/React.createElement("input", {
    style: inputStyle,
    type: "text",
    value: form.name,
    onChange: e => setForm(f => ({
      ...f,
      name: e.target.value
    })),
    placeholder: "Your full name",
    required: true,
    onFocus: e => e.target.style.borderColor = T.accent,
    onBlur: e => e.target.style.borderColor = T.border
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      marginBottom: 16
    }
  }, /*#__PURE__*/React.createElement("label", {
    style: labelStyle
  }, "Password"), /*#__PURE__*/React.createElement("input", {
    style: inputStyle,
    type: "password",
    value: form.password,
    onChange: e => setForm(f => ({
      ...f,
      password: e.target.value
    })),
    placeholder: "Min 8 characters",
    required: true,
    onFocus: e => e.target.style.borderColor = T.accent,
    onBlur: e => e.target.style.borderColor = T.border
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      marginBottom: 24
    }
  }, /*#__PURE__*/React.createElement("label", {
    style: labelStyle
  }, "Confirm Password"), /*#__PURE__*/React.createElement("input", {
    style: inputStyle,
    type: "password",
    value: form.confirm,
    onChange: e => setForm(f => ({
      ...f,
      confirm: e.target.value
    })),
    placeholder: "Repeat password",
    required: true,
    onFocus: e => e.target.style.borderColor = T.accent,
    onBlur: e => e.target.style.borderColor = T.border
  })), /*#__PURE__*/React.createElement("button", {
    type: "submit",
    style: {
      ...btnPrimary,
      opacity: saving ? 0.6 : 1
    },
    disabled: saving
  }, saving ? "Setting up…" : "Accept Invitation →")));
}

// ── Settings — Owner only ─────────────────────────────────────────────────────
function Settings() {
  const {
    profile,
    session
  } = useSession();
  const [activeTab, setActiveTab] = useState("users");
  const [users, setUsers] = useState([]);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("trainer");
  const [inviting, setInviting] = useState(false);
  const [inviteSent, setInviteSent] = useState(false);
  const [targets, setTargets] = useState({
    "Legacy M:M": 3,
    "12 Month": 3,
    "6 Month": 3,
    "M:M": 3,
    "2x Per Week": 2,
    "21 Day Starter": 3,
    "default": 3
  });
  const [settingsSaved, setSettingsSaved] = useState(false);
  useEffect(() => {
    if (!session) return;
    sbGet(`/gym_users?gym_id=eq.${profile?.gym_id}&order=role.asc,name.asc`, session.access_token).then(data => setUsers(data || []));
  }, [session, profile]);
  async function sendInvite() {
    if (!inviteEmail) return;
    setInviting(true);
    const ok = await sbPost("/invitations", {
      gym_id: profile?.gym_id,
      invited_by: profile?.id,
      email: inviteEmail.toLowerCase().trim(),
      role: inviteRole
    }, session.access_token);
    if (ok) {
      setInviteSent(true);
      setInviteEmail("");
      setTimeout(() => setInviteSent(false), 3000);
    }
    setInviting(false);
  }
  async function changeRole(userId, newRole) {
    await fetch(`${SUPABASE_URL}/rest/v1/gym_users?id=eq.${userId}`, {
      method: "PATCH",
      headers: {
        "apikey": SUPABASE_ANON,
        "Authorization": `Bearer ${session.access_token}`,
        "Content-Type": "application/json",
        "Prefer": "return=minimal"
      },
      body: JSON.stringify({
        role: newRole
      })
    });
    setUsers(u => u.map(x => x.id === userId ? {
      ...x,
      role: newRole
    } : x));
  }
  async function removeUser(userId) {
    if (!confirm("Remove this user from your gym?")) return;
    await fetch(`${SUPABASE_URL}/rest/v1/gym_users?id=eq.${userId}`, {
      method: "DELETE",
      headers: {
        "apikey": SUPABASE_ANON,
        "Authorization": `Bearer ${session.access_token}`
      }
    });
    setUsers(u => u.filter(x => x.id !== userId));
  }
  const TABS = [{
    id: "users",
    label: "👥 Users",
    ownerOnly: true
  }, {
    id: "targets",
    label: "🎯 Session Targets"
  }, {
    id: "integration",
    label: "🔌 Integration",
    ownerOnly: true
  }, {
    id: "billing",
    label: "💳 Billing",
    ownerOnly: true
  }, {
    id: "gym",
    label: "🏋️ Gym Profile",
    ownerOnly: true
  }];
  const roleColors = {
    owner: {
      bg: "#1a1a2e",
      color: "#a5b4fc",
      border: "#3a3a5c"
    },
    trainer: {
      bg: "#0d2318",
      color: "#4ade80",
      border: "#1a4d30"
    }
  };
  return /*#__PURE__*/React.createElement("div", {
    style: {
      maxWidth: 760,
      margin: "0 auto",
      padding: "0 0 40px"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      gap: 2,
      borderBottom: `1px solid ${T.border}`,
      marginBottom: 24,
      overflowX: "auto"
    }
  }, TABS.map(t => /*#__PURE__*/React.createElement("button", {
    key: t.id,
    onClick: () => setActiveTab(t.id),
    style: {
      fontSize: 12,
      fontWeight: 600,
      padding: "10px 16px",
      border: "none",
      background: "none",
      cursor: "pointer",
      whiteSpace: "nowrap",
      fontFamily: "'DM Sans',sans-serif",
      borderBottom: activeTab === t.id ? `2px solid ${T.accent}` : "2px solid transparent",
      color: activeTab === t.id ? T.text : T.muted,
      marginBottom: -1
    }
  }, t.label))), activeTab === "users" && /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: {
      fontWeight: 700,
      fontSize: 15,
      color: T.text,
      marginBottom: 4
    }
  }, "Team Members"), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 12,
      color: T.muted,
      marginBottom: 20
    }
  }, "Manage who has access to your PulseCheck account."), /*#__PURE__*/React.createElement("div", {
    style: {
      background: T.surface,
      border: `1px solid ${T.border}`,
      borderRadius: 12,
      padding: "18px 20px",
      marginBottom: 20
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontWeight: 600,
      fontSize: 13,
      color: T.text,
      marginBottom: 12
    }
  }, "Invite a Team Member"), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      gap: 8,
      flexWrap: "wrap"
    }
  }, /*#__PURE__*/React.createElement("input", {
    value: inviteEmail,
    onChange: e => setInviteEmail(e.target.value),
    placeholder: "trainer@yourgym.com",
    style: {
      ...inputStyle,
      flex: "1 1 200px"
    },
    onFocus: e => e.target.style.borderColor = T.accent,
    onBlur: e => e.target.style.borderColor = T.border
  }), /*#__PURE__*/React.createElement("select", {
    value: inviteRole,
    onChange: e => setInviteRole(e.target.value),
    style: {
      ...inputStyle,
      width: "auto",
      flex: "0 0 120px"
    }
  }, /*#__PURE__*/React.createElement("option", {
    value: "trainer"
  }, "Trainer"), /*#__PURE__*/React.createElement("option", {
    value: "owner"
  }, "Owner")), /*#__PURE__*/React.createElement("button", {
    onClick: sendInvite,
    disabled: inviting || !inviteEmail,
    style: {
      ...btnPrimary,
      width: "auto",
      padding: "10px 20px",
      opacity: inviting || !inviteEmail ? 0.5 : 1,
      flex: "0 0 auto"
    }
  }, inviteSent ? "✓ Sent!" : inviting ? "Sending…" : "Send Invite")), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 11,
      color: T.muted,
      marginTop: 8
    }
  }, "They'll receive an email with a link to set up their account. Expires in 7 days.")), /*#__PURE__*/React.createElement("div", {
    style: {
      background: T.surface,
      border: `1px solid ${T.border}`,
      borderRadius: 12,
      overflow: "hidden"
    }
  }, users.map((u, i) => {
    const rc = roleColors[u.role] || roleColors.trainer;
    const isYou = u.auth_user_id === session?.user?.id;
    return /*#__PURE__*/React.createElement("div", {
      key: u.id,
      style: {
        display: "flex",
        alignItems: "center",
        gap: 12,
        padding: "14px 18px",
        borderBottom: i < users.length - 1 ? `1px solid ${T.border}` : "none"
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        width: 36,
        height: 36,
        borderRadius: "50%",
        background: T.accent + "44",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: 13,
        fontWeight: 700,
        color: T.accent,
        flexShrink: 0
      }
    }, u.name?.split(" ").map(p => p[0]).join("").slice(0, 2).toUpperCase() || "??"), /*#__PURE__*/React.createElement("div", {
      style: {
        flex: 1
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        fontWeight: 600,
        fontSize: 13,
        color: T.text
      }
    }, u.name, " ", isYou && /*#__PURE__*/React.createElement("span", {
      style: {
        fontSize: 10,
        color: T.muted
      }
    }, "(you)")), /*#__PURE__*/React.createElement("div", {
      style: {
        fontSize: 11,
        color: T.muted
      }
    }, u.email)), /*#__PURE__*/React.createElement("span", {
      style: {
        fontSize: 10,
        fontWeight: 700,
        padding: "2px 9px",
        borderRadius: 99,
        background: rc.bg,
        color: rc.color,
        border: `1px solid ${rc.border}`,
        textTransform: "uppercase",
        letterSpacing: "0.06em"
      }
    }, u.role), !isYou && /*#__PURE__*/React.createElement("div", {
      style: {
        display: "flex",
        gap: 6
      }
    }, /*#__PURE__*/React.createElement("select", {
      value: u.role,
      onChange: e => changeRole(u.id, e.target.value),
      style: {
        fontSize: 11,
        background: T.surface2,
        border: `1px solid ${T.border}`,
        color: T.muted,
        padding: "4px 8px",
        borderRadius: 6,
        cursor: "pointer"
      }
    }, /*#__PURE__*/React.createElement("option", {
      value: "trainer"
    }, "Trainer"), /*#__PURE__*/React.createElement("option", {
      value: "owner"
    }, "Owner")), /*#__PURE__*/React.createElement("button", {
      onClick: () => removeUser(u.id),
      style: {
        fontSize: 11,
        background: "transparent",
        border: `1px solid ${T.border}`,
        color: T.muted,
        padding: "4px 10px",
        borderRadius: 6,
        cursor: "pointer"
      },
      onMouseEnter: e => {
        e.target.style.color = "#f87171";
        e.target.style.borderColor = "#4a1515";
      },
      onMouseLeave: e => {
        e.target.style.color = T.muted;
        e.target.style.borderColor = T.border;
      }
    }, "Remove")));
  }), users.length === 0 && /*#__PURE__*/React.createElement("div", {
    style: {
      padding: 24,
      textAlign: "center",
      color: T.muted,
      fontSize: 13
    }
  }, "No team members yet. Send your first invite above."))), activeTab === "targets" && /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: {
      fontWeight: 700,
      fontSize: 15,
      color: T.text,
      marginBottom: 4
    }
  }, "Session Targets"), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 12,
      color: T.muted,
      marginBottom: 20
    }
  }, "Set the weekly session target per membership type. This determines green / amber / red status."), /*#__PURE__*/React.createElement("div", {
    style: {
      background: T.surface,
      border: `1px solid ${T.border}`,
      borderRadius: 12,
      overflow: "hidden"
    }
  }, Object.entries(targets).map(([pkg, val], i, arr) => /*#__PURE__*/React.createElement("div", {
    key: pkg,
    style: {
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      padding: "14px 18px",
      borderBottom: i < arr.length - 1 ? `1px solid ${T.border}` : "none"
    }
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: {
      fontWeight: 600,
      fontSize: 13,
      color: T.text
    }
  }, pkg === "default" ? "All other memberships" : pkg), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 11,
      color: T.muted
    }
  }, "Target sessions per week")), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      gap: 10
    }
  }, /*#__PURE__*/React.createElement("button", {
    onClick: () => setTargets(t => ({
      ...t,
      [pkg]: Math.max(1, val - 1)
    })),
    style: {
      width: 28,
      height: 28,
      borderRadius: 6,
      border: `1px solid ${T.border}`,
      background: T.surface2,
      color: T.text,
      cursor: "pointer",
      fontSize: 16
    }
  }, "\u2212"), /*#__PURE__*/React.createElement("span", {
    style: {
      fontWeight: 700,
      fontSize: 18,
      color: T.accent,
      fontFamily: "'DM Mono',monospace",
      width: 24,
      textAlign: "center"
    }
  }, val), /*#__PURE__*/React.createElement("button", {
    onClick: () => setTargets(t => ({
      ...t,
      [pkg]: Math.min(7, val + 1)
    })),
    style: {
      width: 28,
      height: 28,
      borderRadius: 6,
      border: `1px solid ${T.border}`,
      background: T.surface2,
      color: T.text,
      cursor: "pointer",
      fontSize: 16
    }
  }, "+"))))), /*#__PURE__*/React.createElement("button", {
    onClick: () => setSettingsSaved(true),
    style: {
      ...btnPrimary,
      marginTop: 16,
      opacity: 1
    }
  }, settingsSaved ? "✓ Saved" : "Save Targets")), activeTab === "integration" && /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: {
      fontWeight: 700,
      fontSize: 15,
      color: T.text,
      marginBottom: 4
    }
  }, "Platform Integration"), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 12,
      color: T.muted,
      marginBottom: 20
    }
  }, "Your booking platform connection. Syncs every 15 minutes."), /*#__PURE__*/React.createElement("div", {
    style: {
      background: T.surface,
      border: `1px solid ${T.border}`,
      borderRadius: 12,
      padding: "18px 20px",
      marginBottom: 16
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      marginBottom: 16
    }
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: {
      fontWeight: 600,
      fontSize: 13,
      color: T.text
    }
  }, "Hapana"), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 11,
      color: T.muted
    }
  }, profile?.gym_name)), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 10,
      fontWeight: 700,
      padding: "3px 10px",
      borderRadius: 99,
      background: T.greenBg,
      color: T.green,
      border: `1px solid ${T.greenBorder}`
    }
  }, "CONNECTED")), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 11,
      color: T.muted,
      marginBottom: 8
    }
  }, "Last synced: ", profile?.last_synced_at ? new Date(profile.last_synced_at).toLocaleString("en-AU") : "Never"), /*#__PURE__*/React.createElement("button", {
    style: {
      ...btnSecondary,
      width: "auto",
      padding: "8px 16px",
      fontSize: 12
    }
  }, "Sync Now")), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 11,
      color: T.muted,
      lineHeight: 1.6
    }
  }, "\uD83D\uDD12 API credentials are stored encrypted and never exposed to the browser. To update credentials, contact support.")), activeTab === "billing" && /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: {
      fontWeight: 700,
      fontSize: 15,
      color: T.text,
      marginBottom: 4
    }
  }, "Billing"), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 12,
      color: T.muted,
      marginBottom: 20
    }
  }, "Your PulseCheck subscription."), /*#__PURE__*/React.createElement("div", {
    style: {
      background: T.surface,
      border: `1px solid ${T.border}`,
      borderRadius: 12,
      padding: "20px"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      marginBottom: 16
    }
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: {
      fontWeight: 700,
      fontSize: 16,
      color: T.text
    }
  }, "PulseCheck Standard"), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 12,
      color: T.muted
    }
  }, "Single location \xB7 Unlimited coaches")), /*#__PURE__*/React.createElement("div", {
    style: {
      textAlign: "right"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontWeight: 800,
      fontSize: 22,
      color: T.accent
    }
  }, "$149"), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 11,
      color: T.muted
    }
  }, "+ GST / month"))), /*#__PURE__*/React.createElement("div", {
    style: {
      borderTop: `1px solid ${T.border}`,
      paddingTop: 14,
      display: "flex",
      gap: 12
    }
  }, /*#__PURE__*/React.createElement("button", {
    style: {
      ...btnSecondary,
      width: "auto",
      padding: "8px 16px",
      fontSize: 12
    }
  }, "Manage Billing"), /*#__PURE__*/React.createElement("button", {
    style: {
      ...btnSecondary,
      width: "auto",
      padding: "8px 16px",
      fontSize: 12,
      color: "#f87171"
    }
  }, "Cancel Subscription")))), activeTab === "gym" && /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: {
      fontWeight: 700,
      fontSize: 15,
      color: T.text,
      marginBottom: 4
    }
  }, "Gym Profile"), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 12,
      color: T.muted,
      marginBottom: 20
    }
  }, "Your gym details shown across PulseCheck."), /*#__PURE__*/React.createElement("div", {
    style: {
      background: T.surface,
      border: `1px solid ${T.border}`,
      borderRadius: 12,
      padding: "18px 20px"
    }
  }, [{
    label: "Gym Name",
    val: profile?.gym_name || ""
  }, {
    label: "Location",
    val: "Sippy Downs, QLD"
  }, {
    label: "Timezone",
    val: "Australia/Brisbane"
  }].map(f => /*#__PURE__*/React.createElement("div", {
    key: f.label,
    style: {
      marginBottom: 16
    }
  }, /*#__PURE__*/React.createElement("label", {
    style: labelStyle
  }, f.label), /*#__PURE__*/React.createElement("input", {
    defaultValue: f.val,
    style: inputStyle,
    onFocus: e => e.target.style.borderColor = T.accent,
    onBlur: e => e.target.style.borderColor = T.border
  }))), /*#__PURE__*/React.createElement("button", {
    style: {
      ...btnPrimary,
      marginTop: 4
    }
  }, "Save Changes"))));
}

// ── Auth Router — wraps the whole app ─────────────────────────────────────────
function AppGate({
  children
}) {
  const {
    session,
    profile,
    loading
  } = useSession();
  const [screen, setScreen] = useState("signin"); // signin | signup | forgot | invite

  // Check for invite token in URL
  const urlParams = new URLSearchParams(typeof window !== "undefined" ? window.location.search : "");
  const inviteToken = urlParams.get("invite");
  if (loading) {
    return /*#__PURE__*/React.createElement("div", {
      style: {
        minHeight: "100vh",
        background: T.bg,
        display: "flex",
        alignItems: "center",
        justifyContent: "center"
      }
    }, /*#__PURE__*/React.createElement("style", null, FONT), /*#__PURE__*/React.createElement("div", {
      style: {
        textAlign: "center"
      }
    }, /*#__PURE__*/React.createElement(LogoMark, {
      size: 44
    }), /*#__PURE__*/React.createElement("div", {
      style: {
        color: T.muted,
        fontSize: 12,
        marginTop: 12
      }
    }, "Loading\u2026")));
  }
  if (inviteToken && !session) {
    return /*#__PURE__*/React.createElement(AcceptInvite, {
      token: inviteToken
    });
  }
  if (!session || !profile) {
    if (screen === "signup") return /*#__PURE__*/React.createElement(SignUp, {
      onSignIn: () => setScreen("signin")
    });
    if (screen === "forgot") return /*#__PURE__*/React.createElement(ForgotPassword, {
      onBack: () => setScreen("signin")
    });
    return /*#__PURE__*/React.createElement(SignIn, {
      onSignUp: () => setScreen("signup"),
      onForgot: () => setScreen("forgot")
    });
  }
  return children;
}

// Export for HTML script tag usage
if (typeof window !== 'undefined') {
  window.PulseCheckAuth = {
    AuthProvider,
    AuthRouter,
    useAuth,
    Settings,
    SignIn,
    SignUp
  };
}

// Register on window namespace for boot script access
window._pc = window._pc || {};
window._pc.AppProvider = AuthProvider;
window._pc.AppRouter = AuthRouter;
window._pc.useAppAuth = useSession;
window._pc.ready = true;

// Global exports
window.AppShell = AppShell;
window.AppGate = AppGate;
window.useSession = useSession;
window.Settings = Settings;
