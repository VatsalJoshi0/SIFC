import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { adminApi } from "../../../api/adminClient";
import {
  Search,
  Eye,
  Shield,
  Activity,
  Car,
  CheckCircle,
  XCircle,
} from "lucide-react";

export const AdminCitizensPage: React.FC = () => {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedUser, setSelectedUser] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["admin", "users", searchQuery],
    queryFn: () => adminApi.users.list({ query: searchQuery || undefined, limit: 50 }),
  });

  const { data: userDetail, isLoading: loadingDetail } = useQuery({
    queryKey: ["admin", "user-detail", selectedUser],
    queryFn: () => (selectedUser ? adminApi.users.getDetail(selectedUser) : null),
    enabled: !!selectedUser,
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Citizen & Fleet Compliance Directory
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Search citizen profiles with privacy-preserving PAN masking (P2: <code>XXXXXX001X</code>).
          </p>
        </div>

        <div className="relative w-full sm:w-72">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
          <input
            type="text"
            placeholder="Search by name, city, PAN..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-2 bg-white border border-slate-300 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-20 text-slate-500">
          <Activity className="w-5 h-5 animate-spin mr-2" />
          <span>Searching directory...</span>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Citizens Table (2 columns on lg) */}
          <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold uppercase tracking-wider">
                  <tr>
                    <th className="py-3 px-4">Citizen</th>
                    <th className="py-3 px-4">Masked PAN</th>
                    <th className="py-3 px-4">Location</th>
                    <th className="py-3 px-4">VAI Score</th>
                    <th className="py-3 px-4">Fleet</th>
                    <th className="py-3 px-4 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {(data?.users || []).map((u) => (
                    <tr
                      key={u.userId}
                      onClick={() => setSelectedUser(u.userId)}
                      className={`cursor-pointer transition hover:bg-slate-50 ${
                        selectedUser === u.userId ? "bg-indigo-50/50" : ""
                      }`}
                    >
                      <td className="py-3 px-4 font-semibold text-slate-900">
                        {u.fullName}
                      </td>
                      <td className="py-3 px-4 font-mono text-slate-600">
                        {u.panMasked}
                      </td>
                      <td className="py-3 px-4 text-slate-500">
                        {u.city}, {u.state}
                      </td>
                      <td className="py-3 px-4">
                        {u.score ? (
                          <div className="flex items-center space-x-1.5">
                            <span className="font-bold text-slate-900">{u.score}</span>
                            <span
                              className={`text-[10px] px-1.5 py-0.2 rounded font-bold uppercase ${
                                u.category === "VERY_GOOD"
                                  ? "bg-emerald-100 text-emerald-800"
                                  : u.category === "GOOD"
                                  ? "bg-blue-100 text-blue-800"
                                  : "bg-amber-100 text-amber-800"
                              }`}
                            >
                              {u.category}
                            </span>
                          </div>
                        ) : (
                          <span className="text-slate-400">Uncomputed</span>
                        )}
                      </td>
                      <td className="py-3 px-4 font-medium text-slate-600">
                        {u.vehicleCount} vehicle{u.vehicleCount === 1 ? "" : "s"}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedUser(u.userId);
                          }}
                          className="text-indigo-600 hover:text-indigo-800 font-medium inline-flex items-center space-x-1"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          <span>Inspect</span>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Citizen Detail Drawer / Card */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 space-y-4">
            <h2 className="text-sm font-bold text-slate-900 flex items-center space-x-2">
              <Shield className="w-4 h-4 text-indigo-600" />
              <span>Inspector View</span>
            </h2>

            {!selectedUser ? (
              <div className="text-center py-16 text-slate-400 text-xs">
                Select a citizen from the list to inspect vehicles, compliance, and challan records.
              </div>
            ) : loadingDetail ? (
              <div className="flex items-center justify-center py-16 text-slate-500 text-xs">
                <Activity className="w-4 h-4 animate-spin mr-2" />
                <span>Loading profile details...</span>
              </div>
            ) : userDetail?.user ? (
              <div className="space-y-4 text-xs">
                <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                  <div className="font-bold text-sm text-slate-900">
                    {userDetail.user.fullName}
                  </div>
                  <div className="text-slate-500 font-mono mt-0.5">
                    PAN: {userDetail.user.panMasked}
                  </div>
                  <div className="text-slate-500 mt-0.5">
                    Location: {userDetail.user.city}, {userDetail.user.state}
                  </div>
                  {userDetail.user.vaiScore && (
                    <div className="mt-2 pt-2 border-t border-slate-200 flex items-center justify-between">
                      <span className="font-semibold text-slate-700">VAI Score:</span>
                      <span className="font-bold text-sm text-indigo-700">
                        {userDetail.user.vaiScore.score} ({userDetail.user.vaiScore.category})
                      </span>
                    </div>
                  )}
                </div>

                {/* Vehicles List */}
                <div>
                  <h3 className="font-bold text-slate-800 mb-2 flex items-center space-x-1">
                    <Car className="w-3.5 h-3.5 text-slate-500" />
                    <span>Registered Vehicles ({(userDetail.user.vehicles || []).length})</span>
                  </h3>
                  <div className="space-y-2 max-h-40 overflow-y-auto">
                    {(userDetail.user.vehicles || []).map((v) => (
                      <div
                        key={v.vehicleId}
                        className="p-2.5 bg-slate-50 rounded border border-slate-200 flex items-center justify-between"
                      >
                        <div>
                          <div className="font-mono font-bold text-slate-800">
                            {v.registrationNo}
                          </div>
                          <div className="text-[10px] text-slate-500">{v.vehicleType}</div>
                        </div>
                        {v.compliance?.fullyCompliant ? (
                          <span className="inline-flex items-center space-x-1 text-[10px] text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded font-semibold">
                            <CheckCircle className="w-3 h-3" />
                            <span>Compliant</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center space-x-1 text-[10px] text-rose-700 bg-rose-100 px-2 py-0.5 rounded font-semibold">
                            <XCircle className="w-3 h-3" />
                            <span>Expired Docs</span>
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Challans */}
                <div>
                  <h3 className="font-bold text-slate-800 mb-2">
                    Recent Challans ({(userDetail.user.challans || []).length})
                  </h3>
                  <div className="space-y-1.5 max-h-48 overflow-y-auto">
                    {(!userDetail.user.challans || userDetail.user.challans.length === 0) ? (
                      <p className="text-slate-400 italic">No challans on file</p>
                    ) : (
                      userDetail.user.challans.map((c) => (
                        <div
                          key={c.challanId}
                          className="p-2 bg-slate-50 rounded border border-slate-200 flex items-center justify-between"
                        >
                          <div>
                            <div className="font-medium text-slate-800">{c.violationDesc}</div>
                            <div className="text-[10px] text-slate-500">
                              ₹{(c.amountPaise / 100).toFixed(2)} • {c.severity}
                            </div>
                          </div>
                          <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-slate-200 text-slate-800">
                            {c.status}
                          </span>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
};
