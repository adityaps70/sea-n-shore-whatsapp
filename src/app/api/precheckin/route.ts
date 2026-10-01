import { NextRequest, NextResponse } from "next/server";
import { getVercelOidcToken } from "@vercel/oidc";

const EDGE_URL="https://eamdiqtzbzkkdxvhxdqy.supabase.co/functions/v1/la-shimti-pms";

export async function POST(req:NextRequest){
  try{
    const body=await req.json();
    const token=await getVercelOidcToken({project:"prj_sa7LIUoo5nRHcwpaaR13Hp4OVfCo",team:"team_w3XOKcTFgBNWgaRvkcVL0P90"});
    if(!token) throw new Error("Pre-check-in service unavailable");
    const r=await fetch(EDGE_URL,{method:"POST",headers:{"x-vercel-oidc-token":token,"content-type":"application/json"},body:JSON.stringify({action:"completePrecheckin",...body}),cache:"no-store"});
    const d=await r.json();
    if(!r.ok||!d.ok) throw new Error(d.error||"Unable to complete pre-check-in");
    return NextResponse.json({ok:true,result:d.result});
  }catch(error){return NextResponse.json({ok:false,error:error instanceof Error?error.message:"Pre-check-in failed"},{status:400});}
}
