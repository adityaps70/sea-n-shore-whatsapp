"use client";
import { FormEvent, useEffect, useState } from "react";

type Room={number:string;type:string;rate:number;status:string};

export default function BookPage(){
  const [rooms,setRooms]=useState<Room[]>([]);
  const [message,setMessage]=useState("");
  const [loading,setLoading]=useState(false);

  useEffect(()=>{fetch("/api/pms").then(r=>r.json()).then(d=>setRooms((d.rooms||[]).filter((x:Room)=>!["Out of Order","Maintenance","Occupied"].includes(x.status)))).catch(()=>{})},[]);

  async function submit(e:FormEvent<HTMLFormElement>){
    e.preventDefault();setLoading(true);setMessage("");
    const f=new FormData(e.currentTarget);
    const body=Object.fromEntries(f.entries());
    const room=rooms.find(r=>r.number===body.room);
    try{
      const r=await fetch("/api/public-booking",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({...body,nightlyRate:room?.rate||0})});
      const d=await r.json();
      if(!r.ok||!d.ok) throw new Error(d.error||"Booking failed");
      setMessage("Booking confirmed · "+d.result.booking_no+". La Shimti will contact you on the number provided.");
      e.currentTarget.reset();
    }catch(err){setMessage(err instanceof Error?err.message:"Booking failed")}finally{setLoading(false)}
  }

  return <main className="guestpage">
    <section className="guesthero"><span className="eyebrow">LA SHIMTI HOTEL · SHILLONG</span><h1>Book your stay directly.</h1><p>Simple direct booking with live room validation and no unnecessary booking layers.</p></section>
    <form className="guestform" onSubmit={submit}>
      <div className="formgrid">
        <label className="span2">Guest name<input name="guest" required placeholder="Full name"/></label>
        <label>Phone<input name="phone" required placeholder="+91"/></label>
        <label>Room<select name="room" required>{rooms.map(r=><option key={r.number} value={r.number}>{r.type} · Room {r.number} · ₹{r.rate}/night</option>)}</select></label>
        <label>Check-in<input name="checkIn" type="date" required/></label>
        <label>Check-out<input name="checkOut" type="date" required/></label>
      </div>
      <button className="primary guestsubmit" disabled={loading}>{loading?"Checking availability…":"Confirm direct booking"}</button>
      {message&&<div className="guestmessage">{message}</div>}
      <small>Room availability is revalidated when you submit. If another reservation overlaps, the booking is rejected automatically.</small>
    </form>
  </main>
}