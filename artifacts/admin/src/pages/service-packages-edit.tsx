import { useState, useEffect } from "react";
import { useLocation, useParams } from "wouter";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/hooks/use-auth";
import { ArrowLeft, Plus, Trash2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const ICONS = [
  "package", "alert-triangle", "arrow-right", "arrow-left", "eye",
  "droplet", "settings", "wrench", "tool", "shield", "zap", "truck",
  "check-circle", "star", "activity", "cpu", "wind", "thermometer",
];

const COLORS = [
  { label: "Blue", value: "#2563eb" },
  { label: "Red", value: "#dc2626" },
  { label: "Purple", value: "#7c3aed" },
  { label: "Cyan", value: "#0891b2" },
  { label: "Amber", value: "#d97706" },
  { label: "Green", value: "#16a34a" },
  { label: "Slate", value: "#475569" },
  { label: "Pink", value: "#db2777" },
];

type LineType = "labor" | "part" | "material";

interface LineItem {
  id: string;
  lineType: LineType;
  laborCategory: string;
  description: string;
  hours: string;
  quantity: string;
  unitPrice: string;
}

function newLine(): LineItem {
  return {
    id: crypto.randomUUID(),
    lineType: "labor",
    laborCategory: "",
    description: "",
    hours: "",
    quantity: "",
    unitPrice: "0",
  };
}

export default function ServicePackagesEditPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const [, navigate] = useLocation();
  const queryClient = useQueryClient();

  const [name, setName] = useState("");
  const [vehicleModel, setVehicleModel] = useState("");
  const [serviceInterval, setServiceInterval] = useState("");
  const [bundleCode, setBundleCode] = useState("");
  const [icon, setIcon] = useState("package");
  const [color, setColor] = useState("#2563eb");
  const [description, setDescription] = useState("");
  const [lines, setLines] = useState<LineItem[]>([newLine()]);
  const [isActive, setIsActive] = useState(true);
  const [initialized, setInitialized] = useState(false);

  const { data: pkg, isLoading } = useQuery({
    queryKey: ["admin", "service-packages", id],
    queryFn: () => api(`/admin/service-packages/${id}`),
    enabled: !!id,
  });

  useEffect(() => {
    if (pkg && !initialized) {
      setName(pkg.name ?? "");
      setVehicleModel(pkg.vehicleModel ?? "");
      setServiceInterval(pkg.serviceInterval ?? "");
      setBundleCode(pkg.bundleCode ?? "");
      setIcon(pkg.icon ?? "package");
      setColor(pkg.color ?? "#2563eb");
      setDescription(pkg.description ?? "");
      setIsActive(pkg.isActive ?? true);
      if (pkg.lines && pkg.lines.length > 0) {
        setLines(
          pkg.lines.map((l: any) => ({
            id: crypto.randomUUID(),
            lineType: l.lineType,
            laborCategory: l.laborCategory ?? "",
            description: l.description,
            hours: l.hours ?? "",
            quantity: l.quantity ?? "",
            unitPrice: l.unitPrice ?? "0",
          }))
        );
      }
      setInitialized(true);
    }
  }, [pkg, initialized]);

  const updateMutation = useMutation({
    mutationFn: () =>
      api(`/admin/service-packages/${id}`, {
        method: "PATCH",
        body: JSON.stringify({
          name: name.trim(),
          vehicleModel: vehicleModel.trim() || null,
          serviceInterval: serviceInterval.trim() || null,
          bundleCode: bundleCode.trim() || null,
          icon,
          color,
          description: description.trim(),
          isActive,
          lines: lines.map((l, idx) => ({
            lineType: l.lineType,
            laborCategory: l.laborCategory || undefined,
            description: l.description,
            hours: l.hours || undefined,
            quantity: l.quantity || undefined,
            unitPrice: l.unitPrice || "0",
            displayOrder: idx + 1,
          })),
        }),
      }),
    onSuccess: () => {
      toast.success("Service package updated");
      queryClient.invalidateQueries({ queryKey: ["admin", "service-packages"] });
      navigate("/master/service-packages");
    },
    onError: (err: Error) => {
      toast.error(err.message);
    },
  });

  function updateLine(lineId: string, field: keyof LineItem, value: string) {
    setLines((prev) => prev.map((l) => l.id === lineId ? { ...l, [field]: value } : l));
  }

  function removeLine(lineId: string) {
    setLines((prev) => prev.filter((l) => l.id !== lineId));
  }

  const totalLaborHours = lines
    .filter((l) => l.lineType === "labor")
    .reduce((sum, l) => sum + (parseFloat(l.hours) || 0), 0);
  const totalPartsCost = lines
    .filter((l) => l.lineType !== "labor")
    .reduce((sum, l) => {
      const qty = parseFloat(l.quantity) || 1;
      const price = parseFloat(l.unitPrice) || 0;
      return sum + qty * price;
    }, 0);

  const canSubmit = name.trim() && lines.every((l) => l.description.trim());

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  if (!pkg && !isLoading) {
    return (
      <div className="text-center text-slate-500 py-20">Package not found.</div>
    );
  }

  return (
    <div className="max-w-4xl space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate("/master/service-packages")}>
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Edit Service Package</h1>
          <p className="text-slate-500">Update package details and line items</p>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 space-y-5">
        <h2 className="font-semibold text-slate-800 text-sm uppercase tracking-wide">Package Details</h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="sm:col-span-2">
            <Label htmlFor="name">Package Name *</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Full Front Impact"
              className="mt-1"
            />
          </div>
          <div>
            <Label htmlFor="vehicleModel">Vehicle Model</Label>
            <Input
              id="vehicleModel"
              value={vehicleModel}
              onChange={(e) => setVehicleModel(e.target.value)}
              placeholder="e.g. RAM DT"
              className="mt-1"
            />
          </div>
          <div>
            <Label htmlFor="serviceInterval">Service Interval</Label>
            <Input
              id="serviceInterval"
              value={serviceInterval}
              onChange={(e) => setServiceInterval(e.target.value)}
              placeholder="e.g. 1.1yr"
              className="mt-1"
            />
          </div>
          <div>
            <Label htmlFor="bundleCode">Bundle Code</Label>
            <Input
              id="bundleCode"
              value={bundleCode}
              onChange={(e) => setBundleCode(e.target.value)}
              placeholder="e.g. 68552462AA"
              className="mt-1"
            />
          </div>
          <div>
            <Label>Color</Label>
            <div className="flex flex-wrap gap-2 mt-1">
              {COLORS.map((c) => (
                <button
                  key={c.value}
                  type="button"
                  title={c.label}
                  onClick={() => setColor(c.value)}
                  className={cn(
                    "w-7 h-7 rounded-full border-2 transition-all",
                    color === c.value ? "border-slate-800 scale-110" : "border-transparent"
                  )}
                  style={{ backgroundColor: c.value }}
                />
              ))}
            </div>
          </div>
          <div>
            <Label htmlFor="icon">Icon</Label>
            <Select value={icon} onValueChange={setIcon}>
              <SelectTrigger id="icon" className="mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ICONS.map((i) => (
                  <SelectItem key={i} value={i}>{i}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="sm:col-span-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Brief description of this service package"
              className="mt-1 resize-none"
              rows={2}
            />
          </div>
          <div className="sm:col-span-2">
            <Label className="mb-2 block">Status</Label>
            <div className="flex items-center gap-3">
              <Switch
                id="isActive"
                checked={isActive}
                onCheckedChange={setIsActive}
              />
              <label
                htmlFor="isActive"
                className={cn(
                  "text-sm font-medium cursor-pointer select-none",
                  isActive ? "text-green-700" : "text-slate-400"
                )}
              >
                {isActive ? "Active — visible to technicians" : "Inactive — hidden from use"}
              </label>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <h2 className="font-semibold text-slate-800 text-sm uppercase tracking-wide">Line Items</h2>
          <Button
            size="sm"
            variant="outline"
            onClick={() => setLines((prev) => [...prev, newLine()])}
          >
            <Plus className="w-4 h-4 mr-1" />
            Add Line
          </Button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-100">
              <tr>
                <th className="text-left px-4 py-2 text-xs font-semibold text-slate-500 uppercase w-28">Type</th>
                <th className="text-left px-4 py-2 text-xs font-semibold text-slate-500 uppercase w-32">Category</th>
                <th className="text-left px-4 py-2 text-xs font-semibold text-slate-500 uppercase">Description *</th>
                <th className="text-left px-4 py-2 text-xs font-semibold text-slate-500 uppercase w-20">Hours</th>
                <th className="text-left px-4 py-2 text-xs font-semibold text-slate-500 uppercase w-20">Qty</th>
                <th className="text-left px-4 py-2 text-xs font-semibold text-slate-500 uppercase w-24">Unit Price</th>
                <th className="w-10" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {lines.map((line) => (
                <tr key={line.id} className="hover:bg-slate-50/50">
                  <td className="px-4 py-2">
                    <Select value={line.lineType} onValueChange={(v) => updateLine(line.id, "lineType", v)}>
                      <SelectTrigger className="h-8 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="labor">Labor</SelectItem>
                        <SelectItem value="part">Part</SelectItem>
                        <SelectItem value="material">Material</SelectItem>
                      </SelectContent>
                    </Select>
                  </td>
                  <td className="px-4 py-2">
                    {line.lineType === "labor" ? (
                      <Select value={line.laborCategory} onValueChange={(v) => updateLine(line.id, "laborCategory", v)}>
                        <SelectTrigger className="h-8 text-xs">
                          <SelectValue placeholder="Category" />
                        </SelectTrigger>
                        <SelectContent>
                          {["body", "refinish", "mechanical", "frame", "glass", "electrical", "trim", "other"].map((c) => (
                            <SelectItem key={c} value={c}>{c}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : (
                      <span className="text-slate-400 text-xs px-2">—</span>
                    )}
                  </td>
                  <td className="px-4 py-2">
                    <Input
                      value={line.description}
                      onChange={(e) => updateLine(line.id, "description", e.target.value)}
                      placeholder="Description"
                      className="h-8 text-xs"
                    />
                  </td>
                  <td className="px-4 py-2">
                    {line.lineType === "labor" ? (
                      <Input
                        type="number"
                        min="0"
                        step="0.5"
                        value={line.hours}
                        onChange={(e) => updateLine(line.id, "hours", e.target.value)}
                        placeholder="0.0"
                        className="h-8 text-xs"
                      />
                    ) : (
                      <span className="text-slate-400 text-xs px-2">—</span>
                    )}
                  </td>
                  <td className="px-4 py-2">
                    {line.lineType !== "labor" ? (
                      <Input
                        type="number"
                        min="0"
                        value={line.quantity}
                        onChange={(e) => updateLine(line.id, "quantity", e.target.value)}
                        placeholder="1"
                        className="h-8 text-xs"
                      />
                    ) : (
                      <span className="text-slate-400 text-xs px-2">—</span>
                    )}
                  </td>
                  <td className="px-4 py-2">
                    <Input
                      type="number"
                      min="0"
                      value={line.unitPrice}
                      onChange={(e) => updateLine(line.id, "unitPrice", e.target.value)}
                      placeholder="0"
                      className="h-8 text-xs"
                    />
                  </td>
                  <td className="px-4 py-2">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-slate-400 hover:text-red-500"
                      onClick={() => removeLine(line.id)}
                      disabled={lines.length === 1}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex flex-wrap gap-6 text-sm">
          <div>
            <span className="text-slate-500">Total Labor Hours</span>
            <span className="ml-2 font-semibold text-slate-800">{totalLaborHours.toFixed(1)} hrs</span>
          </div>
          <div>
            <span className="text-slate-500">Parts & Materials Cost</span>
            <span className="ml-2 font-semibold text-slate-800">${totalPartsCost.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
          </div>
          <div>
            <span className="text-slate-500">Line Items</span>
            <span className="ml-2 font-semibold text-slate-800">{lines.length}</span>
          </div>
        </div>
      </div>

      <div className="flex justify-end gap-3">
        <Button variant="outline" onClick={() => navigate("/master/service-packages")}>
          Cancel
        </Button>
        <Button
          onClick={() => updateMutation.mutate()}
          disabled={updateMutation.isPending || !canSubmit}
          className="bg-blue-600 hover:bg-blue-700"
        >
          {updateMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
          Save Changes
        </Button>
      </div>
    </div>
  );
}
