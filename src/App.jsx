import { useState, useRef, useEffect } from "react";

// ─── SYSTEM PROMPTS ────────────────────────────────────────────────────────────

const DIAGNOSIS_SYSTEM = (brandData) => `You are a senior Meta ads creative strategist with deep expertise in diagnosing ad performance and making data-driven creative decisions. You use the frameworks of Dara Denney, Chase Chapel, Alysha (alyshafrommotion), and the GBP method.

You have been given the following brand strategy document:

═══════════════════════════════
BRAND STRATEGY
═══════════════════════════════
${brandData}
═══════════════════════════════

YOUR DIAGNOSIS FRAMEWORK:
Read metrics in this exact order — sequence matters:

1. HOOK RATE (3-sec views ÷ impressions)
   - Below 20%: Critical — first 3 seconds not stopping scroll. Problem is the hook itself (text, visual, or pattern interrupt)
   - 20–30%: Average — room to improve
   - Above 30%: Strong — creative is stopping scroll
   - Above 40%: Exceptional

2. HOLD RATE (15-sec views ÷ impressions OR % who watched full video if under 15s)
   - Below 10%: Critical — losing people after the hook. Body isn't delivering on the promise
   - 10–20%: Average
   - Above 20%: Strong retention

3. UNIQUE OUTBOUND CTR
   - Below 0.5%: Low — message resonates but not driving action, or wrong audience
   - 0.5–1.5%: Average
   - Above 1.5%: Strong

4. CPA (Cost Per Acquisition/Purchase)
   - Always compare to brand's target CPA
   - This is the final verdict — everything above explains why

5. ROAS
   - Below 1.5: Losing money
   - 1.5–2.5: Breaking even / marginal
   - Above 2.5: Profitable
   - Above 4: Scale aggressively

6. CPM — high CPM means expensive delivery, often signals wrong audience signal or low relevance score
7. FREQUENCY — above 3–4 in 7 days = audience fatigue, creative needs refreshing

THE 5-LINK CHAIN:
Hook Rate → Hold Rate → CTR → Conversion Rate → CPA
If any link breaks, diagnose THAT link before moving further down.

QUALITATIVE ANALYSIS (always include):
- Format type (UGC, static, founder, testimonial)
- Messaging angle used (which awareness level was it targeting)
- Creator/talent notes
- Production quality signals
- What the winning ads have in common vs losing ads

THREE SCENARIOS:
A) No winners at all → wrong message, wrong format, or wrong audience. Diagnose which.
B) One/two winners, some losers → protect the winner, iterate on ONE variable at a time, develop next concept simultaneously
C) Strong winner with good CPA → add one layer of complexity at a time, never two simultaneously

YOUR OUTPUT FORMAT:
Always structure your diagnosis as:
1. THE VERDICT (2-3 sentences — what is actually happening)
2. THE CHAIN DIAGNOSIS (go through each metric in order, explain what it means)
3. WHAT BROKE (the specific link in the chain that failed first)
4. THE DECISION (exactly what to do next — specific and actionable)
5. NEXT BATCH DIRECTION (what this data tells you about what to test next, connected to the brand strategy)

Use the brand's actual customer language and personas from the strategy doc when making recommendations. Be direct. Be specific. Never vague.`;

const CREATIVE_SYSTEM = (brandData, userInput) => `You are a senior Meta ads creative strategist. You are building a complete creative batch for a brand using every framework available to you.

BRAND STRATEGY DOCUMENT:
═══════════════════════════════
${brandData}
═══════════════════════════════

${userInput ? `ADDITIONAL CONTEXT FROM STRATEGIST:\n${userInput}\n═══════════════════════════════` : ''}

YOUR FRAMEWORKS TO APPLY:

ALYSHA'S CREATIVE STRATEGY ENGINE:
- Primary Organising Principle: Pain-First (actively searching for solution) vs Desire-First (drawn to identity/aspiration)
- Map pain/desire to specific personas from the strategy doc
- Generate angles at every intersection: Desired Outcome, Objections, Features/Benefits, Use Case, Consequences, Misconceptions, Education, Acceptance, Failed Solutions, Identity
- The Aha Moment: the single sentence where viewer shifts from "interesting" to "this is exactly what I needed"

5 LEVELS OF AWARENESS (Eugene Schwartz):
- Unaware: doesn't know they have the problem
- Problem Aware: knows the problem, not the solution
- Solution Aware: exploring different solutions
- Product Aware: evaluating your product vs others
- Most Aware: ready to buy, needs final push

CARA HOYT'S 10 HOOK FORMULAS:
1. Tribal Identity — "If you [identity marker]..."
2. Investment Hook — "I spent X on Y and here's what I learned"
3. Why Did No One Tell Me — "Nobody talks about..."
4. Problem-First — lead with the pain before the product
5. POV Hook — "POV: You finally found..."
6. Emotional Trigger — direct emotional activation
7. Give Me Time — "In 30 seconds I'll show you..."
8. Founder Intro — personal story, why this exists
9. Creator Partnership — third party credibility
10. Golden Nugget — lead with the most compelling fact/insight

THREE HOOK TYPES (always layer all three):
- TEXT HOOK: the opening line — use customer's ACTUAL language from the language bank
- VISUAL HOOK: what appears in opening frame — pattern interrupt, recognition, curiosity
- AUDIO/VERBAL HOOK: what they hear — tone, pacing, first words spoken

STACKING RULE: Visual sets scene → Text names the specific thing → Audio confirms with personality. Never repeat the same information across layers.

GBP METHOD:
- GUT (0-3s): Hook + visual payoff — stop scroll with recognition or curiosity
- BRAIN A (3-8s): Mechanism + proof — what it is and why it works
- BRAIN B (8-15s): Handle 3 macro objections (Time frame, Personal features, Effort required, Sophistication, Geolocation, History/track record)
- POCKET (final 3-7s): CTA — specific and direct

META FUNNEL STRUCTURE:
- TOP OF FUNNEL: Founder story, viral UGC, problem-solution, value education, facts/stats → Learn More / Shop Now CTAs
- MIDDLE OF FUNNEL: Reviews, before/after, comparisons, demos, social proof → Shop Now CTAs (targeting video viewers, engagers, website visitors)
- BOTTOM OF FUNNEL: Special offers, urgency, "still interested", direct asks → Get Offer / Shop Now CTAs (targeting add-to-cart, past purchasers)

FORMAT TYPES:
Videos: UGC talking head, founder story, testimonial, problem-solution, educational, before/after, demo, duet/stitch, street interview, ASMR, skit
Statics: Benefit callout, us vs them, headline, testimonial quote, before/after, product shot, uglyad

OUTPUT FORMAT — produce a complete structured creative batch:

## BRAND CREATIVE SYSTEM
[Quick summary of the primary organising principle and which persona we're building for]

## CREATIVE BATCH — [BATCH NAME]

For each concept, use this structure:
### CONCEPT [N] — [NAME]
**Persona:** [which persona from the strategy doc]
**Funnel Stage:** [TOF/MOF/BOF]
**Awareness Level:** [Unaware/Problem Aware/Solution Aware/Product Aware/Most Aware]
**Angle:** [from Alysha's framework — which intersection]
**Format:** [specific format type]
**Primary Organising Principle:** [Pain-First or Desire-First]

**TEXT HOOK:** [exact hook using customer language from language bank]
**VISUAL HOOK:** [what opens in frame — specific, not vague]
**AUDIO HOOK:** [first words spoken and tone]

**AHA MOMENT:** [the single sentence that makes them say "this is exactly what I needed"]

**GBP STRUCTURE:**
- GUT (0-3s): [specific]
- BRAIN A (3-8s): [specific]  
- BRAIN B (8-15s): [which 3 objections and how addressed]
- POCKET: [exact CTA]

**WHY THIS WORKS:** [1-2 sentences connecting back to strategy and customer language]

---

Always produce minimum 6 concepts per batch. Vary personas, funnel stages, awareness levels, formats and angles. Use the ACTUAL customer language from the language bank — not generic copy. Every concept must trace back to the strategy document.`;

// ─── MAIN APP ──────────────────────────────────────────────────────────────────

export default function CreativeRoom() {
  const [screen, setScreen] = useState("landing");
  const [brandData, setBrandData] = useState("");
  const [brandName, setBrandName] = useState("");
  const [mode, setMode] = useState(null); // "diagnose" | "create"
  const [activePersona, setActivePersona] = useState(null);
  const [activeAngle, setActiveAngle] = useState(null);
  const [metrics, setMetrics] = useState({
    spent: "", purchases: "", cpa: "", roas: "",
    hookRate: "", holdRate: "", ctr: "", cpc: "",
    cpm: "", frequency: "", reach: "", impressions: "",
    format: "", angle: "", creator: "", production: "", notes: ""
  });
  const [userIdeas, setUserIdeas] = useState("");
  const [output, setOutput] = useState("");
  const [loading, setLoading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState("idle");
  const outputRef = useRef(null);
  const fileRef = useRef(null);

  useEffect(() => {
    if (output && outputRef.current) {
      outputRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [output]);

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setUploadStatus("reading");
    try {
      const text = await file.text();
      setBrandData(text);
      // Try to extract brand name from first line
      const firstLine = text.split("\n").find(l => l.trim());
      const name = firstLine?.replace(/[#*_]/g, "").trim().split("—")[0].split("|")[0].trim() || file.name.replace(/\.[^.]+$/, "");
      setBrandName(name);
      setUploadStatus("done");
    } catch {
      setUploadStatus("error");
    }
  };

  const runDiagnosis = async () => {
    if (!brandData || loading) return;
    setLoading(true);
    setOutput("");

    const metricsText = `
CAMPAIGN METRICS:
- Amount Spent: ${metrics.spent || "Not provided"}
- Purchases: ${metrics.purchases || "Not provided"}
- Cost Per Purchase (CPA): ${metrics.cpa || "Not provided"}
- ROAS: ${metrics.roas || "Not provided"}
- Hook Rate: ${metrics.hookRate || "Not provided"}%
- Hold Rate: ${metrics.holdRate || "Not provided"}%
- Unique Outbound CTR: ${metrics.ctr || "Not provided"}%
- Cost Per Link Click: ${metrics.cpc || "Not provided"}
- CPM: ${metrics.cpm || "Not provided"}
- Frequency: ${metrics.frequency || "Not provided"}
- Reach: ${metrics.reach || "Not provided"}
- Impressions: ${metrics.impressions || "Not provided"}

QUALITATIVE NOTES:
- Ad Format: ${metrics.format || "Not provided"}
- Messaging Angle Used: ${metrics.angle || "Not provided"}
- Creator/Talent Notes: ${metrics.creator || "Not provided"}
- Production Quality: ${metrics.production || "Not provided"}
- Additional Observations: ${metrics.notes || "Not provided"}
${activePersona ? `- Persona This Ad Was Built For: ${activePersona}` : ""}
${activeAngle ? `- Angle Tested: ${activeAngle}` : ""}`;

    try {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 2000,
          system: DIAGNOSIS_SYSTEM(brandData),
          messages: [{ role: "user", content: `Diagnose this Meta ads campaign data and tell me exactly what it means and what to do next:\n\n${metricsText}` }]
        })
      });
      const data = await res.json();
      setOutput(data.content?.[0]?.text || "Something went wrong. Try again.");
    } catch {
      setOutput("Connection error. Check your network and try again.");
    }
    setLoading(false);
  };

  const runCreative = async () => {
    if (!brandData || loading) return;
    setLoading(true);
    setOutput("");

    const context = `
${activePersona ? `TARGET PERSONA: ${activePersona}` : "Use all personas from the strategy doc, prioritising the core customer"}
${activeAngle ? `FOCUS ANGLE: ${activeAngle}` : "Generate diverse angles across all intersections"}
${userIdeas ? `STRATEGIST'S ADDITIONAL IDEAS & OBSERVATIONS:\n${userIdeas}` : ""}`;

    try {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 3000,
          system: CREATIVE_SYSTEM(brandData, context),
          messages: [{ role: "user", content: "Generate a complete creative batch for this brand using all frameworks. Make it specific to this brand's actual customer language and strategy — not generic." }]
        })
      });
      const data = await res.json();
      setOutput(data.content?.[0]?.text || "Something went wrong. Try again.");
    } catch {
      setOutput("Connection error. Check your network and try again.");
    }
    setLoading(false);
  };

  if (screen === "landing") return <Landing onEnter={() => setScreen("upload")} />;
  if (screen === "upload") return (
    <Upload
      fileRef={fileRef}
      uploadStatus={uploadStatus}
      brandName={brandName}
      brandData={brandData}
      onUpload={handleFileUpload}
      onManual={(text) => { setBrandData(text); setBrandName("Your Brand"); setUploadStatus("done"); }}
      onContinue={() => setScreen("hub")}
    />
  );

  return (
    <div style={s.app}>
      {/* Top bar */}
      <div style={s.topbar}>
        <div style={s.topbarLeft}>
          <div style={s.logo}>CR</div>
          <div>
            <div style={s.topbarTitle}>The Creative Room</div>
            <div style={s.topbarSub}>{brandName} · Meta Ads Intelligence</div>
          </div>
        </div>
        <div style={s.topbarRight}>
          <button onClick={() => { setMode("diagnose"); setOutput(""); }} style={{ ...s.modeBtn, ...(mode === "diagnose" ? s.modeBtnActive : {}) }}>
            📊 Diagnose Data
          </button>
          <button onClick={() => { setMode("create"); setOutput(""); }} style={{ ...s.modeBtn, ...(mode === "create" ? s.modeBtnActiveGreen : {}) }}>
            ✦ Generate Creative
          </button>
          <button onClick={() => { setScreen("upload"); setUploadStatus("idle"); setBrandData(""); }} style={s.switchBtn}>
            Switch Brand
          </button>
        </div>
      </div>

      {/* Main */}
      <div style={s.main}>
        {!mode && <ModeSelect onSelect={setMode} brandName={brandName} />}

        {mode === "diagnose" && (
          <DiagnosePanel
            metrics={metrics}
            setMetrics={setMetrics}
            activePersona={activePersona}
            setActivePersona={setActivePersona}
            activeAngle={activeAngle}
            setActiveAngle={setActiveAngle}
            brandData={brandData}
            onRun={runDiagnosis}
            loading={loading}
          />
        )}

        {mode === "create" && (
          <CreatePanel
            activePersona={activePersona}
            setActivePersona={setActivePersona}
            activeAngle={activeAngle}
            setActiveAngle={setActiveAngle}
            userIdeas={userIdeas}
            setUserIdeas={setUserIdeas}
            brandData={brandData}
            onRun={runCreative}
            loading={loading}
          />
        )}

        {/* Output */}
        {(loading || output) && (
          <div ref={outputRef} style={s.outputSection}>
            <div style={s.outputHeader}>
              <div style={s.outputDot} />
              <span style={s.outputLabel}>{mode === "diagnose" ? "DIAGNOSIS" : "CREATIVE BATCH"}</span>
            </div>
            {loading ? (
              <div style={s.loadingBox}>
                <div style={s.loadingDots}>
                  {[0,1,2].map(i => <span key={i} style={{ ...s.dot, animationDelay: `${i*0.2}s` }} />)}
                </div>
                <div style={s.loadingText}>{mode === "diagnose" ? "Diagnosing your campaign data..." : "Building your creative batch..."}</div>
              </div>
            ) : (
              <div style={s.outputContent}>
                <OutputRenderer content={output} />
                <button onClick={() => { navigator.clipboard.writeText(output); }} style={s.copyBtn}>
                  Copy Output
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      <style>{`
        @keyframes dotPulse { 0%,100%{opacity:.2;transform:scale(.7)} 50%{opacity:1;transform:scale(1)} }
        @keyframes fadeUp { from{opacity:0;transform:translateY(12px)} to{opacity:1;transform:translateY(0)} }
        * { box-sizing:border-box; margin:0; padding:0; }
        body { background:#07070f; }
        ::-webkit-scrollbar { width:3px; }
        ::-webkit-scrollbar-track { background:#07070f; }
        ::-webkit-scrollbar-thumb { background:#1e1e2a; border-radius:2px; }
        textarea::placeholder, input::placeholder { color:#252535; }
        input:focus, textarea:focus, select:focus { outline:none; }
      `}</style>
    </div>
  );
}

// ─── OUTPUT RENDERER ──────────────────────────────────────────────────────────
function OutputRenderer({ content }) {
  const lines = content.split("\n");
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      {lines.map((line, i) => {
        if (line.startsWith("## ")) return <div key={i} style={s.outH2}>{line.replace("## ", "")}</div>;
        if (line.startsWith("### ")) return <div key={i} style={s.outH3}>{line.replace("### ", "")}</div>;
        if (line.startsWith("**") && line.endsWith("**")) return <div key={i} style={s.outBold}>{line.replace(/\*\*/g, "")}</div>;
        if (line.startsWith("- ") || line.startsWith("* ")) return <div key={i} style={s.outBullet}>· {line.slice(2)}</div>;
        if (line.startsWith("**") && line.includes(":**")) {
          const [label, ...rest] = line.split(":**");
          return <div key={i} style={s.outField}><span style={s.outFieldLabel}>{label.replace(/\*\*/g, "")}:</span> {rest.join(":").replace(/\*\*/g, "")}</div>;
        }
        if (line === "---") return <div key={i} style={s.outDivider} />;
        if (line.trim() === "") return <div key={i} style={{ height: 8 }} />;
        return <div key={i} style={s.outBody}>{line.replace(/\*\*/g, "").replace(/\*/g, "")}</div>;
      })}
    </div>
  );
}

// ─── LANDING ──────────────────────────────────────────────────────────────────
function Landing({ onEnter }) {
  return (
    <div style={{ minHeight: "100vh", background: "#07070f", display: "flex", alignItems: "center", justifyContent: "center", padding: 24, fontFamily: "'Palatino Linotype', serif" }}>
      <div style={{ maxWidth: 580, width: "100%", textAlign: "center" }}>
        <div style={{ fontSize: 10, letterSpacing: 8, color: "#7c6aff", fontFamily: "monospace", textTransform: "uppercase", marginBottom: 48 }}>
          Meta Ads Intelligence System
        </div>
        <div style={{ width: 64, height: 64, background: "linear-gradient(135deg,#7c6aff,#4a3aaa)", borderRadius: 18, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, color: "#fff", fontFamily: "monospace", fontWeight: "bold", margin: "0 auto 32px", boxShadow: "0 8px 40px rgba(124,106,255,.3)" }}>CR</div>
        <h1 style={{ fontSize: 54, color: "#f0eeff", fontWeight: "normal", lineHeight: 1.1, marginBottom: 20 }}>
          The Creative<br />Room
        </h1>
        <p style={{ color: "#444", fontSize: 16, lineHeight: 1.9, marginBottom: 52, maxWidth: 420, margin: "0 auto 52px" }}>
          Upload your brand strategy. Diagnose your Meta ads data. Generate your next creative batch. Built on every framework that moves the needle.
        </p>
        <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 52, maxWidth: 400, margin: "0 auto 52px" }}>
          {[
            ["📊", "Data diagnosis — know exactly what broke and why"],
            ["✦", "Creative generation — hooks, angles, formats, full GBP"],
            ["👤", "Persona-driven — every concept tied to a real human"],
            ["🔁", "Living system — grows with every brand you run"],
          ].map(([icon, text], i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 14, textAlign: "left", padding: "10px 16px", background: "#0d0d18", borderRadius: 10, border: "1px solid #141428" }}>
              <span style={{ fontSize: 16 }}>{icon}</span>
              <span style={{ color: "#3a3a5a", fontSize: 13 }}>{text}</span>
            </div>
          ))}
        </div>
        <button onClick={onEnter} style={{ background: "linear-gradient(135deg,#7c6aff,#4a3aaa)", border: "none", borderRadius: 12, padding: "18px 52px", color: "#fff", fontSize: 16, fontFamily: "inherit", cursor: "pointer", letterSpacing: 1, boxShadow: "0 8px 40px rgba(124,106,255,.25)" }}
          onMouseEnter={e => e.currentTarget.style.boxShadow = "0 12px 50px rgba(124,106,255,.4)"}
          onMouseLeave={e => e.currentTarget.style.boxShadow = "0 8px 40px rgba(124,106,255,.25)"}>
          Enter The Room →
        </button>
      </div>
    </div>
  );
}

// ─── UPLOAD ───────────────────────────────────────────────────────────────────
function Upload({ fileRef, uploadStatus, brandName, brandData, onUpload, onManual, onContinue }) {
  const [manualText, setManualText] = useState("");
  return (
    <div style={{ minHeight: "100vh", background: "#07070f", display: "flex", alignItems: "center", justifyContent: "center", padding: 24, fontFamily: "'Palatino Linotype', serif" }}>
      <div style={{ maxWidth: 600, width: "100%" }}>
        <div style={{ fontSize: 10, letterSpacing: 6, color: "#7c6aff", fontFamily: "monospace", marginBottom: 32 }}>STEP 1 — LOAD BRAND STRATEGY</div>
        <h2 style={{ fontSize: 38, color: "#f0eeff", fontWeight: "normal", marginBottom: 12 }}>Which brand are we working on?</h2>
        <p style={{ color: "#444", fontSize: 15, lineHeight: 1.7, marginBottom: 36 }}>
          Upload the strategy document from your Creative Strategy Session app. The Creative Room will use everything inside it.
        </p>

        <div
          onClick={() => fileRef.current?.click()}
          style={{ border: "2px dashed #1e1e30", borderRadius: 14, padding: "40px 32px", textAlign: "center", cursor: "pointer", marginBottom: 20, transition: "all .2s", background: uploadStatus === "done" ? "#0a0a18" : "transparent" }}
          onMouseEnter={e => e.currentTarget.style.borderColor = "#7c6aff"}
          onMouseLeave={e => e.currentTarget.style.borderColor = uploadStatus === "done" ? "#7c6aff33" : "#1e1e30"}
        >
          <input ref={fileRef} type="file" accept=".txt,.md,.doc,.docx" onChange={onUpload} style={{ display: "none" }} />
          {uploadStatus === "idle" && <>
            <div style={{ fontSize: 32, marginBottom: 12 }}>📄</div>
            <div style={{ color: "#555", fontSize: 14 }}>Click to upload your strategy document</div>
            <div style={{ color: "#2a2a3a", fontSize: 11, fontFamily: "monospace", marginTop: 8 }}>.txt · .md · .doc · .docx</div>
          </>}
          {uploadStatus === "reading" && <div style={{ color: "#7c6aff", fontSize: 14, fontFamily: "monospace" }}>Reading strategy document...</div>}
          {uploadStatus === "done" && <>
            <div style={{ color: "#4a8a4a", fontSize: 11, fontFamily: "monospace", letterSpacing: 2, marginBottom: 8 }}>● LOADED</div>
            <div style={{ color: "#c8c0ff", fontSize: 16 }}>{brandName}</div>
            <div style={{ color: "#333", fontSize: 11, marginTop: 6 }}>{brandData.length.toLocaleString()} characters read</div>
          </>}
          {uploadStatus === "error" && <div style={{ color: "#c06060", fontSize: 14 }}>Couldn't read that file. Try pasting below.</div>}
        </div>

        <div style={{ color: "#252535", fontSize: 11, fontFamily: "monospace", marginBottom: 10, letterSpacing: 1 }}>OR PASTE STRATEGY NOTES MANUALLY</div>
        <textarea
          value={manualText}
          onChange={e => setManualText(e.target.value)}
          placeholder="Paste your brand strategy here — brand name, core customer, language bank, unique mechanism, competitors, everything..."
          rows={5}
          style={{ width: "100%", background: "#0d0d18", border: "1px solid #1a1a28", borderRadius: 12, padding: "14px 18px", color: "#888", fontSize: 13, fontFamily: "monospace", resize: "vertical", lineHeight: 1.6 }}
          onFocus={e => e.target.style.borderColor = "#7c6aff"}
          onBlur={e => e.target.style.borderColor = "#1a1a28"}
        />
        {manualText.trim() && (
          <button onClick={() => onManual(manualText)} style={{ marginTop: 10, background: "#1a1a28", border: "1px solid #7c6aff44", borderRadius: 10, padding: "10px 20px", color: "#7c6aff", fontSize: 13, fontFamily: "monospace", cursor: "pointer" }}>
            Use This Text →
          </button>
        )}

        {uploadStatus === "done" && (
          <button onClick={onContinue} style={{ width: "100%", marginTop: 24, background: "linear-gradient(135deg,#7c6aff,#4a3aaa)", border: "none", borderRadius: 12, padding: "18px", color: "#fff", fontSize: 17, fontFamily: "inherit", cursor: "pointer", letterSpacing: 1, boxShadow: "0 8px 40px rgba(124,106,255,.25)" }}
            onMouseEnter={e => e.currentTarget.style.boxShadow = "0 12px 50px rgba(124,106,255,.4)"}
            onMouseLeave={e => e.currentTarget.style.boxShadow = "0 8px 40px rgba(124,106,255,.25)"}>
            Enter The Creative Room with {brandName} →
          </button>
        )}
      </div>
    </div>
  );
}

// ─── MODE SELECT ──────────────────────────────────────────────────────────────
function ModeSelect({ onSelect, brandName }) {
  return (
    <div style={{ maxWidth: 700, margin: "60px auto", padding: "0 24px", fontFamily: "'Palatino Linotype', serif", animation: "fadeUp .4s ease" }}>
      <div style={{ fontSize: 11, letterSpacing: 4, color: "#7c6aff", fontFamily: "monospace", marginBottom: 16 }}>WELCOME BACK</div>
      <h2 style={{ fontSize: 36, color: "#f0eeff", fontWeight: "normal", marginBottom: 8 }}>{brandName}</h2>
      <p style={{ color: "#444", fontSize: 15, marginBottom: 48 }}>What are we doing today?</p>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        <ModeCard
          icon="📊"
          title="Diagnose Data"
          desc="You have Meta Ads Manager numbers. Find out exactly what they mean, what broke, and what to do next."
          accent="#d4a853"
          onClick={() => onSelect("diagnose")}
        />
        <ModeCard
          icon="✦"
          title="Generate Creative"
          desc="Build a full creative batch — hooks, angles, formats, GBP structure — all tied to your brand strategy and customer language."
          accent="#7c6aff"
          onClick={() => onSelect("create")}
        />
      </div>
    </div>
  );
}

function ModeCard({ icon, title, desc, accent, onClick }) {
  const [hover, setHover] = useState(false);
  return (
    <div onClick={onClick} onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}
      style={{ background: hover ? "#0f0f1e" : "#0a0a16", border: `1px solid ${hover ? accent + "44" : "#141428"}`, borderRadius: 16, padding: "28px 24px", cursor: "pointer", transition: "all .2s" }}>
      <div style={{ fontSize: 28, marginBottom: 14 }}>{icon}</div>
      <div style={{ color: accent, fontSize: 13, fontFamily: "monospace", letterSpacing: 1, marginBottom: 8 }}>{title.toUpperCase()}</div>
      <div style={{ color: "#555", fontSize: 13, lineHeight: 1.7 }}>{desc}</div>
    </div>
  );
}

// ─── DIAGNOSE PANEL ───────────────────────────────────────────────────────────
function DiagnosePanel({ metrics, setMetrics, activePersona, setActivePersona, activeAngle, setActiveAngle, brandData, onRun, loading }) {
  const up = (k, v) => setMetrics(p => ({ ...p, [k]: v }));

  const personas = extractPersonas(brandData);
  const angles = ["Identity/Nostalgia", "Problem-First", "Pain-First", "Desire-First", "Social Proof", "Authority/Education", "Tribal Identity", "Founder Story", "Safety/Trust", "Competitor Comparison"];

  return (
    <div style={{ maxWidth: 820, margin: "32px auto", padding: "0 24px", animation: "fadeUp .3s ease" }}>
      <div style={s.panelHeader}>
        <div style={s.panelIcon}>📊</div>
        <div>
          <div style={s.panelTitle}>Diagnose Your Data</div>
          <div style={s.panelSub}>Enter your Meta Ads Manager numbers. The more you fill in, the sharper the diagnosis.</div>
        </div>
      </div>

      {/* Persona + Angle selectors */}
      <div style={s.selectorRow}>
        <div style={s.selectorGroup}>
          <div style={s.selectorLabel}>WHICH PERSONA WAS THIS AD FOR?</div>
          <div style={s.pills}>
            <Pill label="All / Not sure" active={!activePersona} onClick={() => setActivePersona(null)} accent="#7c6aff" />
            {personas.map(p => <Pill key={p} label={p} active={activePersona === p} onClick={() => setActivePersona(p)} accent="#d4a853" />)}
          </div>
        </div>
        <div style={s.selectorGroup}>
          <div style={s.selectorLabel}>WHICH ANGLE DID YOU TEST?</div>
          <div style={s.pills}>
            <Pill label="Not sure" active={!activeAngle} onClick={() => setActiveAngle(null)} accent="#7c6aff" />
            {angles.map(a => <Pill key={a} label={a} active={activeAngle === a} onClick={() => setActiveAngle(a)} accent="#c47c3e" />)}
          </div>
        </div>
      </div>

      {/* Primary KPIs */}
      <div style={s.section}>
        <div style={s.sectionTitle}>PRIMARY KPIs <span style={s.sectionNote}>— Is it working?</span></div>
        <div style={s.metricsGrid}>
          <MetricInput label="Amount Spent ($)" value={metrics.spent} onChange={v => up("spent", v)} placeholder="e.g. 450" />
          <MetricInput label="Purchases" value={metrics.purchases} onChange={v => up("purchases", v)} placeholder="e.g. 12" />
          <MetricInput label="Cost Per Purchase ($)" value={metrics.cpa} onChange={v => up("cpa", v)} placeholder="e.g. 37.50" />
          <MetricInput label="ROAS" value={metrics.roas} onChange={v => up("roas", v)} placeholder="e.g. 2.4" />
        </div>
      </div>

      {/* Video metrics */}
      <div style={s.section}>
        <div style={s.sectionTitle}>VIDEO METRICS <span style={s.sectionNote}>— Why is it working?</span></div>
        <div style={s.metricsGrid}>
          <MetricInput label="Hook Rate (%)" value={metrics.hookRate} onChange={v => up("hookRate", v)} placeholder="e.g. 28" hint="3-sec views ÷ impressions × 100" />
          <MetricInput label="Hold Rate (%)" value={metrics.holdRate} onChange={v => up("holdRate", v)} placeholder="e.g. 14" hint="15-sec views ÷ impressions × 100" />
          <MetricInput label="Unique Outbound CTR (%)" value={metrics.ctr} onChange={v => up("ctr", v)} placeholder="e.g. 0.8" />
          <MetricInput label="Cost Per Link Click ($)" value={metrics.cpc} onChange={v => up("cpc", v)} placeholder="e.g. 1.20" />
        </div>
      </div>

      {/* Delivery metrics */}
      <div style={s.section}>
        <div style={s.sectionTitle}>DELIVERY METRICS <span style={s.sectionNote}>— Who is seeing it?</span></div>
        <div style={s.metricsGrid}>
          <MetricInput label="CPM ($)" value={metrics.cpm} onChange={v => up("cpm", v)} placeholder="e.g. 18.50" />
          <MetricInput label="Frequency" value={metrics.frequency} onChange={v => up("frequency", v)} placeholder="e.g. 1.8" hint="Above 4–5 = audience fatigue" />
          <MetricInput label="Reach" value={metrics.reach} onChange={v => up("reach", v)} placeholder="e.g. 12400" />
          <MetricInput label="Impressions" value={metrics.impressions} onChange={v => up("impressions", v)} placeholder="e.g. 22300" />
        </div>
      </div>

      {/* Qualitative */}
      <div style={s.section}>
        <div style={s.sectionTitle}>QUALITATIVE NOTES <span style={s.sectionNote}>— Context behind the numbers</span></div>
        <div style={s.metricsGrid}>
          <MetricInput label="Ad Format" value={metrics.format} onChange={v => up("format", v)} placeholder="e.g. UGC talking head, static" />
          <MetricInput label="Messaging Angle Used" value={metrics.angle} onChange={v => up("angle", v)} placeholder="e.g. Identity/Nostalgia" />
          <MetricInput label="Creator Notes" value={metrics.creator} onChange={v => up("creator", v)} placeholder="e.g. Founder on camera, in car" />
          <MetricInput label="Production Quality" value={metrics.production} onChange={v => up("production", v)} placeholder="e.g. Raw UGC, high production" />
        </div>
        <textarea
          value={metrics.notes}
          onChange={e => up("notes", e.target.value)}
          placeholder="Anything else worth noting — comment sentiment, what you observed, what surprised you, what's working on other ads..."
          rows={3}
          style={s.textarea}
          onFocus={e => e.target.style.borderColor = "#d4a853"}
          onBlur={e => e.target.style.borderColor = "#1a1a28"}
        />
      </div>

      <button onClick={onRun} disabled={loading} style={{ ...s.runBtn, background: loading ? "#1a1a28" : "linear-gradient(135deg,#d4a853,#8b5e3c)" }}>
        {loading ? "Diagnosing..." : "Run Diagnosis →"}
      </button>
    </div>
  );
}

// ─── CREATE PANEL ─────────────────────────────────────────────────────────────
function CreatePanel({ activePersona, setActivePersona, activeAngle, setActiveAngle, userIdeas, setUserIdeas, brandData, onRun, loading }) {
  const personas = extractPersonas(brandData);
  const angles = [
    "Identity/Nostalgia (Tribal Identity)", "Problem-First", "Desire-First",
    "Safety/Trust (Lead-free, clean)", "Founder Story", "Authority/Education",
    "Competitor Comparison", "Social Proof (Reviews)", "Use Case Demo", "Failed Solutions"
  ];
  const funnelStages = ["Top of Funnel — New Audience", "Middle of Funnel — Warm Audience", "Bottom of Funnel — Hot/Retargeting"];
  const [funnelFocus, setFunnelFocus] = useState(null);

  return (
    <div style={{ maxWidth: 820, margin: "32px auto", padding: "0 24px", animation: "fadeUp .3s ease" }}>
      <div style={s.panelHeader}>
        <div style={{ ...s.panelIcon, background: "linear-gradient(135deg,#7c6aff,#4a3aaa)" }}>✦</div>
        <div>
          <div style={s.panelTitle}>Generate Creative Batch</div>
          <div style={s.panelSub}>Choose your focus. The Creative Room will build a full batch using your brand strategy, language bank, and all frameworks.</div>
        </div>
      </div>

      {/* Persona */}
      <div style={s.section}>
        <div style={s.sectionTitle}>WHICH PERSONA ARE WE BUILDING FOR?</div>
        <div style={s.pills}>
          <Pill label="All personas" active={!activePersona} onClick={() => setActivePersona(null)} accent="#7c6aff" />
          {personas.map(p => <Pill key={p} label={p} active={activePersona === p} onClick={() => setActivePersona(p)} accent="#7c6aff" />)}
        </div>
      </div>

      {/* Angle */}
      <div style={s.section}>
        <div style={s.sectionTitle}>WHICH ANGLE DO YOU WANT TO EXPLORE?</div>
        <div style={s.sectionNote2}>Leave blank to get diverse angles across all intersections</div>
        <div style={s.pills}>
          <Pill label="All angles" active={!activeAngle} onClick={() => setActiveAngle(null)} accent="#7c6aff" />
          {angles.map(a => <Pill key={a} label={a} active={activeAngle === a} onClick={() => setActiveAngle(a)} accent="#c47c3e" />)}
        </div>
      </div>

      {/* Funnel focus */}
      <div style={s.section}>
        <div style={s.sectionTitle}>FUNNEL STAGE FOCUS?</div>
        <div style={s.pills}>
          <Pill label="Full funnel mix" active={!funnelFocus} onClick={() => setFunnelFocus(null)} accent="#7c6aff" />
          {funnelStages.map(f => <Pill key={f} label={f} active={funnelFocus === f} onClick={() => setFunnelFocus(f)} accent="#3d9e6a" />)}
        </div>
      </div>

      {/* User ideas */}
      <div style={s.section}>
        <div style={s.sectionTitle}>YOUR IDEAS & OBSERVATIONS</div>
        <div style={s.sectionNote2}>What have you seen working? What do you want to try? What did a competitor do that caught your eye? What did a comment say that made you think?</div>
        <textarea
          value={userIdeas}
          onChange={e => setUserIdeas(e.target.value)}
          placeholder={`Examples:\n— "I noticed the dual-application video always gets comments like 'I need this' — want to build more around that moment"\n— "Saw a competitor using before/after with text overlay and it seemed to perform well"\n— "Customer said 'I haven't been able to wear eyeliner for years' — want to lean into the sensitive eyes angle more"\n— "Want to try a static with just the kohl jar and one customer quote"`}
          rows={6}
          style={s.textarea}
          onFocus={e => e.target.style.borderColor = "#7c6aff"}
          onBlur={e => e.target.style.borderColor = "#1a1a28"}
        />
      </div>

      <button onClick={onRun} disabled={loading} style={{ ...s.runBtn, background: loading ? "#1a1a28" : "linear-gradient(135deg,#7c6aff,#4a3aaa)" }}>
        {loading ? "Building creative batch..." : "Generate Creative Batch →"}
      </button>
    </div>
  );
}

// ─── HELPERS ──────────────────────────────────────────────────────────────────
function extractPersonas(brandData) {
  const matches = brandData.match(/\b(Yasmin|Emma|Sarah|Priya|Zara|Diana|Sara|[A-Z][a-z]+ \([A-Z][a-z]+\))\b/g);
  if (!matches) return ["Core Customer", "Secondary Persona"];
  return [...new Set(matches)].slice(0, 5);
}

function Pill({ label, active, onClick, accent }) {
  return (
    <button onClick={onClick} style={{
      background: active ? accent + "18" : "transparent",
      border: `1px solid ${active ? accent : "#1e1e30"}`,
      borderRadius: 20, padding: "5px 14px", color: active ? accent : "#333",
      fontSize: 11, fontFamily: "monospace", cursor: "pointer", transition: "all .2s", whiteSpace: "nowrap"
    }}
      onMouseEnter={e => { if (!active) e.currentTarget.style.borderColor = accent + "55"; }}
      onMouseLeave={e => { if (!active) e.currentTarget.style.borderColor = "#1e1e30"; }}>
      {label}
    </button>
  );
}

function MetricInput({ label, value, onChange, placeholder, hint }) {
  return (
    <div>
      <div style={{ color: "#333", fontSize: 10, fontFamily: "monospace", letterSpacing: 1, marginBottom: 6 }}>{label}</div>
      <input
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        style={{ width: "100%", background: "#0d0d18", border: "1px solid #1a1a28", borderRadius: 8, padding: "10px 14px", color: "#c8c0d8", fontSize: 13, fontFamily: "monospace" }}
        onFocus={e => e.target.style.borderColor = "#7c6aff44"}
        onBlur={e => e.target.style.borderColor = "#1a1a28"}
      />
      {hint && <div style={{ color: "#252535", fontSize: 10, fontFamily: "monospace", marginTop: 4 }}>{hint}</div>}
    </div>
  );
}

// ─── STYLES ───────────────────────────────────────────────────────────────────
const s = {
  app: { minHeight: "100vh", background: "#07070f", display: "flex", flexDirection: "column", fontFamily: "'Palatino Linotype', serif" },
  topbar: { background: "#0a0a14", borderBottom: "1px solid #111120", padding: "12px 20px", display: "flex", alignItems: "center", justifyContent: "space-between", position: "sticky", top: 0, zIndex: 100, flexWrap: "wrap", gap: 10 },
  topbarLeft: { display: "flex", alignItems: "center", gap: 12 },
  logo: { width: 36, height: 36, background: "linear-gradient(135deg,#7c6aff,#4a3aaa)", borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, color: "#fff", fontFamily: "monospace", fontWeight: "bold", flexShrink: 0 },
  topbarTitle: { color: "#c8c0e8", fontSize: 14 },
  topbarSub: { color: "#2a2a3a", fontSize: 10, fontFamily: "monospace", letterSpacing: 1, marginTop: 2 },
  topbarRight: { display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" },
  modeBtn: { background: "transparent", border: "1px solid #1e1e30", borderRadius: 8, padding: "6px 14px", color: "#333", fontSize: 11, fontFamily: "monospace", letterSpacing: 1, cursor: "pointer", transition: "all .2s" },
  modeBtnActive: { borderColor: "#d4a85355", color: "#d4a853", background: "rgba(212,168,83,.08)" },
  modeBtnActiveGreen: { borderColor: "#7c6aff55", color: "#7c6aff", background: "rgba(124,106,255,.08)" },
  switchBtn: { background: "transparent", border: "1px solid #1a1a28", borderRadius: 8, padding: "6px 12px", color: "#2a2a3a", fontSize: 10, fontFamily: "monospace", cursor: "pointer" },
  main: { flex: 1, overflowY: "auto" },
  panelHeader: { display: "flex", alignItems: "flex-start", gap: 16, marginBottom: 32 },
  panelIcon: { width: 44, height: 44, background: "linear-gradient(135deg,#d4a853,#8b5e3c)", borderRadius: 12, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, flexShrink: 0 },
  panelTitle: { color: "#f0eeff", fontSize: 22, marginBottom: 4 },
  panelSub: { color: "#444", fontSize: 13, lineHeight: 1.6 },
  selectorRow: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, marginBottom: 24 },
  selectorGroup: { background: "#0a0a16", border: "1px solid #111128", borderRadius: 12, padding: "16px 18px" },
  selectorLabel: { color: "#2a2a4a", fontSize: 9, fontFamily: "monospace", letterSpacing: 2, marginBottom: 12 },
  pills: { display: "flex", flexWrap: "wrap", gap: 6 },
  section: { background: "#0a0a16", border: "1px solid #111128", borderRadius: 12, padding: "18px 20px", marginBottom: 16 },
  sectionTitle: { color: "#3a3a5a", fontSize: 10, fontFamily: "monospace", letterSpacing: 2, marginBottom: 14 },
  sectionNote: { color: "#252535", fontFamily: "monospace" },
  sectionNote2: { color: "#252535", fontSize: 11, fontFamily: "monospace", marginBottom: 12, marginTop: -8 },
  metricsGrid: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 14 },
  textarea: { width: "100%", background: "#0d0d18", border: "1px solid #1a1a28", borderRadius: 10, padding: "12px 16px", color: "#888", fontSize: 13, fontFamily: "monospace", resize: "vertical", lineHeight: 1.7, marginTop: 4 },
  runBtn: { width: "100%", border: "none", borderRadius: 12, padding: "18px", color: "#fff", fontSize: 16, fontFamily: "'Palatino Linotype', serif", cursor: "pointer", letterSpacing: 1, marginTop: 8, marginBottom: 40, transition: "all .2s" },
  outputSection: { maxWidth: 820, margin: "0 auto 60px", padding: "0 24px", animation: "fadeUp .4s ease" },
  outputHeader: { display: "flex", alignItems: "center", gap: 10, marginBottom: 20, paddingTop: 8, borderTop: "1px solid #111128" },
  outputDot: { width: 8, height: 8, borderRadius: "50%", background: "#7c6aff", animation: "dotPulse 2s ease-in-out infinite" },
  outputLabel: { color: "#2a2a4a", fontSize: 10, fontFamily: "monospace", letterSpacing: 3 },
  loadingBox: { background: "#0a0a16", border: "1px solid #111128", borderRadius: 14, padding: "40px", textAlign: "center" },
  loadingDots: { display: "flex", gap: 6, justifyContent: "center", marginBottom: 16 },
  dot: { width: 8, height: 8, borderRadius: "50%", background: "#7c6aff", animation: "dotPulse 1.2s ease-in-out infinite", display: "inline-block" },
  loadingText: { color: "#333", fontSize: 13, fontFamily: "monospace" },
  outputContent: { background: "#0a0a16", border: "1px solid #111128", borderRadius: 14, padding: "28px 30px" },
  copyBtn: { marginTop: 20, background: "transparent", border: "1px solid #1e1e30", borderRadius: 8, padding: "8px 18px", color: "#333", fontSize: 11, fontFamily: "monospace", cursor: "pointer" },
  outH2: { color: "#7c6aff", fontSize: 16, fontFamily: "monospace", letterSpacing: 1, marginTop: 20, marginBottom: 8, paddingBottom: 6, borderBottom: "1px solid #111128" },
  outH3: { color: "#d4a853", fontSize: 14, marginTop: 18, marginBottom: 6 },
  outBold: { color: "#c8c0e8", fontSize: 14, fontWeight: "bold", marginTop: 6 },
  outBullet: { color: "#555", fontSize: 13, lineHeight: 1.7, paddingLeft: 16 },
  outField: { fontSize: 13, lineHeight: 1.8, display: "flex", gap: 8, flexWrap: "wrap" },
  outFieldLabel: { color: "#7c6aff", fontFamily: "monospace", fontSize: 11, flexShrink: 0 },
  outBody: { color: "#555", fontSize: 13, lineHeight: 1.8 },
  outDivider: { height: 1, background: "#111128", margin: "12px 0" },
};
