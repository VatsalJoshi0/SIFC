import React from "react";
import { useParams, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  Car,
  ArrowLeft,
  ChevronRight,
  FileText,
} from "lucide-react";
import { api } from "../../api/client";
import { formatDate, formatCurrency } from "../../lib/formatting";

export const VehicleDetailPage: React.FC = () => {
  const { regNo } = useParams<{ regNo: string }>();

  const { data: vehicleData, isLoading: vehicleLoading } = useQuery({
    queryKey: ["vehicle", regNo],
    queryFn: () => api.vehicles.getVehicle(regNo || ""),
    enabled: !!regNo,
  });

  const { data: challansData } = useQuery({
    queryKey: ["vehicle", regNo, "challans"],
    queryFn: () => api.vehicles.getVehicleChallans(regNo || ""),
    enabled: !!regNo,
  });

  if (vehicleLoading || !vehicleData) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="w-10 h-10 border-4 border-teal-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const { vehicle } = vehicleData;
  const challans = challansData?.challans || [];

  return (
    <div className="space-y-8">
      {/* Back button */}
      <div>
        <Link
          to="/vehicles"
          className="inline-flex items-center gap-1.5 text-sm font-bold text-slate-600 hover:text-slate-900 min-h-[44px]"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to All Vehicles</span>
        </Link>
      </div>

      {/* Vehicle Hero Header */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 sm:p-8 flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-2xl bg-slate-100 text-slate-800 flex items-center justify-center">
            <Car className="w-8 h-8" />
          </div>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl sm:text-3xl font-black font-mono tracking-wider text-slate-900">
                {vehicle.registrationNo}
              </h1>
              <span
                className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${
                  vehicle.compliance.fullyCompliant
                    ? "bg-green-100 text-green-800 border border-green-200"
                    : "bg-red-100 text-red-800 border border-red-200"
                }`}
              >
                {vehicle.compliance.fullyCompliant ? "Fully Compliant" : "Document Expired"}
              </span>
            </div>
            <p className="text-slate-500 text-base mt-1">
              {vehicle.manufacturer} {vehicle.model} • {vehicle.vehicleType.replace("_", " ")} • Registered {formatDate(vehicle.registrationDate)}
            </p>
          </div>
        </div>

        {/* Quick Renew Button */}
        <div className="flex items-center gap-3">
          <Link
            to="/services/insurance"
            className="inline-flex items-center justify-center gap-2 bg-teal-600 hover:bg-teal-700 text-white font-bold px-6 py-3 rounded-xl shadow-sm transition min-h-[44px]"
          >
            <span>Renew Insurance</span>
            <ChevronRight className="w-4 h-4" />
          </Link>
        </div>
      </div>

      {/* 3 Document Cards with Actions */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Insurance */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-4 flex flex-col justify-between">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs uppercase font-bold text-slate-500 tracking-wider">Motor Insurance</span>
              <span
                className={`text-xs font-bold px-2 py-0.5 rounded ${
                  vehicle.compliance.insuranceValid
                    ? "bg-green-100 text-green-800"
                    : "bg-red-100 text-red-800"
                }`}
              >
                {vehicle.compliance.insuranceValid ? "Valid" : "Expired"}
              </span>
            </div>
            <div className="text-lg font-bold text-slate-900">
              {formatDate(vehicle.insuranceExpiry)}
            </div>
            <p className="text-xs text-slate-500">
              Comprehensive cover with VAI accountability discount.
            </p>
          </div>

          <Link
            to="/services/insurance"
            className="w-full text-center py-2.5 px-4 rounded-xl text-sm font-bold bg-teal-50 hover:bg-teal-100 text-teal-800 border border-teal-200 transition min-h-[44px] flex items-center justify-center"
          >
            {vehicle.compliance.insuranceValid ? "Extend Policy (+12 Mo)" : "Renew Policy Now"}
          </Link>
        </div>

        {/* PUC */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-4 flex flex-col justify-between">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs uppercase font-bold text-slate-500 tracking-wider">PUC Certificate</span>
              <span
                className={`text-xs font-bold px-2 py-0.5 rounded ${
                  vehicle.compliance.pucValid
                    ? "bg-green-100 text-green-800"
                    : "bg-red-100 text-red-800"
                }`}
              >
                {vehicle.compliance.pucValid ? "Valid" : "Expired"}
              </span>
            </div>
            <div className="text-lg font-bold text-slate-900">
              {formatDate(vehicle.pucExpiry)}
            </div>
            <p className="text-xs text-slate-500">
              Mandatory emission test compliance under Central Motor Vehicle Rules.
            </p>
          </div>

          <Link
            to="/services/puc"
            className="w-full text-center py-2.5 px-4 rounded-xl text-sm font-bold bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 transition min-h-[44px] flex items-center justify-center"
          >
            {vehicle.compliance.pucValid ? "Extend Certificate (+6 Mo)" : "Book Renewal Test"}
          </Link>
        </div>

        {/* RC */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-4 flex flex-col justify-between">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs uppercase font-bold text-slate-500 tracking-wider">Registration Certificate</span>
              <span
                className={`text-xs font-bold px-2 py-0.5 rounded ${
                  vehicle.compliance.rcValid
                    ? "bg-green-100 text-green-800"
                    : "bg-red-100 text-red-800"
                }`}
              >
                {vehicle.compliance.rcValid ? "Valid" : "Expired"}
              </span>
            </div>
            <div className="text-lg font-bold text-slate-900">
              {formatDate(vehicle.rcValidityTill)}
            </div>
            <p className="text-xs text-slate-500">
              Parivahan vehicle fitness and registration validity.
            </p>
          </div>

          <Link
            to="/services/rc"
            className="w-full text-center py-2.5 px-4 rounded-xl text-sm font-bold bg-blue-50 hover:bg-blue-100 text-blue-800 border border-blue-200 transition min-h-[44px] flex items-center justify-center"
          >
            Extend RC Fitness (+5 Yrs)
          </Link>
        </div>
      </div>

      {/* Vehicle Challans */}
      <section className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-teal-600" />
            <h2 className="text-lg font-bold text-slate-900">Challan History for {vehicle.registrationNo}</h2>
          </div>
          <span className="text-xs text-slate-500 font-medium">{challans.length} records</span>
        </div>

        {challans.length === 0 ? (
          <p className="text-sm text-slate-500 text-center py-8">
            No challans issued for this vehicle. Clean record!
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-700">
              <thead className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wider border-y border-slate-200">
                <tr>
                  <th scope="col" className="px-4 py-3">Challan ID</th>
                  <th scope="col" className="px-4 py-3">Date</th>
                  <th scope="col" className="px-4 py-3">Violation</th>
                  <th scope="col" className="px-4 py-3">Severity</th>
                  <th scope="col" className="px-4 py-3 text-right">Amount</th>
                  <th scope="col" className="px-4 py-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {challans.map((c) => (
                  <tr key={c.challanId} className="hover:bg-slate-50">
                    <td className="px-4 py-3 font-mono text-xs font-bold text-slate-900">
                      {c.challanId}
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-500 whitespace-nowrap">
                      {formatDate(c.challanDate)}
                    </td>
                    <td className="px-4 py-3 font-medium text-slate-900">
                      {c.violationDesc}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className={`text-xs font-bold px-2 py-0.5 rounded ${
                        c.severity === "HIGH" ? "bg-red-100 text-red-800" : c.severity === "MEDIUM" ? "bg-amber-100 text-amber-800" : "bg-blue-100 text-blue-800"
                      }`}>
                        {c.severity}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right font-mono font-bold text-slate-900 whitespace-nowrap">
                      {formatCurrency(c.amountPaise)}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className={`text-xs font-bold px-2 py-0.5 rounded ${
                        c.status === "PAID" ? "bg-green-100 text-green-800" : c.status === "UNPAID" ? "bg-red-100 text-red-800" : "bg-slate-100 text-slate-800"
                      }`}>
                        {c.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
};
