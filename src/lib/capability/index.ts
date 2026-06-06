// 客户端安全（不引入数据库）
export {
  PRESET_CAPABILITIES,
  matchCapabilitiesFromList,
  matchAgentByCapability,
  findBestMatchAgent,
} from "./CapabilityMatcher";

// 服务端专用（直接访问数据库）
export {
  getSkillCapabilitiesFromDB,
  getAllCapabilities,
  matchCapabilitiesFromTask,
} from "./CapabilityMatcherServer";
