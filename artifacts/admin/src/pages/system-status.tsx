import { useQuery } from "@tanstack/react-query";
import { CheckCircle2, XCircle, AlertTriangle, Clock, Activity, Server, Database, RefreshCw, Bell, BellOff, ExternalLink } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

interface StatusResponse {
  status: string;
  uptime: number;
  startedAt: string;
  errors: {
    lastMinute: number;
    alertThreshold: number;
    alertCooldownMinutes: number;
  };
  alerting: {
    webhookConfigured: boolean;
    webhookEnvVar: string;
  };
  services: {
    api: string;
  };
}

function formatUptime(seconds: number): string {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;

  if (days > 0) return `${days}d ${hours}h ${mins}m`;
  if (hours > 0) return `${hours}h ${mins}m ${secs}s`;
  if (mins > 0) return `${mins}m ${secs}s`;
  return `${secs}s`;
}

function StatusIcon({ ok, warn }: { ok: boolean; warn?: boolean }) {
  if (!ok) return <XCircle className="w-5 h-5 text-red-500" />;
  if (warn) return <AlertTriangle className="w-5 h-5 text-amber-500" />;
  return <CheckCircle2 className="w-5 h-5 text-emerald-500" />;
}

function StatusBadge({ ok, warn }: { ok: boolean; warn?: boolean }) {
  if (!ok) return <Badge variant="destructive">Down</Badge>;
  if (warn) return <Badge className="bg-amber-100 text-amber-800 border-amber-200 hover:bg-amber-100">Degraded</Badge>;
  return <Badge className="bg-emerald-100 text-emerald-800 border-emerald-200 hover:bg-emerald-100">Operational</Badge>;
}

export default function SystemStatusPage() {
  const { data: status, isLoading, isError, dataUpdatedAt, refetch, isFetching } = useQuery<StatusResponse>({
    queryKey: ["system-status"],
    queryFn: async () => {
      const res = await fetch("/api/status");
      if (!res.ok) throw new Error("Status endpoint unavailable");
      return res.json();
    },
    refetchInterval: 30_000,
    retry: 1,
  });

  const { data: health, isError: healthError } = useQuery<{ status: string }>({
    queryKey: ["system-healthz"],
    queryFn: async () => {
      const res = await fetch("/api/healthz");
      if (!res.ok) throw new Error("Health check failed");
      return res.json();
    },
    refetchInterval: 30_000,
    retry: 1,
  });

  const apiUp = !isError && status?.status === "ok";
  const dbUp = !healthError && health?.status === "ok";
  const errorWarn =
    status != null && status.errors.lastMinute >= Math.floor(status.errors.alertThreshold / 2);
  const errorAlert = status != null && status.errors.lastMinute >= status.errors.alertThreshold;
  const webhookConfigured = status?.alerting?.webhookConfigured ?? false;

  const lastChecked = dataUpdatedAt
    ? new Date(dataUpdatedAt).toLocaleTimeString()
    : null;

  const healthzUrl = window.location.origin.replace(/\/admin.*/, "") + "/api/healthz";

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-slate-500 mt-1">
            Auto-refreshes every 30 seconds
            {lastChecked && ` · Last checked at ${lastChecked}`}
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => refetch()}
          disabled={isFetching}
          className="gap-2"
        >
          <RefreshCw className={`w-4 h-4 ${isFetching ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      {/* Overall status banner */}
      {isLoading ? (
        <Skeleton className="h-20 w-full rounded-xl" />
      ) : (
        <div
          className={`rounded-xl border px-6 py-5 flex items-center gap-4 ${
            !apiUp || !dbUp
              ? "bg-red-50 border-red-200"
              : errorAlert
                ? "bg-amber-50 border-amber-200"
                : "bg-emerald-50 border-emerald-200"
          }`}
        >
          <StatusIcon ok={apiUp && dbUp} warn={apiUp && dbUp && errorAlert} />
          <div>
            <p className="font-semibold text-slate-900 text-base">
              {!apiUp || !dbUp
                ? "Service disruption detected"
                : errorAlert
                  ? "Elevated error rate"
                  : "All systems operational"}
            </p>
            <p className="text-sm text-slate-500">
              {!apiUp || !dbUp
                ? "One or more services are unavailable"
                : errorAlert
                  ? `${status!.errors.lastMinute} server errors in the last minute (threshold: ${status!.errors.alertThreshold})`
                  : "API and database are healthy"}
            </p>
          </div>
        </div>
      )}

      {/* Service cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Card className="border-slate-200 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-3 space-y-0">
            <CardTitle className="text-sm font-medium text-slate-500 uppercase tracking-wider flex items-center gap-2">
              <Server className="w-4 h-4" />
              API Server
            </CardTitle>
            {isLoading ? (
              <Skeleton className="h-6 w-24" />
            ) : (
              <StatusBadge ok={apiUp} />
            )}
          </CardHeader>
          <CardContent className="space-y-3">
            {isLoading ? (
              <Skeleton className="h-4 w-48" />
            ) : status ? (
              <>
                <div className="flex items-center gap-2 text-sm text-slate-600">
                  <Clock className="w-4 h-4 text-slate-400" />
                  <span>Uptime: {formatUptime(status.uptime)}</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-slate-600">
                  <Activity className="w-4 h-4 text-slate-400" />
                  <span>Started: {new Date(status.startedAt).toLocaleString()}</span>
                </div>
              </>
            ) : (
              <p className="text-sm text-red-600">Unable to reach status endpoint</p>
            )}
          </CardContent>
        </Card>

        <Card className="border-slate-200 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-3 space-y-0">
            <CardTitle className="text-sm font-medium text-slate-500 uppercase tracking-wider flex items-center gap-2">
              <Database className="w-4 h-4" />
              Database
            </CardTitle>
            {isLoading ? (
              <Skeleton className="h-6 w-24" />
            ) : (
              <StatusBadge ok={dbUp} />
            )}
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-4 w-36" />
            ) : dbUp ? (
              <p className="text-sm text-slate-600">Connection healthy — live ping confirmed</p>
            ) : (
              <p className="text-sm text-red-600">Database ping failed — check connection</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Error rate card */}
      <Card className="border-slate-200 shadow-sm">
        <CardHeader className="flex flex-row items-center justify-between pb-3 space-y-0">
          <CardTitle className="text-sm font-medium text-slate-500 uppercase tracking-wider flex items-center gap-2">
            <AlertTriangle className="w-4 h-4" />
            Error Rate (last 60 s)
          </CardTitle>
          {isLoading ? (
            <Skeleton className="h-6 w-24" />
          ) : !status ? null : (
            <StatusBadge ok={!errorAlert} warn={errorWarn && !errorAlert} />
          )}
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <Skeleton className="h-8 w-32" />
          ) : !status ? (
            <p className="text-sm text-slate-500">No data available</p>
          ) : (
            <div className="space-y-3">
              <div className="flex items-end gap-2">
                <span className="text-4xl font-bold text-slate-900">{status.errors.lastMinute}</span>
                <span className="text-sm text-slate-500 pb-1">/ {status.errors.alertThreshold} threshold</span>
              </div>
              <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                <div
                  className={`h-2 rounded-full transition-all ${
                    errorAlert
                      ? "bg-red-500"
                      : errorWarn
                        ? "bg-amber-400"
                        : "bg-emerald-500"
                  }`}
                  style={{
                    width: `${Math.min(100, (status.errors.lastMinute / status.errors.alertThreshold) * 100)}%`,
                  }}
                />
              </div>
              <p className="text-xs text-slate-500">
                Alerts fire when {status.errors.alertThreshold}+ server errors (5xx) occur in 60 seconds,
                with a {status.errors.alertCooldownMinutes}-minute cooldown between alerts.
                Configure via <code className="bg-slate-100 px-1 rounded">ERROR_ALERT_THRESHOLD</code> and{" "}
                <code className="bg-slate-100 px-1 rounded">ERROR_ALERT_COOLDOWN_MINUTES</code> env vars.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Alert webhook card */}
      <Card className="border-slate-200 shadow-sm">
        <CardHeader className="flex flex-row items-center justify-between pb-3 space-y-0">
          <CardTitle className="text-sm font-medium text-slate-500 uppercase tracking-wider flex items-center gap-2">
            {webhookConfigured ? <Bell className="w-4 h-4" /> : <BellOff className="w-4 h-4" />}
            Webhook Alerting
          </CardTitle>
          {isLoading ? (
            <Skeleton className="h-6 w-24" />
          ) : (
            <Badge
              className={webhookConfigured
                ? "bg-emerald-100 text-emerald-800 border-emerald-200 hover:bg-emerald-100"
                : "bg-slate-100 text-slate-600 border-slate-200 hover:bg-slate-100"}
            >
              {webhookConfigured ? "Configured" : "Not configured"}
            </Badge>
          )}
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-slate-600">
          {webhookConfigured ? (
            <p>Webhook alerts are active. When the error rate exceeds the threshold, a POST is sent to the configured webhook URL (Slack, Teams, Discord, or any compatible endpoint).</p>
          ) : (
            <>
              <p>Set the <code className="bg-slate-100 px-1 rounded">ALERT_WEBHOOK_URL</code> environment variable to enable automatic webhook notifications when error rates spike.</p>
              <p className="text-slate-500">Supports Slack incoming webhooks, Microsoft Teams, Discord, and any endpoint that accepts <code className="text-xs bg-slate-100 px-1 rounded">{"POST { text: \"...\" }"}</code>.</p>
            </>
          )}
        </CardContent>
      </Card>

      {/* Uptime monitoring guidance */}
      <Card className="border-slate-200 shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium text-slate-500 uppercase tracking-wider">
            External Uptime Monitoring
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-slate-600">
          <p>
            A GitHub Actions workflow (<code className="bg-slate-100 px-1 rounded">.github/workflows/uptime-check.yml</code>) runs every 5 minutes and pings the health endpoint. GitHub sends email notifications automatically when the check fails.
          </p>
          <p>
            To activate it, add a <strong>PRODUCTION_URL</strong> secret in your GitHub repository settings (Settings → Secrets → Actions) with your deployed app URL:
          </p>
          <code className="block bg-slate-50 border border-slate-200 rounded-md px-3 py-2 font-mono text-xs text-slate-800">
            PRODUCTION_URL = https://your-app.replit.app
          </code>
          <p>Health endpoint being monitored:</p>
          <div className="flex items-center gap-2">
            <code className="flex-1 block bg-slate-50 border border-slate-200 rounded-md px-3 py-2 font-mono text-xs text-slate-800 break-all">
              GET {healthzUrl}
            </code>
            <a
              href={healthzUrl}
              target="_blank"
              rel="noreferrer"
              className="text-blue-600 hover:text-blue-700 flex-shrink-0"
              title="Open health endpoint"
            >
              <ExternalLink className="w-4 h-4" />
            </a>
          </div>
          <p className="text-slate-500 text-xs">
            Returns <strong>200</strong> with <code className="bg-slate-100 px-1 rounded">{"{ \"status\": \"ok\" }"}</code> when healthy, or <strong>503</strong> when the database is unreachable.
            You can also register this URL with UptimeRobot or Better Uptime (free plans available) for SMS/email alerts.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
