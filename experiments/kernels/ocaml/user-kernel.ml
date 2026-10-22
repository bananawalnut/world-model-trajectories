(* Volume and density are fractions: (numerator, denominator), using Z.t
   arbitrary-precision integers. Result is kilograms; None means unsupported.
   This example agrees with the reference calculation. Edit it to explore
   a different model, for example multiply the numerator by Z.of_int 2. *)
let user_mass (vn, vd) (dn, dd) =
  if Z.sign vd <= 0 || Z.sign dd <= 0 || Z.sign vn < 0 || Z.sign dn < 0
  then None
  else Some (Z.mul vn dn, Z.mul (Z.mul vd dd) (Z.of_int 1000))
;;

(* This policy is separate from object identity. It is exact fraction
   comparison by default; another policy could implement a tolerance. *)
let user_equals (an, ad) (bn, bd) =
  Z.equal (Z.mul an bd) (Z.mul bn ad)
;;
