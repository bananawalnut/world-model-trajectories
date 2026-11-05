/* Classic worker, fresh compiler/toplevel for each explicitly requested run. */
const quote=s=>'"'+Array.from(new TextEncoder().encode(s),n=>'\\'+String(n).padStart(3,'0')).join('')+'"';
function value(x){
 if(x===null)return 'Null';if(typeof x==='boolean')return `Bool ${x}`;
 if(typeof x==='number')return `Number ${quote(String(x))}`;
 if(typeof x==='string')return `String ${quote(x)}`;
 if(Array.isArray(x))return 'Array ['+x.map(x=>'('+value(x)+')').join(';')+']';
 return 'Object ['+Object.entries(x).map(([k,v])=>'('+quote(k)+',('+value(v)+'))').join(';')+']';
}
const prelude=String.raw`
module Wmt_Paper_Kernel = struct
 type json = Null | Bool of bool | Number of string | String of string
           | Array of json list | Object of (string * json) list
 let field key = function Object xs -> List.assoc key xs | _ -> failwith "Expected object"
 let number = function Number n -> float_of_string n | _ -> failwith "Expected number"
 let text = function String s -> s | _ -> failwith "Expected string"
 let array = function Array xs -> xs | _ -> failwith "Expected array"
 let boolean = function Bool b -> b | _ -> failwith "Expected boolean"
 let quote s =
  let b=Buffer.create (String.length s+2) in Buffer.add_char b '"';
  String.iter (fun c -> match c with
   | '"' -> Buffer.add_string b "\\\"" | '\\' -> Buffer.add_string b "\\\\"
   | c when Char.code c < 32 -> Buffer.add_string b (Printf.sprintf "\\u%04x" (Char.code c))
   | c -> Buffer.add_char b c) s;
  Buffer.add_char b '"'; Buffer.contents b
 let rec json = function
  | Null -> "null" | Bool true -> "true" | Bool false -> "false"
  | Number s -> s | String s -> quote s
  | Array xs -> "[" ^ String.concat "," (List.map json xs) ^ "]"
  | Object xs -> "{" ^ String.concat "," (List.map (fun (k,v)->quote k ^ ":" ^ json v) xs) ^ "}"
end;;
open Wmt_Paper_Kernel;;
`;
self.onmessage=async({data})=>{
 try{
  // wasm_of_ocaml's committed worker runtime fetches its assets relative to
  // the worker URL. This SDK worker may be hosted separately from that build.
  const fetchAsset=self.fetch.bind(self),assetBase=new URL('.',data.runtimeScriptURL);
  self.fetch=(input,options)=>fetchAsset(typeof input==='string'?new URL(input,assetBase):input,options);
  importScripts(data.runtimeScriptURL);
  const start=Date.now();while(!self.wmtOCaml){if(Date.now()-start>15000)throw new Error('OCaml runtime did not initialize.');await new Promise(r=>setTimeout(r,20));}
  const evaluate=source=>{const r=self.wmtOCaml.evaluate(source+'\n;;\n');if(!r.ok)throw new Error(r.errors||'OCaml compile/execution failed.');return r.output;};
  for(const source of data.libraries)evaluate(source);
  evaluate(prelude);evaluate(data.source);
  const request=value({inputs:data.inputs,claims:data.claims});
  const output=evaluate(`let () = print_endline ("WMT_PAPER_RESULT:" ^ Wmt_Paper_Kernel.json ((run : Wmt_Paper_Kernel.json -> Wmt_Paper_Kernel.json) (${request})));;`);
  const lines=output.split('\n').filter(x=>x.startsWith('WMT_PAPER_RESULT:'));
  if(lines.length!==1)throw new Error('Kernel must return one JSON result.');
  if(lines[0].length>200020)throw new Error('Kernel output exceeds the byte budget.');
  self.postMessage({ok:true,output:JSON.parse(lines[0].slice('WMT_PAPER_RESULT:'.length))});
 }catch(e){self.postMessage({ok:false,error:String(e.message??e)});}
};
