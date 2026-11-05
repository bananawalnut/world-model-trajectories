import {createSubmission,formalizeSubmission} from '../sdk/index.mjs';
export const exampleKernelSource=`open Wmt_Paper_Kernel;;
let run request =
  let inputs = field "inputs" request in
  Bool (number (field "measured" inputs) >= number (field "minimum" inputs))
;;`;
export const referenceKernelSource=`open Wmt_Paper_Kernel;;
(* This calls the pinned Isabelle-exported quantity module. *)
let run request =
  let inputs = field "inputs" request in
  let litres = Z.of_string (text (field "litres" inputs)) in
  match Wmt_Quantity.browser_mass (Z.of_int 0) litres Z.one with
  | None -> Null
  | Some (n,d) -> Object ["kilograms", Array [String (Z.to_string n); String (Z.to_string d)]]
;;`;
export const embeddingKernelSource=`open Wmt_Paper_Kernel;;
let vector x = List.map number (array x);;
let run request =
  let inputs = field "inputs" request in
  let left_space = field "leftSpace" inputs and right_space = field "rightSpace" inputs in
  if not (List.for_all (fun key -> field key left_space = field key right_space)
    ["model"; "revision"; "preprocessing"; "dimension"; "normalization"])
  then failwith "Embedding spaces must match (model, revision, preprocessing, dimension, normalization)";
  let a = vector (field "left" inputs) and b = vector (field "right" inputs) in
  if List.length a <> List.length b || a = [] then failwith "Incompatible dimensions";
  if number (field "dimension" left_space) <> float_of_int (List.length a)
  then failwith "Embedding dimension metadata mismatch";
  let dot = List.fold_left2 (fun n x y -> n +. x *. y) 0. a b in
  let norm xs = sqrt (List.fold_left (fun n x -> n +. x *. x) 0. xs) in
  let denominator = norm a *. norm b in
  if denominator = 0. || not (Float.is_finite denominator && Float.is_finite dot)
  then failwith "Zero or nonfinite embedding norm";
  let threshold = number (field "threshold" inputs) in
  if threshold < -1. || threshold > 1. then failwith "Invalid cosine threshold";
  Bool (dot /. denominator >= threshold)
;;`;
export async function createKernelExampleSubmission(client,options={}){
 const line='The measured score of 100 meets the minimum score of 80.';
 const objects=['<< /Type /Catalog /Pages 2 0 R >>','<< /Type /Pages /Count 1 /Kids [3 0 R] >>','<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>','<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>'];
 const stream=`BT /F1 12 Tf 40 740 Td (${line}) Tj ET`;objects.push(`<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`);
 let pdf='%PDF-1.4\n';const offsets=[];for(const[i,o]of objects.entries()){offsets.push(pdf.length);pdf+=`${i+1} 0 obj\n${o}\nendobj\n`;}
 const start=pdf.length;pdf+=`xref\n0 6\n0000000000 65535 f \n`+offsets.map(n=>String(n).padStart(10,'0')+' 00000 n \n').join('')+`trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${start}\n%%EOF\n`;
 const paper=await createSubmission({bytes:new TextEncoder().encode(pdf),fileName:'synthetic-kernel-score.pdf',title:'Synthetic score computation',authors:['Public software fixture']},client,options);
 const source=paper.extraction.claims.find(c=>c.statement.includes('measured score'));
 return formalizeSubmission(paper,{parserId:'fixture.explicit-score/1',ir:{sorts:[],preds:[],funcs:[],claims:[{id:'c_score_threshold',source:source.statement,formula:{op:'cmp',rel:'>=',a:{t:'real',v:'100'},b:{t:'real',v:'80'}}}]},mappings:[{sourceClaimId:source.id,formalClaimIds:['c_score_threshold']}],unsupported:paper.extraction.claims.filter(c=>c.id!==source.id).map(c=>({sourceClaimId:c.id,reason:'Outside this synthetic computation example.'}))});
}
