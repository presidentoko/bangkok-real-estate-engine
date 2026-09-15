// Runs only when a request under this Worker's route matches no static asset:
// a condo the export does not have yet, a legacy /condo/<uuid> URL, a typo.
// Asset hits never reach this code and are free; this is a billed invocation,
// so it does nothing but hand the request to the origin (Vercel), which
// already answers all three -- on-demand render, the uuid 308 in
// web/middleware.ts, a 404. A subrequest to the Worker's own zone goes to the
// origin rather than back through the Worker.
export default {
  fetch(request) {
    return fetch(request);
  },
};
