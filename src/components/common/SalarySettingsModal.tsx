import React from "react";
import { X, Calendar, DollarSign, Info } from "lucide-react";
import { useCurrency } from "../../contexts/CurrencyContext";
import { PayCycleType } from "../../utils/dateUtils";

interface SalarySettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const SalarySettingsModal: React.FC<SalarySettingsModalProps> = ({
  isOpen,
  onClose,
}) => {
  const {
    payCycleType,
    salaryDay,
    setPayCycleType,
    setSalaryDay,
    getPayCycleRange,
  } = useCurrency();

  if (!isOpen) return null;

  const currentRange = getPayCycleRange();

  const handleTypeChange = (type: PayCycleType) => {
    setPayCycleType(type);
  };

  const handleDayChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseInt(e.target.value, 10);
    if (!isNaN(val)) {
      setSalaryDay(val);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md animate-fade-in">
      <div className="relative w-full max-w-lg overflow-hidden glass-modal rounded-3xl border border-white/10 shadow-2xl p-6 md:p-8 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/10 pb-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-gradient-to-tr from-[#ff3c02] to-[#fa7041] text-white shadow-lg shadow-[#ff3c02]/30">
              <Calendar className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-xl font-bold text-white">Payday & Cycle Settings</h3>
              <p className="text-xs text-slate-400">Configure how monthly tracking cycles are calculated</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Mode Selector */}
        <div className="space-y-3">
          <label className="text-sm font-semibold text-slate-200">Cycle Preference</label>
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => handleTypeChange("calendar")}
              className={`p-4 rounded-2xl border text-left transition-all flex flex-col justify-between ${
                payCycleType === "calendar"
                  ? "border-[#ff3c02] bg-[#ff3c02]/10 text-white shadow-md shadow-[#ff3c02]/20"
                  : "border-white/10 bg-white/5 text-slate-300 hover:bg-white/10"
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <Calendar className="w-5 h-5 text-[#fa7041]" />
                {payCycleType === "calendar" && (
                  <span className="w-2 h-2 rounded-full bg-[#ff3c02]"></span>
                )}
              </div>
              <span className="font-bold text-sm">Calendar Month</span>
              <span className="text-xs text-slate-400 mt-1">1st to last day of each month</span>
            </button>

            <button
              type="button"
              onClick={() => handleTypeChange("salary")}
              className={`p-4 rounded-2xl border text-left transition-all flex flex-col justify-between ${
                payCycleType === "salary"
                  ? "border-[#ff3c02] bg-[#ff3c02]/10 text-white shadow-md shadow-[#ff3c02]/20"
                  : "border-white/10 bg-white/5 text-slate-300 hover:bg-white/10"
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <DollarSign className="w-5 h-5 text-[#fa7041]" />
                {payCycleType === "salary" && (
                  <span className="w-2 h-2 rounded-full bg-[#ff3c02]"></span>
                )}
              </div>
              <span className="font-bold text-sm">Salary Date Cycle</span>
              <span className="text-xs text-slate-400 mt-1">Persists from payday date</span>
            </button>
          </div>
        </div>

        {/* Salary Day Selection (Only when Salary Date Cycle is active) */}
        {payCycleType === "salary" && (
          <div className="space-y-4 p-4 rounded-2xl bg-white/5 border border-white/10">
            <div className="flex items-center justify-between">
              <div>
                <label className="text-sm font-semibold text-slate-200">Salary Payday Date</label>
                <p className="text-xs text-slate-400">Day of the month your salary arrives</p>
              </div>
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#ff3c02]/20 border border-[#ff3c02]/40 text-[#fa7041] font-bold text-sm">
                <span>Day</span>
                <span className="text-white text-base">{salaryDay}</span>
              </div>
            </div>

            <div className="flex items-center gap-4">
              <input
                type="range"
                min="1"
                max="31"
                value={salaryDay}
                onChange={handleDayChange}
                className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-[#ff3c02]"
              />
              <input
                type="number"
                min="1"
                max="31"
                value={salaryDay}
                onChange={handleDayChange}
                className="w-16 px-2 py-1 text-center bg-black/40 border border-white/10 rounded-xl text-white font-bold text-sm focus:outline-none focus:border-[#ff3c02]"
              />
            </div>
          </div>
        )}

        {/* Live Active Cycle Preview */}
        <div className="p-4 rounded-2xl bg-gradient-to-r from-slate-900 to-black border border-white/10 space-y-2">
          <div className="flex items-center justify-between text-xs text-slate-400 font-medium">
            <span>CURRENT ACTIVE CYCLE RANGE</span>
            <span className="text-[#fa7041] uppercase tracking-wider font-semibold">
              {payCycleType === "salary" ? `Payday: ${salaryDay}th` : "Calendar"}
            </span>
          </div>
          <div className="text-lg font-extrabold text-white flex items-center justify-between">
            <span>{currentRange.label}</span>
          </div>
        </div>

        {/* Explanation Note */}
        <div className="p-3.5 rounded-2xl bg-blue-500/10 border border-blue-500/20 text-xs text-blue-300 flex items-start gap-2.5">
          <Info className="w-4 h-4 text-blue-400 flex-shrink-0 mt-0.5" />
          <p className="leading-relaxed">
            {payCycleType === "salary"
              ? `When month changes on the 1st, all your incomes and expenses from the ${salaryDay}th of the previous month persist until your next payday.`
              : "Standard calendar cycle resets income, expenses, and budgets on the 1st of every month."}
          </p>
        </div>

        {/* Action button */}
        <div className="pt-2">
          <button
            onClick={onClose}
            className="w-full py-3 rounded-2xl bg-gradient-to-r from-[#ff3c02] to-[#fa7041] text-white font-bold text-sm shadow-lg shadow-[#ff3c02]/30 hover:brightness-110 transition-all"
          >
            Apply & Close
          </button>
        </div>
      </div>
    </div>
  );
};
