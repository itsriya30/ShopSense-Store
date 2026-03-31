import { useState, useEffect, useRef, useCallback } from "react";
import { io } from "socket.io-client";
import { AreaChart, Area, BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell } from "recharts";

const API = "http://localhost:5000/api", WS = "http://localhost:5000";
const COLORS = ["#4299e1","#ed8936","#48bb78","#f56565","#9f7aea","#38b2ac","#ecc94b","#667eea"];
const toINR = v => "\u20b9" + Number(v||0).toLocaleString("en-IN");
const toNum = v => Number(v||0).toLocaleString("en-IN");
const toUTC = ts => { try { return new Date(ts).toLocaleTimeString("en-GB",{timeZone:"UTC",hour:"2-digit",minute:"2-digit",second:"2-digit",hour12:false})+" UTC"; } catch { return "--"; } };
const TT = {backgroundColor:"#fff",border:"1px solid #e2e8f0",borderRadius:8,fontSize:12,color:"#2d3748"};
const EV_CLR = {view:"#4299e1",click:"#9f7aea",cart_add:"#48bb78",cart_remove:"#ed8936",checkout:"#ecc94b",purchase:"#f56565"};
const EV_LBL = {view:"VIEW",click:"CLICK",cart_add:"CART ADD",cart_remove:"REMOVED",checkout:"CHECKOUT",purchase:"PURCHASE"};

function ChartJsPie({ data, id, height=220 }) {
  const canvasRef = useRef(null), chartRef = useRef(null);
  useEffect(() => {
    if (!data || data.length === 0) return;
    const total = data.reduce((s,d) => s + Number(d.value), 0);
    if (total === 0) return;
    const load = () => {
      if (!window.Chart || !canvasRef.current) return;
      if (chartRef.current) { chartRef.current.destroy(); chartRef.current = null; }
      chartRef.current = new window.Chart(canvasRef.current, {
        type: "doughnut",
        data: { labels: data.map(d=>d.name), datasets: [{ data: data.map(d=>Number(d.value)), backgroundColor: data.map((d,i)=>d.color||COLORS[i%COLORS.length]), borderColor:"#fff", borderWidth:3, hoverOffset:6 }] },
        options: { responsive:true, maintainAspectRatio:false, cutout:"45%", plugins:{ legend:{display:false}, tooltip:{callbacks:{label:ctx=>" "+ctx.label+": "+toNum(ctx.raw)+" ("+((ctx.raw/total)*100).toFixed(0)+"%)"}} } }
      });
    };
    if (window.Chart) { load(); }
    else {
      const ex = document.getElementById("chartjs-cdn");
      if (!ex) { const s=document.createElement("script"); s.id="chartjs-cdn"; s.src="https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.1/chart.umd.js"; s.onload=load; document.head.appendChild(s); }
      else { ex.addEventListener("load",load); setTimeout(load,500); }
    }
    return () => { if (chartRef.current) { chartRef.current.destroy(); chartRef.current=null; } };
  }, [data]);
  const total = (data||[]).reduce((s,d) => s+Number(d.value), 0);
  if (!data || data.length===0 || total===0) return (
    <div style={{display:"flex",alignItems:"center",justifyContent:"center",height,color:"#a0aec0",fontSize:12,textAlign:"center"}}>Open store and interact with products</div>
  );
  return (
    <div>
      <div style={{position:"relative",width:"100%",height}}><canvas ref={canvasRef} id={id}/></div>
      <div style={{display:"flex",flexWrap:"wrap",gap:"5px 14px",justifyContent:"center",marginTop:8}}>
        {data.map((d,i) => (
          <div key={i} style={{display:"flex",alignItems:"center",gap:5,fontSize:11}}>
            <span style={{width:10,height:10,borderRadius:"50%",background:d.color||COLORS[i%COLORS.length],display:"inline-block"}}/>
            <span style={{color:"#718096",fontWeight:600}}>{d.name}:</span>
            <span style={{fontWeight:800,color:"#1a202c",fontFamily:"monospace"}}>{toNum(d.value)}</span>
            <span style={{color:"#a0aec0",fontSize:10}}>({((Number(d.value)/total)*100).toFixed(0)}%)</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function Card({ title, children, style={} }) {
  return (
    <div style={{background:"#fff",border:"1px solid #e2e8f0",borderRadius:12,padding:"16px 18px",boxShadow:"0 1px 3px rgba(0,0,0,0.07)",...style}}>
      {title && (
        <div style={{display:"flex",alignItems:"center",gap:7,marginBottom:14}}>
          <div style={{width:3,height:13,background:"#3182ce",borderRadius:2}}/>
          <span style={{fontSize:11,fontWeight:800,color:"#718096",textTransform:"uppercase",letterSpacing:"0.08em"}}>{title}</span>
          <span style={{marginLeft:"auto",width:7,height:7,borderRadius:"50%",background:"#48bb78",animation:"lp 2s infinite",boxShadow:"0 0 6px #48bb78",display:"inline-block"}}/>
        </div>
      )}
      {children}
    </div>
  );
}

function KPI({ label, value, color }) {
  const [glow, setGlow] = useState(false), prev = useRef(value);
  useEffect(() => { if (prev.current!==value){setGlow(true);prev.current=value;setTimeout(()=>setGlow(false),900);} }, [value]);
  return (
    <div style={{background:"#fff",borderLeft:"1px solid "+(glow?color:"#e2e8f0"),borderRight:"1px solid "+(glow?color:"#e2e8f0"),borderBottom:"1px solid "+(glow?color:"#e2e8f0"),borderTop:"3px solid "+color,borderRadius:12,padding:"18px 16px",textAlign:"center",transition:"all 0.4s",boxShadow:glow?"0 0 20px "+color+"30":"0 1px 3px rgba(0,0,0,0.07)"}}>
      <div style={{fontSize:11,color:"#718096",fontWeight:600,marginBottom:8}}>{label}</div>
      <div style={{fontSize:26,fontWeight:900,color:glow?color:"#1a202c",fontFamily:"monospace",letterSpacing:"-1px",transition:"color 0.4s"}}>{value}</div>
    </div>
  );
}

function Empty({ text }) {
  return (
    <div style={{display:"flex",alignItems:"center",justifyContent:"center",height:160,color:"#a0aec0",fontSize:12,textAlign:"center",maxWidth:200,margin:"0 auto",lineHeight:1.5}}>{text}</div>
  );
}

export default function Dashboard() {
  const [kpis, setKpis]           = useState({});
  const [funnel, setFunnel]       = useState([]);
  const [hourly, setHourly]       = useState([]);
  const [traffic, setTraffic]     = useState([]);
  const [devices, setDevices]     = useState([]);
  const [products, setProducts]   = useState([]);
  const [events, setEvents]       = useState([]);
  const [catFilter, setCatFilter] = useState("All");
  const [lastTime, setLastTime]   = useState(null);
  const socketRef = useRef(null);

  const fetchAll = useCallback(async () => {
    try {
      const [k,f,h,t,d,p,e] = await Promise.all([
        fetch(API+"/analytics/kpis").then(r=>r.json()),
        fetch(API+"/analytics/funnel").then(r=>r.json()),
        fetch(API+"/analytics/hourly").then(r=>r.json()),
        fetch(API+"/analytics/traffic").then(r=>r.json()),
        fetch(API+"/analytics/devices").then(r=>r.json()),
        fetch(API+"/products/top").then(r=>r.json()),
        fetch(API+"/events/live").then(r=>r.json()),
      ]);
      setKpis(k||{});
      setFunnel(Array.isArray(f)?f:[]);
      setHourly(Array.isArray(h)?h:[]);
      setTraffic(Array.isArray(t)?t:[]);
      setDevices(Array.isArray(d)?d:[]);
      setProducts(Array.isArray(p)?p:[]);
      setEvents(Array.isArray(e)?e:[]);
    } catch(err) { console.error("fetch error",err); }
  }, []);

  useEffect(() => {
    fetchAll();
    const iv = setInterval(fetchAll, 5000);
    const sock = io(WS, { transports:["websocket","polling"] });
    socketRef.current = sock;
    let debounceTimer = null;
    sock.on("new_session", () => { clearTimeout(debounceTimer); debounceTimer = setTimeout(() => fetchAll(), 500); });
    sock.on("new_event", ev => {
      setEvents(prev => [ev,...prev].slice(0,100));
      setLastTime(ev.created_at);
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => fetchAll(), 800);
    });
    return () => { clearInterval(iv); clearTimeout(debounceTimer); sock.disconnect(); };
  }, [fetchAll]);

  const cats = ["All",...new Set((products||[]).map(p=>p.category).filter(Boolean))];
  const filteredProds = (products||[]).filter(p => catFilter==="All" || p.category===catFilter);
  const funnelPieData  = (funnel||[]).map((f,i)=>({name:f.stage,value:Number(f.value),color:COLORS[i%COLORS.length]}));
  const trafficPieData = (traffic||[]).map((t,i)=>({name:t.source||"Unknown",value:Number(t.count),color:COLORS[i%COLORS.length]}));
  const devicePieData  = (devices||[]).map((d,i)=>({name:d.type||"Unknown",value:Number(d.count),color:COLORS[i%COLORS.length]}));
  const funnelDropoff  = (funnel||[]).map((f,i,arr)=>{
    const pv = i>0?Number(arr[i-1].value):Number(f.value);
    return {stage:f.stage,value:Number(f.value),drop:pv>0?Number(((pv-Number(f.value))/pv*100).toFixed(0)):0};
  });
  const revByProd = [...(products||[])].sort((a,b)=>Number(b.revenue||0)-Number(a.revenue||0)).slice(0,8)
    .map(p=>({name:p.product_name?p.product_name.split(" ").slice(0,2).join(" "):"?",revenue:Number(p.revenue||0)}));
  const sidebarTraffic = (traffic||[]).slice(0,5);
  const maxT = sidebarTraffic.length>0?Math.max(...sidebarTraffic.map(t=>Number(t.count)),1):1;

  return (
    <div style={{display:"flex",minHeight:"100vh",background:"#f0f2f5",fontFamily:"'Inter',system-ui,sans-serif"}}>
      <style>{`@keyframes lp{0%,100%{opacity:1}50%{opacity:0.3}} *{box-sizing:border-box;margin:0;padding:0;}`}</style>

      <div style={{width:220,background:"#1a202c",color:"#e2e8f0",display:"flex",flexDirection:"column",padding:"20px 14px",gap:20,flexShrink:0}}>
        <div style={{textAlign:"center",paddingBottom:16,borderBottom:"1px solid #2d3748"}}>
          <div style={{fontSize:20,fontWeight:900,color:"#63b3ed",letterSpacing:"-0.5px"}}>ShopSense</div>
          <div style={{fontSize:10,color:"#718096",marginTop:2}}>Analytics Dashboard</div>
          <div style={{marginTop:8,display:"flex",alignItems:"center",justifyContent:"center",gap:5}}>
            <span style={{width:7,height:7,borderRadius:"50%",background:"#48bb78",animation:"lp 2s infinite",display:"inline-block"}}/>
            <span style={{fontSize:10,color:"#68d391"}}>LIVE</span>
          </div>
        </div>
        <div>
          <div style={{fontSize:10,fontWeight:700,color:"#718096",marginBottom:8,textTransform:"uppercase",letterSpacing:"0.08em"}}>Category Filter</div>
          {cats.map(c=>(
            <button key={c} onClick={()=>setCatFilter(c)} style={{display:"block",width:"100%",textAlign:"left",padding:"6px 10px",marginBottom:4,borderRadius:6,border:"none",background:catFilter===c?"#3182ce":"transparent",color:catFilter===c?"#fff":"#a0aec0",fontSize:12,cursor:"pointer",fontWeight:catFilter===c?700:400}}>{c}</button>
          ))}
        </div>
        <div>
          <div style={{fontSize:10,fontWeight:700,color:"#718096",marginBottom:8,textTransform:"uppercase",letterSpacing:"0.08em"}}>Quick Stats</div>
          {[["Sessions",toNum(kpis.total_sessions||kpis.active_users)],["Events",toNum(kpis.total_events)],["Revenue",toINR(kpis.total_revenue)]].map(([l,v])=>(
            <div key={l} style={{display:"flex",justifyContent:"space-between",padding:"5px 0",borderBottom:"1px solid #2d3748"}}>
              <span style={{fontSize:11,color:"#718096"}}>{l}</span>
              <span style={{fontSize:11,fontWeight:700,color:"#e2e8f0",fontFamily:"monospace"}}>{v}</span>
            </div>
          ))}
        </div>
        <div>
          <div style={{fontSize:10,fontWeight:700,color:"#718096",marginBottom:8,textTransform:"uppercase",letterSpacing:"0.08em"}}>Traffic Sources</div>
          {sidebarTraffic.map((t,i)=>(
            <div key={i} style={{marginBottom:8}}>
              <div style={{display:"flex",justifyContent:"space-between",marginBottom:3}}>
                <span style={{fontSize:10,color:"#a0aec0"}}>{t.source||"Unknown"}</span>
                <span style={{fontSize:10,fontWeight:700,color:"#e2e8f0",fontFamily:"monospace"}}>{toNum(t.count)}</span>
              </div>
              <div style={{height:4,background:"#2d3748",borderRadius:2}}>
                <div style={{height:"100%",width:(Number(t.count)/maxT*100).toFixed(0)+"%",background:COLORS[i%COLORS.length],borderRadius:2,transition:"width 0.5s"}}/>
              </div>
            </div>
          ))}
        </div>
        <div style={{marginTop:"auto",paddingTop:16,borderTop:"1px solid #2d3748",fontSize:10,color:"#4a5568",textAlign:"center"}}>
          {lastTime&&<div>Last update<br/><span style={{color:"#68d391",fontFamily:"monospace"}}>{toUTC(lastTime)}</span></div>}
        </div>
      </div>

      <div style={{flex:1,padding:"20px 24px",overflowY:"auto",display:"flex",flexDirection:"column",gap:16}}>
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between"}}>
          <div>
            <h1 style={{fontSize:22,fontWeight:900,color:"#1a202c",letterSpacing:"-0.5px"}}>Analytics Overview</h1>
            <p style={{fontSize:12,color:"#718096",marginTop:2}}>Real-time e-commerce insights</p>
          </div>
          <button onClick={fetchAll} style={{padding:"8px 16px",background:"#3182ce",color:"#fff",border:"none",borderRadius:8,fontSize:12,fontWeight:700,cursor:"pointer"}}>Refresh</button>
        </div>

        <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:14}}>
          <KPI label="Total Sessions"  value={toNum(kpis.total_sessions||kpis.active_users)} color="#4299e1"/>
          <KPI label="Total Revenue"   value={toINR(kpis.total_revenue)}                      color="#48bb78"/>
          <KPI label="Cart Abandon %"  value={(kpis.cart_abandon_rate||0)+"%"}               color="#ed8936"/>
          <KPI label="Avg Session (s)" value={toNum(kpis.avg_session)}                        color="#9f7aea"/>
        </div>

        <div style={{display:"grid",gridTemplateColumns:"1fr 340px",gap:14}}>
          <Card title="Hourly Traffic (Last 24h)">
            {hourly.length===0?<Empty text="No hourly data yet"/>:
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={hourly}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0"/>
                  <XAxis dataKey="time" tick={{fontSize:10}} interval={2}/>
                  <YAxis tick={{fontSize:10}}/>
                  <Tooltip contentStyle={TT}/>
                  <Legend wrapperStyle={{fontSize:11}}/>
                  <Line type="monotone" dataKey="event_count" stroke="#4299e1" strokeWidth={2} dot={false} name="Events"/>
                  <Line type="monotone" dataKey="unique_users" stroke="#48bb78" strokeWidth={2} dot={false} name="Sessions"/>
                </LineChart>
              </ResponsiveContainer>
            }
          </Card>
          <Card title="Devices">
            <ChartJsPie data={devicePieData} id="device-pie" height={200}/>
          </Card>
        </div>

        <div style={{display:"grid",gridTemplateColumns:"1fr 300px 1fr",gap:14}}>
          <Card title="Top Products by Views">
            {filteredProds.length===0?<Empty text="No product data yet"/>:
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={filteredProds.slice(0,8)} layout="vertical" margin={{left:10}}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0"/>
                  <XAxis type="number" tick={{fontSize:10}}/>
                  <YAxis type="category" dataKey="product_name" tick={{fontSize:9}} width={90} tickFormatter={v=>v?v.split(" ").slice(0,2).join(" "):v}/>
                  <Tooltip contentStyle={TT}/>
                  <Bar dataKey="views" name="Views" radius={[0,4,4,0]}>
                    {filteredProds.slice(0,8).map((_,i)=><Cell key={i} fill={COLORS[i%COLORS.length]}/>)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            }
          </Card>
          <Card title="Funnel Breakdown">
            <ChartJsPie data={funnelPieData} id="funnel-pie" height={200}/>
          </Card>
          <Card title="Revenue Over Time">
            {hourly.length===0?<Empty text="No revenue data yet"/>:
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={hourly}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0"/>
                  <XAxis dataKey="time" tick={{fontSize:10}} interval={2}/>
                  <YAxis tick={{fontSize:10}}/>
                  <Tooltip contentStyle={TT} formatter={v=>toINR(v)}/>
                  <Line type="monotone" dataKey="revenue" stroke="#48bb78" strokeWidth={2} dot={false} name="Revenue"/>
                </LineChart>
              </ResponsiveContainer>
            }
          </Card>
        </div>

        <div style={{display:"grid",gridTemplateColumns:"1fr 300px 1fr",gap:14}}>
          <Card title="Funnel Drop-off">
            {funnelDropoff.length===0?<Empty text="No funnel data yet"/>:
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={funnelDropoff}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0"/>
                  <XAxis dataKey="stage" tick={{fontSize:10}}/>
                  <YAxis tick={{fontSize:10}}/>
                  <Tooltip contentStyle={TT}/>
                  <Bar dataKey="value" name="Count" radius={[4,4,0,0]}>
                    {funnelDropoff.map((_,i)=><Cell key={i} fill={COLORS[i%COLORS.length]}/>)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            }
          </Card>
          <Card title="Traffic Sources">
            <ChartJsPie data={trafficPieData} id="traffic-pie" height={200}/>
          </Card>
          <Card title="Revenue by Product">
            {revByProd.length===0?<Empty text="No revenue data yet"/>:
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={revByProd}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0"/>
                  <XAxis dataKey="name" tick={{fontSize:9}} angle={-20} textAnchor="end" height={40}/>
                  <YAxis tick={{fontSize:10}} tickFormatter={v=>v>=1000?(v/1000).toFixed(1)+"k":v}/>
                  <Tooltip contentStyle={TT} formatter={v=>toINR(v)}/>
                  <Bar dataKey="revenue" name="Revenue" radius={[4,4,0,0]}>
                    {revByProd.map((_,i)=><Cell key={i} fill={COLORS[i%COLORS.length]}/>)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            }
          </Card>
        </div>

        <Card title="Live Event Stream">
          <div style={{overflowX:"auto"}}>
            <table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}>
              <thead>
                <tr style={{background:"#f7fafc"}}>
                  {["Time (UTC)","Event","Product","Category","Device","Location","Source","Revenue"].map(h=>(
                    <th key={h} style={{padding:"8px 10px",textAlign:"left",fontWeight:700,color:"#718096",fontSize:11,borderBottom:"2px solid #e2e8f0",whiteSpace:"nowrap"}}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {events.length===0
                  ?<tr><td colSpan={8} style={{textAlign:"center",padding:32,color:"#a0aec0"}}>No events yet — open the store and interact with products</td></tr>
                  :events.map((ev,i)=>(
                    <tr key={ev.event_id||i} style={{borderBottom:"1px solid #f0f0f0",background:i===0?"#ebf8ff":"#fff",transition:"background 0.5s"}}>
                      <td style={{padding:"7px 10px",fontFamily:"monospace",fontSize:11,color:"#718096",whiteSpace:"nowrap"}}>{toUTC(ev.created_at)}</td>
                      <td style={{padding:"7px 10px"}}><span style={{padding:"2px 8px",borderRadius:12,fontSize:10,fontWeight:700,background:EV_CLR[ev.event_type]||"#e2e8f0",color:"#fff"}}>{EV_LBL[ev.event_type]||ev.event_type}</span></td>
                      <td style={{padding:"7px 10px",maxWidth:160,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",color:"#2d3748",fontWeight:500}}>{ev.product_name}</td>
                      <td style={{padding:"7px 10px",color:"#718096"}}>{ev.category}</td>
                      <td style={{padding:"7px 10px",color:"#718096"}}>{ev.device_type}</td>
                      <td style={{padding:"7px 10px",color:"#718096"}}>{ev.location}</td>
                      <td style={{padding:"7px 10px",color:"#718096"}}>{ev.traffic_source}</td>
                      <td style={{padding:"7px 10px",fontFamily:"monospace",fontWeight:700,color:Number(ev.revenue)>0?"#48bb78":"#a0aec0"}}>{Number(ev.revenue)>0?toINR(ev.revenue):"--"}</td>
                    </tr>
                  ))
                }
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    </div>
  );
}
