"use client";
import { useEffect, useMemo, useState } from "react";

type Row={ [key:string]: any };
type Booking={id:string;guest:string;phone:string;room:string;status:string;amount:number;paid:number};

const sections=["Overview","POS","Inventory","Guest Services","Corporate","CRM","Staff","Analytics","Assistant","Export","Integrations"];

export default function OperationsPage(){
  const [section,setSection]=useState("Overview");
  const [data,setData]=useState<Row>({});
  const [busy,setBusy]=useState(true);
  const [message,setMessage]=useState("");

  async function load(){
    setBusy(true);
    try{
      const r=await fetch("/api/pms",{cache:"no-store"});
      const d=await r.json();
      if(!r.ok||!d.ok) throw new Error(d.error||"Unable to load operations");
      setData(d);
    }catch(e){setMessage(e instanceof Error?e.message:"Unable to load operations")}finally{setBusy(false)}
  }
  useEffect(()=>{load()},[]);

  async function act(payload:Row,success:string){
    try{
      const r=await fetch("/api/pms",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify(payload)});
      const d=await r.json();
      if(!r.ok||!d.ok) throw new Error(d.error||"Operation failed");
      setMessage(success);
      await load();
      return d.result;
    }catch(e){setMessage(e instanceof Error?e.message:"Operation failed");return null}
  }

  const bookings=(data.bookings||[]) as Booking[];
  const inHouse=bookings.filter(b=>b.status==="Checked-in");
  const integrations=(data.integrations||[]) as Row[];
  const inventory=(data.inventory||[]) as Row[];
  const lowStock=inventory.filter(i=>Number(i.current_stock)<=Number(i.reorder_level));
  const pos=(data.posOrders||[]) as Row[];
  const laundry=(data.laundryOrders||[]) as Row[];
  const transport=(data.transport||[]) as Row[];
  const corporates=(data.corporates||[]) as Row[];
  const staff=(data.staff||[]) as Row[];
  const attendance=(data.attendance||[]) as Row[];
  const notifications=(data.notifications||[]) as Row[];
  const rooms=(data.rooms||[]) as Row[];
  const expenses=(data.expenses||[]) as Row[];
  const [assistantQuery,setAssistantQuery]=useState("");
  const [assistantAnswer,setAssistantAnswer]=useState("");

  const metrics=useMemo(()=>({
    connected:integrations.filter(i=>i.status==="Live"||i.status==="Configured").length,
    stock:inventory.length,
    low:lowStock.length,
    posRevenue:pos.reduce((s,o)=>s+Number(o.total||0),0)
  }),[integrations,inventory,lowStock,pos]);

  async function posOrder(){
    const bookingNo=prompt("Checked-in booking number",inHouse[0]?.id||""); if(!bookingNo)return;
    const item=prompt("Item","Dinner"); if(!item)return;
    const price=Number(prompt("Unit price","650")||0); if(price<=0)return;
    const quantity=Number(prompt("Quantity","1")||1);
    await act({action:"createPosOrder",bookingNo,outlet:"Restaurant",items:[{item_name:item,quantity,unit_price:price,tax_rate:0}],postToRoom:true},"Restaurant order posted to guest folio");
  }
  async function stock(item:Row,direction:"IN"|"OUT"){
    const quantity=Number(prompt(direction==="IN"?"Quantity received":"Quantity consumed","1")||0); if(quantity<=0)return;
    await act({action:"inventoryAdjust",itemId:item.id,txnType:direction==="IN"?"Purchase":"Consumption",quantity,direction,note:"Operations Hub"},"Inventory updated");
  }
  async function laundryOrder(){
    const bookingNo=prompt("Booking number",inHouse[0]?.id||""); if(!bookingNo)return;
    const description=prompt("Laundry items","2 Shirts, 1 Trouser"); if(!description)return;
    const total=Number(prompt("Laundry charge","350")||0);
    await act({action:"createLaundry",bookingNo,items:[{description}],total},"Laundry order created and charged to room");
  }
  async function transportOrder(){
    const bookingNo=prompt("Booking number",bookings[0]?.id||""); if(!bookingNo)return;
    const pickup=prompt("Pickup","Shillong Airport"); const drop=prompt("Drop","La Shimti Hotel"); if(!pickup||!drop)return;
    const amount=Number(prompt("Guest charge","1200")||0);
    await act({action:"createTransport",bookingNo,pickup,drop,pickupTime:new Date(Date.now()+86400000).toISOString(),vehicle:"Sedan",amount},"Transport request scheduled");
  }
  async function access(){
    const bookingNo=prompt("Booking number",inHouse[0]?.id||""); if(!bookingNo)return;
    const result=await act({action:"issueDoorAccess",bookingNo,provider:"Manual"},"Temporary room access issued");
    if(result?.access_code) alert("Room access code: "+result.access_code);
  }
  async function precheck(){
    const bookingNo=prompt("Booking number",bookings[0]?.id||""); if(!bookingNo)return;
    const result=await act({action:"createPrecheckin",bookingNo},"Pre-check-in link created");
    if(result?.token) prompt("Copy guest pre-check-in link",window.location.origin+"/precheckin/"+result.token);
  }
  async function corporate(){
    const companyName=prompt("Company name"); if(!companyName)return;
    const gstin=prompt("GSTIN (optional)")||"";
    const creditLimit=Number(prompt("Credit limit","50000")||0);
    const discount=Number(prompt("Negotiated discount %","0")||0);
    await act({action:"createCorporate",companyName,gstin,creditLimit,discount},"Corporate account created");
  }
  async function notifyGuest(b:Booking,channel:string){
    await act({action:"queueNotification",bookingNo:b.id,channel,template:"guest_update",payload:{guest:b.guest,booking:b.id}},channel+" notification queued");
  }
  async function review(b:Booking){
    await act({action:"queueReview",bookingNo:b.id,channel:"Google"},"Google review request queued");
  }
  async function punch(member:Row,kind:"IN"|"OUT"){
    await act({action:"punchAttendance",staffId:member.id,kind},"Attendance updated");
  }

  function askAssistant(){
    const q=assistantQuery.toLowerCase().trim();
    const due=bookings.filter(b=>b.amount>b.paid).sort((a,b)=>(b.amount-b.paid)-(a.amount-a.paid));
    const available=rooms.filter(r=>r.status==="Available");
    const dirty=rooms.filter(r=>["Dirty","Cleaning"].includes(r.status));
    const tomorrow="2026-10-02";
    const arrivals=bookings.filter(b=>b.checkIn===tomorrow&&b.status==="Confirmed");
    const departures=bookings.filter(b=>b.checkOut===tomorrow&&b.status==="Checked-in");
    let answer="Try asking about available rooms, pending payments, tomorrow's arrivals, departures, low stock, or today's revenue.";
    if(q.includes("available")&&q.includes("room")) answer=available.length+" rooms are available: "+available.map(r=>r.number).join(", ")+".";
    else if(q.includes("pending")||q.includes("outstanding")||q.includes("due")) answer=due.length?due.slice(0,5).map(b=>b.guest+" ("+b.id+"): ₹"+Math.round(b.amount-b.paid).toLocaleString("en-IN")).join(" · "):"No outstanding guest folios.";
    else if(q.includes("arrival")) answer=arrivals.length?arrivals.map(b=>b.guest+" · Room "+b.room+" · "+b.id).join(" · "):"No confirmed arrivals tomorrow.";
    else if(q.includes("departure")) answer=departures.length?departures.map(b=>b.guest+" · Room "+b.room).join(" · "):"No scheduled departures tomorrow.";
    else if(q.includes("dirty")||q.includes("housekeeping")) answer=dirty.length?dirty.length+" rooms need housekeeping attention: "+dirty.map(r=>r.number+" ("+r.status+")").join(", "):"No rooms currently need housekeeping attention.";
    else if(q.includes("stock")) answer=lowStock.length?lowStock.map(i=>i.item_name+" ("+i.current_stock+" "+i.unit+")").join(" · "):"No inventory items are at or below reorder level.";
    else if(q.includes("revenue")||q.includes("collection")) answer="Recorded collections across current folios: ₹"+Math.round(bookings.reduce((sum,b)=>sum+b.paid,0)).toLocaleString("en-IN")+". POS posted revenue: ₹"+Math.round(metrics.posRevenue).toLocaleString("en-IN")+".";
    setAssistantAnswer(answer);
  }

  function downloadJson(){
    const blob=new Blob([JSON.stringify(data,null,2)],{type:"application/json"});
    const url=URL.createObjectURL(blob); const a=document.createElement("a"); a.href=url; a.download="la-shimti-backup-2026-10-01.json"; a.click(); URL.revokeObjectURL(url);
  }

  function downloadCsv(){
    const header=["booking_no","guest","phone","room","check_in","check_out","source","status","gross","paid","due"];
    const rows=bookings.map(b=>[b.id,b.guest,b.phone,b.room,(b as any).checkIn||"",(b as any).checkOut||"",(b as any).source||"",b.status,b.amount,b.paid,b.amount-b.paid]);
    const esc=(v:any)=>"\""+String(v??"").replaceAll("\"","\"\"")+"\"";
    const csv=[header,...rows].map(r=>r.map(esc).join(",")).join("\n");
    const blob=new Blob([csv],{type:"text/csv"}); const url=URL.createObjectURL(blob); const a=document.createElement("a"); a.href=url; a.download="la-shimti-reservations.csv"; a.click(); URL.revokeObjectURL(url);
  }

  return <div className="ops">
    <aside className="opsnav">
      <div className="brand"><div className="brandmark">LS</div><div><b>LA SHIMTI</b><span>Operations Hub</span></div></div>
      <button className="backbtn" onClick={()=>location.href="/"}>← PMS Dashboard</button>
      <nav>{sections.map(x=><button key={x} className={section===x?"active":""} onClick={()=>setSection(x)}>{x}</button>)}</nav>
      <div className="sidefoot"><span className="live-dot"/> Backend connected<br/><small>Shared hotel database</small></div>
    </aside>
    <main className="opsmain">
      <header className="opstop"><div><div className="eyebrow">LA SHIMTI · EXTENDED OPERATIONS</div><h1>{section}</h1></div><div className="rowactions"><button className="ghost" onClick={()=>location.href="/book"}>Direct booking page</button><button className="mini" onClick={load}>↻ Refresh</button></div></header>
      {message&&<div className="opsmessage">{message}</div>}
      {busy?<div className="opsloading"><div className="loader"/>Syncing hotel operations…</div>:
      <section className="opscontent">
        {section==="Overview"&&<>
          <div className="metrics"><K label="In-house guests" value={String(inHouse.length)} sub="Active stays"/><K label="POS revenue" value={"₹"+Math.round(metrics.posRevenue).toLocaleString("en-IN")} sub="Posted orders"/><K label="Low stock" value={String(metrics.low)} sub="Needs reorder"/><K label="Integrations ready" value={String(metrics.connected)+"/"+integrations.length} sub="Configured or live"/></div>
          <div className="quickgrid"><Tile t="Restaurant / POS" d="Post F&B directly to room folios" on={()=>setSection("POS")}/><Tile t="Inventory" d="Linen, amenities, F&B and maintenance stock" on={()=>setSection("Inventory")}/><Tile t="Guest services" d="Laundry, transport, room access and pre-check-in" on={()=>setSection("Guest Services")}/><Tile t="Corporate" d="GST, negotiated rates and credit accounts" on={()=>setSection("Corporate")}/><Tile t="CRM" d="WhatsApp, email and review request queues" on={()=>setSection("CRM")}/></div>
        </>}
        {section==="POS"&&<><Head t="Restaurant & room service" d="Orders posted to a checked-in guest are added to the folio immediately." action="+ New POS order" on={posOrder}/><GridTable h={["Order","Guest","Booking","Outlet","Status","Total"]} rows={pos.map(o=>[o.orderNo,o.guest||"—",o.bookingNo||"—",o.outlet,o.status,"₹"+Number(o.total||0).toLocaleString("en-IN")])}/></>}
        {section==="Inventory"&&<><Head t="Inventory & stock ledger" d="Stock movements are recorded transactionally and cannot consume below zero."/><div className="tablecard"><table><thead><tr>{["SKU","Item","Category","Stock","Reorder","Cost","Actions"].map(h=><th key={h}>{h}</th>)}</tr></thead><tbody>{inventory.map(i=><tr key={i.id}><td className="mono">{i.sku}</td><td><b>{i.item_name}</b></td><td>{i.category}</td><td>{i.current_stock} {i.unit}</td><td>{i.reorder_level}</td><td>₹{Number(i.unit_cost||0).toLocaleString("en-IN")}</td><td><div className="rowactions"><button className="mini" onClick={()=>stock(i,"IN")}>Receive</button><button className="mini" onClick={()=>stock(i,"OUT")}>Consume</button></div></td></tr>)}</tbody></table></div></>}
        {section==="Guest Services"&&<><Head t="Guest services" d="Operational add-ons tied to reservations and folios."/><div className="quickgrid"><Tile t="Laundry" d="Create laundry order + folio charge" on={laundryOrder}/><Tile t="Airport / Transport" d="Schedule transfer + guest charge" on={transportOrder}/><Tile t="Room Access" d="Issue temporary digital access code" on={access}/><Tile t="Digital Pre-check-in" d="Create secure guest information link" on={precheck}/></div><div className="dashgrid"><div className="card"><h3>Laundry orders</h3><GridTable h={["Order","Guest","Room","Status","Total"]} rows={laundry.map(l=>[l.orderNo,l.guest,l.room,l.status,"₹"+Number(l.total||0).toLocaleString("en-IN")])}/></div><div className="card"><h3>Transport requests</h3><GridTable h={["Guest","Pickup","Drop","Status"]} rows={transport.map(t=>[t.guest_name,t.pickup_location,t.drop_location,t.status])}/></div></div></>}
        {section==="Corporate"&&<><Head t="Corporate & travel accounts" d="Credit control and negotiated corporate relationships." action="+ Corporate account" on={corporate}/><div className="cards3">{corporates.map(c=><div className="reportcard" key={c.id}><span>CO</span><h3>{c.company_name}</h3><p>{c.gstin||"GSTIN not set"} · Credit ₹{Number(c.credit_limit||0).toLocaleString("en-IN")}</p><span className="vip">{Number(c.negotiated_discount_percent||0)}% negotiated discount</span></div>)}</div></>}
        {section==="CRM"&&<><Head t="Guest CRM & communications" d="All outbound communication is queued and auditable."/><div className="tablecard"><table><thead><tr>{["Guest","Booking","Room","Status","Actions"].map(h=><th key={h}>{h}</th>)}</tr></thead><tbody>{bookings.map(b=><tr key={b.id}><td><b>{b.guest}</b><small>{b.phone}</small></td><td>{b.id}</td><td>{b.room}</td><td>{b.status}</td><td><div className="rowactions"><button className="mini" onClick={()=>notifyGuest(b,"WhatsApp")}>WhatsApp</button><button className="mini" onClick={()=>notifyGuest(b,"Email")}>Email</button>{b.status==="Checked-out"&&<button className="mini" onClick={()=>review(b)}>Review</button>}</div></td></tr>)}</tbody></table></div><div className="card" style={{marginTop:14}}><h3>Outbox</h3><GridTable h={["Channel","Recipient","Template","Status"]} rows={notifications.slice(0,20).map(n=>[n.channel,n.recipient,n.template_key||"—",n.status])}/></div></>}
        {section==="Staff"&&<><Head t="Staff attendance" d="Manual attendance is working now; biometric devices can feed the same ledger when connected."/><div className="cards3">{staff.map(m=>{const a=attendance.find(x=>x.staffId===m.id&&x.workDate==="2026-10-01");return <div className="profilecard" key={m.id}><div className="guestavatar">{String(m.full_name).split(" ").map(x=>x[0]).join("").slice(0,2)}</div><h3>{m.full_name}</h3><p>{m.role} · {m.shift||"General"}</p><div className="rowactions"><button className="mini" disabled={!!a?.checkIn} onClick={()=>punch(m,"IN")}>Check in</button><button className="mini" disabled={!a?.checkIn||!!a?.checkOut} onClick={()=>punch(m,"OUT")}>Check out</button></div></div>})}</div></>}
        {section==="Analytics"&&<><Head t="Management analytics" d="Live operational KPIs calculated from the shared PMS database."/><div className="metrics"><K label="Occupancy" value={rooms.length?Math.round(rooms.filter(r=>r.status==="Occupied").length/rooms.filter(r=>!["Out of Order","Maintenance"].includes(r.status)).length*100)+"%":"0%"} sub="Sellable room occupancy"/><K label="Outstanding" value={"₹"+Math.round(bookings.reduce((x,b)=>x+Math.max(0,b.amount-b.paid),0)).toLocaleString("en-IN")} sub="Open guest receivables"/><K label="Operating spend" value={"₹"+Math.round(expenses.reduce((x,e)=>x+Number(e.amount||0),0)).toLocaleString("en-IN")} sub="Recorded expenses"/><K label="Low stock" value={String(lowStock.length)} sub="Reorder attention"/></div><div className="dashgrid"><div className="card"><h3>Booking source mix</h3>{Array.from(new Set(bookings.map(b=>(b as any).source||"Direct"))).map(src=>{const n=bookings.filter(b=>((b as any).source||"Direct")===src).length;return <div className="settingrow" key={src}><span>{src}</span><b>{n}</b></div>})}</div><div className="card"><h3>Room status mix</h3>{["Available","Reserved","Occupied","Dirty","Cleaning","Out of Order"].map(st=><div className="settingrow" key={st}><span>{st}</span><b>{rooms.filter(r=>r.status===st).length}</b></div>)}</div></div></>}
        {section==="Assistant"&&<><Head t="Hotel operations assistant" d="Ask operational questions against the live PMS data. No external AI key is required for these supported queries."/><div className="card assistantbox"><input value={assistantQuery} onChange={e=>setAssistantQuery(e.target.value)} onKeyDown={e=>{if(e.key==="Enter")askAssistant()}} placeholder="e.g. Which rooms are available? Who has pending payment?"/><button className="primary" onClick={askAssistant}>Ask</button>{assistantAnswer&&<div className="assistantanswer">{assistantAnswer}</div>}<div className="assistantprompts"><button className="mini" onClick={()=>{setAssistantQuery("available rooms");setAssistantAnswer("")}}>Available rooms</button><button className="mini" onClick={()=>{setAssistantQuery("pending payments");setAssistantAnswer("")}}>Pending payments</button><button className="mini" onClick={()=>{setAssistantQuery("tomorrow arrivals");setAssistantAnswer("")}}>Tomorrow arrivals</button><button className="mini" onClick={()=>{setAssistantQuery("low stock");setAssistantAnswer("")}}>Low stock</button></div></div></>}
        {section==="Export"&&<><Head t="Data export & backup" d="Take a portable snapshot of hotel operations or export reservation data for accounting and analysis."/><div className="quickgrid"><Tile t="Full JSON backup" d="Rooms, bookings, folios, stock, operations and integration state" on={downloadJson}/><Tile t="Reservations CSV" d="Booking, guest, stay and financial summary for spreadsheet/accounting use" on={downloadCsv}/><Tile t="Print current view" d="Use the browser print dialog for reports and paper filing" on={()=>window.print()}/></div><div className="card"><h3>Backup scope</h3><p>Exports are generated from the current shared PMS state. Database-level backups remain handled by the managed database platform.</p></div></>}
        {section==="Integrations"&&<><Head t="Integration control center" d="Adapters are present. External services remain off until vendor credentials or partner approval are supplied."/><div className="cards3">{integrations.map(i=><div className="integrationcard" key={i.provider}><div className="integrationtop"><div><span className="eyebrow">{i.category}</span><h3>{i.display_name}</h3></div><span className={"connection "+String(i.status).toLowerCase().replaceAll(" ","-")}>{i.status}</span></div><p>{i.status==="Not connected"?"Connector scaffold ready; provider credentials/access still required.":i.last_error||"Configured"}</p></div>)}</div></>}
      </section>}
    </main>
  </div>
}

function K({label,value,sub}:{label:string;value:string;sub:string}){return <div className="metric"><span>{label}</span><strong>{value}</strong><small>{sub}</small><div className="metric-line"/></div>}
function Tile({t,d,on}:{t:string;d:string;on:()=>void}){return <button className="actiontile" onClick={on}><b>{t}</b><span>{d}</span></button>}
function Head({t,d,action,on}:{t:string;d:string;action?:string;on?:()=>void}){return <div className="sectionhead"><div><h2>{t}</h2><p>{d}</p></div>{action&&<button className="primary" onClick={on}>{action}</button>}</div>}
function GridTable({h,rows}:{h:string[];rows:(string|number)[][]}){return <div className="tablewrap"><table><thead><tr>{h.map(x=><th key={x}>{x}</th>)}</tr></thead><tbody>{rows.map((r,i)=><tr key={i}>{r.map((c,j)=><td key={j}>{c}</td>)}</tr>)}</tbody></table></div>}
