/**
 * Types and normalization helpers for Sequential Thinking extension
 */
import { randomUUID } from "node:crypto";
// =============================================================================
// Constants
// =============================================================================
export const DEFAULT_SESSION_LABEL = "default";
export const SCHEMA_VERSION = 1;
export const MAX_IMPORT_BYTES = 10 * 1024 * 1024;
export const STATUS_ENUMERATION_SESSION_THRESHOLD = 100;
export const DEFAULT_HISTORY_LIMIT = 20;
export const MAX_HISTORY_LIMIT = 100;
const MAX_SESSION_ID_LENGTH = 80;
const MAX_THOUGHT_COUNT = 1000;
// =============================================================================
// ThoughtStage Enum
// =============================================================================
export var ThoughtStage;
(function (ThoughtStage) {
    ThoughtStage["PROBLEM_DEFINITION"] = "Problem Definition";
    ThoughtStage["RESEARCH"] = "Research";
    ThoughtStage["ANALYSIS"] = "Analysis";
    ThoughtStage["SYNTHESIS"] = "Synthesis";
    ThoughtStage["CONCLUSION"] = "Conclusion";
})(ThoughtStage || (ThoughtStage = {}));
const THOUGHT_STAGE_VALUES = Object.values(ThoughtStage);
export function parseThoughtStage(value) {
    const normalized = value.toLowerCase().trim();
    for (const stage of THOUGHT_STAGE_VALUES) {
        if (stage.toLowerCase() === normalized) {
            return stage;
        }
    }
    const validStages = THOUGHT_STAGE_VALUES.join(", ");
    throw new Error(`Invalid thinking stage: '${value}'. Valid stages are: ${validStages}`);
}
function createError(field, message) {
    return { field, message };
}
export class ThoughtValidationError extends Error {
    errors;
    constructor(errors) {
        super(errors.map((error) => `${error.field}: ${error.message}`).join("; "));
        this.name = "ThoughtValidationError";
        this.errors = errors;
        Object.setPrototypeOf(this, ThoughtValidationError.prototype);
    }
}
function isPositiveInteger(value) {
    return typeof value === "number" && Number.isInteger(value) && value >= 1;
}
export function isRecord(value) {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}
function hasOwn(record, key) {
    return Object.hasOwn(record, key);
}
function valuesEqual(left, right) {
    return JSON.stringify(left) === JSON.stringify(right);
}
function normalizeRequiredString(field, value) {
    if (typeof value !== "string") {
        return { error: createError(field, `${field} must be a string`) };
    }
    if (!value.trim()) {
        return {
            error: createError(field, field === "thought" ? "Thought content cannot be empty" : `${field} cannot be empty`),
        };
    }
    return { value };
}
function normalizeRequiredInteger(field, value) {
    if (isPositiveInteger(value)) {
        if ((field === "thought_number" || field === "total_thoughts") && value > MAX_THOUGHT_COUNT) {
            return {
                error: createError(field, `${field} must be ${MAX_THOUGHT_COUNT} or fewer (received ${value})`),
            };
        }
        return { value };
    }
    const message = field === "thought_number"
        ? "Thought number must be a positive integer"
        : field === "total_thoughts"
            ? "Total thoughts must be a positive integer"
            : `${field} must be a positive integer`;
    return { error: createError(field, message) };
}
function normalizeRequiredBoolean(field, value) {
    if (typeof value === "boolean") {
        return { value };
    }
    return { error: createError(field, `${field} must be a boolean`) };
}
function normalizeOptionalStringArray(field, value) {
    if (value === undefined) {
        return { value: [] };
    }
    if (!Array.isArray(value) || value.some((item) => typeof item !== "string")) {
        return { error: createError(field, `${field} must be an array of strings`) };
    }
    return { value };
}
function readAliasedField(args, field, alias, normalizer, options) {
    const hasField = hasOwn(args, field);
    const hasAlias = hasOwn(args, alias);
    if (!hasField && !hasAlias) {
        if (options.required) {
            return { ok: false, errors: [createError(field, `${field} is required`)] };
        }
        return { ok: true, value: options.defaultValue };
    }
    const normalizedField = hasField ? normalizer(field, args[field]) : undefined;
    const normalizedAlias = hasAlias ? normalizer(field, args[alias]) : undefined;
    const errors = [];
    if (normalizedField?.error)
        errors.push(normalizedField.error);
    if (normalizedAlias?.error)
        errors.push(normalizedAlias.error);
    if (errors.length > 0) {
        return { ok: false, errors };
    }
    if (hasField && hasAlias) {
        if (!valuesEqual(normalizedField?.value, normalizedAlias?.value)) {
            return { ok: false, errors: [createError(field, `Conflicting aliases for ${field}`)] };
        }
        return { ok: true, value: normalizedField?.value };
    }
    return { ok: true, value: (hasField ? normalizedField?.value : normalizedAlias?.value) };
}
function pushErrors(target, result) {
    if (!result.ok)
        target.push(...result.errors);
}
/**
 * Resolve a snake_case / camelCase alias pair from a record of arguments.
 *
 * Runs `validator` against whichever alias is present. If both aliases are
 * present, comparison happens *after* validation so equivalent-but-textually-
 * different inputs (e.g. trailing whitespace) don't trigger a false conflict.
 *
 * Returns `undefined` when neither alias is present; throws
 * `ThoughtValidationError` (with field name `snake`) when the validated
 * values diverge.
 */
export function pickAliasedArg(args, snake, camel, validator) {
    // Treat explicit-undefined as absent. Programmatic callers using object
    // spread routinely produce `{ snake: undefined, camel: 'x' }`; we should
    // resolve to 'x' rather than throw a spurious alias-conflict.
    const hasSnake = hasOwn(args, snake) && args[snake] !== undefined;
    const hasCamel = hasOwn(args, camel) && args[camel] !== undefined;
    if (!hasSnake && !hasCamel)
        return undefined;
    const snakeValue = hasSnake ? validator(args[snake]) : undefined;
    const camelValue = hasCamel ? validator(args[camel]) : undefined;
    if (hasSnake && hasCamel && !valuesEqual(snakeValue, camelValue)) {
        throw new ThoughtValidationError([createError(snake, `Conflicting aliases for ${snake}`)]);
    }
    return hasSnake ? snakeValue : camelValue;
}
export function normalizeSessionId(value) {
    if (value === undefined || value === null) {
        return { sessionId: null, sessionLabel: DEFAULT_SESSION_LABEL };
    }
    if (typeof value !== "string") {
        throw new ThoughtValidationError([createError("session_id", "session_id must be a string")]);
    }
    const sessionId = value.trim();
    const errors = [];
    if (!sessionId) {
        errors.push(createError("session_id", "session_id cannot be empty"));
    }
    if (sessionId.length > MAX_SESSION_ID_LENGTH) {
        errors.push(createError("session_id", `session_id must be ${MAX_SESSION_ID_LENGTH} characters or fewer`));
    }
    if (sessionId.toLowerCase() === DEFAULT_SESSION_LABEL) {
        errors.push(createError("session_id", "session_id 'default' is reserved"));
    }
    if (sessionId === "." || sessionId === ".." || !/^[A-Za-z0-9._-]+$/.test(sessionId)) {
        errors.push(createError("session_id", "session_id may contain only letters, numbers, dot, underscore, and hyphen"));
    }
    if (errors.length > 0) {
        throw new ThoughtValidationError(errors);
    }
    return { sessionId, sessionLabel: sessionId };
}
function readSession(args) {
    const errors = [];
    const hasSnake = hasOwn(args, "session_id");
    const hasCamel = hasOwn(args, "sessionId");
    if (!hasSnake && !hasCamel) {
        return { session: normalizeSessionId(undefined), errors };
    }
    try {
        const snakeSession = hasSnake ? normalizeSessionId(args.session_id) : undefined;
        const camelSession = hasCamel ? normalizeSessionId(args.sessionId) : undefined;
        if (snakeSession && camelSession && !valuesEqual(snakeSession, camelSession)) {
            errors.push(createError("session_id", "Conflicting aliases for session_id"));
            return { errors };
        }
        return { session: snakeSession ?? camelSession, errors };
    }
    catch (error) {
        if (error instanceof ThoughtValidationError) {
            return { errors: error.errors };
        }
        throw error;
    }
}
export function normalizeThoughtInput(args, options = {}) {
    if (!isRecord(args)) {
        throw new ThoughtValidationError([createError("input", "input must be an object")]);
    }
    const errors = [];
    const thoughtResult = normalizeRequiredString("thought", args.thought);
    if (thoughtResult.error)
        errors.push(thoughtResult.error);
    const thoughtNumberResult = readAliasedField(args, "thought_number", "thoughtNumber", normalizeRequiredInteger, {
        required: true,
    });
    pushErrors(errors, thoughtNumberResult);
    const totalThoughtsResult = readAliasedField(args, "total_thoughts", "totalThoughts", normalizeRequiredInteger, {
        required: true,
    });
    pushErrors(errors, totalThoughtsResult);
    const nextThoughtNeededResult = readAliasedField(args, "next_thought_needed", "nextThoughtNeeded", normalizeRequiredBoolean, { required: true });
    pushErrors(errors, nextThoughtNeededResult);
    let stage;
    if (typeof args.stage !== "string") {
        errors.push(createError("stage", "stage must be a string"));
    }
    else {
        try {
            stage = parseThoughtStage(args.stage);
        }
        catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            errors.push(createError("stage", message));
        }
    }
    const tagsResult = normalizeOptionalStringArray("tags", args.tags);
    if (tagsResult.error)
        errors.push(tagsResult.error);
    const axiomsResult = readAliasedField(args, "axioms_used", "axiomsUsed", normalizeOptionalStringArray, {
        required: false,
        defaultValue: [],
    });
    pushErrors(errors, axiomsResult);
    const assumptionsResult = readAliasedField(args, "assumptions_challenged", "assumptionsChallenged", normalizeOptionalStringArray, { required: false, defaultValue: [] });
    pushErrors(errors, assumptionsResult);
    const sessionResult = readSession(args);
    errors.push(...sessionResult.errors);
    if (errors.length > 0) {
        throw new ThoughtValidationError(errors);
    }
    // Past the error gate, all field results must be ok. Narrow them explicitly
    // so we do not rely on unchecked `as` casts.
    if (!thoughtResult.value ||
        !thoughtNumberResult.ok ||
        !totalThoughtsResult.ok ||
        !nextThoughtNeededResult.ok ||
        !axiomsResult.ok ||
        !assumptionsResult.ok ||
        stage === undefined) {
        throw new ThoughtValidationError([createError("input", "internal invariant violation after validation gate")]);
    }
    const thoughtNumber = thoughtNumberResult.value;
    const originalTotalThoughts = totalThoughtsResult.value;
    const totalThoughts = Math.max(originalTotalThoughts, thoughtNumber);
    const adjustments = {};
    if (totalThoughts !== originalTotalThoughts) {
        adjustments.totalThoughtsAdjusted = { from: originalTotalThoughts, to: totalThoughts };
    }
    return {
        thought: {
            thought: thoughtResult.value,
            thought_number: thoughtNumber,
            total_thoughts: totalThoughts,
            next_thought_needed: nextThoughtNeededResult.value,
            stage,
            tags: tagsResult.value ?? [],
            axioms_used: axiomsResult.value,
            assumptions_challenged: assumptionsResult.value,
            timestamp: options.timestamp ?? new Date().toISOString(),
            id: options.id ?? generateUuid(),
        },
        session: sessionResult.session ?? normalizeSessionId(undefined),
        adjustments,
    };
}
export function validateThoughtData(data) {
    const errors = [];
    if (!data.thought?.trim()) {
        errors.push({ field: "thought", message: "Thought content cannot be empty" });
    }
    if (data.thought_number === undefined || !isPositiveInteger(data.thought_number)) {
        errors.push({ field: "thought_number", message: "Thought number must be a positive integer" });
    }
    if (data.total_thoughts === undefined || !isPositiveInteger(data.total_thoughts)) {
        errors.push({ field: "total_thoughts", message: "Total thoughts must be a positive integer" });
    }
    if (data.next_thought_needed !== undefined && typeof data.next_thought_needed !== "boolean") {
        errors.push({ field: "next_thought_needed", message: "next_thought_needed must be a boolean" });
    }
    if (data.stage !== undefined && !THOUGHT_STAGE_VALUES.includes(data.stage)) {
        errors.push({ field: "stage", message: "stage must be a valid ThoughtStage" });
    }
    for (const field of ["tags", "axioms_used", "assumptions_challenged"]) {
        const value = data[field];
        if (value !== undefined && (!Array.isArray(value) || value.some((item) => typeof item !== "string"))) {
            errors.push({ field, message: `${field} must be an array of strings` });
        }
    }
    return errors;
}
export function isValidThoughtData(data) {
    return validateThoughtData(data).length === 0;
}
export function thoughtToDict(data, includeId = false) {
    const result = {
        thought: data.thought,
        thoughtNumber: data.thought_number,
        totalThoughts: data.total_thoughts,
        nextThoughtNeeded: data.next_thought_needed,
        stage: data.stage,
        tags: data.tags,
        axiomsUsed: data.axioms_used,
        assumptionsChallenged: data.assumptions_challenged,
        timestamp: data.timestamp,
    };
    if (includeId) {
        result.id = data.id;
    }
    return result;
}
export function normalizeThoughtRecord(dict) {
    const warnings = [];
    if (typeof dict.id !== "string" || !dict.id.trim()) {
        warnings.push("Imported thought missing id; generated a new id.");
    }
    if (typeof dict.timestamp !== "string" || !dict.timestamp.trim()) {
        warnings.push("Imported thought missing timestamp; generated an import-time timestamp.");
    }
    const normalized = normalizeThoughtInput(dict, {
        id: typeof dict.id === "string" && dict.id.trim() ? dict.id : generateUuid(),
        timestamp: typeof dict.timestamp === "string" && dict.timestamp.trim() ? dict.timestamp : new Date().toISOString(),
    });
    return { thought: normalized.thought, warnings };
}
// =============================================================================
// UUID Generation
// =============================================================================
export function generateUuid() {
    return randomUUID();
}
