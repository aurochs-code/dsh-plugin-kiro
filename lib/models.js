function isRecord(value) {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}
/** Parse the documented Kiro JSON model listing while tolerating common field aliases. */
export function parseKiroModels(output) {
    let parsed;
    try {
        parsed = JSON.parse(output);
    }
    catch (error) {
        throw new Error('Kiro CLI did not return a JSON model catalog', { cause: error });
    }
    const candidates = Array.isArray(parsed)
        ? parsed
        : isRecord(parsed) && Array.isArray(parsed.models)
            ? parsed.models
            : undefined;
    if (candidates === undefined)
        throw new Error('Kiro CLI JSON model catalog has no models array');
    const seen = new Set();
    const models = [];
    for (const candidate of candidates) {
        if (typeof candidate === 'string') {
            if (!seen.has(candidate) && candidate.length > 0) {
                seen.add(candidate);
                models.push({ id: candidate, name: candidate });
            }
            continue;
        }
        if (!isRecord(candidate))
            continue;
        const id = candidate.id ?? candidate.modelId ?? candidate.model_id;
        if (typeof id !== 'string' || id.length === 0 || seen.has(id))
            continue;
        seen.add(id);
        const name = candidate.name ?? candidate.displayName ?? candidate.display_name;
        const description = candidate.description;
        models.push({
            id,
            name: typeof name === 'string' && name.length > 0 ? name : id,
            ...(typeof description === 'string' && description.length > 0 ? { description } : {}),
        });
    }
    if (models.length === 0)
        throw new Error('Kiro CLI returned an empty model catalog');
    return models;
}
