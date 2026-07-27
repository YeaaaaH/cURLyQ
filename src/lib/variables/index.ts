export { VARIABLE_PATTERN, tokenizeVariables, type VariableToken } from "@/lib/variables/tokenizer";
export {
  environmentScope,
  createVariableContext,
  type VariableLookup,
  type VariableScope,
} from "@/lib/variables/context";
export {
  MAX_RESOLUTION_DEPTH,
  resolveVariable,
  substituteVariables,
  type VariableResolution,
} from "@/lib/variables/resolver";
export { findAllVariableNames, getUnresolvedVariables } from "@/lib/variables/diagnostics";
export { resolveRequest, type OutgoingRequest } from "@/lib/variables/requestResolver";
