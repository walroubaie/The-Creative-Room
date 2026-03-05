import { useState, useEffect, useRef } from "react";

// ─── STORAGE HELPERS ──────────────────────────────────────────────────────────
const BRANDS_KEY = "cr_brands_v1";
function loadBrands() { try { return JSON.parse(localStorage.getItem(BRANDS_KEY) || "[]"); } catch { return []; } }
function saveBrands(b) { try { localStorage.setItem(BRANDS_KEY, JSON.stringify(b)); } catch {} }
function loadRoom(id) { try { return JSON.parse(localStorage.getItem(`cr_room_${id}`) || "[]"); } catch { return []; } }
function saveRoom(id, msgs) { try { localStorage.setItem(`cr_room_${id}`, JSON.stringify(msgs)); } catch {} }

// ─── SYSTEM PROMPT ────────────────────────────────────────────────────────────
const SYSTEM = (doc) => `You are The Creative Room — a senior Meta ads creative strategist and thinking partner. You are conversational, direct, and specific. Everything you say is rooted in the brand strategy document below.

BRAND STRATEGY DOCUMENT:
═══════════════════════════════════════
${doc}
═══════════════════════════════════════

YOUR TWO MODES:

━━━ DIAGNOSE MODE ━━━
When diagnosing Meta ads performance:
- Guide conversationally — ask for metrics one at a time, in the right order
- Sequence: Hook Rate → Hold Rate → CTR → CPA → ROAS → CPM → Frequency
- If metric missing: tell them what it is, why you need it, where to find it in Meta Ads Manager
- Diagnose using the 5-link chain: Hook → Hold → Click → Land → Convert
- Hook Rate benchmarks: below 20% critical, 20-30% average, above 30% strong, above 40% exceptional
- Hold Rate benchmarks: below 10% critical, 10-20% average, above 20% strong
- CTR benchmarks: below 0.5% low, 0.5-1.5% average, above 1.5% strong
- Three scenarios: A) No winners → wrong message/format/audience. B) Some winners → protect winner, iterate one variable. C) Strong winner → add one complexity layer at a time
- Always connect diagnosis to brand strategy — which persona, which angle, what does this tell us
- Absorb ANY extra context user gives — comments, observations, what they noticed

━━━ CREATE MODE ━━━
When generating creative:
- First ask: which persona? specific angle? any ideas or observations to factor in?
- Use ALL frameworks:
  * Alysha's pain/desire mapping — one primary organising principle per concept
  * Cara Hoyt's 10 hook formulas filled with the brand's ACTUAL language bank
  * Three hook types stacked: TEXT (opening line) + VISUAL (opening frame) + AUDIO (first words)
  * GBP Method: GUT (0-3s) → BRAIN A (3-8s) → BRAIN B (8-15s, 3 objections) → POCKET (CTA)
  * 5 Levels of Awareness: Unaware → Problem Aware → Solution Aware → Product Aware → Most Aware
  * Funnel stages: TOF / MOF / BOF
  * Angle dimensions: Desired Outcome, Objections, Features/Benefits, Use Case, Consequences, Misconceptions, Education, Acceptance, Failed Solutions, Identity
  * Formats: UGC talking head, founder story, testimonial, before/after, static benefit callout, us vs them, social proof, demo, street interview, skit
  * Competitor white space from the strategy doc
- Use ACTUAL customer language from the language bank — never generic copy
- Each concept labelled: persona, funnel stage, awareness level, angle, format, hook types, GBP structure, Aha Moment
- Minimum 5 concepts per batch, varied across personas/stages/formats/angles
- Factor in everything new the user tells you

━━━ RULES ━━━
- Thinking partner — help users make decisions, don't make them for them
- Ask clarifying questions before generating
- Short messages when asking. Detailed and structured when delivering output.
- Always specific to THIS brand, THESE personas, THESE customers.`;

// ─── API CALL ─────────────────────────────────────────────────────────────────
async function callClaude(messages, doc) {
  const res = await fetch("/api/claude", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "claude-sonnet-4-20250514",
      max_tokens: 3000,
      system: SYSTEM(doc),
      messages: messages.map(m => ({ role: m.role, content: m.content }))
    })
  });
  if (!res.ok) throw new Error(`API error ${res.status}`);
  const data = await res.json();
  return data.content?.find(b => b.type === "text")?.text || "";
}

// ─── MAIN APP ─────────────────────────────────────────────────────────────────
export default function App() {
  const [screen, setScreen] = useState("home");
  const [brands, setBrands] = useState(loadBrands);
  const [activeBrand, setActiveBrand] = useState(null);
  const [messages, setMessages] = useState([]);

  const openBrand = (brand) => { setActiveBrand(brand); setMessages(loadRoom(brand.id)); setScreen("room"); };
  const createBrand = (brand) => { const u = [brand, ...brands]; setBrands(u); saveBrands(u); setActiveBrand(brand); setMessages([]); setScreen("room"); };
  const deleteBrand = (id) => { const u = brands.filter(b => b.id !== id); setBrands(u); saveBrands(u); try { localStorage.removeItem(`cr_room_${id}`); } catch {} };
  const updateMessages = (msgs) => { setMessages(msgs); if (activeBrand) saveRoom(activeBrand.id, msgs); };

  if (screen === "home") return <Home brands={brands} onOpen={openBrand} onNew={() => setScreen("setup")} onDelete={deleteBrand} />;
  if (screen === "setup") return <Setup onBack={() => setScreen("home")} onCreate={createBrand} />;
  return <Room brand={activeBrand} messages={messages} onBack={() => setScreen("home")} onUpdateMessages={updateMessages} />;
}

// ─── HOME ─────────────────────────────────────────────────────────────────────
function Home({ brands, onOpen, onNew, onDelete }) {
  const [confirmDelete, setConfirmDelete] = useState(null);
  return (
    <div style={p.page}>
      <div style={p.homeWrap}>
        <div style={p.homeHeader}>
          <div style={p.logoRow}>
            <div style={p.logo}>CR</div>
            <div><div style={p.appName}>The Creative Room</div><div style={p.appSub}>Meta Ads Intelligence · by Wasan Al · @foreveronajourney</div></div>
          </div>
          <button onClick={onNew} style={p.newBrandBtn} onMouseEnter={e=>e.currentTarget.style.opacity=".9"} onMouseLeave={e=>e.currentTarget.style.opacity="1"}>+ New Brand Room</button>
        </div>

        <div style={p.storageNote}>
          <span>💾</span>
          <span>Your brand rooms are saved in <strong>this browser on this device</strong>. They survive closing tabs and restarting your computer — but <strong>do not clear your browser history or cache</strong> or your sessions will be permanently lost. Always download important outputs after each session.</span>
        </div>

        {brands.length === 0 ? (
          <div style={p.emptyState}>
            <div style={p.emptyIcon}>✦</div>
            <div style={p.emptyTitle}>No brands yet</div>
            <div style={p.emptySub}>Upload a strategy document from The Strategy Session to create your first brand room</div>
            <button onClick={onNew} style={p.emptyBtn}>Create First Brand Room →</button>
          </div>
        ) : (
          <div style={p.brandGrid}>
            {brands.map(b => (
              <div key={b.id} style={p.brandCard} onClick={() => onOpen(b)}
                onMouseEnter={e=>e.currentTarget.style.borderColor="#d4a853"}
                onMouseLeave={e=>e.currentTarget.style.borderColor="#e8e0d4"}>
                <div style={p.brandCardTop}>
                  <div style={p.brandInitial}>{b.name[0]?.toUpperCase()}</div>
                  <button onClick={e=>{e.stopPropagation();setConfirmDelete(b.id);}} style={p.deleteBtn}>✕</button>
                </div>
                <div style={p.brandCardName}>{b.name}</div>
                <div style={p.brandCardMeta}>{loadRoom(b.id).length} messages · {new Date(b.created).toLocaleDateString()}</div>
                <div style={p.brandCardOpen}>Open Room →</div>
              </div>
            ))}
          </div>
        )}

        {confirmDelete && (
          <div style={p.overlay}>
            <div style={p.modal}>
              <div style={p.modalTitle}>Delete this brand room?</div>
              <div style={p.modalSub}>All conversation history will be permanently deleted. This cannot be undone.</div>
              <div style={p.modalBtns}>
                <button onClick={()=>setConfirmDelete(null)} style={p.modalCancel}>Cancel</button>
                <button onClick={()=>{deleteBrand(confirmDelete);setConfirmDelete(null);}} style={p.modalConfirm}>Delete</button>
              </div>
            </div>
          </div>
        )}
      </div>
      <style>{css}</style>
    </div>
  );
}

// ─── SETUP ────────────────────────────────────────────────────────────────────
function Setup({ onBack, onCreate }) {
  const [name, setName] = useState("");
  const [doc, setDoc] = useState("");
  const fileRef = useRef(null);

  const handleFile = async (e) => {
    const file = e.target.files[0]; if (!file) return;
    const text = await file.text(); setDoc(text);
    if (!name) {
      const first = text.split("\n").find(l=>l.trim())?.replace(/[#*_]/g,"").trim()||"";
      setName(first.split("—")[0].split("|")[0].trim().slice(0,40) || file.name.replace(/\.[^.]+$/,""));
    }
  };

  return (
    <div style={p.page}>
      <div style={p.setupWrap}>
        <button onClick={onBack} style={p.backBtn}>← Back to Brands</button>
        <div style={p.setupLabel}>NEW BRAND ROOM</div>
        <h2 style={p.setupTitle}>Upload your strategy document</h2>
        <p style={p.setupSub}>This is the document from The Strategy Session app. The Creative Room uses everything inside — personas, language bank, competitor research, strategic foundation — as the foundation for every session.</p>

        <div onClick={()=>fileRef.current?.click()} style={{...p.dropzone,...(doc?p.dropzoneDone:{})}}
          onMouseEnter={e=>{if(!doc)e.currentTarget.style.borderColor="#7c6aff"}}
          onMouseLeave={e=>{if(!doc)e.currentTarget.style.borderColor="#e0d8cc"}}>
          <input ref={fileRef} type="file" accept=".txt,.md,.docx,.doc" onChange={handleFile} style={{display:"none"}}/>
          {doc ? (<>
            <div style={{color:"#4a8a4a",fontSize:11,fontFamily:"monospace",letterSpacing:2,marginBottom:6}}>● DOCUMENT LOADED</div>
            <div style={{color:"#1C1C1E",fontSize:15}}>{name}</div>
            <div style={{color:"#aaa",fontSize:11,marginTop:4}}>{doc.length.toLocaleString()} characters · click to replace</div>
          </>) : (<>
            <div style={{fontSize:32,marginBottom:12}}>📄</div>
            <div style={{color:"#888",fontSize:14}}>Click to upload strategy document</div>
            <div style={{color:"#ccc",fontSize:11,fontFamily:"monospace",marginTop:6}}>.txt · .md · .doc · .docx</div>
          </>)}
        </div>

        <div style={p.orDiv}><div style={p.orLine}/><span style={p.orTxt}>OR PASTE MANUALLY</span><div style={p.orLine}/></div>
        <textarea value={doc} onChange={e=>{setDoc(e.target.value);if(e.target.value&&!name)setName("My Brand");}}
          placeholder="Paste the full strategy document — personas, language bank, competitor research, strategic foundation, everything..."
          rows={6} style={p.textarea}
          onFocus={e=>e.target.style.borderColor="#7c6aff"} onBlur={e=>e.target.style.borderColor="#e0d8cc"}/>

        {doc && (<>
          <div style={{marginTop:20}}>
            <div style={p.inputLabel}>BRAND NAME</div>
            <input value={name} onChange={e=>setName(e.target.value)} placeholder="e.g. Meltee, KOHLBRA..." style={p.input}
              onFocus={e=>e.target.style.borderColor="#7c6aff"} onBlur={e=>e.target.style.borderColor="#e0d8cc"}/>
          </div>
          <button onClick={()=>onCreate({id:Date.now().toString(),name:name.trim(),doc,created:Date.now()})}
            disabled={!name.trim()} style={{...p.createBtn,opacity:name.trim()?1:.4}}>
            Create Brand Room for {name||"..."} →
          </button>
        </>)}
      </div>
      <style>{css}</style>
    </div>
  );
}

// ─── ROOM ─────────────────────────────────────────────────────────────────────
function Room({ brand, messages, onBack, onUpdateMessages }) {
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState(null);
  const bottomRef = useRef(null);

  useEffect(() => { bottomRef.current?.scrollIntoView({behavior:"smooth"}); }, [messages, loading]);

  const selectMode = async (m) => {
    setMode(m);
    setLoading(true);
    const intro = m === "diagnose"
      ? `I have your brand strategy loaded — I know the personas, language bank, competitive landscape, and strategic foundation for ${brand.name}.\n\nBefore we look at any numbers: which ad or campaign are we diagnosing? Tell me which persona it was built for and what angle you tested. That context changes everything about how I read the data.`
      : `Let's build your next creative batch for ${brand.name}. I have everything from the strategy doc ready to go.\n\nBefore I build, three quick questions:\n1. Which persona are we targeting — or do you want a full mix across all of them?\n2. Any specific angle you want to explore?\n3. Anything you've seen working recently — your own ads, a competitor, something in the comments — that I should factor in?`;
    onUpdateMessages([...messages, { role:"assistant", content:intro, id:Date.now() }]);
    setLoading(false);
  };

  const send = async () => {
    if (!input.trim() || loading) return;
    const userMsg = { role:"user", content:input.trim(), id:Date.now() };
    const newMsgs = [...messages, userMsg];
    onUpdateMessages(newMsgs);
    setInput("");
    setLoading(true);
    try {
      const reply = await callClaude(newMsgs, brand.doc);
      onUpdateMessages([...newMsgs, { role:"assistant", content:reply, id:Date.now()+1 }]);
    } catch {
      onUpdateMessages([...newMsgs, { role:"assistant", content:"Connection error — check your internet and try again.", id:Date.now()+1 }]);
    }
    setLoading(false);
  };

  const downloadLast = () => {
    const last = [...messages].reverse().find(m=>m.role==="assistant");
    if (!last) return;
    const date = new Date().toISOString().split("T")[0];
    const label = mode==="diagnose"?"Diagnosis":"Creative-Batch";
    const header = `THE CREATIVE ROOM — ${brand.name}\n${label} · ${date}\nby Wasan Al · @foreveronajourney\n${"─".repeat(60)}\n\n`;
    const blob = new Blob([header+last.content],{type:"text/plain"});
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href=url; a.download=`${brand.name}-${label}-${date}.txt`; a.click();
    URL.revokeObjectURL(url);
  };

  const newSession = () => { onUpdateMessages([]); setMode(null); };

  return (
    <div style={p.roomWrap}>
      <div style={p.sidebar}>
        <div>
          <button onClick={onBack} style={p.backBtnSide}>← All Brands</button>
          <div style={p.sidebarBrand}>
            <div style={p.sidebarInitial}>{brand.name[0]?.toUpperCase()}</div>
            <div style={p.sidebarBrandName}>{brand.name}</div>
          </div>
        </div>

        <div>
          <div style={p.sidebarLabel}>MODE</div>
          <button onClick={()=>{newSession();setTimeout(()=>selectMode("diagnose"),50);}} style={{...p.modeBtn,...(mode==="diagnose"?p.modeAmber:{})}}>
            📊 Diagnose Data
          </button>
          <button onClick={()=>{newSession();setTimeout(()=>selectMode("create"),50);}} style={{...p.modeBtn,...(mode==="create"?p.modePurple:{})}}>
            ✦ Generate Creative
          </button>
        </div>

        {messages.length > 0 && (
          <div>
            <div style={p.sidebarLabel}>ACTIONS</div>
            <button onClick={downloadLast} style={p.sidebarBtn}>⬇ Download Last Output</button>
            <button onClick={newSession} style={p.sidebarBtn}>↺ New Session</button>
          </div>
        )}

        <div style={p.sidebarNote}>
          <div>💾</div>
          <div style={p.sidebarNoteText}>Sessions auto-save in your browser. Don't clear browser history or your work will be lost.</div>
        </div>
      </div>

      <div style={p.chatArea}>
        <div style={p.chatHeader}>
          <div style={p.chatHeaderTitle}>{mode==="diagnose"?"📊 Diagnosing":mode==="create"?"✦ Creating":"The Creative Room"}</div>
          <div style={p.chatHeaderSub}>{brand.name}</div>
        </div>

        <div style={p.messages}>
          {!mode && messages.length===0 && (
            <div style={p.modeSelect}>
              <div style={p.modeSelectTitle}>What are we doing today?</div>
              <div style={p.modeSelectSub}>Choose a mode to start your session with {brand.name}</div>
              <div style={p.modeCards}>
                {[
                  {m:"diagnose",icon:"📊",title:"Diagnose Data",desc:"You have Meta Ads numbers. Find out exactly what they mean, what broke, and what to do next.",accent:"#d4a853"},
                  {m:"create",icon:"✦",title:"Generate Creative",desc:"Build a full creative batch — hooks, angles, formats, GBP — all tied to your strategy and customer language.",accent:"#7c6aff"}
                ].map(({m,icon,title,desc,accent})=>(
                  <div key={m} style={p.modeCard} onClick={()=>selectMode(m)}
                    onMouseEnter={e=>e.currentTarget.style.borderColor=accent}
                    onMouseLeave={e=>e.currentTarget.style.borderColor="#e8e0d4"}>
                    <div style={p.modeCardIcon}>{icon}</div>
                    <div style={p.modeCardTitle}>{title}</div>
                    <div style={p.modeCardDesc}>{desc}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {messages.map(msg=>(
            <div key={msg.id} style={{...p.msgRow,...(msg.role==="user"?p.msgRowUser:{})}}>
              {msg.role==="assistant"&&<div style={p.avatar}>CR</div>}
              <div style={{...p.bubble,...(msg.role==="user"?p.bubbleUser:p.bubbleAI)}}>
                <MsgContent content={msg.content} isUser={msg.role==="user"}/>
              </div>
            </div>
          ))}

          {loading&&(
            <div style={p.msgRow}>
              <div style={p.avatar}>CR</div>
              <div style={{...p.bubble,...p.bubbleAI}}>
                <div style={p.dots}>{[0,1,2].map(i=><span key={i} style={{...p.dot,animationDelay:`${i*.2}s`}}/>)}</div>
              </div>
            </div>
          )}
          <div ref={bottomRef}/>
        </div>

        {mode&&(
          <div style={p.inputArea}>
            <div style={p.inputWrap}>
              <textarea value={input} onChange={e=>setInput(e.target.value)}
                onKeyDown={e=>{if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();send();}}}
                placeholder={mode==="diagnose"?"Share your metrics or observations...":"Share ideas, what you've seen working, what you want to try..."}
                rows={1} style={p.chatInput}
                onInput={e=>{e.target.style.height="auto";e.target.style.height=Math.min(e.target.scrollHeight,120)+"px";}}
                onFocus={e=>e.target.parentElement.style.borderColor="#7c6aff"}
                onBlur={e=>e.target.parentElement.style.borderColor="#e0d8cc"}/>
              <button onClick={send} disabled={!input.trim()||loading} style={{...p.sendBtn,opacity:input.trim()&&!loading?1:.4}}>↑</button>
            </div>
            <div style={p.inputHint}>Enter to send · Shift+Enter for new line</div>
          </div>
        )}
      </div>
      <style>{css}</style>
    </div>
  );
}

function MsgContent({ content, isUser }) {
  if (isUser) return <div style={{color:"#f0ebe0",fontSize:14,lineHeight:1.7}}>{content}</div>;
  return (
    <div style={{display:"flex",flexDirection:"column",gap:3}}>
      {content.split("\n").map((line,i)=>{
        if(line.startsWith("## ")) return <div key={i} style={p.h2}>{line.replace(/^## /,"")}</div>;
        if(line.startsWith("### ")) return <div key={i} style={p.h3}>{line.replace(/^### /,"")}</div>;
        if(line.match(/^\*\*[^*]+\*\*:/)){ const[l,...r]=line.split(":**"); return <div key={i} style={p.field}><span style={p.fieldLabel}>{l.replace(/\*\*/g,"")}:</span><span style={p.fieldVal}>{r.join(":").replace(/\*\*/g,"")}</span></div>; }
        if(line.startsWith("**")&&line.endsWith("**")&&!line.slice(2,-2).includes("**")) return <div key={i} style={p.bold}>{line.slice(2,-2)}</div>;
        if(line.startsWith("- ")||line.startsWith("* ")) return <div key={i} style={p.bullet}>· {line.slice(2).replace(/\*\*/g,"")}</div>;
        if(line==="---"||line.startsWith("━━━")||line.startsWith("═══")) return <div key={i} style={p.rule}/>;
        if(!line.trim()) return <div key={i} style={{height:6}}/>;
        return <div key={i} style={p.body}>{line.replace(/\*\*/g,"").replace(/\*/g,"")}</div>;
      })}
    </div>
  );
}

const p = {
  page:{minHeight:"100vh",background:"#F7F3EE",fontFamily:"'Palatino Linotype','Book Antiqua',Palatino,serif"},
  homeWrap:{maxWidth:860,margin:"0 auto",padding:"40px 24px"},
  homeHeader:{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:24,flexWrap:"wrap",gap:12},
  logoRow:{display:"flex",alignItems:"center",gap:14},
  logo:{width:44,height:44,background:"linear-gradient(135deg,#7c6aff,#4a3aaa)",borderRadius:12,display:"flex",alignItems:"center",justifyContent:"center",fontSize:14,color:"#fff",fontFamily:"monospace",fontWeight:"bold"},
  appName:{color:"#1C1C1E",fontSize:20},
  appSub:{color:"#aaa",fontSize:11,fontFamily:"monospace",letterSpacing:1,marginTop:2},
  newBrandBtn:{background:"linear-gradient(135deg,#d4a853,#8b5e3c)",border:"none",borderRadius:10,padding:"12px 24px",color:"#fff",fontSize:14,fontFamily:"inherit",cursor:"pointer",transition:"opacity .2s"},
  storageNote:{background:"#fff8e8",border:"1px solid #f0d888",borderRadius:10,padding:"12px 18px",fontSize:12,color:"#7a5c1e",lineHeight:1.8,marginBottom:32,display:"flex",gap:10,alignItems:"flex-start"},
  emptyState:{textAlign:"center",padding:"80px 24px"},
  emptyIcon:{fontSize:40,color:"#e0d8cc",marginBottom:16},
  emptyTitle:{color:"#1C1C1E",fontSize:22,marginBottom:8},
  emptySub:{color:"#aaa",fontSize:14,marginBottom:32},
  emptyBtn:{background:"linear-gradient(135deg,#7c6aff,#4a3aaa)",border:"none",borderRadius:10,padding:"14px 28px",color:"#fff",fontSize:15,fontFamily:"inherit",cursor:"pointer"},
  brandGrid:{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(220px,1fr))",gap:16},
  brandCard:{background:"#fff",border:"1px solid #e8e0d4",borderRadius:14,padding:"20px",cursor:"pointer",transition:"all .2s"},
  brandCardTop:{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:14},
  brandInitial:{width:40,height:40,background:"linear-gradient(135deg,#d4a853,#8b5e3c)",borderRadius:10,display:"flex",alignItems:"center",justifyContent:"center",color:"#fff",fontSize:16,fontWeight:"bold"},
  deleteBtn:{background:"transparent",border:"none",color:"#ddd",fontSize:14,cursor:"pointer",padding:4},
  brandCardName:{color:"#1C1C1E",fontSize:16,marginBottom:6},
  brandCardMeta:{color:"#aaa",fontSize:11,fontFamily:"monospace",marginBottom:12},
  brandCardOpen:{color:"#8b5e3c",fontSize:12,fontFamily:"monospace"},
  overlay:{position:"fixed",inset:0,background:"rgba(0,0,0,.4)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:999},
  modal:{background:"#fff",borderRadius:16,padding:"32px",maxWidth:360,width:"90%",textAlign:"center"},
  modalTitle:{color:"#1C1C1E",fontSize:18,marginBottom:8},
  modalSub:{color:"#888",fontSize:13,marginBottom:24},
  modalBtns:{display:"flex",gap:10,justifyContent:"center"},
  modalCancel:{background:"#f0ebe0",border:"none",borderRadius:8,padding:"10px 20px",color:"#555",fontSize:14,fontFamily:"inherit",cursor:"pointer"},
  modalConfirm:{background:"#c05050",border:"none",borderRadius:8,padding:"10px 20px",color:"#fff",fontSize:14,fontFamily:"inherit",cursor:"pointer"},
  setupWrap:{maxWidth:600,margin:"0 auto",padding:"40px 24px"},
  backBtn:{background:"transparent",border:"none",color:"#aaa",fontSize:13,fontFamily:"monospace",cursor:"pointer",marginBottom:32,padding:0},
  setupLabel:{fontSize:10,letterSpacing:5,color:"#5a4aaa",fontFamily:"monospace",marginBottom:16},
  setupTitle:{fontSize:36,color:"#1C1C1E",fontWeight:"normal",marginBottom:12},
  setupSub:{color:"#666",fontSize:14,lineHeight:1.8,marginBottom:32},
  dropzone:{border:"2px dashed #e0d8cc",borderRadius:14,padding:"40px 32px",textAlign:"center",cursor:"pointer",marginBottom:20,transition:"all .2s"},
  dropzoneDone:{border:"2px solid #4a8a4a33",background:"#f8fff8"},
  orDiv:{display:"flex",alignItems:"center",gap:12,margin:"20px 0"},
  orLine:{flex:1,height:1,background:"#e0d8cc"},
  orTxt:{color:"#ccc",fontSize:10,fontFamily:"monospace",whiteSpace:"nowrap"},
  textarea:{width:"100%",background:"#fff",border:"1px solid #e0d8cc",borderRadius:10,padding:"14px 18px",color:"#333",fontSize:13,fontFamily:"monospace",resize:"vertical",lineHeight:1.7},
  inputLabel:{color:"#8b7355",fontSize:10,fontFamily:"monospace",letterSpacing:2,marginBottom:8},
  input:{width:"100%",background:"#fff",border:"1px solid #e0d8cc",borderRadius:10,padding:"14px 18px",color:"#1C1C1E",fontSize:15,fontFamily:"inherit"},
  createBtn:{width:"100%",marginTop:20,background:"linear-gradient(135deg,#7c6aff,#4a3aaa)",border:"none",borderRadius:12,padding:"18px",color:"#fff",fontSize:16,fontFamily:"inherit",cursor:"pointer",letterSpacing:1},
  roomWrap:{display:"flex",height:"100vh",background:"#F7F3EE",fontFamily:"'Palatino Linotype','Book Antiqua',Palatino,serif"},
  sidebar:{width:220,flexShrink:0,background:"#1C1C1E",display:"flex",flexDirection:"column",padding:"20px 16px",gap:24},
  backBtnSide:{background:"transparent",border:"none",color:"#aaa",fontSize:11,fontFamily:"monospace",cursor:"pointer",textAlign:"left",padding:0,letterSpacing:1,marginBottom:8},
  sidebarBrand:{display:"flex",alignItems:"center",gap:10},
  sidebarInitial:{width:32,height:32,background:"linear-gradient(135deg,#d4a853,#8b5e3c)",borderRadius:8,display:"flex",alignItems:"center",justifyContent:"center",color:"#fff",fontSize:13,fontWeight:"bold"},
  sidebarBrandName:{color:"#f0ebe0",fontSize:14},
  sidebarLabel:{color:"#888",fontSize:9,fontFamily:"monospace",letterSpacing:2,marginBottom:8},
  modeBtn:{width:"100%",background:"transparent",border:"1px solid #2a2a2a",borderRadius:8,padding:"10px 12px",color:"#555",fontSize:12,fontFamily:"inherit",cursor:"pointer",textAlign:"left",display:"flex",alignItems:"center",gap:8,marginBottom:6,transition:"all .2s"},
  modeAmber:{background:"rgba(212,168,83,.1)",borderColor:"#d4a85344",color:"#d4a853"},
  modePurple:{background:"rgba(124,106,255,.1)",borderColor:"#7c6aff44",color:"#c8c0ff"},
  sidebarBtn:{width:"100%",background:"transparent",border:"1px solid #2a2a2a",borderRadius:8,padding:"8px 12px",color:"#444",fontSize:11,fontFamily:"monospace",cursor:"pointer",textAlign:"left",marginBottom:4},
  sidebarNote:{marginTop:"auto",background:"#161616",borderRadius:10,padding:"12px",display:"flex",gap:8,alignItems:"flex-start",fontSize:14},
  sidebarNoteText:{color:"#666",fontSize:10,lineHeight:1.6},
  chatArea:{flex:1,display:"flex",flexDirection:"column",overflow:"hidden"},
  chatHeader:{background:"#fff",borderBottom:"1px solid #e8e0d4",padding:"14px 24px"},
  chatHeaderTitle:{color:"#1C1C1E",fontSize:15},
  chatHeaderSub:{color:"#aaa",fontSize:11,fontFamily:"monospace",marginTop:2},
  messages:{flex:1,overflowY:"auto",padding:"28px 24px",display:"flex",flexDirection:"column",gap:20},
  modeSelect:{textAlign:"center",padding:"60px 24px"},
  modeSelectTitle:{color:"#1C1C1E",fontSize:26,marginBottom:8},
  modeSelectSub:{color:"#aaa",fontSize:14,marginBottom:36},
  modeCards:{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16,maxWidth:560,margin:"0 auto"},
  modeCard:{background:"#fff",border:"1px solid #e8e0d4",borderRadius:14,padding:"24px 20px",cursor:"pointer",textAlign:"left",transition:"all .2s"},
  modeCardIcon:{fontSize:24,marginBottom:12},
  modeCardTitle:{color:"#1C1C1E",fontSize:15,marginBottom:8},
  modeCardDesc:{color:"#888",fontSize:13,lineHeight:1.6},
  msgRow:{display:"flex",alignItems:"flex-start",gap:12},
  msgRowUser:{flexDirection:"row-reverse"},
  avatar:{width:32,height:32,background:"linear-gradient(135deg,#7c6aff,#4a3aaa)",borderRadius:8,display:"flex",alignItems:"center",justifyContent:"center",color:"#fff",fontSize:10,fontFamily:"monospace",fontWeight:"bold",flexShrink:0,marginTop:2},
  bubble:{maxWidth:"78%",borderRadius:14,padding:"14px 18px",lineHeight:1.7},
  bubbleAI:{background:"#fff",border:"1px solid #e8e0d4",borderTopLeftRadius:4},
  bubbleUser:{background:"#1C1C1E",borderTopRightRadius:4},
  dots:{display:"flex",gap:5,alignItems:"center",padding:"4px 0"},
  dot:{width:7,height:7,borderRadius:"50%",background:"#ccc",animation:"dotPulse 1.2s ease-in-out infinite",display:"inline-block"},
  inputArea:{background:"#fff",borderTop:"1px solid #e0d8cc",padding:"14px 20px 16px"},
  inputWrap:{display:"flex",gap:10,alignItems:"flex-end",background:"#F7F3EE",border:"1px solid #e0d8cc",borderRadius:14,padding:"10px 14px",transition:"border-color .2s"},
  chatInput:{flex:1,background:"transparent",border:"none",color:"#1C1C1E",fontSize:14,fontFamily:"inherit",resize:"none",lineHeight:1.6,minHeight:24,maxHeight:120},
  sendBtn:{width:34,height:34,borderRadius:10,background:"linear-gradient(135deg,#7c6aff,#4a3aaa)",border:"none",color:"#fff",fontSize:16,cursor:"pointer",flexShrink:0,display:"flex",alignItems:"center",justifyContent:"center",transition:"opacity .2s"},
  inputHint:{color:"#ccc",fontSize:10,fontFamily:"monospace",marginTop:6,textAlign:"center"},
  h2:{color:"#5a4aaa",fontSize:15,fontFamily:"monospace",letterSpacing:1,marginTop:14,marginBottom:6,paddingBottom:4,borderBottom:"1px solid #e8e0d4"},
  h3:{color:"#8b5e3c",fontSize:14,fontWeight:"bold",marginTop:12,marginBottom:4},
  bold:{color:"#1C1C1E",fontSize:14,fontWeight:"bold",marginTop:4},
  field:{fontSize:13,lineHeight:1.8,display:"flex",gap:6,flexWrap:"wrap"},
  fieldLabel:{color:"#5a4aaa",fontFamily:"monospace",fontSize:11,flexShrink:0,marginTop:2},
  fieldVal:{color:"#444"},
  bullet:{color:"#444",fontSize:13,lineHeight:1.7,paddingLeft:14},
  body:{color:"#444",fontSize:13,lineHeight:1.8},
  rule:{height:1,background:"#e8e0d4",margin:"8px 0"},
};

const css = `
  *{box-sizing:border-box;margin:0;padding:0;}
  body{background:#F7F3EE;}
  ::-webkit-scrollbar{width:3px;}
  ::-webkit-scrollbar-track{background:#F7F3EE;}
  ::-webkit-scrollbar-thumb{background:#d8cfc4;border-radius:2px;}
  textarea::placeholder,input::placeholder{color:#ccc;}
  textarea{caret-color:#8b5e3c;}
  input:focus,textarea:focus{outline:none;}
  @keyframes dotPulse{0%,100%{opacity:.2;transform:scale(.7)}50%{opacity:1;transform:scale(1)}}
`;
