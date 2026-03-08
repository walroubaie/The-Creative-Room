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
  orange:"#7a3e10", orangeL:"#faf2e8",
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
  const apiKey = import.meta.env.VITE_ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("API key not found. Check VITE_ANTHROPIC_API_KEY in Vercel environment variables.");
  const body = { model:"claude-sonnet-4-20250514", max_tokens:maxTokens, messages };
  if (system) body.system = system;
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method:"POST", headers:{"Content-Type":"application/json","x-api-key":apiKey,"anthropic-version":"2023-06-01","anthropic-dangerous-direct-browser-access":"true"}, body:JSON.stringify(body),
  });
  const d = await res.json();
  if (!res.ok) throw new Error("API error " + res.status + ": " + (d.error?.message || JSON.stringify(d)));
  if (!d.content?.[0]?.text) throw new Error("Empty response from API. Response: " + JSON.stringify(d).slice(0, 200));
  return d.content[0].text.trim();
}
async function callJSON(prompt, maxTokens = 4000) {
  const text = await callClaude([{role:"user",content:prompt}], null, maxTokens);
  // Try to extract JSON from the response robustly
  const clean = text.trim();
  // Strip markdown code fences
  const stripped = clean.replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/\s*```$/i, "").trim();
  // Find the outermost { } or [ ] block in case there's surrounding text
  const objMatch = stripped.match(/\{[\s\S]*\}/);
  const arrMatch = stripped.match(/\[[\s\S]*\]/);
  if (objMatch) return objMatch[0];
  if (arrMatch) return arrMatch[0];
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
      if (file.name.endsWith(".docx") || file.name.endsWith(".doc")) {
        const ab = await file.arrayBuffer();
        const r = await mammoth.extractRawText({ arrayBuffer: ab });
        text = r.value;
      } else if (file.name.endsWith(".pdf")) {
        text = await parsePDF(file);
      } else {
        text = await file.text();
      }
      if (!text?.trim()) throw new Error("Could not extract text from this file.");
      const raw = await callJSON(PARSE_PROMPT+"\n\nDOCUMENT:\n"+text.slice(0,8000), 4000);
      const parsed = JSON.parse(raw);
      onUpdate(additiveMerge(brand, parsed));
    } catch(err) { alert("Upload failed: " + (err.message || "Unknown error")); }
    setParsing(false);
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
      const reply = await callClaude(newMsgs.map(m=>({role:m.role,content:m.content})), getSystem(thinkMode), 1500);
      const final = [...newMsgs, {role:"assistant",content:reply,id:Date.now()+1}];
      setMessages(final); onUpdate({...brand,thinkMessages:final});
    } catch(e) {
      const errMsgs = [...newMsgs, {role:"assistant",content:"Error: "+(e.message||"Connection error — try again."),id:Date.now()+1}];
      setMessages(errMsgs);
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
    } catch(err) { setSavePreview({fields:[], notes:"Error: "+(err.message||"Could not extract insights")}); }
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

  const modeLabel = thinkMode === "challenge" ? "Challenge Mode" : thinkMode === "explore" ? "Explore Mode" : "";

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
              </div>
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
            {messages.map(msg => (
              <div key={msg.id} style={{display:"flex",justifyContent:msg.role==="user"?"flex-end":"flex-start"}}>
                <div style={{
                  maxWidth:"78%",background:msg.role==="user"?T.text:T.surface,
                  color:msg.role==="user"?"#fff":T.text,
                  border:msg.role==="user"?"none":"1.5px solid "+T.border,
                  borderRadius:msg.role==="user"?"10px 10px 2px 10px":"10px 10px 10px 2px",
                  padding:"11px 15px",fontSize:13,lineHeight:1.7,whiteSpace:"pre-wrap",fontFamily:T.font,
                }}>{msg.content}</div>
              </div>
            ))}
            {loading && (
              <div style={{display:"flex",justifyContent:"flex-start"}}>
                <div style={{background:T.surface,border:"1.5px solid "+T.border,borderRadius:10,padding:"11px 15px",fontSize:13,color:T.dim,fontStyle:"italic",fontFamily:T.font}}>Thinking...</div>
              </div>
            )}
            <div ref={bottomRef}/>
          </div>

          {messages.length >= 4 && (
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
      if (file.name.endsWith(".docx") || file.name.endsWith(".doc")) {
        const ab = await file.arrayBuffer();
        const r = await mammoth.extractRawText({ arrayBuffer: ab });
        text = r.value;
      } else if (file.name.endsWith(".pdf")) {
        text = await parsePDF(file);
      } else {
        text = await file.text();
      }
      if (!text?.trim()) throw new Error("Could not extract text from this file.");
      const raw = await callJSON(PARSE_PROMPT+"\n\nDOCUMENT:\n"+text.slice(0,8000), 4000);
      const parsed = JSON.parse(raw);
      onUpdate(additiveMerge(brand, parsed));
      setSetupMode(null);
    } catch(err) { alert("Upload failed: " + (err.message || "Unknown error")); }
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
function TreeTab({brand, onRunInHookBuilder}) {
  const savedBriefs = brand.savedBriefs || [];
  const usedAngles = [...new Set(savedBriefs.map(b=>b.selections?.angle).filter(Boolean))];
  const usedFormats = [...new Set(savedBriefs.map(b=>b.selections?.subtype).filter(Boolean))];
  const usedAwareness = [...new Set(savedBriefs.map(b=>b.selections?.awareness).filter(Boolean))];
  const totalRunning = (brand.runningConcepts||[]).length;
  const unusedAwareness = AWARENESS.filter(a=>!usedAwareness.includes(a));

  if (!brand.name) return <div style={{padding:48,textAlign:"center",color:T.dim,fontSize:13,fontFamily:T.font}}>Fill in Brand Inputs first.</div>;

  const awCols = {
    "Unaware":{c:T.red,bg:T.redL,b:T.red},
    "Problem Aware":{c:T.orange,bg:T.orangeL,b:T.orange},
    "Solution Aware":{c:T.gold,bg:T.goldL,b:T.goldB},
    "Product Aware":{c:T.blue,bg:T.blueL,b:T.blue},
    "Most Aware":{c:T.green,bg:T.greenL,b:T.green},
  };

  const nextMoves = [];
  if (savedBriefs.length === 0) {
    nextMoves.push({label:"Build your first brief",detail:"No briefs yet. Go to Hook Builder and build your first one.",c:T.red});
  } else {
    if (!usedAwareness.includes("Unaware") && !usedAwareness.includes("Problem Aware"))
      nextMoves.push({label:"Build top-of-funnel creative",detail:"No Unaware or Problem Aware briefs. These reach people who don't know you yet — the biggest audience.",c:T.red});
    else if (!usedAwareness.includes("Most Aware") && savedBriefs.length >= 3)
      nextMoves.push({label:"Build a conversion brief",detail:"You have awareness content but nothing closing the sale. Build a Most Aware brief to convert warm audiences.",c:T.green});
    if (usedAngles.length < ANGLES.length * 0.4)
      nextMoves.push({label:"Explore untested angles",detail:(ANGLES.length - usedAngles.length)+" angles never tested. The best-performing angle for your audience is probably one you haven't tried.",c:T.gold});
    if (totalRunning === 0 && savedBriefs.length >= 2)
      nextMoves.push({label:"Put something live",detail:"You have saved briefs but nothing is marked as running. Go to Saved Briefs and mark one as live.",c:T.blue});
  }

  return (
    <div style={{maxWidth:820,margin:"0 auto"}}>
      <div style={{display:"flex",gap:10,marginBottom:20,flexWrap:"wrap"}}>
        {[
          {label:"Briefs built",val:savedBriefs.length,c:T.text},
          {label:"Live now",val:totalRunning,c:T.green},
          {label:"Stages covered",val:usedAwareness.length+"/5",c:T.gold},
          {label:"Angles tried",val:usedAngles.length+"/"+ANGLES.length,c:T.blue},
          {label:"Formats tried",val:usedFormats.length+"/"+Object.values(FORMATS).flat().length,c:T.purple},
        ].map(s => (
          <div key={s.label} style={{background:T.surface,border:"1.5px solid "+T.border,borderRadius:7,padding:"10px 16px",flex:"1 1 100px",textAlign:"center"}}>
            <div style={{fontSize:18,fontWeight:700,color:s.c,fontFamily:T.font}}>{s.val}</div>
            <div style={{fontSize:10,color:T.dim,fontFamily:T.font,marginTop:2,letterSpacing:0.5,textTransform:"uppercase"}}>{s.label}</div>
          </div>
        ))}
      </div>

      {nextMoves.length > 0 && (
        <div style={{marginBottom:20}}>
          <div style={{fontSize:11,fontWeight:700,color:T.text,fontFamily:T.font,letterSpacing:0.5,textTransform:"uppercase",marginBottom:8}}>Recommended Next Moves</div>
          {nextMoves.map((m,i) => (
            <div key={i} style={{background:T.surface,border:"1.5px solid "+T.border,borderLeft:"4px solid "+m.c,borderRadius:7,padding:"11px 14px",marginBottom:7}}>
              <div style={{fontSize:12,fontWeight:600,color:T.text,fontFamily:T.font,marginBottom:2}}>{m.label}</div>
              <div style={{fontSize:11,color:T.mid,fontFamily:T.font,lineHeight:1.5}}>{m.detail}</div>
            </div>
          ))}
        </div>
      )}

      <div style={{fontSize:11,fontWeight:700,color:T.text,fontFamily:T.font,letterSpacing:0.5,textTransform:"uppercase",marginBottom:8}}>Funnel Coverage</div>
      <div style={{display:"flex",gap:6,flexWrap:"wrap",marginBottom:20}}>
        {AWARENESS.map(a => {
          const col = awCols[a];
          const used = usedAwareness.includes(a);
          const briefs = savedBriefs.filter(b=>b.selections?.awareness===a);
          return (
            <div key={a} style={{flex:"1 1 120px",background:used?col.bg:T.surface,border:"1.5px solid "+(used?col.b:T.border),borderRadius:8,padding:"10px 12px",opacity:used?1:0.5}}>
              <div style={{display:"flex",alignItems:"center",gap:5,marginBottom:4}}>
                <div style={{width:7,height:7,borderRadius:"50%",background:used?col.c:T.borderMid,flexShrink:0}}/>
                <div style={{fontSize:10,fontWeight:600,color:used?col.c:T.dim,fontFamily:T.font}}>{a}</div>
              </div>
              <div style={{fontSize:11,fontWeight:700,color:used?col.c:T.dim,fontFamily:T.font}}>{briefs.length} brief{briefs.length!==1?"s":""}</div>
              {used && (
                <div style={{marginTop:5}}>
                  {(AW_ANGLES[a]||[]).map(ang => (
                    <div key={ang} style={{fontSize:9,color:usedAngles.includes(ang)?col.c:T.dim,fontFamily:T.font,marginBottom:1,fontWeight:usedAngles.includes(ang)?600:400}}>
                      {usedAngles.includes(ang)?"✓ ":""}{ang}
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {unusedAwareness.length > 0 && (
        <div style={{background:T.warm,border:"1.5px solid "+T.border,borderRadius:7,padding:"10px 14px",marginBottom:20}}>
          <div style={{fontSize:11,fontWeight:600,color:T.text,fontFamily:T.font,marginBottom:6}}>Untouched funnel stages</div>
          <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
            {unusedAwareness.map(a => <Chip key={a} label={a} c={awCols[a].c} bg={awCols[a].bg} b={awCols[a].b}/>)}
          </div>
        </div>
      )}

      <div style={{fontSize:11,fontWeight:700,color:T.text,fontFamily:T.font,letterSpacing:0.5,textTransform:"uppercase",marginBottom:8}}>Format Coverage</div>
      <div style={{display:"flex",gap:6,flexWrap:"wrap",marginBottom:20}}>
        {Object.values(FORMATS).flat().map(f => {
          const used = usedFormats.includes(f);
          return (
            <div key={f} style={{background:used?T.blueL:T.surface,border:"1px solid "+(used?T.blue:T.border),borderRadius:5,padding:"4px 10px",fontSize:10,fontFamily:T.font,color:used?T.blue:T.dim,fontWeight:used?600:400}}>
              {used?"✓ ":""}{f}
            </div>
          );
        })}
      </div>

      {(brand.concepts||[]).length > 0 && (
        <>
          <div style={{fontSize:11,fontWeight:700,color:T.text,fontFamily:T.font,letterSpacing:0.5,textTransform:"uppercase",marginBottom:8}}>Saved Concepts</div>
          <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
            {brand.concepts.map((c,i) => (
              <div key={i} style={{background:T.warm,border:"1.5px solid "+T.border,borderRadius:8,padding:"10px 14px",minWidth:130}}>
                <div style={{fontSize:11,fontWeight:600,color:T.text,fontFamily:T.font,marginBottom:2}}>{c.name}</div>
                <div style={{fontSize:10,color:T.dim,fontFamily:T.font,marginBottom:6}}>{c.awareness}</div>
                <button onClick={()=>onRunInHookBuilder&&onRunInHookBuilder(c)} style={{background:T.text,color:"#fff",border:"none",borderRadius:4,padding:"5px 10px",cursor:"pointer",fontSize:10,fontFamily:T.font,fontWeight:600}}>Run →</button>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

// ── HOOK BUILDER ──────────────────────────────────────────────────────────────
function HookTab({brand, onUpdate, prefill, clearPrefill}) {
  const STEP_KEYS = ["principle","persona","awareness","angle","trigger","format","subtype","formula"];
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

  const hasBrandData = !!(brand?.name && brand?.organising_idea && brand?.core_persona?.name);

  useEffect(() => {
    if (prefill && Object.keys(prefill).length > 0 && !prefill._nav) {
      const merged = {};
      if (prefill.principle||brand.primary_principle) merged.principle = prefill.principle||brand.primary_principle;
      if (prefill.persona||brand.core_persona?.name) merged.persona = prefill.persona||brand.core_persona?.name;
      if (prefill.awareness) merged.awareness = prefill.awareness;
      if (prefill.angle) merged.angle = prefill.angle;
      if (prefill.trigger) merged.trigger = prefill.trigger;
      if (prefill.format) merged.format = prefill.format;
      if (prefill.subtype) merged.subtype = prefill.subtype;
      setSel(merged);
      let idx = 0;
      for (let i=0;i<STEP_KEYS.length;i++) { if (merged[STEP_KEYS[i]]) idx=i+1; else break; }
      setStep(Math.min(idx, STEP_KEYS.length-1));
      setStage("deciding");
    }
  }, [prefill]);

  const pick = (key,val) => {
    const ns = {...sel,[key]:val};
    setSel(ns);
    const idx = STEP_KEYS.indexOf(key);
    setStep(idx+1 < STEP_KEYS.length ? idx+1 : STEP_KEYS.length);
  };

  const reset = () => {
    setSel({}); setHooks([]); setAllPrevHooks([]); setChosen(null);
    setEditedHook(""); setBrief(null); setStage("deciding"); setStep(0); setCopied(false);
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
  const filteredFormulas = FORMULAS.filter(f => {
    const fit = FORMULA_FIT[f]; if (!fit) return true;
    return (!sel.awareness||fit.awareness.includes(sel.awareness))&&(!sel.trigger||fit.triggers.includes(sel.trigger));
  });
  const formulaOpts = (filteredFormulas.length>0?filteredFormulas:FORMULAS).map(f=>({label:f,sub:FORMULA_DEFS[f]}));

  const STEPS = [
    {key:"principle",title:"Organising Principle",sub:"How does this product get discovered?",opts:[{label:"Pain-First",sub:"Lead with the problem"},{label:"Desire-First",sub:"Lead with the vision"}],c:T.gold,bg:T.goldL,b:T.goldB},
    {key:"persona",title:"Persona",sub:"Who are we talking to?",opts:personas.length?personas:[{label:"Add personas in Brand Inputs"}],c:T.green,bg:T.greenL,b:T.green},
    {key:"awareness",title:"Awareness Stage",sub:"Where is this person in their journey?",opts:AWARENESS.map(a=>({label:a,sub:AWARENESS_DEFS[a]})),c:T.orange,bg:T.orangeL,b:T.orange},
    {key:"angle",title:"Messaging Angle",sub:"What perspective does this ad take?",opts:angles.map(a=>({label:a,sub:ANGLE_DEFS[a]})),c:T.red,bg:T.redL,b:T.red},
    {key:"trigger",title:"Psychology Trigger",sub:"What emotion activates this ad?",opts:TRIGGERS.map(t=>({label:t})),c:T.purple,bg:T.purpleL,b:T.purple},
    {key:"format",title:"Format Type",sub:"Video or Image?",opts:[{label:"VIDEO",sub:"Moving image"},{label:"IMAGE",sub:"Static"}],c:T.blue,bg:T.blueL,b:T.blue},
    {key:"subtype",title:"Format Style",sub:recommendedFormats?"Recommended formats for "+sel.awareness+" shown first":"Specific format",opts:subtypeOpts,c:T.blue,bg:T.blueL,b:T.blue},
    {key:"formula",title:"Hook Formula",sub:filteredFormulas.length<FORMULAS.length?(filteredFormulas.length+" formulas matched to your choices"):"Opening structure",opts:formulaOpts,c:T.purple,bg:T.purpleL,b:T.purple},
  ];

  const done = step >= STEP_KEYS.length;
  const cur = STEPS[step];
  const persona = brand.core_persona?.name===sel.persona?brand.core_persona:brand.secondary_persona;
  const lang = persona?.language || {};

  const buildCtx = () => {
    const principle = sel.principle==="Pain-First"
      ? "PAIN-FIRST: Lead with problem, frustration, failure. Do not open with anything positive."
      : "DESIRE-FIRST: Lead with identity, vision, aspiration. Product is the vehicle.";
    return "BRAND: "+brand.name+"\nOrganising Idea: "+(brand.organising_idea||"")+"\nStrategic Tension: "+(brand.strategic_tension||"")+"\nWhite Space: "+(brand.white_space||"")+"\n\nPERSONA: "+sel.persona+"\nDescription: "+(persona?.desc||"")+"\nDesire: "+(persona?.desire||"")+"\nPain: "+(persona?.pain||"")+"\n\nPRINCIPLE: "+principle+"\n\nAWARENESS: "+sel.awareness+" — "+(AWARENESS_RULES[sel.awareness]||"")+"\n\nANGLE: "+sel.angle+" — "+(ANGLE_DEFS[sel.angle]||"")+"\n\nTRIGGER: "+sel.trigger+"\n\nFORMAT: "+sel.format+" — "+sel.subtype+" ("+(FORMAT_DEFS[sel.subtype]||"")+")\n\nFORMULA: "+sel.formula+"\nStructure: "+(FORMULA_STRUCTURES[sel.formula]||FORMULA_DEFS[sel.formula]||"")+"\n\nLANGUAGE BANK — use at least one phrase VERBATIM, never paraphrased:\nTRIGGER: "+((lang.trigger||[]).join(" | ")||"none")+"\nPAIN: "+((lang.pain||[]).join(" | ")||"none")+"\nDESIRE: "+((lang.desire||[]).join(" | ")||"none")+"\nOBJECTION: "+((lang.objection||[]).join(" | ")||"none")+"\n\nPROOF POINTS: "+((brand.proof_points||[]).filter(Boolean).join(" | ")||"none");
  };

  const generateHooks = async () => {
    const prev = [...allPrevHooks,...hooks.map(h=>h.hook_text)].filter(Boolean);
    setLoading(true); setHooks([]); setChosen(null); setEditedHook(""); setStage("hooks");
    const avoidBlock = prev.length>0 ? "\n\nDo NOT repeat or closely resemble these previous hooks:\n"+prev.map((h,i)=>(i+1)+". \""+h+"\"").join("\n") : "";
    const prompt = "You are a senior direct response creative strategist. Generate hooks that sound like real customers talking to a friend — never like a brand writing ads.\n\n"+buildCtx()+avoidBlock+"\n\nTASK: Generate exactly 4 hooks. Each MUST:\n1. Follow the "+sel.formula+" formula structure precisely\n2. Use at least one EXACT phrase from the language bank — word for word\n3. Respect the "+sel.awareness+" awareness rule — especially what must NOT appear\n4. Activate the "+sel.trigger+" emotion as the entry point\n5. Sound like a real person, never a brand\n6. Be distinctly different from each other\n7. HOOK TEXT must be under 10 words. Hard limit. This is the opening LINE only.\n\nFor hook_visual: specific, concrete — who, where, what you see.\nFor hook_audio: tone, pacing, ambient sound. N/A for static image.\n\nReturn ONLY raw JSON array, no markdown:\n[{\"hook_text\":\"\",\"hook_visual\":\"\",\"hook_audio\":\"\"},{\"hook_text\":\"\",\"hook_visual\":\"\",\"hook_audio\":\"\"},{\"hook_text\":\"\",\"hook_visual\":\"\",\"hook_audio\":\"\"},{\"hook_text\":\"\",\"hook_visual\":\"\",\"hook_audio\":\"\"}]";
    try {
      const raw = await callJSON(prompt, 2000);
      console.log("Hook raw response:", raw);
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) throw new Error("Response was not an array: " + raw.slice(0,200));
      if (parsed.length === 0) throw new Error("API returned empty array");
      setHooks(parsed);
      setAllPrevHooks(p=>[...p,...parsed.map(h=>h.hook_text)]);
    } catch(err) {
      console.error("Hook generation error:", err);
      setHooks([{hook_text:"Error: " + (err.message||"Unknown error"), hook_visual:"Check browser console (F12) for details.", hook_audio:""}]);
    }
    setLoading(false);
  };

  const generateBrief = async () => {
    const hookToUse = editedHook||hooks[chosen]?.hook_text||"";
    setLoading(true); setBrief(null); setStage("brief");
    const ctx = buildCtx();
    const base = "You are a senior direct response creative strategist. Hyper-specific only — no vague direction.\n\n"+ctx+"\n\nHOOK: \""+hookToUse+"\"";

    // Run two smaller calls in parallel — cuts wait time roughly in half
    const [partA, partB] = await Promise.all([
      callJSON(base+"\n\nReturn ONLY raw JSON, no markdown:\n{\"aha\":\"\",\"gut\":\"\",\"brain_a\":\"\",\"brain_b\":\"\",\"pocket\":\"\",\"overview\":\"\",\"hook_variations\":[\"\",\"\",\"\"],\"casting\":\"\",\"filming\":\"\",\"campaign_card\":{\"concept_name\":\"\",\"angle\":\""+sel.angle+"\",\"awareness_stage\":\""+sel.awareness+"\",\"persona\":\""+sel.persona+"\",\"format\":\""+sel.subtype+"\",\"hypothesis\":\"\",\"success_metric\":\"\"}}", 1400),
      callJSON(base+"\n\nReturn ONLY raw JSON, no markdown:\n{\"shot_list\":[\"\",\"\",\"\",\"\",\"\",\"\"],\"dos\":[\"\",\"\",\"\",\"\"],\"donts\":[\"\",\"\",\"\",\"\"],\"caption_instructions\":[{\"voiceover\":\"\",\"on_screen_text\":\"\",\"suggested_visual\":\"\"},{\"voiceover\":\"\",\"on_screen_text\":\"\",\"suggested_visual\":\"\"},{\"voiceover\":\"\",\"on_screen_text\":\"\",\"suggested_visual\":\"\"}],\"variations\":[\"\",\"\",\"\"]}", 1200),
    ]).catch(() => [null, null]);

    try {
      const a = JSON.parse(partA);
      const b = JSON.parse(partB);
      setBrief({...a,...b,hook_text:hookToUse,hook_visual:hooks[chosen]?.hook_visual||"",hook_audio:hooks[chosen]?.hook_audio||""});
    } catch(err) { setBrief({error:true, message: err.message}); }
    setLoading(false);
  };

  const saveBrief = () => {
    if (!brief||brief.error) return;
    const h = {...brief,selections:sel,brand:brand.name,date:new Date().toLocaleDateString(),id:Date.now()};
    onUpdate({...brand,savedBriefs:[...(brand.savedBriefs||[]),h]});
  };
  const alreadySaved = brief&&!brief.error&&(brand.savedBriefs||[]).some(b=>b.hook_text===brief.hook_text);

  const copyBrief = () => {
    if (!brief) return;
    const h = brief;
    const text = ["HOOK: "+h.hook_text,"VISUAL: "+(h.hook_visual||""),"AUDIO: "+(h.hook_audio||""),"","AHA: "+(h.aha||""),"","GUT (0-3s): "+(h.gut||""),"BRAIN A (3-8s): "+(h.brain_a||""),"BRAIN B (8-15s): "+(h.brain_b||""),"POCKET: "+(h.pocket||""),"","OVERVIEW: "+(h.overview||""),"","DOS:",...(h.dos||[]),"","DONTS:",...(h.donts||[]),"","SHOT LIST:",...(h.shot_list||[]),"","CASTING: "+(h.casting||""),"","FILMING: "+(h.filming||"")].join("\n");
    navigator.clipboard.writeText(text).then(()=>{setCopied(true);setTimeout(()=>setCopied(false),2000);});
  };

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
      {Object.keys(sel).length>0 && (
        <div style={{background:T.warm,border:"1.5px solid "+T.border,borderRadius:7,padding:"10px 14px",marginBottom:16}}>
          <div style={{fontSize:10,fontWeight:600,letterSpacing:1.2,color:T.dim,textTransform:"uppercase",marginBottom:6,fontFamily:T.font}}>Your Path</div>
          <div style={{display:"flex",flexWrap:"wrap",gap:5,alignItems:"center"}}>
            {STEPS.filter(s=>sel[s.key]).map((s,i,arr) => (
              <span key={s.key} style={{display:"flex",alignItems:"center",gap:5}}>
                <Chip label={sel[s.key]} c={s.c} bg={s.bg} b={s.b}/>
                {i<arr.length-1 && <span style={{color:T.borderMid,fontSize:11}}>›</span>}
              </span>
            ))}
          </div>
          <button onClick={reset} style={{marginTop:8,fontSize:11,color:T.dim,background:"none",border:"none",cursor:"pointer",textDecoration:"underline",fontFamily:T.font}}>Start over</button>
        </div>
      )}

      {stage==="deciding" && !done && cur && (
        <div style={{background:T.surface,border:"1.5px solid "+T.border,borderTop:"3px solid "+cur.c,borderRadius:8,padding:"18px 20px"}}>
          <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:4}}>
            <div style={{width:22,height:22,borderRadius:"50%",background:cur.c,display:"flex",alignItems:"center",justifyContent:"center",fontSize:11,fontWeight:700,color:"#fff",flexShrink:0,fontFamily:T.font}}>{step+1}</div>
            <div style={{fontSize:14,fontWeight:600,color:T.text,fontFamily:T.font}}>{cur.title}</div>
          </div>
          <div style={{fontSize:12,color:T.dim,marginBottom:14,paddingLeft:32,fontFamily:T.font}}>{cur.sub}</div>
          {cur.key==="formula" && filteredFormulas.length<FORMULAS.length && (
            <div style={{background:T.purpleL,border:"1px solid "+T.purple+"20",borderRadius:5,padding:"8px 12px",marginBottom:10,fontSize:11,color:T.purple,fontFamily:T.font}}>
              {filteredFormulas.length} of {FORMULAS.length} formulas shown — filtered for {sel.awareness} + {sel.trigger}.
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

      {stage==="deciding" && done && (
        <div style={{background:T.goldL,border:"1.5px solid "+T.goldB,borderRadius:8,padding:"20px 22px",textAlign:"center"}}>
          <div style={{fontSize:14,fontWeight:600,color:T.text,fontFamily:T.font,marginBottom:6}}>All 8 decisions made.</div>
          <div style={{fontSize:12,color:T.mid,fontFamily:T.font,marginBottom:16,lineHeight:1.6}}>AI will generate 4 hooks using your exact customer language.</div>
          <Btn onClick={generateHooks} disabled={loading}>{loading?"Generating...":"Generate Hooks →"}</Btn>
        </div>
      )}

      {stage==="hooks" && (
        <div>
          {loading && <div style={{background:T.surface,border:"1.5px solid "+T.border,borderRadius:7,padding:"16px",textAlign:"center",fontSize:13,color:T.dim,fontFamily:T.font}}>Generating hooks using your language bank...</div>}
          {!loading && hooks.length>0 && (
            <>
              <div style={{fontSize:14,fontWeight:600,color:T.text,fontFamily:T.font,marginBottom:4}}>Pick your hook</div>
              <div style={{fontSize:12,color:T.dim,fontFamily:T.font,marginBottom:14}}>Click the one closest to what you want. Edit if needed, then generate the full brief.</div>
              {hooks.map((h,i) => (
                <div key={i} onClick={()=>{setChosen(i);setEditedHook(h.hook_text);}}
                  style={{background:chosen===i?T.goldL:T.surface,border:"1.5px solid "+(chosen===i?T.goldB:T.border),borderRadius:8,padding:"14px 16px",marginBottom:10,cursor:"pointer"}}>
                  <div style={{display:"flex",gap:10}}>
                    <div style={{width:22,height:22,borderRadius:"50%",background:chosen===i?T.goldB:T.border,display:"flex",alignItems:"center",justifyContent:"center",fontSize:11,fontWeight:700,color:"#fff",flexShrink:0,fontFamily:T.font}}>{i+1}</div>
                    <div style={{flex:1}}>
                      <div style={{fontSize:13,fontWeight:600,color:T.text,lineHeight:1.6,fontFamily:T.font,marginBottom:4}}>{h.hook_text}</div>
                      {h.hook_visual && <div style={{fontSize:11,color:T.mid,fontFamily:T.font,marginBottom:2}}><b style={{color:T.gold}}>Visual:</b> {h.hook_visual}</div>}
                      {h.hook_audio && h.hook_audio!=="N/A" && <div style={{fontSize:11,color:T.mid,fontFamily:T.font}}><b style={{color:T.gold}}>Audio:</b> {h.hook_audio}</div>}
                    </div>
                  </div>
                  {chosen===i && (
                    <div style={{marginTop:12,paddingTop:10,borderTop:"1px solid "+T.goldB+"40"}}>
                      <div style={{fontSize:11,color:T.gold,fontWeight:600,marginBottom:6,fontFamily:T.font}}>Edit hook text if needed:</div>
                      <textarea value={editedHook} onChange={e=>setEditedHook(e.target.value)} rows={2}
                        style={{...taStyle,border:"1.5px solid "+T.goldB}}/>
                    </div>
                  )}
                </div>
              ))}
              <div style={{display:"flex",gap:8,marginTop:8}}>
                <Btn onClick={generateBrief} disabled={chosen===null||loading} style={{flex:1}}>{loading?"Generating brief...":"Generate Full Brief →"}</Btn>
                <Btn onClick={generateHooks} disabled={loading} variant="secondary">More Hooks</Btn>
              </div>
            </>
          )}
        </div>
      )}

      {stage==="brief" && (
        <div>
          {loading && <div style={{background:T.surface,border:"1.5px solid "+T.border,borderRadius:7,padding:"16px",textAlign:"center",fontSize:13,color:T.dim,fontFamily:T.font}}>Generating brief...</div>}
          {!loading && brief && brief.error && (
            <div style={{background:"#fdf0f0",border:"1.5px solid #e0b0ae",borderRadius:7,padding:"14px 16px",fontSize:13,color:"#78201e",fontFamily:T.font}}>
              Brief generation failed: {brief.message || "Unknown error. Check your API key in Vercel settings."}
            </div>
          )}
          {!loading && brief && !brief.error && (
            <div style={{background:T.surface,border:"2px solid "+T.goldB,borderRadius:10,overflow:"hidden"}}>
              <div style={{background:T.goldL,padding:"12px 18px",borderBottom:"1px solid "+T.goldB+"50",display:"flex",alignItems:"center",justifyContent:"space-between",flexWrap:"wrap",gap:8}}>
                <div style={{fontSize:14,fontWeight:700,color:T.gold,fontFamily:T.font}}>Creator Brief</div>
                <div style={{display:"flex",gap:8}}>
                  {!alreadySaved && <Btn onClick={saveBrief} variant="secondary" style={{fontSize:11,padding:"6px 12px"}}>Save Brief</Btn>}
                  {alreadySaved && <span style={{fontSize:11,color:T.green,fontWeight:700,fontFamily:T.font}}>✓ Saved</span>}
                  <Btn onClick={copyBrief} variant="secondary" style={{fontSize:11,padding:"6px 12px"}}>{copied?"✓ Copied":"Copy Text"}</Btn>
                </div>
              </div>
              <div style={{padding:"18px 22px"}}>
                {[
                  {label:"Hook Text", key:"hook_text", c:T.gold},
                  {label:"Visual Direction", key:"hook_visual", c:T.gold},
                  {label:"Aha Moment", key:"aha", c:T.purple},
                  {label:"GUT (0-3s)", key:"gut", c:T.orange},
                  {label:"BRAIN A (3-8s)", key:"brain_a", c:T.blue},
                  {label:"BRAIN B (8-15s)", key:"brain_b", c:T.blue},
                  {label:"POCKET / CTA", key:"pocket", c:T.green},
                  {label:"Brief Overview", key:"overview", c:T.mid},
                  {label:"Casting Direction", key:"casting", c:T.orange},
                  {label:"Filming Spec", key:"filming", c:T.dim},
                ].map(({label,key,c}) => (
                  <div key={key} style={{marginBottom:12}}>
                    <div style={{fontSize:10,fontWeight:700,letterSpacing:1,color:c,textTransform:"uppercase",fontFamily:T.font,marginBottom:4}}>{label}</div>
                    <textarea value={brief[key]||""} onChange={e=>setBrief(p=>({...p,[key]:e.target.value}))} rows={2}
                      style={{...taStyle,borderColor:c+"30"}}/>
                  </div>
                ))}
                {[
                  {label:"Hook Variations", key:"hook_variations", c:T.gold},
                  {label:"Shot List", key:"shot_list", c:T.blue},
                  {label:"Dos", key:"dos", c:T.green},
                  {label:"Don'ts", key:"donts", c:T.red},
                  {label:"Variations to Test", key:"variations", c:T.purple},
                ].map(({label,key,c}) => (
                  <div key={key} style={{marginBottom:12}}>
                    <div style={{fontSize:10,fontWeight:700,letterSpacing:1,color:c,textTransform:"uppercase",fontFamily:T.font,marginBottom:4}}>{label}</div>
                    {(brief[key]||[]).map((item,i) => (
                      <div key={i} style={{display:"flex",gap:6,marginBottom:4,alignItems:"center"}}>
                        <span style={{fontSize:11,color:c,fontFamily:T.font,flexShrink:0}}>{i+1}.</span>
                        <input value={item} onChange={e=>{const arr=[...(brief[key]||[])];arr[i]=e.target.value;setBrief(p=>({...p,[key]:arr}));}}
                          style={{...inputStyle,fontSize:12}}/>
                      </div>
                    ))}
                  </div>
                ))}
                <div style={{display:"flex",gap:8,marginTop:16}}>
                  <button onClick={()=>{setStage("hooks");setBrief(null);}} style={{flex:1,background:T.warm,color:T.mid,border:"1.5px solid "+T.border,borderRadius:7,padding:10,fontSize:12,fontWeight:700,cursor:"pointer",fontFamily:T.font}}>Back to Hooks</button>
                  <button onClick={reset} style={{flex:1,background:T.warm,color:T.mid,border:"1.5px solid "+T.border,borderRadius:7,padding:10,fontSize:12,fontWeight:700,cursor:"pointer",fontFamily:T.font}}>Start Over</button>
                </div>
              </div>
            </div>
          )}
          {brief?.error && <div style={{background:T.redL,color:T.red,padding:"12px 16px",borderRadius:7,fontSize:13,fontFamily:T.font}}>Could not generate brief. <button onClick={generateBrief} style={{background:"none",border:"none",color:T.red,cursor:"pointer",textDecoration:"underline",fontFamily:T.font}}>Try again</button></div>}
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
        [{role:"user",content:"Brand: "+brand.name+"\nOrganising Idea: "+(brand.organising_idea||"")+"\nCore Persona: "+(brand.core_persona?.name||"")+" — "+(brand.core_persona?.desc||"")+"\nPain: "+(brand.core_persona?.pain||"")+"\nDesire: "+(brand.core_persona?.desire||"")+"\nProof Points: "+((brand.proof_points||[]).join(", "))+"\n\nIn 2-3 sentences, explain specifically why the \""+angle+"\" angle ("+ANGLE_DEFS[angle]+") could work for this brand. Be concrete, not generic. Then suggest the best awareness stage and one hook formula to use with it.\n\nReturn as plain text, no markdown."}],
        null, 400
      );
      setAngleInsight(p=>({...p,[angle]:insight}));
    } catch(err) { setAngleInsight(p=>({...p,[angle]:"Error: "+(err.message||"Could not generate")})); }
  };

  const generatePersonaSuggestions = async () => {
    setLoadingPersonas(true);
    const prompt = "Brand: "+brand.name+"\nProduct/Service: "+(brand.organising_idea||"")+"\nCurrent Core Persona: "+(brand.core_persona?.name||"")+" — "+(brand.core_persona?.desc||"")+"\nCurrent Secondary Persona: "+(brand.secondary_persona?.name||"none")+"\nProof Points: "+((brand.proof_points||[]).join(", "))+"\n\nBased on the Loop Earplugs micro-targeting model (one product many identity-based tribes), suggest 4 additional personas this brand hasn't targeted yet. Each should be an identity-based tribe, not just demographics.\n\nReturn ONLY raw JSON, no markdown:\n[{\"name\":\"persona name\",\"identity\":\"who they are in one sentence\",\"trigger\":\"the moment they'd reach for this product\",\"best_angle\":\"which angle from: "+ANGLES.join(", ")+"\",\"awareness_stage\":\"which of: Unaware/Problem Aware/Solution Aware/Product Aware/Most Aware\",\"why\":\"one sentence why this persona is a real opportunity\"}]";
    try {
      const raw = await callJSON(prompt, 1200);
      setPersonaSuggestions(JSON.parse(raw));
    } catch(err) { setPersonaSuggestions([{name:"Error",identity:"Error: "+(err.message||"Could not generate"),trigger:"",best_angle:"",awareness_stage:"",why:""}]); }
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
        <div style={{fontSize:12,color:T.mid,lineHeight:1.6,fontFamily:T.font}}>See what creative territory you haven't covered yet. Click any angle to get a specific AI case for why your brand should test it — then take it straight into Hook Builder.</div>
      </div>

      {/* Angle Gaps */}
      <div style={{marginBottom:28}}>
        <div style={{fontSize:14,fontWeight:700,color:T.text,marginBottom:4,paddingBottom:8,borderBottom:"2px solid "+T.border,fontFamily:T.font}}>
          Angle Gaps <span style={{fontSize:11,fontWeight:400,color:T.dim}}>— {unusedAngles.length} unused of {ANGLES.length}</span>
        </div>
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
                  ? <>
                      <div style={{fontSize:12,color:T.mid,lineHeight:1.7,marginBottom:10,fontFamily:T.font}}>{angleInsight[a]}</div>
                      <Btn onClick={()=>onOpenInHookBuilder&&onOpenInHookBuilder({angle:a})} variant="secondary" style={{fontSize:11}}>Open in Hook Builder →</Btn>
                    </>
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
        <div style={{fontSize:12,color:T.mid,marginBottom:14,lineHeight:1.6,fontFamily:T.font}}>Based on your brand, the AI suggests identity-based tribes you haven't targeted yet. Each is a real audience with a specific trigger — not just demographics.</div>
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

function SavedBriefsTab({brand, onUpdate}) {
  const [selected, setSelected] = useState(null);
  const [outputType, setOutputType] = useState(null);
  const briefs = brand.savedBriefs || [];

  const removeBrief = (id) => {
    const updated = briefs.filter((b,i)=>b.id?b.id!==id:i!==id);
    onUpdate({...brand,savedBriefs:updated});
    if (selected?.id===id) { setSelected(null); setOutputType(null); }
  };

  const markLive = (b) => {
    const item = {...(b.campaign_card||{}),id:b.id,hook_text:b.hook_text,date_launched:new Date().toLocaleDateString(),status:"Testing",notes:""};
    onUpdate({...brand,runningConcepts:[...(brand.runningConcepts||[]),item]});
  };
  const isLive = (b) => (brand.runningConcepts||[]).some(r=>r.id===b.id);

  if (briefs.length===0) return <div style={{padding:48,textAlign:"center",color:T.dim,fontSize:13,fontFamily:T.font}}>No saved briefs yet. Build one in Hook Builder, then save it.</div>;

  return (
    <div style={{maxWidth:680,margin:"0 auto"}}>
      <div style={{fontSize:11,fontWeight:700,color:T.text,marginBottom:12,paddingBottom:8,borderBottom:"1.5px solid "+T.border,fontFamily:T.font,letterSpacing:0.5,textTransform:"uppercase"}}>
        Saved Briefs ({briefs.length})
      </div>

      {briefs.map((b,i) => (
        <div key={b.id||i} onClick={()=>{setSelected(b);setOutputType(null);}}
          style={{background:selected?.id===b.id?T.goldL:T.surface,border:"1.5px solid "+(selected?.id===b.id?T.goldB:T.border),borderRadius:7,padding:"12px 14px",marginBottom:7,cursor:"pointer"}}>
          <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",gap:10}}>
            <div style={{flex:1,minWidth:0}}>
              <div style={{fontSize:12,fontWeight:600,color:T.text,fontFamily:T.font,marginBottom:5,lineHeight:1.5}}>"{b.hook_text}"</div>
              <div style={{display:"flex",gap:5,flexWrap:"wrap",alignItems:"center"}}>
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
          <div style={{fontSize:13,fontWeight:600,color:T.text,fontFamily:T.font,marginBottom:4}}>Output</div>
          <div style={{fontSize:11,color:T.dim,fontFamily:T.font,marginBottom:14}}>"{selected.hook_text}"</div>
          <div style={{display:"flex",gap:8,flexWrap:"wrap",marginBottom:14}}>
            {[
              {t:"creator",l:"Creator Brief",d:"For the person filming.",c:T.gold},
              {t:"editor",l:"Editor Brief",d:"For the person cutting.",c:T.purple},
              {t:"campaign",l:"Campaign Card",d:"For the media buyer.",c:T.blue},
            ].map(opt => (
              <button key={opt.t} onClick={()=>setOutputType(outputType===opt.t?null:opt.t)}
                style={{flex:"1 1 130px",background:outputType===opt.t?opt.c:T.surface,border:"1.5px solid "+(outputType===opt.t?opt.c:T.border),borderRadius:7,padding:"10px 12px",cursor:"pointer",textAlign:"left"}}>
                <div style={{fontSize:11,fontWeight:600,color:outputType===opt.t?"#fff":T.text,fontFamily:T.font,marginBottom:2}}>{opt.l}</div>
                <div style={{fontSize:10,color:outputType===opt.t?"rgba(255,255,255,0.75)":T.dim,fontFamily:T.font}}>{opt.d}</div>
              </button>
            ))}
          </div>
          {outputType && <BriefOutput brief={selected} type={outputType}/>}
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
    {id:"tree", label:"Coverage Map"},
    {id:"hooks", label:"Hook Builder"},
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
        {tab==="tree" && <TreeTab brand={brand} onRunInHookBuilder={openInHookBuilder}/>}
        {tab==="hooks" && <HookTab brand={brand} onUpdate={updateBrand} prefill={prefill} clearPrefill={()=>setPrefill(null)}/>}
        {tab==="explore" && <ExploreTab brand={brand} onUpdate={updateBrand} onOpenInHookBuilder={openInHookBuilder}/>}
        {tab==="briefs" && <SavedBriefsTab brand={brand} onUpdate={updateBrand}/>}
        {tab==="running" && <RunningTab brand={brand} onUpdate={updateBrand}/>}
      </div>
    </div>
  );
}
