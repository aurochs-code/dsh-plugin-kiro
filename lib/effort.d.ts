/** Kiro CLI effort levels accepted by both `chat` and `acp`. */
export declare const KIRO_REASONING_EFFORTS: readonly [{
    readonly id: "low";
    readonly name: "Low";
    readonly description: "Fastest responses with the least reasoning.";
}, {
    readonly id: "medium";
    readonly name: "Medium";
    readonly description: "Balanced speed and reasoning depth.";
}, {
    readonly id: "high";
    readonly name: "High";
    readonly description: "More deliberate reasoning for complex work.";
}, {
    readonly id: "xhigh";
    readonly name: "Extra High";
    readonly description: "Maximum depth short of the full maximum setting.";
}, {
    readonly id: "max";
    readonly name: "Maximum";
    readonly description: "Highest available reasoning effort.";
}];
/** One Kiro CLI effort id accepted by `--effort`. */
export type KiroReasoningEffort = (typeof KIRO_REASONING_EFFORTS)[number]['id'];
