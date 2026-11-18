# Project Architecture Rules

- Keep Pipe assignment options separate from historical owner lists so visibility flags never remove legacy names from reports, dashboards, goals, rankings, or history.
- ContractTab is the shared contract form and generation entry point; the backend check chooses the document model and controls readiness, while report-only payment validation stays in reportContract with unit tests.
- Use DocumentoBadge for document classification in Kanban/detail headers and missingMeetingBasics for meeting-only validation so contract checks remain unchanged.
- Mount presence once in AuthLayout for an authenticated profile; keep geolocation collection separate from normal heartbeats so location never prompts on a regular ping.
- Mount version checks once in AuthLayout outside page data queries; version polling must not trigger Pipeline synchronization, and administrative reload signals use the existing RPC only after confirmation.- Campanhas de Disparo only reads campaign views/tables and toggles campanha_config; contact status priority lives in campanhaDisparo with unit tests, and the frontend never calls WhatsApp providers directly.
- Open lead cards from outside the Pipeline via /lead/:id (or /pipeline?lead=); PipelinePanel always fetches the lead by id so cards open regardless of the loaded list or active filters, and the shared LeadDrawer stays the only detail view.
