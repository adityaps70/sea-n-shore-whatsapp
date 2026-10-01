"use client";
import { FormEvent, useState } from "react";
import { useParams } from "next/navigation";

export default function PrecheckinPage(){
  const params=useParams<{token:string}>();
  const [message,setMessage]=useState("");
  const [done,setDone]=useState(false);
  const [loading,setLoading]=useState(false);

  async function submit(e:FormEvent<HTMLFormElement>){
    e.preventDefault();setLoading(true);setMessage("");
    const f=new FormData(e.currentTarget);
    try{
      const r=await fetch("/api/precheckin",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({
        token:params.token,
        email:String(f.get("email")||""),
        address:String(f.get("address")||""),
        nationality:String(f.get("nationality")||"Indian"),
        idType:String(f.get("idType")||""),
        idNumber:String(f.get("idNumber")||""),
      })});
      const d=await r.json();
      if(!r.ok||!d.ok) throw new Error(d.error||"Pre-check-in failed");
      setDone(true);setMessage("Pre-check-in completed for "+d.result.booking_no+". Thank you.");
    }catch(err){setMessage(err instanceof Error?err.message:"Unable to complete pre-check-in")}finally{setLoading(false)}
  }

  return <main className="guestpage">
    <section className="guesthero"><span className="eyebrow">LA SHIMTI HOTEL · SHILLONG</span><h1>Complete your pre-check-in.</h1><p>Share the details needed by the front desk before you arrive.</p></section>
    {done?<div className="guestform"><div className="guestmessage">{message}</div></div>:
    <form className="guestform" onSubmit={submit}>
      <div className="formgrid">
        <label>Email<input name="email" type="email" placeholder="you@example.com"/></label>
        <label>Nationality<input name="nationality" defaultValue="Indian"/></label>
        <label className="span2">Address<input name="address" placeholder="Residential address"/></label>
        <label>ID type<select name="idType"><option value="">Select</option><option>Aadhaar</option><option>Passport</option><option>Driving Licence</option><option>Voter ID</option><option>Other</option></select></label>
        <label>ID number<input name="idNumber" placeholder="Document number"/></label>
      </div>
      <button className="primary guestsubmit" disabled={loading}>{loading?"Saving…":"Complete pre-check-in"}</button>
      {message&&<div className="guestmessage">{message}</div>}
      <small>Your information is attached to your La Shimti reservation for front-desk processing.</small>
    </form>}
  </main>
}