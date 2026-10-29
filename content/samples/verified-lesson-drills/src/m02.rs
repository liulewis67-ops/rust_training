//! M02-L02 — a block has a type determined by its tail expression.

pub fn adjusted_count(eligible: bool) -> i32 {
    let raw = 12;
    if eligible {
        raw - 2
    } else {
        raw + 2
    }
}

pub fn line_total(unit_price_cents: u32, quantity: u32) -> u32 {
    // The caller promises a product representable in u32; overflow is M02-L05.
    unit_price_cents * quantity
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn both_if_arms_yield_i32_values() {
        assert_eq!(adjusted_count(true), 10);
        assert_eq!(adjusted_count(false), 14);
    }

    #[test]
    fn the_pure_function_observes_zero_and_nonzero_quantity() {
        assert_eq!(line_total(250, 3), 750);
        assert_eq!(line_total(250, 0), 0);
    }

    #[test]
    fn an_inner_block_can_be_assigned_as_a_value() {
        let result: i32 = {
            let base = 8;
            base + 4
        };
        assert_eq!(result, 12);
    }
}
