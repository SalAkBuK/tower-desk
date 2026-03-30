import { logAuth } from "./debugAuth";

type PortalTelemetryMeta = Record<string, unknown> | undefined;

export function logPortalEvent(event: string, meta?: PortalTelemetryMeta) {
    logAuth("PORTAL", event, meta);
}
