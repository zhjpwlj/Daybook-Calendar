// rrule's ESM build has extensionless internal imports, so Node cannot load it.
// Its CJS build works in Node and Vite. Node exposes it as the namespace
// default; Vite exposes the webpack namespace's named exports. Both shapes are
// declared here so one import site covers both runtimes.
declare module 'rrule/dist/es5/rrule.js' {
  import type { RRule as RRuleClass } from 'rrule';

  export const RRule: typeof RRuleClass;

  const rrule: { RRule: typeof RRuleClass };
  export default rrule;
}
