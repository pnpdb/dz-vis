use crate::protocol_processing::builder::ProtocolBuilder;
use crate::protocol_processing::types::SandboxLightingData;

#[derive(Debug, Default, Clone, Copy)]
pub struct SandboxService;

impl SandboxService {
    pub fn new() -> Self {
        Self
    }

    pub fn build_lighting_payload(&self, lighting: &SandboxLightingData) -> Vec<u8> {
        ProtocolBuilder::new().build_sandbox_lighting(lighting)
    }
}
