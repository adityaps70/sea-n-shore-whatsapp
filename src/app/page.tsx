"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";

type RoomStatus = "Available" | "Reserved" | "Occupied" | "Dirty" | "Cleaning" | "Out of Order";
type Room = { id:number; number:string; floor:number; type:string; rate:number; status:RoomStatus; guest?:string };
type Booking = { id:string; guest:string; phone:string; room:string; checkIn:string; checkOut:string; source:string; status:string; amount:number; paid:number };
type Expense = { id:string; date:string; category:string; vendor:string; amount:number; mode:string; note:string };
type Task = { id:string; room:string; priority:string; assignee:string; status:string };

const seedRooms: Room[] = [
  {id:101,number:"101",floor:1,type:"Deluxe",rate:3200,status:"Occupied",guest:"Ananya Sharma"},
  {id:102,number:"102",floor:1,type:"Deluxe",rate:3200,status:"Available"},
  {id:103,number:"103",floor:1,type:"Premium",rate:3900,status:"Dirty"},
  {id:104,number:"104",floor:1,type:"Premium",rate:3900,status:"Reserved"},
  {id:201,number:"201",floor:2,type:"Deluxe",rate:3200,status:"Available"},
  {id:202,number:"202",floor:2,type:"Premium",rate:3900,status:"Occupied",guest:"Rohan Mehta"},
  {id:203,number:"203",floor:2,type:"Family",rate:4800,status:"Cleaning"},
  {id:204,number:"204",floor:2,type:"Family",rate:4800,status:"Available"},
  {id:301,number:"301",floor:3,type:"Executive",rate:5600,status:"Reserved"},
  {id:302,number:"302",floor:3,type:"Executive",rate:5600,status:"Occupied",guest:"Meera Kapoor"},
  {id:303,number:"303",floor:3,type:"Family",rate:4800,status:"Available"},
  {id:304,number:"304",floor:3,type:"Premium",rate:3900,status:"Out of Order"},
];

const seedBookings: Booking[] = [
  {id:"LSH-26041",guest:"Ananya Sharma",phone:"98765 41021",room:"101",checkIn:"2026-10-01",checkOut:"2026-10-03",source:"Direct",status:"Checked-in",amount:6400,paid:3200},
  {id:"LSH-26042",guest:"Rohan Mehta",phone:"98111 73219",room:"202",checkIn:"2026-09-30",checkOut:"2026-10-02",source:"MakeMyTrip",status:"Checked-in",amount:7800,paid:7800},
  {id:"LSH-26043",guest:"Tashi Lyngdoh",phone:"70051 20481",room:"104",checkIn:"2026-10-01",checkOut:"2026-10-04",source:"Phone",status:"Confirmed",amount:11700,paid:3000},
  {id:"LSH-26044",guest:"Meera Kapoor",phone:"99003 28812",room:"302",checkIn:"2026-09-29",checkOut:"2026-10-01",source:"Booking.com",status:"Checked-in",amount:11200,paid:9000},
  {id:"LSH-26045",guest:"Amit Jain",phone:"98300 41127",room:"301",checkIn:"2026-10-02",checkOut:"2026-10-04",source:"Agoda",status:"Confirmed",amount:11200,paid:2500},
];

const seedExpenses: Expense[] = [
  {id:"EXP-21",date:"2026-10-01",category:"Housekeeping",vendor:"Shillong Supplies",amount:2850,mode:"UPI",note:"Linen & amenities"},
  {id:"EXP-20",date:"2026-10-01",category:"Maintenance",vendor:"Mawlai Electricals",amount:1450,mode:"Cash",note:"Room 304 electrical"},
  {id:"EXP-19",date:"2026-09-30",category:"Food",vendor:"Local Market",amount:3700,mode:"Cash",note:"Breakfast supplies"},
];

const seedTasks: Task[] = [
  {id:"HK-01",room:"103",priority:"Arrival",assignee:"Mary",status:"Dirty"},
  {id:"HK-02",room:"203",priority:"Normal",assignee:"Bina",status:"Cleaning"},
  {id:"HK-03",room:"302",priority:"Departure",assignee:"Mary",status:"Pending"},
];

const nav = ["Dashboard","Rooms","Reservations","Guests","Housekeeping","Maintenance","Billing","Expenses","Reports","Night Audit","Staff","Settings"];

const money = (n:number) => new Intl.NumberFormat("en-IN",{style:"currency",currency:"INR",maximumFractionDigits:0}).format(n);
const today = "2026-10-01";

export default function Home() {
  const [active,setActive] = useState("Dashboard");
  const [rooms,setRooms] = useState<Room[]>(seedRooms);
  const [bookings,setBookings] = useState<Booking[]>(seedBookings);
  const [expenses,setExpenses] = useState<Expense[]>(seedExpenses);
  const [tasks,setTasks] = useState<Task[]>(seedTasks);
  const [search,setSearch] = useState("");
  const [modal,setModal] = useState<"booking"|"expense"|null>(null);
  const [toast,setToast] = useState("");

  useEffect(()=> {
    const saved = localStorage.getItem("la-shimti-pms");
    if(saved){
      try {
        const d=JSON.parse(saved);
        if(d.rooms) setRooms(d.rooms);
        if(d.bookings) setBookings(d.bookings);
        if(d.expenses) setExpenses(d.expenses);
        if(d.tasks) setTasks(d.tasks);
      } catch {}
    }
  },[]);

  useEffect(()=> {
    localStorage.setItem("la-shimti-pms", JSON.stringify({rooms,bookings,expenses,tasks}));
  },[rooms,bookings,expenses,tasks]);

  const metrics = useMemo(()=>{
    const occupied=rooms.filter(r=>r.status==="Occupied").length;
    const available=rooms.filter(r=>r.status==="Available").length;
    const dirty=rooms.filter(r=>["Dirty","Cleaning"].includes(r.status)).length;
    const revenue=bookings.filter(b=>b.checkIn<=today && b.checkOut>=today).reduce((s,b)=>s+b.paid,0);
    const outstanding=bookings.reduce((s,b)=>s+Math.max(0,b.amount-b.paid),0);
    return {occupied,available,dirty,revenue,outstanding,occupancy:Math.round((occupied/rooms.filter(r=>r.status!=="Out of Order").length)*100)};
  },[rooms,bookings]);

  function notify(msg:string){ setToast(msg); setTimeout(()=>setToast(""),2200); }

  function changeRoomStatus(number:string,status:RoomStatus){
    setRooms(v=>v.map(r=>r.number===number?{...r,status,guest:status==="Available"||status==="Dirty"||status==="Cleaning"?undefined:r.guest}:r));
    notify(`Room ${number} marked ${status}`);
  }

  function submitBooking(e:FormEvent<HTMLFormElement>){
    e.preventDefault();
    const f=new FormData(e.currentTarget);
    const room=String(f.get("room"));
    const target=rooms.find(r=>r.number===room);
    if(!target || target.status==="Occupied" || target.status==="Out of Order"){ notify("Choose an available room"); return; }
    const amount=Number(f.get("amount")||target.rate);
    const b:Booking={
      id:`LSH-${String(Date.now()).slice(-5)}`,
      guest:String(f.get("guest")), phone:String(f.get("phone")), room,
      checkIn:String(f.get("checkIn")),checkOut:String(f.get("checkOut")),
      source:String(f.get("source")),status:"Confirmed",amount,paid:Number(f.get("paid")||0)
    };
    setBookings(v=>[b,...v]);
    setRooms(v=>v.map(r=>r.number===room?{...r,status:"Reserved"}:r));
    setModal(null); notify("Reservation created");
  }

  function submitExpense(e:FormEvent<HTMLFormElement>){
    e.preventDefault();
    const f=new FormData(e.currentTarget);
    setExpenses(v=>[{id:`EXP-${String(Date.now()).slice(-4)}`,date:String(f.get("date")),category:String(f.get("category")),vendor:String(f.get("vendor")),amount:Number(f.get("amount")),mode:String(f.get("mode")),note:String(f.get("note"))},...v]);
    setModal(null); notify("Expense recorded");
  }

  const filteredBookings=bookings.filter(b=>[b.guest,b.phone,b.room,b.id].join(" ").toLowerCase().includes(search.toLowerCase()));

  return <div className="app">
    <aside className="sidebar">
      <div className="brand"><div className="brandmark">LS</div><div><b>LA SHIMTI</b><span>Hotel Operations</span></div></div>
      <nav>{nav.map(item=><button key={item} className={active===item?"active":""} onClick={()=>setActive(item)}><span className="navdot"/>{item}</button>)}</nav>
      <div className="sidefoot"><span className="live-dot"/> Property online<br/><small>Shillong · INR · IST</small></div>
    </aside>

    <main>
      <header className="topbar">
        <div><div className="eyebrow">LA SHIMTI HOTEL · SHILLONG</div><h1>{active}</h1></div>
        <div className="topactions">
          <div className="search"><span>⌕</span><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Guest, room, booking…"/></div>
          <button className="ghost" onClick={()=>setModal("expense")}>+ Expense</button>
          <button className="primary" onClick={()=>setModal("booking")}>+ New booking</button>
          <div className="avatar">FD</div>
        </div>
      </header>

      {active==="Dashboard" && <Dashboard metrics={metrics} rooms={rooms} bookings={bookings} tasks={tasks} setActive={setActive} />}
      {active==="Rooms" && <Rooms rooms={rooms} changeRoomStatus={changeRoomStatus}/>}
      {active==="Reservations" && <Reservations bookings={filteredBookings} setBookings={setBookings} rooms={rooms} setRooms={setRooms} notify={notify}/>}
      {active==="Guests" && <Guests bookings={bookings}/>}
      {active==="Housekeeping" && <Housekeeping tasks={tasks} setTasks={setTasks} rooms={rooms} setRooms={setRooms} notify={notify}/>}
      {active==="Maintenance" && <Maintenance rooms={rooms} changeRoomStatus={changeRoomStatus}/>}
      {active==="Billing" && <Billing bookings={bookings}/>}
      {active==="Expenses" && <Expenses expenses={expenses}/>}
      {active==="Reports" && <Reports bookings={bookings} expenses={expenses} rooms={rooms}/>}
      {active==="Night Audit" && <NightAudit bookings={bookings} rooms={rooms}/>}
      {active==="Staff" && <Staff/>}
      {active==="Settings" && <Settings/>}
    </main>

    {modal==="booking" && <Modal title="Create reservation" onClose={()=>setModal(null)}>
      <form className="formgrid" onSubmit={submitBooking}>
        <label className="span2">Guest name<input name="guest" required placeholder="Full name"/></label>
        <label>Phone<input name="phone" required placeholder="+91…"/></label>
        <label>Source<select name="source"><option>Direct</option><option>Walk-in</option><option>Phone</option><option>WhatsApp</option><option>Booking.com</option><option>Agoda</option><option>MakeMyTrip</option></select></label>
        <label>Check-in<input name="checkIn" type="date" defaultValue="2026-10-01" required/></label>
        <label>Check-out<input name="checkOut" type="date" defaultValue="2026-10-02" required/></label>
        <label>Room<select name="room">{rooms.filter(r=>["Available","Reserved"].includes(r.status)).map(r=><option key={r.number}>{r.number}</option>)}</select></label>
        <label>Stay total<input name="amount" type="number" defaultValue="3900" min="0"/></label>
        <label>Advance paid<input name="paid" type="number" defaultValue="0" min="0"/></label>
        <div className="span2 modalactions"><button type="button" className="ghost" onClick={()=>setModal(null)}>Cancel</button><button className="primary">Save reservation</button></div>
      </form>
    </Modal>}

    {modal==="expense" && <Modal title="Record expense" onClose={()=>setModal(null)}>
      <form className="formgrid" onSubmit={submitExpense}>
        <label>Date<input name="date" type="date" defaultValue="2026-10-01" required/></label>
        <label>Category<select name="category"><option>Housekeeping</option><option>Food</option><option>Maintenance</option><option>Utilities</option><option>Transport</option><option>Purchases</option><option>Miscellaneous</option></select></label>
        <label>Vendor<input name="vendor" required/></label><label>Amount<input name="amount" type="number" min="1" required/></label>
        <label>Payment mode<select name="mode"><option>Cash</option><option>UPI</option><option>Card</option><option>Bank Transfer</option></select></label>
        <label>Notes<input name="note"/></label>
        <div className="span2 modalactions"><button type="button" className="ghost" onClick={()=>setModal(null)}>Cancel</button><button className="primary">Record expense</button></div>
      </form>
    </Modal>}
    {toast && <div className="toast">✓ {toast}</div>}
  </div>
}

function Dashboard({metrics,rooms,bookings,tasks,setActive}:{metrics:any;rooms:Room[];bookings:Booking[];tasks:Task[];setActive:(x:string)=>void}) {
  const arrivals=bookings.filter(b=>b.checkIn===today && b.status!=="Checked-in");
  const departures=bookings.filter(b=>b.checkOut===today && b.status==="Checked-in");
  return <section className="content">
    <div className="welcome"><div><span className="pill">THU · 01 OCT</span><h2>Good evening. Here’s the property pulse.</h2><p>One screen for front desk, rooms, collections and service readiness.</p></div><div className="business-day">Business day<br/><b>01 Oct 2026</b></div></div>
    <div className="metrics">
      <Metric label="Occupancy" value={metrics.occupancy+"%"} sub={metrics.occupied+" occupied"} />
      <Metric label="Available rooms" value={String(metrics.available)} sub={metrics.dirty+" need attention"} />
      <Metric label="Collections today" value={money(metrics.revenue)} sub="Across active stays" />
      <Metric label="Outstanding" value={money(metrics.outstanding)} sub="Guest & corporate folios" warn />
    </div>
    <div className="dashgrid">
      <Card title="Today at a glance" action="Reservations" onAction={()=>setActive("Reservations")}>
        <div className="timeline">
          <Timeline n={arrivals.length} title="Arrivals" text={arrivals.length?arrivals.map(x=>x.guest).join(", "):"No pending arrivals"}/>
          <Timeline n={departures.length} title="Departures" text={departures.length?departures.map(x=>x.guest).join(", "):"No pending departures"}/>
          <Timeline n={rooms.filter(r=>r.status==="Dirty").length} title="Rooms to clean" text="Prioritize arrivals before check-in"/>
          <Timeline n={tasks.filter(t=>t.status!=="Done").length} title="Open service tasks" text="Housekeeping & maintenance"/>
        </div>
      </Card>
      <Card title="Room board" action="Open board" onAction={()=>setActive("Rooms")}><MiniRoomBoard rooms={rooms}/></Card>
    </div>
    <div className="dashgrid">
      <Card title="Upcoming / in-house">
        <Table headers={["Booking","Guest","Room","Stay","Status","Balance"]} rows={bookings.slice(0,5).map(b=>[b.id,b.guest,b.room,`${b.checkIn.slice(5)} → ${b.checkOut.slice(5)}`,b.status,money(b.amount-b.paid)])}/>
      </Card>
      <Card title="Housekeeping focus" action="Manage" onAction={()=>setActive("Housekeeping")}>
        {tasks.map(t=><div className="taskrow" key={t.id}><div className="roomcircle">{t.room}</div><div><b>{t.priority} priority</b><span>{t.assignee} · {t.status}</span></div><span className={"badge "+t.status.toLowerCase()}>{t.status}</span></div>)}
      </Card>
    </div>
  </section>
}

function Rooms({rooms,changeRoomStatus}:{rooms:Room[];changeRoomStatus:(n:string,s:RoomStatus)=>void}) {
  return <section className="content"><SectionHead title="Live room board" text="Click a room status to move it through the operational cycle."/>
    {[1,2,3].map(f=><div key={f} className="floor"><h3>Floor {f}</h3><div className="roomgrid">{rooms.filter(r=>r.floor===f).map(r=><div key={r.number} className={"roomcard "+r.status.toLowerCase().replaceAll(" ","-")}>
      <div className="roomtop"><b>{r.number}</b><span>{r.type}</span></div><div className="roomstatus">{r.status}</div><p>{r.guest||money(r.rate)+" / night"}</p>
      <select value={r.status} onChange={e=>changeRoomStatus(r.number,e.target.value as RoomStatus)}><option>Available</option><option>Reserved</option><option>Occupied</option><option>Dirty</option><option>Cleaning</option><option>Out of Order</option></select>
    </div>)}</div></div>)}
  </section>
}

function Reservations({bookings,setBookings,rooms,setRooms,notify}:{bookings:Booking[];setBookings:any;rooms:Room[];setRooms:any;notify:(x:string)=>void}) {
  function action(b:Booking,type:"checkin"|"checkout"){
    if(type==="checkin"){
      setBookings((v:Booking[])=>v.map(x=>x.id===b.id?{...x,status:"Checked-in"}:x));
      setRooms((v:Room[])=>v.map(r=>r.number===b.room?{...r,status:"Occupied",guest:b.guest}:r)); notify("Guest checked in");
    } else {
      setBookings((v:Booking[])=>v.map(x=>x.id===b.id?{...x,status:"Checked-out"}:x));
      setRooms((v:Room[])=>v.map(r=>r.number===b.room?{...r,status:"Dirty",guest:undefined}:r)); notify("Checked out · room marked Dirty");
    }
  }
  return <section className="content"><SectionHead title="Reservations" text="Manage arrivals, in-house stays, balances and departures."/>
    <div className="tablecard"><table><thead><tr>{["Booking","Guest","Room","Dates","Source","Status","Total","Balance","Action"].map(x=><th key={x}>{x}</th>)}</tr></thead><tbody>{bookings.map(b=><tr key={b.id}><td className="mono">{b.id}</td><td><b>{b.guest}</b><small>{b.phone}</small></td><td>{b.room}</td><td>{b.checkIn}<small>to {b.checkOut}</small></td><td>{b.source}</td><td><span className="badge">{b.status}</span></td><td>{money(b.amount)}</td><td>{money(b.amount-b.paid)}</td><td>{b.status==="Confirmed"?<button className="mini" onClick={()=>action(b,"checkin")}>Check in</button>:b.status==="Checked-in"?<button className="mini" onClick={()=>action(b,"checkout")}>Check out</button>:"—"}</td></tr>)}</tbody></table></div>
  </section>
}

function Guests({bookings}:{bookings:Booking[]}) {
  const unique=Array.from(new Map(bookings.map(b=>[b.phone,b])).values());
  return <section className="content"><SectionHead title="Guest directory" text="Searchable stay history for repeat guests and preferences."/><div className="cards3">{unique.map((g,i)=><div className="profilecard" key={g.phone}><div className="guestavatar">{g.guest.split(" ").map(x=>x[0]).join("").slice(0,2)}</div><h3>{g.guest}</h3><p>{g.phone}</p><div className="profilemeta"><span>Last room <b>{g.room}</b></span><span>Total spend <b>{money(g.amount)}</b></span></div>{i===0&&<span className="vip">Repeat guest</span>}</div>)}</div></section>
}

function Housekeeping({tasks,setTasks,rooms,setRooms,notify}:{tasks:Task[];setTasks:any;rooms:Room[];setRooms:any;notify:(x:string)=>void}) {
  function advance(t:Task){
    const next=t.status==="Dirty"||t.status==="Pending"?"Cleaning":t.status==="Cleaning"?"Done":"Done";
    setTasks((v:Task[])=>v.map(x=>x.id===t.id?{...x,status:next}:x));
    if(next==="Done")setRooms((v:Room[])=>v.map(r=>r.number===t.room?{...r,status:"Available"}:r));
    notify(next==="Done"?`Room ${t.room} ready for sale`:`Room ${t.room} cleaning started`);
  }
  return <section className="content"><SectionHead title="Housekeeping" text="Mobile-friendly task board for room turnaround."/><div className="kanban">{["Pending","Dirty","Cleaning","Done"].map(s=><div className="lane" key={s}><div className="lanehead">{s}<b>{tasks.filter(t=>t.status===s).length}</b></div>{tasks.filter(t=>t.status===s).map(t=><div className="hkcard" key={t.id}><span className="priority">{t.priority}</span><h2>Room {t.room}</h2><p>Assigned to {t.assignee}</p>{s!=="Done"&&<button className="mini" onClick={()=>advance(t)}>{s==="Cleaning"?"Mark clean":"Start cleaning"}</button>}</div>)}</div>)}</div></section>
}

function Maintenance({rooms,changeRoomStatus}:{rooms:Room[];changeRoomStatus:(n:string,s:RoomStatus)=>void}) {
  const bad=rooms.filter(r=>r.status==="Out of Order");
  return <section className="content"><SectionHead title="Maintenance" text="Track room-impacting issues and block inventory safely."/><div className="dashgrid"><Card title="Open tickets">{bad.length?bad.map(r=><div className="ticket" key={r.number}><div><b>Room {r.number} · Electrical inspection</b><span>High priority · opened today</span></div><button className="mini" onClick={()=>changeRoomStatus(r.number,"Dirty")}>Resolve</button></div>):<Empty text="No open maintenance tickets"/>}</Card><Card title="Preventive checklist"><Checklist items={["Water pressure & hot water","Electrical points & lighting","Wi-Fi and TV","Door lock & safety","Bathroom fittings"]}/></Card></div></section>
}

function Billing({bookings}:{bookings:Booking[]}) {
 return <section className="content"><SectionHead title="Guest folios & billing" text="Room charges, taxes, payments and receivables in one place."/>
 <div className="metrics"><Metric label="Gross folios" value={money(bookings.reduce((s,b)=>s+b.amount,0))} sub="Current sample period"/><Metric label="Collected" value={money(bookings.reduce((s,b)=>s+b.paid,0))} sub="Cash / UPI / OTA"/><Metric label="Receivable" value={money(bookings.reduce((s,b)=>s+(b.amount-b.paid),0))} sub="Open guest balances"/><Metric label="GST-ready" value="Invoice" sub="CGST / SGST configurable"/></div>
 <div className="tablecard"><Table headers={["Invoice","Guest","Room","Gross","Paid","Due","Status"]} rows={bookings.map((b,i)=>[`INV-26-${101+i}`,b.guest,b.room,money(b.amount),money(b.paid),money(b.amount-b.paid),b.amount===b.paid?"Paid":"Open"])}/></div></section>
}

function Expenses({expenses}:{expenses:Expense[]}) {
 const total=expenses.reduce((s,e)=>s+e.amount,0); return <section className="content"><SectionHead title="Expenses & petty cash" text="Daily operating spend with category and payment-mode visibility."/><div className="metrics"><Metric label="Recorded spend" value={money(total)} sub="Current sample"/><Metric label="Cash spend" value={money(expenses.filter(e=>e.mode==="Cash").reduce((s,e)=>s+e.amount,0))} sub="Petty cash"/><Metric label="Digital spend" value={money(expenses.filter(e=>e.mode!=="Cash").reduce((s,e)=>s+e.amount,0))} sub="UPI / Bank / Card"/><Metric label="Entries" value={String(expenses.length)} sub="Auditable transactions"/></div><div className="tablecard"><Table headers={["Date","Category","Vendor","Mode","Note","Amount"]} rows={expenses.map(e=>[e.date,e.category,e.vendor,e.mode,e.note,money(e.amount)])}/></div></section>
}

function Reports({bookings,expenses,rooms}:{bookings:Booking[];expenses:Expense[];rooms:Room[]}) {
 const gross=bookings.reduce((s,b)=>s+b.amount,0); const spend=expenses.reduce((s,e)=>s+e.amount,0);
 return <section className="content"><SectionHead title="Management reports" text="Operational reporting for daily decisions and month-end review."/><div className="cards3">
 {["Daily Manager Report","Occupancy & ADR","Revenue & Collections","Outstanding Receivables","Booking Source Mix","GST / Tax Summary","Expense Analysis","Night Audit History","Room Productivity"].map((r,i)=><div className="reportcard" key={r}><span>{String(i+1).padStart(2,"0")}</span><h3>{r}</h3><p>{i===0?`Gross ${money(gross)} · Net before costs ${money(gross-spend)}`:i===1?`${rooms.filter(x=>x.status==="Occupied").length} occupied of ${rooms.length} rooms`:"Date filters · Print · CSV export"}</p><button className="mini" onClick={()=>window.print()}>Open / Print</button></div>)}</div></section>
}

function NightAudit({bookings,rooms}:{bookings:Booking[];rooms:Room[]}) {
 const open=bookings.filter(b=>b.amount>b.paid&&b.status!=="Checked-out");
 return <section className="content"><SectionHead title="Night Audit" text="Close the business day only after exceptions are reviewed."/><div className="auditbox"><div className="audithead"><div><span className="pill">BUSINESS DAY</span><h2>01 October 2026</h2></div><button className="primary" onClick={()=>alert("Night audit review complete. In production this will lock the business day and create an audit snapshot.")}>Close business day</button></div><Checklist items={[rooms.filter(r=>r.status==="Occupied").length+" occupied rooms reconciled",open.length+" open folios require review",rooms.filter(r=>r.status==="Dirty").length+" dirty rooms carried to housekeeping","OTA & direct collections reviewed","Cash drawer counted and handed over"]}/></div></section>
}

function Staff(){return <section className="content"><SectionHead title="Staff & shifts" text="Operational roles, contact details and handover notes."/><div className="cards3">{[["Front Desk","Aisha Kharshiing","Evening · On duty"],["Housekeeping","Mary Nongrum","Floor 1 & 3"],["Housekeeping","Bina Marbaniang","Floor 2"],["Manager","R. Lyngdoh","Property manager"],["Maintenance","Daniel K.","On call"]].map(s=><div className="profilecard" key={s[1]}><div className="guestavatar">{s[1].split(" ").map(x=>x[0]).join("").slice(0,2)}</div><h3>{s[1]}</h3><p>{s[0]}</p><span className="vip">{s[2]}</span></div>)}</div><div className="notebox"><b>Shift handover</b><textarea defaultValue="Room 304 remains out of order. Follow up electrical inspection. Guest in 302 has late checkout approved until 13:00. Room 103 must be ready before 11:30 arrival."/></div></section>}

function Settings(){return <section className="content"><SectionHead title="Hotel settings" text="Core property, billing and operational configuration."/><div className="settingsgrid"><Card title="Property profile"><SettingsRow k="Property" v="La Shimti Hotel"/><SettingsRow k="City" v="Shillong, Meghalaya"/><SettingsRow k="Currency" v="INR (₹)"/><SettingsRow k="Check-in" v="12:00 PM"/><SettingsRow k="Check-out" v="11:00 AM"/></Card><Card title="Billing"><SettingsRow k="Invoice prefix" v="LSH"/><SettingsRow k="GST" v="Configurable CGST + SGST"/><SettingsRow k="SAC" v="996311"/><SettingsRow k="Payment methods" v="Cash · UPI · Card · Bank · OTA"/></Card><Card title="Integrations"><SettingsRow k="WhatsApp" v="Not connected"/><SettingsRow k="Email" v="Not connected"/><SettingsRow k="Payment gateway" v="Not connected"/><SettingsRow k="OTA channel manager" v="Phase 2"/></Card><Card title="Access roles"><SettingsRow k="Owner / Admin" v="Full access"/><SettingsRow k="Front Desk" v="Bookings · Rooms · Billing"/><SettingsRow k="Housekeeping" v="Room tasks only"/><SettingsRow k="Accounts" v="Billing · Expenses · Reports"/></Card></div></section>}

function MiniRoomBoard({rooms}:{rooms:Room[]}){return <div className="miniboard">{rooms.map(r=><div key={r.number} title={r.status} className={"miniroom "+r.status.toLowerCase().replaceAll(" ","-")}><b>{r.number}</b><span>{r.status}</span></div>)}</div>}
function Metric({label,value,sub,warn}:{label:string;value:string;sub:string;warn?:boolean}){return <div className={"metric "+(warn?"warn":"")}><span>{label}</span><strong>{value}</strong><small>{sub}</small></div>}
function Card({title,children,action,onAction}:{title:string;children:React.ReactNode;action?:string;onAction?:()=>void}){return <div className="card"><div className="cardhead"><h3>{title}</h3>{action&&<button onClick={onAction}>{action} →</button>}</div>{children}</div>}
function Timeline({n,title,text}:{n:number;title:string;text:string}){return <div className="timelineitem"><div className="timenum">{n}</div><div><b>{title}</b><span>{text}</span></div></div>}
function Table({headers,rows}:{headers:string[];rows:(string|number)[][]}){return <div className="tablewrap"><table><thead><tr>{headers.map(h=><th key={h}>{h}</th>)}</tr></thead><tbody>{rows.map((r,i)=><tr key={i}>{r.map((c,j)=><td key={j}>{c}</td>)}</tr>)}</tbody></table></div>}
function SectionHead({title,text}:{title:string;text:string}){return <div className="sectionhead"><div><h2>{title}</h2><p>{text}</p></div></div>}
function Modal({title,onClose,children}:{title:string;onClose:()=>void;children:React.ReactNode}){return <div className="modalback" onMouseDown={onClose}><div className="modal" onMouseDown={e=>e.stopPropagation()}><div className="modalhead"><h2>{title}</h2><button onClick={onClose}>×</button></div>{children}</div></div>}
function Empty({text}:{text:string}){return <div className="empty">{text}</div>}
function Checklist({items}:{items:string[]}){return <div className="checklist">{items.map(x=><label key={x}><input type="checkbox"/><span>{x}</span></label>)}</div>}
function SettingsRow({k,v}:{k:string;v:string}){return <div className="settingrow"><span>{k}</span><b>{v}</b></div>}
