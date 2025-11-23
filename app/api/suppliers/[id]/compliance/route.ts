import { buildDeps, createComplianceRouteHandlers } from "./handlers"

export const { GET, POST, PUT, DELETE } = createComplianceRouteHandlers(buildDeps())
