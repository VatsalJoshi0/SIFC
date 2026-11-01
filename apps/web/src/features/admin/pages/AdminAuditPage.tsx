import React from "react";
import { useQuery } from "@tanstack/react-query";
import { adminApi } from "../../../api/adminClient";
import {
  Download,
  Activity,
  Clock,
} from "lucide-react";

export const AdminAuditPage: React.FC = () => {
  const { data, isLoading } = useQuery({
    queryKey: ["admin", "audit-logs"],
    queryFn: () => adminApi.system.listAuditLogs({ limit: 50 }),
  });

  const exportTypes = [
    { type: "users", label: "Export Citizens CSV", desc: "Citizen demographics, scores, and masked PANs" },
    { type: "transactions", label: "Export Transactions CSV", desc: "Quotes, payments, fee lines, and refunds" },
    { type: "challans", label: "Export Challans CSV", desc: "Violations, penalties, and dispute statuses" },
    { type: "audit-logs", label: "Export Audit Trail CSV", desc: "Immutable timeline of all admin and system actions" },
  ] as const;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Immutable Audit Trail & Regulatory Exports
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Section 136A & DPDP Act compliant tamper-proof event logging with SQLite append-only triggers.
          </p>
        </div>
      </div>

      {/* CSV Export Card Grid */}
      <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-4">
        <h2 className="text-sm font-bold text-slate-900 flex items-center space-x-2">
          <Download className="w-4 h-4 text-indigo-600" />
          <span>Statutory Data Export Center (CSV)</span>
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {exportTypes.map((item) => (
            <a
              key={item.type}
              href={adminApi.system.getExportCsvUrl(item.type)}
              download
              target="_blank"
              rel="noreferrer"
              className="p-4 rounded-lg border border-slate-200 hover:border-indigo-400 hover:bg-indigo-50/30 transition flex flex-col justify-between group"
            >
              <div>
                <div className="font-semibold text-xs text-slate-900 group-hover:text-indigo-600 flex items-center justify-between">
                  <span>{item.label}</span>
                  <Download className="w-3.5 h-3.5 text-slate-400 group-hover:text-indigo-600" />
                </div>
                <p className="text-[11px] text-slate-500 mt-1">{item.desc}</p>
              </div>
              <div className="mt-3 text-[10px] font-mono text-indigo-600 font-semibold">
                .CSV FORMAT
              </div>
            </a>
          ))}
        </div>
      </div>

      {/* Audit Logs Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center space-x-2">
            <Clock className="w-4 h-4 text-slate-500" />
            <span>Recent System Events (Append-Only)</span>
          </h2>
          <span className="text-[11px] text-slate-500">
            {data?.count ?? 0} events recorded
          </span>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-20 text-slate-500">
            <Activity className="w-5 h-5 animate-spin mr-2" />
            <span>Loading audit log entries...</span>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold uppercase">
                <tr>
                  <th className="py-3 px-4">Timestamp</th>
                  <th className="py-3 px-4">Action</th>
                  <th className="py-3 px-4">Actor</th>
                  <th className="py-3 px-4">Entity</th>
                  <th className="py-3 px-4">Entity ID</th>
                  <th className="py-3 px-4">Details / Delta</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {(data?.logs || []).map((log) => (
                  <tr key={log.logId} className="hover:bg-slate-50 transition">
                    <td className="py-3 px-4 text-slate-500 font-mono text-[11px]">
                      {new Date(log.createdAt).toLocaleString()}
                    </td>
                    <td className="py-3 px-4">
                      <span className="font-mono text-[11px] font-bold text-slate-800 bg-slate-100 px-2 py-0.5 rounded">
                        {log.action}
                      </span>
                    </td>
                    <td className="py-3 px-4 font-mono text-slate-600">
                      {log.actorId}
                    </td>
                    <td className="py-3 px-4 font-medium text-slate-700">
                      {log.entityType}
                    </td>
                    <td className="py-3 px-4 font-mono text-slate-500 text-[11px]">
                      {log.entityId}
                    </td>
                    <td className="py-3 px-4 max-w-xs truncate font-mono text-[10px] text-slate-600">
                      {JSON.stringify(log.details)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
