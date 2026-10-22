(* Browser entity contract. These helpers are executed/tested, not proved. *)
module Wmt_Entity = struct
  type space = {model:string; revision:string; preprocessing:string;
                normalization:string; dimensions:int}
  type embedding = {space:space; values:float array}
  type value = Text of string | Number of float | Flag of bool | Embedding of embedding
  type entity = {id:string; schema:string; attributes:(string * value) list}
  type edge = {subject:string; predicate:string; object_id:string}
  type graph = {entities:entity list; edges:edge list}
  type outcome = Match | No_match | Unknown of string
  type comparison = {outcome:outcome; score:float option}

  let decision b = {outcome=(if b then Match else No_match); score=None}
  let unknown reason = {outcome=Unknown reason; score=None}
  let text e key = match List.assoc_opt key e.attributes with Some (Text x) -> Some x | _ -> None
  let number e key = match List.assoc_opt key e.attributes with Some (Number x) -> Some x | _ -> None
  let flag e key = match List.assoc_opt key e.attributes with Some (Flag x) -> Some x | _ -> None
  let embedding e key = match List.assoc_opt key e.attributes with Some (Embedding x) -> Some x | _ -> None
  let related graph a predicate b = List.exists (fun edge ->
    edge.subject = a.id && edge.predicate = predicate && edge.object_id = b.id) graph.edges
  let targets graph e predicate = List.filter_map (fun edge ->
    if edge.subject = e.id && edge.predicate = predicate then Some edge.object_id else None) graph.edges
  let finite x = match classify_float x with FP_nan | FP_infinite -> false | _ -> true
  let valid_embedding e = Array.length e.values = e.space.dimensions &&
    e.space.dimensions > 0 && Array.for_all finite e.values
  let same_space a b = a.model=b.model && a.revision=b.revision &&
    a.preprocessing=b.preprocessing && a.normalization=b.normalization && a.dimensions=b.dimensions

  (* Scale each vector first so finite extreme magnitudes do not overflow or
     underflow the norms. The score still uses ordinary binary64 arithmetic. *)
  let cosine ?(threshold=0.92) key a b =
    match embedding a key, embedding b key with
    | Some x, Some y ->
      if not (finite threshold) || threshold < -1. || threshold > 1. then unknown "Threshold must be finite and between -1 and 1"
      else if not (valid_embedding x && valid_embedding y) then unknown "Invalid vector dimensions or values"
      else if not (same_space x.space y.space) then unknown "Incompatible embedding spaces (model, revision, preprocessing, normalization or dimensions)"
      else
        let scale v = Array.fold_left (fun acc x -> max acc (abs_float x)) 0. v in
        let sx = scale x.values and sy = scale y.values in
        if sx = 0. || sy = 0. then unknown "Cosine is undefined for a zero vector"
        else
          let dot = ref 0. and nx = ref 0. and ny = ref 0. in
          Array.iteri (fun i vx -> let ax = vx /. sx and by = y.values.(i) /. sy in
            dot := !dot +. ax *. by; nx := !nx +. ax *. ax; ny := !ny +. by *. by) x.values;
          let score = max (-1.) (min 1. (!dot /. (sqrt !nx *. sqrt !ny))) in
          {outcome=(if score >= threshold then Match else No_match); score=Some score}
    | _ -> unknown ("Missing embedding field: " ^ key)

  let exact_embedding key a b = match embedding a key, embedding b key with
    | Some x, Some y when valid_embedding x && valid_embedding y ->
      if same_space x.space y.space then decision (x.values = y.values)
      else unknown "Incompatible embedding spaces"
    | _ -> unknown ("Missing or invalid embedding field: " ^ key)

  let json_string s =
    let buf = Buffer.create (String.length s + 2) in
    Buffer.add_char buf '"';
    String.iter (fun c -> match c with
      | '"' -> Buffer.add_string buf "\\\""
      | '\\' -> Buffer.add_string buf "\\\\"
      | c when Char.code c < 32 -> Buffer.add_string buf (Printf.sprintf "\\u%04x" (Char.code c))
      | c -> Buffer.add_char buf c) s;
    Buffer.add_char buf '"'; Buffer.contents buf
  let emit result =
    let status, reason = match result.outcome with
      | Match -> "match", "null" | No_match -> "no-match", "null"
      | Unknown reason -> "unknown", json_string reason in
    let score = match result.score with None -> "null"
      | Some x when finite x -> Printf.sprintf "%.17g" x
      | Some _ -> failwith "Comparator returned a non-finite score" in
    print_endline ("WMT_ENTITY_RESULT:{\"status\":" ^ json_string status ^
      ",\"reason\":" ^ reason ^ ",\"score\":" ^ score ^ "}")
end;;
