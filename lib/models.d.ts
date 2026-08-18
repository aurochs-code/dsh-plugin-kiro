/** One Kiro model as exposed through `kiro-cli chat --list-models --format json`. */
export interface KiroModel {
    id: string;
    name: string;
    description?: string;
}
/** Parse the documented Kiro JSON model listing while tolerating common field aliases. */
export declare function parseKiroModels(output: string): KiroModel[];
