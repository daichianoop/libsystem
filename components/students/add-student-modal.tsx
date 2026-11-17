"use client";

import React, { useState, useMemo } from "react";
import { X, UserPlus, Sparkles, AlertCircle, Loader2 } from "lucide-react";
import { generateUsername } from "@/lib/username";

interface AddStudentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onRegistered: (student: any, credentials: { username: string; hashCode: string }) => void;
}

const DEPARTMENTS = [
  "Computer Science & Engineering",
  "Electronics & Communication",
  "Electrical & Electronics",
  "Mechanical Engineering",
  "Information Technology",
  "Civil Engineering",
];

const HOSTELS = [
  "Aryabhatta Hall (Hostel 1)",
  "Ramanujan Hall (Hostel 2)",
  "Sarojini Naidu Hall (Hostel 3)",
  "Kalpana Chawla Hall (Hostel 4)",
];

export function AddStudentModal({ isOpen, onClose, onRegistered }: AddStudentModalProps) {
  const [fullName, setFullName] = useState("");
  const [rollNumber, setRollNumber] = useState("");
  const [category, setCategory] = useState<"1st Year" | "2nd Year" | "3rd Year" | "4th Year">("1st Year");
  const [department, setDepartment] = useState(DEPARTMENTS[0]);
  const [customDept, setCustomDept] = useState("");
  const [hostel, setHostel] = useState(HOSTELS[0]);
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Live username calculation preview
  const previewUsername = useMemo(() => {
    if (!fullName.trim() || !rollNumber.trim()) return "—";
    try {
      return generateUsername(fullName, rollNumber);
    } catch {
      return "—";
    }
  }, [fullName, rollNumber]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const cleanName = fullName.trim();
    const cleanRoll = rollNumber.trim().toUpperCase();
    const selectedDept = department === "OTHER" ? customDept.trim() : department;

    if (!cleanName || cleanName.length < 2) {
      setError("Please provide a valid full name.");
      return;
    }
    if (!cleanRoll || cleanRoll.length < 3) {
      setError("Please provide a valid roll number.");
      return;
    }
    if (!selectedDept) {
      setError("Please provide a department.");
      return;
    }

    setLoading(true);

    try {
      const res = await fetch("/api/students", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fullName: cleanName,
          rollNumber: cleanRoll,
          category,
          department: selectedDept,
          hostel: hostel || undefined,
          phone: phone.trim() || undefined,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error?.message || "Failed to register student.");
      }

      // Reset form
      setFullName("");
      setRollNumber("");
      setPhone("");
      onRegistered(data.student, data.credentials);
    } catch (err: any) {
      setError(err.message || "An unexpected error occurred.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-surface border border-border rounded-xl max-w-lg w-full p-6 shadow-2xl space-y-5 relative">
        <button
          onClick={onClose}
          disabled={loading}
          className="absolute top-4 right-4 text-ash hover:text-whitesmoke p-1.5 rounded-lg hover:bg-surface-raised transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-accent/15 border border-accent/30 flex items-center justify-center shrink-0">
            <UserPlus className="w-4 h-4 text-accent" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-whitesmoke">Register New Student</h3>
            <p className="text-xs text-ash">
              Server generates unique username & high-entropy initial password
            </p>
          </div>
        </div>

        {error && (
          <div className="p-3 bg-red-500/15 border border-red-500/30 rounded-lg flex items-center gap-2.5 text-xs text-red-300">
            <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-medium text-ash uppercase tracking-wider block mb-1">
                Full Name *
              </label>
              <input
                type="text"
                required
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="e.g. Asha Rao"
                className="w-full bg-bg border border-border rounded-lg px-3 py-2 text-sm text-whitesmoke placeholder-ash/50 focus:outline-none focus:border-accent"
              />
            </div>

            <div>
              <label className="text-xs font-medium text-ash uppercase tracking-wider block mb-1">
                Roll Number *
              </label>
              <input
                type="text"
                required
                value={rollNumber}
                onChange={(e) => setRollNumber(e.target.value)}
                placeholder="e.g. 24CS4821"
                className="w-full bg-bg border border-border rounded-lg px-3 py-2 text-sm text-whitesmoke font-mono placeholder-ash/50 focus:outline-none focus:border-accent"
              />
            </div>
          </div>

          {/* Live Username Preview Pill */}
          <div className="p-3 bg-bg/70 border border-border rounded-lg flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs text-ash">
              <Sparkles className="w-3.5 h-3.5 text-sand" />
              <span>Username Preview:</span>
            </div>
            <span className="font-mono text-xs font-bold text-accent bg-surface px-2.5 py-1 rounded border border-border">
              {previewUsername}
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-medium text-ash uppercase tracking-wider block mb-1">
                Student Category *
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as any)}
                className="w-full bg-bg border border-border rounded-lg px-3 py-2 text-sm text-whitesmoke focus:outline-none focus:border-accent"
              >
                <option value="1st Year">1st Year</option>
                <option value="2nd Year">2nd Year</option>
                <option value="3rd Year">3rd Year</option>
                <option value="4th Year">4th Year</option>
              </select>
            </div>

            <div>
              <label className="text-xs font-medium text-ash uppercase tracking-wider block mb-1">
                Department *
              </label>
              <select
                value={department}
                onChange={(e) => setDepartment(e.target.value)}
                className="w-full bg-bg border border-border rounded-lg px-3 py-2 text-sm text-whitesmoke focus:outline-none focus:border-accent"
              >
                {DEPARTMENTS.map((dept) => (
                  <option key={dept} value={dept}>
                    {dept}
                  </option>
                ))}
                <option value="OTHER">Other...</option>
              </select>
            </div>
          </div>

          {department === "OTHER" && (
            <div>
              <label className="text-xs font-medium text-ash uppercase tracking-wider block mb-1">
                Custom Department Name *
              </label>
              <input
                type="text"
                required
                value={customDept}
                onChange={(e) => setCustomDept(e.target.value)}
                placeholder="Enter department name"
                className="w-full bg-bg border border-border rounded-lg px-3 py-2 text-sm text-whitesmoke focus:outline-none focus:border-accent"
              />
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-medium text-ash uppercase tracking-wider block mb-1">
                Hostel Residence (Optional)
              </label>
              <select
                value={hostel}
                onChange={(e) => setHostel(e.target.value)}
                className="w-full bg-bg border border-border rounded-lg px-3 py-2 text-sm text-whitesmoke focus:outline-none focus:border-accent"
              >
                {HOSTELS.map((h) => (
                  <option key={h} value={h}>
                    {h}
                  </option>
                ))}
                <option value="">Day Scholar / Outside</option>
              </select>
            </div>

            <div>
              <label className="text-xs font-medium text-ash uppercase tracking-wider block mb-1">
                Phone Number (Optional)
              </label>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+91 98765 43210"
                className="w-full bg-bg border border-border rounded-lg px-3 py-2 text-sm text-whitesmoke placeholder-ash/50 focus:outline-none focus:border-accent"
              />
            </div>
          </div>

          <div className="pt-3 border-t border-border flex justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="px-4 py-2 rounded-lg bg-surface-raised hover:bg-border text-sm text-ash hover:text-whitesmoke font-medium transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex items-center gap-2 px-5 py-2 rounded-lg bg-accent text-bg font-semibold text-sm hover:bg-accent-hover transition-colors disabled:opacity-50"
            >
              {loading && <Loader2 className="w-4 h-4 animate-spin" />}
              <span>Register & Generate Code</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
