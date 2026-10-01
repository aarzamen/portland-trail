// Build stamp. These are the checked-in development defaults: scripts/serve.mjs answers this file with the
// live Git stamp in mode 'dev', and scripts/build.mjs writes the real stamp with mode 'build' into the build.
/** @type {{ version: string, sha: string, branch: string, date: string, dirty: boolean, mode: 'dev' | 'build' }} */
export const BUILD = { version: '0.2.0', sha: 'dev', branch: '', date: '', dirty: false, mode: 'dev' };
