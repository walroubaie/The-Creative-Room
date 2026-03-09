import { useState, useEffect, useRef } from "react";
import * as mammoth from "mammoth";

// PDF text extraction via PDF.js CDN
async function parsePDF(file) {
  if (!window.pdfjsLib) {
    await new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js";
      script.onload = resolve;
      script.onerror = reject;
      document.head.appendChild(script);
    });
    window.pdfjsLib.GlobalWorkerOptions.workerSrc =
      "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";
  }
  const ab = await file.arrayBuffer();
  const pdf = await window.pdfjsLib.getDocument({ data: ab }).promise;
  let text = "";
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    text += content.items.map(item => item.str).join(" ") + "\n";
  }
  return text.trim();
}

// ── STORAGE ───────────────────────────────────────────────────────────────────
async function loadBrands() { try { const r = await window.storage.get("cr_brands"); return r ? JSON.parse(r.value) : []; } catch { return []; } }
async function saveBrands(b) { try { await window.storage.set("cr_brands", JSON.stringify(b)); } catch {} }
async function loadBrandData(id) { try { const r = await window.storage.get("cr_bd_" + id); return r ? JSON.parse(r.value) : null; } catch { return null; } }
async function saveBrandData(id, d) { try { await window.storage.set("cr_bd_" + id, JSON.stringify(d)); } catch {} }

// ── THEME ─────────────────────────────────────────────────────────────────────
const T = {
  bg:"#f9f7f4", surface:"#ffffff", warm:"#f4f1ec", border:"#e8e2d9", borderMid:"#d4ccc0",
  text:"#1a1714", mid:"#5a5148", dim:"#9a9088",
  gold:"#8B6B1A", goldL:"#fdf6e3", goldB:"#c9a84c",
  blue:"#1a4a78", blueL:"#edf4fb",
  green:"#1a5a36", greenL:"#eaf5ee",
  red:"#78201e", redL:"#fceaea",
  purple:"#46327a", purpleL:"#f0ecfb",
  orange:"#7a3e10", orangeL:"#faf2e8", orangeB:"#dfc8b0",
  font:"'Inter',-apple-system,BlinkMacSystemFont,sans-serif",
  mono:"'JetBrains Mono','Fira Code',monospace",
};

// ── DEFINITIONS ───────────────────────────────────────────────────────────────
const FORMAT_DEFS = {
  "UGC Talking Head":"Person speaks to camera in a real environment. Natural, unscripted feeling.",
  "Skit":"Acted scene or story — comedic, exaggerated, or dramatic. Story-based.",
  "Voiceover B-Roll":"No face. Real-life footage with a narrating voice over it.",
  "Founder Story":"The person behind the brand speaks directly. Personal, builds trust.",
  "Answer Bubble":"TikTok format — responds to a viewer comment overlaid on screen.",
  "How-To / Demo":"Shows the product being used step by step. Outcome-focused.",
  "Review / UGC Quote":"Static. Real customer words as the hero — large text, authentic phrasing.",
  "Us vs Them":"Static split layout. Competitor vs your product, head to head.",
  "Benefit Callout":"Static. One clear product benefit in large bold text.",
  "Proof / Stats":"Static. Leads with a verified number or claim.",
  "Founder / Product":"Static. Founder with or next to the product.",
};
const FORMULA_DEFS = {
  "Emotional Trigger":"First line makes the viewer feel something before they understand what's being sold.",
  "POV Hook":"'POV: You finally have the house to yourself.' Places viewer inside a specific moment.",
  "Tribal Identity":"'If you do X, this is for you.' Creates an in-group. Viewer self-selects.",
  "Why Did No One Tell Me":"Positions information as a secret or gap. Creates mild outrage.",
  "Curiosity Loop":"Opens a question or tension that can't be resolved without watching more.",
  "Golden Nugget":"Leads with a specific surprising fact. The fact itself is valuable enough to stop the scroll.",
  "Negative Hook":"Leads with what NOT to do, or what went wrong.",
  "I-Led Story":"First person, personal, specific. Viewer lives the story.",
  "Before / After":"Shows painful before-state first. The gap between before and after is the hook.",
  "Founder Intro":"The founder introduces themselves and why they made this.",
  "Give Me Time":"'Give me 10 minutes and I'll show you...' Lowers the perceived barrier.",
  "Investment Hook":"Leads with money, time, or effort investment.",
};
const FORMULA_STRUCTURES = {
  "Tribal Identity":"IF YOU [specific behaviour this persona already does] THIS IS FOR YOU.",
  "Investment Hook":"I SPENT [specific amount] ON [thing] SO YOU DON'T HAVE TO.",
  "Why Did No One Tell Me":"WHY DID NO ONE TELL ME [surprising fact or solution]?",
  "POV Hook":"POV: [specific relatable moment the persona already lives].",
  "Emotional Trigger":"Open directly with pure feeling. No preamble. First line is emotion only.",
  "Give Me Time":"GIVE ME [short time] AND I'LL SHOW YOU [specific transformation].",
  "Founder Intro":"I STARTED [brand] BECAUSE [specific personal frustration].",
  "Golden Nugget":"Lead with the single most surprising specific fact or real customer quote verbatim.",
  "Negative Hook":"STOP [doing X] or I TRIED [X] AND [what went wrong].",
  "Curiosity Loop":"Open a question or tension that cannot be resolved without watching more.",
  "I-Led Story":"I [specific personal thing that happened]. First person. Viewer lives the story.",
  "Before / After":"Show the painful before-state first. The gap between before and after is the hook.",
};
const FORMULA_FIT = {
  "Tribal Identity":{awareness:["Unaware","Problem Aware","Solution Aware"],triggers:["Identity","Pain","Desire"]},
  "POV Hook":{awareness:["Unaware","Problem Aware"],triggers:["Pain","Fear","Curiosity","Identity"]},
  "Emotional Trigger":{awareness:["Unaware","Problem Aware"],triggers:["Pain","Fear","Desire","Identity"]},
  "Curiosity Loop":{awareness:["Unaware","Problem Aware","Solution Aware"],triggers:["Curiosity","Fear"]},
  "Golden Nugget":{awareness:["Problem Aware","Solution Aware"],triggers:["Curiosity","Pain"]},
  "Negative Hook":{awareness:["Problem Aware","Solution Aware"],triggers:["Pain","Fear"]},
  "Why Did No One Tell Me":{awareness:["Problem Aware","Solution Aware"],triggers:["Curiosity","Pain"]},
  "I-Led Story":{awareness:["Unaware","Problem Aware","Solution Aware"],triggers:["Pain","Desire","Transformation"]},
  "Before / After":{awareness:["Problem Aware","Solution Aware","Product Aware"],triggers:["Pain","Transformation","Desire"]},
  "Investment Hook":{awareness:["Solution Aware","Product Aware"],triggers:["Social Proof","Curiosity"]},
  "Founder Intro":{awareness:["Solution Aware","Product Aware"],triggers:["Identity","Social Proof"]},
  "Give Me Time":{awareness:["Solution Aware","Product Aware","Most Aware"],triggers:["Curiosity","Desire"]},
};
const AWARENESS_DEFS = {
  "Unaware":"Doesn't know they have the problem yet. Cannot lead with the solution.",
  "Problem Aware":"Knows the problem exists. Actively looking for relief.",
  "Solution Aware":"Knows solutions like yours exist. Evaluating options.",
  "Product Aware":"Has seen or heard of your product. Has not bought.",
  "Most Aware":"Knows your product well. Just needs a reason to act now.",
};
const AWARENESS_RULES = {
  "Unaware":"Lead with a situation or feeling they already recognise from daily life. Do NOT mention the product, the category, or any solution.",
  "Problem Aware":"Lead with the feeling or frustration. Make them feel understood before anything else. Introduce the product only after emotional connection is made.",
  "Solution Aware":"They have tried things and been disappointed. Lead with differentiation. Why this is different from everything they already tried.",
  "Product Aware":"They know the brand but have not bought. Handle their specific objection directly.",
  "Most Aware":"Lead with the offer or final reason to act now. No need to explain the problem.",
};
const AW_ANGLES = {
  "Unaware":["Consequences","Misconceptions","Identity","Use Case"],
  "Problem Aware":["Desired Outcome","Acceptance / Normalised","Failed Solutions","Consequences"],
  "Solution Aware":["Education","Objections","Features / Benefits","Failed Solutions"],
  "Product Aware":["Objections","Features / Benefits","Desired Outcome","Social Proof"],
  "Most Aware":["Desired Outcome","Objections","Identity"],
};
const AW_FORMATS = {
  "Unaware":["UGC Talking Head","Skit","Voiceover B-Roll"],
  "Problem Aware":["UGC Talking Head","Skit","Answer Bubble"],
  "Solution Aware":["How-To / Demo","Founder Story","Review / UGC Quote"],
  "Product Aware":["Us vs Them","Proof / Stats","Review / UGC Quote"],
  "Most Aware":["Benefit Callout","Proof / Stats","Founder / Product"],
};
const ANGLE_DEFS = {
  "Consequences":"What gets worse in their life if they never solve this? Lead with the cost of inaction.",
  "Failed Solutions":"They've already tried things that disappointed them. Open by naming what didn't work.",
  "Desired Outcome":"Paint the specific after-state they fantasise about. Make them feel the transformation.",
  "Objections":"Name the exact doubt stopping them from buying and dismantle it directly.",
  "Features / Benefits":"Frame as outcomes this persona cares about, not technical features.",
  "Use Case":"Show the specific daily moment where they experience this problem.",
  "Misconceptions":"Correct the false belief they hold about the problem or category.",
  "Education":"Lead with the surprising fact they don't know that would change how they see this.",
  "Acceptance / Normalised":"Challenge what they've normalised or given up on that they shouldn't have.",
  "Identity":"Show who they want to become. How does using this product reflect on who they are.",
  "Social Proof":"Real results from real people. Let the proof do the persuading.",
};

const AWARENESS = ["Unaware","Problem Aware","Solution Aware","Product Aware","Most Aware"];
const ANGLES = Object.keys(ANGLE_DEFS);
const TRIGGERS = ["Pain","Desire","Fear","Identity","Curiosity","Social Proof","Transformation"];
const FORMULAS = Object.keys(FORMULA_DEFS);
const FORMATS = {
  VIDEO:["UGC Talking Head","Skit","Voiceover B-Roll","Founder Story","Answer Bubble","How-To / Demo"],
  IMAGE:["Review / UGC Quote","Us vs Them","Benefit Callout","Proof / Stats","Founder / Product"],
};

const EMPTY_BRAND = {
  name:"",organising_idea:"",strategic_tension:"",white_space:"",primary_principle:"",
  core_persona:{name:"",age:"",desc:"",desire:"",pain:"",language:{trigger:[],pain:[],desire:[],objection:[]}},
  secondary_persona:{name:"",age:"",desc:"",desire:"",pain:"",language:{trigger:[],pain:[],desire:[],objection:[]}},
  extra_personas:[],proof_points:[],brand_voice:[],concepts:[],savedBriefs:[],runningConcepts:[],thinkMessages:[],thinkMode:null,
};

// ── API ────────────────────────────────────────────────────────────────────────
async function callClaude(messages, system, maxTokens = 1000) {
  const body = { model:"claude-sonnet-4-20250514", max_tokens:maxTokens, messages };
  if (system) body.system = system;
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method:"POST",
    headers:{"Content-Type":"application/json","x-api-key":import.meta.env.VITE_ANTHROPIC_API_KEY,"anthropic-version":"2023-06-01","anthropic-dangerous-direct-browser-access":"true"},
    body:JSON.stringify(body),
  });
  const d = await res.json();
  if (!res.ok) throw new Error("API error " + res.status + ": " + (d.error?.message || JSON.stringify(d)));
  if (!d.content?.[0]?.text) throw new Error("Empty response from API.");
  return d.content[0].text.trim();
}
async function callJSON(prompt, maxTokens = 4000) {
  const text = await callClaude([{role:"user",content:prompt}], null, maxTokens);
  const clean = text.trim();
  const stripped = clean.replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/\s*```$/i, "").trim();
  const findJSON = (str, open, close) => {
    const start = str.indexOf(open);
    if (start === -1) return null;
    let depth = 0, inStr = false, escape = false;
    for (let i = start; i < str.length; i++) {
      const c = str[i];
      if (escape) { escape = false; continue; }
      if (c === "\\") { escape = true; continue; }
      if (c === "\"" && !escape) { inStr = !inStr; continue; }
      if (inStr) continue;
      if (c === open) depth++;
      if (c === close) { depth--; if (depth === 0) return str.slice(start, i + 1); }
    }
    return null;
  };
  const arr = findJSON(stripped, "[", "]");
  const obj = findJSON(stripped, "{", "}");
  if (arr && obj) return stripped.indexOf("[") < stripped.indexOf("{") ? arr : obj;
  if (obj) return obj;
  if (arr) return arr;
  return stripped;
}

// ── ATOMS ─────────────────────────────────────────────────────────────────────
const Lbl = ({children, c=T.dim}) => (
  <div style={{fontSize:9,fontWeight:800,letterSpacing:2,textTransform:"uppercase",color:c,marginBottom:5,fontFamily:T.font}}>{children}</div>
);
const Divider = ({m=22}) => <div style={{height:1,background:T.border,margin:m+"px 0"}}/>;
const Chip = ({label,c=T.gold,bg=T.goldL,b=T.goldB}) => (
  <span style={{fontSize:10,fontWeight:700,letterSpacing:0.5,color:c,background:bg,border:"1px solid "+b,borderRadius:4,padding:"2px 8px",whiteSpace:"nowrap",fontFamily:T.font}}>{label}</span>
);
const Btn = ({onClick,children,disabled,variant="primary",full,style:s={}}) => (
  <button onClick={onClick} disabled={disabled} style={{
    background:variant==="primary"?(disabled?T.warm:T.text):(variant==="ghost"?"transparent":T.surface),
    color:variant==="primary"?(disabled?T.dim:"#fff"):T.mid,
    border:variant==="primary"?"none":"1.5px solid "+T.border,
    borderRadius:7,padding:"10px 18px",fontSize:12,fontWeight:700,
    cursor:disabled?"not-allowed":"pointer",width:full?"100%":"auto",
    fontFamily:T.font,...s,
  }}>{children}</button>
);
const FInput = ({label,value,onChange,multi,placeholder,rows=3}) => (
  <div style={{marginBottom:13}}>
    {label && <Lbl>{label}</Lbl>}
    {multi
      ? <textarea value={value||""} onChange={e=>onChange(e.target.value)} placeholder={placeholder} rows={rows}
          style={{width:"100%",background:T.surface,border:"1.5px solid "+T.border,borderRadius:6,padding:"8px 12px",fontSize:13,color:T.text,fontFamily:T.font,resize:"vertical",outline:"none",boxSizing:"border-box",lineHeight:1.6}}/>
      : <input value={value||""} onChange={e=>onChange(e.target.value)} placeholder={placeholder}
          style={{width:"100%",background:T.surface,border:"1.5px solid "+T.border,borderRadius:6,padding:"8px 12px",fontSize:13,color:T.text,fontFamily:T.font,outline:"none",boxSizing:"border-box"}}/>
    }
  </div>
);
const ChoiceBtn = ({label,sub,selected,onSelect,c=T.gold,bg=T.goldL,b=T.goldB}) => (
  <button onClick={()=>onSelect(label)}
    style={{background:selected?bg:T.surface,border:"1.5px solid "+(selected?b:T.border),borderRadius:8,padding:"10px 14px",cursor:"pointer",textAlign:"left",flex:"1 1 130px",fontFamily:T.font}}>
    <div style={{fontSize:12,fontWeight:700,color:selected?c:T.text}}>{label}</div>
    {sub && <div style={{fontSize:10,color:selected?c:T.dim,marginTop:2,lineHeight:1.4}}>{sub}</div>}
  </button>
);
const inputStyle = {width:"100%",background:T.surface,border:"1.5px solid "+T.border,borderRadius:6,padding:"8px 12px",fontSize:13,color:T.text,fontFamily:"inherit",outline:"none",boxSizing:"border-box"};
const taStyle = {...inputStyle,resize:"vertical",lineHeight:1.6};

// ── ADDITIVE MERGE ─────────────────────────────────────────────────────────────
function additiveMerge(existing, parsed) {
  const mergeArr = (a,b) => [...new Set([...(a||[]),...(b||[])].filter(Boolean))];
  const mergeLang = (a,b) => ({
    trigger:mergeArr(a?.trigger,b?.trigger),
    pain:mergeArr(a?.pain,b?.pain),
    desire:mergeArr(a?.desire,b?.desire),
    objection:mergeArr(a?.objection,b?.objection),
  });
  const mergePersona = (e,p) => !p ? (e||{}) : {
    ...(e||{}),
    name:p.name||e?.name||"", age:p.age||e?.age||"",
    desc:p.desc||e?.desc||"", desire:p.desire||e?.desire||"", pain:p.pain||e?.pain||"",
    language:mergeLang(e?.language,p?.language),
  };
  return {
    ...existing,
    name:parsed.name||existing.name||"",
    organising_idea:parsed.organising_idea||existing.organising_idea||"",
    strategic_tension:parsed.strategic_tension||existing.strategic_tension||"",
    white_space:parsed.white_space||existing.white_space||"",
    primary_principle:parsed.primary_principle||existing.primary_principle||"",
    proof_points:mergeArr(existing.proof_points,parsed.proof_points),
    brand_voice:mergeArr(existing.brand_voice,parsed.brand_voice),
    core_persona:mergePersona(existing.core_persona,parsed.core_persona),
    secondary_persona:mergePersona(existing.secondary_persona,parsed.secondary_persona),
  };
}
const PARSE_PROMPT = `You are a senior creative strategist extracting brand data from a document. This could be a strategy session transcript, a Creative Intelligence Document, rough notes, or any format — find the data wherever it lives regardless of how it is labelled.

EXTRACT:
- Brand name (product name, company name, brand being discussed)
- Organising idea (single central strategic thought — could be labelled positioning, strategy, core idea, brand territory)
- Strategic tension (contradiction the strategy must resolve — could be tension, challenge, problem, gap)
- White space (what competitors are not doing — could be opportunity, differentiation, what nobody owns)
- Primary principle: "Pain-First" if brand leads with problems or fears, "Desire-First" if it leads with aspirations or identity
- Core persona: name or label, age range, description, primary desire, primary pain
- Secondary persona if present
- Proof points: specific claims, stats, results with exact numbers
- Language bank: scan the ENTIRE document for customer language — direct quotes, phrases customers use, how they describe the problem and desired outcome. Categorise each phrase as:
  trigger (moment they reach for the product), pain (frustration or fear), desire (outcome they want), objection (hesitation before buying)

CRITICAL: Extract ALL customer language phrases found anywhere — testimonials, persona descriptions, strategy notes, conversation transcripts. Use exact words. Do not leave any out.

Return ONLY raw JSON, no markdown, no backticks:
{"name":"","organising_idea":"","strategic_tension":"","white_space":"","primary_principle":"Pain-First or Desire-First","core_persona":{"name":"","age":"","desc":"","desire":"","pain":"","language":{"trigger":[],"pain":[],"desire":[],"objection":[]}},"secondary_persona":{"name":"","age":"","desc":"","desire":"","pain":"","language":{"trigger":[],"pain":[],"desire":[],"objection":[]}},"extra_personas":[],"proof_points":[],"brand_voice":[]}`;

// ── BRAND COMPLETENESS ────────────────────────────────────────────────────────
function getBrandScore(brand) {
  let score = 0;
  const missing = [];
  const check = (val, label, pts, tip) => {
    if (val && val.toString().trim()) { score += pts; }
    else missing.push({label, tip, pts});
  };
  check(brand.name, "Brand name", 10, null);
  check(brand.organising_idea, "Organising idea", 15, "Every AI call needs this to stay on-brand");
  check(brand.strategic_tension, "Strategic tension", 10, "Helps AI understand what contradiction to resolve");
  check(brand.white_space, "White space", 10, "Tells AI what territory to own in hooks");
  check(brand.primary_principle, "Primary principle", 10, null);
  check(brand.core_persona?.name, "Core persona name", 5, null);
  check(brand.core_persona?.desc, "Core persona description", 5, null);
  check(brand.core_persona?.desire, "Core persona desire", 5, null);
  check(brand.core_persona?.pain, "Core persona pain", 5, null);
  const lang = brand.core_persona?.language || {};
  check((lang.trigger||[]).length > 0 ? "y" : "", "Trigger phrases", 5, "No trigger phrases = AI uses generic language instead of your customer's exact words");
  check((lang.pain||[]).length > 0 ? "y" : "", "Pain phrases", 5, "Pain phrases make hooks sound like real customers");
  check((lang.desire||[]).length > 0 ? "y" : "", "Desire phrases", 5, "Desire phrases make transformation feel real");
  check((lang.objection||[]).length > 0 ? "y" : "", "Objection phrases", 5, "Without these the brief body sounds generic");
  check((brand.proof_points||[]).filter(Boolean).length > 0 ? "y" : "", "Proof points", 5, "Makes Brain A and Brain B sections specific and credible");
  return {score, missing};
}

function CompletenessBar({brand}) {
  const {score, missing} = getBrandScore(brand);
  const [open, setOpen] = useState(false);
  const c = score >= 80 ? T.green : score >= 50 ? T.gold : T.red;
  const bg = score >= 80 ? T.greenL : score >= 50 ? T.goldL : T.redL;
  const label = score >= 80 ? "Strong" : score >= 50 ? "Partial" : "Thin";
  return (
    <div style={{background:bg,border:"1.5px solid "+c+"30",borderRadius:8,padding:"12px 16px",marginBottom:20}}>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:12,flexWrap:"wrap"}}>
        <div style={{flex:1}}>
          <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:6}}>
            <div style={{fontSize:12,fontWeight:700,color:c,fontFamily:T.font}}>{score}% — {label}</div>
            {score < 100 && <button onClick={()=>setOpen(p=>!p)} style={{fontSize:11,color:T.mid,background:"none",border:"none",cursor:"pointer",fontFamily:T.font,textDecoration:"underline"}}>{open?"Hide gaps":"See what's missing"}</button>}
            {score >= 80 && <div style={{fontSize:11,color:c,fontFamily:T.font}}>✓ Ready for Hook Builder</div>}
          </div>
          <div style={{height:5,background:c+"20",borderRadius:3,overflow:"hidden"}}>
            <div style={{height:"100%",width:score+"%",background:c,borderRadius:3,transition:"width 0.4s"}}/>
          </div>
        </div>
      </div>
      {open && missing.length > 0 && (
        <div style={{marginTop:10,display:"flex",flexDirection:"column",gap:4}}>
          {missing.map((m,i) => (
            <div key={i} style={{display:"flex",gap:8,alignItems:"flex-start"}}>
              <span style={{color:c,fontSize:10,marginTop:2,flexShrink:0}}>→</span>
              <div style={{fontFamily:T.font}}>
                <span style={{fontSize:11,fontWeight:600,color:c}}>{m.label}</span>
                {m.tip && <span style={{fontSize:11,color:T.mid}}> — {m.tip}</span>}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── AI ASSIST BUTTON ──────────────────────────────────────────────────────────
function AIAssistBtn({label, prompt, onResult, style:s={}}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);

  const start = async () => {
    setOpen(true); setLoading(true);
    const question = await callClaude(
      [{role:"user",content:prompt}],
      "You are a friendly creative strategist onboarding a user. Ask one short, clear, conversational question. Maximum 2 sentences. No bullet points.",
      150
    ).catch(() => "Tell me about this in your own words.");
    setQ(question); setLoading(false);
  };

  const submit = async () => {
    if (!input.trim()) return;
    setLoading(true);
    const result = await callClaude(
      [{role:"user",content:prompt},{role:"assistant",content:q},{role:"user",content:input}],
      "Extract only the relevant content for the field \""+label+"\". Return it as a single clean string — no formatting, no explanation. If it is a list, separate items with \" | \".",
      200
    ).catch(() => input);
    onResult(result.trim());
    setOpen(false); setInput(""); setQ(""); setLoading(false);
  };

  if (!open) return (
    <button onClick={start} style={{fontSize:10,color:T.gold,fontWeight:600,fontFamily:T.font,background:"none",border:"1px solid "+T.goldB,borderRadius:4,padding:"2px 8px",cursor:"pointer",...s}}>
      AI assist
    </button>
  );

  return (
    <div style={{background:T.goldL,border:"1.5px solid "+T.goldB,borderRadius:7,padding:"12px 14px",marginBottom:10}}>
      <div style={{fontSize:11,color:T.mid,fontFamily:T.font,lineHeight:1.6,marginBottom:8,minHeight:24}}>
        {loading && !q ? "Thinking..." : q}
      </div>
      {q && <>
        <textarea value={input} onChange={e=>setInput(e.target.value)} rows={2} placeholder="Your answer..."
          style={{...taStyle,fontSize:12,marginBottom:8}}
          onKeyDown={e=>{if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();submit();}}}/>
        <div style={{display:"flex",gap:6}}>
          <Btn onClick={submit} disabled={loading||!input.trim()} style={{fontSize:11,padding:"6px 12px"}}>{loading?"Writing...":"Fill field →"}</Btn>
          <Btn onClick={()=>{setOpen(false);setInput("");setQ("");}} variant="secondary" style={{fontSize:11,padding:"6px 10px"}}>Cancel</Btn>
        </div>
      </>}
    </div>
  );
}

// ── THINK MODE ────────────────────────────────────────────────────────────────
function ThinkMode({brand, onUpdate}) {
  const [messages, setMessages] = useState(brand.thinkMessages || []);
  const [thinkMode, setThinkMode] = useState(brand.thinkMode || null);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [parsing, setParsing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savePreview, setSavePreview] = useState(null);
  const [saveConfirmed, setSaveConfirmed] = useState(false);
  // Test Strategy mode
  const [strategyStep, setStrategyStep] = useState(0); // 0=idle 1=generating 2=review 3=saved
  const [strategyDraft, setStrategyDraft] = useState(brand.testStrategy || null);
  const [strategyLoading, setStrategyLoading] = useState(false);
  const bottomRef = useRef();
  const fileRef = useRef();

  useEffect(() => { bottomRef.current?.scrollIntoView({behavior:"smooth"}); }, [messages]);

  const hasBrandData = !!(brand?.name && brand?.organising_idea);
  const started = messages.length > 0;

  const getSystem = (mode) => {
    const cp = brand?.core_persona;
    const usedAngles = [...new Set((brand?.savedBriefs||[]).map(b=>b.selections?.angle).filter(Boolean))];
    const unusedAngles = ANGLES.filter(a=>!usedAngles.includes(a));
    const ctx = hasBrandData
      ? "BRAND (you have this — do not repeat it back):\nBrand: "+brand.name+"\nOrganising Idea: "+(brand.organising_idea||"—")+"\nStrategic Tension: "+(brand.strategic_tension||"—")+"\nWhite Space: "+(brand.white_space||"—")+"\nPrimary Principle: "+(brand.primary_principle||"—")+"\nCore Persona: "+(cp?.name||"—")+" — "+(cp?.desc||"")+" | Desire: "+(cp?.desire||"")+" | Pain: "+(cp?.pain||"")+"\nBriefs built: "+(brand.savedBriefs||[]).length+"\nAngles already used: "+(usedAngles.join(", ")||"none")+"\nAngles NOT yet explored: "+unusedAngles.join(", ")
      : "No brand data. The user needs to fill Brand Inputs or upload a Strategy Doc first.";

    if (mode === "challenge") return "You are a senior direct response creative strategist — the most expensive consultant in the room. You challenge assumptions, find the cracks in strategy, and ask the question nobody wants to answer.\n\n"+ctx+"\n\nYOUR JOB: Challenge and pressure-test. Not to validate — to make the strategy better by attacking it.\n\nRULES:\n- Never summarise or repeat the brand data. Move forward.\n- Ask ONE sharp, uncomfortable question at a time.\n- When you see a problem, name it directly. Do not soften it.\n- Be specific: which persona, which awareness stage, what exactly the gap is.\n- Disagree when you see something they've missed or gotten wrong.\n- Short when probing. Detailed when delivering strategic insight.\n\nSTART: Look at the brand data and ask the single sharpest challenge question you can find.";

    if (mode === "explore") return "You are a senior creative strategist specialising in finding untapped creative territory. You see angles others miss.\n\n"+ctx+"\n\nYOUR JOB: Find the creative territory this brand hasn't explored yet and make it feel like an obvious opportunity.\n\nRULES:\n- Never summarise or repeat the brand data. Move forward.\n- Focus on the angles, personas, and formats NOT yet used.\n- When you suggest a direction: persona + awareness stage + angle + formula + why it's unexplored white space.\n- Be concrete about what the ad would actually look like in the first 5 seconds.\n- Short when probing. Detailed when delivering creative direction.\n\nSTART: Look at what's been explored vs what hasn't, and surface the single most interesting untapped angle for this brand.";

    return "You are a senior creative strategist. Help the user think through their strategy.\n\n"+ctx;
  };

  const handleFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setParsing(true); e.target.value = "";
    try {
      let text = "";
      if (file.name.endsWith(".docx") || file.name.endsWith(".doc")) { const ab=await file.arrayBuffer(); const r=await mammoth.extractRawText({arrayBuffer:ab}); text=r.value; }
      else if (file.name.endsWith(".pdf")) { text = await parsePDF(file); }
      else { text = await file.text(); }
      const raw = await callJSON(PARSE_PROMPT+"\n\nDOCUMENT:\n"+text.slice(0,12000));
      const parsed = JSON.parse(raw);
      onUpdate(additiveMerge(brand, parsed));
    } catch { alert("Could not parse document. Try again."); }
    setParsing(false);
  };

  const getPlanSystem = () => {
    const allPersonas = [brand.core_persona, brand.secondary_persona, ...(brand.extra_personas||[])].filter(p=>p?.name);
    const existingPhases = brand.testStrategy?.phases||[];
    const personaCtx = allPersonas.map((p,i)=>`PERSONA ${i+1}: ${p.name}
  Desc: ${p.desc||""} | Pain: ${p.pain||""} | Desire: ${p.desire||""}
  Language: ${[...(p.language?.trigger||[]),(p.language?.pain||[]),(p.language?.desire||[])].filter(Boolean).slice(0,6).join(", ")||"none"}
  Already tested: ${existingPhases.flatMap(ph=>ph.tests||[]).filter(t=>t.persona===p.name).map(t=>t.awareness+" + "+t.angle).join(", ")||"none"}`).join("\n");
    return `You are a senior paid media strategist helping a brand owner build their complete creative test roadmap. Strategy only — no scripts, no briefs, no copy. The other tools handle execution.

BRAND: ${brand.name}
Organising Idea: ${brand.organising_idea||""}
Strategic Tension: ${brand.strategic_tension||""}
White Space: ${brand.white_space||""}
Primary Principle: ${brand.primary_principle||"Pain-First"}
Proof Points: ${(brand.proof_points||[]).join(" | ")||"none"}
Existing plan history: ${existingPhases.length===0?"none — zero ad history":existingPhases.length+" phases already built"}

PERSONAS:
${personaCtx}

AVAILABLE ANGLES: Consequences, Failed Solutions, Desired Outcome, Objections, Features / Benefits, Use Case, Misconceptions, Education, Acceptance / Normalised, Identity, Social Proof
AVAILABLE FORMATS: UGC Talking Head, Skit, Voiceover B-Roll, Founder Story, Answer Bubble, How-To / Demo, Review / UGC Quote, Us vs Them, Benefit Callout, Proof / Stats, Founder / Product

THE TESTING LOGIC — understand this before building:
- Phase 1 (Angle Test): Pick one persona + one awareness stage + one format. Test 2-4 DIFFERENT ANGLES simultaneously. All run at the same time. One variable only: the angle. Winner tells you which message type resonates.
- Phase 2 (Format Test): Take the winning angle from Phase 1. Same persona, same awareness, same angle. Now test 3-4 DIFFERENT FORMATS simultaneously. One variable only: the format. Winner tells you what container carries the message best.
- Phase 3 (Funnel Depth): Take the winning angle + winning format. Same persona. Move to the NEXT awareness stage. Test 2 angles at the new stage.
- Phase 4 (Persona 2): Apply the proven playbook to the second persona. Start at Problem Aware again.

YOUR JOB: Guide the user through 6 decisions — one at a time.

THE 6 DECISIONS (in order):
1. Which persona to lead with — give your recommendation + specific reasoning from their data
2. Which awareness stage to enter — and why this stage for this persona right now
3. Which angles to test in Phase 1 — recommend 2-4 angles that map to this persona's language bank, explain each in one sentence. Ask which they want to include.
4. Which format to hold constant for Phase 1 — ONE format for all angle tests (so angle is the only variable). Recommend and explain why.
5. Which formats to test in Phase 2 — recommend 3-4 formats for the format test. Explain the logic.
6. Confirm — summarise persona, awareness, Phase 1 angles, Phase 1 format, Phase 2 formats. Say exactly: "Ready to build. Hit 'Finalise Plan' when you want to lock this in."

CRITICAL RULES:
- STRATEGY ONLY. Never write scripts, ad copy, hooks, creative briefs, or creative frameworks. That work happens in Hook Builder.
- One decision at a time. Never move to the next decision until the current one is confirmed.
- When user pushes back, acknowledge in one sentence then accept their decision.
- Under 150 words per message.
- No markdown bold (**text**), no headers (---), no bullet lists. Plain conversational text only.
- Always reference THIS brand's actual data — persona pain, language phrases, proof points.
- START: "We're building your full creative test strategy for [brand name]. I'll walk you through 6 decisions — persona, awareness stage, which angles to test, which format to hold constant, which formats to test next, then we lock it in. Here's who I'd lead with:" then give your recommendation.

When the user confirms all 6 decisions and says any of: build/ready/go/yes/finalise/lock it in/do it — output ONLY the JSON below, nothing before or after:
<<<PLAN_JSON>>>
{"lead_persona":"","lead_persona_why":"","entry_awareness":"","entry_awareness_why":"","phases":[{"phase":1,"label":"Angle Test","test_type":"parallel","variable":"angle","persona":"","awareness":"","format":"","subtype":"","description":"Same persona, same awareness stage, same format. Testing [N] angles simultaneously. One variable only: the message type. Winner tells us which angle resonates.","unlock_condition":"One angle reaches win metrics — that becomes the winning angle for Phase 2","what_we_are_learning":"Which message angle makes this persona stop and respond at [awareness] stage","tests":[{"priority":1,"persona":"","awareness":"","angle":"","format":"","subtype":"","hypothesis":"If we lead with [angle], this persona will respond because [specific insight from their language/pain data].","success_metric":"CTR >2%, Hook Rate >30%, Add-to-Cart >1.5%","win_next":"This angle wins — take it into Phase 2 and test it across formats","lose_next":"This angle doesn't resonate — [what this tells us about the persona]"},{"priority":2,"persona":"","awareness":"","angle":"","format":"","subtype":"","hypothesis":"","success_metric":"CTR >2%, Hook Rate >30%, Add-to-Cart >1.5%","win_next":"","lose_next":""}]},{"phase":2,"label":"Format Test","test_type":"parallel","variable":"format","persona":"","awareness":"","angle":"[Winning angle from Phase 1]","description":"Same persona, same awareness, same winning angle. Testing [N] formats simultaneously. One variable only: the container. Winner tells us how to deliver this message.","unlock_condition":"One format reaches win metrics — that becomes the winning format for Phase 3","what_we_are_learning":"Which format carries the winning angle most effectively for this persona","tests":[{"priority":3,"persona":"","awareness":"","angle":"[Winning angle from Phase 1]","format":"","subtype":"","hypothesis":"","success_metric":"CTR >2.5%, Hook Rate >35%, Add-to-Cart >2%","win_next":"","lose_next":""},{"priority":4,"persona":"","awareness":"","angle":"[Winning angle from Phase 1]","format":"","subtype":"","hypothesis":"","success_metric":"CTR >2.5%, Hook Rate >35%, Add-to-Cart >2%","win_next":"","lose_next":""},{"priority":5,"persona":"","awareness":"","angle":"[Winning angle from Phase 1]","format":"","subtype":"","hypothesis":"","success_metric":"CTR >2.5%, Hook Rate >35%, Add-to-Cart >2%","win_next":"","lose_next":""}]},{"phase":3,"label":"Funnel Depth","test_type":"parallel","variable":"angle","persona":"","awareness":"Solution Aware","format":"[Winning format from Phase 2]","description":"Persona validated, message validated. Moving down the funnel — same persona, next awareness stage. Testing 2 angles at Solution Aware to find what converts her.","unlock_condition":"Phase 2 has a winning format","what_we_are_learning":"Whether this persona responds at Solution Aware, and which message angle converts her","tests":[{"priority":6,"persona":"","awareness":"Solution Aware","angle":"","format":"[Winning format from Phase 2]","subtype":"","hypothesis":"","success_metric":"CTR >3%, Add-to-Cart >2.5%, Purchase Rate >1%","win_next":"","lose_next":""},{"priority":7,"persona":"","awareness":"Solution Aware","angle":"","format":"[Winning format from Phase 2]","subtype":"","hypothesis":"","success_metric":"CTR >3%, Add-to-Cart >2.5%, Purchase Rate >1%","win_next":"","lose_next":""}]},{"phase":4,"label":"Persona 2","test_type":"parallel","variable":"angle","persona":"","awareness":"Problem Aware","format":"[Winning format from Phase 2]","description":"Playbook proven for Persona 1. Now apply the same framework to Persona 2 — start at Problem Aware, test 2-3 angles simultaneously.","unlock_condition":"Phase 3 complete","what_we_are_learning":"Whether Persona 2 responds at all, and which angle resonates with them","tests":[{"priority":8,"persona":"","awareness":"Problem Aware","angle":"","format":"[Winning format from Phase 2]","subtype":"","hypothesis":"","success_metric":"CTR >2%, Hook Rate >30%, Add-to-Cart >1.5%","win_next":"","lose_next":""},{"priority":9,"persona":"","awareness":"Problem Aware","angle":"","format":"[Winning format from Phase 2]","subtype":"","hypothesis":"","success_metric":"CTR >2%, Hook Rate >30%, Add-to-Cart >1.5%","win_next":"","lose_next":""}]}]}
<<<END_PLAN_JSON>>>`;
  };

  const startPlanSession = async () => {
    setThinkMode("plan");
    setLoading(true);
    const intro = await callClaude(
      [{role:"user", content:"start"}],
      getPlanSystem(), 400
    ).catch(() => "We're building your full creative test strategy. I'll walk you through the key decisions — persona, entry point, angles, and format. This becomes your roadmap in The Plan tab. Let's start with who to lead with.");
    const msgs = [{role:"assistant", content:intro, id:Date.now()}];
    setMessages(msgs);
    onUpdate({...brand, thinkMessages:msgs, thinkMode:"plan"});
    setLoading(false);
  };

  const extractPlanFromMessages = async () => {
    setStrategyLoading(true);
    // Check if any AI message already has the JSON
    const allMsgs = [...messages];
    let foundParsed = null;
    for (const msg of [...allMsgs].reverse()) {
      if (msg.role !== "assistant") continue;
      const m = msg.content?.match(/<<<PLAN_JSON>>>([\s\S]+?)<<<END_PLAN_JSON>>>/);
      if (m) {
        try { foundParsed = JSON.parse(m[1].trim()); break; } catch(e) {}
      }
    }
    if (foundParsed) {
      await finalisePlan(foundParsed, allMsgs);
      return;
    }
    // Otherwise ask AI to output it
    const triggerMsg = {role:"user", content:"build it", id:Date.now()};
    const newMsgs = [...messages, triggerMsg];
    setMessages(newMsgs);
    try {
      const reply = await callClaude(newMsgs.map(m=>({role:m.role,content:m.content})), getPlanSystem(), 2000);
      const match = reply.match(/<<<PLAN_JSON>>>([\s\S]+?)<<<END_PLAN_JSON>>>/);
      if (match) {
        try {
          const parsed = JSON.parse(match[1].trim());
          await finalisePlan(parsed, newMsgs);
        } catch(e) {
          const final = [...newMsgs, {role:"assistant", content:reply, id:Date.now()}];
          setMessages(final);
          setStrategyLoading(false);
        }
      } else {
        const final = [...newMsgs, {role:"assistant", content:reply, id:Date.now()}];
        setMessages(final);
        setStrategyLoading(false);
      }
    } catch(e) { setStrategyLoading(false); }
  };

  const finalisePlan = async (parsed, currentMsgs) => {
    const phases = (parsed.phases||[]).map(ph=>({
      ...ph,
      status: "locked",
      tests: (ph.tests||[]).map((t)=>({
        ...t,
        id: Date.now()+Math.random(),
        status: "queued",
        linkedHooks: [],
        linkedRunning: [],
        created: new Date().toLocaleDateString(),
      }))
    }));
    if (phases[0]) phases[0].status = "active";
    const plan = {
      ...parsed,
      phases,
      generated: new Date().toLocaleDateString(),
      version: (brand.testStrategy?.version||0)+1,
    };
    // Replace any message containing JSON with a clean summary token
    const cleanMsgs = (currentMsgs||messages).map(msg => {
      if (msg.role === "assistant" && msg.content?.includes("<<<PLAN_JSON>>>")) {
        return {...msg, content:"__PLAN_READY__", _plan:plan};
      }
      return msg;
    });
    setMessages(cleanMsgs);
    onUpdate({...brand, thinkMessages:cleanMsgs, thinkMode:"plan"});
    setStrategyDraft(plan);
    setStrategyStep(2);
    setStrategyLoading(false);
  };

  const saveStrategy = () => {
    if (!strategyDraft) return;
    onUpdate({...brand, testStrategy: strategyDraft});
    setStrategyStep(3);
    setTimeout(()=>setStrategyStep(0), 2000);
  };

  const discardStrategy = () => {
    setStrategyDraft(null);
    setStrategyStep(0);
  };

  const startSession = async (m) => {
    setThinkMode(m); setLoading(true);
    const seed = m === "challenge" ? "I'm ready. Challenge my strategy." : "I'm ready. Find the creative territory I haven't explored yet.";
    const intro = await callClaude([{role:"user",content:seed}], getSystem(m), 700)
      .catch(() => m === "challenge"
        ? "Let's start with the hardest question. What's the one assumption in your strategy you're least confident about?"
        : "Let's find the territory you haven't touched. What awareness stages have you built briefs for so far?");
    const msgs = [{role:"assistant",content:intro,id:Date.now()}];
    setMessages(msgs);
    onUpdate({...brand, thinkMessages:msgs, thinkMode:m});
    setLoading(false);
  };

  const send = async () => {
    if (!input.trim() || loading) return;
    const userMsg = {role:"user",content:input.trim(),id:Date.now()};
    const newMsgs = [...messages, userMsg];
    setMessages(newMsgs); onUpdate({...brand,thinkMessages:newMsgs});
    setInput(""); setLoading(true);
    try {
      const sysPrompt = thinkMode === "plan" ? getPlanSystem() : getSystem(thinkMode);
      const reply = await callClaude(newMsgs.map(m=>({role:m.role,content:m.content})), sysPrompt, thinkMode==="plan"?400:1500);
      const final = [...newMsgs, {role:"assistant",content:reply,id:Date.now()+1}];
      setMessages(final); onUpdate({...brand,thinkMessages:final});
    } catch {
      const err = [...newMsgs, {role:"assistant",content:"Connection error — try again.",id:Date.now()+1}];
      setMessages(err);
    }
    setLoading(false);
  };

  const clearSession = () => {
    setMessages([]); setThinkMode(null); setSavePreview(null);
    onUpdate({...brand, thinkMessages:[], thinkMode:null});
  };

  const extractInsights = async () => {
    if (messages.length < 4) return;
    setSaving(true);
    const transcript = messages.map(m => (m.role==="user"?"YOU":"AI")+": "+m.content).join("\n\n");
    const prompt = "You are extracting strategic insights from a Think Mode conversation to update Brand Inputs.\n\nCURRENT BRAND INPUTS:\nBrand: "+brand.name+"\nOrganising Idea: "+(brand.organising_idea||"not set")+"\nStrategic Tension: "+(brand.strategic_tension||"not set")+"\nWhite Space: "+(brand.white_space||"not set")+"\n\nTRANSCRIPT:\n"+transcript.slice(0,6000)+"\n\nExtract ONLY new or refined information not already captured. Look for corrections to existing fields, new customer language phrases, new proof points.\n\nReturn ONLY raw JSON (no markdown):\n{\"organising_idea\":\"\",\"strategic_tension\":\"\",\"white_space\":\"\",\"new_pain_phrases\":[],\"new_desire_phrases\":[],\"new_trigger_phrases\":[],\"new_proof_points\":[],\"notes\":\"one sentence summary of what this conversation revealed\"}";
    try {
      const raw = await callJSON(prompt, 800);
      const parsed = JSON.parse(raw);
      const fields = [];
      if (parsed.organising_idea?.trim()) fields.push({key:"organising_idea",label:"Organising Idea",value:parsed.organising_idea});
      if (parsed.strategic_tension?.trim()) fields.push({key:"strategic_tension",label:"Strategic Tension",value:parsed.strategic_tension});
      if (parsed.white_space?.trim()) fields.push({key:"white_space",label:"White Space",value:parsed.white_space});
      if ((parsed.new_pain_phrases||[]).length) fields.push({key:"lang_pain",label:"New pain phrases",value:parsed.new_pain_phrases.join(" | ")});
      if ((parsed.new_desire_phrases||[]).length) fields.push({key:"lang_desire",label:"New desire phrases",value:parsed.new_desire_phrases.join(" | ")});
      if ((parsed.new_trigger_phrases||[]).length) fields.push({key:"lang_trigger",label:"New trigger phrases",value:parsed.new_trigger_phrases.join(" | ")});
      if ((parsed.new_proof_points||[]).length) fields.push({key:"proof_points",label:"Proof points",value:parsed.new_proof_points.join(" | ")});
      setSavePreview({fields, notes:parsed.notes||""});
    } catch { setSavePreview({fields:[], notes:"Could not extract insights. Try again."}); }
    setSaving(false);
  };

  const confirmSave = () => {
    if (!savePreview?.fields?.length) return;
    let updated = {...brand};
    savePreview.fields.forEach(f => {
      if (f.key === "organising_idea") updated.organising_idea = f.value;
      else if (f.key === "strategic_tension") updated.strategic_tension = f.value;
      else if (f.key === "white_space") updated.white_space = f.value;
      else if (f.key === "lang_pain") {
        const ex = updated.core_persona?.language?.pain||[];
        const nw = f.value.split("|").map(x=>x.trim()).filter(Boolean);
        updated = {...updated,core_persona:{...(updated.core_persona||{}),language:{...(updated.core_persona?.language||{}),pain:[...new Set([...ex,...nw])]}}};
      } else if (f.key === "lang_desire") {
        const ex = updated.core_persona?.language?.desire||[];
        const nw = f.value.split("|").map(x=>x.trim()).filter(Boolean);
        updated = {...updated,core_persona:{...(updated.core_persona||{}),language:{...(updated.core_persona?.language||{}),desire:[...new Set([...ex,...nw])]}}};
      } else if (f.key === "lang_trigger") {
        const ex = updated.core_persona?.language?.trigger||[];
        const nw = f.value.split("|").map(x=>x.trim()).filter(Boolean);
        updated = {...updated,core_persona:{...(updated.core_persona||{}),language:{...(updated.core_persona?.language||{}),trigger:[...new Set([...ex,...nw])]}}};
      } else if (f.key === "proof_points") {
        const ex = updated.proof_points||[];
        const nw = f.value.split("|").map(x=>x.trim()).filter(Boolean);
        updated = {...updated,proof_points:[...new Set([...ex,...nw])]};
      }
    });
    onUpdate(updated); setSavePreview(null); setSaveConfirmed(true);
    setTimeout(() => setSaveConfirmed(false), 3000);
  };

  const modeLabel = thinkMode === "challenge" ? "Challenge Mode" : thinkMode === "explore" ? "Explore Mode" : thinkMode === "plan" ? "Build Test Plan" : "";

  return (
    <div style={{maxWidth:740,margin:"0 auto",height:"calc(100vh - 220px)",display:"flex",flexDirection:"column"}}>

      {!started && (
        <div style={{flex:1,display:"flex",flexDirection:"column",justifyContent:"center",maxWidth:520,margin:"0 auto",width:"100%"}}>
          <div style={{background:T.warm,border:"1.5px solid "+T.border,borderRadius:8,padding:"14px 18px",marginBottom:20,display:"flex",alignItems:"center",justifyContent:"space-between",gap:12,flexWrap:"wrap"}}>
            <div>
              <div style={{fontSize:12,fontWeight:600,color:T.text,fontFamily:T.font,marginBottom:2}}>{hasBrandData ? brand.name+" loaded" : "Upload a Strategy Doc"}</div>
              <div style={{fontSize:11,color:T.dim,fontFamily:T.font}}>{hasBrandData ? "Brand Inputs populated. Upload to update." : "Parses and auto-fills Brand Inputs."}</div>
            </div>
            <div>
              <input ref={fileRef} type="file" accept=".txt,.md,.docx,.doc,.pdf" onChange={handleFile} style={{display:"none"}}/>
              <Btn onClick={()=>fileRef.current?.click()} variant="secondary" disabled={parsing} style={{fontSize:11,padding:"7px 14px"}}>{parsing?"Parsing...":"Upload Doc"}</Btn>
            </div>
          </div>

          {!hasBrandData && (
            <div style={{background:T.surface,border:"1.5px solid "+T.border,borderRadius:7,padding:"11px 14px",marginBottom:20,fontSize:12,color:T.mid,fontFamily:T.font,lineHeight:1.6}}>
              → No brand data yet. Upload a Strategy Doc above, or fill in Brand Inputs first.
            </div>
          )}

          {hasBrandData && (
            <>
              <div style={{fontSize:12,fontWeight:600,color:T.text,fontFamily:T.font,marginBottom:10}}>What do you want to do?</div>
              <div style={{display:"flex",flexDirection:"column",gap:8}}>
                {[
                  {m:"challenge", title:"Challenge my strategy", desc:"Pressure-test assumptions, find the cracks, ask the questions you haven't asked. The AI disagrees with you."},
                  {m:"explore", title:"Explore new territory", desc:"Find angles, personas, and formats you haven't tried yet. The AI maps what's unexplored and makes the case for why it's worth testing."},
                ].map(opt => (
                  <button key={opt.m} onClick={()=>startSession(opt.m)}
                    style={{background:T.surface,border:"1.5px solid "+T.border,borderRadius:8,padding:"14px 18px",cursor:"pointer",textAlign:"left"}}>
                    <div style={{fontSize:13,fontWeight:600,color:T.text,fontFamily:T.font,marginBottom:3}}>{opt.title}</div>
                    <div style={{fontSize:11,color:T.dim,fontFamily:T.font,lineHeight:1.5}}>{opt.desc}</div>
                  </button>
                ))}
                <button onClick={startPlanSession}
                  style={{background:T.text,border:"none",borderRadius:8,padding:"14px 18px",cursor:"pointer",textAlign:"left"}}>
                  <div style={{fontSize:13,fontWeight:600,color:"#fff",fontFamily:T.font,marginBottom:3}}>
                    {brand.testStrategy ? "↻ Rebuild test plan" : "Build test plan →"}
                  </div>
                  <div style={{fontSize:11,color:"rgba(255,255,255,0.65)",fontFamily:T.font,lineHeight:1.5}}>
                    {brand.testStrategy
                      ? `Active plan: ${(brand.testStrategy.phases||[]).length} phases · v${brand.testStrategy.version||1} · ${brand.testStrategy.generated||""}`
                      : "Walk through your strategy with an AI partner — persona, entry point, angles. Builds a phased test roadmap. Saves to The Plan."}
                  </div>
                </button>
              </div>

              {/* Plan saved confirmation */}
              {strategyStep===3 && (
                <div style={{marginTop:12,background:T.greenL,border:"1.5px solid "+T.green,borderRadius:7,padding:"11px 14px",fontSize:12,fontWeight:600,color:T.green,fontFamily:T.font}}>
                  ✓ Test plan saved — visible in The Plan
                </div>
              )}

              {/* Existing saved plan preview */}
              {strategyStep===0 && brand.testStrategy && (
                <div style={{marginTop:16,background:T.surface,border:"1.5px solid "+T.border,borderRadius:8,padding:"12px 16px"}}>
                  <div style={{fontSize:10,fontWeight:700,letterSpacing:0.8,textTransform:"uppercase",color:T.dim,marginBottom:8,fontFamily:T.font}}>Active Plan — v{brand.testStrategy.version||1} · {brand.testStrategy.generated}</div>
                  {(brand.testStrategy.phases||[]).map((ph,i)=>(
                    <div key={i} style={{display:"flex",alignItems:"center",gap:8,marginBottom:5,padding:"5px 8px",background:ph.status==="active"?T.goldL:T.warm,border:"1px solid "+(ph.status==="active"?T.goldB:T.border),borderRadius:4}}>
                      <div style={{fontSize:10,fontWeight:700,color:ph.status==="active"?T.gold:T.dim,fontFamily:T.font,width:16}}>{i+1}</div>
                      <div style={{fontSize:11,color:T.text,fontFamily:T.font,flex:1}}>{ph.label}</div>
                      <div style={{fontSize:10,color:T.dim,fontFamily:T.font}}>{(ph.tests||[]).length} tests</div>
                      <Chip label={ph.status==="active"?"Active":ph.status==="done"?"Done":"Locked"} c={ph.status==="active"?T.gold:ph.status==="done"?T.green:T.dim} bg={T.warm} b={T.border}/>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      )}

      {started && (
        <>
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:12}}>
            <div style={{fontSize:11,fontWeight:600,color:T.dim,fontFamily:T.font,letterSpacing:0.5,textTransform:"uppercase"}}>{modeLabel}</div>
            <button onClick={clearSession} style={{fontSize:11,color:T.dim,background:"none",border:"none",cursor:"pointer",fontFamily:T.font,textDecoration:"underline"}}>New session</button>
          </div>

          <div style={{flex:1,overflowY:"auto",display:"flex",flexDirection:"column",gap:12,paddingBottom:12}}>
            {messages.map(msg => {
              // Plan-ready card — replace raw JSON message with clean summary
              if (msg.content === "__PLAN_READY__" && msg._plan) {
                const p = msg._plan;
                return (
                  <div key={msg.id} style={{display:"flex",justifyContent:"flex-start"}}>
                    <div style={{maxWidth:"90%",background:T.surface,border:"1.5px solid "+T.border,borderRadius:"10px 10px 10px 2px",padding:"14px 16px",fontFamily:T.font}}>
                      <div style={{fontSize:10,fontWeight:700,letterSpacing:0.8,textTransform:"uppercase",color:T.gold,marginBottom:8}}>Plan ready</div>
                      <div style={{fontSize:13,fontWeight:700,color:T.text,marginBottom:2}}>Lead: {p.lead_persona}</div>
                      <div style={{fontSize:11,color:T.mid,lineHeight:1.6,marginBottom:10}}>{p.lead_persona_why}</div>
                      <div style={{display:"flex",flexDirection:"column",gap:5}}>
                        {(p.phases||[]).map((ph,i)=>(
                          <div key={i} style={{display:"flex",alignItems:"center",gap:8,padding:"6px 10px",background:i===0?T.goldL:T.warm,border:"1px solid "+(i===0?T.goldB:T.border),borderRadius:5}}>
                            <div style={{width:18,height:18,borderRadius:"50%",background:i===0?T.gold:T.border,display:"flex",alignItems:"center",justifyContent:"center",fontSize:9,fontWeight:700,color:i===0?"#fff":T.dim,flexShrink:0}}>{i+1}</div>
                            <div style={{fontSize:11,fontWeight:600,color:T.text,flex:1}}>{ph.label}</div>
                            <div style={{fontSize:10,color:T.dim}}>{ph.persona} · {ph.awareness}</div>
                            <div style={{fontSize:10,color:T.dim}}>{(ph.tests||[]).length} test{(ph.tests||[]).length!==1?"s":""}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                );
              }
              // Normal message
              return (
                <div key={msg.id} style={{display:"flex",justifyContent:msg.role==="user"?"flex-end":"flex-start"}}>
                  <div style={{
                    maxWidth:"78%",background:msg.role==="user"?T.text:T.surface,
                    color:msg.role==="user"?"#fff":T.text,
                    border:msg.role==="user"?"none":"1.5px solid "+T.border,
                    borderRadius:msg.role==="user"?"10px 10px 2px 10px":"10px 10px 10px 2px",
                    padding:"11px 15px",fontSize:13,lineHeight:1.7,whiteSpace:"pre-wrap",fontFamily:T.font,
                  }}>{msg.content}</div>
                </div>
              );
            })}
            {loading && (
              <div style={{display:"flex",justifyContent:"flex-start"}}>
                <div style={{background:T.surface,border:"1.5px solid "+T.border,borderRadius:10,padding:"11px 15px",fontSize:13,color:T.dim,fontStyle:"italic",fontFamily:T.font}}>Thinking...</div>
              </div>
            )}
            <div ref={bottomRef}/>
          </div>

          {messages.length >= 2 && thinkMode === "plan" && (
            <div style={{paddingTop:8,borderTop:"1px solid "+T.border,marginBottom:8,display:"flex",alignItems:"center",gap:8}}>
              {strategyStep===2 && strategyDraft ? (
                <>
                  <div style={{fontSize:11,color:T.green,fontWeight:600,fontFamily:T.font,flex:1}}>✓ Plan ready to save</div>
                  <Btn onClick={saveStrategy} style={{fontSize:11,padding:"6px 16px",background:T.green,border:"none"}}>Save to The Plan →</Btn>
                  <Btn onClick={discardStrategy} variant="secondary" style={{fontSize:11,padding:"6px 10px",color:T.red}}>Discard</Btn>
                </>
              ) : (
                <>
                  <div style={{fontSize:11,color:T.dim,fontFamily:T.font,flex:1,fontStyle:"italic"}}>When you've agreed on the approach, finalise your plan.</div>
                  <button onClick={extractPlanFromMessages} disabled={strategyLoading}
                    style={{fontSize:11,fontWeight:600,color:"#fff",background:T.text,border:"none",borderRadius:5,padding:"6px 14px",cursor:"pointer",fontFamily:T.font,opacity:strategyLoading?0.6:1}}>
                    {strategyLoading ? "Building plan..." : "Finalise Plan →"}
                  </button>
                </>
              )}
            </div>
          )}

          {messages.length >= 4 && thinkMode !== "plan" && (
            <div style={{paddingTop:10,borderTop:"1px solid "+T.border,marginBottom:8}}>
              {!savePreview && !saveConfirmed && (
                <button onClick={extractInsights} disabled={saving}
                  style={{fontSize:11,fontWeight:600,color:T.gold,background:T.goldL,border:"1px solid "+T.goldB,borderRadius:5,padding:"6px 14px",cursor:"pointer",fontFamily:T.font}}>
                  {saving ? "Scanning for insights..." : "Save insights to Brand Inputs →"}
                </button>
              )}
              {saveConfirmed && <div style={{fontSize:11,color:T.green,fontWeight:600,fontFamily:T.font}}>✓ Brand Inputs updated</div>}
              {savePreview && (
                <div style={{background:T.goldL,border:"1.5px solid "+T.goldB,borderRadius:7,padding:"12px 14px"}}>
                  <div style={{fontSize:11,fontWeight:600,color:T.gold,fontFamily:T.font,marginBottom:6}}>Ready to add to Brand Inputs</div>
                  {savePreview.notes && <div style={{fontSize:11,color:T.mid,fontFamily:T.font,marginBottom:8,fontStyle:"italic"}}>{savePreview.notes}</div>}
                  {savePreview.fields.length === 0
                    ? <div style={{fontSize:11,color:T.dim,fontFamily:T.font}}>No new insights to extract from this session.</div>
                    : <>
                      {savePreview.fields.map((f,i) => (
                        <div key={i} style={{marginBottom:6}}>
                          <div style={{fontSize:10,fontWeight:600,color:T.gold,fontFamily:T.font,textTransform:"uppercase",letterSpacing:0.5,marginBottom:2}}>{f.label}</div>
                          <div style={{fontSize:11,color:T.text,fontFamily:T.font,lineHeight:1.5,background:T.surface,padding:"6px 8px",borderRadius:4}}>{f.value}</div>
                        </div>
                      ))}
                      <div style={{display:"flex",gap:6,marginTop:10}}>
                        <Btn onClick={confirmSave} style={{fontSize:11,padding:"6px 14px"}}>Add to Brand Inputs →</Btn>
                        <Btn onClick={()=>setSavePreview(null)} variant="secondary" style={{fontSize:11,padding:"6px 10px"}}>Dismiss</Btn>
                      </div>
                    </>
                  }
                </div>
              )}
            </div>
          )}

          <div style={{display:"flex",gap:8,paddingTop:8,borderTop:"1px solid "+T.border}}>
            <textarea value={input} onChange={e=>setInput(e.target.value)}
              onKeyDown={e=>{if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();send();}}}
              placeholder="Reply... (Enter to send)" rows={2}
              style={{...taStyle,flex:1,fontSize:13,resize:"none"}}/>
            <Btn onClick={send} disabled={loading||!input.trim()}>Send</Btn>
          </div>
        </>
      )}
    </div>
  );
}

// ── BRAND INPUTS ──────────────────────────────────────────────────────────────
function PersonaBlock({which, brand, onUpdate, c, bg}) {
  const p = brand[which] || {};
  const label = which === "core_persona" ? "core" : "secondary";
  const upd = (k,v) => onUpdate({...brand,[which]:{...brand[which],[k]:v}});
  const updLang = (cat,arr) => onUpdate({...brand,[which]:{...brand[which],language:{...(brand[which]?.language||{}),[cat]:arr}}});
  const catC = {trigger:T.orange,pain:T.red,desire:T.green,objection:T.purple};
  const catLabel = {trigger:"Trigger phrases",pain:"Pain phrases",desire:"Desire phrases",objection:"Objection phrases"};
  const catDesc = {
    trigger:"The moment or situation that makes them reach for a solution",
    pain:"Exact words they use to describe the problem",
    desire:"Exact words they use to describe what they want",
    objection:"What makes them hesitate or not buy",
  };
  const ctx = "Brand: "+(brand.name||"")+(brand.organising_idea?"\nOrganising Idea: "+brand.organising_idea:"");

  return (
    <div style={{background:bg,border:"1px solid "+c+"20",borderRadius:8,padding:"16px 18px",marginBottom:16}}>
      <div style={{display:"flex",gap:12,marginBottom:0}}>
        <div style={{flex:2}}><FInput label="Name" value={p.name} onChange={v=>upd("name",v)} placeholder="e.g. Sara"/></div>
        <div style={{flex:1}}><FInput label="Age" value={p.age} onChange={v=>upd("age",v)} placeholder="28"/></div>
      </div>

      <div style={{marginBottom:12}}>
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:5}}>
          <Lbl>Description</Lbl>
          <AIAssistBtn label="Persona Description" onResult={v=>upd("desc",v)}
            prompt={ctx+"\n\nAsk the user: who is the "+label+" persona — their daily life, job, situation when they need this product. One conversational question."}/>
        </div>
        <textarea value={p.desc||""} onChange={e=>upd("desc",e.target.value)} rows={2}
          placeholder="Who is this person, their daily reality..."
          style={taStyle}/>
      </div>

      <div style={{marginBottom:12}}>
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:5}}>
          <Lbl>Primary Desire</Lbl>
          <AIAssistBtn label="Desire" onResult={v=>upd("desire",v)}
            prompt={ctx+(p.desc?"\nPersona: "+p.desc:"")+"\n\nAsk the user: what outcome or transformation does this persona want most — what does their ideal version of success look like? One conversational question."}/>
        </div>
        <input value={p.desire||""} onChange={e=>upd("desire",e.target.value)}
          placeholder="What they want most" style={inputStyle}/>
      </div>

      <div style={{marginBottom:12}}>
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:5}}>
          <Lbl>Primary Pain</Lbl>
          <AIAssistBtn label="Pain" onResult={v=>upd("pain",v)}
            prompt={ctx+(p.desc?"\nPersona: "+p.desc:"")+"\n\nAsk the user: what is the primary frustration, fear, or daily problem this persona experiences that the product solves? One conversational question."}/>
        </div>
        <input value={p.pain||""} onChange={e=>upd("pain",e.target.value)}
          placeholder="What problem they're experiencing" style={inputStyle}/>
      </div>

      <Divider m={12}/>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:6}}>
        <div>
          <Lbl>Language Bank</Lbl>
          <div style={{fontSize:11,color:T.dim,fontFamily:T.font,lineHeight:1.5,marginTop:2}}>Exact phrases your customers use. The AI uses these verbatim in every hook and brief.</div>
        </div>
      </div>

      {Object.keys(catC).map(cat => {
        const phrases = p.language?.[cat] || [];
        return (
          <div key={cat} style={{marginBottom:12}}>
            <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:4}}>
              <div style={{fontSize:10,fontWeight:700,letterSpacing:1.2,color:catC[cat],textTransform:"uppercase",fontFamily:T.font}}>{catLabel[cat]}</div>
              <AIAssistBtn label={catLabel[cat]} style={{}} onResult={v=>{
                const newPhrases = v.split("|").map(x=>x.trim()).filter(Boolean);
                updLang(cat,[...new Set([...phrases,...newPhrases])]);
              }} prompt={ctx+(p.desc?"\nPersona: "+p.desc:"")+(p.pain?"\nPain: "+p.pain:"")+(p.desire?"\nDesire: "+p.desire:"")+"\n\nContext: "+catDesc[cat]+"\n\nAsk the user: what exact words or phrases does this persona use when talking about their "+cat+"? Prompt them to share 3–5 real phrases they've seen in comments, reviews, or DMs. One conversational question."}/>
            </div>
            <div style={{fontSize:10,color:T.dim,fontFamily:T.font,marginBottom:6}}>{catDesc[cat]}</div>
            {[...phrases,""].map((ph,i) => (
              <input key={i} value={ph} onChange={e=>{
                const arr=[...phrases];
                if(i===arr.length) arr.push(e.target.value); else arr[i]=e.target.value;
                updLang(cat,arr.filter(x=>x));
              }} placeholder="Exact customer phrase..."
              style={{...inputStyle,fontSize:12,fontStyle:"italic",marginBottom:4}}/>
            ))}
          </div>
        );
      })}
    </div>
  );
}

function BrandInputsTab({brand, onUpdate}) {
  const upd = (k,v) => onUpdate({...brand,[k]:v});
  const [parsing, setParsing] = useState(false);
  const [setupMode, setSetupMode] = useState(!brand.name ? "choose" : null);
  const [guidedStep, setGuidedStep] = useState(0);
  const [guidedInput, setGuidedInput] = useState("");
  const [guidedLoading, setGuidedLoading] = useState(false);
  const [guidedQ, setGuidedQ] = useState("");
  const [resetConfirm, setResetConfirm] = useState(false);
  const fileRef = useRef();

  const GUIDED_STEPS = [
    {field:"name", prompt:"Ask the user for their brand name in one friendly sentence."},
    {field:"organising_idea", prompt:"Ask: what is the single central strategic thought that ties this brand together? Ask conversationally in one sentence."},
    {field:"strategic_tension", prompt:"Ask: what is the core contradiction their strategy must resolve — the gap between what their content attracts and what they actually need? Ask conversationally in one sentence."},
    {field:"white_space", prompt:"Ask: what messaging territory is nobody in their category currently owning? Ask conversationally in one sentence."},
    {field:"primary_principle", prompt:"Ask: does this brand lead with pain (problems, fears) or desire (aspirations, identity)? Ask conversationally in one sentence."},
    {field:"core_persona_desc", prompt:"Ask: who is the core customer — their daily life, situation when they need this product. Ask conversationally in one sentence."},
    {field:"core_persona_pain", prompt:"Ask: what is the primary frustration or fear this persona experiences that the product solves? Ask conversationally in one sentence."},
    {field:"core_persona_desire", prompt:"Ask: what outcome or transformation does this persona most want? Ask conversationally in one sentence."},
    {field:"proof_points", prompt:"Ask: what specific proof does this brand have — stats, results, testimonials with numbers? Ask conversationally in one sentence."},
  ];

  const startGuided = async () => {
    setSetupMode("guided"); setGuidedStep(0); setGuidedLoading(true);
    setGuidedQ("What's the brand name?");
    setGuidedLoading(false);
  };

  const nextGuidedStep = async () => {
    if (!guidedInput.trim()) return;
    const step = GUIDED_STEPS[guidedStep];
    let updated = {...brand};
    if (step.field === "name") updated.name = guidedInput.trim();
    else if (step.field === "organising_idea") updated.organising_idea = guidedInput.trim();
    else if (step.field === "strategic_tension") updated.strategic_tension = guidedInput.trim();
    else if (step.field === "white_space") updated.white_space = guidedInput.trim();
    else if (step.field === "primary_principle") updated.primary_principle = guidedInput.toLowerCase().includes("pain") ? "Pain-First" : "Desire-First";
    else if (step.field === "core_persona_desc") updated = {...updated,core_persona:{...(updated.core_persona||{}),desc:guidedInput.trim()}};
    else if (step.field === "core_persona_pain") updated = {...updated,core_persona:{...(updated.core_persona||{}),pain:guidedInput.trim()}};
    else if (step.field === "core_persona_desire") updated = {...updated,core_persona:{...(updated.core_persona||{}),desire:guidedInput.trim()}};
    else if (step.field === "proof_points") updated.proof_points = guidedInput.split(/[,\n|]/).map(x=>x.trim()).filter(Boolean);
    onUpdate(updated);
    const nextIdx = guidedStep + 1;
    setGuidedInput("");
    if (nextIdx >= GUIDED_STEPS.length) { setSetupMode(null); return; }
    setGuidedStep(nextIdx);
    setGuidedLoading(true);
    const q = await callClaude([{role:"user",content:GUIDED_STEPS[nextIdx].prompt}],
      "You are a friendly creative strategist onboarding a user. Ask one short, clear, conversational question. Maximum 2 sentences. No bullet points.",
      150).catch(() => "Tell me about this...");
    setGuidedQ(q); setGuidedLoading(false);
  };

  const handleFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setParsing(true); e.target.value = "";
    try {
      let text = "";
      if (file.name.endsWith(".docx") || file.name.endsWith(".doc")) { const ab=await file.arrayBuffer(); const r=await mammoth.extractRawText({arrayBuffer:ab}); text=r.value; }
      else if (file.name.endsWith(".pdf")) { text = await parsePDF(file); }
      else { text = await file.text(); }
      const raw = await callJSON(PARSE_PROMPT+"\n\nDOCUMENT:\n"+text.slice(0,12000));
      const parsed = JSON.parse(raw);
      onUpdate(additiveMerge(brand, parsed)); 
      setSetupMode(null);
    } catch { alert("Could not parse document. Try again."); }
    setParsing(false);
  };

  if (setupMode === "choose") return (
    <div style={{maxWidth:520,margin:"0 auto",paddingTop:32}}>
      <div style={{fontSize:15,fontWeight:700,color:T.text,fontFamily:T.font,marginBottom:6}}>Set up Brand Inputs</div>
      <div style={{fontSize:12,color:T.mid,fontFamily:T.font,marginBottom:24,lineHeight:1.6}}>Brand Inputs is the brain of the whole app. Every hook, brief, and angle reads this first. Takes 5 minutes. Makes everything 10× more specific.</div>
      <div style={{display:"flex",flexDirection:"column",gap:10}}>
        <button onClick={()=>fileRef.current?.click()}
          style={{background:T.surface,border:"1.5px solid "+T.border,borderRadius:9,padding:"16px 20px",cursor:"pointer",textAlign:"left"}}>
          <div style={{fontSize:13,fontWeight:600,color:T.text,fontFamily:T.font,marginBottom:3}}>I have a document</div>
          <div style={{fontSize:11,color:T.dim,fontFamily:T.font,lineHeight:1.5}}>Upload a Strategy Doc, CID, brand brief, or rough notes — AI extracts everything automatically.</div>
        </button>
        <button onClick={startGuided}
          style={{background:T.surface,border:"1.5px solid "+T.border,borderRadius:9,padding:"16px 20px",cursor:"pointer",textAlign:"left"}}>
          <div style={{fontSize:13,fontWeight:600,color:T.text,fontFamily:T.font,marginBottom:3}}>I don't have a document</div>
          <div style={{fontSize:11,color:T.dim,fontFamily:T.font,lineHeight:1.5}}>Answer 9 quick questions and AI fills everything in from your answers.</div>
        </button>
        <button onClick={()=>setSetupMode(null)}
          style={{background:"none",border:"none",fontSize:11,color:T.dim,fontFamily:T.font,cursor:"pointer",textDecoration:"underline",textAlign:"left",padding:"4px 0"}}>
          Skip — I'll fill it in manually
        </button>
      </div>
      <input ref={fileRef} type="file" accept=".txt,.md,.docx,.doc,.pdf" onChange={handleFile} style={{display:"none"}}/>
    </div>
  );

  if (setupMode === "guided") return (
    <div style={{maxWidth:520,margin:"0 auto",paddingTop:32}}>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:20}}>
        <div>
          <div style={{fontSize:13,fontWeight:600,color:T.text,fontFamily:T.font}}>Guided Setup</div>
          <div style={{fontSize:11,color:T.dim,fontFamily:T.font,marginTop:2}}>Step {guidedStep+1} of {GUIDED_STEPS.length}</div>
        </div>
        <div style={{height:4,flex:1,background:T.border,borderRadius:2,margin:"0 16px",overflow:"hidden"}}>
          <div style={{height:"100%",width:(guidedStep/GUIDED_STEPS.length*100)+"%",background:T.gold,transition:"width 0.3s"}}/>
        </div>
        <button onClick={()=>setSetupMode(null)} style={{fontSize:11,color:T.dim,background:"none",border:"none",cursor:"pointer",fontFamily:T.font}}>Skip to form</button>
      </div>
      <div style={{background:T.surface,border:"1.5px solid "+T.border,borderRadius:9,padding:"20px 22px"}}>
        <div style={{fontSize:14,color:T.text,fontFamily:T.font,lineHeight:1.7,marginBottom:16,minHeight:40}}>
          {guidedLoading ? <span style={{color:T.dim,fontStyle:"italic"}}>Thinking...</span> : guidedQ}
        </div>
        {!guidedLoading && <>
          <textarea value={guidedInput} onChange={e=>setGuidedInput(e.target.value)} rows={3}
            onKeyDown={e=>{if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();nextGuidedStep();}}}
            placeholder="Your answer... (Enter to continue)"
            style={{...taStyle,fontSize:13,marginBottom:10}}/>
          <Btn onClick={nextGuidedStep} disabled={!guidedInput.trim()} full>
            {guidedStep === GUIDED_STEPS.length-1 ? "Finish →" : "Next →"}
          </Btn>
        </>}
      </div>
    </div>
  );

  return (
    <div style={{maxWidth:680,margin:"0 auto"}}>
      <CompletenessBar brand={brand}/>

      <div style={{background:T.warm,border:"1.5px solid "+T.border,borderRadius:8,padding:"12px 16px",marginBottom:22,display:"flex",alignItems:"center",justifyContent:"space-between",gap:12,flexWrap:"wrap"}}>
        <div style={{fontSize:11,color:T.mid,fontFamily:T.font}}>Update from document — parses and merges into existing data.</div>
        <div style={{display:"flex",gap:8}}>
          <input ref={fileRef} type="file" accept=".txt,.md,.docx,.doc,.pdf" onChange={handleFile} style={{display:"none"}}/>
          <Btn onClick={()=>fileRef.current?.click()} variant="secondary" disabled={parsing} style={{fontSize:11,padding:"7px 12px"}}>{parsing?"Parsing...":"Upload & Parse"}</Btn>
          {!brand.name && <Btn onClick={()=>setSetupMode("choose")} variant="secondary" style={{fontSize:11,padding:"7px 12px"}}>Guided Setup</Btn>}
        </div>
      </div>

      <div style={{fontSize:11,fontWeight:700,color:T.text,marginBottom:12,paddingBottom:8,borderBottom:"1.5px solid "+T.border,fontFamily:T.font,letterSpacing:0.5,textTransform:"uppercase"}}>
        Strategic Foundation
      </div>
      <FInput label="Brand Name" value={brand.name} onChange={v=>upd("name",v)} placeholder="Brand name"/>
      <div style={{marginBottom:14}}>
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:5}}>
          <Lbl>Organising Idea</Lbl>
          <AIAssistBtn label="Organising Idea" onResult={v=>upd("organising_idea",v)} prompt="Ask the user: what is the single central thought that ties this brand together — its fundamental strategic position? Ask conversationally in one sentence."/>
        </div>
        <textarea value={brand.organising_idea||""} onChange={e=>upd("organising_idea",e.target.value)} rows={2} placeholder="The single central thought that ties everything together" style={taStyle}/>
      </div>
      <div style={{marginBottom:14}}>
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:5}}>
          <Lbl>Strategic Tension</Lbl>
          <AIAssistBtn label="Strategic Tension" onResult={v=>upd("strategic_tension",v)} prompt="Ask the user: what is the core contradiction their strategy must resolve — the gap between what their content attracts and what they actually need? Ask conversationally in one sentence."/>
        </div>
        <textarea value={brand.strategic_tension||""} onChange={e=>upd("strategic_tension",e.target.value)} rows={2} placeholder="The core contradiction strategy must resolve" style={taStyle}/>
      </div>
      <div style={{marginBottom:14}}>
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:5}}>
          <Lbl>White Space</Lbl>
          <AIAssistBtn label="White Space" onResult={v=>upd("white_space",v)} prompt="Ask the user: what messaging territory is nobody in their category currently owning — what angle is available that competitors are ignoring? Ask conversationally in one sentence."/>
        </div>
        <textarea value={brand.white_space||""} onChange={e=>upd("white_space",e.target.value)} rows={2} placeholder="What nobody in the category is currently owning" style={taStyle}/>
      </div>
      <div style={{marginBottom:16}}>
        <Lbl>Primary Organising Principle</Lbl>
        <div style={{fontSize:11,color:T.dim,fontFamily:T.font,marginBottom:8,lineHeight:1.5}}>Sets the default hook direction in every Hook Builder session. Pain-First pre-selects the Pain/Fear trigger. Desire-First pre-selects the Desire/Identity trigger. You can always change it per brief.</div>
        <div style={{display:"flex",gap:10}}>
          <ChoiceBtn label="Pain-First" sub="Lead with the problem" selected={brand.primary_principle==="Pain-First"} onSelect={()=>upd("primary_principle","Pain-First")} c={T.red} bg={T.redL} b={T.red}/>
          <ChoiceBtn label="Desire-First" sub="Lead with the vision" selected={brand.primary_principle==="Desire-First"} onSelect={()=>upd("primary_principle","Desire-First")} c={T.gold} bg={T.goldL} b={T.goldB}/>
        </div>
      </div>
      <Divider/>

      <div style={{fontSize:11,fontWeight:700,color:T.text,marginBottom:12,paddingBottom:8,borderBottom:"1.5px solid "+T.border,fontFamily:T.font,letterSpacing:0.5,textTransform:"uppercase"}}>
        Core Persona <span style={{fontWeight:400,color:T.dim,textTransform:"none"}}>Phase 1</span>
      </div>
      <PersonaBlock which="core_persona" brand={brand} onUpdate={onUpdate} c={T.green} bg={T.greenL}/>

      <div style={{fontSize:11,fontWeight:700,color:T.text,marginBottom:12,paddingBottom:8,borderBottom:"1.5px solid "+T.border,fontFamily:T.font,letterSpacing:0.5,textTransform:"uppercase"}}>
        Secondary Persona <span style={{fontWeight:400,color:T.dim,textTransform:"none"}}>Phase 2</span>
      </div>
      <PersonaBlock which="secondary_persona" brand={brand} onUpdate={onUpdate} c={T.blue} bg={T.blueL}/>
      <Divider/>

      <div style={{fontSize:11,fontWeight:700,color:T.text,marginBottom:12,paddingBottom:8,borderBottom:"1.5px solid "+T.border,fontFamily:T.font,letterSpacing:0.5,textTransform:"uppercase",display:"flex",alignItems:"center",justifyContent:"space-between"}}>
        Proof Points
        <AIAssistBtn label="Proof Points" onResult={v=>upd("proof_points",v.split("|").map(x=>x.trim()).filter(Boolean))} prompt="Ask the user: what specific proof does this brand have — stats, testimonials, results with numbers? Ask conversationally in one sentence."/>
      </div>
      {[...(brand.proof_points||[]),""].map((pt,i) => (
        <input key={i} value={pt} onChange={e=>{const arr=[...(brand.proof_points||[])];if(i===arr.length)arr.push(e.target.value);else arr[i]=e.target.value;upd("proof_points",arr.filter(x=>x));}}
          placeholder={"Proof point "+(i+1)} style={{...inputStyle,marginBottom:6,fontSize:12}}/>
      ))}
      <Divider/>

      {(brand.concepts||[]).length > 0 && (
        <>
          <div style={{fontSize:11,fontWeight:700,color:T.text,marginBottom:12,paddingBottom:8,borderBottom:"1.5px solid "+T.border,fontFamily:T.font,letterSpacing:0.5,textTransform:"uppercase"}}>
            Saved Concepts ({brand.concepts.length})
          </div>
          {brand.concepts.map((c,i) => (
            <div key={i} style={{background:T.warm,border:"1.5px solid "+T.border,borderRadius:6,padding:"11px 14px",marginBottom:8,display:"flex",alignItems:"flex-start",justifyContent:"space-between",gap:10}}>
              <div>
                <div style={{fontSize:12,fontWeight:600,color:T.text,fontFamily:T.font,marginBottom:4}}>{c.name}</div>
                <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
                  <Chip label={c.awareness||""} c={T.mid} bg={T.surface} b={T.border}/>
                  <Chip label={c.angle||""} c={T.dim} bg={T.surface} b={T.border}/>
                </div>
              </div>
              <button onClick={()=>onUpdate({...brand,concepts:brand.concepts.filter((_,idx)=>idx!==i)})} style={{fontSize:12,color:T.dim,background:"none",border:"none",cursor:"pointer",flexShrink:0}}>✕</button>
            </div>
          ))}
          <Divider/>
        </>
      )}

      {!resetConfirm
        ? <button onClick={()=>setResetConfirm(true)} style={{fontSize:11,color:T.dim,background:"none",border:"none",cursor:"pointer",textDecoration:"underline",fontFamily:T.font}}>Reset all brand data</button>
        : <div style={{background:T.redL,border:"1.5px solid "+T.red,borderRadius:7,padding:"13px 16px",display:"flex",alignItems:"center",gap:10,flexWrap:"wrap"}}>
            <div style={{fontSize:12,color:T.red,flex:1,fontFamily:T.font}}>Delete all brand data? Cannot be undone.</div>
            <Btn onClick={()=>{onUpdate({...EMPTY_BRAND,name:brand.name});setResetConfirm(false);}} style={{background:T.red,color:"#fff",border:"none",fontSize:11}}>Delete</Btn>
            <Btn onClick={()=>setResetConfirm(false)} variant="secondary" style={{fontSize:11}}>Cancel</Btn>
          </div>
      }
    </div>
  );
}

// ── STRATEGY TREE ─────────────────────────────────────────────────────────────
function TreeTab({brand, onUpdate, onRunInHookBuilder}) {
  const [expandedPhase, setExpandedPhase] = useState(0);
  const [deleteConfirm, setDeleteConfirm] = useState(null); // {type:"test"|"phase", phaseIdx, testIdx}
  const [unlockConfirm, setUnlockConfirm] = useState(null); // phaseIdx
  const [winningNote, setWinningNote] = useState("");
  const savedBriefs = brand.savedBriefs || [];
  const running = brand.runningConcepts || [];
  const plan = brand.testStrategy || null;

  const awCols = {
    "Unaware":{c:T.red,bg:T.redL,b:T.red},
    "Problem Aware":{c:T.orange,bg:T.orangeL,b:T.orange},
    "Solution Aware":{c:T.gold,bg:T.goldL,b:T.goldB},
    "Product Aware":{c:T.blue,bg:T.blueL,b:T.blue},
    "Most Aware":{c:T.green,bg:T.greenL,b:T.green},
  };

  const getTestStatus = (test) => {
    const hook = savedBriefs.find(b=>
      b.selections?.persona===test.persona &&
      b.selections?.awareness===test.awareness &&
      b.selections?.angle===test.angle
    );
    const live = running.find(r=>r.persona===test.persona||r.selections?.persona===test.persona);
    if (live) return "live";
    if (hook) return "building";
    return "queued";
  };

  const getPhaseStatus = (phase) => {
    if (phase.status==="locked") return "locked";
    const tests = phase.tests||[];
    const statuses = tests.map(getTestStatus);
    if (statuses.length && statuses.every(s=>s==="live")) return "done";
    if (statuses.some(s=>s==="live"||s==="building")) return "active";
    return phase.status||"queued";
  };

  const deleteTest = (phaseIdx, testIdx) => {
    const updated = JSON.parse(JSON.stringify(plan));
    updated.phases[phaseIdx].tests.splice(testIdx, 1);
    // Re-number priorities
    let p = 1;
    updated.phases.forEach(ph => (ph.tests||[]).forEach(t => { t.priority = p++; }));
    onUpdate({...brand, testStrategy: updated});
    setDeleteConfirm(null);
  };

  const deletePhase = (phaseIdx) => {
    const updated = JSON.parse(JSON.stringify(plan));
    updated.phases.splice(phaseIdx, 1);
    // Renumber phases
    updated.phases.forEach((ph,i) => { ph.phase = i+1; });
    let p = 1;
    updated.phases.forEach(ph => (ph.tests||[]).forEach(t => { t.priority = p++; }));
    onUpdate({...brand, testStrategy: updated});
    setDeleteConfirm(null);
    setExpandedPhase(Math.max(0, phaseIdx-1));
  };

  const markTestLive = (phaseIdx, testIdx) => {
    const updated = JSON.parse(JSON.stringify(plan));
    updated.phases[phaseIdx].tests[testIdx].status = "live";
    // Also add to runningConcepts so What's Running tab knows
    const test = updated.phases[phaseIdx].tests[testIdx];
    const newRunning = [...(brand.runningConcepts||[])];
    // Only add if not already there
    const alreadyLive = newRunning.find(r=>r._planTestId===test.id);
    if (!alreadyLive) {
      newRunning.push({
        id: Date.now(),
        _planTestId: test.id,
        name: `${test.angle} — ${test.subtype||test.format}`,
        persona: test.persona,
        awareness: test.awareness,
        angle: test.angle,
        format: test.subtype||test.format,
        phase: updated.phases[phaseIdx].label,
        status: "live",
        started: new Date().toLocaleDateString(),
      });
    }
    onUpdate({...brand, testStrategy: updated, runningConcepts: newRunning});
  };

  const unlockNextPhase = (phaseIdx) => {
    const updated = JSON.parse(JSON.stringify(plan));
    // Mark current phase done, record winning note
    updated.phases[phaseIdx].status = "done";
    if (winningNote.trim()) updated.phases[phaseIdx].winner_note = winningNote.trim();
    // Unlock next phase
    if (updated.phases[phaseIdx+1]) {
      updated.phases[phaseIdx+1].status = "active";
    }
    onUpdate({...brand, testStrategy: updated});
    setUnlockConfirm(null);
    setWinningNote("");
    setExpandedPhase(phaseIdx+1);
  };

  if (!brand.name) return (
    <div style={{padding:48,textAlign:"center",color:T.dim,fontSize:13,fontFamily:T.font}}>Fill in Brand Inputs first.</div>
  );

  if (!plan) return (
    <div style={{maxWidth:600,margin:"0 auto",padding:"48px 20px",textAlign:"center"}}>
      <div style={{fontSize:32,marginBottom:16}}>📋</div>
      <div style={{fontSize:16,fontWeight:700,color:T.text,fontFamily:T.font,marginBottom:8}}>No test plan yet</div>
      <div style={{fontSize:13,color:T.mid,fontFamily:T.font,lineHeight:1.7,marginBottom:24}}>
        Go to <b>Think Mode → Build test plan</b> to walk through your strategy with an AI partner. It builds a phased roadmap showing exactly what to test, in what order, and what each result tells you.
      </div>
      <div style={{background:T.warm,border:"1.5px solid "+T.border,borderRadius:8,padding:"16px 20px",textAlign:"left"}}>
        <div style={{fontSize:11,fontWeight:700,color:T.text,fontFamily:T.font,marginBottom:10,letterSpacing:0.5,textTransform:"uppercase"}}>What the plan gives you</div>
        {["Which persona to lead with and why","Which awareness stage to enter first","What angles to test in sequence","What winning unlocks — what losing tells you","When to move to the next persona"].map((item,i)=>(
          <div key={i} style={{display:"flex",gap:8,marginBottom:6}}>
            <div style={{color:T.gold,fontSize:12,flexShrink:0,marginTop:1}}>→</div>
            <div style={{fontSize:12,color:T.mid,fontFamily:T.font,lineHeight:1.5}}>{item}</div>
          </div>
        ))}
      </div>
    </div>
  );

  // Delete confirmation modal
  const DeleteModal = () => {
    if (!deleteConfirm) return null;
    const isPhase = deleteConfirm.type === "phase";
    const ph = plan.phases?.[deleteConfirm.phaseIdx];
    const t = ph?.tests?.[deleteConfirm.testIdx];
    return (
      <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.4)",zIndex:1000,display:"flex",alignItems:"center",justifyContent:"center"}}>
        <div style={{background:T.surface,border:"1.5px solid "+T.border,borderRadius:10,padding:"24px 28px",maxWidth:380,width:"90%",fontFamily:T.font}}>
          <div style={{fontSize:14,fontWeight:700,color:T.text,marginBottom:8}}>
            {isPhase ? `Delete Phase ${deleteConfirm.phaseIdx+1}: ${ph?.label}?` : `Delete this test?`}
          </div>
          <div style={{fontSize:12,color:T.mid,lineHeight:1.6,marginBottom:20}}>
            {isPhase
              ? `This will remove the entire phase and all ${(ph?.tests||[]).length} tests inside it. This cannot be undone.`
              : `Remove "${t?.angle}" (${t?.awareness}) from ${ph?.label}? This cannot be undone.`}
          </div>
          <div style={{display:"flex",gap:8}}>
            <button onClick={()=>isPhase?deletePhase(deleteConfirm.phaseIdx):deleteTest(deleteConfirm.phaseIdx,deleteConfirm.testIdx)}
              style={{flex:1,background:T.red,color:"#fff",border:"none",borderRadius:6,padding:"9px 0",fontSize:12,fontWeight:700,cursor:"pointer",fontFamily:T.font}}>
              Yes, delete
            </button>
            <button onClick={()=>setDeleteConfirm(null)}
              style={{flex:1,background:T.warm,color:T.text,border:"1.5px solid "+T.border,borderRadius:6,padding:"9px 0",fontSize:12,fontWeight:600,cursor:"pointer",fontFamily:T.font}}>
              Cancel
            </button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div style={{maxWidth:860,margin:"0 auto",position:"relative"}}>
      <DeleteModal/>

      {/* Plan header */}
      <div style={{background:T.surface,border:"1.5px solid "+T.border,borderRadius:10,padding:"14px 18px",marginBottom:16,display:"flex",alignItems:"flex-start",justifyContent:"space-between",gap:12,flexWrap:"wrap"}}>
        <div style={{flex:1}}>
          <div style={{fontSize:10,fontWeight:700,letterSpacing:0.8,textTransform:"uppercase",color:T.dim,fontFamily:T.font,marginBottom:3}}>Active Plan · v{plan.version||1} · {plan.generated}</div>
          <div style={{fontSize:13,fontWeight:700,color:T.text,fontFamily:T.font,marginBottom:2}}>Lead: {plan.lead_persona}</div>
          <div style={{fontSize:11,color:T.mid,fontFamily:T.font,lineHeight:1.5}}>{plan.lead_persona_why}</div>
        </div>
        {/* Phase pills */}
        <div style={{display:"flex",gap:5,flexWrap:"wrap",flexShrink:0,alignItems:"center"}}>
          {(plan.phases||[]).map((ph,i)=>{
            const st = getPhaseStatus(ph);
            const isActive = expandedPhase===i;
            return (
              <button key={i} onClick={()=>setExpandedPhase(i)}
                style={{padding:"4px 10px",borderRadius:20,border:"1.5px solid "+(isActive?T.text:T.border),background:isActive?T.text:st==="done"?T.greenL:st==="active"?T.goldL:T.warm,fontSize:10,fontWeight:700,color:isActive?"#fff":st==="done"?T.green:st==="active"?T.gold:T.dim,fontFamily:T.font,cursor:"pointer"}}>
                {st==="done"?"✓ ":""}P{i+1}
              </button>
            );
          })}
        </div>
      </div>

      {/* Phase detail */}
      {(plan.phases||[]).map((phase, phaseIdx) => {
        if (expandedPhase !== phaseIdx) return null;
        const phStatus = getPhaseStatus(phase);
        const isLocked = phStatus==="locked";
        const isDone = phStatus==="done";
        const awCol = awCols[phase.awareness]||{c:T.mid,bg:T.warm,b:T.border};

        return (
          <div key={phaseIdx}>
            {/* Phase title bar */}
            <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:12}}>
              <div style={{width:28,height:28,borderRadius:"50%",background:isDone?T.green:phStatus==="active"?T.gold:T.border,display:"flex",alignItems:"center",justifyContent:"center",fontSize:12,fontWeight:700,color:isDone||phStatus==="active"?"#fff":T.dim,fontFamily:T.font,flexShrink:0}}>
                {isDone?"✓":phaseIdx+1}
              </div>
              <div style={{flex:1}}>
                <div style={{fontSize:14,fontWeight:700,color:isLocked?T.dim:T.text,fontFamily:T.font}}>{phase.label} {isLocked&&"🔒"}</div>
                <div style={{fontSize:11,color:T.dim,fontFamily:T.font}}>{phase.persona} · <span style={{color:awCol.c}}>{phase.awareness}</span> · {(phase.tests||[]).length} test{(phase.tests||[]).length!==1?"s":""}</div>
              </div>
              {isDone && phase.winner_note && (
                <div style={{fontSize:10,color:T.mid,fontFamily:T.font,fontStyle:"italic",maxWidth:180,textAlign:"right",lineHeight:1.4}}>{phase.winner_note}</div>
              )}
              {/* Delete phase button */}
              <button onClick={()=>setDeleteConfirm({type:"phase",phaseIdx})}
                style={{fontSize:11,color:T.dim,background:"none",border:"1px solid "+T.border,borderRadius:5,padding:"4px 8px",cursor:"pointer",fontFamily:T.font,flexShrink:0}}>
                Delete phase
              </button>
            </div>

            {/* Mission brief card */}
            <div style={{background:isLocked?T.warm:phStatus==="active"?T.goldL:phStatus==="done"?T.greenL:T.surface,border:"1.5px solid "+(isLocked?T.border:phStatus==="active"?T.goldB:phStatus==="done"?T.green:T.border),borderRadius:8,padding:"16px 18px",marginBottom:14}}>

              {/* The one thing changing */}
              {phase.variable && (
                <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:12,flexWrap:"wrap"}}>
                  <div style={{fontSize:11,fontWeight:700,color:isLocked?T.dim:T.text,fontFamily:T.font}}>
                    {(phase.tests||[]).length} ads running at the same time
                  </div>
                  <div style={{display:"flex",alignItems:"center",gap:4}}>
                    <div style={{fontSize:10,color:T.dim,fontFamily:T.font}}>changing:</div>
                    <div style={{fontSize:10,fontWeight:700,background:isLocked?T.border:T.text,color:"#fff",borderRadius:3,padding:"2px 8px",fontFamily:T.font,textTransform:"uppercase",letterSpacing:0.5}}>{phase.variable}</div>
                  </div>
                  <div style={{fontSize:10,color:T.dim,fontFamily:T.font}}>everything else identical</div>
                </div>
              )}

              {/* What you're holding constant */}
              {!isLocked && phase.format && phase.variable==="angle" && (
                <div style={{fontSize:12,color:T.mid,fontFamily:T.font,lineHeight:1.6,marginBottom:10}}>
                  Holding constant: <b style={{color:T.text}}>{phase.format}{phase.subtype?` · ${phase.subtype}`:""}</b> — so the only difference between each ad is the message angle.
                </div>
              )}
              {!isLocked && phase.angle && phase.variable==="format" && (
                <div style={{fontSize:12,color:T.mid,fontFamily:T.font,lineHeight:1.6,marginBottom:10}}>
                  Winning angle locked in: <b style={{color:T.text}}>{phase.angle}</b> — the message is fixed, now finding which format carries it best.
                </div>
              )}

              {/* What you're learning */}
              {phase.what_we_are_learning && !isLocked && (
                <div style={{background:"rgba(255,255,255,0.6)",border:"1px solid "+T.border,borderRadius:5,padding:"8px 11px",marginBottom:12}}>
                  <div style={{fontSize:9,fontWeight:700,color:T.gold,letterSpacing:0.8,textTransform:"uppercase",marginBottom:3,fontFamily:T.font}}>What you're trying to learn</div>
                  <div style={{fontSize:12,color:T.text,fontFamily:T.font,lineHeight:1.5}}>{phase.what_we_are_learning}</div>
                </div>
              )}

              {/* Metrics to watch */}
              {!isLocked && (
                <div style={{marginBottom:12}}>
                  <div style={{fontSize:9,fontWeight:700,color:T.mid,letterSpacing:0.8,textTransform:"uppercase",marginBottom:6,fontFamily:T.font}}>What to watch — check after 5–7 days</div>
                  <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
                    {[
                      {label:"Hook Rate >30%",desc:"First 3 seconds stopping the scroll"},
                      {label:"CTR >2%",desc:"Full message is landing"},
                      {label:"Add-to-Cart >1.5%",desc:"She's convinced enough to consider"},
                    ].map((m,i)=>(
                      <div key={i} style={{background:"rgba(255,255,255,0.7)",border:"1px solid "+T.border,borderRadius:5,padding:"6px 10px",flex:"1 1 120px"}}>
                        <div style={{fontSize:11,fontWeight:700,color:T.text,fontFamily:T.font,marginBottom:1}}>{m.label}</div>
                        <div style={{fontSize:10,color:T.mid,fontFamily:T.font,lineHeight:1.4}}>{m.desc}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* When to move on */}
              {!isLocked && phase.unlock_condition && (
                <div style={{display:"flex",alignItems:"flex-start",gap:8,paddingTop:10,borderTop:"1px solid "+(phStatus==="active"?T.goldB:T.border)}}>
                  <div style={{fontSize:13,flexShrink:0}}>🔓</div>
                  <div style={{fontSize:11,fontFamily:T.font,lineHeight:1.5}}>
                    <b style={{color:T.text}}>Move to next phase when: </b>
                    <span style={{color:T.mid}}>{phase.unlock_condition}</span>
                    <span style={{color:T.dim}}> — come back here, hit "Phase complete", record which variant won.</span>
                  </div>
                </div>
              )}

              {/* Locked state */}
              {isLocked && (
                <div style={{fontSize:12,color:T.dim,fontFamily:T.font,lineHeight:1.6}}>
                  {phase.description} <b style={{color:T.mid}}>Unlocks when: {phase.unlock_condition||"previous phase complete"}</b>
                </div>
              )}
            </div>

            {/* Tests */}
            {!isLocked && (phase.tests||[]).map((test, testIdx) => {
              const tStatus = getTestStatus(test);
              const tAwCol = awCols[test.awareness]||{c:T.mid,bg:T.warm,b:T.border};
              const statusColor = tStatus==="live"?T.green:tStatus==="building"?T.gold:T.mid;
              const statusLabel = tStatus==="live"?"Live ✓":tStatus==="building"?"Hook saved":"Not started";

              return (
                <div key={testIdx} style={{background:T.surface,border:"1.5px solid "+T.border,borderLeft:"4px solid "+tAwCol.c,borderRadius:8,padding:"16px 18px",marginBottom:10,position:"relative"}}>
                  {/* Delete test */}
                  <button onClick={()=>setDeleteConfirm({type:"test",phaseIdx,testIdx})}
                    style={{position:"absolute",top:10,right:10,background:"none",border:"none",cursor:"pointer",color:T.dim,fontSize:15,lineHeight:1,padding:"2px 4px",fontFamily:T.font}}
                    title="Remove test">×</button>

                  <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",gap:12,paddingRight:20}}>
                    <div style={{flex:1,minWidth:0}}>

                      {/* Variant label + chips */}
                      <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:10,flexWrap:"wrap"}}>
                        <div style={{width:22,height:22,borderRadius:4,background:T.text,display:"flex",alignItems:"center",justifyContent:"center",fontSize:10,fontWeight:700,color:"#fff",flexShrink:0,fontFamily:T.font,letterSpacing:0.5}}>
                          {String.fromCharCode(65+testIdx)}
                        </div>
                        {phase.variable==="angle" && <Chip label={test.angle} c={T.purple} bg={T.purpleL} b={T.purple}/>}
                        {phase.variable==="format" && <Chip label={test.subtype||test.format} c={T.blue} bg={T.blueL} b={T.blue}/>}
                        {phase.variable!=="angle" && phase.variable!=="format" && <Chip label={test.angle} c={T.purple} bg={T.purpleL} b={T.purple}/>}
                        {phase.variable==="angle" && test.subtype && <Chip label={test.subtype} c={T.blue} bg={T.blueL} b={T.blue}/>}
                        <Chip label={test.awareness} c={tAwCol.c} bg={tAwCol.bg} b={tAwCol.b}/>
                      </div>

                      {/* Hypothesis */}
                      <div style={{marginBottom:10}}>
                        <div style={{fontSize:10,fontWeight:700,color:T.mid,letterSpacing:0.5,textTransform:"uppercase",marginBottom:3,fontFamily:T.font}}>Hypothesis</div>
                        <div style={{fontSize:12,color:T.mid,fontFamily:T.font,lineHeight:1.6,fontStyle:"italic"}}>"{test.hypothesis}"</div>
                      </div>

                      {/* Win condition */}
                      <div style={{fontSize:11,color:T.dim,fontFamily:T.font,marginBottom:12}}>
                        <b style={{color:T.text,fontWeight:600}}>Win if: </b>{test.success_metric}
                      </div>

                      {/* Win / Lose paths */}
                      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
                        <div style={{background:T.greenL,border:"1px solid "+T.green+"40",borderRadius:6,padding:"8px 10px"}}>
                          <div style={{fontSize:9,fontWeight:700,color:T.green,letterSpacing:0.8,textTransform:"uppercase",marginBottom:3,fontFamily:T.font}}>Win → next</div>
                          <div style={{fontSize:11,color:T.text,fontFamily:T.font,lineHeight:1.5}}>{test.win_next}</div>
                        </div>
                        <div style={{background:T.redL,border:"1px solid "+T.red+"40",borderRadius:6,padding:"8px 10px"}}>
                          <div style={{fontSize:9,fontWeight:700,color:T.red,letterSpacing:0.8,textTransform:"uppercase",marginBottom:3,fontFamily:T.font}}>Lose → tells us</div>
                          <div style={{fontSize:11,color:T.text,fontFamily:T.font,lineHeight:1.5}}>{test.lose_next}</div>
                        </div>
                      </div>
                    </div>

                    {/* Status + action */}
                    <div style={{display:"flex",flexDirection:"column",alignItems:"flex-end",gap:6,flexShrink:0}}>
                      <div style={{background:tStatus==="live"?T.greenL:tStatus==="building"?T.goldL:T.warm,border:"1px solid "+(tStatus==="live"?T.green:tStatus==="building"?T.goldB:T.border),borderRadius:5,padding:"3px 10px",fontSize:10,fontWeight:700,color:statusColor,fontFamily:T.font,whiteSpace:"nowrap"}}>
                        {statusLabel}
                      </div>
                      {tStatus==="queued" && (
                        <button onClick={()=>{
                          // Compute locked fields based on what's constant in this phase
                          const variable = phase.variable||"angle";
                          const allFields = ["persona","awareness","angle","format","subtype"];
                          const lockedFields = allFields.filter(f=>f!==variable);
                          onRunInHookBuilder&&onRunInHookBuilder({
                            persona:test.persona,
                            awareness:test.awareness,
                            angle:test.angle,
                            format:test.format,
                            subtype:test.subtype,
                            formula:test.formula,
                            _planLocked:{
                              phaseName:phase.label,
                              variable,
                              lockedFields,
                            }
                          });
                        }}
                          style={{fontSize:11,fontWeight:700,color:"#fff",background:T.text,border:"none",borderRadius:5,padding:"7px 14px",cursor:"pointer",fontFamily:T.font,whiteSpace:"nowrap"}}>
                          Build hooks →
                        </button>
                      )}
                      {tStatus==="building" && (
                        <button onClick={()=>{
                          const variable = phase.variable||"angle";
                          const allFields = ["persona","awareness","angle","format","subtype"];
                          const lockedFields = allFields.filter(f=>f!==variable);
                          onRunInHookBuilder&&onRunInHookBuilder({
                            persona:test.persona,awareness:test.awareness,angle:test.angle,
                            format:test.format,subtype:test.subtype,formula:test.formula,
                            _planLocked:{phaseName:phase.label,variable,lockedFields}
                          });
                        }}
                          style={{fontSize:11,fontWeight:600,color:T.gold,background:T.goldL,border:"1px solid "+T.goldB,borderRadius:5,padding:"7px 14px",cursor:"pointer",fontFamily:T.font,whiteSpace:"nowrap"}}>
                          Edit hooks →
                        </button>
                      )}
                      {tStatus==="building" && (
                        <button onClick={()=>markTestLive(phaseIdx, testIdx)}
                          style={{fontSize:11,fontWeight:700,color:"#fff",background:T.green,border:"none",borderRadius:5,padding:"7px 14px",cursor:"pointer",fontFamily:T.font,whiteSpace:"nowrap"}}>
                          Mark live ✓
                        </button>
                      )}
                      {tStatus==="live" && (
                        <div style={{fontSize:10,color:T.green,fontFamily:T.font,fontWeight:600,textAlign:"right"}}>Running in<br/>ad account</div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}

            {isLocked && (
              <div style={{textAlign:"center",padding:"24px 0",color:T.dim,fontSize:12,fontFamily:T.font,fontStyle:"italic"}}>
                Tests visible once this phase unlocks.
              </div>
            )}

            {/* Unlock next phase button — only on active, non-final phase */}
            {phStatus==="active" && phaseIdx < (plan.phases||[]).length-1 && (
              <div style={{marginTop:14,marginBottom:2}}>
                {!unlockConfirm ? (
                  <button onClick={()=>setUnlockConfirm(phaseIdx)}
                    style={{width:"100%",padding:"10px 0",background:T.surface,border:"1.5px solid "+T.text,borderRadius:7,fontSize:12,fontWeight:700,color:T.text,cursor:"pointer",fontFamily:T.font}}>
                    ✓ Phase complete — unlock Phase {phaseIdx+2}
                  </button>
                ) : unlockConfirm===phaseIdx ? (
                  <div style={{background:T.goldL,border:"1.5px solid "+T.goldB,borderRadius:7,padding:"12px 16px"}}>
                    <div style={{fontSize:12,fontWeight:600,color:T.text,fontFamily:T.font,marginBottom:6}}>Which test won? (optional — helps future planning)</div>
                    <input value={winningNote} onChange={e=>setWinningNote(e.target.value)}
                      placeholder={`e.g. "${(phase.tests||[])[0]?.angle||"Angle A"} won — CTR 3.2%, Hook Rate 42%"`}
                      style={{width:"100%",padding:"7px 10px",borderRadius:5,border:"1px solid "+T.goldB,fontSize:11,fontFamily:T.font,marginBottom:10,boxSizing:"border-box",background:T.surface}}/>
                    <div style={{display:"flex",gap:8}}>
                      <button onClick={()=>unlockNextPhase(phaseIdx)}
                        style={{flex:1,padding:"8px 0",background:T.text,color:"#fff",border:"none",borderRadius:5,fontSize:12,fontWeight:700,cursor:"pointer",fontFamily:T.font}}>
                        Unlock Phase {phaseIdx+2} →
                      </button>
                      <button onClick={()=>{setUnlockConfirm(null);setWinningNote("");}}
                        style={{padding:"8px 14px",background:T.warm,color:T.text,border:"1.5px solid "+T.border,borderRadius:5,fontSize:11,cursor:"pointer",fontFamily:T.font}}>
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : null}
              </div>
            )}

            {/* Phase nav */}
            <div style={{display:"flex",justifyContent:"space-between",marginTop:12,paddingTop:12,borderTop:"1px solid "+T.border}}>
              <button onClick={()=>setExpandedPhase(Math.max(0,phaseIdx-1))} disabled={phaseIdx===0}
                style={{fontSize:11,color:phaseIdx===0?T.dim:T.text,background:"none",border:"none",cursor:phaseIdx===0?"default":"pointer",fontFamily:T.font,fontWeight:600,padding:0}}>
                ← Phase {phaseIdx}
              </button>
              <div style={{fontSize:10,color:T.dim,fontFamily:T.font,alignSelf:"center"}}>Phase {phaseIdx+1} of {(plan.phases||[]).length}</div>
              <button onClick={()=>setExpandedPhase(Math.min((plan.phases||[]).length-1,phaseIdx+1))} disabled={phaseIdx===(plan.phases||[]).length-1}
                style={{fontSize:11,color:phaseIdx===(plan.phases||[]).length-1?T.dim:T.text,background:"none",border:"none",cursor:phaseIdx===(plan.phases||[]).length-1?"default":"pointer",fontFamily:T.font,fontWeight:600,padding:0}}>
                Phase {phaseIdx+2} →
              </button>
            </div>
          </div>
        );
      })}

      <div style={{marginTop:20,fontSize:11,color:T.dim,fontFamily:T.font,fontStyle:"italic",textAlign:"center"}}>
        Status updates automatically as you save hooks and mark concepts live. Rebuild in Think Mode → Build test plan.
      </div>
    </div>
  );
}


// ── HOOK BUILDER ──────────────────────────────────────────────────────────────
function HookTab({brand, onUpdate, prefill, clearPrefill, active}) {
  const STEP_KEYS = ["principle","persona","awareness","angle","format","subtype","formula"];
  const [step, setStep] = useState(0);
  const [sel, setSel] = useState({});
  const [stage, setStage] = useState("deciding");
  const [hooks, setHooks] = useState([]);
  const [allPrevHooks, setAllPrevHooks] = useState([]);
  const [chosen, setChosen] = useState(null);
  const [editedHook, setEditedHook] = useState("");
  const [brief, setBrief] = useState(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [dissectMechanism, setDissectMechanism] = useState(null);
  const [planLocked, setPlanLocked] = useState(null); // {phaseName, variable, lockedFields:[]}
  const [editedBody, setEditedBody] = useState({});
  const [editedCta, setEditedCta] = useState({});

  const hasBrandData = !!(brand?.name && brand?.organising_idea && brand?.core_persona?.name);

  useEffect(() => {
    if (!active) return;
    if (prefill && Object.keys(prefill).length > 0 && !prefill._nav) {
      if (prefill._mechanism) {
        // Coming from Dissect — skip the path entirely, go straight to hooks
        const mechanism = {mechanism: prefill._mechanism, why: prefill._why||""};
        setDissectMechanism(mechanism);
        // Still store what we know for buildCtx context
        const merged = {};
        if (prefill.principle||brand.primary_principle) merged.principle = prefill.principle||brand.primary_principle;
        if (prefill.persona||brand.core_persona?.name) merged.persona = prefill.persona||brand.core_persona?.name;
        if (prefill.awareness) merged.awareness = prefill.awareness;
        if (prefill.angle) merged.angle = prefill.angle;
        if (prefill.trigger) merged.trigger = prefill.trigger;
        if (prefill.format) merged.format = prefill.format;
        if (prefill.subtype) merged.subtype = prefill.subtype;
        if (prefill.formula) merged.formula = prefill.formula;
        setSel(merged);
        // Auto-trigger hook generation — only if we don't already have hooks from this mechanism
        // (user may have clicked away and back — don't regenerate)
        setStage("hooks");
        const alreadyHasHooks = hooks && hooks.length > 0;
        const sameSession = dissectMechanism?.mechanism === prefill._mechanism;
        if (!alreadyHasHooks || !sameSession) {
          generateHooksFromDissect(mechanism, merged);
        }
      } else {
        // Normal path prefill from Explore/Tree/Plan
        setDissectMechanism(null);
        const merged = {};
        if (prefill.principle||brand.primary_principle) merged.principle = prefill.principle||brand.primary_principle;
        if (prefill.persona||brand.core_persona?.name) merged.persona = prefill.persona||brand.core_persona?.name;
        if (prefill.awareness) merged.awareness = prefill.awareness;
        if (prefill.angle) merged.angle = prefill.angle;
        if (prefill.trigger) merged.trigger = prefill.trigger;
        if (prefill.format) merged.format = prefill.format;
        if (prefill.subtype) merged.subtype = prefill.subtype;
        if (prefill.formula) merged.formula = prefill.formula;
        setSel(merged);
        // Plan lock — fields that must not change (hold constants)
        if (prefill._planLocked) {
          setPlanLocked(prefill._planLocked);
        } else {
          setPlanLocked(null);
        }
        // Don't skip steps that haven't been filled — find first unfilled step
        let idx = 0;
        for (let i=0;i<STEP_KEYS.length;i++) {
          if (merged[STEP_KEYS[i]]) idx=i+1; else break;
        }
        // If angle was prefilled but awareness wasn't, land on awareness step
        if (merged.angle && !merged.awareness) {
          idx = STEP_KEYS.indexOf("awareness");
        }
        setStep(Math.min(idx, STEP_KEYS.length-1));
        setStage("deciding");
      }
    }
  }, [prefill, active]);

  const pick = (key,val) => {
    const ns = {...sel,[key]:val};
    setSel(ns);
    const idx = STEP_KEYS.indexOf(key);
    // Skip any locked steps
    let nextIdx = idx+1;
    while (nextIdx < STEP_KEYS.length && planLocked?.lockedFields?.includes(STEP_KEYS[nextIdx]) && ns[STEP_KEYS[nextIdx]]) {
      nextIdx++;
    }
    setStep(nextIdx < STEP_KEYS.length ? nextIdx : STEP_KEYS.length);
  };

  const reset = () => {
    setSel({}); setHooks([]); setAllPrevHooks([]); setChosen(null); setSavedThisHook(false); setEditedBody({}); setEditedCta({});
    setEditedHook(""); setBrief(null); setStage("deciding"); setStep(0); setCopied(false);
    setDissectMechanism(null); setPlanLocked(null);
    if (clearPrefill) clearPrefill();
  };

  const personas = [
    brand.core_persona?.name && {label:brand.core_persona.name,sub:"Core"},
    brand.secondary_persona?.name && {label:brand.secondary_persona.name,sub:"Secondary"},
    ...(brand.extra_personas||[]).filter(p=>p.name).map(p=>({label:p.name,sub:"Additional"})),
  ].filter(Boolean);

  const angles = sel.awareness ? (AW_ANGLES[sel.awareness]||ANGLES) : ANGLES;
  const recommendedFormats = sel.awareness ? AW_FORMATS[sel.awareness] : null;
  const subtypeOpts = sel.format ? (sel.format==="VIDEO"?FORMATS.VIDEO:FORMATS.IMAGE).map(f=>({label:f,sub:FORMAT_DEFS[f]})) : [];
  // Infer trigger from principle + angle (replaces Psychology Trigger step)
  const inferredTrigger = (() => {
    const p = sel.principle; const a = sel.angle;
    if (a==="Failed Solutions"||a==="Consequences") return p==="Pain-First"?"Fear":"Pain";
    if (a==="Desired Outcome"||a==="Identity") return "Desire";
    if (a==="Acceptance / Normalised") return "Pain";
    if (a==="Misconceptions"||a==="Education") return "Curiosity";
    if (a==="Social Proof") return "Social Proof";
    if (a==="Objections") return p==="Pain-First"?"Fear":"Curiosity";
    if (a==="Use Case") return p==="Pain-First"?"Pain":"Identity";
    if (a==="Features / Benefits") return "Desire";
    return p==="Pain-First"?"Pain":"Desire";
  })();
  const filteredFormulas = FORMULAS.filter(f => {
    const fit = FORMULA_FIT[f]; if (!fit) return true;
    return (!sel.awareness||fit.awareness.includes(sel.awareness))&&fit.triggers.includes(inferredTrigger);
  });
  // Tighter: if 5+ pass, keep only the best 3 for the angle
  const ANGLE_BEST_FORMULAS = {
    "Failed Solutions":["I-Led Story","Negative Hook","Before / After"],
    "Consequences":["Emotional Trigger","I-Led Story","Negative Hook"],
    "Desired Outcome":["Before / After","POV Hook","Emotional Trigger"],
    "Objections":["Why Did No One Tell Me","Negative Hook","Golden Nugget"],
    "Features / Benefits":["Golden Nugget","Give Me Time","Founder Intro"],
    "Use Case":["POV Hook","I-Led Story","Emotional Trigger"],
    "Misconceptions":["Why Did No One Tell Me","Golden Nugget","Negative Hook"],
    "Education":["Golden Nugget","Why Did No One Tell Me","Curiosity Loop"],
    "Acceptance / Normalised":["Emotional Trigger","Tribal Identity","I-Led Story"],
    "Identity":["Tribal Identity","POV Hook","Before / After"],
    "Social Proof":["Investment Hook","Golden Nugget","Founder Intro"],
  };
  const bestForAngle = sel.angle ? (ANGLE_BEST_FORMULAS[sel.angle]||[]) : [];
  const finalFormulas = filteredFormulas.length > 4 && bestForAngle.length > 0
    ? filteredFormulas.filter(f=>bestForAngle.includes(f))
    : filteredFormulas;
  const formulaOpts = (finalFormulas.length>0?finalFormulas:filteredFormulas.length>0?filteredFormulas:FORMULAS).map(f=>({label:f,sub:FORMULA_DEFS[f]}));

  const STEPS = [
    {key:"principle",title:"Organising Principle",sub:"Pain-First or Desire-First?",opts:[{label:"Pain-First",sub:"Lead with the problem"},{label:"Desire-First",sub:"Lead with the vision"}],c:T.gold,bg:T.goldL,b:T.goldB},
    {key:"persona",title:"Persona",sub:"Who are we talking to?",opts:personas.length?personas:[{label:"Add personas in Brand Inputs"}],c:T.green,bg:T.greenL,b:T.green},
    {key:"awareness",title:"Awareness Stage",sub:"Where is this person in their journey?",opts:AWARENESS.map(a=>({label:a,sub:AWARENESS_DEFS[a]})),c:T.orange,bg:T.orangeL,b:T.orange},
    {key:"angle",title:"Messaging Angle",sub:"What angle does this ad take?",opts:angles.map(a=>({label:a,sub:ANGLE_DEFS[a]})),c:T.red,bg:T.redL,b:T.red},
    {key:"format",title:"Format Type",sub:"Video or Image?",opts:[{label:"VIDEO",sub:"Moving image"},{label:"IMAGE",sub:"Static"}],c:T.blue,bg:T.blueL,b:T.blue},
    {key:"subtype",title:"Format Style",sub:recommendedFormats?"Recommended for "+sel.awareness+" shown first":"Specific format",opts:subtypeOpts,c:T.blue,bg:T.blueL,b:T.blue},
    {key:"formula",title:"Hook Formula",sub:finalFormulas.length<FORMULAS.length?(finalFormulas.length+" formulas matched to your path"):"Opening structure",opts:formulaOpts,c:T.purple,bg:T.purpleL,b:T.purple},
  ];

  const done = step >= STEP_KEYS.length;
  const cur = STEPS[step];
  const persona = brand.core_persona?.name===sel.persona ? brand.core_persona
    : brand.secondary_persona?.name===sel.persona ? brand.secondary_persona
    : (brand.extra_personas||[]).find(p=>p.name===sel.persona) || brand.core_persona;
  const lang = persona?.language || {};

  const buildCtx = () => {
    const principle = sel.principle==="Pain-First"
      ? "PAIN-FIRST: Lead with problem, frustration, failure. Do not open with anything positive."
      : "DESIRE-FIRST: Lead with identity, vision, aspiration. Product is the vehicle.";
    return "BRAND: "+brand.name+"\nOrganising Idea: "+(brand.organising_idea||"")+"\nStrategic Tension: "+(brand.strategic_tension||"")+"\nWhite Space: "+(brand.white_space||"")+"\n\nPERSONA: "+sel.persona+"\nDescription: "+(persona?.desc||"")+"\nDesire: "+(persona?.desire||"")+"\nPain: "+(persona?.pain||"")+"\n\nPRINCIPLE: "+principle+"\n\nAWARENESS: "+sel.awareness+" — "+(AWARENESS_RULES[sel.awareness]||"")+"\n\nANGLE: "+sel.angle+" — "+(ANGLE_DEFS[sel.angle]||"")+"\n\nTRIGGER (inferred from angle + principle): "+inferredTrigger+"\n\nFORMAT: "+sel.format+" — "+sel.subtype+" ("+(FORMAT_DEFS[sel.subtype]||"")+")\n\nFORMULA: "+sel.formula+"\nStructure: "+(FORMULA_STRUCTURES[sel.formula]||FORMULA_DEFS[sel.formula]||"")+(((lang.trigger||[]).length+(lang.pain||[]).length+(lang.desire||[]).length) > 0? "\n\nLANGUAGE BANK — use at least one phrase VERBATIM, never paraphrased:\nTRIGGER: "+((lang.trigger||[]).join(" | ")||"none")+"\nPAIN: "+((lang.pain||[]).join(" | ")||"none")+"\nDESIRE: "+((lang.desire||[]).join(" | ")||"none")+"\nOBJECTION: "+((lang.objection||[]).join(" | ")||"none"): "\n\nLANGUAGE BANK: None saved for this persona yet. CRITICAL: Do NOT use the core persona's language. Infer exactly how THIS persona (\""+sel.persona+"\") speaks from her description, pain, and desire above. What specific words, phrases, situations does SHE use? The hooks must sound like her life, not the core persona's life.")+"\n\nPROOF POINTS: "+((brand.proof_points||[]).filter(Boolean).join(" | ")||"none");
  };

  const generateHooksFromDissect = async (mechanism, ctx) => {
    // Called automatically when coming from Dissect — bypasses the 8-step path
    setLoading(true); setHooks([]); setChosen(null); setEditedHook(""); setSavedThisHook(false); setEditedBody({}); setEditedCta({}); setStage("hooks");
    // Use ctx persona if set (from Explore new persona), otherwise core persona
    const ctxPersonaName = ctx?.persona;
    const persona = ctxPersonaName
      ? (brand.core_persona?.name===ctxPersonaName ? brand.core_persona
         : brand.secondary_persona?.name===ctxPersonaName ? brand.secondary_persona
         : (brand.extra_personas||[]).find(p=>p.name===ctxPersonaName) || brand.core_persona)
      : brand.core_persona;
    const lang = persona?.language || {};
    const brandCtx = "BRAND: "+brand.name
      +"\nOrganising Idea: "+(brand.organising_idea||"")
      +"\nStrategic Tension: "+(brand.strategic_tension||"")
      +"\nWhite Space: "+(brand.white_space||"")
      +"\n\nPERSONA: "+(persona?.name||"")
      +"\nDescription: "+(persona?.desc||"")
      +"\nDesire: "+(persona?.desire||"")
      +"\nPain: "+(persona?.pain||"")
      +((lang.trigger||[]).length>0||(lang.pain||[]).length>0
      ? "\n\nLANGUAGE BANK — use at least one phrase VERBATIM:"
        +"\nTRIGGER: "+((lang.trigger||[]).join(" | ")||"none")
        +"\nPAIN: "+((lang.pain||[]).join(" | ")||"none")
        +"\nDESIRE: "+((lang.desire||[]).join(" | ")||"none")
        +"\nOBJECTION: "+((lang.objection||[]).join(" | ")||"none")
      : "\n\nLANGUAGE BANK: empty — infer this persona's exact vocabulary from her description and pain above. Use language SHE would use, not the core persona.")
      +"\n\nPROOF POINTS: "+((brand.proof_points||[]).filter(Boolean).join(" | ")||"none");

    const prompt = `You are a senior direct response creative strategist building hooks from a dissected winning ad.

${brandCtx}

MECHANISM TO EXECUTE:
"${mechanism.mechanism}"
${mechanism.why}

This is the ONLY brief.

CRITICAL — HOW THE ORIGINAL AD ACTUALLY WORKED:
"We want to sit on your face. Respectfully." worked because BOTH components were already alive in culture:
- "Sit on your face" = a phrase people already say, already understand, already have an association with
- "Respectfully" = a live meme format (say something unhinged, add respectfully to signal you know you're being unhinged)
The ad didn't INVENT edgy language. It BORROWED two things that already existed in internet culture and collided them with a product that literally sits on your face. The collision is the joke. The cultural recognition is what makes it spread.

YOUR JOB — BORROW, DON'T INVENT:
Do NOT write ad copy that tries to sound edgy. Find phrases and meme formats that ALREADY EXIST in the language of this persona (Gen Z / Millennial internet language, dating app slang, group chat shorthand, TikTok/Instagram formats, things people actually say out loud or text to friends) and collide them with this product so the product context makes the phrase funny or safe.

EXAMPLES OF REAL CULTURAL LANGUAGE TO BORROW FROM:
- Relationship/dating language people actually use: "toxic", "cheating", "leave him", "red flag", "no strings attached", "situationship", "it's giving commitment issues", "main character"
- Meme sentence structures: "not me doing X", "the way I...", "I'm not okay", "we don't talk about X", "normalize X", "can we talk about X for a second"
- Self-aware beauty/wellness culture: "rotting in bed", "delulu", "that girl", "I did it for the plot", "Roman Empire"
- Taboo collisions specific to this product: what would sound wrong about this product if taken out of context, but gets made safe by what it actually does?

The hook is the violation. The visual or the product truth is the "respectfully" — the thing that makes it safe.

RULES:
1. Hook text = the violation only. Full stop. No qualifier, no explanation, no resolution inside the line.
2. The phrase must be instantly recognizable as something people already say — not invented for this ad
3. Short enough to land in one read — the joke is the collision, not the sentence
4. 4 hooks, each borrowing a different phrase or meme format from actual cultural circulation
5. Use at least one phrase from the language bank verbatim somewhere in the hook

For body: 3–4 punchy lines that follow the hook. This is where the violation gets resolved by the product context — the "respectfully" lands here. Written in her voice.
For cta: The exact close. 10 words max. The punchline that converts.
For hook_visual: describe what makes the violation safe — the visual that resolves the cognitive dissonance. Image preferred if the joke lands in text alone.

Return ONLY raw JSON array, no markdown:
[{"hook_text":"","body":"","cta":"","hook_visual":""},{"hook_text":"","body":"","cta":"","hook_visual":""},{"hook_text":"","body":"","cta":"","hook_visual":""},{"hook_text":"","body":"","cta":"","hook_visual":""}]`;

    try {
      const raw = await callJSON(prompt, 2000);
      const parsed = JSON.parse(raw);
      setHooks(parsed);
      setAllPrevHooks(p=>[...p,...parsed.map(h=>h.hook_text)]);
    } catch(err) {
      setHooks([{hook_text:"Could not generate hooks. Try again.",hook_visual:"",body:"",cta:""}]);
    }
    setLoading(false);
  };

  const generateHooks = async () => {
    const prev = [...allPrevHooks,...hooks.map(h=>h.hook_text)].filter(Boolean);
    setLoading(true); setHooks([]); setChosen(null); setEditedHook(""); setSavedThisHook(false); setEditedBody({}); setEditedCta({}); setStage("hooks");
    const avoidBlock = prev.length>0 ? "\n\nDo NOT repeat or closely resemble these previous hooks:\n"+prev.map((h,i)=>(i+1)+". \""+h+"\"").join("\n") : "";
    const mechanismBlock = dissectMechanism
      ? "\n\nDISSECT MECHANISM — READ THIS BEFORE ANYTHING ELSE:\nThis hook session was triggered from a real ad dissection. The mechanism is:\n\""+dissectMechanism.mechanism+"\"\n\nThis is not context. This is the brief. Every single hook must execute this technique applied to this brand.\n\nIf the mechanism involves a double entendre, innuendo, or wordplay — write the double entendre. Do not write safe hooks that gesture toward it. Write the actual joke/innuendo applied to this product.\nIf the mechanism involves shock or taboo — write the shocking line, made safe by the product context.\nIf the mechanism involves pattern interrupt — the hook must actually interrupt an expected pattern for this category.\n\nThe awareness stage, angle, formula, and trigger in the parameters are there to give you context about the audience. They do NOT override the mechanism. A hook that perfectly matches all parameters but ignores the mechanism is wrong. A hook that slightly bends a parameter but nails the mechanism is right.\n\nWrite hooks that would make someone stop and say 'I can't believe they just said that — about [this product].'"
      : "";
    // Awareness-stage modifier: what changes about the scene at this specific awareness level
    const AWARENESS_MODIFIER = {
      "Unaware": "CRITICAL — she does NOT know she has this problem yet. She cannot recognise product categories or solutions. The hook must enter from a moment in her daily life she already recognises — a feeling, a situation, a behaviour — with ZERO product or problem language. The problem must be implied by the situation, never named.",
      "Problem Aware": "She knows the problem exists and is living with it. Lead with the feeling or the specific behaviour that shows she has the problem. No solution yet. Make her feel understood before anything else.",
      "Solution Aware": "She knows solutions like this exist. She's evaluating. She's been disappointed before. The hook must differentiate — it's not 'did you know this exists' but 'here's what every other solution got wrong' or 'here's the specific thing you didn't know about this category.'",
      "Product Aware": "She has seen or heard of this specific product. She hasn't bought. She has a specific objection or doubt. The hook must name her exact hesitation or show her the specific outcome she'd get — not the general category outcome. Highly specific to THIS product.",
      "Most Aware": "She knows the product well. She just needs the final nudge. No need to explain the problem or the category. Hook is about the offer, the identity, or the one final reason to act NOW.",
    };

    // Angle-specific scene definitions — determines WHICH MOMENT the hook enters from
    const ANGLE_SCENE = {
      "Consequences": {
        scene: "The cost she has already paid or is about to pay from NOT solving this. Not pre-trip anxiety — the actual damage: the thing she missed, the memory ruined, the regret she carries.",
        badExample: "I was nervous about bringing my ring." ,
        goodExample: "I missed the snorkeling because I couldn't figure out what to do with my ring.",
        why: "Consequences = something already lost, not something feared. The damage is done."
      },
      "Failed Solutions": {
        scene: "She already tried something. It didn't work. The silicone ring looked fake. The insurance didn't cover it. The hotel safe was paranoia-inducing. The ring reversal trick wore off. The hook IS the failed attempt — not the fear before trying.",
        badExample: "I was scared of losing my ring on the trip.",
        goodExample: "I bought a silicone ring for our honeymoon. Took it off after one day.",
        why: "Failed Solutions = the attempt and its failure, not the problem that made her try."
      },
      "Desired Outcome": {
        scene: "The after-state she fantasises about — the version of herself who solved this, who wears the ring everywhere, who doesn't think twice. The hook should make her FEEL that future self, not remind her of the fear.",
        badExample: "What do you wear when you're terrified of losing the ring?",
        goodExample: "She wore her ring snorkeling, dancing, on the beach. The whole trip.",
        why: "Desired Outcome = the life she wants, not the problem she has. Make her feel the after."
      },
      "Acceptance / Normalised": {
        scene: "She has accepted something she shouldn't have. The hook challenges what she's given up on. Not pre-trip anxiety — the moment she decided 'this is just how it is.' The hook should make her question that acceptance.",
        badExample: "Every newly-engaged woman reverses her ring before going out.",
        goodExample: "You just accepted that you'd leave it home. Like that's normal.",
        why: "Acceptance = calling out the resignation. She stopped fighting it. The hook calls that out."
      },
      "Objections": {
        scene: "The specific doubt stopping her from buying. The hook names it directly and dismantles it — or makes her feel the doubt so viscerally she needs the answer.",
        badExample: "What do you do about your ring on vacation?",
        goodExample: "It won't look like my real ring. That's what she said before she tried it.",
        why: "Objections = her exact hesitation, named and challenged."
      },
      "Identity": {
        scene: "Who she is or who she wants to become. The hook makes the right person self-identify — she should feel 'that's me' or 'that's who I want to be.'",
        badExample: "Every woman with an engagement ring worries about travel.",
        goodExample: "The kind of woman who wears her ring everywhere. That's who you are.",
        why: "Identity = self-recognition, not problem recognition."
      },
      "Education": {
        scene: "A specific fact she doesn't know that would change how she sees this. The fact IS the hook.",
        badExample: "There are solutions for travelling with your engagement ring.",
        goodExample: "Standard travel insurance doesn't cover engagement rings lost at the beach.",
        why: "Education = the surprising truth, delivered as the first word."
      },
      "Misconceptions": {
        scene: "The wrong belief she holds. Name it exactly, then let the cognitive dissonance do the work.",
        badExample: "You don't have to leave your ring at home when you travel.",
        goodExample: "A silicone ring is not the answer. It's just a different problem.",
        why: "Misconceptions = the false belief she holds, named without softening."
      },
      "Social Proof": {
        scene: "Real results from a real person in her exact situation. The specificity makes it credible.",
        badExample: "Women love wearing their rings on vacation now.",
        goodExample: "She wore it to Bali, Tulum, and her honeymoon. Never once took it off.",
        why: "Social Proof = one specific person's specific result. Not a claim — a story in one line."
      },
    };

    const angleScene = ANGLE_SCENE[sel.angle] || {
      scene: "The specific moment in the persona's life where this angle is most viscerally felt.",
      badExample: "", goodExample: "", why: "Stay in the scene. One moment."
    };

    // Formula-specific real examples — different vocabulary each time so model doesn't clone
    const FORMULA_EXAMPLES = {
      "Emotional Trigger": [
        {h:"Left it in the hotel safe. Cried on the beach.", why:"10 words. Two beats. The gap between them is the emotion."},
        {h:"She put it in her carry-on and checked the bag.", why:"Specific catastrophic action. No adjective needed."},
      ],
      "I-Led Story": [
        {h:"I insured it for the trip. Didn't wear it once.", why:"Irony in two short sentences. She knows exactly why."},
        {h:"I packed it. Unpacked it. Left it on the dresser.", why:"Three beats = the decision playing out in real time."},
      ],
      "Before / After": [
        {h:"Wore the fake one. Felt like a liar the whole trip.", why:"Before state is visceral and specific. No after needed."},
        {h:"Nineteen days in Santorini. Ring never left the safe.", why:"Duration + location + outcome. No emotion words."},
      ],
      "Negative Hook": [
        {h:"The silicone ring doesn't fix the problem. It just moves it.", why:"Names the failed solution without naming the emotion."},
        {h:"Stop reversing it at the bar. She sees it anyway.", why:"Specific behaviour caught mid-act."},
      ],
      "POV Hook": [
        {h:"POV: honeymoon packing and you're holding the ring box.", why:"One moment. The pause in that moment IS the hook."},
        {h:"POV: day three. Ring in the safe. Partner at the pool.", why:"Specific day. The detail of where each one is says everything."},
      ],
      "Tribal Identity": [
        {h:"If you've packed it and repacked it three times, this is for you.", why:"Specific repeated action = self-recognition without explanation."},
        {h:"Newly engaged and already doing the ring-in-the-pocket thing.", why:"The behaviour is the badge. She knows the thing."},
      ],
      "Why Did No One Tell Me": [
        {h:"Why did no one say travel insurance excludes jewellery loss.", why:"The specific exclusion. Outrage is in the detail."},
        {h:"Nobody tells you what to actually do at airport security.", why:"Universal moment, specific gap."},
      ],
      "Golden Nugget": [
        {h:"Engagement rings are the most common item left in hotel rooms.", why:"Specific fact. Mildly devastating. No explanation."},
        {h:"The beach loses more rings than anywhere else. By a lot.", why:"Simple stat, huge implication."},
      ],
      "Curiosity Loop": [
        {h:"There's a reason she didn't wear it on the honeymoon.", why:"Implied story. Can't resolve without watching."},
        {h:"Not the solution I expected. But the only one that worked.", why:"Reveals a conclusion without the argument."},
      ],
    };

    const formulaExamples = (FORMULA_EXAMPLES[sel.formula]||[]).map(e=>`"${e.h}" — ${e.why}`).join("\n");

    // Anti-template: different syntactic forms assigned per angle to break the lock
    const ANGLE_SYNTAX_ASSIGNMENT = {
      "Consequences":       ["1st person past (the cost you paid)", "3rd person observation (what she lost)", "Direct address (the damage she'll carry)", "Specific question about the cost"],
      "Failed Solutions":   ["1st person past (the attempt + failure)", "Direct address (catch her mid-try)", "3rd person (every woman who tried X)", "The irony question (why did it still fail)"],
      "Desired Outcome":    ["3rd person she (the woman who solved it)", "Direct address (you, in the after)", "1st person future (I can finally)", "Observation about what changes"],
      "Acceptance / Normalised": ["Direct accusation (you accepted this)", "1st person past (the moment of giving up)", "3rd person (every woman who stopped fighting it)", "Challenge question (why did she decide this was normal)"],
      "Objections":         ["The objection stated as fact", "1st person who held the objection", "Direct address (her exact doubt)", "Question that makes the doubt feel small"],
      "Identity":           ["Direct address (who you are)", "Tribal (if you do X, this is you)", "1st person becoming (I became)", "Question (are you the kind of woman who)"],
      "Education":          ["The fact as statement", "The fact as surprise", "1st person who didn't know", "Question built on the fact"],
      "Misconceptions":     ["The wrong belief named", "1st person who held it", "Direct challenge to the belief", "The thing that's actually true"],
      "Social Proof":       ["The result in one line", "The person's story in two beats", "Direct address (you could be her)", "The specific number or fact"],
    };

    const syntaxForms = ANGLE_SYNTAX_ASSIGNMENT[sel.angle] || [
      "1st person past tense: one specific moment",
      "Direct address: accusation or knowing",
      "3rd person observation: universal truth",
      "Genuine question: unanswered"
    ];

    const prompt = `You are writing scroll-stopping hooks for paid social. Your only job: make her stop scrolling in the first 1.5 seconds.

BRAND + AUDIENCE:
${buildCtx()}${mechanismBlock}${avoidBlock}

━━━ STEP 1 — AWARENESS STAGE RULE (read this first) ━━━
AWARENESS: ${sel.awareness}
${AWARENESS_MODIFIER[sel.awareness]||""}

━━━ STEP 2 — THE ANGLE: WHICH MOMENT IN HER STORY ━━━
ANGLE: ${sel.angle}

The angle + awareness stage together determine the exact scene. The angle alone is not enough — the same angle at Problem Aware vs Most Aware is a completely different moment.

CORRECT SCENE FOR THIS ANGLE AT THIS AWARENESS STAGE:
${angleScene.scene}

WRONG (what to avoid): "${angleScene.badExample}"
RIGHT (what this angle actually sounds like): "${angleScene.goodExample}"
WHY: ${angleScene.why}

TEST: If your hook could work at a different awareness stage — you've written the wrong hook. The awareness stage + angle = one specific scene. Stay in that scene.

━━━ STEP 3 — APPLY THE FORMULA ━━━
FORMULA: ${sel.formula}
${FORMULA_STRUCTURES[sel.formula]||""}

Real examples of this formula done right:
${formulaExamples||"Write with maximum specificity and minimum words."}

━━━ STEP 4 — FOUR HOOKS, FOUR DIFFERENT SYNTACTIC FORMS ━━━
Write four hooks, each using a different form. The form is assigned — do NOT swap them:
Hook 1: ${syntaxForms[0]}
Hook 2: ${syntaxForms[1]}
Hook 3: ${syntaxForms[2]}
Hook 4: ${syntaxForms[3]}

━━━ THE NON-NEGOTIABLE RULES ━━━
• 6–15 words maximum. More words = still searching. Cut.
• One idea only. One image or one accusation. Not two.
• Never name the emotion. Write the action that means it.
• End the moment the scroll stops. Not after the explanation.
• Use her language from the language bank — sounds like her, not a copywriter.
• Four hooks must be genuinely different from each other in scene AND structure AND wording.

AFTER WRITING ALL FOUR HOOK TEXTS — add for each:
- body: 3–4 short punchy lines that flow from the hook. No filler. Each line earns its place. This is where the angle pays off — the problem deepens, the product truth lands, the proof arrives. Specific to this path and persona. Written in her voice.
- cta: The exact close. Not "link in bio." The specific line that converts. Should resolve the tension the hook opened. 10 words max.
- hook_visual: one shot — who, where, exactly what the camera sees. One sentence.

Return ONLY raw JSON array, no markdown:
[{"hook_text":"","body":"","cta":"","hook_visual":""},{"hook_text":"","body":"","cta":"","hook_visual":""},{"hook_text":"","body":"","cta":"","hook_visual":""},{"hook_text":"","body":"","cta":"","hook_visual":""}]`;
    try {
      const raw = await callJSON(prompt, 2500);
      const parsed = JSON.parse(raw);
      setHooks(parsed);
      setAllPrevHooks(p=>[...p,...parsed.map(h=>h.hook_text)]);
    } catch(e) {
      console.error("generateHooks error:", e);
      setHooks([{hook_text:"Could not generate hooks. Please try again.",hook_visual:"",body:"",cta:""}]);
    }
    setLoading(false);
  };

  const generateMoreLikeThis = async () => {
    const refHook = editedHook||hooks[chosen]?.hook_text||"";
    if (!refHook) return;
    const prev = [...allPrevHooks,...hooks.map(h=>h.hook_text)].filter(Boolean);
    setLoading(true); setHooks([]); setChosen(null); setEditedHook(""); setSavedThisHook(false); setEditedBody({}); setEditedCta({}); setStage("hooks");
    const avoidBlock = prev.length>0 ? "\n\nDo NOT repeat or closely resemble these previous hooks:\n"+prev.map((h,i)=>(i+1)+". \""+h+"\"").join("\n") : "";
    const mechanismBlock = dissectMechanism
      ? "\n\nDISSECT MECHANISM — READ THIS BEFORE ANYTHING ELSE:\nThis hook session was triggered from a real ad dissection. The mechanism is:\n\""+dissectMechanism.mechanism+"\"\n\nThis is not context. This is the brief. Every single hook must execute this technique applied to this brand.\n\nIf the mechanism involves a double entendre, innuendo, or wordplay — write the double entendre. Do not write safe hooks that gesture toward it. Write the actual joke/innuendo applied to this product.\nIf the mechanism involves shock or taboo — write the shocking line, made safe by the product context.\nIf the mechanism involves pattern interrupt — the hook must actually interrupt an expected pattern for this category.\n\nThe awareness stage, angle, formula, and trigger in the parameters are there to give you context about the audience. They do NOT override the mechanism. A hook that perfectly matches all parameters but ignores the mechanism is wrong. A hook that slightly bends a parameter but nails the mechanism is right.\n\nWrite hooks that would make someone stop and say 'I can\'t believe they just said that — about [this product].'"
      : "";

    const prompt = `You are writing scroll-stopping hooks for paid social. The user picked this hook as the closest to what they want. Write 4 more in the same emotional territory — but genuinely different executions, not the same hook reworded.

REFERENCE HOOK (what they liked): "${refHook}"

BRAND + AUDIENCE:
${buildCtx()}${mechanismBlock}${avoidBlock}

WHAT "MORE LIKE THIS" MEANS:
Same emotional core as the reference. Different entry point each time.
Hook 1 — One beat earlier: the moment just before what the reference describes
Hook 2 — The consequence: what happens if she never solves this (not the fear — the actual damage)
Hook 3 — Completely different scenario, same feeling: different location/situation, same emotional truth
Hook 4 — Flip the syntax: if reference is 1st person → try direct address. If observation → try question.

THE NON-NEGOTIABLE RULES:
• 6–15 words maximum. More = still searching.
• One idea only. One image or accusation. Not two.
• Never name the emotion — write the action that means it.
• None of the four can share wording, structure, or scene with the reference OR each other.
• No "terrified", no "worried", no "anxious" — show the behaviour.

For each also write:
- body: 3–4 punchy lines flowing from the hook. Angle pays off here. Her voice.
- cta: Exact close. 10 words max. Resolves the tension the hook opened.
- hook_visual: one shot — who, where, what the camera sees.

Return ONLY raw JSON array, no markdown:
[{"hook_text":"","body":"","cta":"","hook_visual":""},{"hook_text":"","body":"","cta":"","hook_visual":""},{"hook_text":"","body":"","cta":"","hook_visual":""},{"hook_text":"","body":"","cta":"","hook_visual":""}]`;

    try {
      const raw = await callJSON(prompt, 2500);
      const parsed = JSON.parse(raw);
      setHooks(parsed);
      setAllPrevHooks(p=>[...p,...parsed.map(h=>h.hook_text)]);
    } catch(e) { setHooks([{hook_text:"Could not generate. Try again.",hook_visual:"",body:"",cta:""}]); }
    setLoading(false);
  };

  const generateBrief = async () => {
    const hookToUse = editedHook||hooks[chosen]?.hook_text||"";
    setLoading(true); setBrief(null); setStage("brief");
    const ctx = buildCtx();

    // ── FRAMEWORK THINKING INSTRUCTIONS ────────────────────────────────────────
    // These are injected into both calls so the model thinks through each field
    // using the full strategic framework — not just filling empty JSON slots.
    const frameworkInstructions = `
FRAMEWORKS YOU MUST APPLY:

GBP METHOD (Gut → Brain A → Brain B → Pocket):
- GUT (0-5 seconds): The single emotional hit before the brain processes the product. Must come from the language bank verbatim or near-verbatim. Not a description of the emotion — the actual line that makes them feel something. If it sounds like ad copy, rewrite it.
- BRAIN A (5-15 seconds): Product proof mapped to this persona's SPECIFIC desire — not generic benefits. Features only count if they connect to the exact transformation this persona wants. Use proof points with exact numbers where available.
- BRAIN B (15-25 seconds): Address the objections this persona would have before buying. Work through these 6 macro objections and include only the ones relevant to this persona and product:
  1. Timeframe — how long until they see results?
  2. Personal fit — is this actually for someone like me?
  3. Effort — what do I have to do / how hard is this?
  4. Sophistication — I've tried things like this before and they didn't work
  5. Geolocation — does this work where I am?
  6. Trust — why should I believe this brand?
  Pull objection language VERBATIM from the language bank. Do not invent objections not represented there.
- POCKET (CTA, 3-7 seconds): The specific reason to act right now. Match to awareness stage:
  Unaware = curiosity CTA (find out more, not buy now)
  Problem Aware = relief CTA (finally solve this)
  Solution Aware = differentiation CTA (why this one over others)
  Product Aware = objection-resolution CTA (address the last hesitation)
  Most Aware = urgency/offer CTA (reason to act today)

AHA MOMENT (Alysha's Framework):
The single insight that makes this concept feel inevitable — the connection between this persona's pain and this product that they haven't heard framed this way before. Test: could any other brand in this category say this exact thing? If yes, rewrite it until the answer is no.

ASSET TRIANGLE (Audience → Angle → Ad):
The audience has the longest lifespan. The angle has medium lifespan. The ad has the shortest lifespan. Every field in this brief serves the angle — the ad is just one execution of it.

PAIN x AUDIENCE INTERSECTION:
The angle chosen (${sel.angle}) must trace back to a specific pain this persona (${sel.persona}) experiences. The hypothesis in the campaign card must name which Pain x Audience intersection this tests.

ANGLE THINKING for ${sel.angle}:
${
  sel.angle==="Consequences" ? "What gets worse in their life if they never solve this? Lead with the cost of inaction — specific, named consequences, not vague threats." :
  sel.angle==="Failed Solutions" ? "They have already tried things and been disappointed. Name what didn't work — specifically. The hook opens by validating that failure before introducing this as different." :
  sel.angle==="Desired Outcome" ? "Paint the specific after-state they fantasise about. Make them feel the transformation before they understand the product. What does life look like when this is solved?" :
  sel.angle==="Objections" ? "Name the exact doubt stopping them from buying and dismantle it directly. Do not hedge. Do not soften. The objection is the opening, the dismantling is the ad." :
  sel.angle==="Features / Benefits" ? "Frame as outcomes this persona cares about — not technical specifications. Every feature must answer: so what does that mean for my life?" :
  sel.angle==="Use Case" ? "Show the specific daily moment where they experience this problem. Time of day, physical location, what they were doing, what went wrong. Hyper-specific." :
  sel.angle==="Misconceptions" ? "Correct the false belief they hold. They are wrong about something — name it, prove it, reframe it. The correction IS the hook." :
  sel.angle==="Education" ? "Lead with the surprising fact they don't know that would change how they see this problem. The fact itself is valuable enough to stop the scroll." :
  sel.angle==="Acceptance / Normalised" ? "Challenge what they have accepted or given up on. They have stopped trying to solve this — make them realise they shouldn't have." :
  sel.angle==="Identity" ? "Show who they want to become. How does using this product reflect on who they are? The product is the vehicle to an identity they want." :
  sel.angle==="Social Proof" ? "Real results from real people — exact numbers, exact transformations. Let the proof do the persuading. Your brand does not need to say anything." :
  "Apply the angle definition to this persona's specific pain and desire."
}

MARKET SOPHISTICATION:
If the persona is Solution Aware or Product Aware, they have seen claims like this before. Bold the claim, add specific proof, or find a new angle on it — do not repeat what the category already says.

HOOK FORMULA STRUCTURE for ${sel.formula}:
The hook text already follows the formula. The brief must support exactly that opening — every element downstream must flow from the specific formula structure used.`;

    const base = "You are a senior direct response creative strategist. You think through each field using the strategic frameworks provided — you do not fill empty boxes. Hyper-specific only. If a field would be generic for any brand, it is wrong.\n\n"+ctx+"\n\nHOOK: \""+hookToUse+"\"\n"+frameworkInstructions;

    // Detect format — from sel, hook visual text, or dissect mechanism
    const isImage = sel.format === "IMAGE"
      || (hooks[chosen]?.hook_visual || "").toLowerCase().includes("static")
      || ["Benefit Callout","Proof / Stats","Review / UGC Quote","Us vs Them"].includes(sel.subtype)
      || (sel.subtype && ["Benefit Callout","Proof / Stats","Review / UGC Quote","Us vs Them"].includes(sel.subtype));

    const partAPrompt = isImage
      ? base+`

TASK — PART A: This is a STATIC IMAGE ad. Do NOT write casting, filming, or video direction. Think through each field using the frameworks above, then return ONLY raw JSON, no markdown:
{"aha":"[The single insight connecting this persona's pain to this product — could no other brand in this category say this exact thing? Tied to THIS specific hook, not brand strategy generally]","gut":"[Exact emotional hit in the hook itself — what emotion fires in the first second of reading this hook and why]","brain_a":"[Product proof mapped to this persona's specific desire — features as transformation, exact proof point numbers]","brain_b":"[Most relevant 2-3 macro objections for this persona addressed directly — pull objection language from language bank]","pocket":"[Specific CTA matching the ${sel.awareness} awareness stage — not shop now]","overview":"[Creative director briefing a designer — the single job this IMAGE must do, who it's for, what they must feel in the first second of seeing it. Not a video brief.]","hook_variations":["","",""],"image_concept":"[What the full image looks like — subject, composition, text placement, color palette, mood. Specific enough for a designer to execute without asking questions]","text_hierarchy":"[Exactly how text is layered — what is largest, what is secondary, font weight/style direction, where on the image each element sits]","campaign_card":{"concept_name":"","angle":"${sel.angle}","awareness_stage":"${sel.awareness}","persona":"${sel.persona}","format":"${sel.subtype||'IMAGE'}","hypothesis":"[Which Pain x Audience intersection this tests and what we learn if it works]","success_metric":"[Hook rate target / CTR target / CPA target]"}}`
      : base+`

TASK — PART A: This is a VIDEO ad. Think through each field using the frameworks above, then return ONLY raw JSON, no markdown:
{"aha":"[The single insight connecting this persona's pain to this product — could no other brand in this category say this exact thing? Tied to THIS specific hook, not brand strategy generally]","gut":"[Exact emotional opening line 0-5s — from language bank, not ad copy]","brain_a":"[Product proof mapped to this persona's specific desire — features as transformation, exact proof point numbers]","brain_b":"[Most relevant 2-3 macro objections for this persona addressed directly — pull objection language from language bank]","pocket":"[Specific CTA matching the ${sel.awareness} awareness stage — not shop now]","overview":"[Creative director briefing a creator — the single job this ad must do, who it's for, what they must feel at the end. Written in voice, not as a summary]","hook_variations":["","",""],"casting":"[Specific — age, energy, environment, what they are doing, not just demographics]","filming":"[Pacing, camera distance, lighting, tone — specific to this format and formula]","campaign_card":{"concept_name":"","angle":"${sel.angle}","awareness_stage":"${sel.awareness}","persona":"${sel.persona}","format":"${sel.subtype}","hypothesis":"[Which Pain x Audience intersection this tests and what we learn if it works]","success_metric":"[Hook rate target / CTR target / CPA target]"}}`;

    const partBPrompt = isImage
      ? base+`

TASK — PART B: This is a STATIC IMAGE ad. Do NOT write shot lists or voiceover. Think through each field, then return ONLY raw JSON, no markdown:
{"image_specs":["[Spec 1: exact visual element — subject position, ring/product placement, background, lighting]","[Spec 2: text overlay — exact copy, size hierarchy, placement on image]","[Spec 3: color/mood direction — palette, filter, atmosphere]","[Spec 4: what makes the violation safe — the visual 'respectfully' that resolves the hook]"],"dos":["[Specific to this hook mechanism — what makes it land]","[Specific to this angle — what the image must show]","",""],"donts":["[Specific failure mode — what kills the mechanism in static format]","[What would make this look like every other ad in this category]","",""],"caption_instructions":[{"voiceover":"N/A — static image","on_screen_text":"[Exact primary text overlay — word for word]","suggested_visual":"[What the image shows behind or around the text]"},{"voiceover":"N/A","on_screen_text":"[Secondary text or subhead if any]","suggested_visual":"[Any product/logo placement]"},{"voiceover":"N/A","on_screen_text":"[CTA text]","suggested_visual":"[Where CTA sits on image]"}],"variations":["[Same mechanism, different cultural phrase]","[Same hook, different image concept]","[Test with product shown vs product hidden]"]}`
      : base+`

TASK — PART B: This is a VIDEO ad. Think through each field using the frameworks above, then return ONLY raw JSON, no markdown:
{"shot_list":["[Shot 1: who, where, what camera sees, why this shot at this moment — specific to THIS hook's violation→resolution structure]","[Shot 2]","[Shot 3]","[Shot 4]","[Shot 5]","[Shot 6]"],"dos":["[Specific to this formula and angle — not generic advice]","","",""],"donts":["[Specific failure mode of the ${sel.formula} formula — what kills the mechanism]","[Specific to ${sel.angle} angle — what makes it generic]","",""],"caption_instructions":[{"voiceover":"[Exact words — specific enough that two creators would say roughly the same thing]","on_screen_text":"[Exact text overlay]","suggested_visual":"[Who, where, what the camera shows]"},{"voiceover":"","on_screen_text":"","suggested_visual":""},{"voiceover":"","on_screen_text":"","suggested_visual":""}],"variations":["[Hook variation using a different language bank phrase]","[Same angle, different formula]","[Same formula, push the awareness stage one step deeper]"]}`;

    const [partA, partB] = await Promise.all([
      callJSON(partAPrompt, 2500),
      callJSON(partBPrompt, 2000),
    ]).catch(() => [null, null]);

    try {
      const a = JSON.parse(partA);
      const b = JSON.parse(partB);
      setBrief({...a,...b,hook_text:hookToUse,hook_visual:hooks[chosen]?.hook_visual||"",body:hooks[chosen]?.body||"",cta:hooks[chosen]?.cta||""});
    } catch(err) { setBrief({error:true, message:err.message}); }
    setLoading(false);
  };

  const [savedThisHook, setSavedThisHook] = useState(false);
  const saveHook = () => {
    const hookToSave = editedHook||hooks[chosen]?.hook_text||"";
    if (!hookToSave) return;
    const bodyToSave = (editedBody[chosen]!==undefined ? editedBody[chosen] : hooks[chosen]?.body)||"";
    const ctaToSave = (editedCta[chosen]!==undefined ? editedCta[chosen] : hooks[chosen]?.cta)||"";
    const h = {
      hook_text: hookToSave,
      hook_visual: hooks[chosen]?.hook_visual||"",
      body: bodyToSave,
      cta: ctaToSave,
      selections: dissectMechanism
        ? { ...sel, persona: sel.persona||brand.core_persona?.name, mechanism: dissectMechanism.mechanism }
        : sel,
      brand: brand.name,
      date: new Date().toLocaleDateString(),
      id: Date.now(),
    };
    onUpdate({...brand,savedBriefs:[...(brand.savedBriefs||[]),h]});
    setSavedThisHook(true);
  };
  const alreadySaved = (brand.savedBriefs||[]).some(b=>b.hook_text===(editedHook||hooks[chosen]?.hook_text));

  if (!hasBrandData) return (
    <div style={{padding:48,textAlign:"center"}}>
      <div style={{fontSize:14,fontWeight:600,color:T.text,fontFamily:T.font,marginBottom:10}}>Brand data needed</div>
      <div style={{fontSize:13,color:T.mid,fontFamily:T.font,lineHeight:1.7,maxWidth:380,margin:"0 auto"}}>
        Fill in Brand Inputs first — at minimum: Brand Name, Organising Idea, and Core Persona.
      </div>
    </div>
  );

  return (
    <div style={{maxWidth:680,margin:"0 auto"}}>
      {dissectMechanism ? (
        <div style={{background:T.orangeL,border:"1.5px solid "+T.orangeB,borderRadius:8,padding:"14px 16px",marginBottom:16}}>
          <div style={{fontSize:10,fontWeight:700,letterSpacing:1.2,color:T.orange,textTransform:"uppercase",marginBottom:6,fontFamily:T.font}}>⚡ From Dissect — Mechanism</div>
          <div style={{fontSize:12,color:T.text,fontFamily:T.font,lineHeight:1.6,marginBottom:8}}>{dissectMechanism.mechanism}</div>
          {dissectMechanism.why && <div style={{fontSize:11,color:T.mid,fontFamily:T.font,lineHeight:1.5,marginBottom:8}}>{dissectMechanism.why}</div>}
          <button onClick={reset} style={{fontSize:11,color:T.dim,background:"none",border:"none",cursor:"pointer",textDecoration:"underline",fontFamily:T.font}}>Build hooks from scratch →</button>
        </div>
      ) : Object.keys(sel).length>0 ? (
        <div style={{background:T.warm,border:"1.5px solid "+T.border,borderRadius:7,padding:"10px 14px",marginBottom:16}}>
          {/* Plan lock banner */}
          {planLocked && (
            <div style={{background:T.goldL,border:"1.5px solid "+T.goldB,borderRadius:6,padding:"10px 14px",marginBottom:10}}>
              <div style={{fontSize:11,fontWeight:700,color:T.gold,fontFamily:T.font,marginBottom:2}}>
                🔒 Testing variable: <span style={{textTransform:"capitalize"}}>{planLocked.variable}</span> — from {planLocked.phaseName}
              </div>
              <div style={{fontSize:11,color:T.mid,fontFamily:T.font,lineHeight:1.5}}>
                {planLocked.lockedFields.map(f=>f.charAt(0).toUpperCase()+f.slice(1)).join(", ")} locked to keep the test clean. Only {planLocked.variable} changes.
              </div>
            </div>
          )}
          <div style={{fontSize:10,fontWeight:600,letterSpacing:1.2,color:T.dim,textTransform:"uppercase",marginBottom:6,fontFamily:T.font}}>Your Path</div>
          <div style={{display:"flex",flexWrap:"wrap",gap:5,alignItems:"center"}}>
            {STEPS.filter(s=>sel[s.key]).map((s,i,arr) => {
              const isLocked = planLocked?.lockedFields?.includes(s.key);
              return (
                <span key={s.key} style={{display:"flex",alignItems:"center",gap:5}}>
                  <span style={{position:"relative"}}>
                    <Chip label={sel[s.key]} c={isLocked?T.dim:s.c} bg={isLocked?T.warm:s.bg} b={isLocked?T.border:s.b}/>
                    {isLocked && <span style={{position:"absolute",top:-4,right:-4,fontSize:8}}>🔒</span>}
                  </span>
                  {i<arr.length-1 && <span style={{color:T.borderMid,fontSize:11}}>›</span>}
                </span>
              );
            })}
          </div>
          <button onClick={reset} style={{marginTop:8,fontSize:11,color:T.dim,background:"none",border:"none",cursor:"pointer",textDecoration:"underline",fontFamily:T.font}}>Start over</button>
        </div>
      ) : null}

      {stage==="deciding" && !done && cur && !dissectMechanism && !planLocked?.lockedFields?.includes(cur.key) && (
        <div style={{background:T.surface,border:"1.5px solid "+T.border,borderTop:"3px solid "+cur.c,borderRadius:8,padding:"18px 20px"}}>
          <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:4}}>
            <div style={{width:22,height:22,borderRadius:"50%",background:cur.c,display:"flex",alignItems:"center",justifyContent:"center",fontSize:11,fontWeight:700,color:"#fff",flexShrink:0,fontFamily:T.font}}>{step+1}</div>
            <div style={{fontSize:14,fontWeight:600,color:T.text,fontFamily:T.font}}>{cur.title}</div>
          </div>
          <div style={{fontSize:12,color:T.dim,marginBottom:14,paddingLeft:32,fontFamily:T.font}}>{cur.sub}</div>
          {cur.key==="formula" && filteredFormulas.length<FORMULAS.length && (
            <div style={{background:T.purpleL,border:"1px solid "+T.purple+"20",borderRadius:5,padding:"8px 12px",marginBottom:10,fontSize:11,color:T.purple,fontFamily:T.font}}>
              {finalFormulas.length} of {FORMULAS.length} formulas — matched to {sel.awareness} + {sel.angle}.
            </div>
          )}
          {cur.key==="subtype" && recommendedFormats && (
            <div style={{background:T.greenL,border:"1px solid "+T.green+"20",borderRadius:5,padding:"8px 12px",marginBottom:10,fontSize:11,color:T.green,fontFamily:T.font}}>
              Recommended for {sel.awareness} shown with ✓
            </div>
          )}
          <div style={{display:"flex",flexWrap:"wrap",gap:8}}>
            {cur.opts.map(opt => {
              const label = typeof opt==="string"?opt:opt.label;
              let sub = typeof opt==="object"?opt.sub:null;
              if (cur.key==="subtype"&&recommendedFormats&&recommendedFormats.includes(label)) sub = (sub?"✓ "+sub:"✓ Recommended");
              return <ChoiceBtn key={label} label={label} sub={sub} selected={false} onSelect={v=>pick(cur.key,v)} c={cur.c} bg={cur.bg} b={cur.b}/>;
            })}
          </div>
        </div>
      )}

      {stage==="deciding" && done && !dissectMechanism && (
        <div style={{background:T.goldL,border:"1.5px solid "+T.goldB,borderRadius:8,padding:"20px 22px",textAlign:"center"}}>
          <div style={{fontSize:14,fontWeight:600,color:T.text,fontFamily:T.font,marginBottom:6}}>Path complete.</div>
          <div style={{fontSize:11,color:T.gold,fontFamily:T.font,marginBottom:12,fontWeight:600}}>
            {[sel.principle,sel.persona,sel.awareness,sel.angle,sel.subtype,sel.formula].filter(Boolean).join(" › ")}
          </div>
          <div style={{fontSize:12,color:T.mid,fontFamily:T.font,marginBottom:16,lineHeight:1.6}}>4 hooks — with body copy and CTA — calibrated to this exact path.</div>
          <Btn onClick={generateHooks} disabled={loading}>{loading?"Generating...":"Generate Hooks →"}</Btn>
        </div>
      )}

      {stage==="hooks" && (
        <div>
          {loading && <div style={{background:T.surface,border:"1.5px solid "+T.border,borderRadius:7,padding:"16px",textAlign:"center",fontSize:13,color:T.dim,fontFamily:T.font}}>{dissectMechanism ? "Generating hooks from dissect mechanism..." : "Generating hooks using your language bank..."}</div>}
          {!loading && hooks.length>0 && (
            <>
              <div style={{fontSize:14,fontWeight:600,color:T.text,fontFamily:T.font,marginBottom:4}}>Pick your hook</div>
              <div style={{fontSize:12,color:T.dim,fontFamily:T.font,marginBottom:14}}>Click the one that feels closest. Edit if needed. Then save it or get more like it.</div>
              {hooks.map((h,i) => (
                <div key={i} onClick={()=>{setChosen(i);setEditedHook(h.hook_text);setSavedThisHook(false);}}
                  style={{background:chosen===i?T.goldL:T.surface,border:"1.5px solid "+(chosen===i?T.goldB:T.border),borderRadius:8,padding:"14px 16px",marginBottom:10,cursor:"pointer"}}>
                  <div style={{display:"flex",gap:10}}>
                    <div style={{width:22,height:22,borderRadius:"50%",background:chosen===i?T.goldB:T.border,display:"flex",alignItems:"center",justifyContent:"center",fontSize:11,fontWeight:700,color:"#fff",flexShrink:0,fontFamily:T.font}}>{i+1}</div>
                    <div style={{flex:1}}>
                      <div style={{fontSize:13,fontWeight:700,color:T.text,lineHeight:1.6,fontFamily:T.font,marginBottom:8}}>{h.hook_text}</div>
                      {h.body && <div style={{fontSize:11,color:T.mid,fontFamily:T.font,marginBottom:6,lineHeight:1.7,whiteSpace:"pre-line",display:chosen===i?"block":"-webkit-box",WebkitLineClamp:chosen===i?undefined:3,WebkitBoxOrient:"vertical",overflow:chosen===i?"visible":"hidden"}}>{h.body}</div>}
                      {h.cta && <div style={{fontSize:11,fontFamily:T.font,marginBottom:2}}><b style={{color:T.gold,fontSize:10,letterSpacing:0.5,textTransform:"uppercase"}}>CTA</b> <span style={{color:T.text,fontWeight:600}}>{h.cta}</span></div>}

                    </div>
                  </div>
                  {chosen===i && (
                    <div style={{marginTop:12,paddingTop:10,borderTop:"1px solid "+T.goldB+"40"}}>
                      <div style={{fontSize:10,fontWeight:700,letterSpacing:0.8,color:T.gold,textTransform:"uppercase",marginBottom:4,fontFamily:T.font}}>Hook</div>
                      <textarea value={editedHook} onChange={e=>setEditedHook(e.target.value)} rows={2}
                        style={{...taStyle,border:"1.5px solid "+T.goldB,marginBottom:10}}/>
                      <div style={{fontSize:10,fontWeight:700,letterSpacing:0.8,color:T.mid,textTransform:"uppercase",marginBottom:4,fontFamily:T.font}}>Body</div>
                      <textarea value={editedBody[i]??h.body??""} onChange={e=>setEditedBody(p=>({...p,[i]:e.target.value}))} rows={4}
                        style={{...taStyle,border:"1.5px solid "+T.border,marginBottom:10}}/>
                      <div style={{fontSize:10,fontWeight:700,letterSpacing:0.8,color:T.gold,textTransform:"uppercase",marginBottom:4,fontFamily:T.font}}>CTA</div>
                      <textarea value={editedCta[i]??h.cta??""} onChange={e=>setEditedCta(p=>({...p,[i]:e.target.value}))} rows={1}
                        style={{...taStyle,border:"1.5px solid "+T.goldB}}/>
                    </div>
                  )}
                </div>
              ))}
              <div style={{display:"flex",gap:8,marginTop:8,flexWrap:"wrap"}}>
                {chosen !== null && (
                  <Btn
                    onClick={saveHook}
                    disabled={alreadySaved}
                    style={alreadySaved
                      ? {flex:1, background:T.green, color:"#fff", border:"none", minWidth:120}
                      : {flex:1, background:T.text, color:"#fff", border:"none", minWidth:120}
                    }
                  >
                    {alreadySaved ? "✓ Saved" : "Save Hook →"}
                  </Btn>
                )}
                {chosen !== null && (
                  <Btn
                    onClick={generateMoreLikeThis}
                    disabled={loading}
                    variant="secondary"
                    style={{flex:1, minWidth:120}}
                  >
                    {loading ? "Generating..." : "More Like This →"}
                  </Btn>
                )}
                <Btn onClick={generateHooks} disabled={loading} variant="secondary" style={{flex: chosen===null ? 1 : undefined}}>
                  {chosen===null ? "Generate New Hooks →" : "New Hooks"}
                </Btn>
              </div>
            </>
          )}
        </div>
      )}

      {savedThisHook && stage==="hooks" && (
        <div style={{background:T.greenL,border:"1.5px solid "+T.green+"40",borderRadius:7,padding:"10px 14px",marginTop:8,fontSize:12,color:T.green,fontWeight:600,fontFamily:T.font}}>
          ✓ Hook saved — go to <b>Saved Briefs</b> to generate the Creator Brief, Editor Brief, or Campaign Card.
        </div>
      )}
    </div>
  );
}

// ── DISSECT TAB ───────────────────────────────────────────────────────────────
function DissectTab({brand, onOpenInHookBuilder}) {
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [dissection, setDissection] = useState(null);
  const [error, setError] = useState(null);

  const SYS_DISSECT = `You are a world-class creative strategist and direct response expert. When shown an ad, you dissect it with surgical precision. You explain not just WHAT the ad does but WHY it works — the psychological mechanics, the platform signals, the specific choices that create the effect.

Never say "it feels authentic." Explain what specific choices create that perception.
Be direct, specific, opinionated. This is a working session, not a consulting report.`;

  const DISSECT_PROMPT = (adDesc) => `Dissect this ad completely. Give me all 7 sections with full depth.

AD: ${adDesc}

1. HOOK MECHANISM
Name the specific technique (curiosity gap, bold claim, visual contrast, relatable scenario, transformation preview, controversy, pattern interrupt, social proof stack, benign violation, tribal identity, etc.)
What does the brain do in the first 0.3 seconds and why?

2. ANGLE
What exact desire, pain, fear, or aspiration is activated? Not "it solves a problem" — the exact emotional state and why it makes someone stop.
Which of these angles does it use: Consequences / Failed Solutions / Desired Outcome / Objections / Features+Benefits / Use Case / Misconceptions / Education / Acceptance+Normalised / Identity / Social Proof

3. PERSONA
Who is this speaking to? Be specific — age, situation, mindset, cultural context.
What evidence in the ad tells you this (language, setting, casting, humour style, references)?

4. FORMAT LOGIC
Why this format for this message? What would be lost if you changed it?
Which awareness stage is this targeting and why?

5. PSYCHOLOGICAL TRIGGER
Name the primary trigger: Pain / Desire / Fear / Identity / Curiosity / Social Proof / Transformation
Explain exactly HOW it is deployed — the specific mechanic and why the brain responds.
Name any secondary triggers activated.

6. STRUCTURE — BEAT BY BEAT
First 3 seconds: what happens and why that exact order works.
Middle: how it holds attention and builds the case.
CTA: what it asks and why that ask works here.

7. WHY IT IS WORKING
Algorithm: why the platform rewards this (engagement signals, watch time, share/save/comment behaviour).
Human: the psychological mechanism — what emotion does it end on and why does that drive action.
What makes this hard to scroll past even if you have no immediate need for the product.

Return as plain structured text with the numbered sections. Be specific. Be opinionated.`;

  const HOOK_PREFILL_PROMPT = (dissectionText, brandCtx, sourceFormat) => `You are mapping a dissected ad's mechanism to a brand's hook builder settings.

DISSECTION:
${dissectionText}

BRAND:
${brandCtx}

SOURCE AD FORMAT: ${sourceFormat || "unknown"}

YOUR JOB:
1. Extract the hook mechanism from Section 1 of the dissection VERBATIM — copy the technique name and the specific mechanic exactly as written. Do NOT re-summarise or abstract it. If Section 1 says "benign violation via sexual innuendo made safe through product context", that is the mechanism word for word.
2. The transferable_mechanism field must then state: the technique name + exactly how to apply it to this brand's product/category with a concrete example of what the hook line would feel like.
3. For format: ALWAYS respect the source ad format first. If the source was IMAGE, suggest IMAGE. Only suggest VIDEO if the mechanism genuinely requires motion (demo, before/after, UGC confession).
4. The settings must serve the mechanism — not the other way around. If the mechanism is a double entendre or benign violation, choose the formula and angle that best enables that technique, not the most "correct" strategic match.

Return ONLY raw JSON, no markdown:
{"transferable_mechanism":"[Technique name from Section 1 verbatim + how to apply it to this brand — give a concrete example of what a hook using this technique would sound like for this product]","suggested_angle":"[angle that best enables this mechanism from: Consequences, Failed Solutions, Desired Outcome, Objections, Features / Benefits, Use Case, Misconceptions, Education, Acceptance / Normalised, Identity, Social Proof]","suggested_awareness":"[best matching stage from: Unaware, Problem Aware, Solution Aware, Product Aware, Most Aware]","suggested_trigger":"[best matching trigger from: Pain, Desire, Fear, Identity, Curiosity, Social Proof, Transformation]","suggested_formula":"[formula that best enables this mechanism from: Emotional Trigger, POV Hook, Tribal Identity, Why Did No One Tell Me, Curiosity Loop, Golden Nugget, Negative Hook, I-Led Story, Before / After, Founder Intro, Give Me Time, Investment Hook]","suggested_format":"[respect source ad format — VIDEO or IMAGE]","suggested_subtype":"[specific format from: UGC Talking Head, Skit, Voiceover B-Roll, Founder Story, Answer Bubble, How-To / Demo, Review / UGC Quote, Us vs Them, Benefit Callout, Proof / Stats, Founder / Product]","why":"[2 sentences — why these specific settings best enable this mechanism for this brand]"}`;

  const runDissection = async () => {
    if (!input.trim()) return;
    setLoading(true); setDissection(null); setError(null);
    try {
      const result = await callClaude(
        [{role:"user", content:DISSECT_PROMPT(input)}],
        SYS_DISSECT, 3000
      );
      setDissection(result);
    } catch(err) { setError(err.message||"Could not dissect. Try again."); }
    setLoading(false);
  };

  const sendToHookBuilder = async () => {
    if (!dissection || !brand) return;
    setLoading(true);
    try {
      const brandCtx = "Brand: "+brand.name+"\nOrganising Idea: "+(brand.organising_idea||"")+"\nCore Persona: "+(brand.core_persona?.name||"")+" — "+(brand.core_persona?.desc||"")+"\nPain: "+(brand.core_persona?.pain||"")+"\nDesire: "+(brand.core_persona?.desire||"");
      // Detect format from dissection text — Section 4 FORMAT LOGIC often names it
      const sourceFormat = /static|image|still|photo/i.test(dissection) ? "IMAGE" : /video|ugc|talking|motion/i.test(dissection) ? "VIDEO" : "IMAGE";
      const raw = await callJSON(HOOK_PREFILL_PROMPT(dissection, brandCtx, sourceFormat), 1200);
      const parsed = JSON.parse(raw);
      onOpenInHookBuilder&&onOpenInHookBuilder({
        angle: parsed.suggested_angle,
        awareness: parsed.suggested_awareness,
        trigger: parsed.suggested_trigger,
        formula: parsed.suggested_formula,
        format: parsed.suggested_format,
        subtype: parsed.suggested_subtype,
        _mechanism: parsed.transferable_mechanism,
        _why: parsed.why,
      });
    } catch(err) { setError("Could not map to Hook Builder: "+(err.message||"Try again.")); }
    setLoading(false);
  };

  const renderDissection = (text) => {
    return text.split("\n").map((line, i) => {
      const isHeader = /^\d+\./.test(line.trim());
      return (
        <div key={i} style={{
          fontSize: isHeader ? 12 : 13,
          fontWeight: isHeader ? 800 : 400,
          color: isHeader ? T.gold : T.text,
          letterSpacing: isHeader ? 0.5 : 0,
          textTransform: isHeader ? "uppercase" : "none",
          lineHeight: 1.7,
          marginTop: isHeader ? 16 : 0,
          fontFamily: T.font,
        }}>{line}</div>
      );
    });
  };

  return (
    <div style={{maxWidth:700, margin:"0 auto"}}>
      <div style={{background:T.orangeL, border:"1.5px solid "+T.orangeB, borderRadius:10, padding:"14px 18px", marginBottom:24}}>
        <div style={{fontSize:13, fontWeight:700, color:T.orange, marginBottom:4, fontFamily:T.font}}>✦ Ad Dissect</div>
        <div style={{fontSize:12, color:T.mid, lineHeight:1.6, fontFamily:T.font}}>Paste or describe any ad that stopped you. Get a full 7-point breakdown — hook mechanism, angle, persona, format logic, psychology, beat-by-beat structure, and why it works. Then send the mechanism straight to Hook Builder.</div>
      </div>

      <div style={{background:T.surface, border:"1.5px solid "+T.border, borderRadius:8, padding:"16px 18px", marginBottom:16}}>
        <Lbl>The ad — describe it, paste the copy, or drop a URL and explain what happened</Lbl>
        <textarea
          value={input} onChange={e=>setInput(e.target.value)}
          placeholder={"Example: Static image ad. Hook: \"We want to sit on your face, respectfully.\" Red LED face mask device. Stopped me immediately, comments going crazy, everyone getting the joke.\n\nOr just describe what you saw and why it stopped you."}
          rows={5}
          style={{width:"100%", background:T.bg, border:"1.5px solid "+T.border, borderRadius:6, padding:"10px 12px", fontSize:13, color:T.text, fontFamily:T.font, resize:"vertical", outline:"none", boxSizing:"border-box", lineHeight:1.6}}
        />
        <div style={{marginTop:10}}>
          <Btn onClick={runDissection} disabled={loading||!input.trim()}>
            {loading ? "Dissecting..." : "Dissect This Ad →"}
          </Btn>
        </div>
      </div>

      {error && (
        <div style={{background:T.redL, border:"1.5px solid "+T.red+"40", borderRadius:7, padding:"12px 16px", marginBottom:16, fontSize:12, color:T.red, fontFamily:T.font}}>{error}</div>
      )}

      {dissection && (
        <div style={{background:T.surface, border:"1.5px solid "+T.border, borderRadius:8, padding:"20px 22px", marginBottom:16}}>
          <div style={{display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:16, paddingBottom:12, borderBottom:"1.5px solid "+T.border}}>
            <div style={{fontSize:13, fontWeight:700, color:T.text, fontFamily:T.font}}>Dissection</div>
            <Btn
              onClick={sendToHookBuilder}
              disabled={loading||!brand?.name}
              style={{background:T.orange, color:"#fff", border:"none", fontSize:11, padding:"7px 14px"}}
            >
              {loading ? "Mapping..." : "Try in Hook Builder →"}
            </Btn>
          </div>
          <div>{renderDissection(dissection)}</div>
          {!brand?.name && (
            <div style={{marginTop:12, fontSize:11, color:T.dim, fontFamily:T.font}}>Load a brand to enable Hook Builder mapping.</div>
          )}
        </div>
      )}
    </div>
  );
}

// ── EXPLORE TAB ───────────────────────────────────────────────────────────────
function ExploreTab({brand, onUpdate, onOpenInHookBuilder}) {
  const savedBriefs = brand.savedBriefs||[];
  const usedAngles = [...new Set(savedBriefs.map(b=>b.selections?.angle).filter(Boolean))];
  const usedFormats = [...new Set(savedBriefs.map(b=>b.selections?.subtype).filter(Boolean))];
  const [personaSuggestions, setPersonaSuggestions] = useState(null);
  const [loadingPersonas, setLoadingPersonas] = useState(false);
  const [expandedAngle, setExpandedAngle] = useState(null);
  const [angleInsight, setAngleInsight] = useState({});

  const unusedAngles = ANGLES.filter(a=>!usedAngles.includes(a));
  const unusedFormats = Object.values(FORMATS).flat().filter(f=>!usedFormats.includes(f));

  const getAngleInsight = async (angle) => {
    if (angleInsight[angle]) { setExpandedAngle(expandedAngle===angle?null:angle); return; }
    setExpandedAngle(angle);
    try {
      const insight = await callClaude(
        [{role:"user",content:"Brand: "+brand.name+"\nOrganising Idea: "+(brand.organising_idea||"")+"\nCore Persona: "+(brand.core_persona?.name||"")+" — "+(brand.core_persona?.desc||"")+"\nPain: "+(brand.core_persona?.pain||"")+"\nDesire: "+(brand.core_persona?.desire||"")+"\nProof Points: "+((brand.proof_points||[]).join(", "))+"\n\nIn 2-3 sentences, explain specifically why the \""+angle+"\" angle ("+ANGLE_DEFS[angle]+") is the right next test for this brand. Be concrete — reference their actual persona, pain, or white space. Then on a new line write: BEST PATH: [awareness stage] › [hook formula]. Use exactly those labels from these options — Awareness: Unaware/Problem Aware/Solution Aware/Product Aware/Most Aware. Formula: Emotional Trigger/POV Hook/Tribal Identity/Why Did No One Tell Me/Curiosity Loop/Golden Nugget/Negative Hook/I-Led Story/Before \/After/Founder Intro/Give Me Time/Investment Hook.\n\nReturn as plain text, no markdown."}],
        null, 400
      );
      setAngleInsight(p=>({...p,[angle]:insight}));
    } catch { setAngleInsight(p=>({...p,[angle]:"Could not generate insight. Try again."})); }
  };

  const generatePersonaSuggestions = async () => {
    setLoadingPersonas(true);
    const prompt = "Brand: "+brand.name+"\nProduct/Service: "+(brand.organising_idea||"")+"\nCurrent Core Persona: "+(brand.core_persona?.name||"")+" — "+(brand.core_persona?.desc||"")+"\nCurrent Secondary Persona: "+(brand.secondary_persona?.name||"none")+"\nProof Points: "+((brand.proof_points||[]).join(", "))+"\n\nBased on the Loop Earplugs micro-targeting model (one product many identity-based tribes), suggest 4 additional personas this brand hasn't targeted yet. Each should be an identity-based tribe, not just demographics.\n\nReturn ONLY raw JSON, no markdown:\n[{\"name\":\"persona name\",\"identity\":\"who they are in one sentence\",\"trigger\":\"the moment they'd reach for this product\",\"best_angle\":\"which angle from: "+ANGLES.join(", ")+"\",\"awareness_stage\":\"which of: Unaware/Problem Aware/Solution Aware/Product Aware/Most Aware\",\"why\":\"one sentence why this persona is a real opportunity\"}]";
    try {
      const raw = await callJSON(prompt, 1200);
      setPersonaSuggestions(JSON.parse(raw));
    } catch { setPersonaSuggestions([{name:"Error",identity:"Could not generate. Try again.",trigger:"",best_angle:"",awareness_stage:"",why:""}]); }
    setLoadingPersonas(false);
  };

  const addPersona = (p) => {
    const extra = [...(brand.extra_personas||[]),{name:p.name,desc:p.identity,desire:p.trigger,pain:"",age:"",language:{trigger:[],pain:[],desire:[],objection:[]}}];
    onUpdate({...brand,extra_personas:extra});
  };

  const awCols = {"Unaware":{c:T.red,bg:T.redL},"Problem Aware":{c:T.orange,bg:T.orangeL},"Solution Aware":{c:T.gold,bg:T.goldL},"Product Aware":{c:T.blue,bg:T.blueL},"Most Aware":{c:T.green,bg:T.greenL}};

  return (
    <div style={{maxWidth:700,margin:"0 auto"}}>
      <div style={{background:T.purpleL,border:"1.5px solid "+T.purple,borderRadius:10,padding:"14px 18px",marginBottom:24}}>
        <div style={{fontSize:13,fontWeight:700,color:T.purple,marginBottom:4,fontFamily:T.font}}>✦ Explore</div>
        <div style={{fontSize:12,color:T.mid,lineHeight:1.6,fontFamily:T.font}}>Find the creative territory you haven't tested yet. Three ways in: by <b style={{color:T.text}}>angle</b> (what perspective the ad takes), by <b style={{color:T.text}}>persona</b> (who you're talking to), or by <b style={{color:T.text}}>format</b> (how the ad looks). Each path lands you in Hook Builder with the right settings pre-filled.</div>
      </div>

      {/* Angle Gaps */}
      <div style={{marginBottom:28}}>
        <div style={{fontSize:14,fontWeight:700,color:T.text,marginBottom:4,paddingBottom:8,borderBottom:"2px solid "+T.border,fontFamily:T.font}}>
          Untested Angles <span style={{fontSize:11,fontWeight:400,color:T.dim}}>— {unusedAngles.length} of {ANGLES.length} not yet tested</span>
        </div>
        <div style={{fontSize:11,color:T.dim,marginBottom:12,fontFamily:T.font,lineHeight:1.5}}>The angle determines which moment in your persona's story the ad enters from. Click any angle to get an AI-generated case for why your brand should test it.</div>
        {unusedAngles.length===0&&<div style={{fontSize:13,color:T.green,padding:"12px 0",fontFamily:T.font}}>✓ You've explored all angles — impressive coverage.</div>}
        <div style={{display:"flex",flexWrap:"wrap",gap:8,marginBottom:8}}>
          {usedAngles.map(a=>(
            <span key={a} style={{fontSize:11,color:T.green,background:T.greenL,border:"1px solid "+T.green+"40",borderRadius:4,padding:"3px 10px",fontWeight:700,fontFamily:T.font}}>✓ {a}</span>
          ))}
        </div>
        {unusedAngles.map(a=>(
          <div key={a} style={{background:T.surface,border:"1.5px solid "+T.border,borderRadius:8,marginBottom:8,overflow:"hidden"}}>
            <div style={{padding:"12px 16px",display:"flex",alignItems:"center",justifyContent:"space-between",gap:10,cursor:"pointer"}} onClick={()=>getAngleInsight(a)}>
              <div>
                <div style={{fontSize:13,fontWeight:700,color:T.text,fontFamily:T.font}}>{a}</div>
                <div style={{fontSize:11,color:T.dim,marginTop:2,fontFamily:T.font}}>{ANGLE_DEFS[a]}</div>
              </div>
              <span style={{fontSize:11,color:T.gold,fontWeight:700,whiteSpace:"nowrap",fontFamily:T.font}}>{expandedAngle===a?"▲ Hide":"▼ Why try this?"}</span>
            </div>
            {expandedAngle===a&&(
              <div style={{borderTop:"1px solid "+T.border,padding:"12px 16px",background:T.warm}}>
                {angleInsight[a]
                  ? (() => {
                      const insight = angleInsight[a]||"";
                      const pathLine2 = insight.split("\n").find(l=>l.includes("BEST PATH:"))||"";
                      const bestPath = pathLine2.replace("BEST PATH:","").trim();
                      const mainText = insight.split("\n").filter(l=>!l.includes("BEST PATH:")).join("\n").trim();
                      return <>
                        <div style={{fontSize:12,color:T.mid,lineHeight:1.7,marginBottom:bestPath?6:10,fontFamily:T.font}}>{mainText}</div>
                        {bestPath && <div style={{fontSize:11,fontWeight:700,color:T.purple,background:T.purpleL,border:"1px solid "+T.purple+"30",borderRadius:5,padding:"5px 10px",marginBottom:10,fontFamily:T.font}}>Best path: {bestPath}</div>}
                        <Btn onClick={()=>{
                        // Parse BEST PATH from insight if available
                        const insight = angleInsight[a]||"";
                        const pathLine = insight.split("\n").find(l=>l.includes("BEST PATH:"))||"";
                        const pathContent = pathLine.replace("BEST PATH:","").trim();
                        const pathParts = pathContent.split("›").map(s=>s.trim());
                        const awareness = pathParts[0]||"";
                        const formula = pathParts[1]||"";
                        onOpenInHookBuilder&&onOpenInHookBuilder({angle:a, awareness:awareness||undefined, formula:formula||undefined});
                      }} variant="secondary" style={{fontSize:11}}>Open in Hook Builder →</Btn>
                      </>;
                    })()
                  : <div style={{fontSize:12,color:T.dim,fontStyle:"italic",fontFamily:T.font}}>Loading insight...</div>
                }
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Persona Expansion */}
      <div style={{marginBottom:28}}>
        <div style={{fontSize:14,fontWeight:700,color:T.text,marginBottom:4,paddingBottom:8,borderBottom:"2px solid "+T.border,fontFamily:T.font}}>Persona Expansion</div>
        <div style={{fontSize:12,color:T.mid,marginBottom:14,lineHeight:1.6,fontFamily:T.font}}>One product, many tribes. The AI suggests identity-based audiences you haven't built for yet — each with a specific moment that would make them stop scrolling. Add any to Brand Inputs, then take it straight to Hook Builder with awareness stage and best angle pre-filled.</div>
        {!personaSuggestions&&(
          <Btn onClick={generatePersonaSuggestions} disabled={loadingPersonas||!brand.name} variant="secondary">
            {loadingPersonas?"Finding personas...":"Suggest New Personas →"}
          </Btn>
        )}
        {personaSuggestions&&(
          <div>
            {personaSuggestions.map((p,i)=>{
              const cols = awCols[p.awareness_stage]||{c:T.gold,bg:T.goldL};
              const alreadyAdded = (brand.extra_personas||[]).some(ep=>ep.name===p.name);
              return (
                <div key={i} style={{background:T.surface,border:"1.5px solid "+T.border,borderLeft:"4px solid "+cols.c,borderRadius:8,padding:"14px 18px",marginBottom:10}}>
                  <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",gap:10,flexWrap:"wrap"}}>
                    <div style={{flex:1}}>
                      <div style={{fontSize:14,fontWeight:700,color:T.text,marginBottom:4,fontFamily:T.font}}>{p.name}</div>
                      <div style={{fontSize:12,color:T.mid,marginBottom:6,fontFamily:T.font}}>{p.identity}</div>
                      <div style={{display:"flex",gap:6,flexWrap:"wrap",marginBottom:8}}>
                        <Chip label={p.awareness_stage} c={cols.c} bg={cols.bg} b={cols.c}/>
                        <Chip label={p.best_angle} c={T.mid} bg={T.warm} b={T.border}/>
                      </div>
                      <div style={{fontSize:11,color:T.dim,marginBottom:4,fontFamily:T.font}}><b style={{color:T.text}}>Trigger:</b> {p.trigger}</div>
                      <div style={{fontSize:11,color:T.dim,fontFamily:T.font}}><b style={{color:T.text}}>Why:</b> {p.why}</div>
                    </div>
                    <div style={{display:"flex",flexDirection:"column",gap:6,flexShrink:0}}>
                      {!alreadyAdded&&<Btn onClick={()=>addPersona(p)} variant="secondary" style={{fontSize:11,padding:"6px 12px"}}>Add Persona</Btn>}
                      {alreadyAdded&&<span style={{fontSize:11,color:T.green,fontWeight:700,fontFamily:T.font}}>✓ Added</span>}
                      <Btn onClick={()=>onOpenInHookBuilder&&onOpenInHookBuilder({persona:p.name,awareness:p.awareness_stage,angle:p.best_angle})} variant="secondary" style={{fontSize:11,padding:"6px 12px"}}>Try in Hook Builder →</Btn>
                    </div>
                  </div>
                </div>
              );
            })}
            <button onClick={()=>setPersonaSuggestions(null)} style={{fontSize:11,color:T.dim,background:"none",border:"none",cursor:"pointer",textDecoration:"underline",marginTop:4,fontFamily:T.font}}>Regenerate suggestions</button>
          </div>
        )}
      </div>

      {/* Untried Formats */}
      <div>
        <div style={{fontSize:14,fontWeight:700,color:T.text,marginBottom:4,paddingBottom:8,borderBottom:"2px solid "+T.border,fontFamily:T.font}}>
          Untried Formats <span style={{fontSize:11,fontWeight:400,color:T.dim}}>— {unusedFormats.length} unused of {Object.values(FORMATS).flat().length}</span>
        </div>
        {unusedFormats.length===0&&<div style={{fontSize:13,color:T.green,padding:"12px 0",fontFamily:T.font}}>✓ You've tried every format.</div>}
        <div style={{display:"flex",flexWrap:"wrap",gap:8}}>
          {unusedFormats.map(f=>{
            const isVideo = FORMATS.VIDEO.includes(f);
            return (
              <div key={f} style={{background:T.surface,border:"1.5px solid "+T.border,borderRadius:8,padding:"12px 16px",flex:"1 1 200px"}}>
                <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:6}}>
                  <Chip label={isVideo?"VIDEO":"IMAGE"} c={isVideo?T.blue:T.purple} bg={isVideo?T.blueL:T.purpleL} b={isVideo?T.blue:T.purple}/>
                  <div style={{fontSize:13,fontWeight:700,color:T.text,fontFamily:T.font}}>{f}</div>
                </div>
                <div style={{fontSize:11,color:T.dim,marginBottom:10,lineHeight:1.5,fontFamily:T.font}}>{FORMAT_DEFS[f]}</div>
                <Btn onClick={()=>onOpenInHookBuilder&&onOpenInHookBuilder({subtype:f,format:isVideo?"VIDEO":"IMAGE"})} variant="secondary" style={{fontSize:11,padding:"6px 12px",width:"100%"}}>Try in Hook Builder →</Btn>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ── SAVED BRIEFS ──────────────────────────────────────────────────────────────
function getBriefTextFromGenerated(data, type, hook, brand) {
  const sel = hook.selections || {};
  const meta = (sel.subtype||"")+" | "+(sel.awareness||"")+" | "+(sel.persona||"")+" | "+(hook.date||"");
  if (type === "creator") {
    const isImage = sel.format==="IMAGE" || ["Benefit Callout","Proof / Stats","Review / UGC Quote","Us vs Them"].includes(sel.subtype);
    return [
      "CREATOR BRIEF — "+(hook.brand||brand?.name||""),
      meta,"",
      "HOOK TEXT",data.hook_text||"","",
      "VISUAL DIRECTION",data.hook_visual||"","",
      "CONTEXT",data.context_line||"","",
      ...(isImage ? [] : [
        "SHOT LIST",
        ...((data.shot_list||[]).map((s,i)=>(i+1)+". "+s)),""
      ]),
      "FILMING FEEL",data.filming_feel||"","",
      "DOS",...(data.dos||[]).map(d=>"+ "+d),"",
      "DON'TS",...(data.donts||[]).map(d=>"- "+d),"",
      "HOOK VARIATIONS",
      ...((data.hook_variations||[]).map((v,i)=>(i+1)+". "+v)),
    ].filter(x=>x!==undefined).join("\n");
  }
  if (type === "editor") {
    return [
      "EDITOR BRIEF — "+(hook.brand||brand?.name||""),
      meta,"",
      "HOOK TEXT",data.hook_text||"","",
      "CAPTION BREAKDOWN",
      ...((data.caption_instructions||[]).map(ci=>[
        "-- "+ci.beat+" --",
        "VOICEOVER: "+(ci.voiceover||""),
        "ON-SCREEN: "+(ci.on_screen_text||""),
        "VISUAL: "+(ci.suggested_visual||""),""
      ]).flat()),
      "FILMING NOTES",data.filming_notes||"","",
      "OVERVIEW",data.overview||"",
    ].filter(x=>x!==undefined).join("\n");
  }
  // campaign
  const cc = data.campaign_card || {};
  return [
    "CAMPAIGN CARD — "+(hook.brand||brand?.name||""),
    "Date: "+(hook.date||""),"",
    "CONCEPT: "+(cc.concept_name||""),
    "HOOK: "+(hook.hook_text||""),
    "ANGLE: "+(cc.angle||sel.angle||""),
    "AWARENESS: "+(cc.awareness_stage||sel.awareness||""),
    "PERSONA: "+(cc.persona||sel.persona||""),
    "FORMAT: "+(cc.format||sel.subtype||""),
    "HYPOTHESIS: "+(cc.hypothesis||""),
    "SUCCESS METRIC: "+(cc.success_metric||""),
    "STATUS: Testing",
  ].join("\n");
}

function getBriefText(brief, type) {
  const meta = (brief.selections?.subtype||"")+" | "+(brief.selections?.awareness||"")+" | "+(brief.selections?.persona||"")+" | "+(brief.date||"");
  if (type === "creator") {
    return ["CREATOR BRIEF — "+(brief.brand||""),meta,"",
      "HOOK TEXT",brief.hook_text||"","",
      "VISUAL DIRECTION",brief.hook_visual||"","",
      (brief.hook_audio&&brief.hook_audio!=="N/A")?"AUDIO DIRECTION\n"+(brief.hook_audio||""):"",
      "HOOK VARIATIONS","1. "+(brief.hook_variations?.[0]||""),"2. "+(brief.hook_variations?.[1]||""),"3. "+(brief.hook_variations?.[2]||""),"",
      "AHA MOMENT",brief.aha||"","",
      "SCRIPT STRUCTURE",
      "GUT (0-3s): "+(brief.gut||""),
      "BRAIN A (3-8s): "+(brief.brain_a||""),
      "BRAIN B (8-15s): "+(brief.brain_b||""),
      "POCKET: "+(brief.pocket||""),"",
      "SHOT LIST",...(brief.shot_list||[]).map((s,i)=>(i+1)+". "+s),"",
      "DOS",...(brief.dos||[]).map(d=>"+ "+d),"",
      "DON'TS",...(brief.donts||[]).map(d=>"- "+d),"",
      "CASTING",brief.casting||"","",
      "FILMING SPEC",brief.filming||"",
    ].filter(x=>x!=="").join("\n");
  }
  if (type === "editor") {
    return ["EDITOR BRIEF — "+(brief.brand||""),meta,"",
      "HOOK TEXT",brief.hook_text||"","",
      "CAPTION INSTRUCTIONS",
      ...((brief.caption_instructions||[]).map((ci,i)=>["-- Line "+(i+1)+" --","VOICEOVER: "+(ci.voiceover||""),"ON-SCREEN: "+(ci.on_screen_text||""),"VISUAL: "+(ci.suggested_visual||""),""]).flat()),
      "FILMING NOTES",brief.filming||"","",
      "OVERVIEW",brief.overview||"",
    ].filter(x=>x!=="").join("\n");
  }
  const cc = brief.campaign_card || {};
  return ["CAMPAIGN CARD — "+(brief.brand||""),"Date: "+(brief.date||""),"",
    "CONCEPT: "+(cc.concept_name||""),
    "HOOK: "+(brief.hook_text||""),
    "ANGLE: "+(cc.angle||""),
    "AWARENESS: "+(cc.awareness_stage||""),
    "PERSONA: "+(cc.persona||""),
    "FORMAT: "+(cc.format||""),
    "HYPOTHESIS: "+(cc.hypothesis||""),
    "SUCCESS METRIC: "+(cc.success_metric||""),
    "STATUS: Testing",
  ].join("\n");
}

function BriefOutput({brief, type}) {
  const [copied, setCopied] = useState(false);
  const txt = getBriefText(brief, type);
  const label = type==="creator"?"Creator Brief":type==="editor"?"Editor Brief":"Campaign Card";
  const copy = () => {
    navigator.clipboard.writeText(txt).then(()=>{setCopied(true);setTimeout(()=>setCopied(false),2000);});
  };
  return (
    <div style={{marginTop:12}}>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:6}}>
        <div style={{fontSize:10,fontWeight:600,color:T.dim,fontFamily:T.font,letterSpacing:0.5,textTransform:"uppercase"}}>{label}</div>
        <button onClick={copy}
          style={{fontSize:11,fontWeight:600,color:copied?T.green:T.gold,background:copied?T.greenL:T.goldL,border:"1px solid "+(copied?T.green:T.goldB),borderRadius:5,padding:"4px 12px",cursor:"pointer",fontFamily:T.font}}>
          {copied ? "✓ Copied" : "Copy all"}
        </button>
      </div>
      <pre style={{background:T.warm,border:"1px solid "+T.border,borderRadius:6,padding:"14px 16px",fontSize:11,fontFamily:T.mono,color:T.text,lineHeight:1.7,whiteSpace:"pre-wrap",wordBreak:"break-word",maxHeight:400,overflowY:"auto",margin:0}}>{txt}</pre>
    </div>
  );
}

function GeneratedBriefDisplay({data, type, hook, brand}) {
  const [copied, setCopied] = useState(false);
  const copyText = () => {
    const txt = getBriefTextFromGenerated(data, type, hook, brand);
    navigator.clipboard.writeText(txt).then(()=>{setCopied(true);setTimeout(()=>setCopied(false),2000);});
  };
  return (
    <div style={{marginTop:10}}>
      <div style={{display:"flex",justifyContent:"flex-end",marginBottom:6}}>
        <button onClick={copyText} style={{fontSize:11,fontWeight:600,color:copied?T.green:T.gold,background:copied?T.greenL:T.goldL,border:"1px solid "+(copied?T.green:T.goldB),borderRadius:5,padding:"4px 12px",cursor:"pointer",fontFamily:T.font}}>{copied?"✓ Copied":"Copy all"}</button>
      </div>
      <pre style={{background:T.warm,border:"1px solid "+T.border,borderRadius:6,padding:"14px 16px",fontSize:11,fontFamily:T.mono,color:T.text,lineHeight:1.7,whiteSpace:"pre-wrap",wordBreak:"break-word",maxHeight:500,overflowY:"auto",margin:0}}>
        {getBriefTextFromGenerated(data, type, hook, brand)}
      </pre>
    </div>
  );
}

function SavedBriefsTab({brand, onUpdate}) {
  const [selected, setSelected] = useState(null);
  const [outputType, setOutputType] = useState(null);
  const [generating, setGenerating] = useState(false);
  const [generatedBriefs, setGeneratedBriefs] = useState({}); // keyed by brief id + type
  const briefs = brand.savedBriefs || [];

  const removeBrief = (id) => {
    const updated = briefs.filter((b,i)=>b.id?b.id!==id:i!==id);
    onUpdate({...brand,savedBriefs:updated});
    if (selected?.id===id) { setSelected(null); setOutputType(null); }
  };

  const markLive = (b) => {
    const cc = generatedBriefs[b.id+"_campaign"]?.campaign_card || b.campaign_card || {};
    const item = {...cc,id:b.id,hook_text:b.hook_text,date_launched:new Date().toLocaleDateString(),status:"Testing",notes:""};
    onUpdate({...brand,runningConcepts:[...(brand.runningConcepts||[]),item]});
  };
  const isLive = (b) => (brand.runningConcepts||[]).some(r=>r.id===b.id);

  const generateBriefForHook = async (hook, type) => {
    const key = hook.id+"_"+type;
    if (generatedBriefs[key]) { setOutputType(type); return; }
    setGenerating(true); setOutputType(type);

    const sel = hook.selections || {};
    const persona = brand.core_persona?.name===sel.persona ? brand.core_persona
      : brand.secondary_persona?.name===sel.persona ? brand.secondary_persona
      : (brand.extra_personas||[]).find(p=>p.name===sel.persona) || brand.core_persona;
    const lang = persona?.language || {};
    const principle = sel.principle==="Pain-First"
      ? "PAIN-FIRST: Lead with problem, frustration, failure."
      : "DESIRE-FIRST: Lead with identity, vision, aspiration.";

    const ctx = "BRAND: "+brand.name+"\nOrganising Idea: "+(brand.organising_idea||"")+"\nStrategic Tension: "+(brand.strategic_tension||"")+"\nWhite Space: "+(brand.white_space||"")
      +"\n\nPERSONA: "+sel.persona+"\nDescription: "+(persona?.desc||"")+"\nDesire: "+(persona?.desire||"")+"\nPain: "+(persona?.pain||"")
      +"\n\nPRINCIPLE: "+principle
      +"\n\nAWARENESS: "+sel.awareness
      +"\n\nANGLE: "+sel.angle
      +"\n\nFORMAT: "+sel.format+" — "+sel.subtype
      +"\n\nFORMULA: "+sel.formula
      +"\n\nLANGUAGE BANK:\nTRIGGER: "+((lang.trigger||[]).join(" | ")||"none")+"\nPAIN: "+((lang.pain||[]).join(" | ")||"none")+"\nDESIRE: "+((lang.desire||[]).join(" | ")||"none")+"\nOBJECTION: "+((lang.objection||[]).join(" | ")||"none")
      +"\n\nPROOF POINTS: "+((brand.proof_points||[]).filter(Boolean).join(" | ")||"none");

    const hookLine = hook.hook_text||"";
    const hookVisual = hook.hook_visual||"";
    const isImage = sel.format==="IMAGE" || ["Benefit Callout","Proof / Stats","Review / UGC Quote","Us vs Them"].includes(sel.subtype);

    try {
      if (type === "creator") {
        // Savannah-style creator brief: lean, executable, what the creator needs to film
        const prompt = `You are briefing a UGC creator — the person who will film this ad. Give them exactly what they need to execute. Nothing strategic, nothing theoretical. Specific, visual, actionable.

${ctx}

HOOK: "${hookLine}"
VISUAL: ${hookVisual}
FORMAT: ${isImage ? "STATIC IMAGE" : sel.subtype||"VIDEO"}

Think through the GBP structure (Gut 0-5s → Brain A proof → Brain B objections → Pocket CTA) and the angle (${sel.angle}) to inform what shots and script beats are needed. Then write the creator brief — do NOT include GBP labels in the output. The creator doesn't need to know the framework, just what to do.

Return ONLY raw JSON, no markdown:
{
  "hook_text": "${hookLine.replace(/"/g,'\"')}",
  "hook_visual": "${hookVisual.replace(/"/g,'\"')}",
  "context_line": "[One sentence: who she is, what she's feeling, what the ad must do — written as a briefing note to the creator, not a persona description]",
  "shot_list": ["[Shot 1: subject, location, what camera sees, what emotion is visible — e.g. 'Woman alone in bedroom. Close-up on her face looking down at ring. Anxiety in eyes, not yet voiced.']","[Shot 2]","[Shot 3]","[Shot 4]","[Shot 5]","[Shot 6]"],
  "filming_feel": "[2-3 sentences: energy, pacing, camera style, lighting. Written like a director's note — e.g. 'Handheld, intimate. Close on face first 2 seconds. Warm natural light. Confessional not performative.']",
  "dos": ["[Do 1: specific execution instruction — what to do and why it matters for this specific hook]","[Do 2]","[Do 3]"],
  "donts": ["[Don't 1: specific failure mode — what would kill this hook or make it generic]","[Don't 2]","[Don't 3]"],
  "hook_variations": ["[Alternative hook line 1 — same energy, different wording]","[Alternative hook line 2]","[Alternative hook line 3]"]
}`;
        const raw = await callJSON(prompt, 2500);
        const parsed = JSON.parse(raw);
        setGeneratedBriefs(p=>({...p,[key]:parsed}));

      } else if (type === "editor") {
        const prompt = `You are briefing a video editor. Give them the exact caption-by-caption breakdown — voiceover, on-screen text, and visual for each beat. This is their cut sheet.

${ctx}

HOOK: "${hookLine}"
FORMAT: ${isImage ? "STATIC IMAGE" : sel.subtype||"VIDEO"}

Think through the full GBP arc: Gut (0-5s emotional hit) → Brain A (proof, 5-15s) → Brain B (objections, 15-25s) → Pocket (CTA, 3-7s). Map each caption beat to that arc.

Return ONLY raw JSON, no markdown:
{
  "hook_text": "${hookLine.replace(/"/g,'\"')}",
  "caption_instructions": [
    {"beat":"Gut (0-5s)","voiceover":"[Exact words]","on_screen_text":"[Text overlay if any]","suggested_visual":"[What the editor cuts to]"},
    {"beat":"Brain A","voiceover":"[Exact words — proof with specific numbers]","on_screen_text":"[Text overlay]","suggested_visual":"[Visual]"},
    {"beat":"Brain B","voiceover":"[Exact words — objection addressed]","on_screen_text":"[Text overlay]","suggested_visual":"[Visual]"},
    {"beat":"Pocket (CTA)","voiceover":"[Exact CTA words]","on_screen_text":"[CTA text overlay]","suggested_visual":"[Final visual]"}
  ],
  "filming_notes": "[Pacing, cuts, transitions, music direction — specific to this format]",
  "overview": "[What this ad must accomplish — written for the editor so they understand what they're building toward]"
}`;
        const raw = await callJSON(prompt, 2000);
        const parsed = JSON.parse(raw);
        setGeneratedBriefs(p=>({...p,[key]:parsed}));

      } else if (type === "campaign") {
        const prompt = `You are building a campaign card for a media buyer. This is the hypothesis record — what this ad is testing and how to know if it worked.

${ctx}

HOOK: "${hookLine}"
FORMAT: ${sel.subtype||"VIDEO"}

Think through the Asset Triangle (Audience → Angle → Ad) and identify exactly which Pain x Audience intersection this tests.

Return ONLY raw JSON, no markdown:
{"campaign_card":{"concept_name":"[3-5 word name for this concept]","hook":"${hookLine.replace(/"/g,'\"')}","angle":"${sel.angle||""}","awareness_stage":"${sel.awareness||""}","persona":"${sel.persona||""}","format":"${sel.subtype||""}","hypothesis":"[Which Pain x Audience intersection this tests — what we learn if it works AND if it fails]","success_metric":"[Hook rate target / CTR target / CPA target — specific numbers]"}}`;
        const raw = await callJSON(prompt, 800);
        const parsed = JSON.parse(raw);
        setGeneratedBriefs(p=>({...p,[key]:parsed}));
      }
    } catch(err) {
      setGeneratedBriefs(p=>({...p,[key]:{error:true,message:err.message||"Generation failed"}}));
    }
    setGenerating(false);
  };

  const renderGeneratedBrief = (data, type, hook) => {
    if (!data) return null;
    if (data.error) return <div style={{color:T.red,fontSize:12,fontFamily:T.font,padding:"8px 0"}}>{data.message} — <button onClick={()=>generateBriefForHook(hook,type)} style={{color:T.red,background:"none",border:"none",cursor:"pointer",textDecoration:"underline",fontFamily:T.font}}>Retry</button></div>;
    return <GeneratedBriefDisplay data={data} type={type} hook={hook} brand={brand}/>;
  };

  if (briefs.length===0) return <div style={{padding:48,textAlign:"center",color:T.dim,fontSize:13,fontFamily:T.font}}>No saved hooks yet. Find a hook in Hook Builder and hit Save Hook.</div>;

  return (
    <div style={{maxWidth:680,margin:"0 auto"}}>
      <div style={{fontSize:11,fontWeight:700,color:T.text,marginBottom:12,paddingBottom:8,borderBottom:"1.5px solid "+T.border,fontFamily:T.font,letterSpacing:0.5,textTransform:"uppercase"}}>
        Saved Hooks ({briefs.length})
      </div>

      {briefs.map((b,i) => (
        <div key={b.id||i} onClick={()=>{setSelected(b);setOutputType(null);}}
          style={{background:selected?.id===b.id?T.goldL:T.surface,border:"1.5px solid "+(selected?.id===b.id?T.goldB:T.border),borderRadius:7,padding:"12px 14px",marginBottom:7,cursor:"pointer"}}>
          <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",gap:10}}>
            <div style={{flex:1,minWidth:0}}>
              <div style={{fontSize:12,fontWeight:600,color:T.text,fontFamily:T.font,marginBottom:4,lineHeight:1.5}}>"{b.hook_text}"</div>
              {b.body && <div style={{fontSize:11,color:T.mid,fontFamily:T.font,marginBottom:4,lineHeight:1.6,whiteSpace:"pre-line"}}>{b.body}</div>}
              {b.cta && <div style={{fontSize:11,fontFamily:T.font,marginBottom:6}}><b style={{color:T.gold,fontSize:10,letterSpacing:0.5,textTransform:"uppercase"}}>CTA</b> <span style={{color:T.text,fontWeight:600}}>{b.cta}</span></div>}
              <div style={{display:"flex",gap:5,flexWrap:"wrap",alignItems:"center"}}>
                {b.selections?.mechanism && <Chip label="⚡ Dissect" c={T.orange} bg={T.orangeL} b={T.orangeB}/>}
                {b.selections?.subtype && <Chip label={b.selections.subtype} c={T.blue} bg={T.blueL} b={T.blue}/>}
                {b.selections?.awareness && <Chip label={b.selections.awareness} c={T.mid} bg={T.warm} b={T.border}/>}
                {b.selections?.persona && <Chip label={b.selections.persona} c={T.green} bg={T.greenL} b={T.green}/>}
                <span style={{fontSize:10,color:T.dim,fontFamily:T.font}}>{b.date}</span>
                {isLive(b) && <Chip label="Live" c={T.green} bg={T.greenL} b={T.green}/>}
              </div>
            </div>
            <button onClick={e=>{e.stopPropagation();removeBrief(b.id||i);}} style={{fontSize:12,color:T.dim,background:"none",border:"none",cursor:"pointer"}}>✕</button>
          </div>
        </div>
      ))}

      {selected && (
        <div style={{background:T.surface,border:"1.5px solid "+T.border,borderRadius:9,padding:"18px 20px",marginTop:16}}>
          <div style={{fontSize:11,color:T.dim,fontFamily:T.font,marginBottom:14,lineHeight:1.5}}>"{selected.hook_text}"</div>
          <div style={{display:"flex",gap:8,flexWrap:"wrap",marginBottom:14}}>
            {[
              {t:"creator",l:"Creator Brief",d:"For the person filming",c:T.gold},
              {t:"editor",l:"Editor Brief",d:"For the person cutting",c:T.purple},
              {t:"campaign",l:"Campaign Card",d:"For the media buyer",c:T.blue},
            ].map(opt => (
              <button key={opt.t}
                onClick={()=>generateBriefForHook(selected, opt.t)}
                style={{flex:"1 1 130px",background:outputType===opt.t?opt.c:T.surface,border:"1.5px solid "+(outputType===opt.t?opt.c:T.border),borderRadius:7,padding:"10px 12px",cursor:"pointer",textAlign:"left",opacity:generating&&outputType!==opt.t?0.5:1}}>
                <div style={{fontSize:11,fontWeight:600,color:outputType===opt.t?"#fff":T.text,fontFamily:T.font,marginBottom:2}}>{opt.l}</div>
                <div style={{fontSize:10,color:outputType===opt.t?"rgba(255,255,255,0.75)":T.dim,fontFamily:T.font}}>
                  {outputType===opt.t&&generating ? "Generating..." : generatedBriefs[selected.id+"_"+opt.t] ? "✓ Generated — "+opt.d : opt.d}
                </div>
              </button>
            ))}
          </div>
          {outputType && generating && <div style={{fontSize:12,color:T.dim,fontFamily:T.font,padding:"12px 0"}}>Generating {outputType} brief...</div>}
          {outputType && !generating && renderGeneratedBrief(generatedBriefs[selected.id+"_"+outputType], outputType, selected)}
          <div style={{display:"flex",gap:8,flexWrap:"wrap",marginTop:12}}>
            {!isLive(selected)
              ? <Btn onClick={()=>markLive(selected)} variant="secondary">Mark as Live →</Btn>
              : <span style={{fontSize:12,color:T.green,fontWeight:600,fontFamily:T.font,alignSelf:"center"}}>✓ Live</span>
            }
          </div>
        </div>
      )}
    </div>
  );
}

// ── WHAT'S RUNNING ────────────────────────────────────────────────────────────
function RunningTab({brand, onUpdate}) {
  const running = brand.runningConcepts || [];
  const STATUS = ["Testing","Has Data","Scaling","Fatiguing","Paused"];
  const sC = {Testing:T.gold,"Has Data":T.blue,Scaling:T.green,Fatiguing:T.orange,Paused:T.dim};

  const update = (id,field,val) => {
    onUpdate({...brand,runningConcepts:running.map(r=>r.id===id?{...r,[field]:val}:r)});
  };
  const remove = (id) => onUpdate({...brand,runningConcepts:running.filter(r=>r.id!==id)});

  if (running.length===0) return <div style={{padding:48,textAlign:"center",color:T.dim,fontSize:13,fontFamily:T.font}}>No live concepts yet. Go to Saved Briefs and mark one as live.</div>;

  return (
    <div style={{maxWidth:680,margin:"0 auto"}}>
      <div style={{fontSize:11,fontWeight:700,color:T.text,marginBottom:12,paddingBottom:8,borderBottom:"1.5px solid "+T.border,fontFamily:T.font,letterSpacing:0.5,textTransform:"uppercase"}}>
        What's Running ({running.length})
      </div>
      {running.map(r => (
        <div key={r.id} style={{background:T.surface,border:"1.5px solid "+T.border,borderRadius:8,padding:"14px 18px",marginBottom:12}}>
          <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",gap:10,marginBottom:10}}>
            <div style={{flex:1}}>
              <div style={{fontSize:12,fontWeight:600,color:T.text,fontFamily:T.font,marginBottom:4}}>"{r.hook_text}"</div>
              <div style={{display:"flex",gap:5,flexWrap:"wrap"}}>
                {r.angle && <Chip label={r.angle} c={T.mid} bg={T.warm} b={T.border}/>}
                {r.awareness_stage && <Chip label={r.awareness_stage} c={T.mid} bg={T.warm} b={T.border}/>}
                {r.format && <Chip label={r.format} c={T.blue} bg={T.blueL} b={T.blue}/>}
              </div>
            </div>
            <button onClick={()=>remove(r.id)} style={{fontSize:12,color:T.dim,background:"none",border:"none",cursor:"pointer"}}>✕</button>
          </div>
          <div style={{marginBottom:10}}>
            <div style={{fontSize:10,fontWeight:600,color:T.dim,textTransform:"uppercase",letterSpacing:0.5,marginBottom:6,fontFamily:T.font}}>Status</div>
            <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
              {STATUS.map(s => (
                <button key={s} onClick={()=>update(r.id,"status",s)}
                  style={{background:r.status===s?(sC[s]||T.gold):T.surface,color:r.status===s?"#fff":T.mid,border:"1px solid "+(r.status===s?(sC[s]||T.gold):T.border),borderRadius:5,padding:"5px 10px",cursor:"pointer",fontSize:11,fontFamily:T.font,fontWeight:r.status===s?700:400}}>
                  {s}
                </button>
              ))}
            </div>
          </div>
          <textarea value={r.notes||""} onChange={e=>update(r.id,"notes",e.target.value)} rows={2} placeholder="Notes — what's the data saying? What are you testing next?"
            style={{...taStyle,fontSize:12}}/>
        </div>
      ))}
    </div>
  );
}

// ── BRAND HOME / SWITCHER ─────────────────────────────────────────────────────
function BrandHome({brands, onSelect, onNew, onDelete}) {
  const [newName, setNewName] = useState("");
  return (
    <div style={{minHeight:"100vh",background:T.bg,display:"flex",alignItems:"center",justifyContent:"center",padding:24}}>
      <div style={{maxWidth:520,width:"100%"}}>
        <div style={{textAlign:"center",marginBottom:32}}>
          <div style={{fontSize:10,fontWeight:800,letterSpacing:3,color:T.dim,textTransform:"uppercase",marginBottom:6,fontFamily:T.font}}>The Creative Room</div>
          <div style={{fontSize:24,fontWeight:700,color:T.text,fontFamily:T.font,marginBottom:8}}>Your brands</div>
          <div style={{fontSize:13,color:T.mid,fontFamily:T.font}}>Each brand saves independently. Pick one to continue.</div>
        </div>

        {brands.length > 0 && (
          <div style={{marginBottom:24}}>
            {brands.map(b => (
              <div key={b.id} style={{background:T.surface,border:"1.5px solid "+T.border,borderRadius:8,padding:"14px 18px",marginBottom:8,display:"flex",alignItems:"center",justifyContent:"space-between",gap:12,cursor:"pointer"}}
                onClick={()=>onSelect(b)}>
                <div>
                  <div style={{fontSize:14,fontWeight:600,color:T.text,fontFamily:T.font}}>{b.name}</div>
                  <div style={{fontSize:11,color:T.dim,fontFamily:T.font,marginTop:2}}>Created {b.created}</div>
                </div>
                <div style={{display:"flex",gap:8,alignItems:"center"}}>
                  <span style={{fontSize:11,color:T.mid,fontFamily:T.font}}>Open →</span>
                  <button onClick={e=>{e.stopPropagation();onDelete(b.id);}} style={{fontSize:12,color:T.dim,background:"none",border:"none",cursor:"pointer",padding:"4px"}}>✕</button>
                </div>
              </div>
            ))}
          </div>
        )}

        <div style={{background:T.surface,border:"1.5px solid "+T.border,borderRadius:9,padding:"18px 20px"}}>
          <div style={{fontSize:13,fontWeight:600,color:T.text,fontFamily:T.font,marginBottom:12}}>New brand</div>
          <div style={{display:"flex",gap:8}}>
            <input value={newName} onChange={e=>setNewName(e.target.value)}
              onKeyDown={e=>{if(e.key==="Enter"&&newName.trim())onNew(newName.trim());}}
              placeholder="Brand name..."
              style={{...inputStyle,flex:1,fontSize:13}}/>
            <Btn onClick={()=>{if(newName.trim()){onNew(newName.trim());setNewName("");}}} disabled={!newName.trim()}>Create →</Btn>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── APP ────────────────────────────────────────────────────────────────────────
export default function App() {
  const [brands, setBrands] = useState([]);
  const [activeBrandId, setActiveBrandId] = useState(null);
  const [brand, setBrand] = useState(null);
  const [appMode, setAppMode] = useState("think"); // "think" | "build"
  const [tab, setTab] = useState("think");
  const [prefill, setPrefill] = useState(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    loadBrands().then(async (bs) => {
      setBrands(bs);
      setLoaded(true);
    });
  }, []);

  const selectBrand = async (b) => {
    const data = await loadBrandData(b.id) || {...EMPTY_BRAND, name:b.name};
    setBrand(data);
    setActiveBrandId(b.id);
    setAppMode("think");
    setTab("think");
  };

  const newBrand = async (name) => {
    const id = "b_"+Date.now();
    const nb = {id, name, created:new Date().toLocaleDateString()};
    const newBrands = [...brands, nb];
    setBrands(newBrands);
    await saveBrands(newBrands);
    const data = {...EMPTY_BRAND, name};
    await saveBrandData(id, data);
    setBrand(data);
    setActiveBrandId(id);
    setAppMode("think");
    setTab("think");
  };

  const deleteBrand = async (id) => {
    const updated = brands.filter(b=>b.id!==id);
    setBrands(updated);
    await saveBrands(updated);
  };

  const updateBrand = async (data) => {
    setBrand(data);
    if (activeBrandId) await saveBrandData(activeBrandId, data);
  };

  const goBack = async () => {
    if (brand && activeBrandId) await saveBrandData(activeBrandId, brand);
    const bs = await loadBrands();
    setBrands(bs);
    setBrand(null);
    setActiveBrandId(null);
  };

  const openInHookBuilder = (c) => {
    setPrefill(c);
    setAppMode("build");
    setTab("hooks");
  };

  if (!loaded) return <div style={{minHeight:"100vh",background:T.bg,display:"flex",alignItems:"center",justifyContent:"center",fontFamily:T.font,color:T.dim}}>Loading...</div>;

  if (!brand) return <BrandHome brands={brands} onSelect={selectBrand} onNew={newBrand} onDelete={deleteBrand}/>;

  const THINK_TABS = [
    {id:"think", label:"Think Mode"},
    {id:"inputs", label:"Brand Inputs"},
  ];
  const BUILD_TABS = [
    {id:"tree", label:"The Plan"},
    {id:"hooks", label:"Hook Builder"},
    {id:"dissect", label:"Dissect"},
    {id:"explore", label:"Explore"},
    {id:"briefs", label:"Saved Briefs"},
    {id:"running", label:"What's Running"},
  ];
  const tabs = appMode === "think" ? THINK_TABS : BUILD_TABS;

  return (
    <div style={{background:T.bg,minHeight:"100vh",fontFamily:T.font,color:T.text}}>
      <div style={{background:T.surface,borderBottom:"2px solid "+T.border,padding:"12px 24px",position:"sticky",top:0,zIndex:10}}>
        <div style={{maxWidth:900,margin:"0 auto"}}>
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:12,flexWrap:"wrap",marginBottom:10}}>
            <div style={{display:"flex",alignItems:"center",gap:12}}>
              <button onClick={goBack} style={{fontSize:11,color:T.dim,background:"none",border:"none",cursor:"pointer",fontFamily:T.font,padding:"4px 0"}}>← Brands</button>
              <div>
                <div style={{fontSize:10,letterSpacing:3,color:T.dim,textTransform:"uppercase",fontFamily:T.font}}>Creative Room</div>
                <div style={{fontSize:18,fontWeight:700,color:T.text,fontFamily:T.font}}>{brand.name||"Untitled Brand"}</div>
              </div>
              {brand.primary_principle && <Chip label={brand.primary_principle}/>}
            </div>
            <div style={{display:"flex",gap:8}}>
              <button onClick={()=>{setAppMode("think");setTab("think");}}
                style={{fontSize:11,fontWeight:700,color:appMode==="think"?T.gold:T.mid,background:appMode==="think"?T.goldL:"transparent",border:"1.5px solid "+(appMode==="think"?T.goldB:T.border),borderRadius:20,padding:"6px 14px",cursor:"pointer",fontFamily:T.font}}>
                Think Mode
              </button>
              <button onClick={()=>{setAppMode("build");setTab("tree");}}
                style={{fontSize:11,fontWeight:700,color:appMode==="build"?"#fff":T.mid,background:appMode==="build"?T.text:"transparent",border:"1.5px solid "+(appMode==="build"?T.text:T.border),borderRadius:20,padding:"6px 14px",cursor:"pointer",fontFamily:T.font}}>
                Build Mode
              </button>
            </div>
          </div>
          <div style={{display:"flex",gap:0}}>
            {tabs.map(t => (
              <button key={t.id} onClick={()=>setTab(t.id)}
                style={{fontSize:11,fontWeight:700,letterSpacing:0.5,textTransform:"uppercase",color:tab===t.id?T.gold:T.dim,background:"transparent",border:"none",borderBottom:"3px solid "+(tab===t.id?T.goldB:"transparent"),padding:"6px 16px",cursor:"pointer",fontFamily:T.font}}>
                {t.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div style={{padding:"28px 24px",maxWidth:900,margin:"0 auto"}}>
        {tab==="think" && <ThinkMode brand={brand} onUpdate={updateBrand}/>}
        {tab==="inputs" && <BrandInputsTab brand={brand} onUpdate={updateBrand}/>}
        {tab==="tree" && <TreeTab brand={brand} onUpdate={setBrand} onRunInHookBuilder={openInHookBuilder}/>}
        <div style={{display:tab==="hooks"?"block":"none"}}><HookTab brand={brand} onUpdate={updateBrand} prefill={prefill} clearPrefill={()=>setPrefill(null)} active={tab==="hooks"}/></div>
        {tab==="dissect" && <DissectTab brand={brand} onOpenInHookBuilder={openInHookBuilder}/>}
        {tab==="explore" && <ExploreTab brand={brand} onUpdate={updateBrand} onOpenInHookBuilder={openInHookBuilder}/>}
        {tab==="briefs" && <SavedBriefsTab brand={brand} onUpdate={updateBrand}/>}
        {tab==="running" && <RunningTab brand={brand} onUpdate={updateBrand}/>}
      </div>
    </div>
  );
}
