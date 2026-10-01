"use client";
import { useEffect, useMemo, useState } from "react";

type Row={ [key:string]: any };
type Booking={id:string;guest:string;phone:string;room:string;status:string;amount:number;paid:number};

const sections=["Overview","POS","Inventory","Guest Services","Corporate","CRM","Staff","Integrations"];

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
        {section==="Integrations"&&<><Head t="Integration control center" d="Adapters are present. External services remain off until vendor credentials or partner approval are supplied."/><div className="cards3">{integrations.map(i=><div className="integrationcard" key={i.provider}><div className="integrationtop"><div><span className="eyebrow">{i.category}</span><h3>{i.display_name}</h3></div><span className={"connection "+String(i.status).toLowerCase().replaceAll(" ","-")}>{i.status}</span></div><p>{i.status==="Not connected"?"Connector scaffold ready; provider credentials/access still required.":i.last_error||"Configured"}</p></div>)}</div></>}
      </section>}
    </main>
  </div>
}

function K({label,value,sub}:{label:string;value:string;sub:string}){return <div className="metric"><span>{label}</span><strong>{value}</strong><small>{sub}</small><div className="metric-line"/></div>}
function Tile({t,d,on}:{t:string;d:string;on:()=>void}){return <button className="actiontile" onClick={on}><b>{t}</b><span>{d}</span></button>}
function Head({t,d,action,on}:{t:string;d:string;action?:string;on?:()=>void}){return <div className="sectionhead"><div><h2>{t}</h2><p>{d}</p></div>{action&&<button className="primary" onClick={on}>{action}</button>}</div>}
function GridTable({h,rows}:{h:string[];rows:(string|number)[][]}){return <div className="tablewrap"><table><thead><tr>{h.map(x=><th key={x}>{x}</th>)}</tr></thead><tbody>{rows.map((r,i)=><tr key={i}>{r.map((c,j)=><td key={j}>{c}</td>)}</tr>)}</tbody></table></div>}
