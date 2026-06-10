"use strict";
var require = function(m) { if(m==="react") return React; if(m==="react-dom") return ReactDOM; return {}; };

const {
  useState,
  useMemo,
  useEffect
} = React;

/* ── Fonts ──────────────────────────────────────────────────────────────── */
const FONT = `
@import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600;700&family=DM+Mono:wght@400;500&display=swap');
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0;}
body{font-family:'DM Sans',sans-serif;background:#0f1117;color:#e8eaf0;}
::-webkit-scrollbar{width:5px;height:5px;}
::-webkit-scrollbar-track{background:#181c27;}
::-webkit-scrollbar-thumb{background:#2a2f42;border-radius:99px;}
`;

/* ── Design tokens ──────────────────────────────────────────────────────── */
const T = {
  bg: "#0f1117",
  surface: "#181c27",
  surface2: "#1e2333",
  border: "#2a2f42",
  text: "#e8eaf0",
  muted: "#6b7194",
  accent: "#6366f1",
  // green
  greenBg: "#0d2318",
  greenBorder: "#1a4d30",
  greenText: "#4ade80",
  // orange/amber
  orangeBg: "#2a1a08",
  orangeBorder: "#5a3510",
  orangeText: "#fb923c",
  // red
  redBg: "#200d0d",
  redBorder: "#4a1515",
  redText: "#f87171",
  // grey/suspended
  greyBg: "#1a1a2e",
  greyBorder: "#3a3a5c",
  greyText: "#a5b4fc",
  // pink/cancelling
  pinkBg: "#1f0d1f",
  pinkBorder: "#4a1545",
  pinkText: "#f0abfc",
  // disengaging — orange-red
  warnBg: "#2a1208",
  warnBorder: "#7a2a10",
  warnText: "#fb7185"
};
const WEEK_LABELS = ["5 May", "12 May", "19 May", "26 May", "2 Jun", "9 Jun"];

/* ── Data ───────────────────────────────────────────────────────────────── */
/* ── Supabase config ──────────────────────────────────────────────────────── */
const SUPABASE_URL = "https://vqhlstrvkrujahhinpbu.supabase.co";
const SUPABASE_ANON = "REPLACE_WITH_YOUR_ANON_KEY"; // Settings → API Keys → anon public

async function sbFetch(path, token) {
  const headers = {
    "apikey": SUPABASE_ANON,
    "Content-Type": "application/json"
  };
  if (token) headers["Authorization"] = "Bearer " + token;
  const r = await fetch(SUPABASE_URL + "/rest/v1" + path, {
    headers
  });
  if (!r.ok) return null;
  return r.json();
}
async function sbAuth(body) {
  const r = await fetch(SUPABASE_URL + "/auth/v1/token?grant_type=password", {
    method: "POST",
    headers: {
      "apikey": SUPABASE_ANON,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(body)
  });
  return r.json();
}
function expandMember(m) {
  return {
    id: m.id,
    name: (m.first_name + " " + m.last_name).trim(),
    initials: ((m.first_name || "")[0] || "") + ((m.last_name || "")[0] || ""),
    packageShort: m.package_short || "",
    months: m.months_member || 0,
    target: m.session_target || 3,
    status: m.membership_status || "active",
    risk: m.risk_status || "red",
    trend: m.trend || "stable",
    avg4: parseFloat(m.avg_sessions_4w || 0),
    consistency: m.consistency_pct || 0,
    total4weeks: m.total_sessions_4w || 0,
    thisWeek: m.this_week || 0,
    weeklyHistory: m.weekly_history || [0, 0, 0, 0, 0, 0],
    suspendedWeeks: m.suspended_weeks || [false, false, false, false, false, false],
    fav: m.fav_session || "",
    lastSession: m.last_session || "",
    memberSince: m.member_since || "",
    disengaging: m.is_disengaging || false,
    checkInFlag: m.checkin_flag || false,
    financialFlag: m.financial_flag || false,
    returnDate: m.suspended_until || null,
    cancelDate: m.cancel_date || null,
    cancelReason: m.cancel_reason || "",
    daysUntilReturn: m.days_until_return,
    daysUntilCancel: m.days_until_cancel,
    notes: ""
  };
}

/* ── Logic ──────────────────────────────────────────────────────────────── */
function getPulse(m) {
  if (m.status === "suspended") return null;
  const freq = Math.min(m.avg4 / m.target * 45, 45);
  const cons = m.consistency / 100 * 30;
  const tb = m.trend === "building" ? 25 : m.trend === "stable" ? 15 : m.trend === "drifting" ? 5 : 0;
  return Math.max(0, Math.round(freq + cons + tb));
}
function getPulseDelta(m) {
  const p = getPulse(m);
  if (p === null) return null;
  const prevAvg = m.weeklyHistory.slice(0, 4).reduce((a, b) => a + b, 0) / 4;
  const prevPulse = Math.min(prevAvg / m.target * 45, 45) + m.consistency / 100 * 30 + 15;
  return Math.round(p - prevPulse);
}
function getFlags(m) {
  const flags = [];
  if (m.disengaging) flags.push({
    type: "critical",
    text: "Zero sessions 2+ weeks — pre-cancel signal"
  });
  if (m.trend === "critical" && !m.disengaging) flags.push({
    type: "critical",
    text: "50%+ drop in attendance"
  });
  if (m.trend === "drifting") flags.push({
    type: "warn",
    text: "25–49% drop — drifting"
  });
  if (m.checkInFlag) flags.push({
    type: "warn",
    text: "Was consistent — now below target. Check in."
  });
  if (m.financialFlag) flags.push({
    type: "info",
    text: "Unlimited plan, avg < 1.5/wk — offer 2×/wk plan"
  });
  if (m.months <= 3 && m.avg4 < m.target) flags.push({
    type: "warn",
    text: "First 90 days — habit not forming yet"
  });
  if (m.months >= 10 && m.months <= 14 && m.avg4 < 2) flags.push({
    type: "warn",
    text: "12-month drop-off window"
  });
  return flags;
}
function getAction(m) {
  const fn = m.name.split(" ")[0];
  if (m.status === "cancelling") return {
    label: "Save now",
    msg: `"${fn}, before you go — can we have a 5-min chat? We'd genuinely love to understand what we could do better."`,
    channel: "Call"
  };
  const rd = daysUntil(m.returnDate);
  if (m.status === "suspended" && rd !== null && rd <= 7) return {
    label: `Book return — ${rd}d`,
    msg: `"${fn}, you're back soon — want us to lock in your first session back?"`,
    channel: "SMS"
  };
  if (m.status === "suspended") return {
    label: "Stay warm",
    msg: `"${fn}, hope everything's going well. Your spot is here when you're ready."`,
    channel: "SMS"
  };
  if (m.disengaging) return {
    label: "Urgent — reach out now",
    msg: `"Hey ${fn}, we haven't seen you in a couple of weeks — just checking in. Everything okay?"`,
    channel: "SMS"
  };
  if (m.risk === "red") return {
    label: "Contact this week",
    msg: `"Hey ${fn}, we've missed you — just a quick check-in. Want to lock in a session?"`,
    channel: "SMS"
  };
  if (m.checkInFlag) return {
    label: "Soft check-in",
    msg: `"${fn}, noticed your sessions have dropped a bit from your usual — everything good?"`,
    channel: "In Person"
  };
  if (m.risk === "amber" && m.trend === "drifting") return {
    label: "Re-engage",
    msg: `"${fn}, want to lock in a couple of sessions this week?"`,
    channel: "SMS"
  };
  if (m.trend === "building") return {
    label: "Celebrate",
    msg: `"${fn}, your consistency has been outstanding — you're one of our best right now."`,
    channel: "In Person"
  };
  if (m.financialFlag) return {
    label: "Membership chat",
    msg: `"${fn}, we've got a 2× per week plan that might suit you better and save you money — worth a chat?"`,
    channel: "In Person"
  };
  return {
    label: "Affirm",
    msg: `"${fn}, keep that routine going — it's working."`,
    channel: "In Person"
  };
}
const daysSince = d => {
  if (!d || d === "") return null;
  try {
    const p = d.split("/");
    return Math.floor((Date.now() - new Date(`${p[2]}-${p[1]}-${p[0]}`)) / 864e5);
  } catch {
    return null;
  }
};
const daysUntil = d => {
  if (!d || d === "" || d === "Unending") return null;
  try {
    const p = d.split("/");
    return Math.ceil((new Date(`${p[2]}-${p[1]}-${p[0]}`) - Date.now()) / 864e5);
  } catch {
    return null;
  }
};
const fmtDate = d => {
  if (!d || d === "" || d === "Unending") return "—";
  try {
    const p = d.split("/");
    return new Date(`${p[2]}-${p[1]}-${p[0]}`).toLocaleDateString("en-AU", {
      day: "numeric",
      month: "short"
    });
  } catch {
    return d;
  }
};
function daysLabel(d, type) {
  type = type || "return";
  var du = daysUntil(d);
  if (du === null) return {
    text: "Unending",
    color: T.muted,
    urgent: false
  };
  if (du < 0) return {
    text: "Ended " + Math.abs(du) + "d ago",
    color: T.muted,
    urgent: false
  };
  if (du === 0) return {
    text: type === "return" ? "Returns TODAY" : "Cancels TODAY",
    color: T.redText,
    urgent: true
  };
  if (du <= 3) return {
    text: du + "d",
    color: T.redText,
    urgent: true
  };
  if (du <= 7) return {
    text: du + "d",
    color: T.orangeText,
    urgent: true
  };
  if (du <= 14) return {
    text: du + "d",
    color: T.orangeText,
    urgent: false
  };
  return {
    text: du + "d",
    color: T.muted,
    urgent: false
  };
}

/* ── Colour helpers ─────────────────────────────────────────────────────── */
function riskColor(risk) {
  if (risk === "green") return {
    text: T.greenText,
    bg: T.greenBg,
    border: T.greenBorder
  };
  if (risk === "amber") return {
    text: T.orangeText,
    bg: T.orangeBg,
    border: T.orangeBorder
  };
  if (risk === "suspended") return {
    text: T.greyText,
    bg: T.greyBg,
    border: T.greyBorder
  };
  if (risk === "cancelling") return {
    text: T.pinkText,
    bg: T.pinkBg,
    border: T.pinkBorder
  };
  return {
    text: T.redText,
    bg: T.redBg,
    border: T.redBorder
  };
}
function trendColor(trend) {
  if (trend === "building") return T.greenText;
  if (trend === "stable") return T.greyText;
  if (trend === "drifting") return T.orangeText;
  return T.redText;
}
function pulseColor(p) {
  if (p === null) return T.muted;
  if (p >= 70) return T.greenText;
  if (p >= 45) return T.orangeText;
  return T.redText;
}

/* ── SVG components ─────────────────────────────────────────────────────── */
function Logo({
  size = 28
}) {
  return /*#__PURE__*/React.createElement("svg", {
    width: size,
    height: size,
    viewBox: "0 0 100 100",
    fill: "none"
  }, /*#__PURE__*/React.createElement("defs", null, /*#__PURE__*/React.createElement("linearGradient", {
    id: "lg",
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
    rx: "22",
    fill: "url(#lg)"
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
    strokeWidth: "3",
    strokeOpacity: "0.45",
    strokeLinecap: "round"
  }), /*#__PURE__*/React.createElement("polygon", {
    points: "90,34 79,32 87,43",
    fill: "white",
    fillOpacity: "0.7"
  }));
}
function Avatar({
  m,
  size = 34
}) {
  const COLORS = ["#6366f1", "#8b5cf6", "#10b981", "#f59e0b", "#ec4899", "#14b8a6", "#f97316", "#3b82f6"];
  const bg = COLORS[m.id % COLORS.length];
  return /*#__PURE__*/React.createElement("div", {
    style: {
      width: size,
      height: size,
      borderRadius: "50%",
      background: bg,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      fontWeight: 700,
      fontSize: size * 0.33,
      color: "white",
      flexShrink: 0,
      letterSpacing: "0.02em",
      border: `1.5px solid ${T.border}`
    }
  }, m.initials);
}
function Sparkline({
  data,
  suspFlags,
  color,
  w = 80,
  h = 26
}) {
  if (!data || data.length < 2) return null;
  const max = Math.max(...data, 1);
  const pts = data.map((v, i) => `${(i / (data.length - 1) * w).toFixed(1)},${(h - v / max * (h - 4) - 2).toFixed(1)}`).join(" ");
  return /*#__PURE__*/React.createElement("svg", {
    width: w,
    height: h,
    viewBox: `0 0 ${w} ${h}`,
    style: {
      display: "block"
    }
  }, suspFlags && suspFlags.map((s, i) => {
    if (!s) return null;
    const x = i / (data.length - 1) * w;
    const bw = w / (data.length - 1);
    return /*#__PURE__*/React.createElement("rect", {
      key: i,
      x: Math.max(0, x - bw / 2),
      y: 0,
      width: bw,
      height: h,
      fill: T.greyText,
      opacity: "0.12",
      rx: "1"
    });
  }), /*#__PURE__*/React.createElement("polyline", {
    points: pts,
    fill: "none",
    stroke: color,
    strokeWidth: "2",
    strokeLinecap: "round",
    strokeLinejoin: "round"
  }));
}
function Ring({
  pct,
  color,
  size = 32
}) {
  const r = 12,
    c = size / 2,
    circ = 2 * Math.PI * r,
    dash = circ * (pct / 100);
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      gap: 5
    }
  }, /*#__PURE__*/React.createElement("svg", {
    width: size,
    height: size,
    viewBox: `0 0 ${size} ${size}`
  }, /*#__PURE__*/React.createElement("circle", {
    cx: c,
    cy: c,
    r: r,
    fill: "none",
    stroke: T.border,
    strokeWidth: "3.5"
  }), /*#__PURE__*/React.createElement("circle", {
    cx: c,
    cy: c,
    r: r,
    fill: "none",
    stroke: color,
    strokeWidth: "3.5",
    strokeDasharray: `${dash} ${circ}`,
    transform: `rotate(-90 ${c} ${c})`,
    strokeLinecap: "round"
  })), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 12,
      fontWeight: 600,
      color,
      fontFamily: "'DM Mono',monospace"
    }
  }, pct, "%"));
}
function WeekDot({
  sessions,
  isSusp
}) {
  let bg,
    border = "none";
  if (isSusp) {
    bg = `repeating-linear-gradient(45deg,${T.greyText}55,${T.greyText}55 2px,${T.greyBg} 2px,${T.greyBg} 5px)`;
    border = `1px solid ${T.greyBorder}`;
  } else if (sessions === 0) {
    bg = T.surface2;
  } else if (sessions >= 3) {
    bg = T.greenText;
  } else if (sessions >= 1) {
    bg = T.orangeText;
  } else {
    bg = T.redText;
  }
  return /*#__PURE__*/React.createElement("div", {
    style: {
      width: 13,
      height: 13,
      borderRadius: 3,
      background: bg,
      border,
      flexShrink: 0
    },
    title: isSusp ? "Suspended" : sessions + " sessions"
  });
}
function WeekDots({
  hist,
  suspFlags,
  thisWeek,
  showThisWeek = false
}) {
  // hist is 6 weeks display, we show last 4 complete + optionally current week
  const displayHist = hist.slice(-5, -1); // last 4 complete weeks
  const suspDisplay = suspFlags ? suspFlags.slice(-5, -1) : [false, false, false, false];
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      gap: 3,
      alignItems: "center"
    }
  }, displayHist.map((s, i) => /*#__PURE__*/React.createElement(WeekDot, {
    key: i,
    sessions: s,
    isSusp: suspDisplay[i]
  })), showThisWeek && thisWeek !== undefined && /*#__PURE__*/React.createElement("div", {
    style: {
      marginLeft: 3,
      display: "flex",
      alignItems: "center",
      gap: 2
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: 1,
      height: 10,
      background: "rgba(255,255,255,0.15)",
      borderRadius: 1
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      width: 13,
      height: 13,
      borderRadius: 3,
      background: thisWeek > 0 ? "rgba(163,163,163,0.4)" : "rgba(255,255,255,0.08)",
      border: "1px dashed rgba(255,255,255,0.25)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center"
    },
    title: `This week so far: ${thisWeek} session${thisWeek !== 1 ? "s" : ""} (incomplete)`
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 7,
      color: "rgba(255,255,255,0.4)",
      fontWeight: 700,
      fontFamily: "monospace"
    }
  }, thisWeek > 0 ? thisWeek : "·"))));
}

/* ── Stat cards ─────────────────────────────────────────────────────────── */
function StatCards({
  members,
  viewType
}) {
  const act = members.filter(m => m.status === "active");
  const red = act.filter(m => m.risk === "red").length;
  const amber = act.filter(m => m.risk === "amber").length;
  const green = act.filter(m => m.risk === "green").length;
  const diseng = act.filter(m => m.disengaging).length;
  const susp = members.filter(m => m.status === "suspended");
  const canc = members.filter(m => m.status === "cancelling");
  const retSoon = susp.filter(m => {
    const d = daysUntil(m.returnDate);
    return d !== null && d <= 7;
  }).length;
  const pulses = act.map(getPulse).filter(Boolean);
  const avgPulse = pulses.length ? Math.round(pulses.reduce((a, b) => a + b, 0) / pulses.length) : 0;
  const sets = {
    members: [{
      color: "red",
      icon: "🔴",
      label: "At Risk",
      val: red,
      sub: "Below 50% of target"
    }, {
      color: "orange",
      icon: "🟡",
      label: "Watching",
      val: amber,
      sub: "50–99% of target"
    }, {
      color: "green",
      icon: "🟢",
      label: "On Track",
      val: green,
      sub: "Meeting target"
    }, {
      color: "warn",
      icon: "⚠️",
      label: "Disengaging",
      val: diseng,
      sub: "Zero 2+ wks — act now"
    }, {
      color: "pulse",
      icon: "💓",
      label: "Gym Pulse",
      val: avgPulse,
      sub: "Avg score /100",
      suffix: "/100"
    }],
    suspended: [{
      color: "grey",
      icon: "⏸️",
      label: "Suspended",
      val: susp.length,
      sub: "Currently on hold"
    }, {
      color: "orange",
      icon: "🔔",
      label: "Returning Soon",
      val: retSoon,
      sub: "Within 7 days"
    }, {
      color: "green",
      icon: "💪",
      label: "Strong History",
      val: susp.filter(m => m.avg6 >= 2).length,
      sub: "Avg 2+/wk pre-susp"
    }, {
      color: "red",
      icon: "📅",
      label: "No Return Date",
      val: susp.filter(m => m.returnDate === "Unending").length,
      sub: "Unending suspension"
    }, {
      color: "pulse",
      icon: "💓",
      label: "Gym Pulse",
      val: avgPulse,
      sub: "Overall avg /100",
      suffix: "/100"
    }],
    departures: [{
      color: "pink",
      icon: "🚪",
      label: "In Notice",
      val: canc.length,
      sub: "Save window open"
    }, {
      color: "red",
      icon: "💰",
      label: "MRR at Risk",
      val: "$" + canc.reduce((s, m) => s + parseInt((m.price || "$0").replace(/[^0-9]/g, "") || 0), 0),
      sub: "Weekly revenue"
    }, {
      color: "orange",
      icon: "⚠️",
      label: "Were At Risk",
      val: canc.filter(m => m.avg4 < 1).length,
      sub: "Already <1/wk"
    }, {
      color: "green",
      icon: "🙏",
      label: "Still Active",
      val: canc.filter(m => m.avg4 > 0).length,
      sub: "Can still be saved"
    }, {
      color: "pulse",
      icon: "💓",
      label: "Gym Pulse",
      val: avgPulse,
      sub: "Overall avg /100",
      suffix: "/100"
    }]
  };
  const colorMap = {
    red: {
      text: T.redText,
      bg: T.redBg,
      border: T.redBorder
    },
    orange: {
      text: T.orangeText,
      bg: T.orangeBg,
      border: T.orangeBorder
    },
    green: {
      text: T.greenText,
      bg: T.greenBg,
      border: T.greenBorder
    },
    grey: {
      text: T.greyText,
      bg: T.greyBg,
      border: T.greyBorder
    },
    pink: {
      text: T.pinkText,
      bg: T.pinkBg,
      border: T.pinkBorder
    },
    warn: {
      text: T.warnText,
      bg: T.warnBg,
      border: T.warnBorder
    },
    pulse: {
      text: "#a5b4fc",
      bg: "#1a1a40",
      border: "#3a3a80"
    }
  };
  const cards = sets[viewType] || sets.members;
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: "grid",
      gridTemplateColumns: "repeat(5,1fr)",
      gap: 10,
      marginBottom: 18
    }
  }, cards.map((c, i) => {
    const col = colorMap[c.color] || colorMap.red;
    return /*#__PURE__*/React.createElement("div", {
      key: i,
      style: {
        background: col.bg,
        border: `1px solid ${col.border}`,
        borderRadius: 12,
        padding: "14px 16px"
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        display: "flex",
        alignItems: "center",
        gap: 7,
        marginBottom: 8
      }
    }, /*#__PURE__*/React.createElement("span", {
      style: {
        fontSize: 15
      }
    }, c.icon), /*#__PURE__*/React.createElement("span", {
      style: {
        fontSize: 11,
        fontWeight: 600,
        color: T.muted
      }
    }, c.label)), /*#__PURE__*/React.createElement("div", {
      style: {
        fontWeight: 700,
        fontSize: 26,
        color: col.text,
        lineHeight: 1,
        fontFamily: "'DM Mono',monospace"
      }
    }, c.val, c.suffix && /*#__PURE__*/React.createElement("span", {
      style: {
        fontSize: 11,
        fontWeight: 400,
        color: T.muted
      }
    }, c.suffix)), /*#__PURE__*/React.createElement("div", {
      style: {
        fontSize: 10,
        color: T.muted,
        marginTop: 4
      }
    }, c.sub));
  }));
}

/* ── Table row ──────────────────────────────────────────────────────────── */
function Row({
  m,
  onClick,
  viewType
}) {
  const rc = riskColor(m.risk);
  const tc = trendColor(m.trend);
  const pulse = getPulse(m);
  const delta = getPulseDelta(m);
  const action = getAction(m);
  const flags = getFlags(m);
  const rd = daysUntil(m.returnDate);
  const retSoon = m.status === "suspended" && rd !== null && rd <= 7;
  const ds = daysSince(m.lastSession);
  const hasSusp = m.suspendedWeeks && m.suspendedWeeks.some(Boolean);

  // Left status bar colour
  let barColor = rc.text;
  if (m.disengaging) barColor = T.warnText;
  const riskLabel = m.risk === "green" ? "ON TRACK" : m.risk === "amber" ? "WATCHING" : m.risk === "red" ? "AT RISK" : m.risk === "suspended" ? "SUSPENDED" : "CANCELLING";
  return /*#__PURE__*/React.createElement("tr", {
    onClick: () => onClick(m),
    style: {
      background: T.surface,
      cursor: "pointer",
      transition: "background 0.12s,transform 0.12s"
    },
    onMouseEnter: e => {
      e.currentTarget.style.background = T.surface2;
      e.currentTarget.style.transform = "translateX(2px)";
    },
    onMouseLeave: e => {
      e.currentTarget.style.background = T.surface;
      e.currentTarget.style.transform = "none";
    }
  }, /*#__PURE__*/React.createElement("td", {
    style: {
      padding: "10px 14px",
      minWidth: 190,
      borderTop: `1px solid ${T.border}`,
      borderBottom: `1px solid ${T.border}`,
      borderLeft: `1px solid ${T.border}`,
      borderRadius: "8px 0 0 8px"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      gap: 8
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: 3,
      height: 26,
      borderRadius: 2,
      background: barColor,
      flexShrink: 0
    }
  }), /*#__PURE__*/React.createElement(Avatar, {
    m: m,
    size: 32
  }), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: {
      fontWeight: 600,
      fontSize: 13,
      color: T.text
    }
  }, m.name), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 10,
      color: T.muted,
      marginTop: 1,
      fontFamily: "'DM Mono',monospace"
    }
  }, m.packageShort || "—", " \xB7 ", m.months, "mo")), m.disengaging && /*#__PURE__*/React.createElement("span", {
    style: {
      marginLeft: 4,
      fontSize: 9,
      fontWeight: 700,
      background: T.warnBg,
      color: T.warnText,
      border: `1px solid ${T.warnBorder}`,
      padding: "1px 6px",
      borderRadius: 99
    }
  }, "\u26A0 DISENGAGING"))), /*#__PURE__*/React.createElement("td", {
    style: {
      padding: "10px 8px",
      minWidth: 110,
      borderTop: `1px solid ${T.border}`,
      borderBottom: `1px solid ${T.border}`
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 9,
      fontWeight: 700,
      padding: "2px 8px",
      borderRadius: 99,
      background: rc.bg,
      color: rc.text,
      border: `1px solid ${rc.border}`,
      letterSpacing: "0.06em",
      display: "inline-block"
    }
  }, riskLabel), m.status === "suspended" && /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 9,
      color: retSoon ? T.orangeText : T.muted,
      marginTop: 3,
      fontWeight: retSoon ? 700 : 400
    }
  }, retSoon ? `⚡ ${rd}d` : `Returns ${fmtDate(m.returnDate)}`), m.status === "cancelling" && m.cancelDate && /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 9,
      color: T.pinkText,
      marginTop: 3
    }
  }, "Cancels ", fmtDate(m.cancelDate)), m.status === "active" && hasSusp && /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 9,
      color: T.greyText,
      marginTop: 3
    }
  }, "\u23F8 Susp. this period")), /*#__PURE__*/React.createElement("td", {
    style: {
      padding: "10px 8px",
      minWidth: 80,
      borderTop: `1px solid ${T.border}`,
      borderBottom: `1px solid ${T.border}`
    }
  }, pulse !== null ? /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("span", {
    style: {
      fontWeight: 700,
      fontSize: 18,
      color: pulseColor(pulse),
      fontFamily: "'DM Mono',monospace"
    }
  }, pulse), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 10,
      color: T.muted
    }
  }, "/100"), delta !== null && /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 9,
      fontWeight: 600,
      color: delta >= 0 ? T.greenText : T.redText,
      marginTop: 1
    }
  }, delta >= 0 ? "↑" : "↓", Math.abs(delta))) : /*#__PURE__*/React.createElement("span", {
    style: {
      color: T.muted,
      fontFamily: "'DM Mono',monospace"
    }
  }, "\u2014")), /*#__PURE__*/React.createElement("td", {
    style: {
      padding: "10px 8px",
      minWidth: 105,
      borderTop: `1px solid ${T.border}`,
      borderBottom: `1px solid ${T.border}`
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontWeight: 700,
      fontSize: 17,
      color: T.text,
      fontFamily: "'DM Mono',monospace",
      lineHeight: 1
    }
  }, m.total4weeks), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 10,
      color: T.muted
    }
  }, "sessions \xB7 4 complete wks"), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 11,
      fontWeight: 600,
      color: rc.text,
      marginTop: 1,
      fontFamily: "'DM Mono',monospace"
    }
  }, m.avg4.toFixed(1), "/wk \xB7 target ", m.target)), /*#__PURE__*/React.createElement("td", {
    style: {
      padding: "10px 8px",
      minWidth: 90,
      borderTop: `1px solid ${T.border}`,
      borderBottom: `1px solid ${T.border}`
    }
  }, /*#__PURE__*/React.createElement(WeekDots, {
    hist: m.weeklyHistory,
    suspFlags: m.suspendedWeeks,
    thisWeek: m.thisWeek,
    showThisWeek: true
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 9,
      color: T.muted,
      marginTop: 3
    }
  }, "Last 4 wks")), /*#__PURE__*/React.createElement("td", {
    style: {
      padding: "10px 8px",
      minWidth: 110,
      borderTop: `1px solid ${T.border}`,
      borderBottom: `1px solid ${T.border}`
    }
  }, /*#__PURE__*/React.createElement(Sparkline, {
    data: m.weeklyHistory,
    suspFlags: m.suspendedWeeks,
    color: tc
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 10,
      fontWeight: 600,
      color: tc,
      marginTop: 2,
      textTransform: "capitalize"
    }
  }, m.trend === "building" ? "↑" : m.trend === "stable" ? "→" : m.trend === "drifting" ? "↓" : "↓↓", " ", m.trend)), /*#__PURE__*/React.createElement("td", {
    style: {
      padding: "10px 8px",
      minWidth: 88,
      borderTop: `1px solid ${T.border}`,
      borderBottom: `1px solid ${T.border}`
    }
  }, m.status === "suspended" ? (() => {
    const dl = daysLabel(m.returnDate, "return");
    return /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
      style: {
        fontWeight: 700,
        fontSize: dl.text.length > 6 ? 14 : 18,
        color: dl.color,
        fontFamily: "'DM Mono',monospace",
        lineHeight: 1
      }
    }, dl.text), /*#__PURE__*/React.createElement("div", {
      style: {
        fontSize: 9,
        color: T.muted,
        marginTop: 2
      }
    }, m.daysUntilReturn !== null && m.daysUntilReturn < 0 ? "suspension ended" : "until return"), dl.urgent && /*#__PURE__*/React.createElement("div", {
      style: {
        fontSize: 9,
        fontWeight: 700,
        color: dl.color,
        marginTop: 2
      }
    }, "\u26A1 contact now"));
  })() : m.status === "cancelling" ? (() => {
    const dl = daysLabel(m.cancelDate, "cancel");
    return /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
      style: {
        fontWeight: 700,
        fontSize: dl.text.length > 6 ? 14 : 18,
        color: dl.color,
        fontFamily: "'DM Mono',monospace",
        lineHeight: 1
      }
    }, dl.text), /*#__PURE__*/React.createElement("div", {
      style: {
        fontSize: 9,
        color: T.muted,
        marginTop: 2
      }
    }, m.daysUntilCancel !== null && m.daysUntilCancel < 0 ? "already cancelled" : "until cancel"), dl.urgent && /*#__PURE__*/React.createElement("div", {
      style: {
        fontSize: 9,
        fontWeight: 700,
        color: dl.color,
        marginTop: 2
      }
    }, "\uD83D\uDEA8 save now"));
  })() : /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement(Ring, {
    pct: m.consistency,
    color: m.risk === "green" ? T.greenText : m.risk === "amber" ? T.orangeText : T.redText
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 9,
      color: T.muted,
      marginTop: 2
    }
  }, "active wks"))), /*#__PURE__*/React.createElement("td", {
    style: {
      padding: "10px 8px",
      minWidth: 95,
      borderTop: `1px solid ${T.border}`,
      borderBottom: `1px solid ${T.border}`
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 12,
      fontWeight: 600,
      color: ds !== null && ds > 14 && !m.suspendedWeeks?.slice(-1)[0] ? T.redText : T.text,
      fontFamily: "'DM Mono',monospace"
    }
  }, fmtDate(m.lastSession)), ds !== null && /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 10,
      color: T.muted
    }
  }, ds, "d ago")), /*#__PURE__*/React.createElement("td", {
    style: {
      padding: "10px 8px",
      minWidth: 175,
      borderTop: `1px solid ${T.border}`,
      borderBottom: `1px solid ${T.border}`
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 11,
      fontWeight: 700,
      color: m.disengaging ? T.warnText : m.risk === "red" || m.status === "cancelling" ? T.redText : m.risk === "amber" ? T.orangeText : T.greenText,
      marginBottom: 2
    }
  }, action.label), flags.length > 0 ? /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 9,
      color: flags[0].type === "critical" ? T.redText : flags[0].type === "warn" ? T.orangeText : T.greyText,
      lineHeight: 1.4
    }
  }, flags[0].text), flags.length > 1 && /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 9,
      color: T.muted
    }
  }, "+", flags.length - 1, " more")) : /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 9,
      color: T.muted
    }
  }, m.fav || "—")), /*#__PURE__*/React.createElement("td", {
    style: {
      padding: "10px 14px",
      borderTop: `1px solid ${T.border}`,
      borderBottom: `1px solid ${T.border}`,
      borderRight: `1px solid ${T.border}`,
      borderRadius: "0 8px 8px 0"
    }
  }, /*#__PURE__*/React.createElement("button", {
    onClick: e => {
      e.stopPropagation();
      onClick(m);
    },
    style: {
      fontSize: 11,
      fontWeight: 600,
      padding: "5px 12px",
      borderRadius: 7,
      border: `1px solid ${T.accent}`,
      color: T.accent,
      background: "transparent",
      cursor: "pointer",
      whiteSpace: "nowrap",
      fontFamily: "'DM Sans',sans-serif"
    }
  }, "View")));
}

/* ── Drawer ─────────────────────────────────────────────────────────────── */
function Drawer({
  m,
  onClose
}) {
  const rc = riskColor(m.risk);
  const tc = trendColor(m.trend);
  const pulse = getPulse(m);
  const delta = getPulseDelta(m);
  const action = getAction(m);
  const flags = getFlags(m);
  const [note, setNote] = useState(m.notes || "");
  const [saved, setSaved] = useState(false);
  const rd = daysUntil(m.returnDate);
  const retSoon = m.status === "suspended" && rd !== null && rd <= 7;
  const ds = daysSince(m.lastSession);
  const hasSusp = m.suspendedWeeks && m.suspendedWeeks.some(Boolean);
  const CH_ICONS = {
    "In Person": "🤝",
    "SMS": "💬",
    "Phone Call": "📞",
    "Instagram DM": "📸",
    "Email": "✉️"
  };
  return /*#__PURE__*/React.createElement("div", {
    style: {
      position: "fixed",
      inset: 0,
      background: "rgba(0,0,0,0.6)",
      zIndex: 300,
      backdropFilter: "blur(4px)"
    },
    onClick: onClose
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      position: "fixed",
      right: 0,
      top: 0,
      bottom: 0,
      width: "min(400px,100vw)",
      background: T.surface,
      borderLeft: `1px solid ${T.border}`,
      overflowY: "auto",
      display: "flex",
      flexDirection: "column"
    },
    onClick: e => e.stopPropagation()
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      padding: "18px 20px 14px",
      borderBottom: `1px solid ${T.border}`,
      display: "flex",
      alignItems: "flex-start",
      justifyContent: "space-between",
      gap: 10,
      flexShrink: 0
    }
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: {
      fontWeight: 700,
      fontSize: 17,
      color: T.text
    }
  }, m.name), /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 6,
      display: "flex",
      gap: 6,
      flexWrap: "wrap",
      alignItems: "center"
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 9,
      fontWeight: 700,
      padding: "2px 8px",
      borderRadius: 99,
      background: rc.bg,
      color: rc.text,
      border: `1px solid ${rc.border}`,
      letterSpacing: "0.06em"
    }
  }, m.risk === "green" ? "ON TRACK" : m.risk === "amber" ? "WATCHING" : m.risk === "red" ? "AT RISK" : m.risk === "suspended" ? "SUSPENDED" : "CANCELLING"), m.disengaging && /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 9,
      fontWeight: 700,
      padding: "2px 8px",
      borderRadius: 99,
      background: T.warnBg,
      color: T.warnText,
      border: `1px solid ${T.warnBorder}`
    }
  }, "\u26A0 DISENGAGING"), pulse !== null && /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 9,
      fontFamily: "'DM Mono',monospace",
      color: pulseColor(pulse),
      fontWeight: 700
    }
  }, pulse, "/100", delta !== null && /*#__PURE__*/React.createElement("span", {
    style: {
      color: delta >= 0 ? T.greenText : T.redText
    }
  }, " ", delta >= 0 ? "↑" : "↓", Math.abs(delta))))), /*#__PURE__*/React.createElement("button", {
    onClick: onClose,
    style: {
      background: T.surface2,
      border: `1px solid ${T.border}`,
      color: T.muted,
      width: 30,
      height: 30,
      borderRadius: 7,
      cursor: "pointer",
      fontSize: 16,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      flexShrink: 0
    }
  }, "\u2715")), /*#__PURE__*/React.createElement("div", {
    style: {
      padding: "16px 20px",
      display: "flex",
      flexDirection: "column",
      gap: 12,
      flex: 1
    }
  }, retSoon && /*#__PURE__*/React.createElement("div", {
    style: {
      background: T.orangeBg,
      border: `1px solid ${T.orangeBorder}`,
      borderRadius: 10,
      padding: "10px 14px",
      display: "flex",
      gap: 10,
      alignItems: "center"
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 18
    }
  }, "\uD83D\uDD14"), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: {
      fontWeight: 700,
      color: T.orangeText,
      fontSize: 13
    }
  }, "Returns in ", rd, " day", rd === 1 ? "" : "s"), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 11,
      color: T.muted
    }
  }, "Book their first session back now."))), m.status === "cancelling" && /*#__PURE__*/React.createElement("div", {
    style: {
      background: T.pinkBg,
      border: `1px solid ${T.pinkBorder}`,
      borderRadius: 10,
      padding: "10px 14px"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontWeight: 700,
      color: T.pinkText,
      fontSize: 13
    }
  }, "Cancels ", fmtDate(m.cancelDate)), m.cancelReason && /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 11,
      color: T.muted,
      marginTop: 2
    }
  }, "Reason: ", m.cancelReason)), hasSusp && m.status === "active" && /*#__PURE__*/React.createElement("div", {
    style: {
      background: T.greyBg,
      border: `1px solid ${T.greyBorder}`,
      borderRadius: 10,
      padding: "10px 14px",
      display: "flex",
      gap: 8,
      alignItems: "center"
    }
  }, /*#__PURE__*/React.createElement("span", null, "\u23F8\uFE0F"), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 12,
      color: T.greyText
    }
  }, "Had suspension during this period \u2014 striped dots = suspended weeks, excluded from averages.")), flags.length > 0 && /*#__PURE__*/React.createElement("div", {
    style: {
      background: T.redBg,
      border: `1px solid ${T.redBorder}`,
      borderRadius: 10,
      padding: "10px 14px"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 9,
      fontWeight: 700,
      color: T.muted,
      letterSpacing: "0.1em",
      marginBottom: 6
    }
  }, "RETENTION FLAGS"), flags.map((f, i) => /*#__PURE__*/React.createElement("div", {
    key: i,
    style: {
      fontSize: 12,
      fontWeight: 600,
      color: f.type === "critical" ? T.redText : f.type === "warn" ? T.orangeText : T.greyText,
      marginBottom: 3
    }
  }, f.type === "critical" ? "🔴" : f.type === "warn" ? "🟡" : "ℹ️", " ", f.text))), /*#__PURE__*/React.createElement("div", {
    style: {
      background: T.surface2,
      border: `1px solid ${T.border}`,
      borderRadius: 10,
      padding: "12px 14px"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 9,
      fontWeight: 700,
      color: T.muted,
      letterSpacing: "0.1em",
      marginBottom: 6
    }
  }, "RECOMMENDED ACTION"), /*#__PURE__*/React.createElement("div", {
    style: {
      fontWeight: 700,
      fontSize: 13,
      color: m.disengaging ? T.warnText : m.risk === "red" || m.status === "cancelling" ? T.redText : m.risk === "amber" ? T.orangeText : T.greenText,
      marginBottom: 8
    }
  }, action.label, " \xB7 ", action.channel), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 12,
      color: T.text,
      fontStyle: "italic",
      lineHeight: 1.5,
      marginBottom: 10
    }
  }, action.msg), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      gap: 5,
      flexWrap: "wrap"
    }
  }, Object.entries(CH_ICONS).map(([ch, icon]) => /*#__PURE__*/React.createElement("button", {
    key: ch,
    style: {
      fontSize: 11,
      padding: "4px 10px",
      borderRadius: 7,
      border: `1px solid ${T.border}`,
      background: T.surface,
      cursor: "pointer",
      color: T.muted,
      fontFamily: "'DM Sans',sans-serif"
    }
  }, icon, " ", ch)))), /*#__PURE__*/React.createElement("div", {
    style: {
      background: T.surface2,
      border: `1px solid ${T.border}`,
      borderRadius: 10,
      padding: "12px 14px"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 9,
      fontWeight: 700,
      color: T.muted,
      letterSpacing: "0.1em",
      marginBottom: 10
    }
  }, "ATTENDANCE \u2014 5 COMPLETE WEEKS + THIS WEEK \xB7 ", m.total4weeks, " check-ins (4 complete wks) \xB7 ", m.avg4.toFixed(1), "/wk avg \xB7 target ", m.target, "/wk"), m.weeklyHistory.map((s, i) => {
    const isSusp = m.suspendedWeeks && m.suspendedWeeks[i];
    return /*#__PURE__*/React.createElement("div", {
      key: i,
      style: {
        display: "flex",
        alignItems: "center",
        gap: 10,
        marginBottom: 7
      }
    }, /*#__PURE__*/React.createElement("span", {
      style: {
        fontSize: 10,
        color: T.muted,
        width: 56,
        flexShrink: 0,
        fontFamily: "'DM Mono',monospace"
      }
    }, WEEK_LABELS[i]), /*#__PURE__*/React.createElement("div", {
      style: {
        display: "flex",
        gap: 3
      }
    }, Array.from({
      length: 5
    }).map((_, j) => {
      if (isSusp) return /*#__PURE__*/React.createElement("div", {
        key: j,
        style: {
          width: 14,
          height: 14,
          borderRadius: 3,
          background: `repeating-linear-gradient(45deg,${T.greyText}55,${T.greyText}55 2px,${T.greyBg} 2px,${T.greyBg} 5px)`,
          border: `1px solid ${T.greyBorder}`
        }
      });
      const col = s >= 3 ? T.greenText : s >= 1 ? T.orangeText : T.redText;
      return /*#__PURE__*/React.createElement("div", {
        key: j,
        style: {
          width: 14,
          height: 14,
          borderRadius: 3,
          background: j < s && s > 0 ? col : T.surface
        }
      });
    })), isSusp ? /*#__PURE__*/React.createElement("span", {
      style: {
        fontSize: 10,
        fontWeight: 600,
        color: T.greyText
      }
    }, "\u23F8 suspended") : /*#__PURE__*/React.createElement("span", {
      style: {
        fontSize: 11,
        fontWeight: 700,
        color: T.text,
        fontFamily: "'DM Mono',monospace"
      }
    }, s));
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      borderTop: `1px solid ${T.border}`,
      paddingTop: 10,
      marginTop: 4,
      display: "flex",
      justifyContent: "space-between",
      flexWrap: "wrap",
      gap: 8
    }
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 9,
      color: T.muted
    }
  }, "4-wk total"), /*#__PURE__*/React.createElement("div", {
    style: {
      fontWeight: 700,
      fontSize: 20,
      color: T.text,
      fontFamily: "'DM Mono',monospace"
    }
  }, m.total4weeks)), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 9,
      color: T.muted
    }
  }, "Avg/wk"), /*#__PURE__*/React.createElement("div", {
    style: {
      fontWeight: 700,
      fontSize: 20,
      color: T.text,
      fontFamily: "'DM Mono',monospace"
    }
  }, m.avg4.toFixed(1))), /*#__PURE__*/React.createElement("div", {
    style: {
      textAlign: "center"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 9,
      color: T.muted,
      marginBottom: 4
    }
  }, "Trend"), /*#__PURE__*/React.createElement(Sparkline, {
    data: m.weeklyHistory,
    suspFlags: m.suspendedWeeks,
    color: tc,
    w: 70,
    h: 24
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 10,
      fontWeight: 600,
      color: tc,
      marginTop: 2,
      textTransform: "capitalize"
    }
  }, m.trend)), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 9,
      color: T.muted,
      marginBottom: 4
    }
  }, "Consistency"), /*#__PURE__*/React.createElement(Ring, {
    pct: m.consistency,
    color: m.risk === "green" ? T.greenText : m.risk === "amber" ? T.orangeText : m.risk === "suspended" ? T.greyText : T.redText,
    size: 34
  })))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "grid",
      gridTemplateColumns: "1fr 1fr",
      gap: 8
    }
  }, [{
    l: "Last Session",
    v: fmtDate(m.lastSession) + (ds !== null ? ` · ${ds}d ago` : ""),
    w: ds !== null && ds > 14 && !m.suspendedWeeks?.slice(-1)[0]
  }, {
    l: "Favourite",
    v: m.fav || "—",
    w: false
  }, {
    l: "Membership",
    v: m.packageShort || "—",
    w: false
  }, {
    l: "Member Since",
    v: fmtDate(m.memberSince) + " · " + m.months + "mo",
    w: false
  }].map(s => /*#__PURE__*/React.createElement("div", {
    key: s.l,
    style: {
      background: s.w ? T.redBg : T.surface2,
      border: `1px solid ${s.w ? T.redBorder : T.border}`,
      borderRadius: 8,
      padding: "9px 11px"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 9,
      color: T.muted,
      fontWeight: 600,
      letterSpacing: "0.06em"
    }
  }, s.l.toUpperCase()), /*#__PURE__*/React.createElement("div", {
    style: {
      fontWeight: 600,
      fontSize: 12,
      color: s.w ? T.redText : T.text,
      marginTop: 3
    }
  }, s.v)))), /*#__PURE__*/React.createElement("div", {
    style: {
      background: T.surface2,
      border: `1px solid ${T.border}`,
      borderRadius: 10,
      padding: "12px 14px"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: 8
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 9,
      fontWeight: 700,
      color: T.muted,
      letterSpacing: "0.1em"
    }
  }, "TRAINER NOTES"), saved && /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 11,
      color: T.greenText,
      fontWeight: 600
    }
  }, "\u2713 Saved")), /*#__PURE__*/React.createElement("textarea", {
    value: note,
    onChange: e => setNote(e.target.value),
    style: {
      width: "100%",
      background: T.surface,
      border: `1px solid ${T.border}`,
      borderRadius: 8,
      color: T.text,
      fontFamily: "'DM Sans',sans-serif",
      fontSize: 13,
      padding: "10px 12px",
      resize: "vertical",
      minHeight: 80,
      outline: "none",
      lineHeight: 1.6
    },
    placeholder: "Add notes about this member\u2026"
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      gap: 8,
      marginTop: 8,
      alignItems: "center"
    }
  }, /*#__PURE__*/React.createElement("button", {
    onClick: () => {
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    },
    style: {
      background: T.accent,
      color: "#fff",
      border: "none",
      padding: "7px 16px",
      borderRadius: 7,
      fontFamily: "'DM Sans',sans-serif",
      fontSize: 12,
      fontWeight: 600,
      cursor: "pointer"
    }
  }, "Save Note"), /*#__PURE__*/React.createElement("button", {
    onClick: () => setNote(""),
    style: {
      background: "transparent",
      border: `1px solid ${T.border}`,
      color: T.muted,
      padding: "7px 12px",
      borderRadius: 7,
      fontFamily: "'DM Sans',sans-serif",
      fontSize: 12,
      cursor: "pointer"
    }
  }, "Clear"))), /*#__PURE__*/React.createElement("div", {
    style: {
      paddingBottom: 16
    }
  }))));
}

/* ── Today's Actions ─────────────────────────────────────────────────────── */

// TODAY_DATA — injected at build time from Hapana API
// For now: real class schedule from screenshot, real members from our data
const TODAY_DATA = {
  date: "Tuesday 9 June 2026",
  coaches: ["Sam", "Sally", "Meg", "Scotty"],
  classes: [{
    id: "c1",
    time: "05:00 AM",
    end: "05:50 AM",
    type: "LIFT",
    instructor: "Meg",
    capacity: 36,
    booked: 17,
    checkedIn: 16,
    members: [{
      name: "Mikaela Young",
      risk: "red",
      trend: "building",
      flag: "building",
      thisWeek: 2,
      avg4: 1.0,
      hist: [0, 0, 0, 2, 2, 2],
      months: 4,
      fav: "LIFT"
    }, {
      name: "Hayley Wynd",
      risk: "green",
      trend: "drifting",
      flag: "checkin",
      thisWeek: 1,
      avg4: 3.75,
      hist: [2, 5, 4, 4, 2, 1],
      months: 18,
      fav: "LIFT"
    }, {
      name: "Melissa Clark",
      risk: "red",
      trend: "building",
      flag: "building",
      thisWeek: 2,
      avg4: 0.75,
      hist: [0, 0, 0, 0, 3, 2],
      months: 8,
      fav: "LIFT"
    }, {
      name: "Jodie Mcauliffe",
      risk: "green",
      trend: "stable",
      flag: "ontrack",
      thisWeek: 1,
      avg4: 3.75,
      hist: [2, 4, 4, 3, 4, 1],
      months: 22,
      fav: "PERFORM"
    }, {
      name: "Liz Hawkins",
      risk: "amber",
      trend: "building",
      flag: "building",
      thisWeek: 2,
      avg4: 2.75,
      hist: [1, 0, 4, 4, 3, 2],
      months: 14,
      fav: "PERFORM"
    }, {
      name: "Marcus Muir",
      risk: "red",
      trend: "stable",
      flag: "returning",
      thisWeek: 2,
      avg4: 0.0,
      hist: [0, 0, 0, 0, 0, 2],
      months: 6,
      fav: "LIFT",
      returnedDaysAgo: 3
    }, {
      name: "Cody Fabri",
      risk: "green",
      trend: "stable",
      flag: "returner",
      thisWeek: 1,
      avg4: 3.0,
      hist: [0, 3, 2, 0, 0, 1],
      months: 27,
      fav: "LIFT",
      returnedDaysAgo: 3
    }, {
      name: "Emily Harper",
      risk: "amber",
      trend: "building",
      flag: "building",
      thisWeek: 1,
      avg4: 2.25,
      hist: [1, 3, 0, 2, 4, 1],
      months: 11,
      fav: "LIFT"
    }, {
      name: "Jacob Bell",
      risk: "green",
      trend: "stable",
      flag: "ontrack",
      thisWeek: 2,
      avg4: 3.25,
      hist: [1, 3, 3, 4, 3, 2],
      months: 19,
      fav: "LIFT"
    }, {
      name: "Jaiden Treasure",
      risk: "red",
      trend: "building",
      flag: "building",
      thisWeek: 1,
      avg4: 1.0,
      hist: [1, 0, 0, 2, 2, 1],
      months: 7,
      fav: "LIFT"
    }, {
      name: "Abbey Hewitt",
      risk: "amber",
      trend: "critical",
      flag: "critical",
      thisWeek: 1,
      avg4: 2.5,
      hist: [2, 4, 3, 3, 0, 1],
      months: 16,
      fav: "LIFT"
    }, {
      name: "Sophia Hewitt",
      risk: "amber",
      trend: "critical",
      flag: "critical",
      thisWeek: 1,
      avg4: 2.5,
      hist: [2, 4, 3, 3, 0, 1],
      months: 16,
      fav: "LIFT"
    }, {
      name: "Mikayla Price",
      risk: "amber",
      trend: "stable",
      flag: "watching",
      thisWeek: 1,
      avg4: 2.0,
      hist: [0, 0, 4, 3, 1, 1],
      months: 9,
      fav: "PERFORM"
    }, {
      name: "Kristy Perry",
      risk: "green",
      trend: "building",
      flag: "streak",
      thisWeek: 1,
      avg4: 4.5,
      hist: [3, 4, 3, 6, 5, 1],
      months: 28,
      fav: "PERFORM",
      streak: 21
    }, {
      name: "Scott Ludowyke",
      risk: "green",
      trend: "stable",
      flag: "streak",
      thisWeek: 1,
      avg4: 5.0,
      hist: [3, 5, 6, 4, 5, 1],
      months: 31,
      fav: "LIFT",
      streak: 24
    }, {
      name: "Casey Atkins",
      risk: "green",
      trend: "building",
      flag: "ontrack",
      thisWeek: 1,
      avg4: 3.75,
      hist: [3, 4, 4, 5, 4, 1],
      months: 20,
      fav: "LIFT"
    }, {
      name: "Carla Dimech",
      risk: "green",
      trend: "building",
      flag: "ontrack",
      thisWeek: 1,
      avg4: 3.5,
      hist: [3, 3, 4, 4, 5, 1],
      months: 15,
      fav: "LIFT"
    }]
  }, {
    id: "c2",
    time: "06:00 AM",
    end: "06:50 AM",
    type: "LIFT",
    instructor: "Scotty",
    capacity: 36,
    booked: 22,
    checkedIn: 0,
    members: [{
      name: "Bec James",
      risk: "green",
      trend: "building",
      flag: "streak",
      thisWeek: 1,
      avg4: 4.75,
      hist: [5, 6, 5, 6, 6, 1],
      months: 28,
      fav: "PERFORM",
      streak: 30
    }, {
      name: "Gavin Mcarthur",
      risk: "green",
      trend: "stable",
      flag: "ontrack",
      thisWeek: 1,
      avg4: 4.5,
      hist: [3, 6, 6, 5, 5, 1],
      months: 22,
      fav: "PERFORM"
    }, {
      name: "Clare Howard-Smith",
      risk: "green",
      trend: "stable",
      flag: "ontrack",
      thisWeek: 1,
      avg4: 4.25,
      hist: [4, 6, 4, 4, 5, 1],
      months: 24,
      fav: "PERFORM"
    }, {
      name: "Leigh-Anne Whaits",
      risk: "green",
      trend: "stable",
      flag: "ontrack",
      thisWeek: 1,
      avg4: 4.25,
      hist: [3, 5, 5, 5, 5, 1],
      months: 30,
      fav: "LIFT"
    }, {
      name: "Ryan Patel",
      risk: "green",
      trend: "building",
      flag: "streak",
      thisWeek: 1,
      avg4: 4.0,
      hist: [4, 4, 4, 4, 4, 1],
      months: 20,
      fav: "LIFT",
      streak: 20
    }, {
      name: "Samantha Langmaid",
      risk: "green",
      trend: "building",
      flag: "ontrack",
      thisWeek: 1,
      avg4: 3.25,
      hist: [3, 4, 3, 4, 4, 1],
      months: 17,
      fav: "LIFT"
    }, {
      name: "Cameron Tuck",
      risk: "red",
      trend: "critical",
      flag: "critical",
      thisWeek: 0,
      avg4: 1.5,
      hist: [3, 3, 3, 2, 1, 0],
      months: 12,
      fav: "LIFT"
    }, {
      name: "Tayla Gesch",
      risk: "red",
      trend: "critical",
      flag: "critical",
      thisWeek: 0,
      avg4: 1.5,
      hist: [3, 3, 3, 2, 1, 0],
      months: 9,
      fav: "LIFT"
    }, {
      name: "Judy Hesse",
      risk: "amber",
      trend: "critical",
      flag: "critical",
      thisWeek: 1,
      avg4: 3.25,
      hist: [3, 5, 5, 4, 1, 1],
      months: 14,
      fav: "LIFT"
    }, {
      name: "Ali Kickbusch",
      risk: "green",
      trend: "building",
      flag: "ontrack",
      thisWeek: 1,
      avg4: 3.25,
      hist: [3, 3, 3, 3, 4, 1],
      months: 19,
      fav: "LIFT"
    }, {
      name: "Cass Mosman",
      risk: "green",
      trend: "stable",
      flag: "ontrack",
      thisWeek: 1,
      avg4: 3.5,
      hist: [3, 4, 3, 4, 3, 1],
      months: 21,
      fav: "LIFT"
    }]
  }, {
    id: "c3",
    time: "07:15 AM",
    end: "08:05 AM",
    type: "PERFORM",
    instructor: "Sally",
    capacity: 20,
    booked: 14,
    checkedIn: 0,
    members: [{
      name: "Cameron Howard-Smith",
      risk: "amber",
      trend: "drifting",
      flag: "checkin",
      thisWeek: 1,
      avg4: 2.75,
      hist: [3, 4, 3, 3, 2, 1],
      months: 22,
      fav: "PERFORM"
    }, {
      name: "India Taplin",
      risk: "red",
      trend: "critical",
      flag: "disengage",
      thisWeek: 0,
      avg4: 1.25,
      hist: [0, 3, 1, 2, 0, 0],
      months: 8,
      fav: "PERFORM"
    }, {
      name: "Remy Martin",
      risk: "red",
      trend: "critical",
      flag: "disengage",
      thisWeek: 0,
      avg4: 1.0,
      hist: [2, 1, 2, 1, 0, 0],
      months: 14,
      fav: "PERFORM"
    }, {
      name: "Sal Pryse",
      risk: "amber",
      trend: "critical",
      flag: "critical",
      thisWeek: 0,
      avg4: 2.0,
      hist: [1, 3, 3, 0, 1, 0],
      months: 11,
      fav: "PERFORM"
    }, {
      name: "Nikki Petherbridge",
      risk: "amber",
      trend: "drifting",
      flag: "checkin",
      thisWeek: 0,
      avg4: 1.5,
      hist: [2, 2, 2, 2, 1, 0],
      months: 16,
      fav: "PERFORM"
    }, {
      name: "Charles Aitken",
      risk: "green",
      trend: "building",
      flag: "ontrack",
      thisWeek: 1,
      avg4: 3.0,
      hist: [3, 3, 3, 3, 3, 1],
      months: 18,
      fav: "PERFORM"
    }, {
      name: "Emily Whishaw",
      risk: "green",
      trend: "stable",
      flag: "ontrack",
      thisWeek: 1,
      avg4: 3.0,
      hist: [3, 3, 4, 3, 3, 1],
      months: 24,
      fav: "PERFORM"
    }]
  }, {
    id: "c4",
    time: "09:15 AM",
    end: "10:05 AM",
    type: "CONDITION",
    instructor: "Sam",
    capacity: 20,
    booked: 11,
    checkedIn: 0,
    members: [{
      name: "Kayla Ashton",
      risk: "amber",
      trend: "drifting",
      flag: "checkin",
      thisWeek: 1,
      avg4: 2.5,
      hist: [3, 3, 2, 2, 2, 1],
      months: 13,
      fav: "CONDITION"
    }, {
      name: "Ruan Markram",
      risk: "amber",
      trend: "drifting",
      flag: "checkin",
      thisWeek: 1,
      avg4: 2.75,
      hist: [2, 4, 3, 3, 2, 1],
      months: 17,
      fav: "CONDITION"
    }, {
      name: "Hayley Wynd",
      risk: "green",
      trend: "drifting",
      flag: "checkin",
      thisWeek: 1,
      avg4: 3.75,
      hist: [2, 5, 4, 4, 2, 1],
      months: 18,
      fav: "LIFT"
    }, {
      name: "Liz Hawkins",
      risk: "amber",
      trend: "building",
      flag: "building",
      thisWeek: 2,
      avg4: 2.75,
      hist: [1, 0, 4, 4, 3, 2],
      months: 14,
      fav: "PERFORM"
    }, {
      name: "Emily Harper",
      risk: "amber",
      trend: "building",
      flag: "building",
      thisWeek: 2,
      avg4: 2.25,
      hist: [1, 3, 0, 2, 4, 1],
      months: 11,
      fav: "LIFT"
    }]
  }, {
    id: "c5",
    time: "04:30 PM",
    end: "05:20 PM",
    type: "PERFORM",
    instructor: "Meg",
    capacity: 20,
    booked: 16,
    checkedIn: 0,
    members: [{
      name: "Libby Thomas",
      risk: "red",
      trend: "drifting",
      flag: "financial",
      thisWeek: 1,
      avg4: 1.5,
      hist: [2, 2, 0, 1, 2, 1],
      months: 19,
      fav: "PERFORM"
    }, {
      name: "Sienna Dutton",
      risk: "red",
      trend: "drifting",
      flag: "financial",
      thisWeek: 1,
      avg4: 1.0,
      hist: [2, 2, 0, 1, 2, 1],
      months: 8,
      fav: "PERFORM"
    }, {
      name: "Gemma Sillars",
      risk: "red",
      trend: "stable",
      flag: "atrisk",
      thisWeek: 0,
      avg4: 0.5,
      hist: [0, 1, 2, 0, 0, 0],
      months: 6,
      fav: "PERFORM"
    }, {
      name: "Joanne Macaulay",
      risk: "red",
      trend: "stable",
      flag: "atrisk",
      thisWeek: 0,
      avg4: 0.5,
      hist: [0, 0, 1, 2, 0, 0],
      months: 11,
      fav: "PERFORM"
    }, {
      name: "Jake Haydon",
      risk: "green",
      trend: "stable",
      flag: "ontrack",
      thisWeek: 1,
      avg4: 3.5,
      hist: [3, 4, 3, 4, 3, 1],
      months: 15,
      fav: "PERFORM"
    }, {
      name: "Cass Mosman",
      risk: "green",
      trend: "stable",
      flag: "ontrack",
      thisWeek: 2,
      avg4: 3.5,
      hist: [3, 4, 3, 4, 3, 2],
      months: 21,
      fav: "LIFT"
    }, {
      name: "Carla Dimech",
      risk: "green",
      trend: "building",
      flag: "ontrack",
      thisWeek: 2,
      avg4: 3.5,
      hist: [3, 3, 4, 4, 5, 2],
      months: 15,
      fav: "LIFT"
    }]
  }, {
    id: "c6",
    time: "05:30 PM",
    end: "06:20 PM",
    type: "LIFT",
    instructor: "Scotty",
    capacity: 36,
    booked: 28,
    checkedIn: 0,
    members: [{
      name: "Cameron Tuck",
      risk: "red",
      trend: "critical",
      flag: "critical",
      thisWeek: 1,
      avg4: 1.5,
      hist: [3, 3, 3, 2, 1, 1],
      months: 12,
      fav: "LIFT"
    }, {
      name: "Tayla Gesch",
      risk: "red",
      trend: "critical",
      flag: "critical",
      thisWeek: 1,
      avg4: 1.5,
      hist: [3, 3, 3, 2, 1, 1],
      months: 9,
      fav: "LIFT"
    }, {
      name: "Kyrie Hunter",
      risk: "red",
      trend: "stable",
      flag: "atrisk",
      thisWeek: 1,
      avg4: 0.0,
      hist: [0, 0, 0, 0, 0, 1],
      months: 5,
      fav: "LIFT"
    }, {
      name: "Bec Parsons",
      risk: "red",
      trend: "building",
      flag: "building",
      thisWeek: 1,
      avg4: 1.25,
      hist: [0, 0, 0, 3, 3, 1],
      months: 7,
      fav: "LIFT"
    }, {
      name: "Tim Wood",
      risk: "red",
      trend: "critical",
      flag: "critical",
      thisWeek: 1,
      avg4: 0.75,
      hist: [2, 1, 2, 0, 0, 1],
      months: 10,
      fav: "LIFT"
    }, {
      name: "Kristy Perry",
      risk: "green",
      trend: "building",
      flag: "streak",
      thisWeek: 2,
      avg4: 4.5,
      hist: [3, 4, 3, 6, 5, 2],
      months: 28,
      fav: "PERFORM",
      streak: 21
    }, {
      name: "Scott Ludowyke",
      risk: "green",
      trend: "stable",
      flag: "streak",
      thisWeek: 2,
      avg4: 5.0,
      hist: [3, 5, 6, 4, 5, 2],
      months: 31,
      fav: "LIFT",
      streak: 24
    }, {
      name: "Bec James",
      risk: "green",
      trend: "building",
      flag: "streak",
      thisWeek: 2,
      avg4: 4.75,
      hist: [5, 6, 5, 6, 6, 2],
      months: 28,
      fav: "PERFORM",
      streak: 30
    }, {
      name: "Jake Haydon",
      risk: "green",
      trend: "stable",
      flag: "ontrack",
      thisWeek: 2,
      avg4: 3.5,
      hist: [3, 4, 3, 4, 3, 2],
      months: 15,
      fav: "PERFORM"
    }, {
      name: "Cate Robertson",
      risk: "suspended",
      trend: "stable",
      flag: "suspended",
      thisWeek: 0,
      avg4: 3.0,
      hist: [3, 3, 4, 3, 0, 0],
      months: 7,
      fav: "LIFT",
      returnDate: "17/06/2026"
    }]
  }],
  // Action list — auto-generated from member data
  // Priority: cancelling > disengaging > critical > red > returning > checkin flag > financial
  actions: [{
    id: "a1",
    name: "Samantha Brunskill",
    risk: "cancelling",
    reason: "Cancels in 2 days — was unaware of rollover. Winnable.",
    channel: "Call",
    msg: "Hey Samantha, I wanted to personally reach out before your membership ends. I think there may have been some confusion about the renewal — can we have a quick chat today?",
    priority: 1
  }, {
    id: "a2",
    name: "Fran Debeer",
    risk: "cancelling",
    reason: "Cancels in 5 days — Financial. Offer payment options or downgrade.",
    channel: "Call",
    msg: "Hey Fran, just wanted to check in before your membership wraps up. We have some flexible options that might work better — worth a 5-minute chat?",
    priority: 2
  }, {
    id: "a3",
    name: "India Taplin",
    risk: "red",
    reason: "Zero sessions 2 weeks — disengaging. Last seen 19 May.",
    channel: "SMS",
    msg: "Hey India, we've genuinely missed you — just checking in. Everything okay? No pressure, just want to make sure you're doing well 🙌",
    priority: 3
  }, {
    id: "a4",
    name: "Remy Martin",
    risk: "red",
    reason: "Zero sessions 2 weeks — disengaging. Was attending 2/week.",
    channel: "Instagram DM",
    msg: "Hey Remy! We haven't seen you in a couple of weeks — miss having you in class. How are you going? Want to lock in a session this week?",
    priority: 4
  }, {
    id: "a5",
    name: "Cameron Tuck",
    risk: "red",
    reason: "Was 3/week, now 1/week — critical drop over 3 weeks.",
    channel: "SMS",
    msg: "Hey Cameron, noticed your sessions have dropped a bit lately — just wanted to check in. Everything going okay outside the gym?",
    priority: 5
  }, {
    id: "a6",
    name: "Tayla Gesch",
    risk: "red",
    reason: "Same pattern as Cameron Tuck — 3 to 1 per week.",
    channel: "In Person",
    msg: "Hey Tayla, great to see you in today. How's everything tracking? I noticed your sessions dropped a bit — all good?",
    priority: 6
  }, {
    id: "a7",
    name: "Abbey Hewitt",
    risk: "amber",
    reason: "Was 4/week, dropped to 0 then 1 — critical trend.",
    channel: "In Person",
    msg: "Abbey, awesome to see you back in. Two quiet weeks there — everything okay? Let's get you locked in for the rest of the week.",
    priority: 7
  }, {
    id: "a8",
    name: "Sophia Hewitt",
    risk: "amber",
    reason: "Same as Abbey — critical drop last 2 weeks.",
    channel: "In Person",
    msg: "Sophia, great to have you back. Noticed a couple of quiet weeks — just checking in. Want to get a plan sorted for this week?",
    priority: 8
  }, {
    id: "a9",
    name: "Tarni Bruce",
    risk: "suspended",
    reason: "Returns in 3 days — book first session back now.",
    channel: "SMS",
    msg: "Hey Tarni! You're almost back 🙌 Want me to grab you a spot in LIFT or PERFORM for when your suspension ends Friday? We've missed you!",
    priority: 9
  }, {
    id: "a10",
    name: "Simone Ross",
    risk: "suspended",
    reason: "Returns in 5 days — reach out now to book return session.",
    channel: "SMS",
    msg: "Hey Simone, hope everything's been going well! You're back with us on Sunday — want to lock in your first session back? So good to have you returning 💪",
    priority: 10
  }, {
    id: "a11",
    name: "Hayley Wynd",
    risk: "green",
    reason: "Was 5/week, now 2/week — soft drop. Worth a check-in even though still green.",
    channel: "In Person",
    msg: "Hayley, good to see you in today. I noticed your sessions have been a little lighter lately — all good? Just making sure nothing's getting in the way.",
    priority: 11
  }, {
    id: "a12",
    name: "Steve Moodie",
    risk: "cancelling",
    reason: "Cancels in 10 days — Motivation/Results. Has a story to hear.",
    channel: "Call",
    msg: "Hey Steve, wanted to personally reach out. I know results can feel slow sometimes — can we jump on a quick call? I'd love to understand what's not clicking and see what we can do.",
    priority: 12
  }]
};
const CHANNELS = [{
  id: "face",
  icon: "🤝",
  label: "In Person"
}, {
  id: "sms",
  icon: "💬",
  label: "SMS"
}, {
  id: "ig",
  icon: "📸",
  label: "IG / FB"
}, {
  id: "email",
  icon: "✉️",
  label: "Email"
}];
const FLAG_CFG = {
  streak: {
    icon: "🔥",
    text: m => "Streak: " + m.streak + " sessions",
    color: "#fb923c",
    bg: "#2a1a08"
  },
  ontrack: {
    icon: "✅",
    text: () => "On track — affirm",
    color: "#4ade80",
    bg: "#0d2318"
  },
  building: {
    icon: "📈",
    text: () => "Building — acknowledge",
    color: "#4ade80",
    bg: "#0d2318"
  },
  checkin: {
    icon: "⚠️",
    text: () => "Drop detected — check in",
    color: "#fb923c",
    bg: "#2a1a08"
  },
  critical: {
    icon: "🔴",
    text: () => "Critical drop — speak to them",
    color: "#f87171",
    bg: "#200d0d"
  },
  disengage: {
    icon: "🚨",
    text: () => "Disengaging — urgent",
    color: "#f87171",
    bg: "#200d0d"
  },
  returner: {
    icon: "🔔",
    text: m => "Back from suspension — welcome!",
    color: "#a5b4fc",
    bg: "#1a1a2e"
  },
  returning: {
    icon: "🔔",
    text: m => "Just returned " + (m.returnedDaysAgo || 1) + "d ago — check how they're settling",
    color: "#a5b4fc",
    bg: "#1a1a2e"
  },
  suspended: {
    icon: "⏸️",
    text: m => "Suspended · Returns " + fmtDate(m.returnDate),
    color: "#a5b4fc",
    bg: "#1a1a2e"
  },
  financial: {
    icon: "💰",
    text: () => "Unlimited plan, low usage — offer 2×/wk",
    color: "#fb923c",
    bg: "#2a1a08"
  },
  watching: {
    icon: "👁️",
    text: () => "Watching — below target",
    color: "#fb923c",
    bg: "#2a1a08"
  },
  atrisk: {
    icon: "🔴",
    text: () => "At risk — low attendance",
    color: "#f87171",
    bg: "#200d0d"
  }
};
function ClassCard({
  cls,
  onMemberClick
}) {
  const [open, setOpen] = useState(false);
  const typeColors = {
    LIFT: {
      bg: "#1a1a2e",
      border: "#3a3a5c",
      text: "#a5b4fc",
      pill: "#2a2a4e"
    },
    PERFORM: {
      bg: "#0d2318",
      border: "#1a4d30",
      text: "#4ade80",
      pill: "#142e1e"
    },
    CONDITION: {
      bg: "#2a1a08",
      border: "#5a3510",
      text: "#fb923c",
      pill: "#3a2a10"
    },
    "SATURDAY SWEAT": {
      bg: "#1f0d1f",
      border: "#4a1545",
      text: "#f0abfc",
      pill: "#2f1530"
    }
  };
  const tc = typeColors[cls.type] || typeColors.LIFT;
  const flagged = cls.members.filter(m => !["ontrack", "streak"].includes(m.flag));
  const streakers = cls.members.filter(m => m.flag === "streak");
  const atRisk = cls.members.filter(m => ["critical", "disengage", "atrisk"].includes(m.flag));
  return /*#__PURE__*/React.createElement("div", {
    style: {
      border: `1px solid ${open ? tc.border : T.border}`,
      borderRadius: 12,
      overflow: "hidden",
      marginBottom: 8,
      transition: "border-color 0.2s"
    }
  }, /*#__PURE__*/React.createElement("div", {
    onClick: () => setOpen(!open),
    style: {
      background: open ? tc.bg : T.surface,
      padding: "11px 16px",
      display: "flex",
      alignItems: "center",
      gap: 10,
      cursor: "pointer",
      transition: "background 0.2s",
      userSelect: "none"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      gap: 8,
      flex: 1,
      minWidth: 0
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontWeight: 700,
      fontSize: 14,
      color: tc.text,
      fontFamily: "'DM Mono',monospace",
      flexShrink: 0
    }
  }, cls.time), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 12,
      fontWeight: 700,
      color: tc.text,
      background: tc.pill,
      padding: "2px 10px",
      borderRadius: 99,
      flexShrink: 0
    }
  }, cls.type), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 11,
      color: T.muted,
      flexShrink: 0
    }
  }, "\uD83D\uDC64 ", cls.instructor)), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      gap: 10,
      flexShrink: 0
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      gap: 4
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 10,
      color: T.muted,
      fontFamily: "'DM Mono',monospace"
    }
  }, cls.booked), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 10,
      color: T.muted
    }
  }, "booked")), atRisk.length > 0 && /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 10,
      fontWeight: 700,
      background: "rgba(248,113,113,0.12)",
      color: "#f87171",
      padding: "2px 8px",
      borderRadius: 99,
      border: "1px solid rgba(248,113,113,0.25)"
    }
  }, atRisk.length, " at risk"), flagged.length > 0 && /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 10,
      fontWeight: 700,
      background: "rgba(251,146,60,0.12)",
      color: T.orangeText,
      padding: "2px 8px",
      borderRadius: 99,
      border: "1px solid rgba(251,146,60,0.25)"
    }
  }, flagged.length, " flagged"), streakers.length > 0 && /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 10,
      fontWeight: 700,
      background: "rgba(251,146,60,0.1)",
      color: "#fb923c",
      padding: "2px 8px",
      borderRadius: 99,
      border: "1px solid rgba(251,146,60,0.2)"
    }
  }, "\uD83D\uDD25 ", streakers.length), /*#__PURE__*/React.createElement("span", {
    style: {
      color: T.muted,
      fontSize: 12,
      transition: "transform 0.2s",
      display: "inline-block",
      transform: open ? "rotate(180deg)" : "rotate(0deg)"
    }
  }, "\u25BC"))), open && /*#__PURE__*/React.createElement("div", {
    style: {
      borderTop: `1px solid ${tc.border}`,
      background: T.bg
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      gap: 16,
      padding: "7px 16px",
      borderBottom: `1px solid ${T.border}`,
      background: T.surface
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 9,
      fontWeight: 700,
      color: T.muted,
      letterSpacing: "0.1em"
    }
  }, "MEMBER"), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 9,
      fontWeight: 700,
      color: T.muted,
      letterSpacing: "0.1em",
      marginLeft: "auto"
    }
  }, "AVG/WK"), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 9,
      fontWeight: 700,
      color: T.muted,
      letterSpacing: "0.1em",
      minWidth: 180
    }
  }, "STATUS")), /*#__PURE__*/React.createElement("div", {
    style: {
      padding: "6px 8px",
      display: "flex",
      flexDirection: "column",
      gap: 2
    }
  }, cls.members.map((m, i) => {
    const rc = m.risk === "green" ? T.greenText : m.risk === "amber" ? T.orangeText : m.risk === "suspended" ? T.greyText : m.risk === "cancelling" ? T.pinkText : T.redText;
    const fc = FLAG_CFG[m.flag] || FLAG_CFG.ontrack;
    const flagText = typeof fc.text === "function" ? fc.text(m) : fc.text;
    const initials = m.name.split(" ").map(p => p[0]).join("").slice(0, 2).toUpperCase();
    return /*#__PURE__*/React.createElement("div", {
      key: i,
      onClick: () => onMemberClick(m.name),
      style: {
        display: "flex",
        alignItems: "center",
        gap: 8,
        padding: "7px 8px",
        borderRadius: 8,
        cursor: "pointer",
        transition: "background 0.1s"
      },
      onMouseEnter: e => e.currentTarget.style.background = T.surface,
      onMouseLeave: e => e.currentTarget.style.background = "transparent"
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        width: 3,
        height: 22,
        borderRadius: 2,
        background: rc,
        flexShrink: 0
      }
    }), /*#__PURE__*/React.createElement("div", {
      style: {
        width: 28,
        height: 28,
        borderRadius: "50%",
        background: rc + "22",
        border: `1px solid ${rc}44`,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: 9,
        fontWeight: 700,
        color: rc,
        flexShrink: 0
      }
    }, initials), /*#__PURE__*/React.createElement("span", {
      style: {
        fontWeight: 600,
        fontSize: 12,
        color: T.text,
        flex: 1,
        minWidth: 0,
        whiteSpace: "nowrap",
        overflow: "hidden",
        textOverflow: "ellipsis"
      }
    }, m.name), /*#__PURE__*/React.createElement("span", {
      style: {
        fontSize: 10,
        color: T.muted,
        fontFamily: "'DM Mono',monospace",
        flexShrink: 0,
        width: 38,
        textAlign: "right"
      }
    }, m.avg4.toFixed(1), "/wk"), /*#__PURE__*/React.createElement("div", {
      style: {
        minWidth: 160,
        maxWidth: 200,
        flexShrink: 0
      }
    }, /*#__PURE__*/React.createElement("span", {
      style: {
        fontSize: 10,
        fontWeight: 600,
        padding: "3px 9px",
        borderRadius: 99,
        background: fc.bg,
        color: fc.color || T.muted,
        border: `1px solid ${rc}30`,
        display: "inline-block",
        whiteSpace: "nowrap",
        overflow: "hidden",
        textOverflow: "ellipsis",
        maxWidth: "100%"
      }
    }, fc.icon, " ", flagText)));
  }))));
}
function ActionCard({
  action,
  coach,
  onLog,
  logged
}) {
  const [expanded, setExpanded] = React.useState(false);
  const [copied, setCopied] = React.useState(false);
  const rc = action.risk === "cancelling" ? T.pinkText : action.risk === "suspended" ? T.greyText : action.risk === "red" ? T.redText : action.risk === "amber" ? T.orangeText : T.greenText;
  const rb = action.risk === "cancelling" ? T.pinkBg : action.risk === "suspended" ? T.greyBg : action.risk === "red" ? T.redBg : action.risk === "amber" ? T.orangeBg : T.greenBg;
  function copyMsg() {
    if (navigator.clipboard) navigator.clipboard.writeText(action.msg);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }
  if (logged) {
    return /*#__PURE__*/React.createElement("div", {
      style: {
        background: T.surface2,
        border: `1px solid ${T.border}`,
        borderRadius: 10,
        padding: "10px 14px",
        display: "flex",
        alignItems: "center",
        gap: 10,
        opacity: 0.6
      }
    }, /*#__PURE__*/React.createElement("span", {
      style: {
        fontSize: 14
      }
    }, "\u2705"), /*#__PURE__*/React.createElement("div", {
      style: {
        flex: 1
      }
    }, /*#__PURE__*/React.createElement("span", {
      style: {
        fontWeight: 600,
        fontSize: 12,
        color: T.text
      }
    }, action.name), /*#__PURE__*/React.createElement("span", {
      style: {
        fontSize: 10,
        color: T.muted,
        marginLeft: 8
      }
    }, logged.coach, " \xB7 ", logged.channel, " \xB7 ", logged.time)), /*#__PURE__*/React.createElement("button", {
      onClick: () => onLog(null),
      style: {
        fontSize: 10,
        color: T.muted,
        background: "transparent",
        border: "none",
        cursor: "pointer"
      }
    }, "undo"));
  }
  return /*#__PURE__*/React.createElement("div", {
    style: {
      background: T.surface,
      border: `1px solid ${T.border}`,
      borderRadius: 10,
      overflow: "hidden",
      marginBottom: 8
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      padding: "10px 14px",
      display: "flex",
      alignItems: "flex-start",
      gap: 10,
      cursor: "pointer"
    },
    onClick: () => setExpanded(!expanded)
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: 3,
      height: "100%",
      minHeight: 20,
      borderRadius: 2,
      background: rc,
      flexShrink: 0,
      alignSelf: "stretch"
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      gap: 8,
      flexWrap: "wrap"
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontWeight: 700,
      fontSize: 13,
      color: T.text
    }
  }, action.name), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 9,
      fontWeight: 700,
      padding: "2px 7px",
      borderRadius: 99,
      background: rb,
      color: rc,
      border: `1px solid ${rc}44`
    }
  }, action.risk === "cancelling" ? "CANCELLING" : action.risk === "suspended" ? "SUSPENDED" : action.risk.toUpperCase())), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 11,
      color: T.muted,
      marginTop: 3
    }
  }, action.reason)), /*#__PURE__*/React.createElement("span", {
    style: {
      color: T.muted,
      fontSize: 12,
      flexShrink: 0
    }
  }, expanded ? "▲" : "▼")), expanded && /*#__PURE__*/React.createElement("div", {
    style: {
      padding: "0 14px 12px 27px",
      borderTop: `1px solid ${T.border}`
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      background: T.surface2,
      borderRadius: 8,
      padding: "10px 12px",
      margin: "10px 0",
      position: "relative"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 9,
      fontWeight: 700,
      color: T.muted,
      letterSpacing: "0.1em",
      marginBottom: 5
    }
  }, "SUGGESTED MESSAGE \xB7 ", action.channel), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 12,
      color: T.text,
      lineHeight: 1.6,
      fontStyle: "italic"
    }
  }, action.msg), /*#__PURE__*/React.createElement("button", {
    onClick: copyMsg,
    style: {
      position: "absolute",
      top: 8,
      right: 8,
      fontSize: 10,
      background: T.border,
      border: "none",
      color: copied ? T.greenText : T.muted,
      padding: "3px 8px",
      borderRadius: 5,
      cursor: "pointer"
    }
  }, copied ? "✓ Copied" : "Copy")), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 10,
      color: T.muted,
      marginBottom: 6,
      fontWeight: 600,
      letterSpacing: "0.08em"
    }
  }, "LOG CONTACT AS ", coach.toUpperCase()), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      gap: 6,
      flexWrap: "wrap"
    }
  }, CHANNELS.map(ch => /*#__PURE__*/React.createElement("button", {
    key: ch.id,
    onClick: () => onLog({
      coach,
      channel: ch.label,
      time: new Date().toLocaleTimeString("en-AU", {
        hour: "2-digit",
        minute: "2-digit"
      })
    }),
    style: {
      fontSize: 11,
      padding: "6px 12px",
      borderRadius: 8,
      border: `1px solid ${T.border}`,
      background: T.surface2,
      color: T.muted,
      cursor: "pointer",
      display: "flex",
      gap: 5,
      alignItems: "center",
      fontFamily: "'DM Sans',sans-serif",
      transition: "all 0.15s"
    },
    onMouseEnter: e => {
      e.currentTarget.style.borderColor = rc;
      e.currentTarget.style.color = rc;
    },
    onMouseLeave: e => {
      e.currentTarget.style.borderColor = T.border;
      e.currentTarget.style.color = T.muted;
    }
  }, /*#__PURE__*/React.createElement("span", null, ch.icon), /*#__PURE__*/React.createElement("span", null, ch.label))))));
}
function TodayView({
  coach
}) {
  const [logs, setLogs] = React.useState({});
  const [drawerName, setDrawer] = React.useState(null);
  const pending = TODAY_DATA.actions.filter(a => !logs[a.id]);
  const completed = TODAY_DATA.actions.filter(a => logs[a.id]);

  // Summary strip
  const totalMembers = TODAY_DATA.classes.reduce((s, c) => s + c.members.length, 0);
  const totalFlagged = TODAY_DATA.classes.reduce((s, c) => s + c.members.filter(m => !["ontrack", "streak"].includes(m.flag)).length, 0);

  // Returners this week
  const returnersSoon = [{
    name: "Tarni Bruce",
    days: 3,
    pkg: "Legacy M:M"
  }, {
    name: "Simone Ross",
    days: 5,
    pkg: "M:M"
  }];
  return /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: {
      background: T.surface,
      border: `1px solid ${T.border}`,
      borderRadius: 12,
      padding: "14px 18px",
      marginBottom: 16,
      display: "flex",
      gap: 20,
      flexWrap: "wrap",
      alignItems: "center"
    }
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 14,
      fontWeight: 700,
      color: T.text
    }
  }, "Tuesday 9 June 2026"), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 11,
      color: T.muted,
      marginTop: 1
    }
  }, "Viewing as: ", /*#__PURE__*/React.createElement("span", {
    style: {
      color: T.accent,
      fontWeight: 600
    }
  }, coach))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      gap: 16,
      flexWrap: "wrap"
    }
  }, [{
    v: TODAY_DATA.classes.length,
    l: "classes today"
  }, {
    v: totalMembers,
    l: "members in"
  }, {
    v: totalFlagged,
    l: "flagged",
    c: "#f87171"
  }, {
    v: pending.length,
    l: "actions pending",
    c: "#fb923c"
  }, {
    v: completed.length,
    l: "completed",
    c: "#4ade80"
  }].map(s => /*#__PURE__*/React.createElement("div", {
    key: s.l,
    style: {
      textAlign: "center"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontWeight: 700,
      fontSize: 20,
      color: s.c || T.text,
      fontFamily: "'DM Mono',monospace"
    }
  }, s.v), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 9,
      color: T.muted
    }
  }, s.l))))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "grid",
      gridTemplateColumns: "1fr 360px",
      gap: 16,
      alignItems: "start"
    }
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 10,
      fontWeight: 700,
      color: T.muted,
      letterSpacing: "0.1em",
      marginBottom: 10,
      textTransform: "uppercase"
    }
  }, "Today's Sessions"), TODAY_DATA.classes.map(cls => /*#__PURE__*/React.createElement(ClassCard, {
    key: cls.id,
    cls: cls,
    onMemberClick: setDrawer
  }))), /*#__PURE__*/React.createElement("div", null, returnersSoon.length > 0 && /*#__PURE__*/React.createElement("div", {
    style: {
      background: "#1a1a2e",
      border: "1px solid #3a3a5c",
      borderRadius: 12,
      padding: "12px 14px",
      marginBottom: 14
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 10,
      fontWeight: 700,
      color: "#a5b4fc",
      letterSpacing: "0.1em",
      marginBottom: 8,
      display: "flex",
      alignItems: "center",
      gap: 6
    }
  }, "\uD83D\uDD14 RETURNING THIS WEEK"), returnersSoon.map((r, i) => /*#__PURE__*/React.createElement("div", {
    key: i,
    style: {
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      padding: "6px 0",
      borderBottom: i < returnersSoon.length - 1 ? `1px solid #3a3a5c` : "none"
    }
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: {
      fontWeight: 600,
      fontSize: 12,
      color: T.text
    }
  }, r.name), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 10,
      color: T.muted
    }
  }, r.pkg)), /*#__PURE__*/React.createElement("div", {
    style: {
      textAlign: "right"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontWeight: 700,
      fontSize: 14,
      color: r.days <= 3 ? "#f87171" : "#fb923c",
      fontFamily: "'DM Mono',monospace"
    }
  }, r.days, "d"), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 9,
      color: T.muted
    }
  }, "until return"))))), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 10,
      fontWeight: 700,
      color: T.muted,
      letterSpacing: "0.1em",
      marginBottom: 8,
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between"
    }
  }, /*#__PURE__*/React.createElement("span", null, "ACTION LIST \u2014 ", pending.length, " PENDING"), completed.length > 0 && /*#__PURE__*/React.createElement("span", {
    style: {
      color: T.greenText
    }
  }, completed.length, " done")), pending.map(action => /*#__PURE__*/React.createElement(ActionCard, {
    key: action.id,
    action: action,
    coach: coach,
    onLog: log => setLogs(prev => log ? {
      ...prev,
      [action.id]: log
    } : {
      ...prev,
      [action.id]: undefined
    }),
    logged: logs[action.id]
  })), completed.length > 0 && /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 12
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 10,
      fontWeight: 700,
      color: T.muted,
      letterSpacing: "0.1em",
      marginBottom: 6
    }
  }, "COMPLETED"), completed.map(action => /*#__PURE__*/React.createElement(ActionCard, {
    key: action.id,
    action: action,
    coach: coach,
    onLog: log => setLogs(prev => log ? {
      ...prev,
      [action.id]: log
    } : {
      ...prev,
      [action.id]: undefined
    }),
    logged: logs[action.id]
  }))))));
}

/* ── Main app ────────────────────────────────────────────────────────────── */
/* ── Sign In Screen ──────────────────────────────────────────────────────── */
function SignIn({
  onSuccess
}) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  async function handleSignIn(e) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const data = await sbAuth({
      email,
      password
    });
    if (data.access_token) {
      localStorage.setItem("pc_token", data.access_token);
      localStorage.setItem("pc_email", email);
      onSuccess(data.access_token);
    } else {
      setError(data.error_description || data.error || "Sign in failed");
      setLoading(false);
    }
  }
  return /*#__PURE__*/React.createElement("div", {
    style: {
      minHeight: "100vh",
      background: T.bg,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      padding: 20
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: "100%",
      maxWidth: 380
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      textAlign: "center",
      marginBottom: 28
    }
  }, /*#__PURE__*/React.createElement("svg", {
    width: 48,
    height: 48,
    viewBox: "0 0 100 100",
    style: {
      margin: "0 auto 12px"
    }
  }, /*#__PURE__*/React.createElement("defs", null, /*#__PURE__*/React.createElement("linearGradient", {
    id: "lg",
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
    fill: "url(#lg)"
  }), /*#__PURE__*/React.createElement("polyline", {
    points: "10,58 26,58 34,36 42,66 50,26 58,50 66,44 80,44",
    stroke: "white",
    strokeWidth: "5.5",
    strokeLinecap: "round",
    strokeLinejoin: "round",
    fill: "none"
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      fontWeight: 800,
      fontSize: 22,
      color: T.text
    }
  }, "PulseCheck"), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 11,
      color: T.muted,
      marginTop: 2,
      letterSpacing: "0.05em"
    }
  }, "WHO'S IN. WHO'S DRIFTING. WHO NEEDS YOU.")), /*#__PURE__*/React.createElement("div", {
    style: {
      background: T.surface,
      border: `1px solid ${T.border}`,
      borderRadius: 14,
      padding: "28px 24px"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontWeight: 700,
      fontSize: 16,
      color: T.text,
      marginBottom: 18
    }
  }, "Sign in"), error && /*#__PURE__*/React.createElement("div", {
    style: {
      background: "#200d0d",
      border: "1px solid #4a1515",
      borderRadius: 8,
      padding: "10px 12px",
      marginBottom: 14,
      fontSize: 12,
      color: "#f87171"
    }
  }, error), /*#__PURE__*/React.createElement("form", {
    onSubmit: handleSignIn
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      marginBottom: 14
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 11,
      fontWeight: 600,
      color: T.muted,
      marginBottom: 5
    }
  }, "Email"), /*#__PURE__*/React.createElement("input", {
    type: "email",
    value: email,
    onChange: e => setEmail(e.target.value),
    required: true,
    placeholder: "you@yourgym.com",
    style: {
      width: "100%",
      background: T.surface2,
      border: `1px solid ${T.border}`,
      borderRadius: 8,
      padding: "10px 12px",
      color: T.text,
      fontSize: 13,
      outline: "none",
      fontFamily: "'DM Sans',sans-serif"
    }
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      marginBottom: 20
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 11,
      fontWeight: 600,
      color: T.muted,
      marginBottom: 5
    }
  }, "Password"), /*#__PURE__*/React.createElement("input", {
    type: "password",
    value: password,
    onChange: e => setPassword(e.target.value),
    required: true,
    placeholder: "\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022",
    style: {
      width: "100%",
      background: T.surface2,
      border: `1px solid ${T.border}`,
      borderRadius: 8,
      padding: "10px 12px",
      color: T.text,
      fontSize: 13,
      outline: "none",
      fontFamily: "'DM Sans',sans-serif"
    }
  })), /*#__PURE__*/React.createElement("button", {
    type: "submit",
    disabled: loading,
    style: {
      width: "100%",
      background: "#6366f1",
      color: "white",
      border: "none",
      borderRadius: 8,
      padding: "12px",
      fontSize: 14,
      fontWeight: 700,
      cursor: "pointer",
      opacity: loading ? 0.6 : 1,
      fontFamily: "'DM Sans',sans-serif"
    }
  }, loading ? "Signing in…" : "Sign In →")))));
}
function PulseCheck() {
  // ── Supabase data loader ─────────────────────────────────────────────
  const [sbMembers, setSbMembers] = useState(null);
  const [sbError, setSbError] = useState(null);
  useEffect(() => {
    const cfg = window.PULSECHECK_CONFIG || {};
    if (!cfg.SUPABASE_URL || cfg.SUPABASE_ANON === 'PASTE_YOUR_ANON_KEY_HERE') return;

    // Get session token from localStorage
    const stored = localStorage.getItem('pc_session');
    const token = stored ? JSON.parse(stored)?.access_token : cfg.SUPABASE_ANON;
    fetch(cfg.SUPABASE_URL + '/rest/v1/members?gym_id=eq.' + cfg.GYM_ID + '&order=membership_status.asc&limit=500', {
      headers: {
        'apikey': cfg.SUPABASE_ANON,
        'Authorization': 'Bearer ' + token,
        'Content-Type': 'application/json'
      }
    }).then(r => r.json()).then(data => {
      if (Array.isArray(data) && data.length > 0) {
        // Map DB fields to app fields
        const mapped = data.map(m => ({
          id: m.id,
          name: (m.first_name + ' ' + m.last_name).trim(),
          initials: (m.first_name?.[0] || '') + (m.last_name?.[0] || ''),
          packageShort: m.package_short || '',
          months: m.months_member || 0,
          target: m.session_target || 3,
          status: m.membership_status || 'active',
          risk: m.risk_status || 'red',
          trend: m.trend || 'stable',
          avg4: parseFloat(m.avg_sessions_4w) || 0,
          consistency: m.consistency_pct || 0,
          total4weeks: m.total_sessions_4w || 0,
          thisWeek: m.this_week || 0,
          weeklyHistory: m.weekly_history || [0, 0, 0, 0, 0, 0],
          suspendedWeeks: m.suspended_weeks || [false, false, false, false, false, false],
          fav: m.fav_session || '',
          lastSession: m.last_session || '',
          memberSince: m.member_since || '',
          disengaging: m.is_disengaging || false,
          checkInFlag: m.checkin_flag || false,
          financialFlag: m.financial_flag || false,
          returnDate: m.suspended_until || null,
          cancelDate: m.cancel_date || null,
          cancelReason: m.cancel_reason || '',
          daysUntilReturn: m.days_until_return,
          daysUntilCancel: m.days_until_cancel,
          notes: ''
        }));
        setSbMembers(mapped);
      }
    }).catch(e => setSbError(e.message));
  }, []);

  // Use live Supabase data if available, otherwise fall back to embedded data
  const LIVE_MEMBERS = sbMembers || MEMBERS;
  // ── End Supabase loader ──────────────────────────────────────────────

  const [tab, setTab] = useState("members");
  const [selected, setSelected] = useState(null);
  const [search, setSearch] = useState("");
  const [filterRisk, setFilterRisk] = useState("all");
  const [filterPkg, setFilterPkg] = useState("all");
  const [trendTab, setTrendTab] = useState("all");
  const [isMobile, setIsMobile] = useState(typeof window !== "undefined" && window.innerWidth < 768);
  const [activeCoach, setActiveCoach] = useState("Meg");
  const [authToken, setAuthToken] = useState(() => localStorage.getItem("pc_token"));
  const [members, setMembers] = useState([]);
  const [dbLoading, setDbLoading] = useState(false);
  const [dbError, setDbError] = useState(null);
  useEffect(() => {
    if (!authToken) return;
    setDbLoading(true);
    sbFetch('/members?gym_id=eq.a0000000-0000-0000-0000-000000000001&order=membership_status.asc,risk_status.asc&limit=300', authToken).then(rows => {
      if (!rows) {
        setDbError("Could not load members");
        setDbLoading(false);
        return;
      }
      const expanded = rows.map(expandMember);
      // Sort: cancelling → disengaging → red → amber → suspended → green
      expanded.sort((a, b) => {
        const rank = s => s === 'cancelling' ? 0 : s === 'suspended' ? 4 : 0;
        const riskRank = r => r === 'cancelling' ? 0 : r === 'red' ? 1 : r === 'amber' ? 2 : r === 'suspended' ? 3 : 4;
        if (a.disengaging && !b.disengaging) return -1;
        if (!a.disengaging && b.disengaging) return 1;
        const rr = riskRank(a.risk) - riskRank(b.risk);
        if (rr !== 0) return rr;
        return b.avg4 - a.avg4;
      });
      setMembers(expanded);
      setDbLoading(false);
    }).catch(() => {
      setDbError("Connection failed");
      setDbLoading(false);
    });
  }, [authToken]);
  if (!authToken) return /*#__PURE__*/React.createElement(SignIn, {
    onSuccess: token => {
      setAuthToken(token);
    }
  });
  useEffect(() => {
    const fn = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener("resize", fn);
    return () => window.removeEventListener("resize", fn);
  }, []);
  const viewType = tab === "suspensions" ? "suspended" : tab === "departures" ? "departures" : "members";
  const base = members.filter(m => tab === "suspensions" ? m.status === "suspended" : tab === "departures" ? m.status === "cancelling" : true);
  const filtered = useMemo(() => {
    let list = base;
    if (search) list = list.filter(m => m.name.toLowerCase().includes(search.toLowerCase()) || (m.packageShort || "").toLowerCase().includes(search.toLowerCase()));
    if (filterRisk !== "all") list = list.filter(m => m.risk === filterRisk);
    if (filterPkg !== "all") list = list.filter(m => m.packageShort === filterPkg);
    if (trendTab !== "all" && tab === "members") list = list.filter(m => m.trend === trendTab);
    return list;
  }, [base, search, filterRisk, filterPkg, trendTab, tab]);
  const act = members.filter(m => m.status === "active");
  const diseng = act.filter(m => m.disengaging).length;
  const pkgs = [...new Set(members.map(m => m.packageShort))].filter(Boolean).sort();
  const TREND_TABS = [{
    id: "all",
    label: "All Members",
    count: base.length
  }, {
    id: "building",
    label: "Building ↑",
    count: act.filter(m => m.trend === "building").length,
    color: T.greenText
  }, {
    id: "stable",
    label: "Stable →",
    count: act.filter(m => m.trend === "stable").length,
    color: T.greyText
  }, {
    id: "drifting",
    label: "Drifting ↓",
    count: act.filter(m => m.trend === "drifting").length,
    color: T.orangeText
  }, {
    id: "critical",
    label: "Critical ↓↓",
    count: act.filter(m => m.trend === "critical").length,
    color: T.redText
  }];
  const NAV = [{
    s: "OVERVIEW"
  }, {
    id: "dashboard",
    icon: "🏠",
    label: "Dashboard"
  }, {
    id: "growth",
    icon: "📈",
    label: "Growth"
  }, {
    id: "today",
    icon: "⚡",
    label: "Today's Actions"
  }, {
    id: "alerts",
    icon: "🔔",
    label: "Alerts",
    badge: diseng
  }, {
    s: "MEMBER HEALTH"
  }, {
    id: "members",
    icon: "👥",
    label: "Members"
  }, {
    id: "suspensions",
    icon: "⏸️",
    label: "Suspensions"
  }, {
    id: "departures",
    icon: "🚪",
    label: "Departures"
  }, {
    s: "REPORTING"
  }, {
    id: "bizhealth",
    icon: "💼",
    label: "Business Health"
  }, {
    id: "analytics",
    icon: "📊",
    label: "Analytics"
  }, {
    s: "ADMIN"
  }, {
    id: "settings",
    icon: "⚙️",
    label: "Settings"
  }];
  const titles = {
    members: "Members",
    suspensions: "Suspensions",
    departures: "Departures",
    dashboard: "Dashboard",
    today: "Today's Actions",
    growth: "Growth",
    alerts: "Alerts",
    bizhealth: "Business Health",
    analytics: "Analytics",
    settings: "Settings"
  };
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      minHeight: "100vh",
      background: T.bg
    }
  }, /*#__PURE__*/React.createElement("style", null, FONT), !isMobile && /*#__PURE__*/React.createElement("aside", {
    style: {
      width: 188,
      minHeight: "100vh",
      background: T.surface,
      borderRight: `1px solid ${T.border}`,
      display: "flex",
      flexDirection: "column",
      padding: "16px 10px",
      position: "fixed",
      top: 0,
      left: 0,
      zIndex: 30,
      overflowY: "auto"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      gap: 9,
      padding: "0 8px",
      marginBottom: 22,
      flexShrink: 0
    }
  }, /*#__PURE__*/React.createElement(Logo, {
    size: 28
  }), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: {
      fontWeight: 800,
      color: T.text,
      fontSize: 14,
      letterSpacing: "-0.3px"
    }
  }, "PulseCheck"), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 9,
      color: T.muted
    }
  }, "Member Health Intelligence"))), NAV.map((n, i) => n.s ? /*#__PURE__*/React.createElement("div", {
    key: i,
    style: {
      fontSize: 9,
      color: T.muted,
      fontWeight: 600,
      letterSpacing: "0.1em",
      padding: "8px 10px 3px",
      marginTop: i > 0 ? 4 : 0,
      textTransform: "uppercase"
    }
  }, n.s) : /*#__PURE__*/React.createElement("button", {
    key: n.id,
    onClick: () => {
      setTab(n.id);
      setSearch("");
      setFilterRisk("all");
      setFilterPkg("all");
      setTrendTab("all");
    },
    style: {
      display: "flex",
      alignItems: "center",
      gap: 7,
      padding: "8px 10px",
      borderRadius: 8,
      marginBottom: 1,
      border: "none",
      cursor: "pointer",
      textAlign: "left",
      width: "100%",
      background: tab === n.id ? T.accent : "transparent",
      color: tab === n.id ? "white" : T.muted,
      fontWeight: tab === n.id ? 600 : 400,
      fontSize: 12,
      fontFamily: "'DM Sans',sans-serif",
      transition: "all 0.12s",
      position: "relative"
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 13,
      flexShrink: 0
    }
  }, n.icon), /*#__PURE__*/React.createElement("span", {
    style: {
      flex: 1
    }
  }, n.label), n.badge > 0 && /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 9,
      background: "#ef4444",
      color: "white",
      padding: "1px 5px",
      borderRadius: 99,
      fontWeight: 700
    }
  }, n.badge))), /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: "auto",
      paddingTop: 12,
      borderTop: `1px solid ${T.border}`
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      gap: 7,
      padding: "8px 10px",
      borderRadius: 8,
      background: T.surface2,
      marginBottom: 6
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 11
    }
  }, "\uD83D\uDCCD"), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: {
      color: T.text,
      fontSize: 11,
      fontWeight: 600
    }
  }, "Sippy Downs"), /*#__PURE__*/React.createElement("div", {
    style: {
      color: T.muted,
      fontSize: 9
    }
  }, "Fitstop Sippy Downs"))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      gap: 7,
      padding: "8px 10px"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: 28,
      height: 28,
      borderRadius: "50%",
      background: T.accent,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      fontSize: 10,
      fontWeight: 700,
      color: "white",
      flexShrink: 0
    }
  }, "MS"), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: {
      color: T.text,
      fontSize: 11,
      fontWeight: 600
    }
  }, "Mic Smith"), /*#__PURE__*/React.createElement("div", {
    style: {
      color: T.muted,
      fontSize: 9
    }
  }, "Head Coach"))))), /*#__PURE__*/React.createElement("main", {
    style: {
      marginLeft: isMobile ? 0 : 188,
      flex: 1,
      display: "flex",
      flexDirection: "column",
      minWidth: 0
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      background: T.surface,
      borderBottom: `1px solid ${T.border}`,
      padding: "0 32px",
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 12,
      flexWrap: "wrap",
      position: "sticky",
      top: 0,
      zIndex: 20
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      padding: "16px 0"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontWeight: 700,
      fontSize: 19,
      color: T.text,
      letterSpacing: "-0.3px"
    }
  }, titles[tab] || tab), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 11,
      color: T.muted,
      marginTop: 1,
      fontFamily: "'DM Mono',monospace"
    }
  }, "5 May \u2013 9 Jun 2026 \xB7 159 members \xB7 calcs use completed weeks only")), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      gap: 8
    }
  }, /*#__PURE__*/React.createElement("select", {
    value: activeCoach,
    onChange: e => setActiveCoach(e.target.value),
    style: {
      background: T.surface2,
      border: `1px solid ${T.border}`,
      color: T.text,
      padding: "7px 14px",
      borderRadius: 8,
      fontFamily: "'DM Sans',sans-serif",
      fontSize: 12,
      fontWeight: 600,
      cursor: "pointer"
    }
  }, ["Sam", "Sally", "Meg", "Scotty"].map(c => /*#__PURE__*/React.createElement("option", {
    key: c,
    value: c
  }, "\uD83D\uDC64 ", c))), /*#__PURE__*/React.createElement("button", {
    style: {
      background: T.accent,
      border: "none",
      color: "white",
      padding: "7px 14px",
      borderRadius: 8,
      fontFamily: "'DM Sans',sans-serif",
      fontSize: 12,
      fontWeight: 600,
      cursor: "pointer"
    }
  }, "\u2193 Export"))), /*#__PURE__*/React.createElement("div", {
    style: {
      padding: "18px 32px",
      flex: 1,
      minWidth: 0
    }
  }, ["members", "suspensions", "departures"].includes(tab) && /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement(StatCards, {
    members: members,
    viewType: viewType
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      gap: 8,
      alignItems: "center",
      flexWrap: "wrap",
      marginBottom: 0,
      padding: "10px 0"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      position: "relative",
      flex: "1 1 160px",
      maxWidth: 260
    }
  }, /*#__PURE__*/React.createElement("input", {
    value: search,
    onChange: e => setSearch(e.target.value),
    placeholder: "Search members\u2026",
    style: {
      width: "100%",
      background: T.surface,
      border: `1px solid ${T.border}`,
      borderRadius: 8,
      padding: "8px 10px 8px 30px",
      color: T.text,
      fontFamily: "'DM Sans',sans-serif",
      fontSize: 13,
      outline: "none"
    }
  }), /*#__PURE__*/React.createElement("span", {
    style: {
      position: "absolute",
      left: 9,
      top: "50%",
      transform: "translateY(-50%)",
      color: T.muted,
      fontSize: 13
    }
  }, "\uD83D\uDD0D")), [{
    v: "all",
    l: "All"
  }, {
    v: "red",
    l: "🔴 At Risk"
  }, {
    v: "amber",
    l: "🟡 Watching"
  }, {
    v: "green",
    l: "🟢 On Track"
  }, {
    v: "suspended",
    l: "⏸️ Susp."
  }, {
    v: "cancelling",
    l: "🚪 Cancelling"
  }].map(f => /*#__PURE__*/React.createElement("button", {
    key: f.v,
    onClick: () => setFilterRisk(f.v),
    style: {
      fontSize: 11,
      padding: "7px 12px",
      borderRadius: 8,
      border: `1px solid ${filterRisk === f.v ? T.accent : T.border}`,
      background: filterRisk === f.v ? T.accent : "transparent",
      color: filterRisk === f.v ? "white" : T.muted,
      cursor: "pointer",
      fontWeight: 600,
      fontFamily: "'DM Sans',sans-serif",
      whiteSpace: "nowrap"
    }
  }, f.l)), /*#__PURE__*/React.createElement("select", {
    value: filterPkg,
    onChange: e => setFilterPkg(e.target.value),
    style: {
      fontSize: 11,
      padding: "7px 10px",
      borderRadius: 8,
      border: `1px solid ${T.border}`,
      fontFamily: "'DM Sans',sans-serif",
      color: T.muted,
      background: T.surface
    }
  }, /*#__PURE__*/React.createElement("option", {
    value: "all"
  }, "All Memberships"), pkgs.map(p => /*#__PURE__*/React.createElement("option", {
    key: p,
    value: p
  }, p))), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 12,
      color: T.muted,
      marginLeft: "auto",
      fontFamily: "'DM Mono',monospace"
    }
  }, filtered.length, " members")), tab === "members" && /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      gap: 0,
      borderBottom: `1px solid ${T.border}`,
      background: T.surface,
      borderRadius: "8px 8px 0 0",
      padding: "0 4px",
      overflowX: "auto",
      marginBottom: 0
    }
  }, TREND_TABS.map(t => /*#__PURE__*/React.createElement("button", {
    key: t.id,
    onClick: () => setTrendTab(t.id),
    style: {
      fontSize: 12,
      fontWeight: 600,
      padding: "11px 14px",
      border: "none",
      background: "none",
      cursor: "pointer",
      whiteSpace: "nowrap",
      borderBottom: trendTab === t.id ? `2px solid ${t.color || T.accent}` : "2px solid transparent",
      color: trendTab === t.id ? t.color || T.text : T.muted,
      marginBottom: -1,
      display: "flex",
      alignItems: "center",
      gap: 6,
      fontFamily: "'DM Sans',sans-serif"
    }
  }, t.label, /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 9,
      padding: "1px 7px",
      borderRadius: 99,
      background: trendTab === t.id ? t.color || T.accent : T.surface2,
      color: trendTab === t.id ? T.surface : "white",
      fontWeight: 700,
      fontFamily: "'DM Mono',monospace"
    }
  }, t.count)))), /*#__PURE__*/React.createElement("div", {
    style: {
      background: T.surface,
      borderRadius: tab === "members" ? "0 0 8px 8px" : "8px",
      border: `1px solid ${T.border}`,
      borderTop: tab === "members" ? "none" : `1px solid ${T.border}`,
      overflow: "hidden",
      marginTop: tab === "members" ? 0 : 8
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      overflowX: "auto"
    }
  }, /*#__PURE__*/React.createElement("table", {
    style: {
      width: "100%",
      borderCollapse: "separate",
      borderSpacing: "0 3px",
      padding: "0 8px 8px"
    }
  }, /*#__PURE__*/React.createElement("thead", null, /*#__PURE__*/React.createElement("tr", null, ["Member", "Status", "Pulse", viewType === "members" ? "4-Wk Total" : "Sessions", viewType === "members" ? "Week Dots" : "Pattern", viewType === "members" ? "Trend" : "Trend", viewType === "suspended" ? "Days to Return" : viewType === "departures" ? "Days to Cancel" : "Consistency", "Last Session", viewType === "suspended" ? "Action" : "Action / Risk", ""].map(h => /*#__PURE__*/React.createElement("th", {
    key: h,
    style: {
      textAlign: "left",
      fontSize: 10,
      fontWeight: 600,
      textTransform: "uppercase",
      letterSpacing: "0.8px",
      color: T.muted,
      padding: "8px 14px 6px"
    }
  }, h)))), /*#__PURE__*/React.createElement("tbody", null, filtered.map(m => /*#__PURE__*/React.createElement(Row, {
    key: m.id,
    m: m,
    onClick: setSelected,
    viewType: viewType
  })), filtered.length === 0 && /*#__PURE__*/React.createElement("tr", null, /*#__PURE__*/React.createElement("td", {
    colSpan: 10,
    style: {
      textAlign: "center",
      padding: 48,
      color: T.muted,
      fontSize: 14
    }
  }, "No members match this filter."))))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      gap: 14,
      alignItems: "center",
      padding: "8px 16px",
      borderTop: `1px solid ${T.border}`,
      flexWrap: "wrap"
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 9,
      color: T.muted,
      fontWeight: 600,
      letterSpacing: "0.08em",
      textTransform: "uppercase"
    }
  }, "Week dots:"), [{
    bg: T.greenText,
    l: "3+ sessions"
  }, {
    bg: T.orangeText,
    l: "1–2 sessions"
  }, {
    bg: T.surface2,
    l: "0 sessions"
  }, {
    bg: "stripes",
    l: "Suspended"
  }].map(l => /*#__PURE__*/React.createElement("div", {
    key: l.l,
    style: {
      display: "flex",
      alignItems: "center",
      gap: 4
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: 10,
      height: 10,
      borderRadius: 2,
      background: l.bg === "stripes" ? `repeating-linear-gradient(45deg,${T.greyText}55,${T.greyText}55 2px,${T.greyBg} 2px,${T.greyBg} 5px)` : l.bg,
      border: l.bg === "stripes" ? `1px solid ${T.greyBorder}` : "none"
    }
  }), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 9,
      color: T.muted
    }
  }, l.l))), /*#__PURE__*/React.createElement("span", {
    style: {
      marginLeft: "auto",
      fontSize: 11,
      color: T.muted,
      fontFamily: "'DM Mono',monospace"
    }
  }, "Showing ", filtered.length, " of ", base.length)), /*#__PURE__*/React.createElement("div", {
    style: {
      padding: "8px 16px 12px",
      borderTop: `1px solid ${T.border}`,
      display: "flex",
      gap: 4,
      alignItems: "center",
      justifyContent: "flex-end"
    }
  }, [1, 2, 3, 4, 5].map(p => /*#__PURE__*/React.createElement("button", {
    key: p,
    style: {
      width: 28,
      height: 28,
      borderRadius: 6,
      border: `1px solid ${p === 1 ? T.accent : T.border}`,
      background: p === 1 ? T.accent : "transparent",
      color: p === 1 ? "white" : T.muted,
      fontSize: 11,
      fontWeight: 600,
      cursor: "pointer",
      fontFamily: "'DM Mono',monospace"
    }
  }, p)), /*#__PURE__*/React.createElement("select", {
    style: {
      fontSize: 11,
      padding: "4px 8px",
      borderRadius: 6,
      border: `1px solid ${T.border}`,
      fontFamily: "'DM Mono',monospace",
      color: T.muted,
      background: T.surface,
      marginLeft: 8
    }
  }, /*#__PURE__*/React.createElement("option", null, "25/page"), /*#__PURE__*/React.createElement("option", null, "50/page"), /*#__PURE__*/React.createElement("option", null, "All"))))), tab === "today" ? /*#__PURE__*/React.createElement(TodayView, {
    coach: activeCoach
  }) : !["members", "suspensions", "departures", "today"].includes(tab) && /*#__PURE__*/React.createElement("div", {
    style: {
      background: T.surface,
      borderRadius: 10,
      border: `1px solid ${T.border}`,
      padding: 48,
      textAlign: "center"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 44,
      marginBottom: 12
    }
  }, tab === "dashboard" ? "🏠" : tab === "growth" ? "📈" : tab === "alerts" ? "🔔" : tab === "settings" ? "⚙️" : "📊"), /*#__PURE__*/React.createElement("div", {
    style: {
      fontWeight: 700,
      color: T.text,
      fontSize: 16,
      marginBottom: 6
    }
  }, titles[tab]), /*#__PURE__*/React.createElement("div", {
    style: {
      color: T.muted,
      fontSize: 12,
      maxWidth: 360,
      margin: "0 auto",
      lineHeight: 1.6
    }
  }, tab === "dashboard" ? "Gym overview — coming next." : tab === "settings" ? "Threshold settings — coming next." : tab === "alerts" ? "Auto alerts — coming next." : "Coming soon.")), " && (", /*#__PURE__*/React.createElement("div", {
    style: {
      background: T.surface,
      borderRadius: 10,
      border: `1px solid ${T.border}`,
      padding: 48,
      textAlign: "center"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 44,
      marginBottom: 12
    }
  }, tab === "dashboard" ? "🏠" : tab === "today" ? "⚡" : tab === "growth" ? "📈" : tab === "alerts" ? "🔔" : tab === "settings" ? "⚙️" : "📊"), /*#__PURE__*/React.createElement("div", {
    style: {
      fontWeight: 700,
      color: T.text,
      fontSize: 16,
      marginBottom: 6
    }
  }, titles[tab]), /*#__PURE__*/React.createElement("div", {
    style: {
      color: T.muted,
      fontSize: 12,
      maxWidth: 360,
      margin: "0 auto",
      lineHeight: 1.6
    }
  }, tab === "today" ? "Today's class schedule with live member risk per session — next build." : tab === "dashboard" ? "Gym overview: pulse score trend, health mix, key insights — next build." : tab === "settings" ? "Threshold settings per membership type, channel preferences — next build." : tab === "alerts" ? "Auto-generated alerts for disengaging, returning, and cancelling members — next build." : "Coming in the next stage.")), ")}"), /*#__PURE__*/React.createElement("div", {
    style: {
      textAlign: "center",
      padding: 16,
      fontSize: 11,
      color: T.muted,
      borderTop: `1px solid ${T.border}`
    }
  }, "\uD83D\uDFE2 On Track \xA0\xB7\xA0 \uD83D\uDFE1 Watching \xA0\xB7\xA0 \uD83D\uDD34 At Risk \xA0\xB7\xA0 \u26A0 Disengaging \xA0\xB7\xA0 \u23F8 Suspended \xA0\xB7\xA0 \uD83D\uDEAA Cancelling \xA0\xB7\xA0 Dashed dot = this week so far (not counted)")), selected && /*#__PURE__*/React.createElement(Drawer, {
    m: selected,
    onClose: () => setSelected(null)
  }), isMobile && /*#__PURE__*/React.createElement("nav", {
    style: {
      position: "fixed",
      bottom: 0,
      left: 0,
      right: 0,
      background: T.surface,
      display: "flex",
      justifyContent: "space-around",
      padding: "8px 0 14px",
      zIndex: 30,
      borderTop: `1px solid ${T.border}`
    }
  }, [{
    id: "members",
    icon: "👥",
    l: "Members"
  }, {
    id: "suspensions",
    icon: "⏸️",
    l: "Suspended"
  }, {
    id: "departures",
    icon: "🚪",
    l: "Departures"
  }, {
    id: "today",
    icon: "⚡",
    l: "Today"
  }, {
    id: "alerts",
    icon: "🔔",
    l: "Alerts"
  }].map(n => /*#__PURE__*/React.createElement("button", {
    key: n.id,
    onClick: () => setTab(n.id),
    style: {
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      gap: 2,
      border: "none",
      background: "none",
      cursor: "pointer",
      color: tab === n.id ? "white" : T.muted,
      padding: "2px 8px",
      fontFamily: "'DM Sans',sans-serif"
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 19
    }
  }, n.icon), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 9,
      fontWeight: tab === n.id ? 700 : 400
    }
  }, n.l)))));
}

// Global export
window.PulseCheck = PulseCheck;
