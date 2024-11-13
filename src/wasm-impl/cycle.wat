;; turn this into WASM using e.g. `wat2wasm cycle.wat -o cycle.wasm`

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

  (global $BYTES_PER_INT32 i32 (i32.const 4))
  (global $BYTES_PER_FLOAT64 i32 (i32.const 8))

  (global $n (mut i32) (i32.const 0))
  (global $nminus1 (mut i32) (i32.const 0))
  (global $shlnminus1 (mut i32) (i32.const 0))

  ;; memory locations

  (global $d_ptr i32 (i32.const 0)) ;; correct
  (global $len_ptr (mut i32) (i32.const 0)) ;; we compute this at startup
  (global $prev_ptr (mut i32) (i32.const 0)) ;; we compute this at startup

  ;; memory lookup functions

  (func $get_d_ptr (param $u i32) (param $v i32) (result i32)
    global.get $n
    local.get $u
    i32.mul
    local.get $v
    i32.add

    global.get $BYTES_PER_FLOAT64
    i32.mul

    global.get $d_ptr
    i32.add
  )

  ;; get d[u][v] from memory address OFFSET + (N * U + V) * 8
  (func $get_d (param $u i32) (param $v i32) (result f64)
    (call $get_d_ptr (local.get $u) (local.get $v))
    f64.load
  )

  ;; (don't need a setter for d[u][v])

  (func $get_len_ptr (param $s i32) (param $k i32) (result i32)
    global.get $shlnminus1
    local.get $k
    i32.mul
    local.get $s
    i32.add

    global.get $BYTES_PER_FLOAT64
    i32.mul

    global.get $len_ptr
    i32.add
  )

  ;; get len[S][k] from memory address OFFSET + ((2^(N - 1)) * S + k) * 8
  (func $get_len (param $s i32) (param $k i32) (result f64)
    (call $get_len_ptr (local.get $s) (local.get $k))
    f64.load
  )

  ;; set len[S][k]
  (func $set_len (param $s i32) (param $k i32) (param $len f64)
    (call $get_len_ptr (local.get $s) (local.get $k))
    local.get $len
    f64.store
  )

  (func $get_prev_ptr (param $s i32) (param $k i32) (result i32)
    global.get $nminus1
    local.get $s
    i32.mul
    local.get $k
    i32.add

    global.get $BYTES_PER_INT32
    i32.mul

    global.get $prev_ptr
    i32.add
  )

  ;; get prev[S][k] from memory address OFFSET + ((N - 1) * S + k) * 4
  (func $get_prev (param $s i32) (param $k i32) (result i32)
    (call $get_prev_ptr (local.get $s) (local.get $k))
    i32.load
  )

  ;; set prev[S][k]
  (func $set_prev (param $s i32) (param $k i32) (param $prev i32)
    (call $get_prev_ptr (local.get $s) (local.get $k))
    local.get $prev
    i32.store
  )

  ;; Actual work

  (func $getCycle (result f64)
    (local $d_size i32)
    (local $len_size i32)
    (local $prev_size i32)

    (local $all i32)
    (local $s i32)
    (local $s2 i32)
    (local $k i32)
    (local $m i32)
    (local $l f64)
    (local $bestM i32)
    (local $bestL f64)
    (local $bestK i32)

    ;; get N (convert f64 to i32),
    ;; compute N - 1
    ;; compute 2 ** (N - 1)
    (global.set $n (i32.trunc_f64_s (global.get $js_n)))
    (global.set $nminus1 (i32.sub (global.get $n) (i32.const 1)))
    (global.set $shlnminus1 (i32.shl (i32.const 1) (global.get $nminus1)))

    ;; compute size of `d` in memory: n * n * bytes per f64
    global.get $n
    global.get $n
    i32.mul
    global.get $BYTES_PER_FLOAT64
    i32.mul
    local.set $d_size

    ;; compute location of `len` in memory
    (global.set $len_ptr (i32.add (global.get $d_ptr) (local.get $d_size)))

    ;; compute size of `len` in memory: 2^(n - 1) * (n - 1) * bytes per f64
    global.get $shlnminus1
    global.get $nminus1
    i32.mul
    global.get $BYTES_PER_FLOAT64
    i32.mul
    local.set $len_size

    ;; compute location of `prev` in memory
    (global.set $prev_ptr (i32.add (global.get $len_ptr) (local.get $len_size)))
    
    ;; compute size of `prev` in memory: 2^(n - 1) * (n - 1) * bytes per i32
    global.get $shlnminus1
    global.get $nminus1
    i32.mul
    global.get $BYTES_PER_INT32
    i32.mul
    local.set $prev_size

    ;; compute $all = 2 ** (N - 1) - 1
    (local.set $all (i32.sub (global.get $shlnminus1) (i32.const 1)))

    ;; OK LET'S RIDE

    ;; (call $log32 (global.get $n))
    ;; (call $log32 (global.get $d_ptr))
    ;; (call $log32 (local.get $d_size))
    ;; (call $log32 (global.get $len_ptr))
    ;; (call $log32 (local.get $len_size))
    ;; (call $log32 (global.get $prev_ptr))
    ;; (call $log32 (local.get $prev_size))

    (local.set $s (i32.const 1))
    (block $s_block (loop $s_loop
      ;; break if $s > $all
      (br_if $s_block (i32.gt_u (local.get $s) (local.get $all)))

      (local.set $k (i32.const 0))
      (block $k_block (loop $k_loop
        ;; break if $k = n - 1
        (br_if $k_block (i32.eq (local.get $k) (global.get $nminus1)))

        ;; Compute S2 = S ^ (1 << k)
        (local.set $s2 (i32.xor (local.get $s) (i32.shl (i32.const 1) (local.get $k))))

        ;; Was k in S?
        (if (i32.lt_u (local.get $s2) (local.get $s))
          (then
            (local.set $bestM (i32.const -1))
            ;; no need to initialise $bestL

            (if (local.get $s2)
              (then
                (local.set $m (i32.const 0))
                (block $m_block (loop $m_loop
                  (br_if $m_block (i32.eq (local.get $m) (global.get $nminus1)))

                  ;; Compute S2 & (1 << m)
                  ;; Was m in S2?
                  (if (i32.and
                    (local.get $s2)
                    (i32.shl (i32.const 1) (local.get $m))
                  )
                    (then
                      ;; main loop goes here!
                      
                      ;; $l = len[S2][m] + d[m][k]
                      (local.set $l
                        (f64.add
                          (call $get_len (local.get $s2) (local.get $m))
                          (call $get_d (local.get $m) (local.get $k))
                        )
                      )

                      ;; if $bestM === -1 or $l < $bestL 
                      (if (i32.or
                        (i32.eq (local.get $bestM) (i32.const -1))
                        (f64.lt (local.get $l) (local.get $bestL))
                      )
                        (then
                          (local.set $bestM (local.get $m))
                          (local.set $bestL (local.get $l))
                        )
                      )
                    )
                  )

                  ;; $m++
                  (local.set $m (i32.add (local.get $m) (i32.const 1)))
                  br $m_loop
                ))
              )
              (else
                ;; no `m` distinct from `k` can be found
                ;; `S` has only a single element, `k`. So: base case
                ;; $bestL = d[n - 1][k]
                (local.set $bestL
                  (call $get_d (global.get $nminus1) (local.get $k))
                )
              )
            )

            (call $set_len (local.get $s) (local.get $k) (local.get $bestL))
            (call $set_prev (local.get $s) (local.get $k) (local.get $bestM)) ;; can be -1
          )
        )

        ;; $k++
        (local.set $k (i32.add (local.get $k) (i32.const 1)))
        br $k_loop
      ))

      ;; $s++
      (local.set $s (i32.add (local.get $s) (i32.const 1)))
      br $s_loop
    ))

    ;; Close the loop
    (local.set $bestK (i32.const -1))
    ;; no need to initialise $bestL
    (local.set $k (i32.const 0))
    (block $k_block (loop $k_loop
      ;; break if $k = n - 1
      (br_if $k_block (i32.eq (local.get $k) (global.get $nminus1)))

      ;; $l = len[all][k] + d[k][n - 1]
      (local.set $l
        (f64.add
          (call $get_len (local.get $all) (local.get $k))
          (call $get_d (local.get $k) (global.get $nminus1))
        )
      )

      ;; if $k === 0 or $l < $bestL 
      (if (i32.or
        (i32.eq (local.get $k) (i32.const 0))
        (f64.lt (local.get $l) (local.get $bestL))
      )
        (then
          (local.set $bestL (local.get $l))
          (local.set $bestK (local.get $k))
        )
      )

      ;; $k++
      (local.set $k (i32.add (local.get $k) (i32.const 1)))
      br $k_loop
    ))

    (local.get $bestK)
    f64.convert_i32_s
  )

  (export "getCycle" (func $getCycle))
)
