# Project Architecture Rules

- Keep Pipe assignment options separate from historical owner lists so visibility flags never remove legacy names from reports, dashboards, goals, rankings, or history.
- ContractTab is the shared contract form and generation entry point; the backend check chooses the document model and controls readiness, while report-only payment validation stays in reportContract with unit tests.