/** Local Mokina is the shipped default. Upstream compatibility suites may opt out explicitly. */
export const MOKINA_LOCAL_EDITION: boolean = process.env.NEXT_PUBLIC_MOKINA_EDITION !== 'off';
