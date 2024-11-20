;; turn this into WASM using e.g. `wat2wasm hk.wat -o hk.wasm`

(module
  (import "js" "n" (global $js_n f64))
  (import "js" "memory" (memory 1))

  ;; output functions

  ;; log an f64 and clear it off the stack
  (import "console" "log" (func $log64 (param f64)))

  ;; log an i32 and clear it off the stack
  (func $log32 (param $x i32)
    local.get $x
    f64.convert_i32_u
    call $log64
  )

  ;; globals

  (global $n (mut i32) (i32.const 0))
  (global $nminus1 (mut i32) (i32.const 0))

  ;; memory locations

  (global $len_ptr (mut i32) (i32.const 0)) ;; we compute this at startup
  (global $prev_ptr (mut i32) (i32.const 0)) ;; we compute this at startup

  ;; memory lookup functions

  ;; get d[u][v] from memory address OFFSET + (N * U + V) * 8
  (func $get_d (param $u i32) (param $v i32) (result f64)
    global.get $n
    local.get $u
    i32.mul
    local.get $v
    i32.add

    i32.const 3 ;; 2^3 bytes per f64
    i32.shl

    f64.load
  )

  (func $get_len_ptr (param $s i32) (param $u i32) (result i32)
    global.get $nminus1
    local.get $s
    i32.mul
    local.get $u
    i32.add

    i32.const 3 ;; 2^3 bytes per f64
    i32.shl

    global.get $len_ptr
    i32.add
  )

  ;; get len[S][u] from memory address OFFSET + ((N - 1) * S + u) * 8
  (func $get_len (param $s i32) (param $u i32) (result f64)
    (call $get_len_ptr (local.get $s) (local.get $u))
    f64.load
  )

  ;; set len[S][u]
  (func $set_len (param $s i32) (param $u i32) (param $len f64)
    (call $get_len_ptr (local.get $s) (local.get $u))
    local.get $len
    f64.store
  )

  (func $get_prev_ptr (param $s i32) (param $u i32) (result i32)
    global.get $nminus1
    local.get $s
    i32.mul
    local.get $u
    i32.add

    i32.const 2 ;; 2^2 bytes per i32
    i32.shl

    global.get $prev_ptr
    i32.add
  )

  ;; set prev[S][u] at memory address OFFSET + ((N - 1) * S + u) * 4
  (func $set_prev (param $s i32) (param $u i32) (param $prev i32)
    (call $get_prev_ptr (local.get $s) (local.get $u))
    local.get $prev
    i32.store
  )

  ;; Actual work

  (func $doHK (result f64)
    (local $d_size i32)
    (local $len_size i32)

    (local $all i32)
    (local $s i32)
    (local $s2 i32)

    (local $u i32)
    (local $v i32)
    (local $bestU i32)

    (local $l f64)
    (local $bestL f64)

    ;; get N,
    ;; compute N - 1,
    (global.set $n (i32.trunc_f64_s (global.get $js_n)))
    (global.set $nminus1 (i32.sub (global.get $n) (i32.const 1)))

    ;; compute size of `d` in memory: (n * n) << 3 (bytes per f64)
    (local.set $d_size (i32.shl (i32.mul (global.get $n) (global.get $n)) (i32.const 3)))

    ;; compute location of `len` in memory
    (global.set $len_ptr (local.get $d_size))

    ;; compute size of `len` in memory: (2^(n - 1) * (n - 1)) << 3 (bytes per f64)
    (local.set $len_size (i32.shl (i32.mul (i32.shl (i32.const 1) (global.get $nminus1)) (global.get $nminus1)) (i32.const 3)))

    ;; compute location of `prev` in memory
    (global.set $prev_ptr (i32.add (global.get $len_ptr) (local.get $len_size)))
    
    ;; compute $all = 2 ** (N - 1) - 1
    (local.set $all (i32.sub (i32.shl (i32.const 1) (global.get $nminus1)) (i32.const 1)))

    ;; OK LET'S RIDE

    (local.set $s (i32.const 1))

    (block $s_block (loop $s_loop
      ;; break if $s > $all
      (br_if $s_block (i32.gt_u (local.get $s) (local.get $all)))

      (local.set $v (i32.const 0))
      (block $v_block (loop $v_loop
        ;; break if v = n - 1
        (br_if $v_block (i32.eq (local.get $v) (global.get $nminus1)))

        ;; Compute S2 = S ^ (1 << v)
        (local.set $s2 (i32.xor (local.get $s) (i32.shl (i32.const 1) (local.get $v))))

        ;; Is v in S?
        (if (i32.lt_u (local.get $s2) (local.get $s))
          (then
            (if (local.get $s2)
              (then
                ;; no need to initialise $bestL
                (local.set $bestU (i32.const -1))
                (local.set $u (i32.const 0))
                (block $u_block (loop $u_loop
                  (br_if $u_block (i32.eq (local.get $u) (global.get $nminus1)))

                  ;; Is u in S2? Compute S2 & (1 << u)
                  (if (i32.and
                    (local.get $s2)
                    (i32.shl (i32.const 1) (local.get $u))
                  )
                    (then
                      ;; $l = len[S2][u] + d[u][v]
                      (local.set $l
                        (f64.add
                          (call $get_len (local.get $s2) (local.get $u))
                          (call $get_d (local.get $u) (local.get $v))
                        )
                      )

                      ;; if $bestU === -1 or $l < $bestL
                      (if (i32.or
                        (i32.eq (local.get $bestU) (i32.const -1))
                        (f64.lt (local.get $l) (local.get $bestL))
                      )
                        (then
                          (local.set $bestL (local.get $l))
                          (local.set $bestU (local.get $u))
                        )
                      )
                    )
                  )

                  ;; $u++
                  (local.set $u (i32.add (local.get $u) (i32.const 1)))
                  br $u_loop
                ))
              )
              (else
                ;; no `u` distinct from `v` can be found
                ;; `S` has only a single element, `v`. So: base case
                ;; $bestL = d[n - 1][v]
                (local.set $bestL
                  (call $get_d (global.get $nminus1) (local.get $v))
                )
                (local.set $bestU (global.get $nminus1))
              )
            )

            (call $set_len (local.get $s) (local.get $v) (local.get $bestL))
            (call $set_prev (local.get $s) (local.get $v) (local.get $bestU))
          )
        )

        ;; $v++
        (local.set $v (i32.add (local.get $v) (i32.const 1)))
        br $v_loop
      ))

      ;; $s++
      (local.set $s (i32.add (local.get $s) (i32.const 1)))
      br $s_loop
    ))

    ;; Close the loop
    (if (global.get $nminus1)
      (then
        ;; no need to initialise $bestL
        (local.set $bestU (i32.const -1))
        (local.set $u (i32.const 0))
        (block $u_block (loop $u_loop
          (br_if $u_block (i32.eq (local.get $u) (global.get $nminus1)))

          ;; $l = len[all][u] + d[u][n - 1]
          (local.set $l
            (f64.add
              (call $get_len (local.get $all) (local.get $u))
              (call $get_d (local.get $u) (global.get $nminus1))
            )
          )

          ;; if $bestU === -1 or $l < $bestL 
          (if (i32.or
            (i32.eq (local.get $bestU) (i32.const -1))
            (f64.lt (local.get $l) (local.get $bestL))
          )
            (then
              (local.set $bestL (local.get $l))
              (local.set $bestU (local.get $u))
            )
          )

          ;; $u++
          (local.set $u (i32.add (local.get $u) (i32.const 1)))
          br $u_loop
        ))
      )
      (else
        (local.set $bestL (f64.const 0))
        (local.set $bestU (global.get $nminus1))
      )
    )

    (local.get $bestU)
    f64.convert_i32_s
  )

  (export "doHK" (func $doHK))
)
