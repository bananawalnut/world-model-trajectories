module Wmt_Quantity : sig
  type int
  type rat
  type kind
  type qunit
  type decline
  type outcome
  type material
  type request
  val browser_mass : Z.t -> Z.t -> Z.t -> (Z.t * Z.t) option
  val browser_density : Z.t -> (Z.t * Z.t) option
end = struct

type int = Int_of_integer of Z.t;;

type num = One | Bit0 of num | Bit1 of num;;

let one_inta : int = Int_of_integer (Z.of_int 1);;

type 'a one = {one : 'a};;
let one _A = _A.one;;

let one_int = ({one = one_inta} : int one);;

let rec integer_of_int (Int_of_integer k) = k;;

let rec times_inta
  k l = Int_of_integer (Z.mul (integer_of_int k) (integer_of_int l));;

type 'a times = {times : 'a -> 'a -> 'a};;
let times _A = _A.times;;

type 'a power = {one_power : 'a one; times_power : 'a times};;

let times_int = ({times = times_inta} : int times);;

let power_int = ({one_power = one_int; times_power = times_int} : int power);;

type nat = Nat of Z.t;;

let rec integer_of_nat (Nat x) = x;;

let rec equal_nata m n = Z.equal (integer_of_nat m) (integer_of_nat n);;

type 'a equal = {equal : 'a -> 'a -> bool};;
let equal _A = _A.equal;;

let equal_nat = ({equal = equal_nata} : nat equal);;

let rec times_nata m n = Nat (Z.mul (integer_of_nat m) (integer_of_nat n));;

type 'a dvd = {times_dvd : 'a times};;

let times_nat = ({times = times_nata} : nat times);;

let dvd_nat = ({times_dvd = times_nat} : nat dvd);;

let one_nata : nat = Nat (Z.of_int 1);;

let one_nat = ({one = one_nata} : nat one);;

let rec plus_nata m n = Nat (Z.add (integer_of_nat m) (integer_of_nat n));;

type 'a plus = {plus : 'a -> 'a -> 'a};;
let plus _A = _A.plus;;

let plus_nat = ({plus = plus_nata} : nat plus);;

let zero_nata : nat = Nat Z.zero;;

type 'a zero = {zero : 'a};;
let zero _A = _A.zero;;

let zero_nat = ({zero = zero_nata} : nat zero);;

type 'a semigroup_add = {plus_semigroup_add : 'a plus};;

type 'a numeral =
  {one_numeral : 'a one; semigroup_add_numeral : 'a semigroup_add};;

let semigroup_add_nat = ({plus_semigroup_add = plus_nat} : nat semigroup_add);;

let numeral_nat =
  ({one_numeral = one_nat; semigroup_add_numeral = semigroup_add_nat} :
    nat numeral);;

let power_nat = ({one_power = one_nat; times_power = times_nat} : nat power);;

type 'a ord = {less_eq : 'a -> 'a -> bool; less : 'a -> 'a -> bool};;
let less_eq _A = _A.less_eq;;
let less _A = _A.less;;

let rec max _A a b = (if less_eq _A a b then b else a);;

let ord_integer = ({less_eq = Z.leq; less = Z.lt} : Z.t ord);;

let rec minus_nata
  m n = Nat (max ord_integer Z.zero
              (Z.sub (integer_of_nat m) (integer_of_nat n)));;

type 'a minus = {minus : 'a -> 'a -> 'a};;
let minus _A = _A.minus;;

let minus_nat = ({minus = minus_nata} : nat minus);;

let rec apsnd f (x, y) = (x, f y);;

let rec divmod_integer
  k l = (if Z.equal k Z.zero then (Z.zero, Z.zero)
          else (if Z.lt Z.zero l
                 then (if Z.lt Z.zero k
                        then (fun k l -> if Z.equal Z.zero l then
                               (Z.zero, l) else Z.div_rem (Z.abs k) (Z.abs l))
                               k l
                        else (let (r, s) =
                                (fun k l -> if Z.equal Z.zero l then
                                  (Z.zero, l) else Z.div_rem (Z.abs k)
                                  (Z.abs l))
                                  k l
                                in
                               (if Z.equal s Z.zero then (Z.neg r, Z.zero)
                                 else (Z.sub (Z.neg r) (Z.of_int 1),
Z.sub l s))))
                 else (if Z.equal l Z.zero then (Z.zero, k)
                        else apsnd Z.neg
                               (if Z.lt k Z.zero
                                 then (fun k l -> if Z.equal Z.zero l then
(Z.zero, l) else Z.div_rem (Z.abs k) (Z.abs l))
k l
                                 else (let (r, s) =
 (fun k l -> if Z.equal Z.zero l then (Z.zero, l) else Z.div_rem (Z.abs k)
   (Z.abs l))
   k l
 in
(if Z.equal s Z.zero then (Z.neg r, Z.zero)
  else (Z.sub (Z.neg r) (Z.of_int 1), Z.sub (Z.neg l) s)))))));;

let rec fst (x1, x2) = x1;;

let rec divide_integer k l = fst (divmod_integer k l);;

let rec divide_nata
  m n = Nat (divide_integer (integer_of_nat m) (integer_of_nat n));;

type 'a divide = {divide : 'a -> 'a -> 'a};;
let divide _A = _A.divide;;

let divide_nat = ({divide = divide_nata} : nat divide);;

let rec snd (x1, x2) = x2;;

let rec modulo_integer k l = snd (divmod_integer k l);;

let rec modulo_nata
  m n = Nat (modulo_integer (integer_of_nat m) (integer_of_nat n));;

type 'a modulo =
  {divide_modulo : 'a divide; dvd_modulo : 'a dvd; modulo : 'a -> 'a -> 'a};;
let modulo _A = _A.modulo;;

let modulo_nat =
  ({divide_modulo = divide_nat; dvd_modulo = dvd_nat; modulo = modulo_nata} :
    nat modulo);;

let rec less_eq_nat m n = Z.leq (integer_of_nat m) (integer_of_nat n);;

let rec less_nat m n = Z.lt (integer_of_nat m) (integer_of_nat n);;

let ord_nat = ({less_eq = less_eq_nat; less = less_nat} : nat ord);;

type 'a ab_semigroup_add = {semigroup_add_ab_semigroup_add : 'a semigroup_add};;

type 'a monoid_add =
  {semigroup_add_monoid_add : 'a semigroup_add; zero_monoid_add : 'a zero};;

type 'a comm_monoid_add =
  {ab_semigroup_add_comm_monoid_add : 'a ab_semigroup_add;
    monoid_add_comm_monoid_add : 'a monoid_add};;

type 'a mult_zero = {times_mult_zero : 'a times; zero_mult_zero : 'a zero};;

type 'a semigroup_mult = {times_semigroup_mult : 'a times};;

type 'a semiring =
  {ab_semigroup_add_semiring : 'a ab_semigroup_add;
    semigroup_mult_semiring : 'a semigroup_mult};;

type 'a semiring_0 =
  {comm_monoid_add_semiring_0 : 'a comm_monoid_add;
    mult_zero_semiring_0 : 'a mult_zero; semiring_semiring_0 : 'a semiring};;

type 'a semiring_no_zero_divisors =
  {semiring_0_semiring_no_zero_divisors : 'a semiring_0};;

type 'a monoid_mult =
  {semigroup_mult_monoid_mult : 'a semigroup_mult;
    power_monoid_mult : 'a power};;

type 'a semiring_numeral =
  {monoid_mult_semiring_numeral : 'a monoid_mult;
    numeral_semiring_numeral : 'a numeral;
    semiring_semiring_numeral : 'a semiring};;

type 'a zero_neq_one =
  {one_zero_neq_one : 'a one; zero_zero_neq_one : 'a zero};;

type 'a semiring_1 =
  {semiring_numeral_semiring_1 : 'a semiring_numeral;
    semiring_0_semiring_1 : 'a semiring_0;
    zero_neq_one_semiring_1 : 'a zero_neq_one};;

type 'a semiring_1_no_zero_divisors =
  {semiring_1_semiring_1_no_zero_divisors : 'a semiring_1;
    semiring_no_zero_divisors_semiring_1_no_zero_divisors :
      'a semiring_no_zero_divisors};;

type 'a cancel_semigroup_add =
  {semigroup_add_cancel_semigroup_add : 'a semigroup_add};;

type 'a cancel_ab_semigroup_add =
  {ab_semigroup_add_cancel_ab_semigroup_add : 'a ab_semigroup_add;
    cancel_semigroup_add_cancel_ab_semigroup_add : 'a cancel_semigroup_add;
    minus_cancel_ab_semigroup_add : 'a minus};;

type 'a cancel_comm_monoid_add =
  {cancel_ab_semigroup_add_cancel_comm_monoid_add : 'a cancel_ab_semigroup_add;
    comm_monoid_add_cancel_comm_monoid_add : 'a comm_monoid_add};;

type 'a semiring_0_cancel =
  {cancel_comm_monoid_add_semiring_0_cancel : 'a cancel_comm_monoid_add;
    semiring_0_semiring_0_cancel : 'a semiring_0};;

type 'a ab_semigroup_mult =
  {semigroup_mult_ab_semigroup_mult : 'a semigroup_mult};;

type 'a comm_semiring =
  {ab_semigroup_mult_comm_semiring : 'a ab_semigroup_mult;
    semiring_comm_semiring : 'a semiring};;

type 'a comm_semiring_0 =
  {comm_semiring_comm_semiring_0 : 'a comm_semiring;
    semiring_0_comm_semiring_0 : 'a semiring_0};;

type 'a comm_semiring_0_cancel =
  {comm_semiring_0_comm_semiring_0_cancel : 'a comm_semiring_0;
    semiring_0_cancel_comm_semiring_0_cancel : 'a semiring_0_cancel};;

type 'a semiring_1_cancel =
  {semiring_0_cancel_semiring_1_cancel : 'a semiring_0_cancel;
    semiring_1_semiring_1_cancel : 'a semiring_1};;

type 'a comm_monoid_mult =
  {ab_semigroup_mult_comm_monoid_mult : 'a ab_semigroup_mult;
    monoid_mult_comm_monoid_mult : 'a monoid_mult;
    dvd_comm_monoid_mult : 'a dvd};;

type 'a comm_semiring_1 =
  {comm_monoid_mult_comm_semiring_1 : 'a comm_monoid_mult;
    comm_semiring_0_comm_semiring_1 : 'a comm_semiring_0;
    semiring_1_comm_semiring_1 : 'a semiring_1};;

type 'a comm_semiring_1_cancel =
  {comm_semiring_0_cancel_comm_semiring_1_cancel : 'a comm_semiring_0_cancel;
    comm_semiring_1_comm_semiring_1_cancel : 'a comm_semiring_1;
    semiring_1_cancel_comm_semiring_1_cancel : 'a semiring_1_cancel};;

type 'a semidom =
  {comm_semiring_1_cancel_semidom : 'a comm_semiring_1_cancel;
    semiring_1_no_zero_divisors_semidom : 'a semiring_1_no_zero_divisors};;

let ab_semigroup_add_nat =
  ({semigroup_add_ab_semigroup_add = semigroup_add_nat} :
    nat ab_semigroup_add);;

let monoid_add_nat =
  ({semigroup_add_monoid_add = semigroup_add_nat; zero_monoid_add = zero_nat} :
    nat monoid_add);;

let comm_monoid_add_nat =
  ({ab_semigroup_add_comm_monoid_add = ab_semigroup_add_nat;
     monoid_add_comm_monoid_add = monoid_add_nat}
    : nat comm_monoid_add);;

let mult_zero_nat =
  ({times_mult_zero = times_nat; zero_mult_zero = zero_nat} : nat mult_zero);;

let semigroup_mult_nat =
  ({times_semigroup_mult = times_nat} : nat semigroup_mult);;

let semiring_nat =
  ({ab_semigroup_add_semiring = ab_semigroup_add_nat;
     semigroup_mult_semiring = semigroup_mult_nat}
    : nat semiring);;

let semiring_0_nat =
  ({comm_monoid_add_semiring_0 = comm_monoid_add_nat;
     mult_zero_semiring_0 = mult_zero_nat; semiring_semiring_0 = semiring_nat}
    : nat semiring_0);;

let semiring_no_zero_divisors_nat =
  ({semiring_0_semiring_no_zero_divisors = semiring_0_nat} :
    nat semiring_no_zero_divisors);;

let monoid_mult_nat =
  ({semigroup_mult_monoid_mult = semigroup_mult_nat;
     power_monoid_mult = power_nat}
    : nat monoid_mult);;

let semiring_numeral_nat =
  ({monoid_mult_semiring_numeral = monoid_mult_nat;
     numeral_semiring_numeral = numeral_nat;
     semiring_semiring_numeral = semiring_nat}
    : nat semiring_numeral);;

let zero_neq_one_nat =
  ({one_zero_neq_one = one_nat; zero_zero_neq_one = zero_nat} :
    nat zero_neq_one);;

let semiring_1_nat =
  ({semiring_numeral_semiring_1 = semiring_numeral_nat;
     semiring_0_semiring_1 = semiring_0_nat;
     zero_neq_one_semiring_1 = zero_neq_one_nat}
    : nat semiring_1);;

let semiring_1_no_zero_divisors_nat =
  ({semiring_1_semiring_1_no_zero_divisors = semiring_1_nat;
     semiring_no_zero_divisors_semiring_1_no_zero_divisors =
       semiring_no_zero_divisors_nat}
    : nat semiring_1_no_zero_divisors);;

let cancel_semigroup_add_nat =
  ({semigroup_add_cancel_semigroup_add = semigroup_add_nat} :
    nat cancel_semigroup_add);;

let cancel_ab_semigroup_add_nat =
  ({ab_semigroup_add_cancel_ab_semigroup_add = ab_semigroup_add_nat;
     cancel_semigroup_add_cancel_ab_semigroup_add = cancel_semigroup_add_nat;
     minus_cancel_ab_semigroup_add = minus_nat}
    : nat cancel_ab_semigroup_add);;

let cancel_comm_monoid_add_nat =
  ({cancel_ab_semigroup_add_cancel_comm_monoid_add =
      cancel_ab_semigroup_add_nat;
     comm_monoid_add_cancel_comm_monoid_add = comm_monoid_add_nat}
    : nat cancel_comm_monoid_add);;

let semiring_0_cancel_nat =
  ({cancel_comm_monoid_add_semiring_0_cancel = cancel_comm_monoid_add_nat;
     semiring_0_semiring_0_cancel = semiring_0_nat}
    : nat semiring_0_cancel);;

let ab_semigroup_mult_nat =
  ({semigroup_mult_ab_semigroup_mult = semigroup_mult_nat} :
    nat ab_semigroup_mult);;

let comm_semiring_nat =
  ({ab_semigroup_mult_comm_semiring = ab_semigroup_mult_nat;
     semiring_comm_semiring = semiring_nat}
    : nat comm_semiring);;

let comm_semiring_0_nat =
  ({comm_semiring_comm_semiring_0 = comm_semiring_nat;
     semiring_0_comm_semiring_0 = semiring_0_nat}
    : nat comm_semiring_0);;

let comm_semiring_0_cancel_nat =
  ({comm_semiring_0_comm_semiring_0_cancel = comm_semiring_0_nat;
     semiring_0_cancel_comm_semiring_0_cancel = semiring_0_cancel_nat}
    : nat comm_semiring_0_cancel);;

let semiring_1_cancel_nat =
  ({semiring_0_cancel_semiring_1_cancel = semiring_0_cancel_nat;
     semiring_1_semiring_1_cancel = semiring_1_nat}
    : nat semiring_1_cancel);;

let comm_monoid_mult_nat =
  ({ab_semigroup_mult_comm_monoid_mult = ab_semigroup_mult_nat;
     monoid_mult_comm_monoid_mult = monoid_mult_nat;
     dvd_comm_monoid_mult = dvd_nat}
    : nat comm_monoid_mult);;

let comm_semiring_1_nat =
  ({comm_monoid_mult_comm_semiring_1 = comm_monoid_mult_nat;
     comm_semiring_0_comm_semiring_1 = comm_semiring_0_nat;
     semiring_1_comm_semiring_1 = semiring_1_nat}
    : nat comm_semiring_1);;

let comm_semiring_1_cancel_nat =
  ({comm_semiring_0_cancel_comm_semiring_1_cancel = comm_semiring_0_cancel_nat;
     comm_semiring_1_comm_semiring_1_cancel = comm_semiring_1_nat;
     semiring_1_cancel_comm_semiring_1_cancel = semiring_1_cancel_nat}
    : nat comm_semiring_1_cancel);;

let semidom_nat =
  ({comm_semiring_1_cancel_semidom = comm_semiring_1_cancel_nat;
     semiring_1_no_zero_divisors_semidom = semiring_1_no_zero_divisors_nat}
    : nat semidom);;

type 'a divide_trivial =
  {one_divide_trivial : 'a one; zero_divide_trivial : 'a zero;
    divide_divide_trivial : 'a divide};;

let divide_trivial_nat =
  ({one_divide_trivial = one_nat; zero_divide_trivial = zero_nat;
     divide_divide_trivial = divide_nat}
    : nat divide_trivial);;

type 'a semiring_no_zero_divisors_cancel =
  {semiring_no_zero_divisors_semiring_no_zero_divisors_cancel :
     'a semiring_no_zero_divisors};;

type 'a semidom_divide =
  {divide_trivial_semidom_divide : 'a divide_trivial;
    semidom_semidom_divide : 'a semidom;
    semiring_no_zero_divisors_cancel_semidom_divide :
      'a semiring_no_zero_divisors_cancel};;

let semiring_no_zero_divisors_cancel_nat =
  ({semiring_no_zero_divisors_semiring_no_zero_divisors_cancel =
      semiring_no_zero_divisors_nat}
    : nat semiring_no_zero_divisors_cancel);;

let semidom_divide_nat =
  ({divide_trivial_semidom_divide = divide_trivial_nat;
     semidom_semidom_divide = semidom_nat;
     semiring_no_zero_divisors_cancel_semidom_divide =
       semiring_no_zero_divisors_cancel_nat}
    : nat semidom_divide);;

type 'a semiring_modulo =
  {comm_semiring_1_cancel_semiring_modulo : 'a comm_semiring_1_cancel;
    modulo_semiring_modulo : 'a modulo};;

type 'a semiring_modulo_trivial =
  {divide_trivial_semiring_modulo_trivial : 'a divide_trivial;
    semiring_modulo_semiring_modulo_trivial : 'a semiring_modulo};;

type 'a algebraic_semidom =
  {semidom_divide_algebraic_semidom : 'a semidom_divide};;

type 'a semidom_modulo =
  {algebraic_semidom_semidom_modulo : 'a algebraic_semidom;
    semiring_modulo_trivial_semidom_modulo : 'a semiring_modulo_trivial};;

let semiring_modulo_nat =
  ({comm_semiring_1_cancel_semiring_modulo = comm_semiring_1_cancel_nat;
     modulo_semiring_modulo = modulo_nat}
    : nat semiring_modulo);;

let semiring_modulo_trivial_nat =
  ({divide_trivial_semiring_modulo_trivial = divide_trivial_nat;
     semiring_modulo_semiring_modulo_trivial = semiring_modulo_nat}
    : nat semiring_modulo_trivial);;

let algebraic_semidom_nat =
  ({semidom_divide_algebraic_semidom = semidom_divide_nat} :
    nat algebraic_semidom);;

let semidom_modulo_nat =
  ({algebraic_semidom_semidom_modulo = algebraic_semidom_nat;
     semiring_modulo_trivial_semidom_modulo = semiring_modulo_trivial_nat}
    : nat semidom_modulo);;

type rat = Frct of (int * int);;

let one_rata : rat = Frct (one_inta, one_inta);;

let one_rat = ({one = one_rata} : rat one);;

let rec quotient_of (Frct x) = x;;

let rec divide_int
  k l = Int_of_integer (divide_integer (integer_of_int k) (integer_of_int l));;

let rec uminus_int k = Int_of_integer (Z.neg (integer_of_int k));;

let rec equal_int k l = Z.equal (integer_of_int k) (integer_of_int l);;

let zero_int : int = Int_of_integer Z.zero;;

let rec less_int k l = Z.lt (integer_of_int k) (integer_of_int l);;

let rec gcd_int
  (Int_of_integer x) (Int_of_integer y) =
    Int_of_integer
      ((fun k l -> if Z.equal k Z.zero then Z.abs l else if Z.equal
         l Z.zero then Z.abs k else Z.gcd k l)
        x y);;

let rec normalize
  p = (if less_int zero_int (snd p)
        then (let a = gcd_int (fst p) (snd p) in
               (divide_int (fst p) a, divide_int (snd p) a))
        else (if equal_int (snd p) zero_int then (zero_int, one_inta)
               else (let a = uminus_int (gcd_int (fst p) (snd p)) in
                      (divide_int (fst p) a, divide_int (snd p) a))));;

let rec times_rata
  p q = Frct (let (a, c) = quotient_of p in
              let (b, d) = quotient_of q in
               normalize (times_inta a b, times_inta c d));;

let times_rat = ({times = times_rata} : rat times);;

let power_rat = ({one_power = one_rat; times_power = times_rat} : rat power);;

type real = Ratreal of rat;;

let one_reala : real = Ratreal one_rata;;

let one_real = ({one = one_reala} : real one);;

let rec times_reala (Ratreal x) (Ratreal y) = Ratreal (times_rata x y);;

let times_real = ({times = times_reala} : real times);;

let power_real =
  ({one_power = one_real; times_power = times_real} : real power);;

let rec plus_int
  k l = Int_of_integer (Z.add (integer_of_int k) (integer_of_int l));;

type float = Float of int * int;;

let rec times_floata
  (Float (m1, e1)) (Float (m2, e2)) = Float (times_inta m1 m2, plus_int e1 e2);;

let times_float = ({times = times_floata} : float times);;

let dvd_float = ({times_dvd = times_float} : float dvd);;

let rec abs_int i = (if less_int i zero_int then uminus_int i else i);;

let rec abs_floata (Float (m, e)) = Float (abs_int m, e);;

type 'a abs = {abs : 'a -> 'a};;
let abs _A = _A.abs;;

let abs_float = ({abs = abs_floata} : float abs);;

let one_floata : float = Float (one_inta, zero_int);;

let one_float = ({one = one_floata} : float one);;

let rec uminus_floata (Float (m1, e1)) = Float (uminus_int m1, e1);;

let rec sgn_floata
  (Float (m1, e1)) =
    (if less_int zero_int m1 then Float (one_inta, zero_int)
      else (if less_int m1 zero_int
             then uminus_floata (Float (one_inta, zero_int))
             else Float (zero_int, zero_int)));;

type 'a sgn = {sgn : 'a -> 'a};;
let sgn _A = _A.sgn;;

let sgn_float = ({sgn = sgn_floata} : float sgn);;

let rec less_eq_int k l = Z.leq (integer_of_int k) (integer_of_int l);;

let rec minus_int
  k l = Int_of_integer (Z.sub (integer_of_int k) (integer_of_int l));;

let rec power _A
  a n = (if equal_nata n zero_nata then one _A.one_power
          else times _A.times_power a (power _A a (minus_nata n one_nata)));;

let rec nat_of_integer k = Nat (max ord_integer Z.zero k);;

let rec comp f g = (fun x -> f (g x));;

let rec nat x = comp nat_of_integer integer_of_int x;;

let rec plus_floata
  (Float (m1, e1)) (Float (m2, e2)) =
    (if equal_int m1 zero_int then Float (m2, e2)
      else (if equal_int m2 zero_int then Float (m1, e1)
             else (if less_eq_int e1 e2
                    then Float (plus_int m1
                                  (times_inta m2
                                    (power power_int
                                      (Int_of_integer (Z.of_int 2))
                                      (nat (minus_int e2 e1)))),
                                 e1)
                    else Float (plus_int m2
                                  (times_inta m1
                                    (power power_int
                                      (Int_of_integer (Z.of_int 2))
                                      (nat (minus_int e1 e2)))),
                                 e2))));;

let rec minus_floata f g = plus_floata f (uminus_floata g);;

let zero_floata : float = Float (zero_int, zero_int);;

type 'a uminus = {uminus : 'a -> 'a};;
let uminus _A = _A.uminus;;

type 'a comm_semiring_1_cancel_crossproduct =
  {comm_semiring_1_cancel_comm_semiring_1_cancel_crossproduct :
     'a comm_semiring_1_cancel};;

type 'a group_add =
  {cancel_semigroup_add_group_add : 'a cancel_semigroup_add;
    minus_group_add : 'a minus; monoid_add_group_add : 'a monoid_add;
    uminus_group_add : 'a uminus};;

type 'a ab_group_add =
  {cancel_comm_monoid_add_ab_group_add : 'a cancel_comm_monoid_add;
    group_add_ab_group_add : 'a group_add};;

type 'a ring =
  {ab_group_add_ring : 'a ab_group_add;
    semiring_0_cancel_ring : 'a semiring_0_cancel};;

type 'a ring_no_zero_divisors =
  {ring_ring_no_zero_divisors : 'a ring;
    semiring_no_zero_divisors_cancel_ring_no_zero_divisors :
      'a semiring_no_zero_divisors_cancel};;

type 'a neg_numeral =
  {group_add_neg_numeral : 'a group_add; numeral_neg_numeral : 'a numeral};;

type 'a ring_1 =
  {neg_numeral_ring_1 : 'a neg_numeral; ring_ring_1 : 'a ring;
    semiring_1_cancel_ring_1 : 'a semiring_1_cancel};;

type 'a ring_1_no_zero_divisors =
  {ring_1_ring_1_no_zero_divisors : 'a ring_1;
    ring_no_zero_divisors_ring_1_no_zero_divisors : 'a ring_no_zero_divisors;
    semiring_1_no_zero_divisors_ring_1_no_zero_divisors :
      'a semiring_1_no_zero_divisors};;

type 'a comm_ring =
  {comm_semiring_0_cancel_comm_ring : 'a comm_semiring_0_cancel;
    ring_comm_ring : 'a ring};;

type 'a comm_ring_1 =
  {comm_ring_comm_ring_1 : 'a comm_ring;
    comm_semiring_1_cancel_comm_ring_1 : 'a comm_semiring_1_cancel;
    ring_1_comm_ring_1 : 'a ring_1};;

type 'a idom =
  {comm_ring_1_idom : 'a comm_ring_1;
    ring_1_no_zero_divisors_idom : 'a ring_1_no_zero_divisors;
    semidom_idom : 'a semidom;
    comm_semiring_1_cancel_crossproduct_idom :
      'a comm_semiring_1_cancel_crossproduct};;

let plus_float = ({plus = plus_floata} : float plus);;

let semigroup_add_float =
  ({plus_semigroup_add = plus_float} : float semigroup_add);;

let cancel_semigroup_add_float =
  ({semigroup_add_cancel_semigroup_add = semigroup_add_float} :
    float cancel_semigroup_add);;

let ab_semigroup_add_float =
  ({semigroup_add_ab_semigroup_add = semigroup_add_float} :
    float ab_semigroup_add);;

let minus_float = ({minus = minus_floata} : float minus);;

let cancel_ab_semigroup_add_float =
  ({ab_semigroup_add_cancel_ab_semigroup_add = ab_semigroup_add_float;
     cancel_semigroup_add_cancel_ab_semigroup_add = cancel_semigroup_add_float;
     minus_cancel_ab_semigroup_add = minus_float}
    : float cancel_ab_semigroup_add);;

let zero_float = ({zero = zero_floata} : float zero);;

let monoid_add_float =
  ({semigroup_add_monoid_add = semigroup_add_float;
     zero_monoid_add = zero_float}
    : float monoid_add);;

let comm_monoid_add_float =
  ({ab_semigroup_add_comm_monoid_add = ab_semigroup_add_float;
     monoid_add_comm_monoid_add = monoid_add_float}
    : float comm_monoid_add);;

let cancel_comm_monoid_add_float =
  ({cancel_ab_semigroup_add_cancel_comm_monoid_add =
      cancel_ab_semigroup_add_float;
     comm_monoid_add_cancel_comm_monoid_add = comm_monoid_add_float}
    : float cancel_comm_monoid_add);;

let mult_zero_float =
  ({times_mult_zero = times_float; zero_mult_zero = zero_float} :
    float mult_zero);;

let semigroup_mult_float =
  ({times_semigroup_mult = times_float} : float semigroup_mult);;

let semiring_float =
  ({ab_semigroup_add_semiring = ab_semigroup_add_float;
     semigroup_mult_semiring = semigroup_mult_float}
    : float semiring);;

let semiring_0_float =
  ({comm_monoid_add_semiring_0 = comm_monoid_add_float;
     mult_zero_semiring_0 = mult_zero_float;
     semiring_semiring_0 = semiring_float}
    : float semiring_0);;

let semiring_0_cancel_float =
  ({cancel_comm_monoid_add_semiring_0_cancel = cancel_comm_monoid_add_float;
     semiring_0_semiring_0_cancel = semiring_0_float}
    : float semiring_0_cancel);;

let ab_semigroup_mult_float =
  ({semigroup_mult_ab_semigroup_mult = semigroup_mult_float} :
    float ab_semigroup_mult);;

let comm_semiring_float =
  ({ab_semigroup_mult_comm_semiring = ab_semigroup_mult_float;
     semiring_comm_semiring = semiring_float}
    : float comm_semiring);;

let comm_semiring_0_float =
  ({comm_semiring_comm_semiring_0 = comm_semiring_float;
     semiring_0_comm_semiring_0 = semiring_0_float}
    : float comm_semiring_0);;

let comm_semiring_0_cancel_float =
  ({comm_semiring_0_comm_semiring_0_cancel = comm_semiring_0_float;
     semiring_0_cancel_comm_semiring_0_cancel = semiring_0_cancel_float}
    : float comm_semiring_0_cancel);;

let power_float =
  ({one_power = one_float; times_power = times_float} : float power);;

let monoid_mult_float =
  ({semigroup_mult_monoid_mult = semigroup_mult_float;
     power_monoid_mult = power_float}
    : float monoid_mult);;

let numeral_float =
  ({one_numeral = one_float; semigroup_add_numeral = semigroup_add_float} :
    float numeral);;

let semiring_numeral_float =
  ({monoid_mult_semiring_numeral = monoid_mult_float;
     numeral_semiring_numeral = numeral_float;
     semiring_semiring_numeral = semiring_float}
    : float semiring_numeral);;

let zero_neq_one_float =
  ({one_zero_neq_one = one_float; zero_zero_neq_one = zero_float} :
    float zero_neq_one);;

let semiring_1_float =
  ({semiring_numeral_semiring_1 = semiring_numeral_float;
     semiring_0_semiring_1 = semiring_0_float;
     zero_neq_one_semiring_1 = zero_neq_one_float}
    : float semiring_1);;

let semiring_1_cancel_float =
  ({semiring_0_cancel_semiring_1_cancel = semiring_0_cancel_float;
     semiring_1_semiring_1_cancel = semiring_1_float}
    : float semiring_1_cancel);;

let comm_monoid_mult_float =
  ({ab_semigroup_mult_comm_monoid_mult = ab_semigroup_mult_float;
     monoid_mult_comm_monoid_mult = monoid_mult_float;
     dvd_comm_monoid_mult = dvd_float}
    : float comm_monoid_mult);;

let comm_semiring_1_float =
  ({comm_monoid_mult_comm_semiring_1 = comm_monoid_mult_float;
     comm_semiring_0_comm_semiring_1 = comm_semiring_0_float;
     semiring_1_comm_semiring_1 = semiring_1_float}
    : float comm_semiring_1);;

let comm_semiring_1_cancel_float =
  ({comm_semiring_0_cancel_comm_semiring_1_cancel =
      comm_semiring_0_cancel_float;
     comm_semiring_1_comm_semiring_1_cancel = comm_semiring_1_float;
     semiring_1_cancel_comm_semiring_1_cancel = semiring_1_cancel_float}
    : float comm_semiring_1_cancel);;

let comm_semiring_1_cancel_crossproduct_float =
  ({comm_semiring_1_cancel_comm_semiring_1_cancel_crossproduct =
      comm_semiring_1_cancel_float}
    : float comm_semiring_1_cancel_crossproduct);;

let semiring_no_zero_divisors_float =
  ({semiring_0_semiring_no_zero_divisors = semiring_0_float} :
    float semiring_no_zero_divisors);;

let semiring_1_no_zero_divisors_float =
  ({semiring_1_semiring_1_no_zero_divisors = semiring_1_float;
     semiring_no_zero_divisors_semiring_1_no_zero_divisors =
       semiring_no_zero_divisors_float}
    : float semiring_1_no_zero_divisors);;

let semiring_no_zero_divisors_cancel_float =
  ({semiring_no_zero_divisors_semiring_no_zero_divisors_cancel =
      semiring_no_zero_divisors_float}
    : float semiring_no_zero_divisors_cancel);;

let uminus_float = ({uminus = uminus_floata} : float uminus);;

let group_add_float =
  ({cancel_semigroup_add_group_add = cancel_semigroup_add_float;
     minus_group_add = minus_float; monoid_add_group_add = monoid_add_float;
     uminus_group_add = uminus_float}
    : float group_add);;

let ab_group_add_float =
  ({cancel_comm_monoid_add_ab_group_add = cancel_comm_monoid_add_float;
     group_add_ab_group_add = group_add_float}
    : float ab_group_add);;

let ring_float =
  ({ab_group_add_ring = ab_group_add_float;
     semiring_0_cancel_ring = semiring_0_cancel_float}
    : float ring);;

let ring_no_zero_divisors_float =
  ({ring_ring_no_zero_divisors = ring_float;
     semiring_no_zero_divisors_cancel_ring_no_zero_divisors =
       semiring_no_zero_divisors_cancel_float}
    : float ring_no_zero_divisors);;

let neg_numeral_float =
  ({group_add_neg_numeral = group_add_float;
     numeral_neg_numeral = numeral_float}
    : float neg_numeral);;

let ring_1_float =
  ({neg_numeral_ring_1 = neg_numeral_float; ring_ring_1 = ring_float;
     semiring_1_cancel_ring_1 = semiring_1_cancel_float}
    : float ring_1);;

let ring_1_no_zero_divisors_float =
  ({ring_1_ring_1_no_zero_divisors = ring_1_float;
     ring_no_zero_divisors_ring_1_no_zero_divisors =
       ring_no_zero_divisors_float;
     semiring_1_no_zero_divisors_ring_1_no_zero_divisors =
       semiring_1_no_zero_divisors_float}
    : float ring_1_no_zero_divisors);;

let comm_ring_float =
  ({comm_semiring_0_cancel_comm_ring = comm_semiring_0_cancel_float;
     ring_comm_ring = ring_float}
    : float comm_ring);;

let comm_ring_1_float =
  ({comm_ring_comm_ring_1 = comm_ring_float;
     comm_semiring_1_cancel_comm_ring_1 = comm_semiring_1_cancel_float;
     ring_1_comm_ring_1 = ring_1_float}
    : float comm_ring_1);;

let semidom_float =
  ({comm_semiring_1_cancel_semidom = comm_semiring_1_cancel_float;
     semiring_1_no_zero_divisors_semidom = semiring_1_no_zero_divisors_float}
    : float semidom);;

let idom_float =
  ({comm_ring_1_idom = comm_ring_1_float;
     ring_1_no_zero_divisors_idom = ring_1_no_zero_divisors_float;
     semidom_idom = semidom_float;
     comm_semiring_1_cancel_crossproduct_idom =
       comm_semiring_1_cancel_crossproduct_float}
    : float idom);;

let rec min _A a b = (if less_eq _A a b then a else b);;

let rec is_float_nonneg (Float (m, e)) = less_eq_int zero_int m;;

let rec int_of_nat n = Int_of_integer (integer_of_nat n);;

let rec sgn_int
  i = (if equal_int i zero_int then zero_int
        else (if less_int zero_int i then one_inta else uminus_int one_inta));;

let rec div_twopow
  x n = (if equal_int x zero_int ||
              (equal_int x (uminus_int one_inta) || equal_nata n zero_nata)
          then x
          else div_twopow (divide_int x (Int_of_integer (Z.of_int 2)))
                 (minus_nata n one_nata));;

let rec bitlen
  x = (if less_int zero_int x
        then plus_int (bitlen (divide_int x (Int_of_integer (Z.of_int 2))))
               one_inta
        else zero_int);;

let rec float_round_down
  prec (Float (m, e)) =
    (let d =
       minus_int (minus_int (bitlen (abs_int m)) (int_of_nat prec)) one_inta in
      (if less_int zero_int d then Float (div_twopow m (nat d), plus_int e d)
        else Float (m, e)));;

let rec suc n = plus_nata n one_nata;;

let rec float_plus_down
  p (Float (m1, e1)) (Float (m2, e2)) =
    (if equal_int m1 zero_int then float_round_down p (Float (m2, e2))
      else (if equal_int m2 zero_int then float_round_down p (Float (m1, e1))
             else (if less_eq_int e2 e1
                    then (let k1 =
                            minus_nata (suc p) (nat (bitlen (abs_int m1))) in
                           (if less_int
                                 (minus_int
                                   (minus_int (minus_int e1 e2) (int_of_nat k1))
                                   (Int_of_integer (Z.of_int 2)))
                                 (bitlen (abs_int m2))
                             then float_round_down p
                                    (plus_floata (Float (m1, e1))
                                      (Float (m2, e2)))
                             else float_round_down p
                                    (Float
                                      (plus_int
 (times_inta m1 (power power_int (Int_of_integer (Z.of_int 2)) (suc (suc k1))))
 (sgn_int m2),
minus_int (minus_int e1 (int_of_nat k1)) (Int_of_integer (Z.of_int 2))))))
                    else float_plus_down p (Float (m2, e2))
                           (Float (m1, e1)))));;

let rec less_eq_float
  a b = is_float_nonneg (float_plus_down zero_nata b (uminus_floata a));;

let rec is_float_pos (Float (m, e)) = less_int zero_int m;;

let rec less_float
  a b = is_float_pos (float_plus_down zero_nata b (uminus_floata a));;

let ord_float = ({less_eq = less_eq_float; less = less_float} : float ord);;

let rec inf_floata a b = min ord_float a b;;

type 'a inf = {inf : 'a -> 'a -> 'a};;
let inf _A = _A.inf;;

let inf_float = ({inf = inf_floata} : float inf);;

let rec sup_floata a b = max ord_float a b;;

type 'a sup = {sup : 'a -> 'a -> 'a};;
let sup _A = _A.sup;;

let sup_float = ({sup = sup_floata} : float sup);;

type 'a abs_if =
  {abs_abs_if : 'a abs; minus_abs_if : 'a minus; uminus_abs_if : 'a uminus;
    zero_abs_if : 'a zero; ord_abs_if : 'a ord};;

let abs_if_float =
  ({abs_abs_if = abs_float; minus_abs_if = minus_float;
     uminus_abs_if = uminus_float; zero_abs_if = zero_float;
     ord_abs_if = ord_float}
    : float abs_if);;

type 'a semiring_char_0 = {semiring_1_semiring_char_0 : 'a semiring_1};;

type 'a ring_char_0 =
  {semiring_char_0_ring_char_0 : 'a semiring_char_0;
    ring_1_ring_char_0 : 'a ring_1};;

let semiring_char_0_float =
  ({semiring_1_semiring_char_0 = semiring_1_float} : float semiring_char_0);;

let ring_char_0_float =
  ({semiring_char_0_ring_char_0 = semiring_char_0_float;
     ring_1_ring_char_0 = ring_1_float}
    : float ring_char_0);;

type 'a preorder = {ord_preorder : 'a ord};;

type 'a order = {preorder_order : 'a preorder};;

let preorder_float = ({ord_preorder = ord_float} : float preorder);;

let order_float = ({preorder_order = preorder_float} : float order);;

type 'a semilattice_sup =
  {sup_semilattice_sup : 'a sup; order_semilattice_sup : 'a order};;

type 'a semilattice_inf =
  {inf_semilattice_inf : 'a inf; order_semilattice_inf : 'a order};;

type 'a lattice =
  {semilattice_inf_lattice : 'a semilattice_inf;
    semilattice_sup_lattice : 'a semilattice_sup};;

let semilattice_sup_float =
  ({sup_semilattice_sup = sup_float; order_semilattice_sup = order_float} :
    float semilattice_sup);;

let semilattice_inf_float =
  ({inf_semilattice_inf = inf_float; order_semilattice_inf = order_float} :
    float semilattice_inf);;

let lattice_float =
  ({semilattice_inf_lattice = semilattice_inf_float;
     semilattice_sup_lattice = semilattice_sup_float}
    : float lattice);;

type 'a linorder = {order_linorder : 'a order};;

let linorder_float = ({order_linorder = order_float} : float linorder);;

type 'a idom_abs_sgn =
  {abs_idom_abs_sgn : 'a abs; sgn_idom_abs_sgn : 'a sgn;
    idom_idom_abs_sgn : 'a idom};;

let idom_abs_sgn_float =
  ({abs_idom_abs_sgn = abs_float; sgn_idom_abs_sgn = sgn_float;
     idom_idom_abs_sgn = idom_float}
    : float idom_abs_sgn);;

type 'a ordered_ab_semigroup_add =
  {ab_semigroup_add_ordered_ab_semigroup_add : 'a ab_semigroup_add;
    order_ordered_ab_semigroup_add : 'a order};;

type 'a strict_ordered_ab_semigroup_add =
  {ordered_ab_semigroup_add_strict_ordered_ab_semigroup_add :
     'a ordered_ab_semigroup_add};;

type 'a ordered_cancel_ab_semigroup_add =
  {cancel_ab_semigroup_add_ordered_cancel_ab_semigroup_add :
     'a cancel_ab_semigroup_add;
    strict_ordered_ab_semigroup_add_ordered_cancel_ab_semigroup_add :
      'a strict_ordered_ab_semigroup_add};;

type 'a ordered_comm_monoid_add =
  {comm_monoid_add_ordered_comm_monoid_add : 'a comm_monoid_add;
    ordered_ab_semigroup_add_ordered_comm_monoid_add :
      'a ordered_ab_semigroup_add};;

type 'a ordered_semiring =
  {ordered_comm_monoid_add_ordered_semiring : 'a ordered_comm_monoid_add;
    semiring_ordered_semiring : 'a semiring};;

type 'a ordered_semiring_0 =
  {ordered_semiring_ordered_semiring_0 : 'a ordered_semiring;
    semiring_0_ordered_semiring_0 : 'a semiring_0};;

type 'a ordered_cancel_semiring =
  {ordered_cancel_ab_semigroup_add_ordered_cancel_semiring :
     'a ordered_cancel_ab_semigroup_add;
    ordered_semiring_0_ordered_cancel_semiring : 'a ordered_semiring_0;
    semiring_0_cancel_ordered_cancel_semiring : 'a semiring_0_cancel};;

type 'a ordered_ab_semigroup_add_imp_le =
  {ordered_cancel_ab_semigroup_add_ordered_ab_semigroup_add_imp_le :
     'a ordered_cancel_ab_semigroup_add};;

type 'a strict_ordered_comm_monoid_add =
  {comm_monoid_add_strict_ordered_comm_monoid_add : 'a comm_monoid_add;
    strict_ordered_ab_semigroup_add_strict_ordered_comm_monoid_add :
      'a strict_ordered_ab_semigroup_add};;

type 'a ordered_cancel_comm_monoid_add =
  {ordered_cancel_ab_semigroup_add_ordered_cancel_comm_monoid_add :
     'a ordered_cancel_ab_semigroup_add;
    ordered_comm_monoid_add_ordered_cancel_comm_monoid_add :
      'a ordered_comm_monoid_add;
    strict_ordered_comm_monoid_add_ordered_cancel_comm_monoid_add :
      'a strict_ordered_comm_monoid_add};;

type 'a ordered_ab_semigroup_monoid_add_imp_le =
  {cancel_comm_monoid_add_ordered_ab_semigroup_monoid_add_imp_le :
     'a cancel_comm_monoid_add;
    ordered_ab_semigroup_add_imp_le_ordered_ab_semigroup_monoid_add_imp_le :
      'a ordered_ab_semigroup_add_imp_le;
    ordered_cancel_comm_monoid_add_ordered_ab_semigroup_monoid_add_imp_le :
      'a ordered_cancel_comm_monoid_add};;

type 'a ordered_ab_group_add =
  {ab_group_add_ordered_ab_group_add : 'a ab_group_add;
    ordered_ab_semigroup_monoid_add_imp_le_ordered_ab_group_add :
      'a ordered_ab_semigroup_monoid_add_imp_le};;

type 'a ordered_ring =
  {ordered_ab_group_add_ordered_ring : 'a ordered_ab_group_add;
    ordered_cancel_semiring_ordered_ring : 'a ordered_cancel_semiring;
    ring_ordered_ring : 'a ring};;

let ordered_ab_semigroup_add_float =
  ({ab_semigroup_add_ordered_ab_semigroup_add = ab_semigroup_add_float;
     order_ordered_ab_semigroup_add = order_float}
    : float ordered_ab_semigroup_add);;

let strict_ordered_ab_semigroup_add_float =
  ({ordered_ab_semigroup_add_strict_ordered_ab_semigroup_add =
      ordered_ab_semigroup_add_float}
    : float strict_ordered_ab_semigroup_add);;

let ordered_cancel_ab_semigroup_add_float =
  ({cancel_ab_semigroup_add_ordered_cancel_ab_semigroup_add =
      cancel_ab_semigroup_add_float;
     strict_ordered_ab_semigroup_add_ordered_cancel_ab_semigroup_add =
       strict_ordered_ab_semigroup_add_float}
    : float ordered_cancel_ab_semigroup_add);;

let ordered_comm_monoid_add_float =
  ({comm_monoid_add_ordered_comm_monoid_add = comm_monoid_add_float;
     ordered_ab_semigroup_add_ordered_comm_monoid_add =
       ordered_ab_semigroup_add_float}
    : float ordered_comm_monoid_add);;

let ordered_semiring_float =
  ({ordered_comm_monoid_add_ordered_semiring = ordered_comm_monoid_add_float;
     semiring_ordered_semiring = semiring_float}
    : float ordered_semiring);;

let ordered_semiring_0_float =
  ({ordered_semiring_ordered_semiring_0 = ordered_semiring_float;
     semiring_0_ordered_semiring_0 = semiring_0_float}
    : float ordered_semiring_0);;

let ordered_cancel_semiring_float =
  ({ordered_cancel_ab_semigroup_add_ordered_cancel_semiring =
      ordered_cancel_ab_semigroup_add_float;
     ordered_semiring_0_ordered_cancel_semiring = ordered_semiring_0_float;
     semiring_0_cancel_ordered_cancel_semiring = semiring_0_cancel_float}
    : float ordered_cancel_semiring);;

let ordered_ab_semigroup_add_imp_le_float =
  ({ordered_cancel_ab_semigroup_add_ordered_ab_semigroup_add_imp_le =
      ordered_cancel_ab_semigroup_add_float}
    : float ordered_ab_semigroup_add_imp_le);;

let strict_ordered_comm_monoid_add_float =
  ({comm_monoid_add_strict_ordered_comm_monoid_add = comm_monoid_add_float;
     strict_ordered_ab_semigroup_add_strict_ordered_comm_monoid_add =
       strict_ordered_ab_semigroup_add_float}
    : float strict_ordered_comm_monoid_add);;

let ordered_cancel_comm_monoid_add_float =
  ({ordered_cancel_ab_semigroup_add_ordered_cancel_comm_monoid_add =
      ordered_cancel_ab_semigroup_add_float;
     ordered_comm_monoid_add_ordered_cancel_comm_monoid_add =
       ordered_comm_monoid_add_float;
     strict_ordered_comm_monoid_add_ordered_cancel_comm_monoid_add =
       strict_ordered_comm_monoid_add_float}
    : float ordered_cancel_comm_monoid_add);;

let ordered_ab_semigroup_monoid_add_imp_le_float =
  ({cancel_comm_monoid_add_ordered_ab_semigroup_monoid_add_imp_le =
      cancel_comm_monoid_add_float;
     ordered_ab_semigroup_add_imp_le_ordered_ab_semigroup_monoid_add_imp_le =
       ordered_ab_semigroup_add_imp_le_float;
     ordered_cancel_comm_monoid_add_ordered_ab_semigroup_monoid_add_imp_le =
       ordered_cancel_comm_monoid_add_float}
    : float ordered_ab_semigroup_monoid_add_imp_le);;

let ordered_ab_group_add_float =
  ({ab_group_add_ordered_ab_group_add = ab_group_add_float;
     ordered_ab_semigroup_monoid_add_imp_le_ordered_ab_group_add =
       ordered_ab_semigroup_monoid_add_imp_le_float}
    : float ordered_ab_group_add);;

let ordered_ring_float =
  ({ordered_ab_group_add_ordered_ring = ordered_ab_group_add_float;
     ordered_cancel_semiring_ordered_ring = ordered_cancel_semiring_float;
     ring_ordered_ring = ring_float}
    : float ordered_ring);;

type 'a zero_less_one =
  {order_zero_less_one : 'a order;
    zero_neq_one_zero_less_one : 'a zero_neq_one};;

let zero_less_one_float =
  ({order_zero_less_one = order_float;
     zero_neq_one_zero_less_one = zero_neq_one_float}
    : float zero_less_one);;

type 'a ordered_semiring_strict =
  {ordered_cancel_ab_semigroup_add_ordered_semiring_strict :
     'a ordered_cancel_ab_semigroup_add;
    ordered_semiring_ordered_semiring_strict : 'a ordered_semiring;
    semiring_0_cancel_ordered_semiring_strict : 'a semiring_0_cancel};;

type 'a linordered_ab_semigroup_add =
  {ordered_ab_semigroup_add_linordered_ab_semigroup_add :
     'a ordered_ab_semigroup_add;
    linorder_linordered_ab_semigroup_add : 'a linorder};;

type 'a linordered_cancel_ab_semigroup_add =
  {linordered_ab_semigroup_add_linordered_cancel_ab_semigroup_add :
     'a linordered_ab_semigroup_add;
    ordered_ab_semigroup_add_imp_le_linordered_cancel_ab_semigroup_add :
      'a ordered_ab_semigroup_add_imp_le};;

type 'a linordered_semiring =
  {linordered_cancel_ab_semigroup_add_linordered_semiring :
     'a linordered_cancel_ab_semigroup_add;
    ordered_ab_semigroup_monoid_add_imp_le_linordered_semiring :
      'a ordered_ab_semigroup_monoid_add_imp_le;
    ordered_cancel_semiring_linordered_semiring : 'a ordered_cancel_semiring};;

type 'a linordered_semiring_strict =
  {linordered_semiring_linordered_semiring_strict : 'a linordered_semiring;
    ordered_semiring_strict_linordered_semiring_strict :
      'a ordered_semiring_strict};;

type 'a ordered_semiring_1 =
  {ordered_semiring_0_ordered_semiring_1 : 'a ordered_semiring_0;
    semiring_1_ordered_semiring_1 : 'a semiring_1;
    zero_less_one_ordered_semiring_1 : 'a zero_less_one};;

type 'a ordered_semiring_1_strict =
  {ordered_semiring_1_ordered_semiring_1_strict : 'a ordered_semiring_1;
    ordered_semiring_strict_ordered_semiring_1_strict :
      'a ordered_semiring_strict};;

type 'a linordered_semiring_1 =
  {linordered_semiring_linordered_semiring_1 : 'a linordered_semiring;
    ordered_semiring_1_linordered_semiring_1 : 'a ordered_semiring_1};;

type 'a linordered_semiring_1_strict =
  {linordered_semiring_1_linordered_semiring_1_strict :
     'a linordered_semiring_1;
    linordered_semiring_strict_linordered_semiring_1_strict :
      'a linordered_semiring_strict;
    ordered_semiring_1_strict_linordered_semiring_1_strict :
      'a ordered_semiring_1_strict};;

type 'a ordered_ab_group_add_abs =
  {abs_ordered_ab_group_add_abs : 'a abs;
    ordered_ab_group_add_ordered_ab_group_add_abs : 'a ordered_ab_group_add};;

type 'a linordered_ab_group_add =
  {linordered_cancel_ab_semigroup_add_linordered_ab_group_add :
     'a linordered_cancel_ab_semigroup_add;
    ordered_ab_group_add_linordered_ab_group_add : 'a ordered_ab_group_add};;

type 'a linordered_ring =
  {linordered_ab_group_add_linordered_ring : 'a linordered_ab_group_add;
    ordered_ab_group_add_abs_linordered_ring : 'a ordered_ab_group_add_abs;
    abs_if_linordered_ring : 'a abs_if;
    linordered_semiring_linordered_ring : 'a linordered_semiring;
    ordered_ring_linordered_ring : 'a ordered_ring};;

type 'a linordered_ring_strict =
  {linordered_ring_linordered_ring_strict : 'a linordered_ring;
    linordered_semiring_strict_linordered_ring_strict :
      'a linordered_semiring_strict;
    ring_no_zero_divisors_linordered_ring_strict : 'a ring_no_zero_divisors};;

type 'a ordered_comm_semiring =
  {comm_semiring_0_ordered_comm_semiring : 'a comm_semiring_0;
    ordered_semiring_ordered_comm_semiring : 'a ordered_semiring};;

type 'a ordered_cancel_comm_semiring =
  {comm_semiring_0_cancel_ordered_cancel_comm_semiring :
     'a comm_semiring_0_cancel;
    ordered_cancel_semiring_ordered_cancel_comm_semiring :
      'a ordered_cancel_semiring;
    ordered_comm_semiring_ordered_cancel_comm_semiring :
      'a ordered_comm_semiring};;

type 'a ordered_comm_semiring_strict =
  {ordered_cancel_comm_semiring_ordered_comm_semiring_strict :
     'a ordered_cancel_comm_semiring;
    ordered_semiring_strict_ordered_comm_semiring_strict :
      'a ordered_semiring_strict};;

type 'a linordered_comm_semiring_strict =
  {linordered_semiring_strict_linordered_comm_semiring_strict :
     'a linordered_semiring_strict;
    ordered_comm_semiring_strict_linordered_comm_semiring_strict :
      'a ordered_comm_semiring_strict};;

type 'a linordered_nonzero_semiring =
  {semiring_char_0_linordered_nonzero_semiring : 'a semiring_char_0;
    linorder_linordered_nonzero_semiring : 'a linorder;
    comm_semiring_1_linordered_nonzero_semiring : 'a comm_semiring_1;
    ordered_comm_semiring_linordered_nonzero_semiring :
      'a ordered_comm_semiring;
    ordered_semiring_1_linordered_nonzero_semiring : 'a ordered_semiring_1};;

type 'a linordered_semidom =
  {linordered_comm_semiring_strict_linordered_semidom :
     'a linordered_comm_semiring_strict;
    linordered_nonzero_semiring_linordered_semidom :
      'a linordered_nonzero_semiring;
    semidom_linordered_semidom : 'a semidom};;

type 'a ordered_comm_ring =
  {comm_ring_ordered_comm_ring : 'a comm_ring;
    ordered_cancel_comm_semiring_ordered_comm_ring :
      'a ordered_cancel_comm_semiring;
    ordered_ring_ordered_comm_ring : 'a ordered_ring};;

type 'a ordered_ring_abs =
  {ordered_ab_group_add_abs_ordered_ring_abs : 'a ordered_ab_group_add_abs;
    ordered_ring_ordered_ring_abs : 'a ordered_ring};;

type 'a linordered_idom =
  {ring_char_0_linordered_idom : 'a ring_char_0;
    idom_abs_sgn_linordered_idom : 'a idom_abs_sgn;
    linordered_ring_strict_linordered_idom : 'a linordered_ring_strict;
    linordered_semidom_linordered_idom : 'a linordered_semidom;
    linordered_semiring_1_strict_linordered_idom :
      'a linordered_semiring_1_strict;
    ordered_comm_ring_linordered_idom : 'a ordered_comm_ring;
    ordered_ring_abs_linordered_idom : 'a ordered_ring_abs};;

let ordered_semiring_strict_float =
  ({ordered_cancel_ab_semigroup_add_ordered_semiring_strict =
      ordered_cancel_ab_semigroup_add_float;
     ordered_semiring_ordered_semiring_strict = ordered_semiring_float;
     semiring_0_cancel_ordered_semiring_strict = semiring_0_cancel_float}
    : float ordered_semiring_strict);;

let linordered_ab_semigroup_add_float =
  ({ordered_ab_semigroup_add_linordered_ab_semigroup_add =
      ordered_ab_semigroup_add_float;
     linorder_linordered_ab_semigroup_add = linorder_float}
    : float linordered_ab_semigroup_add);;

let linordered_cancel_ab_semigroup_add_float =
  ({linordered_ab_semigroup_add_linordered_cancel_ab_semigroup_add =
      linordered_ab_semigroup_add_float;
     ordered_ab_semigroup_add_imp_le_linordered_cancel_ab_semigroup_add =
       ordered_ab_semigroup_add_imp_le_float}
    : float linordered_cancel_ab_semigroup_add);;

let linordered_semiring_float =
  ({linordered_cancel_ab_semigroup_add_linordered_semiring =
      linordered_cancel_ab_semigroup_add_float;
     ordered_ab_semigroup_monoid_add_imp_le_linordered_semiring =
       ordered_ab_semigroup_monoid_add_imp_le_float;
     ordered_cancel_semiring_linordered_semiring =
       ordered_cancel_semiring_float}
    : float linordered_semiring);;

let linordered_semiring_strict_float =
  ({linordered_semiring_linordered_semiring_strict = linordered_semiring_float;
     ordered_semiring_strict_linordered_semiring_strict =
       ordered_semiring_strict_float}
    : float linordered_semiring_strict);;

let ordered_semiring_1_float =
  ({ordered_semiring_0_ordered_semiring_1 = ordered_semiring_0_float;
     semiring_1_ordered_semiring_1 = semiring_1_float;
     zero_less_one_ordered_semiring_1 = zero_less_one_float}
    : float ordered_semiring_1);;

let ordered_semiring_1_strict_float =
  ({ordered_semiring_1_ordered_semiring_1_strict = ordered_semiring_1_float;
     ordered_semiring_strict_ordered_semiring_1_strict =
       ordered_semiring_strict_float}
    : float ordered_semiring_1_strict);;

let linordered_semiring_1_float =
  ({linordered_semiring_linordered_semiring_1 = linordered_semiring_float;
     ordered_semiring_1_linordered_semiring_1 = ordered_semiring_1_float}
    : float linordered_semiring_1);;

let linordered_semiring_1_strict_float =
  ({linordered_semiring_1_linordered_semiring_1_strict =
      linordered_semiring_1_float;
     linordered_semiring_strict_linordered_semiring_1_strict =
       linordered_semiring_strict_float;
     ordered_semiring_1_strict_linordered_semiring_1_strict =
       ordered_semiring_1_strict_float}
    : float linordered_semiring_1_strict);;

let ordered_ab_group_add_abs_float =
  ({abs_ordered_ab_group_add_abs = abs_float;
     ordered_ab_group_add_ordered_ab_group_add_abs = ordered_ab_group_add_float}
    : float ordered_ab_group_add_abs);;

let linordered_ab_group_add_float =
  ({linordered_cancel_ab_semigroup_add_linordered_ab_group_add =
      linordered_cancel_ab_semigroup_add_float;
     ordered_ab_group_add_linordered_ab_group_add = ordered_ab_group_add_float}
    : float linordered_ab_group_add);;

let linordered_ring_float =
  ({linordered_ab_group_add_linordered_ring = linordered_ab_group_add_float;
     ordered_ab_group_add_abs_linordered_ring = ordered_ab_group_add_abs_float;
     abs_if_linordered_ring = abs_if_float;
     linordered_semiring_linordered_ring = linordered_semiring_float;
     ordered_ring_linordered_ring = ordered_ring_float}
    : float linordered_ring);;

let linordered_ring_strict_float =
  ({linordered_ring_linordered_ring_strict = linordered_ring_float;
     linordered_semiring_strict_linordered_ring_strict =
       linordered_semiring_strict_float;
     ring_no_zero_divisors_linordered_ring_strict = ring_no_zero_divisors_float}
    : float linordered_ring_strict);;

let ordered_comm_semiring_float =
  ({comm_semiring_0_ordered_comm_semiring = comm_semiring_0_float;
     ordered_semiring_ordered_comm_semiring = ordered_semiring_float}
    : float ordered_comm_semiring);;

let ordered_cancel_comm_semiring_float =
  ({comm_semiring_0_cancel_ordered_cancel_comm_semiring =
      comm_semiring_0_cancel_float;
     ordered_cancel_semiring_ordered_cancel_comm_semiring =
       ordered_cancel_semiring_float;
     ordered_comm_semiring_ordered_cancel_comm_semiring =
       ordered_comm_semiring_float}
    : float ordered_cancel_comm_semiring);;

let ordered_comm_semiring_strict_float =
  ({ordered_cancel_comm_semiring_ordered_comm_semiring_strict =
      ordered_cancel_comm_semiring_float;
     ordered_semiring_strict_ordered_comm_semiring_strict =
       ordered_semiring_strict_float}
    : float ordered_comm_semiring_strict);;

let linordered_comm_semiring_strict_float =
  ({linordered_semiring_strict_linordered_comm_semiring_strict =
      linordered_semiring_strict_float;
     ordered_comm_semiring_strict_linordered_comm_semiring_strict =
       ordered_comm_semiring_strict_float}
    : float linordered_comm_semiring_strict);;

let linordered_nonzero_semiring_float =
  ({semiring_char_0_linordered_nonzero_semiring = semiring_char_0_float;
     linorder_linordered_nonzero_semiring = linorder_float;
     comm_semiring_1_linordered_nonzero_semiring = comm_semiring_1_float;
     ordered_comm_semiring_linordered_nonzero_semiring =
       ordered_comm_semiring_float;
     ordered_semiring_1_linordered_nonzero_semiring = ordered_semiring_1_float}
    : float linordered_nonzero_semiring);;

let linordered_semidom_float =
  ({linordered_comm_semiring_strict_linordered_semidom =
      linordered_comm_semiring_strict_float;
     linordered_nonzero_semiring_linordered_semidom =
       linordered_nonzero_semiring_float;
     semidom_linordered_semidom = semidom_float}
    : float linordered_semidom);;

let ordered_comm_ring_float =
  ({comm_ring_ordered_comm_ring = comm_ring_float;
     ordered_cancel_comm_semiring_ordered_comm_ring =
       ordered_cancel_comm_semiring_float;
     ordered_ring_ordered_comm_ring = ordered_ring_float}
    : float ordered_comm_ring);;

let ordered_ring_abs_float =
  ({ordered_ab_group_add_abs_ordered_ring_abs = ordered_ab_group_add_abs_float;
     ordered_ring_ordered_ring_abs = ordered_ring_float}
    : float ordered_ring_abs);;

let linordered_idom_float =
  ({ring_char_0_linordered_idom = ring_char_0_float;
     idom_abs_sgn_linordered_idom = idom_abs_sgn_float;
     linordered_ring_strict_linordered_idom = linordered_ring_strict_float;
     linordered_semidom_linordered_idom = linordered_semidom_float;
     linordered_semiring_1_strict_linordered_idom =
       linordered_semiring_1_strict_float;
     ordered_comm_ring_linordered_idom = ordered_comm_ring_float;
     ordered_ring_abs_linordered_idom = ordered_ring_abs_float}
    : float linordered_idom);;

type 'a semilattice_sup_ab_group_add =
  {ordered_ab_group_add_semilattice_sup_ab_group_add : 'a ordered_ab_group_add;
    semilattice_sup_semilattice_sup_ab_group_add : 'a semilattice_sup};;

type 'a semilattice_inf_ab_group_add =
  {ordered_ab_group_add_semilattice_inf_ab_group_add : 'a ordered_ab_group_add;
    semilattice_inf_semilattice_inf_ab_group_add : 'a semilattice_inf};;

type 'a lattice_ab_group_add =
  {semilattice_inf_ab_group_add_lattice_ab_group_add :
     'a semilattice_inf_ab_group_add;
    semilattice_sup_ab_group_add_lattice_ab_group_add :
      'a semilattice_sup_ab_group_add;
    lattice_lattice_ab_group_add : 'a lattice};;

let semilattice_sup_ab_group_add_float =
  ({ordered_ab_group_add_semilattice_sup_ab_group_add =
      ordered_ab_group_add_float;
     semilattice_sup_semilattice_sup_ab_group_add = semilattice_sup_float}
    : float semilattice_sup_ab_group_add);;

let semilattice_inf_ab_group_add_float =
  ({ordered_ab_group_add_semilattice_inf_ab_group_add =
      ordered_ab_group_add_float;
     semilattice_inf_semilattice_inf_ab_group_add = semilattice_inf_float}
    : float semilattice_inf_ab_group_add);;

let lattice_ab_group_add_float =
  ({semilattice_inf_ab_group_add_lattice_ab_group_add =
      semilattice_inf_ab_group_add_float;
     semilattice_sup_ab_group_add_lattice_ab_group_add =
       semilattice_sup_ab_group_add_float;
     lattice_lattice_ab_group_add = lattice_float}
    : float lattice_ab_group_add);;

type dim = D_length | D_mass | D_volume | D_area | D_speed | D_time | D_pressure
  | D_energy | D_power | D_data;;

type fuel = F_petrol | F_diesel | F_jet_fuel | F_lpg | F_natural_gas | F_coal |
  F_lignite | F_anthracite | F_wood | F_charcoal;;

type kind = K_density | K_mass | K_volume | K_floats | K_convert | K_temperature
  | K_temperature_difference | K_force | K_extension | K_spring_constant |
  K_elastic_energy | K_period | K_frequency | K_pressure_gauge | K_pressure_abs
  | K_buoyant_force | K_submerged_fraction | K_sinks | K_energy | K_co2 |
  K_mass_needed | K_ncv | K_useful_energy | K_useful_mass_needed |
  K_model_condition;;

type need = N_amount | N_k_stretch | N_k_stretch_or_compression |
  N_force_stretch | N_k_force | N_mass_k | N_depth | N_volume | N_fuel_mass |
  N_efficiency;;

type tunit = T_C | T_F | T_K;;

type qunit = U_metre | U_kilometre | U_centimetre | U_millimetre | U_inch |
  U_foot | U_yard | U_mile | U_nautical_mile | U_kilogram | U_gram | U_milligram
  | U_pound | U_ounce | U_tonne | U_stone | U_litre | U_millilitre | U_gallon_us
  | U_quart_us | U_pint_us | U_cup_us | U_fluid_ounce_us | U_cubic_metre |
  U_square_metre | U_square_foot | U_acre | U_hectare | U_square_kilometre |
  U_square_mile | U_metre_per_second | U_kilometre_per_hour | U_mile_per_hour |
  U_knot | U_second | U_minute | U_hour | U_day | U_week | U_pascal |
  U_kilopascal | U_bar | U_atmosphere | U_psi | U_mmhg | U_joule | U_kilojoule |
  U_calorie | U_kilocalorie | U_kilowatt_hour | U_btu | U_watt | U_kilowatt |
  U_horsepower | U_byte | U_kilobyte | U_megabyte | U_gigabyte | U_terabyte |
  U_kibibyte | U_mebibyte | U_gibibyte | U_cubic_centimetre | U_cubic_foot |
  U_megajoule | U_gigajoule | U_megawatt_hour | U_watt_hour | U_millijoule |
  U_milliwatt_hour;;

type uref = Lin of qunit | Tmp of tunit;;

type reason = R_below_absolute_zero | R_nonpositive_stiffness |
  R_nonpositive_stretch | R_nonpositive_mass | R_hydrostatic_inputs |
  R_fuel_inputs | R_efficiency | R_inverse_efficiency;;

type model_condition = C_reference_state | C_moisture | C_unread_input |
  C_other_operation;;

type decline = Underspecified of need | Mismatch | Impossible of reason |
  Undecided | Imprecise | UnsupportedModel of model_condition;;

type outcome = Exact of kind * rat | Approx of kind * (int * int) |
  Verdict of kind * bool | Decline of decline;;

type efficiency_unit = E_fraction | E_percent;;

type material = M_water | M_seawater | M_ice | M_aluminium | M_steel | M_iron |
  M_copper | M_gold | M_silver | M_lead | M_concrete | M_glass | M_petrol |
  M_diesel | M_ethanol | M_mercury | M_air | M_granite | M_brass | M_titanium |
  M_platinum | M_zinc | M_nickel | M_milk | M_honey | M_uranium | M_tungsten |
  M_magnesium | M_olive_oil;;

type density_input = ReferenceDensity of material |
  SuppliedDensity of rat * qunit * qunit;;

type gravity_unit = G_mps2 | G_fps2 | G_standard;;

type request = Density of material |
  MassOf of material * (rat * qunit) option * qunit |
  VolumeOf of material * (rat * qunit) option * qunit |
  Floats of material * material | Convert of rat * uref * uref |
  ConvertDelta of rat * uref * uref |
  SpringForce of rat option * (rat * qunit) option |
  SpringExtension of rat option * rat option |
  SpringConstant of rat option * (rat * qunit) option |
  SpringEnergy of rat option * (rat * qunit) option |
  SpringPeriod of rat option * (rat * qunit) option |
  SpringFrequency of rat option * (rat * qunit) option |
  PressureGauge of material * (rat * qunit) option |
  PressureAbs of material * (rat * qunit) option |
  Buoyant of material * (rat * qunit) option | Submerged of material * material
  | FuelEnergy of fuel * (rat * qunit) option * qunit |
  FuelCO2 of fuel * (rat * qunit) option |
  FuelMassNeeded of fuel * (rat * qunit) | FuelNCV of fuel |
  Hydrostatic of
    density_input * (rat * qunit) option * (rat * gravity_unit) *
      (rat * qunit) * bool
  | FuelUsefulEnergy of
      fuel * (rat * qunit) option * qunit * (rat * efficiency_unit) option
  | FuelUsefulMass of fuel * (rat * qunit) * (rat * efficiency_unit) option |
  UnsupportedCondition of model_condition;;

type 'a interval = Interval of ('a * 'a);;

type floatarith = Add of floatarith * floatarith | Minus of floatarith |
  Mult of floatarith * floatarith | Inverse of floatarith | Cos of floatarith |
  Arctan of floatarith | Abs of floatarith | Max of floatarith * floatarith |
  Min of floatarith * floatarith | Pi | Sqrt of floatarith | Exp of floatarith |
  Powr of floatarith * floatarith | Ln of floatarith | Power of floatarith * nat
  | Floor of floatarith | Var of nat | Num of float;;

type float_interval_option_x_x_float_float_prod_option =
  Abs_float_interval_option_x_x_float_float_prod_option of
    (float * float) option;;

let rec eq _A a b = equal _A a b;;

let rec nth
  (x :: xs) n =
    (if equal_nata n zero_nata then x else nth xs (minus_nata n one_nata));;

let rec fract a b = Frct (normalize (a, b));;

let rec of_int a = Frct (a, one_inta);;

let rec bind x0 f = match x0, f with None, f -> None
               | Some x, f -> f x;;

let rec divide_rat
  p q = Frct (let (a, c) = quotient_of p in
              let (b, d) = quotient_of q in
               normalize (times_inta a d, times_inta c b));;

let g0 : rat
  = divide_rat (of_int (Int_of_integer (Z.of_int 980665)))
      (of_int (Int_of_integer (Z.of_int 100000)));;

let p0 : rat = of_int (Int_of_integer (Z.of_int 101325));;

let rec ncv
  = function
    F_petrol ->
      divide_rat (of_int (Int_of_integer (Z.of_int 443)))
        (of_int (Int_of_integer (Z.of_int 10)))
    | F_diesel -> of_int (Int_of_integer (Z.of_int 43))
    | F_jet_fuel ->
        divide_rat (of_int (Int_of_integer (Z.of_int 441)))
          (of_int (Int_of_integer (Z.of_int 10)))
    | F_lpg ->
        divide_rat (of_int (Int_of_integer (Z.of_int 473)))
          (of_int (Int_of_integer (Z.of_int 10)))
    | F_natural_gas -> of_int (Int_of_integer (Z.of_int 48))
    | F_coal ->
        divide_rat (of_int (Int_of_integer (Z.of_int 258)))
          (of_int (Int_of_integer (Z.of_int 10)))
    | F_lignite ->
        divide_rat (of_int (Int_of_integer (Z.of_int 119)))
          (of_int (Int_of_integer (Z.of_int 10)))
    | F_anthracite ->
        divide_rat (of_int (Int_of_integer (Z.of_int 267)))
          (of_int (Int_of_integer (Z.of_int 10)))
    | F_wood ->
        divide_rat (of_int (Int_of_integer (Z.of_int 156)))
          (of_int (Int_of_integer (Z.of_int 10)))
    | F_charcoal ->
        divide_rat (of_int (Int_of_integer (Z.of_int 295)))
          (of_int (Int_of_integer (Z.of_int 10)));;

let rec scale
  = function U_metre -> one_rata
    | U_kilometre -> of_int (Int_of_integer (Z.of_int 1000))
    | U_centimetre ->
        divide_rat one_rata (of_int (Int_of_integer (Z.of_int 100)))
    | U_millimetre ->
        divide_rat one_rata (of_int (Int_of_integer (Z.of_int 1000)))
    | U_inch ->
        divide_rat (of_int (Int_of_integer (Z.of_int 127)))
          (of_int (Int_of_integer (Z.of_int 5000)))
    | U_foot ->
        divide_rat (of_int (Int_of_integer (Z.of_int 381)))
          (of_int (Int_of_integer (Z.of_int 1250)))
    | U_yard ->
        divide_rat (of_int (Int_of_integer (Z.of_int 1143)))
          (of_int (Int_of_integer (Z.of_int 1250)))
    | U_mile ->
        divide_rat (of_int (Int_of_integer (Z.of_int 201168)))
          (of_int (Int_of_integer (Z.of_int 125)))
    | U_nautical_mile -> of_int (Int_of_integer (Z.of_int 1852))
    | U_kilogram -> one_rata
    | U_gram -> divide_rat one_rata (of_int (Int_of_integer (Z.of_int 1000)))
    | U_milligram ->
        divide_rat one_rata (of_int (Int_of_integer (Z.of_int 1000000)))
    | U_pound ->
        divide_rat (of_int (Int_of_integer (Z.of_int 45359237)))
          (of_int (Int_of_integer (Z.of_int 100000000)))
    | U_ounce ->
        divide_rat (of_int (Int_of_integer (Z.of_int 45359237)))
          (of_int (Int_of_integer (Z.of_string "1600000000")))
    | U_tonne -> of_int (Int_of_integer (Z.of_int 1000))
    | U_stone ->
        divide_rat (of_int (Int_of_integer (Z.of_int 317514659)))
          (of_int (Int_of_integer (Z.of_int 50000000)))
    | U_litre -> divide_rat one_rata (of_int (Int_of_integer (Z.of_int 1000)))
    | U_millilitre ->
        divide_rat one_rata (of_int (Int_of_integer (Z.of_int 1000000)))
    | U_gallon_us ->
        divide_rat (of_int (Int_of_integer (Z.of_int 473176473)))
          (of_int (Int_of_integer (Z.of_string "125000000000")))
    | U_quart_us ->
        divide_rat (of_int (Int_of_integer (Z.of_int 473176473)))
          (of_int (Int_of_integer (Z.of_string "500000000000")))
    | U_pint_us ->
        divide_rat (of_int (Int_of_integer (Z.of_int 473176473)))
          (of_int (Int_of_integer (Z.of_string "1000000000000")))
    | U_cup_us ->
        divide_rat (of_int (Int_of_integer (Z.of_int 473176473)))
          (of_int (Int_of_integer (Z.of_string "2000000000000")))
    | U_fluid_ounce_us ->
        divide_rat (of_int (Int_of_integer (Z.of_int 473176473)))
          (of_int (Int_of_integer (Z.of_string "16000000000000")))
    | U_cubic_metre -> one_rata
    | U_square_metre -> one_rata
    | U_square_foot ->
        divide_rat (of_int (Int_of_integer (Z.of_int 145161)))
          (of_int (Int_of_integer (Z.of_int 1562500)))
    | U_acre ->
        divide_rat (of_int (Int_of_integer (Z.of_int 316160658)))
          (of_int (Int_of_integer (Z.of_int 78125)))
    | U_hectare -> of_int (Int_of_integer (Z.of_int 10000))
    | U_square_kilometre -> of_int (Int_of_integer (Z.of_int 1000000))
    | U_square_mile ->
        divide_rat (of_int (Int_of_integer (Z.of_string "40468564224")))
          (of_int (Int_of_integer (Z.of_int 15625)))
    | U_metre_per_second -> one_rata
    | U_kilometre_per_hour ->
        divide_rat (of_int (Int_of_integer (Z.of_int 5)))
          (of_int (Int_of_integer (Z.of_int 18)))
    | U_mile_per_hour ->
        divide_rat (of_int (Int_of_integer (Z.of_int 1397)))
          (of_int (Int_of_integer (Z.of_int 3125)))
    | U_knot ->
        divide_rat (of_int (Int_of_integer (Z.of_int 463)))
          (of_int (Int_of_integer (Z.of_int 900)))
    | U_second -> one_rata
    | U_minute -> of_int (Int_of_integer (Z.of_int 60))
    | U_hour -> of_int (Int_of_integer (Z.of_int 3600))
    | U_day -> of_int (Int_of_integer (Z.of_int 86400))
    | U_week -> of_int (Int_of_integer (Z.of_int 604800))
    | U_pascal -> one_rata
    | U_kilopascal -> of_int (Int_of_integer (Z.of_int 1000))
    | U_bar -> of_int (Int_of_integer (Z.of_int 100000))
    | U_atmosphere -> of_int (Int_of_integer (Z.of_int 101325))
    | U_psi ->
        divide_rat (of_int (Int_of_integer (Z.of_string "8896443230521")))
          (of_int (Int_of_integer (Z.of_string "1290320000")))
    | U_mmhg ->
        divide_rat (of_int (Int_of_integer (Z.of_string "26664477483")))
          (of_int (Int_of_integer (Z.of_int 200000000)))
    | U_joule -> one_rata
    | U_kilojoule -> of_int (Int_of_integer (Z.of_int 1000))
    | U_calorie ->
        divide_rat (of_int (Int_of_integer (Z.of_int 523)))
          (of_int (Int_of_integer (Z.of_int 125)))
    | U_kilocalorie -> of_int (Int_of_integer (Z.of_int 4184))
    | U_kilowatt_hour -> of_int (Int_of_integer (Z.of_int 3600000))
    | U_btu ->
        divide_rat (of_int (Int_of_integer (Z.of_string "52752792631")))
          (of_int (Int_of_integer (Z.of_int 50000000)))
    | U_watt -> one_rata
    | U_kilowatt -> of_int (Int_of_integer (Z.of_int 1000))
    | U_horsepower ->
        divide_rat (of_int (Int_of_integer (Z.of_string "37284993579113511")))
          (of_int (Int_of_integer (Z.of_string "50000000000000")))
    | U_byte -> one_rata
    | U_kilobyte -> of_int (Int_of_integer (Z.of_int 1000))
    | U_megabyte -> of_int (Int_of_integer (Z.of_int 1000000))
    | U_gigabyte -> of_int (Int_of_integer (Z.of_int 1000000000))
    | U_terabyte -> of_int (Int_of_integer (Z.of_string "1000000000000"))
    | U_kibibyte -> of_int (Int_of_integer (Z.of_int 1024))
    | U_mebibyte -> of_int (Int_of_integer (Z.of_int 1048576))
    | U_gibibyte -> of_int (Int_of_integer (Z.of_string "1073741824"))
    | U_cubic_centimetre ->
        divide_rat one_rata (of_int (Int_of_integer (Z.of_int 1000000)))
    | U_cubic_foot ->
        divide_rat (of_int (Int_of_integer (Z.of_int 55306341)))
          (of_int (Int_of_integer (Z.of_string "1953125000")))
    | U_megajoule -> of_int (Int_of_integer (Z.of_int 1000000))
    | U_gigajoule -> of_int (Int_of_integer (Z.of_int 1000000000))
    | U_megawatt_hour -> of_int (Int_of_integer (Z.of_string "3600000000"))
    | U_watt_hour -> of_int (Int_of_integer (Z.of_int 3600))
    | U_millijoule ->
        divide_rat one_rata (of_int (Int_of_integer (Z.of_int 1000)))
    | U_milliwatt_hour ->
        divide_rat (of_int (Int_of_integer (Z.of_int 18)))
          (of_int (Int_of_integer (Z.of_int 5)));;

let rec siq q = times_rata (fst q) (scale (snd q));;

let rec i i = Num (Float (i, zero_int));;

let rec q q = (let (a, b) = quotient_of q in Mult (i a, Inverse (i b)));;

let prec : nat = nat_of_integer (Z.of_int 53);;

let rec minus_rat
  p q = Frct (let (a, c) = quotient_of p in
              let (b, d) = quotient_of q in
               normalize
                 (minus_int (times_inta a d) (times_inta b c),
                   times_inta c d));;

let zero_rat : rat = Frct (zero_int, one_inta);;

let rec plus_rat
  p q = Frct (let (a, c) = quotient_of p in
              let (b, d) = quotient_of q in
               normalize
                 (plus_int (times_inta a d) (times_inta b c), times_inta c d));;

let rec density
  = function M_water -> of_int (Int_of_integer (Z.of_int 1000))
    | M_seawater -> of_int (Int_of_integer (Z.of_int 1025))
    | M_ice -> of_int (Int_of_integer (Z.of_int 917))
    | M_aluminium -> of_int (Int_of_integer (Z.of_int 2700))
    | M_steel -> of_int (Int_of_integer (Z.of_int 7850))
    | M_iron -> of_int (Int_of_integer (Z.of_int 7874))
    | M_copper -> of_int (Int_of_integer (Z.of_int 8933))
    | M_gold -> of_int (Int_of_integer (Z.of_int 19282))
    | M_silver -> of_int (Int_of_integer (Z.of_int 10501))
    | M_lead -> of_int (Int_of_integer (Z.of_int 11342))
    | M_concrete -> of_int (Int_of_integer (Z.of_int 2400))
    | M_glass -> of_int (Int_of_integer (Z.of_int 2500))
    | M_petrol -> of_int (Int_of_integer (Z.of_int 745))
    | M_diesel -> of_int (Int_of_integer (Z.of_int 832))
    | M_ethanol -> of_int (Int_of_integer (Z.of_int 789))
    | M_mercury ->
        divide_rat (of_int (Int_of_integer (Z.of_int 135336)))
          (of_int (Int_of_integer (Z.of_int 10)))
    | M_air ->
        divide_rat (of_int (Int_of_integer (Z.of_int 1204)))
          (of_int (Int_of_integer (Z.of_int 1000)))
    | M_granite -> of_int (Int_of_integer (Z.of_int 2700))
    | M_brass -> of_int (Int_of_integer (Z.of_int 8500))
    | M_titanium -> of_int (Int_of_integer (Z.of_int 4500))
    | M_platinum -> of_int (Int_of_integer (Z.of_int 21460))
    | M_zinc -> of_int (Int_of_integer (Z.of_int 7134))
    | M_nickel -> of_int (Int_of_integer (Z.of_int 8912))
    | M_milk -> of_int (Int_of_integer (Z.of_int 1030))
    | M_honey -> of_int (Int_of_integer (Z.of_int 1420))
    | M_uranium -> of_int (Int_of_integer (Z.of_int 18950))
    | M_tungsten -> of_int (Int_of_integer (Z.of_int 19300))
    | M_magnesium -> of_int (Int_of_integer (Z.of_int 1740))
    | M_olive_oil -> of_int (Int_of_integer (Z.of_int 911));;

let rec input_density
  = function ReferenceDensity m -> density m
    | SuppliedDensity (x, m, v) ->
        divide_rat (times_rata x (scale m)) (scale v);;

let rec gravity_scale = function G_mps2 -> one_rata
                        | G_fps2 -> scale U_foot
                        | G_standard -> g0;;

let rec gravity_si g = times_rata (fst g) (gravity_scale (snd g));;

let rec efficiency
  = function (x, E_fraction) -> x
    | (x, E_percent) -> divide_rat x (of_int (Int_of_integer (Z.of_int 100)));;

let rec co2_factor
  = function F_petrol -> of_int (Int_of_integer (Z.of_int 69300))
    | F_diesel -> of_int (Int_of_integer (Z.of_int 74100))
    | F_jet_fuel -> of_int (Int_of_integer (Z.of_int 71500))
    | F_lpg -> of_int (Int_of_integer (Z.of_int 63100))
    | F_natural_gas -> of_int (Int_of_integer (Z.of_int 56100))
    | F_coal -> of_int (Int_of_integer (Z.of_int 94600))
    | F_lignite -> of_int (Int_of_integer (Z.of_int 101000))
    | F_anthracite -> of_int (Int_of_integer (Z.of_int 98300))
    | F_wood -> of_int (Int_of_integer (Z.of_int 112000))
    | F_charcoal -> of_int (Int_of_integer (Z.of_int 112000));;

let rec toffset
  = function
    T_C ->
      divide_rat (of_int (Int_of_integer (Z.of_int 27315)))
        (of_int (Int_of_integer (Z.of_int 100)))
    | T_F ->
        divide_rat (of_int (Int_of_integer (Z.of_int 45967)))
          (of_int (Int_of_integer (Z.of_int 180)))
    | T_K -> zero_rat;;

let rec tscale
  = function T_C -> one_rata
    | T_F ->
        divide_rat (of_int (Int_of_integer (Z.of_int 5)))
          (of_int (Int_of_integer (Z.of_int 9)))
    | T_K -> one_rata;;

let rec tdelta a b x = divide_rat (times_rata x (tscale a)) (tscale b);;

let rec kelvin u x = plus_rat (times_rata x (tscale u)) (toffset u);;

let rec qval
  = function Density m -> density m
    | MassOf (m, Some v, u) ->
        divide_rat (times_rata (density m) (siq v)) (scale u)
    | VolumeOf (ma, Some m, u) ->
        divide_rat (divide_rat (siq m) (density ma)) (scale u)
    | Convert (x, Lin a, Lin b) -> divide_rat (times_rata x (scale a)) (scale b)
    | Convert (x, Tmp a, Tmp b) ->
        divide_rat (minus_rat (kelvin a x) (toffset b)) (tscale b)
    | ConvertDelta (x, Tmp a, Tmp b) -> tdelta a b x
    | SpringForce (Some k, Some x) -> times_rata k (siq x)
    | SpringExtension (Some k, Some f) -> divide_rat f k
    | SpringConstant (Some f, Some x) -> divide_rat f (siq x)
    | SpringEnergy (Some k, Some x) ->
        divide_rat
          (times_rata k (power power_rat (siq x) (nat_of_integer (Z.of_int 2))))
          (of_int (Int_of_integer (Z.of_int 2)))
    | PressureGauge (f, Some h) ->
        times_rata (times_rata (density f) g0) (siq h)
    | PressureAbs (f, Some h) ->
        plus_rat p0 (times_rata (times_rata (density f) g0) (siq h))
    | Buoyant (f, Some v) -> times_rata (times_rata (density f) g0) (siq v)
    | Submerged (s, f) -> divide_rat (density s) (density f)
    | FuelEnergy (f, Some m, u) ->
        divide_rat
          (times_rata (times_rata (siq m) (ncv f))
            (of_int (Int_of_integer (Z.of_int 1000000))))
          (scale u)
    | FuelCO2 (f, Some m) ->
        divide_rat (times_rata (times_rata (siq m) (ncv f)) (co2_factor f))
          (of_int (Int_of_integer (Z.of_int 1000000)))
    | FuelMassNeeded (f, e) ->
        divide_rat
          (divide_rat (siq e) (of_int (Int_of_integer (Z.of_int 1000000))))
          (ncv f)
    | FuelNCV f -> ncv f
    | Hydrostatic (d, Some h, g, p, a) ->
        plus_rat
          (times_rata (times_rata (input_density d) (gravity_si g)) (siq h))
          (if a then siq p else zero_rat)
    | FuelUsefulEnergy (f, Some m, u, Some e) ->
        divide_rat
          (times_rata (times_rata (times_rata (efficiency e) (siq m)) (ncv f))
            (of_int (Int_of_integer (Z.of_int 1000000))))
          (scale u)
    | FuelUsefulMass (f, q, Some e) ->
        divide_rat (siq q)
          (times_rata (times_rata (efficiency e) (ncv f))
            (of_int (Int_of_integer (Z.of_int 1000000))))
    | MassOf (v, None, vb) -> zero_rat
    | VolumeOf (v, None, vb) -> zero_rat
    | Floats (v, va) -> zero_rat
    | Convert (v, Tmp vc, Lin va) -> zero_rat
    | Convert (v, Lin vb, Tmp vc) -> zero_rat
    | ConvertDelta (v, Lin vc, vb) -> zero_rat
    | ConvertDelta (v, va, Lin vc) -> zero_rat
    | SpringForce (None, va) -> zero_rat
    | SpringForce (v, None) -> zero_rat
    | SpringExtension (None, va) -> zero_rat
    | SpringExtension (v, None) -> zero_rat
    | SpringConstant (None, va) -> zero_rat
    | SpringConstant (v, None) -> zero_rat
    | SpringEnergy (None, va) -> zero_rat
    | SpringEnergy (v, None) -> zero_rat
    | SpringPeriod (v, va) -> zero_rat
    | SpringFrequency (v, va) -> zero_rat
    | PressureGauge (v, None) -> zero_rat
    | PressureAbs (v, None) -> zero_rat
    | Buoyant (v, None) -> zero_rat
    | FuelEnergy (v, None, vb) -> zero_rat
    | FuelCO2 (v, None) -> zero_rat
    | Hydrostatic (v, None, vb, vc, vd) -> zero_rat
    | FuelUsefulEnergy (v, None, vb, vc) -> zero_rat
    | FuelUsefulEnergy (v, va, vb, None) -> zero_rat
    | FuelUsefulMass (v, va, None) -> zero_rat
    | UnsupportedCondition v -> zero_rat;;

let rec floor_fl
  (Float (m, e)) =
    (if less_eq_int zero_int e then Float (m, e)
      else Float (divide_int m
                    (power power_int (Int_of_integer (Z.of_int 2))
                      (nat (uminus_int e))),
                   zero_int));;

let rec bounds_of_interval _A (Interval x) = x;;

let rec lower _A x = fst (bounds_of_interval _A x);;

let rec upper _A x = snd (bounds_of_interval _A x);;

let rec is_none = function None -> true
                  | Some x -> false;;

let rec modulo_int
  k l = Int_of_integer (modulo_integer (integer_of_int k) (integer_of_int l));;

let rec normfloat
  (Float (m, e)) =
    (if equal_int (modulo_int m (Int_of_integer (Z.of_int 2))) zero_int &&
          not (equal_int m zero_int)
      then normfloat
             (Float
               (divide_int m (Int_of_integer (Z.of_int 2)),
                 plus_int e one_inta))
      else (if equal_int m zero_int then Float (zero_int, zero_int)
             else Float (m, e)));;

let rec dim_of = function U_metre -> D_length
                 | U_kilometre -> D_length
                 | U_centimetre -> D_length
                 | U_millimetre -> D_length
                 | U_inch -> D_length
                 | U_foot -> D_length
                 | U_yard -> D_length
                 | U_mile -> D_length
                 | U_nautical_mile -> D_length
                 | U_kilogram -> D_mass
                 | U_gram -> D_mass
                 | U_milligram -> D_mass
                 | U_pound -> D_mass
                 | U_ounce -> D_mass
                 | U_tonne -> D_mass
                 | U_stone -> D_mass
                 | U_litre -> D_volume
                 | U_millilitre -> D_volume
                 | U_gallon_us -> D_volume
                 | U_quart_us -> D_volume
                 | U_pint_us -> D_volume
                 | U_cup_us -> D_volume
                 | U_fluid_ounce_us -> D_volume
                 | U_cubic_metre -> D_volume
                 | U_square_metre -> D_area
                 | U_square_foot -> D_area
                 | U_acre -> D_area
                 | U_hectare -> D_area
                 | U_square_kilometre -> D_area
                 | U_square_mile -> D_area
                 | U_metre_per_second -> D_speed
                 | U_kilometre_per_hour -> D_speed
                 | U_mile_per_hour -> D_speed
                 | U_knot -> D_speed
                 | U_second -> D_time
                 | U_minute -> D_time
                 | U_hour -> D_time
                 | U_day -> D_time
                 | U_week -> D_time
                 | U_pascal -> D_pressure
                 | U_kilopascal -> D_pressure
                 | U_bar -> D_pressure
                 | U_atmosphere -> D_pressure
                 | U_psi -> D_pressure
                 | U_mmhg -> D_pressure
                 | U_joule -> D_energy
                 | U_kilojoule -> D_energy
                 | U_calorie -> D_energy
                 | U_kilocalorie -> D_energy
                 | U_kilowatt_hour -> D_energy
                 | U_btu -> D_energy
                 | U_watt -> D_power
                 | U_kilowatt -> D_power
                 | U_horsepower -> D_power
                 | U_byte -> D_data
                 | U_kilobyte -> D_data
                 | U_megabyte -> D_data
                 | U_gigabyte -> D_data
                 | U_terabyte -> D_data
                 | U_kibibyte -> D_data
                 | U_mebibyte -> D_data
                 | U_gibibyte -> D_data
                 | U_cubic_centimetre -> D_volume
                 | U_cubic_foot -> D_volume
                 | U_megajoule -> D_energy
                 | U_gigajoule -> D_energy
                 | U_megawatt_hour -> D_energy
                 | U_watt_hour -> D_energy
                 | U_millijoule -> D_energy
                 | U_milliwatt_hour -> D_energy;;

let rec unsupported_of = function UnsupportedCondition c -> Some c
                         | Density v -> None
                         | MassOf (v, va, vb) -> None
                         | VolumeOf (v, va, vb) -> None
                         | Floats (v, va) -> None
                         | Convert (v, va, vb) -> None
                         | ConvertDelta (v, va, vb) -> None
                         | SpringForce (v, va) -> None
                         | SpringExtension (v, va) -> None
                         | SpringConstant (v, va) -> None
                         | SpringEnergy (v, va) -> None
                         | SpringPeriod (v, va) -> None
                         | SpringFrequency (v, va) -> None
                         | PressureGauge (v, va) -> None
                         | PressureAbs (v, va) -> None
                         | Buoyant (v, va) -> None
                         | Submerged (v, va) -> None
                         | FuelEnergy (v, va, vb) -> None
                         | FuelCO2 (v, va) -> None
                         | FuelMassNeeded (v, va) -> None
                         | FuelNCV v -> None
                         | Hydrostatic (v, va, vb, vc, vd) -> None
                         | FuelUsefulEnergy (v, va, vb, vc) -> None
                         | FuelUsefulMass (v, va, vb) -> None;;

let rec less_rat
  p q = (let (a, c) = quotient_of p in
         let (b, d) = quotient_of q in
          less_int (times_inta a d) (times_inta c b));;

let rec abs_rat p = Frct (let (a, b) = quotient_of p in (abs_int a, b));;

let rec undecided
  = function
    Floats (s, f) ->
      less_rat
        (times_rata (abs_rat (minus_rat (density s) (density f)))
          (of_int (Int_of_integer (Z.of_int 50))))
        (density f)
    | Density v -> false
    | MassOf (v, va, vb) -> false
    | VolumeOf (v, va, vb) -> false
    | Convert (v, va, vb) -> false
    | ConvertDelta (v, va, vb) -> false
    | SpringForce (v, va) -> false
    | SpringExtension (v, va) -> false
    | SpringConstant (v, va) -> false
    | SpringEnergy (v, va) -> false
    | SpringPeriod (v, va) -> false
    | SpringFrequency (v, va) -> false
    | PressureGauge (v, va) -> false
    | PressureAbs (v, va) -> false
    | Buoyant (v, va) -> false
    | Submerged (v, va) -> false
    | FuelEnergy (v, va, vb) -> false
    | FuelCO2 (v, va) -> false
    | FuelMassNeeded (v, va) -> false
    | FuelNCV v -> false
    | Hydrostatic (v, va, vb, vc, vd) -> false
    | FuelUsefulEnergy (v, va, vb, vc) -> false
    | FuelUsefulMass (v, va, vb) -> false
    | UnsupportedCondition v -> false;;

let rec less_eq_rat
  p q = (let (a, c) = quotient_of p in
         let (b, d) = quotient_of q in
          less_eq_int (times_inta a d) (times_inta c b));;

let rec reason_of
  = function
    Convert (x, Tmp a, Tmp b) ->
      (if less_rat (kelvin a x) zero_rat then Some R_below_absolute_zero
        else None)
    | SpringExtension (Some k, Some f) ->
        (if less_eq_rat k zero_rat then Some R_nonpositive_stiffness else None)
    | SpringConstant (Some f, Some x) ->
        (if less_eq_rat (siq x) zero_rat then Some R_nonpositive_stretch
          else None)
    | SpringPeriod (Some k, Some m) ->
        (if less_eq_rat k zero_rat then Some R_nonpositive_stiffness
          else (if less_eq_rat (siq m) zero_rat then Some R_nonpositive_mass
                 else None))
    | SpringFrequency (Some k, Some m) ->
        (if less_eq_rat k zero_rat then Some R_nonpositive_stiffness
          else (if less_eq_rat (siq m) zero_rat then Some R_nonpositive_mass
                 else None))
    | Hydrostatic (d, Some h, g, p, a) ->
        (if less_eq_rat (input_density d) zero_rat ||
              (less_rat (siq h) zero_rat ||
                (less_rat (gravity_si g) zero_rat || less_rat (siq p) zero_rat))
          then Some R_hydrostatic_inputs else None)
    | FuelUsefulEnergy (f, Some m, u, Some e) ->
        (if less_rat (siq m) zero_rat then Some R_fuel_inputs
          else (if less_rat (efficiency e) zero_rat ||
                     less_rat one_rata (efficiency e)
                 then Some R_efficiency else None))
    | FuelUsefulMass (f, q, Some e) ->
        (if less_rat (siq q) zero_rat then Some R_fuel_inputs
          else (if less_eq_rat (efficiency e) zero_rat ||
                     less_rat one_rata (efficiency e)
                 then Some R_inverse_efficiency else None))
    | Density v -> None
    | MassOf (v, va, vb) -> None
    | VolumeOf (v, va, vb) -> None
    | Floats (v, va) -> None
    | Convert (v, Lin vc, vb) -> None
    | Convert (v, va, Lin vc) -> None
    | ConvertDelta (v, va, vb) -> None
    | SpringForce (v, va) -> None
    | SpringExtension (None, va) -> None
    | SpringExtension (v, None) -> None
    | SpringConstant (None, va) -> None
    | SpringConstant (v, None) -> None
    | SpringEnergy (v, va) -> None
    | SpringPeriod (None, va) -> None
    | SpringPeriod (v, None) -> None
    | SpringFrequency (None, va) -> None
    | SpringFrequency (v, None) -> None
    | PressureGauge (v, va) -> None
    | PressureAbs (v, va) -> None
    | Buoyant (v, va) -> None
    | Submerged (v, va) -> None
    | FuelEnergy (v, va, vb) -> None
    | FuelCO2 (v, va) -> None
    | FuelMassNeeded (v, va) -> None
    | FuelNCV v -> None
    | Hydrostatic (v, None, vb, vc, vd) -> None
    | FuelUsefulEnergy (v, None, vb, vc) -> None
    | FuelUsefulEnergy (v, va, vb, None) -> None
    | FuelUsefulMass (v, va, None) -> None
    | UnsupportedCondition v -> None;;

let rec missing
  = function MassOf (m, v, u) -> (if is_none v then Some N_amount else None)
    | VolumeOf (ma, m, u) -> (if is_none m then Some N_amount else None)
    | SpringForce (k, x) ->
        (if is_none k || is_none x then Some N_k_stretch else None)
    | SpringExtension (k, f) ->
        (if is_none k || is_none f then Some N_k_force else None)
    | SpringConstant (f, x) ->
        (if is_none f || is_none x then Some N_force_stretch else None)
    | SpringEnergy (k, x) ->
        (if is_none k || is_none x then Some N_k_stretch_or_compression
          else None)
    | SpringPeriod (k, m) ->
        (if is_none k || is_none m then Some N_mass_k else None)
    | SpringFrequency (k, m) ->
        (if is_none k || is_none m then Some N_mass_k else None)
    | PressureGauge (f, h) -> (if is_none h then Some N_depth else None)
    | PressureAbs (f, h) -> (if is_none h then Some N_depth else None)
    | Buoyant (f, v) -> (if is_none v then Some N_volume else None)
    | FuelEnergy (f, m, u) -> (if is_none m then Some N_fuel_mass else None)
    | FuelCO2 (f, m) -> (if is_none m then Some N_fuel_mass else None)
    | Hydrostatic (d, h, g, p, a) -> (if is_none h then Some N_depth else None)
    | FuelUsefulEnergy (f, m, u, e) ->
        (if is_none m then Some N_fuel_mass
          else (if is_none e then Some N_efficiency else None))
    | FuelUsefulMass (f, q, e) ->
        (if is_none e then Some N_efficiency else None)
    | Density v -> None
    | Floats (v, va) -> None
    | Convert (v, va, vb) -> None
    | ConvertDelta (v, va, vb) -> None
    | Submerged (v, va) -> None
    | FuelMassNeeded (v, va) -> None
    | FuelNCV v -> None
    | UnsupportedCondition v -> None;;

let rec equal_dim x0 x1 = match x0, x1 with D_power, D_data -> false
                    | D_data, D_power -> false
                    | D_energy, D_data -> false
                    | D_data, D_energy -> false
                    | D_energy, D_power -> false
                    | D_power, D_energy -> false
                    | D_pressure, D_data -> false
                    | D_data, D_pressure -> false
                    | D_pressure, D_power -> false
                    | D_power, D_pressure -> false
                    | D_pressure, D_energy -> false
                    | D_energy, D_pressure -> false
                    | D_time, D_data -> false
                    | D_data, D_time -> false
                    | D_time, D_power -> false
                    | D_power, D_time -> false
                    | D_time, D_energy -> false
                    | D_energy, D_time -> false
                    | D_time, D_pressure -> false
                    | D_pressure, D_time -> false
                    | D_speed, D_data -> false
                    | D_data, D_speed -> false
                    | D_speed, D_power -> false
                    | D_power, D_speed -> false
                    | D_speed, D_energy -> false
                    | D_energy, D_speed -> false
                    | D_speed, D_pressure -> false
                    | D_pressure, D_speed -> false
                    | D_speed, D_time -> false
                    | D_time, D_speed -> false
                    | D_area, D_data -> false
                    | D_data, D_area -> false
                    | D_area, D_power -> false
                    | D_power, D_area -> false
                    | D_area, D_energy -> false
                    | D_energy, D_area -> false
                    | D_area, D_pressure -> false
                    | D_pressure, D_area -> false
                    | D_area, D_time -> false
                    | D_time, D_area -> false
                    | D_area, D_speed -> false
                    | D_speed, D_area -> false
                    | D_volume, D_data -> false
                    | D_data, D_volume -> false
                    | D_volume, D_power -> false
                    | D_power, D_volume -> false
                    | D_volume, D_energy -> false
                    | D_energy, D_volume -> false
                    | D_volume, D_pressure -> false
                    | D_pressure, D_volume -> false
                    | D_volume, D_time -> false
                    | D_time, D_volume -> false
                    | D_volume, D_speed -> false
                    | D_speed, D_volume -> false
                    | D_volume, D_area -> false
                    | D_area, D_volume -> false
                    | D_mass, D_data -> false
                    | D_data, D_mass -> false
                    | D_mass, D_power -> false
                    | D_power, D_mass -> false
                    | D_mass, D_energy -> false
                    | D_energy, D_mass -> false
                    | D_mass, D_pressure -> false
                    | D_pressure, D_mass -> false
                    | D_mass, D_time -> false
                    | D_time, D_mass -> false
                    | D_mass, D_speed -> false
                    | D_speed, D_mass -> false
                    | D_mass, D_area -> false
                    | D_area, D_mass -> false
                    | D_mass, D_volume -> false
                    | D_volume, D_mass -> false
                    | D_length, D_data -> false
                    | D_data, D_length -> false
                    | D_length, D_power -> false
                    | D_power, D_length -> false
                    | D_length, D_energy -> false
                    | D_energy, D_length -> false
                    | D_length, D_pressure -> false
                    | D_pressure, D_length -> false
                    | D_length, D_time -> false
                    | D_time, D_length -> false
                    | D_length, D_speed -> false
                    | D_speed, D_length -> false
                    | D_length, D_area -> false
                    | D_area, D_length -> false
                    | D_length, D_volume -> false
                    | D_volume, D_length -> false
                    | D_length, D_mass -> false
                    | D_mass, D_length -> false
                    | D_data, D_data -> true
                    | D_power, D_power -> true
                    | D_energy, D_energy -> true
                    | D_pressure, D_pressure -> true
                    | D_time, D_time -> true
                    | D_speed, D_speed -> true
                    | D_area, D_area -> true
                    | D_volume, D_volume -> true
                    | D_mass, D_mass -> true
                    | D_length, D_length -> true;;

let rec density_dims
  = function ReferenceDensity m -> true
    | SuppliedDensity (x, m, v) ->
        equal_dim (dim_of m) D_mass && equal_dim (dim_of v) D_volume;;

let rec opt_dim x0 d = match x0, d with None, d -> true
                  | Some (x, u), d -> equal_dim (dim_of u) d;;

let rec dims_ok
  = function
    MassOf (m, v, u) -> opt_dim v D_volume && equal_dim (dim_of u) D_mass
    | VolumeOf (ma, m, u) -> opt_dim m D_mass && equal_dim (dim_of u) D_volume
    | Convert (x, Lin a, Lin b) -> equal_dim (dim_of a) (dim_of b)
    | Convert (x, Tmp a, Tmp b) -> true
    | Convert (x, Tmp v, Lin va) -> false
    | Convert (x, Lin va, Tmp v) -> false
    | ConvertDelta (x, Tmp a, Tmp b) -> true
    | ConvertDelta (x, Lin v, ux) -> false
    | ConvertDelta (x, uw, Lin v) -> false
    | SpringForce (k, x) -> opt_dim x D_length
    | SpringConstant (f, x) -> opt_dim x D_length
    | SpringEnergy (k, x) -> opt_dim x D_length
    | SpringPeriod (k, m) -> opt_dim m D_mass
    | SpringFrequency (k, m) -> opt_dim m D_mass
    | PressureGauge (f, h) -> opt_dim h D_length
    | PressureAbs (f, h) -> opt_dim h D_length
    | Buoyant (f, v) -> opt_dim v D_volume
    | FuelEnergy (f, m, u) -> opt_dim m D_mass && equal_dim (dim_of u) D_energy
    | FuelCO2 (f, m) -> opt_dim m D_mass
    | FuelMassNeeded (f, e) -> equal_dim (dim_of (snd e)) D_energy
    | Hydrostatic (d, h, g, p, a) ->
        density_dims d &&
          (opt_dim h D_length && equal_dim (dim_of (snd p)) D_pressure)
    | FuelUsefulEnergy (f, m, u, e) ->
        opt_dim m D_mass && equal_dim (dim_of u) D_energy
    | FuelUsefulMass (f, q, e) -> equal_dim (dim_of (snd q)) D_energy
    | Density v -> true
    | Floats (v, va) -> true
    | SpringExtension (v, va) -> true
    | Submerged (v, va) -> true
    | FuelNCV v -> true
    | UnsupportedCondition v -> true;;

let rec decline_of
  r = (match missing r
        with None ->
          (if not (dims_ok r) then Some Mismatch
            else (match reason_of r
                   with None ->
                     (if undecided r then Some Undecided
                       else (match unsupported_of r with None -> None
                              | Some c -> Some (UnsupportedModel c)))
                   | Some why -> Some (Impossible why)))
        | Some w -> Some (Underspecified w));;

let rec uminus_interval _A
  xa = Interval
         (let (a, b) =
            bounds_of_interval
              _A.ordered_ab_semigroup_monoid_add_imp_le_ordered_ab_group_add.ordered_cancel_comm_monoid_add_ordered_ab_semigroup_monoid_add_imp_le.ordered_comm_monoid_add_ordered_cancel_comm_monoid_add.ordered_ab_semigroup_add_ordered_comm_monoid_add.order_ordered_ab_semigroup_add.preorder_order
              xa
            in
           (uminus
              _A.ab_group_add_ordered_ab_group_add.group_add_ab_group_add.uminus_group_add
              b,
             uminus
               _A.ab_group_add_ordered_ab_group_add.group_add_ab_group_add.uminus_group_add
               a));;

let rec float_round_up
  prec x = uminus_floata (float_round_down prec (uminus_floata x));;

let rec rat_precision
  prec x y =
    (let d = minus_int (bitlen x) (bitlen y) in
      plus_int (minus_int (int_of_nat prec) d)
        (if less_float (Float (abs_int x, zero_int)) (Float (abs_int y, d))
          then one_inta else zero_int));;

let rec rapprox_posrat
  prec x y =
    (let l = rat_precision prec (int_of_nat x) (int_of_nat y) in
     let (r, s) =
       (if less_eq_int zero_int l
         then (times_inta (int_of_nat x)
                 (power power_int (Int_of_integer (Z.of_int 2)) (nat l)),
                int_of_nat y)
         else (int_of_nat x,
                times_inta (int_of_nat y)
                  (power power_int (Int_of_integer (Z.of_int 2))
                    (nat (uminus_int l)))))
       in
     let d = divide_int r s in
     let m = modulo_int r s in
      normfloat
        (Float
          (plus_int d
             (if equal_int m zero_int || equal_nata y zero_nata then zero_int
               else one_inta),
            uminus_int l)));;

let rec lapprox_posrat
  prec x y =
    (let l = rat_precision prec (int_of_nat x) (int_of_nat y) in
     let xa =
       (if less_eq_int zero_int l
         then divide_nata
                (times_nata x
                  (power power_nat (nat_of_integer (Z.of_int 2)) (nat l)))
                y
         else divide_nata
                (divide_nata x
                  (power power_nat (nat_of_integer (Z.of_int 2))
                    (nat (uminus_int l))))
                y)
       in
      normfloat (Float (int_of_nat xa, uminus_int l)));;

let rec lapprox_rat
  prec x y =
    (if equal_int y zero_int then Float (zero_int, zero_int)
      else (if less_eq_int zero_int x
             then (if less_int zero_int y
                    then lapprox_posrat prec (nat x) (nat y)
                    else uminus_floata
                           (rapprox_posrat prec (nat x) (nat (uminus_int y))))
             else (if less_int zero_int y
                    then uminus_floata
                           (rapprox_posrat prec (nat (uminus_int x)) (nat y))
                    else lapprox_posrat prec (nat (uminus_int x))
                           (nat (uminus_int y)))));;

let rec float_plus_up
  p x y =
    uminus_floata (float_plus_down p (uminus_floata x) (uminus_floata y));;

let rec rapprox_rat
  prec x y = uminus_floata (lapprox_rat prec (uminus_int x) y);;

let rec ub_arctan_horner
  prec n k x =
    (if equal_nata n zero_nata then Float (zero_int, zero_int)
      else float_plus_up prec (rapprox_rat prec one_inta (int_of_nat k))
             (uminus_floata
               (float_round_down prec
                 (times_floata x
                   (lb_arctan_horner prec (minus_nata n one_nata)
                     (plus_nata k (nat_of_integer (Z.of_int 2))) x)))))
and lb_arctan_horner
  prec n k x =
    (if equal_nata n zero_nata then Float (zero_int, zero_int)
      else float_plus_down prec (lapprox_rat prec one_inta (int_of_nat k))
             (uminus_floata
               (float_round_up prec
                 (times_floata x
                   (ub_arctan_horner prec (minus_nata n one_nata)
                     (plus_nata k (nat_of_integer (Z.of_int 2))) x)))));;

let rec dvd (_A1, _A2)
  a b = eq _A1
          (modulo
            _A2.semiring_modulo_trivial_semidom_modulo.semiring_modulo_semiring_modulo_trivial.modulo_semiring_modulo
            b a)
          (zero _A2.algebraic_semidom_semidom_modulo.semidom_divide_algebraic_semidom.semidom_semidom_divide.comm_semiring_1_cancel_semidom.comm_semiring_1_comm_semiring_1_cancel.semiring_1_comm_semiring_1.semiring_0_semiring_1.mult_zero_semiring_0.zero_mult_zero);;

let rec get_even
  n = (if dvd (equal_nat, semidom_modulo_nat) (nat_of_integer (Z.of_int 2)) n
        then n else suc n);;

let rec float_divl
  prec (Float (m1, s1)) (Float (m2, s2)) =
    times_floata (lapprox_rat prec m1 m2) (Float (one_inta, minus_int s1 s2));;

let rec float_divr
  prec x y = uminus_floata (float_divl prec (uminus_floata x) y);;

let rec sqrt_iteration
  prec n (Float (m, e)) =
    (if equal_nata n zero_nata
      then Float (one_inta,
                   plus_int
                     (divide_int
                       (if equal_int m zero_int then zero_int
                         else plus_int (bitlen (abs_int m)) e)
                       (Int_of_integer (Z.of_int 2)))
                     one_inta)
      else (let y = sqrt_iteration prec (minus_nata n one_nata) (Float (m, e))
              in
             times_floata (Float (one_inta, uminus_int one_inta))
               (float_plus_up prec y (float_divr prec (Float (m, e)) y))));;

let rec ub_sqrt
  prec x =
    (if less_float (Float (zero_int, zero_int)) x
      then sqrt_iteration prec prec x
      else (if less_float x (Float (zero_int, zero_int))
             then uminus_floata (lb_sqrt prec (uminus_floata x))
             else Float (zero_int, zero_int)))
and lb_sqrt
  prec x =
    (if less_float (Float (zero_int, zero_int)) x
      then float_divl prec x (sqrt_iteration prec prec x)
      else (if less_float x (Float (zero_int, zero_int))
             then uminus_floata (ub_sqrt prec (uminus_floata x))
             else Float (zero_int, zero_int)));;

let rec get_odd
  n = (if not (dvd (equal_nat, semidom_modulo_nat) (nat_of_integer (Z.of_int 2))
                n)
        then n else suc n);;

let rec lb_pi
  prec =
    (let a = lapprox_rat prec one_inta (Int_of_integer (Z.of_int 5)) in
     let b = rapprox_rat prec one_inta (Int_of_integer (Z.of_int 239)) in
      times_floata (Float (one_inta, Int_of_integer (Z.of_int 2)))
        (float_plus_down prec
          (times_floata (Float (one_inta, Int_of_integer (Z.of_int 2)))
            (float_round_down prec
              (times_floata a
                (lb_arctan_horner prec
                  (get_even
                    (plus_nata (divide_nata prec (nat_of_integer (Z.of_int 4)))
                      one_nata))
                  one_nata (float_round_up (suc prec) (times_floata a a))))))
          (uminus_floata
            (float_round_up prec
              (times_floata b
                (ub_arctan_horner prec
                  (get_odd
                    (plus_nata (divide_nata prec (nat_of_integer (Z.of_int 14)))
                      one_nata))
                  one_nata
                  (float_round_down (suc prec) (times_floata b b))))))));;

let rec ub_pi
  prec =
    (let a = rapprox_rat prec one_inta (Int_of_integer (Z.of_int 5)) in
     let b = lapprox_rat prec one_inta (Int_of_integer (Z.of_int 239)) in
      times_floata (Float (one_inta, Int_of_integer (Z.of_int 2)))
        (float_plus_up prec
          (times_floata (Float (one_inta, Int_of_integer (Z.of_int 2)))
            (float_round_up prec
              (times_floata a
                (ub_arctan_horner prec
                  (get_odd
                    (plus_nata (divide_nata prec (nat_of_integer (Z.of_int 4)))
                      one_nata))
                  one_nata (float_round_down (suc prec) (times_floata a a))))))
          (uminus_floata
            (float_round_down prec
              (times_floata b
                (lb_arctan_horner prec
                  (get_even
                    (plus_nata (divide_nata prec (nat_of_integer (Z.of_int 14)))
                      one_nata))
                  one_nata
                  (float_round_up (suc prec) (times_floata b b))))))));;

let rec ub_arctan
  prec x =
    (let lb_horner =
       (fun xa ->
         float_round_down prec
           (times_floata xa
             (lb_arctan_horner prec
               (get_even
                 (plus_nata (divide_nata prec (nat_of_integer (Z.of_int 4)))
                   one_nata))
               one_nata (float_round_up (suc prec) (times_floata xa xa)))))
       in
     let ub_horner =
       (fun xa ->
         float_round_up prec
           (times_floata xa
             (ub_arctan_horner prec
               (get_odd
                 (plus_nata (divide_nata prec (nat_of_integer (Z.of_int 4)))
                   one_nata))
               one_nata (float_round_down (suc prec) (times_floata xa xa)))))
       in
      (if less_float x (Float (zero_int, zero_int))
        then uminus_floata (lb_arctan prec (uminus_floata x))
        else (if less_eq_float x (Float (one_inta, uminus_int one_inta))
               then ub_horner x
               else (if less_eq_float x (Float (one_inta, one_inta))
                      then (let y =
                              float_divr prec x
                                (float_plus_down (suc prec)
                                  (Float (one_inta, zero_int))
                                  (lb_sqrt prec
                                    (float_plus_down prec
                                      (Float (one_inta, zero_int))
                                      (float_round_down prec
(times_floata x x)))))
                              in
                             (if less_float (Float (one_inta, zero_int)) y
                               then times_floata (ub_pi prec)
                                      (Float (one_inta, uminus_int one_inta))
                               else times_floata (Float (one_inta, one_inta))
                                      (ub_horner y)))
                      else float_plus_up prec
                             (times_floata (ub_pi prec)
                               (Float (one_inta, uminus_int one_inta)))
                             (uminus_floata
                               (lb_horner
                                 (float_divl prec (Float (one_inta, zero_int))
                                   x)))))))
and lb_arctan
  prec x =
    (let ub_horner =
       (fun xa ->
         float_round_up prec
           (times_floata xa
             (ub_arctan_horner prec
               (get_odd
                 (plus_nata (divide_nata prec (nat_of_integer (Z.of_int 4)))
                   one_nata))
               one_nata (float_round_down (suc prec) (times_floata xa xa)))))
       in
     let lb_horner =
       (fun xa ->
         float_round_down prec
           (times_floata xa
             (lb_arctan_horner prec
               (get_even
                 (plus_nata (divide_nata prec (nat_of_integer (Z.of_int 4)))
                   one_nata))
               one_nata (float_round_up (suc prec) (times_floata xa xa)))))
       in
      (if less_float x (Float (zero_int, zero_int))
        then uminus_floata (ub_arctan prec (uminus_floata x))
        else (if less_eq_float x (Float (one_inta, uminus_int one_inta))
               then lb_horner x
               else (if less_eq_float x (Float (one_inta, one_inta))
                      then times_floata (Float (one_inta, one_inta))
                             (lb_horner
                               (float_divl prec x
                                 (float_plus_up prec
                                   (Float (one_inta, zero_int))
                                   (ub_sqrt prec
                                     (float_plus_up prec
                                       (Float (one_inta, zero_int))
                                       (float_round_up prec
 (times_floata x x)))))))
                      else (let inv =
                              float_divr prec (Float (one_inta, zero_int)) x in
                             (if less_float (Float (one_inta, zero_int)) inv
                               then Float (zero_int, zero_int)
                               else float_plus_down prec
                                      (times_floata (lb_pi prec)
(Float (one_inta, uminus_int one_inta)))
                                      (uminus_floata (ub_horner inv))))))));;

let rec arctan_float_interval
  xb xc =
    Interval
      (let (lx, ux) = bounds_of_interval preorder_float xc in
        (lb_arctan xb lx, ub_arctan xb ux));;

let rec power_down_fl
  p x n =
    (if equal_nata n zero_nata then Float (one_inta, zero_int)
      else (if not (dvd (equal_nat, semidom_modulo_nat)
                     (nat_of_integer (Z.of_int 2)) (minus_nata n one_nata))
             then float_round_down (suc p)
                    (power power_float
                      (power_down_fl p x
                        (divide_nata (suc (minus_nata n one_nata))
                          (nat_of_integer (Z.of_int 2))))
                      (nat_of_integer (Z.of_int 2)))
             else float_round_down (suc p)
                    (times_floata x
                      (power_down_fl p x (minus_nata n one_nata)))));;

let rec power_up_fl
  p x n =
    (if equal_nata n zero_nata then Float (one_inta, zero_int)
      else (if not (dvd (equal_nat, semidom_modulo_nat)
                     (nat_of_integer (Z.of_int 2)) (minus_nata n one_nata))
             then float_round_up p
                    (power power_float
                      (power_up_fl p x
                        (divide_nata (suc (minus_nata n one_nata))
                          (nat_of_integer (Z.of_int 2))))
                      (nat_of_integer (Z.of_int 2)))
             else float_round_up p
                    (times_floata x
                      (power_up_fl p x (minus_nata n one_nata)))));;

let rec float_power_bnds
  prec n l u =
    (if less_float (Float (zero_int, zero_int)) l
      then (power_down_fl prec l n, power_up_fl prec u n)
      else (if not (dvd (equal_nat, semidom_modulo_nat)
                     (nat_of_integer (Z.of_int 2)) n)
             then (uminus_floata (power_up_fl prec (abs_floata l) n),
                    (if less_float u (Float (zero_int, zero_int))
                      then uminus_floata (power_down_fl prec (abs_floata u) n)
                      else power_up_fl prec u n))
             else (if less_float u (Float (zero_int, zero_int))
                    then (power_down_fl prec (abs_floata u) n,
                           power_up_fl prec (abs_floata l) n)
                    else (Float (zero_int, zero_int),
                           power_up_fl prec
                             (max ord_float (abs_floata l) (abs_floata u))
                             n))));;

let rec power_float_interval
  xc xd xe =
    Interval
      (let (a, b) = bounds_of_interval preorder_float xe in
        float_power_bnds xc xd a b);;

let rec sqrt_float_interval
  xb xc =
    Interval
      (let (lx, ux) = bounds_of_interval preorder_float xc in
        (lb_sqrt xb lx, ub_sqrt xb ux));;

let rec rep_float_interval_option_x_x_float_float_prod_option
  (Abs_float_interval_option_x_x_float_float_prod_option x) = x;;

let rec sel21
  xa = Interval
         (match rep_float_interval_option_x_x_float_float_prod_option xa
           with None -> bounds_of_interval preorder_float (failwith "undefined")
           | Some x2 -> x2);;

let rec dis1
  xa = (match rep_float_interval_option_x_x_float_float_prod_option xa
         with None -> true | Some _ -> false);;

let rec rep_isom x = (if dis1 x then None else Some (sel21 x));;

let rec is_float_zero (Float (m, e)) = equal_int zero_int m;;

let rec equal_float f g = is_float_zero (minus_floata f g);;

let rec pprt _A
  x = sup _A.lattice_lattice_ab_group_add.semilattice_sup_lattice.sup_semilattice_sup
        x (zero _A.semilattice_inf_ab_group_add_lattice_ab_group_add.ordered_ab_group_add_semilattice_inf_ab_group_add.ab_group_add_ordered_ab_group_add.group_add_ab_group_add.monoid_add_group_add.zero_monoid_add);;

let rec nprt _A
  x = inf _A.lattice_lattice_ab_group_add.semilattice_inf_lattice.inf_semilattice_inf
        x (zero _A.semilattice_inf_ab_group_add_lattice_ab_group_add.ordered_ab_group_add_semilattice_inf_ab_group_add.ab_group_add_ordered_ab_group_add.group_add_ab_group_add.monoid_add_group_add.zero_monoid_add);;

let rec bnds_mult
  prec a1 a2 b1 b2 =
    (float_plus_down prec
       (times_floata (nprt lattice_ab_group_add_float a1)
         (pprt lattice_ab_group_add_float b2))
       (float_plus_down prec
         (times_floata (nprt lattice_ab_group_add_float a2)
           (nprt lattice_ab_group_add_float b2))
         (float_plus_down prec
           (times_floata (pprt lattice_ab_group_add_float a1)
             (pprt lattice_ab_group_add_float b1))
           (times_floata (pprt lattice_ab_group_add_float a2)
             (nprt lattice_ab_group_add_float b1)))),
      float_plus_up prec
        (times_floata (pprt lattice_ab_group_add_float a2)
          (pprt lattice_ab_group_add_float b2))
        (float_plus_up prec
          (times_floata (pprt lattice_ab_group_add_float a1)
            (nprt lattice_ab_group_add_float b2))
          (float_plus_up prec
            (times_floata (nprt lattice_ab_group_add_float a2)
              (pprt lattice_ab_group_add_float b1))
            (times_floata (nprt lattice_ab_group_add_float a1)
              (nprt lattice_ab_group_add_float b1)))));;

let rec map_bnds lb ub prec = (fun (l, u) -> (lb prec l, ub prec u));;

let rec ub_exp_horner
  prec n i k x =
    (if equal_nata n zero_nata then Float (zero_int, zero_int)
      else float_plus_up prec (rapprox_rat prec one_inta (int_of_nat k))
             (float_round_up prec
               (times_floata x
                 (lb_exp_horner prec (minus_nata n one_nata)
                   (plus_nata i one_nata) (times_nata k i) x))))
and lb_exp_horner
  prec n i k x =
    (if equal_nata n zero_nata then Float (zero_int, zero_int)
      else float_plus_down prec (lapprox_rat prec one_inta (int_of_nat k))
             (float_round_down prec
               (times_floata x
                 (ub_exp_horner prec (minus_nata n one_nata)
                   (plus_nata i one_nata) (times_nata k i) x))));;

let rec int_floor_fl
  (Float (m, e)) =
    (if less_eq_int zero_int e
      then times_inta m (power power_int (Int_of_integer (Z.of_int 2)) (nat e))
      else divide_int m
             (power power_int (Int_of_integer (Z.of_int 2))
               (nat (uminus_int e))));;

let rec ub_exp
  prec x =
    (if less_float (Float (zero_int, zero_int)) x
      then float_divr prec (Float (one_inta, zero_int))
             (lb_exp prec (uminus_floata x))
      else (if less_float x (uminus_floata (Float (one_inta, zero_int)))
             then power_up_fl prec
                    (ub_exp_horner prec
                      (get_odd (plus_nata prec (nat_of_integer (Z.of_int 2))))
                      one_nata one_nata
                      (float_divr prec x (uminus_floata (floor_fl x))))
                    (nat (uminus_int (int_floor_fl x)))
             else ub_exp_horner prec
                    (get_odd (plus_nata prec (nat_of_integer (Z.of_int 2))))
                    one_nata one_nata x))
and lb_exp
  prec x =
    (if less_float (Float (zero_int, zero_int)) x
      then float_divl prec (Float (one_inta, zero_int))
             (ub_exp prec (uminus_floata x))
      else (let horner =
              (fun xa ->
                (let y =
                   lb_exp_horner prec
                     (get_even (plus_nata prec (nat_of_integer (Z.of_int 2))))
                     one_nata one_nata xa
                   in
                  (if less_eq_float y (Float (zero_int, zero_int))
                    then Float (one_inta,
                                 uminus_int (Int_of_integer (Z.of_int 2)))
                    else y)))
              in
             (if less_float x (uminus_floata (Float (one_inta, zero_int)))
               then power_down_fl prec
                      (horner (float_divl prec x (uminus_floata (floor_fl x))))
                      (nat (uminus_int (int_floor_fl x)))
               else horner x)));;

let rec ub_ln_horner
  prec n i x =
    (if equal_nata n zero_nata then Float (zero_int, zero_int)
      else float_plus_up prec (rapprox_rat prec one_inta (int_of_nat i))
             (uminus_floata
               (float_round_down prec
                 (times_floata x
                   (lb_ln_horner prec (minus_nata n one_nata) (suc i) x)))))
and lb_ln_horner
  prec n i x =
    (if equal_nata n zero_nata then Float (zero_int, zero_int)
      else float_plus_down prec (lapprox_rat prec one_inta (int_of_nat i))
             (uminus_floata
               (float_round_up prec
                 (times_floata x
                   (ub_ln_horner prec (minus_nata n one_nata) (suc i) x)))));;

let rec ub_ln2
  prec =
    (let third =
       rapprox_rat (max ord_nat prec one_nata) one_inta
         (Int_of_integer (Z.of_int 3))
       in
      float_plus_up prec
        (times_floata (Float (one_inta, uminus_int one_inta))
          (ub_ln_horner prec (get_odd prec) one_nata
            (Float (one_inta, uminus_int one_inta))))
        (float_round_up prec
          (times_floata third
            (ub_ln_horner prec (get_odd prec) one_nata third))));;

let rec lb_ln2
  prec =
    (let third = lapprox_rat prec one_inta (Int_of_integer (Z.of_int 3)) in
      float_plus_down prec
        (times_floata (Float (one_inta, uminus_int one_inta))
          (lb_ln_horner prec (get_even prec) one_nata
            (Float (one_inta, uminus_int one_inta))))
        (float_round_down prec
          (times_floata third
            (lb_ln_horner prec (get_even prec) one_nata third))));;

let rec the (Some x2) = x2;;

let rec ub_ln
  prec (Float (m, e)) =
    (if less_eq_float (Float (m, e)) (Float (zero_int, zero_int)) then None
      else (if less_float (Float (m, e)) (Float (one_inta, zero_int))
             then Some (uminus_floata
                         (the (lb_ln prec
                                (float_divl (max ord_nat prec one_nata)
                                  (Float (one_inta, zero_int))
                                  (Float (m, e))))))
             else (let horner =
                     (fun x ->
                       float_round_up prec
                         (times_floata x
                           (ub_ln_horner prec (get_odd prec) one_nata x)))
                     in
                    (if less_eq_float (Float (m, e))
                          (Float
                            (Int_of_integer (Z.of_int 3), uminus_int one_inta))
                      then Some (horner
                                  (minus_floata (Float (m, e))
                                    (Float (one_inta, zero_int))))
                      else (if less_float (Float (m, e))
                                 (Float (one_inta, one_inta))
                             then Some (float_round_up prec
 (plus_floata (horner (Float (one_inta, uminus_int one_inta)))
   (horner
     (minus_floata
       (times_floata (Float (m, e))
         (rapprox_rat prec (Int_of_integer (Z.of_int 2))
           (Int_of_integer (Z.of_int 3))))
       (Float (one_inta, zero_int))))))
                             else (let l = minus_int (bitlen m) one_inta in
                                    Some (float_plus_up prec
   (float_round_up prec
     (times_floata (ub_ln2 prec) (Float (plus_int e l, zero_int))))
   (horner
     (minus_floata (Float (m, uminus_int l))
       (Float (one_inta, zero_int)))))))))))
and lb_ln
  prec (Float (m, e)) =
    (if less_eq_float (Float (m, e)) (Float (zero_int, zero_int)) then None
      else (if less_float (Float (m, e)) (Float (one_inta, zero_int))
             then Some (uminus_floata
                         (the (ub_ln prec
                                (float_divr prec (Float (one_inta, zero_int))
                                  (Float (m, e))))))
             else (let horner =
                     (fun x ->
                       float_round_down prec
                         (times_floata x
                           (lb_ln_horner prec (get_even prec) one_nata x)))
                     in
                    (if less_eq_float (Float (m, e))
                          (Float
                            (Int_of_integer (Z.of_int 3), uminus_int one_inta))
                      then Some (horner
                                  (minus_floata (Float (m, e))
                                    (Float (one_inta, zero_int))))
                      else (if less_float (Float (m, e))
                                 (Float (one_inta, one_inta))
                             then Some (float_round_down prec
 (plus_floata (horner (Float (one_inta, uminus_int one_inta)))
   (horner
     (max ord_float
       (minus_floata
         (times_floata (Float (m, e))
           (lapprox_rat prec (Int_of_integer (Z.of_int 2))
             (Int_of_integer (Z.of_int 3))))
         (Float (one_inta, zero_int)))
       (Float (zero_int, zero_int))))))
                             else (let l = minus_int (bitlen m) one_inta in
                                    Some (float_plus_down prec
   (float_round_down prec
     (times_floata (lb_ln2 prec) (Float (plus_int e l, zero_int))))
   (horner
     (minus_floata (Float (m, uminus_int l))
       (Float (one_inta, zero_int)))))))))));;

let rec bnds_powr
  prec l1 u1 l2 u2 =
    (if equal_float l1 (Float (zero_int, zero_int)) &&
          equal_float u1 (Float (zero_int, zero_int))
      then Some (Float (zero_int, zero_int), Float (zero_int, zero_int))
      else (if equal_float l1 (Float (zero_int, zero_int)) &&
                 less_eq_float (Float (one_inta, zero_int)) l2
             then (let uln = the (ub_ln prec u1) in
                    Some (Float (zero_int, zero_int),
                           ub_exp prec
                             (float_round_up prec
                               (times_floata uln
                                 (if less_eq_float (Float (zero_int, zero_int))
                                       uln
                                   then u2 else l2)))))
             else (if less_eq_float l1 (Float (zero_int, zero_int)) then None
                    else Some (map_bnds lb_exp ub_exp prec
                                (bnds_mult prec (the (lb_ln prec l1))
                                  (the (ub_ln prec u1)) l2 u2)))));;

let rec powr_float_interval_aux
  xc xd xe =
    Abs_float_interval_option_x_x_float_float_prod_option
      ((let (l1, u1) = bounds_of_interval preorder_float xd in
         (fun (a, b) -> bnds_powr xc l1 u1 a b))
        (bounds_of_interval preorder_float xe));;

let rec powr_float_interval
  x1 x2 x3 = rep_isom (powr_float_interval_aux x1 x2 x3);;

let rec plus_float_interval
  xc xd xe =
    Interval
      ((let (a1, a2) = bounds_of_interval preorder_float xd in
         (fun (b1, b2) -> (float_plus_down xc a1 b1, float_plus_up xc a2 b2)))
        (bounds_of_interval preorder_float xe));;

let rec mult_float_interval
  xc xd xe =
    Interval
      ((let (a1, a2) = bounds_of_interval preorder_float xd in
         (fun (a, b) -> bnds_mult xc a1 a2 a b))
        (bounds_of_interval preorder_float xe));;

let rec exp_float_interval
  xb xc =
    Interval
      (let (lx, ux) = bounds_of_interval preorder_float xc in
        (lb_exp xb lx, ub_exp xb ux));;

let rec ub_sin_cos_aux
  prec n i k x =
    (if equal_nata n zero_nata then Float (zero_int, zero_int)
      else float_plus_up prec (rapprox_rat prec one_inta (int_of_nat k))
             (uminus_floata
               (float_round_down prec
                 (times_floata x
                   (lb_sin_cos_aux prec (minus_nata n one_nata)
                     (plus_nata i (nat_of_integer (Z.of_int 2)))
                     (times_nata (times_nata k i) (plus_nata i one_nata)) x)))))
and lb_sin_cos_aux
  prec n i k x =
    (if equal_nata n zero_nata then Float (zero_int, zero_int)
      else float_plus_down prec (lapprox_rat prec one_inta (int_of_nat k))
             (uminus_floata
               (float_round_up prec
                 (times_floata x
                   (ub_sin_cos_aux prec (minus_nata n one_nata)
                     (plus_nata i (nat_of_integer (Z.of_int 2)))
                     (times_nata (times_nata k i) (plus_nata i one_nata))
                     x)))));;

let rec ub_cos
  prec x =
    (let horner =
       (fun xa ->
         ub_sin_cos_aux prec
           (get_odd
             (plus_nata (divide_nata prec (nat_of_integer (Z.of_int 4)))
               one_nata))
           one_nata one_nata (times_floata xa xa))
       in
     let half =
       (fun xa ->
         float_plus_up prec
           (times_floata (times_floata (Float (one_inta, one_inta)) xa) xa)
           (uminus_floata (Float (one_inta, zero_int))))
       in
      (if less_float x (Float (one_inta, uminus_int one_inta)) then horner x
        else (if less_float x (Float (one_inta, zero_int))
               then half (horner
                           (times_floata x
                             (Float (one_inta, uminus_int one_inta))))
               else half (half (horner
                                 (times_floata x
                                   (Float
                                     (one_inta,
                                       uminus_int
 (Int_of_integer (Z.of_int 2))))))))));;

let rec lb_cos
  prec x =
    (let horner =
       (fun xa ->
         lb_sin_cos_aux prec
           (get_even
             (plus_nata (divide_nata prec (nat_of_integer (Z.of_int 4)))
               one_nata))
           one_nata one_nata (times_floata xa xa))
       in
     let half =
       (fun xa ->
         (if less_float xa (Float (zero_int, zero_int))
           then uminus_floata (Float (one_inta, zero_int))
           else float_plus_down prec
                  (times_floata (times_floata (Float (one_inta, one_inta)) xa)
                    xa)
                  (uminus_floata (Float (one_inta, zero_int)))))
       in
      (if less_float x (Float (one_inta, uminus_int one_inta)) then horner x
        else (if less_float x (Float (one_inta, zero_int))
               then half (horner
                           (times_floata x
                             (Float (one_inta, uminus_int one_inta))))
               else half (half (horner
                                 (times_floata x
                                   (Float
                                     (one_inta,
                                       uminus_int
 (Int_of_integer (Z.of_int 2))))))))));;

let rec bnds_cos
  prec lx ux =
    (let lpi = float_round_down prec (lb_pi prec) in
     let upi = float_round_up prec (ub_pi prec) in
     let k =
       floor_fl
         (float_divr prec (plus_floata lx lpi)
           (times_floata (Float (Int_of_integer (Z.of_int 2), zero_int)) lpi))
       in
     let lxa =
       float_plus_down prec lx
         (times_floata
           (times_floata (uminus_floata k)
             (Float (Int_of_integer (Z.of_int 2), zero_int)))
           (if less_float k (Float (zero_int, zero_int)) then lpi else upi))
       in
     let uxa =
       float_plus_up prec ux
         (times_floata
           (times_floata (uminus_floata k)
             (Float (Int_of_integer (Z.of_int 2), zero_int)))
           (if less_float k (Float (zero_int, zero_int)) then upi else lpi))
       in
      (if less_eq_float (uminus_floata lpi) lxa &&
            less_eq_float uxa (Float (zero_int, zero_int))
        then (lb_cos prec (uminus_floata lxa), ub_cos prec (uminus_floata uxa))
        else (if less_eq_float (Float (zero_int, zero_int)) lxa &&
                   less_eq_float uxa lpi
               then (lb_cos prec uxa, ub_cos prec lxa)
               else (if less_eq_float (uminus_floata lpi) lxa &&
                          less_eq_float uxa lpi
                      then (min ord_float (lb_cos prec (uminus_floata lxa))
                              (lb_cos prec uxa),
                             Float (one_inta, zero_int))
                      else (if less_eq_float (Float (zero_int, zero_int)) lxa &&
                                 less_eq_float uxa
                                   (times_floata
                                     (Float
                                       (Int_of_integer (Z.of_int 2), zero_int))
                                     lpi)
                             then (Float (uminus_int one_inta, zero_int),
                                    max ord_float (ub_cos prec lxa)
                                      (ub_cos prec
(uminus_floata
  (minus_floata uxa
    (times_floata (Float (Int_of_integer (Z.of_int 2), zero_int)) lpi)))))
                             else (if less_eq_float
(times_floata (uminus_floata (Float (Int_of_integer (Z.of_int 2), zero_int)))
  lpi)
lxa &&
less_eq_float uxa (Float (zero_int, zero_int))
                                    then (Float (uminus_int one_inta, zero_int),
   max ord_float
     (ub_cos prec
       (plus_floata lxa
         (times_floata (Float (Int_of_integer (Z.of_int 2), zero_int)) lpi)))
     (ub_cos prec (uminus_floata uxa)))
                                    else (Float (uminus_int one_inta, zero_int),
   Float (one_inta, zero_int))))))));;

let rec cos_float_interval
  xb xc =
    Interval
      (let (a, b) = bounds_of_interval preorder_float xc in bnds_cos xb a b);;

let rec pi_float_interval xa = Interval (lb_pi xa, ub_pi xa);;

let rec ln_float_interval_aux
  xb xc =
    Abs_float_interval_option_x_x_float_float_prod_option
      (let (lx, ux) = bounds_of_interval preorder_float xc in
        bind (lb_ln xb lx)
          (fun l -> bind (ub_ln xb ux) (fun u -> Some (l, u))));;

let rec ln_float_interval x1 x2 = rep_isom (ln_float_interval_aux x1 x2);;

let rec inverse_float_interval_aux
  xb xc =
    Abs_float_interval_option_x_x_float_float_prod_option
      (let (l, u) = bounds_of_interval preorder_float xc in
        (if less_float (Float (zero_int, zero_int)) l ||
              less_float u (Float (zero_int, zero_int))
          then Some (float_divl xb (Float (one_inta, zero_int)) u,
                      float_divr xb (Float (one_inta, zero_int)) l)
          else None));;

let rec inverse_float_interval
  x1 x2 = rep_isom (inverse_float_interval_aux x1 x2);;

let rec floor_float_interval
  xa = Interval
         (let (l, u) = bounds_of_interval preorder_float xa in
           (floor_fl l, floor_fl u));;

let rec length_tailrec x0 n = match x0, n with [], n -> n
                         | x :: xs, n -> length_tailrec xs (suc n);;

let rec size_list xs = length_tailrec xs zero_nata;;

let rec lift_bina
  a b f = match a, b, f with Some ivl1, Some ivl2, f -> Some (f ivl1 ivl2)
    | None, b, f -> None
    | a, None, f -> None;;

let rec lift_una x0 f = match x0, f with Some ivl1, f -> Some (f ivl1)
                   | None, f -> None;;

let rec lift_bin
  a b f = match a, b, f with Some ivl1, Some ivl2, f -> f ivl1 ivl2
    | None, b, f -> None
    | a, None, f -> None;;

let rec min_interval _A
  xb xc =
    Interval
      ((let (l1, u1) = bounds_of_interval _A.order_linorder.preorder_order xb in
         (fun (l2, u2) ->
           (min _A.order_linorder.preorder_order.ord_preorder l1 l2,
             min _A.order_linorder.preorder_order.ord_preorder u1 u2)))
        (bounds_of_interval _A.order_linorder.preorder_order xc));;

let rec max_interval _A
  xb xc =
    Interval
      ((let (l1, u1) = bounds_of_interval _A.order_linorder.preorder_order xb in
         (fun (l2, u2) ->
           (max _A.order_linorder.preorder_order.ord_preorder l1 l2,
             max _A.order_linorder.preorder_order.ord_preorder u1 u2)))
        (bounds_of_interval _A.order_linorder.preorder_order xc));;

let rec abs_interval _A
  xa = Interval
         (let (l, u) =
            bounds_of_interval
              _A.linordered_semidom_linordered_idom.linordered_nonzero_semiring_linordered_semidom.linorder_linordered_nonzero_semiring.order_linorder.preorder_order
              xa
            in
           ((if less _A.linordered_ring_strict_linordered_idom.linordered_ring_linordered_ring_strict.abs_if_linordered_ring.ord_abs_if
                  l (zero _A.linordered_ring_strict_linordered_idom.linordered_ring_linordered_ring_strict.abs_if_linordered_ring.zero_abs_if) &&
                  less _A.linordered_ring_strict_linordered_idom.linordered_ring_linordered_ring_strict.abs_if_linordered_ring.ord_abs_if
                    (zero _A.linordered_ring_strict_linordered_idom.linordered_ring_linordered_ring_strict.abs_if_linordered_ring.zero_abs_if)
                    u
              then zero _A.linordered_ring_strict_linordered_idom.linordered_ring_linordered_ring_strict.abs_if_linordered_ring.zero_abs_if
              else min _A.linordered_ring_strict_linordered_idom.linordered_ring_linordered_ring_strict.abs_if_linordered_ring.ord_abs_if
                     (abs _A.linordered_ring_strict_linordered_idom.linordered_ring_linordered_ring_strict.abs_if_linordered_ring.abs_abs_if
                       l)
                     (abs _A.linordered_ring_strict_linordered_idom.linordered_ring_linordered_ring_strict.abs_if_linordered_ring.abs_abs_if
                       u)),
             max _A.linordered_ring_strict_linordered_idom.linordered_ring_linordered_ring_strict.abs_if_linordered_ring.ord_abs_if
               (abs _A.linordered_ring_strict_linordered_idom.linordered_ring_linordered_ring_strict.abs_if_linordered_ring.abs_abs_if
                 l)
               (abs _A.linordered_ring_strict_linordered_idom.linordered_ring_linordered_ring_strict.abs_if_linordered_ring.abs_abs_if
                 u)));;

let rec lift_un x0 f = match x0, f with Some ivl, f -> f ivl
                  | None, f -> None;;

let rec round_interval
  xb xc =
    Interval
      (let (l, u) = bounds_of_interval preorder_float xc in
        (float_round_down xb l, float_round_up xb u));;

let rec interval_of _A xa = Interval (xa, xa);;

let rec approx
  prec x1 bs = match prec, x1, bs with
    prec, Add (a, b), bs ->
      lift_bina (approxa prec a bs) (approxa prec b bs)
        (plus_float_interval prec)
    | prec, Minus a, bs ->
        lift_una (approxa prec a bs)
          (uminus_interval ordered_ab_group_add_float)
    | prec, Mult (a, b), bs ->
        lift_bina (approxa prec a bs) (approxa prec b bs)
          (mult_float_interval prec)
    | prec, Inverse a, bs ->
        lift_un (approxa prec a bs) (inverse_float_interval prec)
    | prec, Cos a, bs -> lift_una (approxa prec a bs) (cos_float_interval prec)
    | prec, Pi, bs -> Some (pi_float_interval prec)
    | prec, Min (a, b), bs ->
        lift_bina (approxa prec a bs) (approxa prec b bs)
          (min_interval linorder_float)
    | prec, Max (a, b), bs ->
        lift_bina (approxa prec a bs) (approxa prec b bs)
          (max_interval linorder_float)
    | prec, Abs a, bs ->
        lift_una (approxa prec a bs) (abs_interval linordered_idom_float)
    | prec, Arctan a, bs ->
        lift_una (approxa prec a bs) (arctan_float_interval prec)
    | prec, Sqrt a, bs ->
        lift_una (approxa prec a bs) (sqrt_float_interval prec)
    | prec, Exp a, bs -> lift_una (approxa prec a bs) (exp_float_interval prec)
    | prec, Powr (a, b), bs ->
        lift_bin (approxa prec a bs) (approxa prec b bs)
          (powr_float_interval prec)
    | prec, Ln a, bs -> lift_un (approxa prec a bs) (ln_float_interval prec)
    | prec, Power (a, n), bs ->
        lift_una (approxa prec a bs) (power_float_interval prec n)
    | prec, Floor a, bs -> lift_una (approxa prec a bs) floor_float_interval
    | prec, Num f, bs -> Some (interval_of preorder_float f)
    | prec, Var i, bs -> (if less_nat i (size_list bs) then nth bs i else None)
and approxa
  prec a bs =
    (match approx prec a bs with None -> None
      | Some ivl -> Some (round_interval prec ivl));;

let rec divide_real (Ratreal x) (Ratreal y) = Ratreal (divide_rat x y);;

let rec less_eq_real (Ratreal x) (Ratreal y) = less_eq_rat x y;;

let rec minus_real (Ratreal x) (Ratreal y) = Ratreal (minus_rat x y);;

let zero_real : real = Ratreal zero_rat;;

let rec plus_real (Ratreal x) (Ratreal y) = Ratreal (plus_rat x y);;

let rec uminus_rat p = Frct (let (a, b) = quotient_of p in (uminus_int a, b));;

let rec uminus_real (Ratreal x) = Ratreal (uminus_rat x);;

let rec less_real (Ratreal x) (Ratreal y) = less_rat x y;;

let rec abs_real a = (if less_real a zero_real then uminus_real a else a);;

let rec real_of_float
  (Float (m, e)) =
    (if less_eq_int zero_int e
      then times_reala (Ratreal (of_int m))
             (power power_real (Ratreal (of_int (Int_of_integer (Z.of_int 2))))
               (nat e))
      else divide_real (Ratreal (of_int m))
             (power power_real (Ratreal (of_int (Int_of_integer (Z.of_int 2))))
               (nat (uminus_int e))));;

let rec floor_rat p = (let (a, b) = quotient_of p in divide_int a b);;

let rec floor_real (Ratreal x) = floor_rat x;;

let rec inverse_rat
  p = Frct (let (a, b) = quotient_of p in
             (if equal_int a zero_int then (zero_int, one_inta)
               else (times_inta (sgn_int a) b, abs_int a)));;

let rec inverse_real (Ratreal x) = Ratreal (inverse_rat x);;

let rec pow10
  k = (if less_eq_int zero_int k
        then power power_real (Ratreal (of_int (Int_of_integer (Z.of_int 10))))
               (nat k)
        else inverse_real
               (power power_real
                 (Ratreal (of_int (Int_of_integer (Z.of_int 10))))
                 (nat (uminus_int k))));;

let rec round_at
  x e = (floor_real
           (plus_real (divide_real x (pow10 e))
             (divide_real one_reala
               (Ratreal (of_int (Int_of_integer (Z.of_int 2)))))),
          e);;

let rec exp_down
  l x n e =
    (if equal_nata n zero_nata then e
      else (if less_real x (times_reala l (pow10 e))
             then exp_down l x (minus_nata n one_nata) (minus_int e one_inta)
             else e));;

let rec exp_up
  b x n e =
    (if equal_nata n zero_nata then e
      else (if less_eq_real (times_reala b (pow10 e)) x
             then exp_up b x (minus_nata n one_nata) (plus_int e one_inta)
             else e));;

let rec sig_exp
  p x = exp_down
          (power power_real (Ratreal (of_int (Int_of_integer (Z.of_int 10))))
            (minus_nata p one_nata))
          (abs_real x) (nat_of_integer (Z.of_int 400))
          (exp_up
            (power power_real (Ratreal (of_int (Int_of_integer (Z.of_int 10))))
              p)
            (abs_real x) (nat_of_integer (Z.of_int 400)) zero_int);;

let rec to_dec
  x = (let lo = real_of_float (lower preorder_float x) in
       let hi = real_of_float (upper preorder_float x) in
       let mid =
         divide_real (plus_real lo hi)
           (Ratreal (of_int (Int_of_integer (Z.of_int 2))))
         in
        (if less_eq_real lo zero_real &&
              (less_eq_real zero_real hi &&
                less_eq_real (minus_real hi lo)
                  (divide_real one_reala
                    (Ratreal (of_int (Int_of_integer (Z.of_int 1000000000))))))
          then Some (zero_int, zero_int)
          else (let e = sig_exp (nat_of_integer (Z.of_int 4)) mid in
                 (if less_eq_real (minus_real hi lo)
                       (divide_real (abs_real mid)
                         (Ratreal
                           (of_int (Int_of_integer (Z.of_int 1000000))))) &&
                       less_eq_real
                         (times_reala
                           (Ratreal (of_int (Int_of_integer (Z.of_int 1000))))
                           (pow10 e))
                         (abs_real mid)
                   then Some (round_at mid e) else None))));;

let rec enclose
  p e = (match approx p e [] with None -> None | Some a -> to_dec a);;

let rec approx_out
  k e = (match enclose prec e with None -> Decline Imprecise
          | Some a -> Approx (k, a));;

let rec period_fa
  k m = Mult (Mult (i (Int_of_integer (Z.of_int 2)), Pi),
               Sqrt (Mult (q (siq m), Inverse (q k))));;

let rec kind_of
  = function Density uu -> K_density
    | MassOf (uv, uw, ux) -> K_mass
    | VolumeOf (uy, uz, va) -> K_volume
    | Floats (vb, vc) -> K_floats
    | Convert (vd, Tmp ve, Tmp vf) -> K_temperature
    | Convert (vg, Lin v, vi) -> K_convert
    | Convert (vg, vh, Lin v) -> K_convert
    | ConvertDelta (vj, vk, vl) -> K_temperature_difference
    | SpringForce (vm, vn) -> K_force
    | SpringExtension (vo, vp) -> K_extension
    | SpringConstant (vq, vr) -> K_spring_constant
    | SpringEnergy (vs, vt) -> K_elastic_energy
    | SpringPeriod (vu, vv) -> K_period
    | SpringFrequency (vw, vx) -> K_frequency
    | PressureGauge (vy, vz) -> K_pressure_gauge
    | PressureAbs (wa, wb) -> K_pressure_abs
    | Buoyant (wc, wd) -> K_buoyant_force
    | Submerged (we, wf) -> K_submerged_fraction
    | FuelEnergy (wg, wh, wi) -> K_energy
    | FuelCO2 (wj, wk) -> K_co2
    | FuelMassNeeded (wl, wm) -> K_mass_needed
    | FuelNCV wn -> K_ncv
    | Hydrostatic (wo, wp, wq, wr, absolute) ->
        (if absolute then K_pressure_abs else K_pressure_gauge)
    | FuelUsefulEnergy (ws, wt, wu, wv) -> K_useful_energy
    | FuelUsefulMass (ww, wx, wy) -> K_useful_mass_needed
    | UnsupportedCondition wz -> K_model_condition;;

let rec answer_of
  = function
    Floats (s, f) -> Verdict (K_floats, less_rat (density s) (density f))
    | Submerged (s, f) ->
        (if less_rat (density s) (density f)
          then Exact (K_submerged_fraction, divide_rat (density s) (density f))
          else Verdict (K_sinks, false))
    | SpringPeriod (Some k, Some m) -> approx_out K_period (period_fa k m)
    | SpringFrequency (Some k, Some m) ->
        approx_out K_frequency (Inverse (period_fa k m))
    | Density v -> Exact (kind_of (Density v), qval (Density v))
    | MassOf (v, va, vb) ->
        Exact (kind_of (MassOf (v, va, vb)), qval (MassOf (v, va, vb)))
    | VolumeOf (v, va, vb) ->
        Exact (kind_of (VolumeOf (v, va, vb)), qval (VolumeOf (v, va, vb)))
    | Convert (v, va, vb) ->
        Exact (kind_of (Convert (v, va, vb)), qval (Convert (v, va, vb)))
    | ConvertDelta (v, va, vb) ->
        Exact (kind_of (ConvertDelta (v, va, vb)),
                qval (ConvertDelta (v, va, vb)))
    | SpringForce (v, va) ->
        Exact (kind_of (SpringForce (v, va)), qval (SpringForce (v, va)))
    | SpringExtension (v, va) ->
        Exact (kind_of (SpringExtension (v, va)),
                qval (SpringExtension (v, va)))
    | SpringConstant (v, va) ->
        Exact (kind_of (SpringConstant (v, va)), qval (SpringConstant (v, va)))
    | SpringEnergy (v, va) ->
        Exact (kind_of (SpringEnergy (v, va)), qval (SpringEnergy (v, va)))
    | SpringPeriod (None, va) ->
        Exact (kind_of (SpringPeriod (None, va)),
                qval (SpringPeriod (None, va)))
    | SpringPeriod (v, None) ->
        Exact (kind_of (SpringPeriod (v, None)), qval (SpringPeriod (v, None)))
    | SpringFrequency (None, va) ->
        Exact (kind_of (SpringFrequency (None, va)),
                qval (SpringFrequency (None, va)))
    | SpringFrequency (v, None) ->
        Exact (kind_of (SpringFrequency (v, None)),
                qval (SpringFrequency (v, None)))
    | PressureGauge (v, va) ->
        Exact (kind_of (PressureGauge (v, va)), qval (PressureGauge (v, va)))
    | PressureAbs (v, va) ->
        Exact (kind_of (PressureAbs (v, va)), qval (PressureAbs (v, va)))
    | Buoyant (v, va) ->
        Exact (kind_of (Buoyant (v, va)), qval (Buoyant (v, va)))
    | FuelEnergy (v, va, vb) ->
        Exact (kind_of (FuelEnergy (v, va, vb)), qval (FuelEnergy (v, va, vb)))
    | FuelCO2 (v, va) ->
        Exact (kind_of (FuelCO2 (v, va)), qval (FuelCO2 (v, va)))
    | FuelMassNeeded (v, va) ->
        Exact (kind_of (FuelMassNeeded (v, va)), qval (FuelMassNeeded (v, va)))
    | FuelNCV v -> Exact (kind_of (FuelNCV v), qval (FuelNCV v))
    | Hydrostatic (v, va, vb, vc, vd) ->
        Exact (kind_of (Hydrostatic (v, va, vb, vc, vd)),
                qval (Hydrostatic (v, va, vb, vc, vd)))
    | FuelUsefulEnergy (v, va, vb, vc) ->
        Exact (kind_of (FuelUsefulEnergy (v, va, vb, vc)),
                qval (FuelUsefulEnergy (v, va, vb, vc)))
    | FuelUsefulMass (v, va, vb) ->
        Exact (kind_of (FuelUsefulMass (v, va, vb)),
                qval (FuelUsefulMass (v, va, vb)))
    | UnsupportedCondition v ->
        Exact (kind_of (UnsupportedCondition v),
                qval (UnsupportedCondition v));;

let rec kernel
  r = (match decline_of r with None -> answer_of r | Some a -> Decline a);;

let rec mk_rat a b = fract (Int_of_integer a) (Int_of_integer b);;

let rec map_option f x1 = match f, x1 with f, None -> None
                     | f, Some x2 -> Some (f x2);;

let rec browser_material
  m = (if Z.equal m Z.zero then Some M_water
        else (if Z.equal m (Z.of_int 1) then Some M_steel
               else (if Z.equal m (Z.of_int 2) then Some M_petrol else None)));;

let rec browser_fraction
  r = (let (n, d) = quotient_of r in (integer_of_int n, integer_of_int d));;

let rec browser_mass
  m n d =
    (if Z.leq d Z.zero || Z.lt n Z.zero then None
      else (match browser_material m with None -> None
             | Some material ->
               (match
                 kernel
                   (MassOf (material, Some (mk_rat n d, U_litre), U_kilogram))
                 with Exact (K_density, _) -> None
                 | Exact (K_mass, value) -> Some (browser_fraction value)
                 | Exact (K_volume, _) -> None | Exact (K_floats, _) -> None
                 | Exact (K_convert, _) -> None
                 | Exact (K_temperature, _) -> None
                 | Exact (K_temperature_difference, _) -> None
                 | Exact (K_force, _) -> None | Exact (K_extension, _) -> None
                 | Exact (K_spring_constant, _) -> None
                 | Exact (K_elastic_energy, _) -> None
                 | Exact (K_period, _) -> None | Exact (K_frequency, _) -> None
                 | Exact (K_pressure_gauge, _) -> None
                 | Exact (K_pressure_abs, _) -> None
                 | Exact (K_buoyant_force, _) -> None
                 | Exact (K_submerged_fraction, _) -> None
                 | Exact (K_sinks, _) -> None | Exact (K_energy, _) -> None
                 | Exact (K_co2, _) -> None | Exact (K_mass_needed, _) -> None
                 | Exact (K_ncv, _) -> None | Exact (K_useful_energy, _) -> None
                 | Exact (K_useful_mass_needed, _) -> None
                 | Exact (K_model_condition, _) -> None | Approx (_, _) -> None
                 | Verdict (_, _) -> None | Decline _ -> None)));;

let rec browser_density
  m = map_option (comp browser_fraction density) (browser_material m);;

end;; (*struct Wmt_Quantity*)
