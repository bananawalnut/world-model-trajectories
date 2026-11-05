(* An editable OCaml toplevel in a browser worker. This framing and the
   serialization boundary are ordinary tested code, not Isabelle proofs. *)
open Js_of_ocaml

let output = Buffer.create 256

let evaluate source =
  Buffer.clear output;
  let errors = Buffer.create 256 in
  let fmt = Format.formatter_of_buffer errors in
  Location.formatter_for_warnings := fmt;
  let lexbuf = Lexing.from_string source in
  let rec loop () =
    try
      let phrase = !Toploop.parse_toplevel_phrase lexbuf in
      if Toploop.execute_phrase false fmt phrase then loop () else false
    with End_of_file -> true
  in
  let ok =
    try loop () with error -> Location.report_exception fmt error; false
  in
  flush stdout;
  Format.pp_print_flush fmt ();
  let result = object%js
    val ok = Js.bool ok
    val output = Js.string (Buffer.contents output)
    val errors = Js.string (Buffer.contents errors)
  end in
  result

let () =
  Js_of_ocaml_toplevel_common.JsooTop.initialize ();
  Sys_js.set_channel_flusher stdout (fun text -> Buffer.add_string output text);
  Js.export "wmtOCaml" (object%js
    method evaluate (source : Js.js_string Js.t) = evaluate (Js.to_string source)
  end)
