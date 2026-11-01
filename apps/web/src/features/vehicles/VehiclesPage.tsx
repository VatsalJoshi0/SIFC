import React from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Car, ShieldAlert, ShieldCheck, ChevronRight, ArrowRight } from "lucide-react";
import { api } from "../../api/client";
import { formatDate } from "../../lib/formatting";

export const VehiclesPage: React.FC = () => {
  const { data, isLoading } = useQuery({
    queryKey: ["vehicles"],
    queryFn: () => api.vehicles.getVehicles(),
    staleTime: 60000,
  });

  if (isLoading || !data) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="w-10 h-10 border-4 border-teal-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const vehicles = data.vehicles;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-black text-slate-900 tracking-tight">Registered Vehicles</h1>
        <p className="text-slate-600 text-base mt-1">
          Monitor insurance, PUC emission, and registration certificate compliance for all your vehicles.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {vehicles.map((v) => {
          const isCompliant = v.compliance.fullyCompliant;
          return (
            <div
              key={v.vehicleId}
              className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-5 hover:border-slate-300 transition-all flex flex-col justify-between"
            >
              <div>
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-2xl bg-slate-100 text-slate-700 flex items-center justify-center">
                      <Car className="w-6 h-6" />
                    </div>
                    <div>
                      <span className="font-mono text-lg font-black text-slate-900 tracking-wider block">
                        {v.registrationNo}
                      </span>
                      <span className="text-sm text-slate-500 font-medium">
                        {v.manufacturer} {v.model} ({v.vehicleType.replace("_", " ")})
                      </span>
                    </div>
                  </div>

                  <span
                    className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${
                      isCompliant
                        ? "bg-green-100 text-green-800 border border-green-200"
                        : "bg-red-100 text-red-800 border border-red-200"
                    }`}
                  >
                    {isCompliant ? (
                      <>
                        <ShieldCheck className="w-3.5 h-3.5 text-green-600" />
                        Compliant (+15)
                      </>
                    ) : (
                      <>
                        <ShieldAlert className="w-3.5 h-3.5 text-red-600" />
                        Attention Needed
                      </>
                    )}
                  </span>
                </div>

                {/* 3 Document Pills */}
                <div className="grid grid-cols-3 gap-2 pt-4">
                  {/* Insurance */}
                  <div className={`p-2.5 rounded-xl border text-center ${
                    v.compliance.insuranceValid
                      ? "bg-emerald-50/70 border-emerald-200 text-emerald-950"
                      : "bg-red-50/70 border-red-200 text-red-950"
                  }`}>
                    <span className="text-xs font-bold block">Insurance</span>
                    <span className="text-xs font-semibold block mt-0.5">
                      {v.compliance.insuranceValid ? "Valid" : "Expired"}
                    </span>
                    <span className="text-[11px] text-slate-500 block truncate mt-0.5">
                      {formatDate(v.insuranceExpiry)}
                    </span>
                  </div>

                  {/* PUC */}
                  <div className={`p-2.5 rounded-xl border text-center ${
                    v.compliance.pucValid
                      ? "bg-emerald-50/70 border-emerald-200 text-emerald-950"
                      : "bg-red-50/70 border-red-200 text-red-950"
                  }`}>
                    <span className="text-xs font-bold block">PUC</span>
                    <span className="text-xs font-semibold block mt-0.5">
                      {v.compliance.pucValid ? "Valid" : "Expired"}
                    </span>
                    <span className="text-[11px] text-slate-500 block truncate mt-0.5">
                      {formatDate(v.pucExpiry)}
                    </span>
                  </div>

                  {/* RC */}
                  <div className={`p-2.5 rounded-xl border text-center ${
                    v.compliance.rcValid
                      ? "bg-emerald-50/70 border-emerald-200 text-emerald-950"
                      : "bg-red-50/70 border-red-200 text-red-950"
                  }`}>
                    <span className="text-xs font-bold block">RC Validity</span>
                    <span className="text-xs font-semibold block mt-0.5">
                      {v.compliance.rcValid ? "Valid" : "Expired"}
                    </span>
                    <span className="text-[11px] text-slate-500 block truncate mt-0.5">
                      {formatDate(v.rcValidityTill)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
                <Link
                  to={`/vehicles/${v.registrationNo}`}
                  className="inline-flex items-center gap-1.5 text-sm font-bold text-teal-700 hover:text-teal-900 min-h-[44px]"
                >
                  <span>Vehicle details & challans</span>
                  <ChevronRight className="w-4 h-4" />
                </Link>

                {!isCompliant && (
                  <Link
                    to="/services/insurance"
                    className="inline-flex items-center gap-1 text-xs font-bold text-white bg-teal-600 hover:bg-teal-700 px-3 py-1.5 rounded-lg shadow-sm min-h-[36px]"
                  >
                    <span>Renew Now</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </Link>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
