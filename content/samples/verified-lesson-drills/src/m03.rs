//! M03-L02 — an exhaustive match keeps a new state visible.

pub enum UploadState {
    Waiting,
    Sending,
    Failed { attempts: u8 },
    Complete,
}

pub fn next_action(state: UploadState) -> &'static str {
    match state {
        UploadState::Waiting => "send",
        UploadState::Sending => "wait",
        UploadState::Failed { attempts } if attempts < 3 => "retry",
        UploadState::Failed { .. } => "inspect",
        UploadState::Complete => "none",
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn every_variant_has_a_business_action() {
        assert_eq!(next_action(UploadState::Waiting), "send");
        assert_eq!(next_action(UploadState::Sending), "wait");
        assert_eq!(next_action(UploadState::Complete), "none");
    }

    #[test]
    fn retry_threshold_is_exclusive() {
        assert_eq!(next_action(UploadState::Failed { attempts: 0 }), "retry");
        assert_eq!(next_action(UploadState::Failed { attempts: 2 }), "retry");
        assert_eq!(next_action(UploadState::Failed { attempts: 3 }), "inspect");
        assert_eq!(
            next_action(UploadState::Failed { attempts: u8::MAX }),
            "inspect"
        );
    }
}
