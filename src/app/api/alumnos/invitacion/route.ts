import {NextResponse} from "next/server";
import {studentAdmin} from "@/lib/students/server";
import {productConfig} from "@/lib/product-auth/server";
import {inviteStudent} from "@/lib/student-invitation/server";
export async function POST(req:Request){
 const cfg=productConfig();if(!cfg)return new Response(null,{status:404});
 if(req.headers.get("origin")!==cfg.origin)return new Response(null,{status:403});
 if(!req.headers.get("content-type")?.startsWith("application/json"))return new Response(null,{status:415});
 const client=await studentAdmin();if(!client)return new Response(null,{status:403});
 const reader=req.body?.getReader();let size=0;const chunks:Uint8Array[]=[];if(!reader)return new Response(null,{status:400});
 while(true){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>256){await reader.cancel();return new Response(null,{status:413});}chunks.push(value);}
 let id;try{id=JSON.parse(new TextDecoder().decode(Buffer.concat(chunks))).id;}catch{return new Response(null,{status:400});}
 if(typeof id!=="string"||!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id))return new Response(null,{status:400});
 return NextResponse.json(await inviteStudent(client,id),{headers:{"Cache-Control":"no-store"}});
}
