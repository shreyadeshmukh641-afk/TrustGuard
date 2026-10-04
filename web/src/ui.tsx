import { useEffect, useMemo, useState } from 'react'
import { AlertCircle, ArrowDownRight, ArrowRight, ArrowUpRight, Check, CheckCircle2, ChevronDown, CircleHelp, Clock3, Copy, ExternalLink, Fingerprint, Globe2, History, Link2, LockKeyhole, Menu, Moon, ScanLine, Send, Shield, ShieldAlert, ShieldCheck, Sparkles, Sun, TriangleAlert, X } from 'lucide-react'
import { Cell, Pie, PieChart, ResponsiveContainer } from 'recharts'

type Result = { fraud_score: number; classification: 'fraud'|'legitimate'|'uncertain'; risk_factors: {label:string;severity:string}[]; highlights: {text:string;reason:string}[]; explanation:string; recommended_actions:string[]; model:string; latency_ms:number; ai_status?:'online'|'fallback' }
type Entry = { message:string; result:Result; time:number }
const samples = [
  { title:'Fake KYC', tag:'High risk', icon:Fingerprint, text:'URGENT: Your bank account will be blocked today. Complete KYC verification immediately and share the OTP we send to keep your account active.' },
  { title:'Lottery win', tag:'High risk', icon:Sparkles, text:'Congratulations! Your number won ₹25,00,000 in our international lottery. Claim your prize now at bit.ly/winner-reward. A small processing fee is required.' },
  { title:'Courier fee', tag:'Watch for', icon:Send, text:'Delivery alert: your parcel is on hold because of an unpaid customs fee. Pay ₹35 immediately to reschedule: https://bit.ly/parcel-in' },
  { title:'Real bank OTP', tag:'Looks safe', icon:ShieldCheck, text:'Your one-time password is 482901 for a purchase of ₹240. Do not share this OTP with anyone. If you did not make this request, call the number on your card.' },
  { title:'Job offer', tag:'High risk', icon:CircleHelp, text:'Congratulations, you are selected for a work-from-home job earning ₹8,000 every day. Pay a refundable ₹999 registration fee to reserve your spot today.' },
]
const color = (v:string) => v==='fraud'?'var(--red)':v==='uncertain'?'var(--amber)':'var(--green)'
const label = (v:string) => v==='fraud'?'Likely scam':v==='uncertain'?'Needs a closer look':'Looks safe'
function MessageEvidence({message,highlights}:{message:string;highlights:Result['highlights']}) {
  if(!highlights.length) return null
  const sorted=[...highlights].filter(h=>h.text&&message.toLocaleLowerCase().includes(h.text.toLocaleLowerCase())).sort((a,b)=>b.text.length-a.text.length)
  if(!sorted.length) return null
  const pieces:React.ReactNode[]=[];let cursor=0;let index=0
  while(cursor<message.length){let found:{at:number;highlight:Result['highlights'][number]}|undefined
    for(const highlight of sorted){const at=message.toLocaleLowerCase().indexOf(highlight.text.toLocaleLowerCase(),cursor);if(at>=0&&(!found||at<found.at||(at===found.at&&highlight.text.length>found.highlight.text.length)))found={at,highlight}}
    if(!found){pieces.push(<span key={index++}>{message.slice(cursor)}</span>);break}
    if(found.at>cursor)pieces.push(<span key={index++}>{message.slice(cursor,found.at)}</span>)
    const phrase=message.slice(found.at,found.at+found.highlight.text.length);pieces.push(<mark key={index++} title={found.highlight.reason}>{phrase}</mark>);cursor=found.at+phrase.length
  }
  return <div className="source-message"><div className="source-label"><span className="block-marker marker-red"/>MESSAGE WITH SIGNALS</div><p>{pieces}</p><div className="source-hint"><span/> Hover a highlighted phrase to see why</div></div>
}

export default function App() {
  const [message,setMessage] = useState('')
  const [result,setResult] = useState<Result|null>(null)
  const [history,setHistory] = useState<Entry[]>(()=>{ try { return JSON.parse(localStorage.getItem('tg-history')||'[]') } catch { return [] } })
  const [busy,setBusy] = useState(false)
  const [error,setError] = useState('')
  const [theme,setTheme] = useState(()=>localStorage.getItem('tg-theme')||'dark')
  const [copied,setCopied] = useState(false)
  const [activeSample,setActiveSample] = useState(-1)
  const [showHistory,setShowHistory] = useState(false)
  useEffect(()=>{document.documentElement.dataset.theme=theme;localStorage.setItem('tg-theme',theme)},[theme])
  const analyze = async () => {
    if (!message.trim()) { setError('Paste a message first, and we’ll take a look.'); return }
    if (message.length>2000) { setError('This message is over the 2,000 character limit.'); return }
    setBusy(true); setError(''); setResult(null)
    try {
      const response = await fetch('/api/analyze-message',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({message})})
      if (!response.ok) { const body=await response.json().catch(()=>null); throw new Error(body?.detail || 'Could not analyze this message.') }
      const data:Result=await response.json(); setResult(data)
      const entry={message,result:data,time:Date.now()}; const next=[entry,...history].slice(0,8); setHistory(next); localStorage.setItem('tg-history',JSON.stringify(next))
    } catch(e) { setError(e instanceof Error?e.message:'Could not reach the TrustGuard API. Start the local server and try again.') }
    finally { setBusy(false) }
  }
  const copy = async () => { if(!result)return; await navigator.clipboard.writeText(`TrustGuard: ${label(result.classification)} (${result.fraud_score}/100)\n${result.explanation}`);setCopied(true);setTimeout(()=>setCopied(false),1500) }
  const chartData=useMemo(()=>result?[{value:result.fraud_score},{value:100-result.fraud_score}]:[{value:8},{value:92}],[result])
  const setSample=(i:number)=>{setActiveSample(i);setMessage(samples[i].text);setResult(null);setError('')}
  const selectedColor=result?color(result.classification):'var(--lime)'
  return <div className="app-shell">
    <header className="topbar"><a className="brand" href="#top" aria-label="TrustGuard home"><span className="brand-mark"><Shield size={18}/><span/></span><span>trustguard<span className="brand-dot">.</span></span><span className="brand-beta">BETA</span></a>
      <nav className="nav-links"><a href="#how">How it works</a><a href="#privacy">Privacy</a></nav><div className="nav-actions"><span className="local-pill"><span className="live-dot"/> Local-first</span><button className="icon-btn theme-btn" onClick={()=>setTheme(theme==='dark'?'light':'dark')} aria-label="Toggle color theme">{theme==='dark'?<Sun size={17}/>:<Moon size={17}/>}</button><button className="mobile-menu" onClick={()=>setShowHistory(!showHistory)} aria-label="Open recent scans"><Menu size={18}/></button></div>
    </header>
    <main id="top" className="layout">
      <section className="main-column">
        <div className="hero-copy"><div className="eyebrow"><span className="eyebrow-dash"/>YOUR SECOND OPINION, ON EVERY MESSAGE</div><h1>Pause before<br/>you <span className="headline-accent">tap.</span></h1><p className="hero-sub">That strange text doesn’t have to be a guessing game.<br className="desktop-break"/> Drop it here. Get a clearer picture in seconds.</p>
          <div className="hero-proof"><span><LockKeyhole size={13}/> Private by design</span><i/><span><ScanLine size={13}/> Instant analysis</span><i/><span><Globe2 size={13}/> Works offline*</span></div>
        </div>
        <section className="composer card" aria-label="Message analyzer"><div className="composer-head"><div className="section-index">01</div><div><div className="composer-title">Paste the message</div><div className="composer-caption">SMS, WhatsApp, email — we can read the red flags.</div></div><span className="input-tag"><LockKeyhole size={12}/> PRIVATE</span></div>
          <div className="textarea-wrap"><textarea aria-label="Suspicious message to analyze" maxLength={2200} value={message} onChange={e=>{setMessage(e.target.value);setActiveSample(-1);setError('')}} onKeyDown={e=>{if((e.ctrlKey||e.metaKey)&&e.key==='Enter')analyze()}} placeholder={'Paste a suspicious text message here…\n\n“Your account is locked. Verify your details now…”'} /><div className="textarea-bottom"><span className={message.length>2000?'count-danger':''}>{message.length.toLocaleString()} <span>/ 2,000</span></span><span><kbd>⌘</kbd><kbd>↵</kbd> to analyze</span></div></div>
          {error&&<div className="error-line" role="alert"><AlertCircle size={15}/>{error}</div>}
          <button className="analyze-btn" onClick={analyze} disabled={busy||!message.trim()||message.length>2000}>{busy?<><span className="spinner"/> {['Checking links…','Reading the context…','Scoring risk…'][Math.floor(Date.now()/850)%3]}</>:<>Check this message <ArrowRight size={17}/><span className="button-shine"/></>}</button>
          <div className="composer-foot"><span><span className="spark-mini">✳</span> Never stored on our servers</span><span>Usually takes &lt; 3 sec</span></div>
        </section>
        <section className="samples" aria-label="Try sample messages"><div className="samples-heading"><span>NOT SURE WHERE TO START?</span><button onClick={()=>{setMessage('');setResult(null);setActiveSample(-1);setError('')}}>Clear <X size={12}/></button></div><div className="sample-grid">{samples.map((s,i)=>{let Icon=s.icon;return <button key={s.title} onClick={()=>setSample(i)} className={`sample-chip ${activeSample===i?'sample-active':''}`}><Icon size={15}/><span>{s.title}</span><span className={`sample-dot ${s.tag==='Looks safe'?'dot-safe':''}`}/></button>})}</div></section>
        {busy&&<div className="scan-state" role="status"><span className="scan-ring"><ScanLine size={18}/></span><div><strong>Checking the details</strong><span>Looking for patterns that deserve a second look.</span></div><span className="scan-sweep"/></div>}
        {result&&<section className="result-card card" aria-live="polite" style={{'--verdict':selectedColor} as React.CSSProperties}><div className="result-top"><div className="section-index">02</div><div className="result-heading"><span>YOUR MESSAGE CHECK</span><div className="result-meta"><Clock3 size={12}/>{result.latency_ms}ms <i/> just now</div></div><div className="result-tools"><button onClick={copy} title="Copy result">{copied?<Check size={15}/>:<Copy size={15}/>}</button><button onClick={()=>navigator.share?.({title:'TrustGuard check',text:`${label(result.classification)} — ${result.fraud_score}/100. ${result.explanation}`})} title="Share result"><ExternalLink size={15}/></button></div></div>
            <div className="verdict-row"><div className="gauge-wrap"><ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={chartData} dataKey="value" cx="50%" cy="55%" startAngle={210} endAngle={-30} innerRadius="77%" outerRadius="100%" stroke="none" cornerRadius={8} paddingAngle={2}><Cell fill={selectedColor}/><Cell fill="var(--gauge-track)"/></Pie></PieChart></ResponsiveContainer><div className="gauge-center"><span>{result.fraud_score}</span><small>RISK</small></div></div><div className="verdict-copy"><span className="verdict-label" style={{color:selectedColor}}>{result.classification==='fraud'?<ShieldAlert size={16}/>:result.classification==='uncertain'?<TriangleAlert size={16}/>:<ShieldCheck size={16}/>} {label(result.classification)}</span><h2>{result.fraud_score>=70?'This doesn’t look right.':result.fraud_score>=40?'Worth a closer look.':'Nothing alarming stood out.'}</h2><p>{result.explanation}</p><span className="confidence-note"><span className="live-dot"/> A second opinion, not a guarantee</span></div></div>
            <MessageEvidence message={message} highlights={result.highlights}/>
            {result.highlights.length>0&&<div className="result-block"><div className="block-title"><span className="block-marker marker-red"/>THE TELLTALE SIGNS <span className="block-count">{String(result.highlights.length).padStart(2,'0')}</span></div><div className="highlight-list">{result.highlights.slice(0,5).map((h,i)=><div className="highlight-row" key={`${h.text}-${i}`}><span className="highlight-quote">“{h.text}”</span><span>{h.reason}</span></div>)}</div></div>}
            <div className="result-block"><div className="block-title"><span className="block-marker marker-amber"/>SIGNALS FOUND <span className="block-count">{String(result.risk_factors.length).padStart(2,'0')}</span></div><div className="factor-list">{result.risk_factors.length?result.risk_factors.map((f,i)=><span className={`factor-chip severity-${f.severity}`} key={`${f.label}-${i}`}><span/> {f.label}</span>):<span className="factor-chip severity-low"><span/> No strong warning signs</span>}</div></div>
            <div className="advice"><div className="advice-icon"><ShieldCheck size={19}/></div><div><div className="advice-title">A safer next step</div><ul>{result.recommended_actions.slice(0,3).map((a,i)=><li key={i}>{a}</li>)}</ul></div><ArrowUpRight className="advice-arrow" size={17}/></div>
            <div className="result-foot"><span><span className="ai-spark">✳</span> {result.ai_status==='online'?'Ollama · Qwen2.5 7B':'Rule-based safety check'} <span className="foot-sep">/</span> {result.ai_status==='fallback'?'AI model offline':'open-weight AI'}</span><button onClick={()=>{setResult(null);document.querySelector('.composer')?.scrollIntoView({behavior:'smooth'})}}>Check another <ArrowRight size={13}/></button></div>
          </section>}
        <section className="how-section" id="how"><div className="eyebrow"><span className="eyebrow-dash"/>A LITTLE LESS GUESSWORK</div><h3>Clarity in <span>three steps.</span></h3><div className="steps-grid"><article><span>01</span><div className="step-icon"><Send size={17}/></div><strong>Drop it in</strong><p>Paste the message that’s making you pause.</p></article><article><span>02</span><div className="step-icon"><ScanLine size={17}/></div><strong>We inspect it</strong><p>Local safety rules and optional open AI look for telltale clues.</p></article><article><span>03</span><div className="step-icon"><ShieldCheck size={17}/></div><strong>You decide</strong><p>Get a clear breakdown and a safer next move.</p></article></div></section>
      </section>
      <aside className={`sidebar ${showHistory?'sidebar-open':''}`}><div className="side-card card"><div className="side-heading"><div><span className="section-overline">YOUR SESSION</span><h2>Recent checks</h2></div><span className="history-icon"><History size={16}/></span></div><div className="history-list">{history.length?history.map((h,i)=><button key={h.time} className={`history-item ${result===h.result?'history-current':''}`} onClick={()=>{setMessage(h.message);setResult(h.result);setShowHistory(false);window.scrollTo({top:0,behavior:'smooth'})}}><span className="history-verdict" style={{'--verdict':color(h.result.classification)} as React.CSSProperties}><span/></span><span className="history-text"><strong>{h.message.slice(0,36)}{h.message.length>36?'…':''}</strong><span>{label(h.result.classification)}</span></span><span className="history-time">{i===0?'now':`${Math.max(1,Math.floor((Date.now()-h.time)/60000))}m`}</span></button>):<div className="empty-history"><span className="empty-orbit"><Shield size={20}/></span><strong>A clean slate.</strong><p>Your recent checks will appear here during your session.</p></div>}</div><div className="history-foot"><span><span className="live-dot"/> Stored in this browser only</span><button onClick={()=>{setHistory([]);localStorage.removeItem('tg-history')}} disabled={!history.length}>Clear</button></div></div>
        <div className="privacy-card card" id="privacy"><div className="privacy-orb"><LockKeyhole size={16}/></div><span className="section-overline">YOUR WORDS STAY YOURS</span><h3>Private, by<br/><em>default.</em></h3><p>Messages are checked in memory and never written to the API’s storage. Your history stays in this browser.</p><a href="#how">Our privacy approach <ArrowUpRight size={13}/></a><div className="privacy-scan"/></div>
        <div className="model-card"><div className="model-top"><span className="model-orbit"><Sparkles size={14}/></span><span className="model-live"><span className="live-dot"/> OPEN WEIGHT</span></div><div className="model-name">Qwen2.5 <span>7B</span></div><div className="model-caption">Runs locally through Ollama.<br/>No account. No API key.</div><div className="model-bottom"><span>COMMUNITY MODEL</span><a href="https://ollama.com/library/qwen2.5" target="_blank" rel="noreferrer" aria-label="Qwen model information"><ArrowUpRight size={14}/></a></div></div>
        <div className="side-note"><div className="note-icon"><TriangleAlert size={15}/></div><p>Good instincts matter. A low score doesn’t verify who sent a message.</p></div>
      </aside>
    </main>
    <footer className="footer"><a className="footer-brand" href="#top"><Shield size={14}/> trustguard<span>.</span></a><span>Made for the moment before you tap.</span><span className="footer-links"><a href="https://github.com/shreyadeshmukh641-afk/TrustGuard" target="_blank" rel="noreferrer">Open source <ArrowUpRight size={11}/></a><i/> <a href="https://github.com/shreyadeshmukh641-afk/TrustGuard/blob/master/LICENSE" target="_blank" rel="noreferrer">MIT license <ArrowUpRight size={11}/></a></span></footer>
  </div>
}
