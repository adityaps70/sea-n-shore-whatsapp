import { NextRequest, NextResponse } from "next/server";
import { getVercelOidcToken } from "@vercel/oidc";

const EDGE_URL="https://eamdiqtzbzkkdxvhxdqy.supabase.co/functions/v1/la-shimti-pms";

async function callPms(payload:Record<string,unknown>){
  const token=await getVercelOidcToken({project:"prj_sa7LIUoo5nRHcwpaaR13Hp4OVfCo",team:"team_w3XOKcTFgBNWgaRvkcVL0P90"});
  if(!token) throw new Error("Booking service identity unavailable");
  const response=await fetch(EDGE_URL,{method:"POST",headers:{"x-vercel-oidc-token":token,"content-type":"application/json"},body:JSON.stringify(payload),cache:"no-store"});
  const data=await response.json();
  if(!response.ok||!data.ok) throw new Error(data.error||"Booking request failed");
  return data.result;
}

export async function POST(req:NextRequest){
  try{
    const body=await req.json();
    const required=["guest","phone","room","checkIn","checkOut"];
    for(const key of required){if(!String(body[key]||"").trim()) return NextResponse.json({ok:false,error:key+" is required"},{status:400});}
    const result=await callPms({action:"createReservation",guest:body.guest,phone:body.phone,room:body.room,checkIn:body.checkIn,checkOut:body.checkOut,source:"Direct Website",nightlyRate:Number(body.nightlyRate||0)||null,advance:0,actor:"Direct Booking Engine"});
    return NextResponse.json({ok:true,result});
  }catch(error){return NextResponse.json({ok:false,error:error instanceof Error?error.message:"Booking failed"},{status:400});}
}
