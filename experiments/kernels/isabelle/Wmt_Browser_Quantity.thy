theory Wmt_Browser_Quantity
  imports "Veri7vn_Quantity.Quantity_Export"
begin

text \<open>A small typed boundary around the existing quantity kernel. The
  request is constructed here, not recognized from English. Material IDs are
  local to this experiment: 0 water, 1 steel, 2 petrol. Values are exact
  fractions; volume is in litres and the result is in kilograms.\<close>

definition browser_material :: "integer \<Rightarrow> material option" where
  "browser_material m = (if m = 0 then Some M_water else
    if m = 1 then Some M_steel else if m = 2 then Some M_petrol else None)"

definition browser_fraction :: "rat \<Rightarrow> integer \<times> integer" where
  "browser_fraction r = (case quotient_of r of (n, d) \<Rightarrow>
    (integer_of_int n, integer_of_int d))"

definition browser_density :: "integer \<Rightarrow> (integer \<times> integer) option" where
  "browser_density m = map_option (browser_fraction \<circ> density) (browser_material m)"

definition browser_mass :: "integer \<Rightarrow> integer \<Rightarrow> integer
    \<Rightarrow> (integer \<times> integer) option" where
  "browser_mass m n d = (if d \<le> 0 \<or> n < 0 then None else
    case browser_material m of None \<Rightarrow> None | Some material \<Rightarrow>
      case kernel (MassOf material (Some (mk_rat n d, U_litre)) U_kilogram) of
        Exact K_mass value \<Rightarrow> Some (browser_fraction value)
      | _ \<Rightarrow> None)"

text \<open>The upstream mass theorem, unchanged, connects this computation to
  dimensions and the mass/density/volume equation. The outer JSON and OCaml
  interfaces are tested code, not new formally verified components.\<close>

export_code browser_mass browser_density in OCaml
  module_name Wmt_Quantity file_prefix wmt_quantity

ML \<open>
  val theorems = [@{thm mass_from_volume}, @{thm kernel_exact_sound}];
  val _ = if null (Thm_Deps.all_oracles theorems) then ()
    else error "upstream mass theorems use oracles";
  val _ = writeln "WMT_BROWSER_QUANTITY PASS oracles=0";
\<close>

end
