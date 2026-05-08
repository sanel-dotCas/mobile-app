/** Escape a value for safe HTML interpolation — prevents XSS. */
function h(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return "";
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export interface PlanSlot {
  id: number;
  packageName: string;
  slotOrder: number;
  redeemed: boolean;
}

export interface ServicePlanForCard {
  id: number;
  planNumber: string;
  name: string;
  customerName: string | null;
  vin: string;
  vehicleLabel: string | null;
  status: "active" | "exhausted" | "cancelled";
  expiryDate: Date | null;
  maxMileage: number | null;
  slots: PlanSlot[];
  totalSlots: number;
  usedSlots: number;
  remainingSlots: number;
}

const STATUS_LABEL: Record<ServicePlanForCard["status"], string> = {
  active: "Active",
  exhausted: "Exhausted",
  cancelled: "Cancelled",
};

const STATUS_COLOR: Record<ServicePlanForCard["status"], string> = {
  active: "#16a34a",
  exhausted: "#64748b",
  cancelled: "#ef4444",
};

const STATUS_BG: Record<ServicePlanForCard["status"], string> = {
  active: "#dcfce7",
  exhausted: "#f1f5f9",
  cancelled: "#fee2e2",
};

function buildSlotBar(plan: ServicePlanForCard): string {
  return plan.slots
    .map((slot) => {
      const color = slot.redeemed
        ? "#94a3b8"
        : plan.status === "active"
        ? "#16a34a"
        : "#d1d5db";
      return `<div style="flex:1;height:8px;border-radius:4px;background:${color};min-width:0;"></div>`;
    })
    .join("");
}

function buildSlotList(plan: ServicePlanForCard): string {
  return plan.slots
    .map(
      (slot) => `
    <tr>
      <td style="padding:9px 0;border-bottom:1px solid #e2e8f0;">
        <div style="display:flex;align-items:center;gap:10px;">
          <span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:${slot.redeemed ? "#94a3b8" : "#16a34a"};flex-shrink:0;"></span>
          <span style="font-size:13px;color:#1e293b;">${h(slot.packageName)}</span>
        </div>
      </td>
      <td style="padding:9px 0;text-align:right;vertical-align:middle;border-bottom:1px solid #e2e8f0;">
        <span style="
          display:inline-flex;align-items:center;gap:4px;
          padding:3px 9px;border-radius:8px;font-size:11px;font-weight:600;
          background:${slot.redeemed ? "#f1f5f9" : "#dcfce7"};
          color:${slot.redeemed ? "#64748b" : "#16a34a"};
        ">${slot.redeemed ? "Used" : "Available"}</span>
      </td>
    </tr>
  `
    )
    .join("");
}

export function buildPlanCardHtml(plan: ServicePlanForCard): string {
  const expiryDate = plan.expiryDate;
  const isExpired = expiryDate !== null && expiryDate !== undefined && expiryDate < new Date();
  const statusColor = STATUS_COLOR[plan.status];
  const statusBg = STATUS_BG[plan.status];
  const statusLabel = STATUS_LABEL[plan.status];
  const printDate = new Date().toLocaleDateString("en-AU", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
  const expiryFormatted = expiryDate
    ? expiryDate.toLocaleDateString("en-AU", { day: "numeric", month: "long", year: "numeric" })
    : null;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Service Plan Card &mdash; ${h(plan.planNumber)}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      background: #f8fafc;
      display: flex;
      justify-content: center;
      align-items: flex-start;
      min-height: 100vh;
      padding: 32px 16px;
    }
    .card {
      background: #ffffff;
      border-radius: 20px;
      width: 100%;
      max-width: 480px;
      box-shadow: 0 4px 24px rgba(0,0,0,0.10);
      overflow: hidden;
    }
    .header {
      background: #1d4ed8;
      padding: 24px 24px 20px;
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: 12px;
    }
    .brand { display: flex; align-items: center; gap: 10px; }
    .brand-logo {
      width: 36px; height: 36px; border-radius: 8px;
      background: rgba(255,255,255,0.18);
      display: flex; align-items: center; justify-content: center;
      font-size: 16px; font-weight: 800; color: #fff;
      letter-spacing: -0.5px;
    }
    .brand-name  { font-size: 14px; font-weight: 700; color: #fff; line-height: 1.2; }
    .brand-sub   { font-size: 11px; color: rgba(255,255,255,0.72); margin-top: 1px; }
    .plan-number-badge { background: rgba(255,255,255,0.18); border-radius: 10px; padding: 6px 12px; text-align: right; }
    .plan-number-label { font-size: 10px; color: rgba(255,255,255,0.72); }
    .plan-number-value { font-size: 14px; font-weight: 800; color: #fff; margin-top: 2px; }

    .body { padding: 22px 24px; }
    .plan-name     { font-size: 18px; font-weight: 700; color: #0f172a; margin-bottom: 4px; }
    .customer-name { font-size: 14px; color: #475569; margin-bottom: 4px; font-weight: 500; }
    .status-row  { display: flex; align-items: center; gap: 8px; margin-bottom: 16px; }
    .status-badge {
      display: inline-flex; align-items: center; gap: 5px;
      padding: 4px 10px; border-radius: 20px;
      font-size: 11px; font-weight: 600;
      background: ${statusBg}; color: ${statusColor};
    }
    .status-dot { width: 7px; height: 7px; border-radius: 50%; background: ${statusColor}; }

    .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 20px; }
    .info-cell  { background: #f8fafc; border-radius: 12px; padding: 12px; }
    .info-label { font-size: 10px; color: #64748b; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 4px; }
    .info-value { font-size: 13px; color: #1e293b; font-weight: 600; word-break: break-all; }

    .expiry-row {
      display: flex; align-items: center; gap: 8px;
      padding: 10px 14px; border-radius: 10px; margin-bottom: 16px;
      background: ${isExpired ? "#fee2e2" : "#eff6ff"};
      font-size: 12px; font-weight: 600;
      color: ${isExpired ? "#ef4444" : "#1d4ed8"};
    }

    .slots-section { margin-bottom: 18px; }
    .slots-header  { display: flex; align-items: center; justify-content: space-between; margin-bottom: 10px; }
    .slots-label   { font-size: 12px; font-weight: 600; color: #64748b; text-transform: uppercase; letter-spacing: 0.5px; }
    .slots-count   { font-size: 13px; font-weight: 700; color: #1d4ed8; }

    .slot-stat-row { display: flex; border: 1.5px solid #e2e8f0; border-radius: 12px; overflow: hidden; margin-bottom: 10px; }
    .slot-stat     { flex: 1; text-align: center; padding: 12px 8px; }
    .slot-stat + .slot-stat { border-left: 1.5px solid #e2e8f0; }
    .slot-stat-value { font-size: 24px; font-weight: 800; }
    .slot-stat-label { font-size: 10px; color: #64748b; margin-top: 2px; }

    .slot-bar { display: flex; gap: 3px; margin-bottom: 16px; }

    .services-label { font-size: 12px; font-weight: 600; color: #64748b; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 8px; }
    .services-table { width: 100%; border-collapse: collapse; }

    .footer {
      background: #f8fafc; border-top: 1.5px solid #e2e8f0;
      padding: 14px 24px;
      display: flex; align-items: center; justify-content: space-between;
    }
    .footer span { font-size: 10px; color: #94a3b8; }

    @media print {
      body { background: #fff; padding: 0; }
      .card { box-shadow: none; border-radius: 0; max-width: 100%; }
    }
  </style>
</head>
<body>
  <div class="card">
    <div class="header">
      <div class="brand">
        <div class="brand-logo">IG</div>
        <div>
          <div class="brand-name">IGMMA DMS</div>
          <div class="brand-sub">Prepaid Service Plan</div>
        </div>
      </div>
      <div class="plan-number-badge">
        <div class="plan-number-label">Plan Number</div>
        <div class="plan-number-value">${h(plan.planNumber)}</div>
      </div>
    </div>

    <div class="body">
      <div class="plan-name">${h(plan.name)}</div>
      ${plan.customerName ? `<div class="customer-name">${h(plan.customerName)}</div>` : ""}
      <div class="status-row">
        <span class="status-badge">
          <span class="status-dot"></span>
          ${h(statusLabel)}
        </span>
      </div>

      <div class="info-grid">
        <div class="info-cell">
          <div class="info-label">VIN</div>
          <div class="info-value">${h(plan.vin)}</div>
        </div>
        ${
          plan.vehicleLabel
            ? `<div class="info-cell">
          <div class="info-label">Vehicle</div>
          <div class="info-value">${h(plan.vehicleLabel)}</div>
        </div>`
            : `<div class="info-cell">
          <div class="info-label">Total Services</div>
          <div class="info-value">${h(plan.totalSlots)}</div>
        </div>`
        }
      </div>

      ${
        expiryDate
          ? `<div class="expiry-row">
        <span>&#128197;</span>
        <span>${h(isExpired ? "Expired" : "Expires")}: ${h(expiryFormatted)}</span>
        ${plan.maxMileage ? `&nbsp;&bull;&nbsp;<span>Max ${h(plan.maxMileage.toLocaleString())} km</span>` : ""}
      </div>`
          : ""
      }

      <div class="slots-section">
        <div class="slots-header">
          <span class="slots-label">Service Slots</span>
          <span class="slots-count">${h(plan.remainingSlots)} of ${h(plan.totalSlots)} remaining</span>
        </div>

        <div class="slot-stat-row">
          <div class="slot-stat">
            <div class="slot-stat-value" style="color:#1d4ed8;">${h(plan.remainingSlots)}</div>
            <div class="slot-stat-label">Remaining</div>
          </div>
          <div class="slot-stat">
            <div class="slot-stat-value" style="color:#64748b;">${h(plan.usedSlots)}</div>
            <div class="slot-stat-label">Used</div>
          </div>
          <div class="slot-stat">
            <div class="slot-stat-value" style="color:#0f172a;">${h(plan.totalSlots)}</div>
            <div class="slot-stat-label">Total</div>
          </div>
        </div>

        <div class="slot-bar">
          ${buildSlotBar(plan)}
        </div>
      </div>

      <div>
        <div class="services-label">Included Services</div>
        <table class="services-table">
          <tbody>
            ${buildSlotList(plan)}
          </tbody>
        </table>
      </div>
    </div>

    <div class="footer">
      <span>Printed ${h(printDate)}</span>
      <span>IGMMA Dealer Management System</span>
    </div>
  </div>
</body>
</html>`;
}
