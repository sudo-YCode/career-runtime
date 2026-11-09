// The job description the visitor compiled last, so the stage-by-stage view on the decisions page
// can show the same one. Kept in memory only: nothing is stored or sent anywhere.
let last = '';
export const setLastJd = (text: string) => { last = text; };
export const lastJd = () => last;
