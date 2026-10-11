// Inline stroke icons (no icon dependency). currentColor so tokens apply.
const P = { fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
export const Icon = {
  home: () => (<svg viewBox="0 0 24 24" {...P} aria-hidden="true"><path d="M3 11.5 12 4l9 7.5" /><path d="M5 10v10h14V10" /></svg>),
  students: () => (<svg viewBox="0 0 24 24" {...P} aria-hidden="true"><circle cx="9" cy="8" r="3.2" /><path d="M2.5 20c.8-3.6 3.4-5.5 6.5-5.5s5.7 1.9 6.5 5.5" /><circle cx="17.5" cy="9" r="2.5" /><path d="M16 14.6c2.6.2 4.6 1.9 5.3 4.9" /></svg>),
  upload: () => (<svg viewBox="0 0 24 24" {...P} aria-hidden="true"><path d="M12 16V4" /><path d="m7 9 5-5 5 5" /><path d="M4 16v4h16v-4" /></svg>),
  masters: () => (<svg viewBox="0 0 24 24" {...P} aria-hidden="true"><rect x="3.5" y="4" width="17" height="16" rx="2.5" /><path d="M3.5 9h17M9 9v11" /></svg>),
  ontology: () => (<svg viewBox="0 0 24 24" {...P} aria-hidden="true"><circle cx="12" cy="5" r="2.2" /><circle cx="5" cy="18" r="2.2" /><circle cx="19" cy="18" r="2.2" /><circle cx="12" cy="13" r="2.2" /><path d="M12 7.2v3.6M10.3 14.4 6.6 16.6M13.7 14.4l3.7 2.2" /></svg>),
  bin: () => (<svg viewBox="0 0 24 24" {...P} aria-hidden="true"><path d="M4 7h16M9 7V4.5h6V7M6 7l1 13h10l1-13" /></svg>),
  audit: () => (<svg viewBox="0 0 24 24" {...P} aria-hidden="true"><path d="M6 3.5h9l3 3V20.5H6z" /><path d="M9 11h6M9 15h6M9 7h3" /></svg>),
  admins: () => (<svg viewBox="0 0 24 24" {...P} aria-hidden="true"><path d="M12 3 4.5 6v5.5c0 4.5 3.2 8 7.5 9.5 4.3-1.5 7.5-5 7.5-9.5V6z" /><path d="m9 12 2 2 4-4" /></svg>),
  account: () => (<svg viewBox="0 0 24 24" {...P} aria-hidden="true"><circle cx="12" cy="8.5" r="3.5" /><path d="M5 20c1-3.8 3.7-5.7 7-5.7s6 1.9 7 5.7" /></svg>),
  attendance: () => (<svg viewBox="0 0 24 24" {...P} aria-hidden="true"><rect x="3.5" y="5" width="17" height="15" rx="2.5" /><path d="M3.5 10h17M8 3v4M16 3v4M9 15l2 2 4-4" /></svg>),
  insights: () => (<svg viewBox="0 0 24 24" {...P} aria-hidden="true"><path d="M4 20V10M10 20V4M16 20v-7M22 20H2" /></svg>),
  help: () => (<svg viewBox="0 0 24 24" {...P} aria-hidden="true"><circle cx="12" cy="12" r="9" /><path d="M9.6 9.3a2.5 2.5 0 1 1 3.4 2.3c-.6.3-1 .8-1 1.5v.6" /><path d="M12 17h.01" /></svg>),
  logout: () => (<svg viewBox="0 0 24 24" {...P} aria-hidden="true"><path d="M15 4h4v16h-4M10 16l-4-4 4-4M6 12h10" /></svg>),
};
