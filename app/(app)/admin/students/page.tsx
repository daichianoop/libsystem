"use client";

import React, { useState, useEffect, useCallback, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Users,
  Search,
  Filter,
  Download,
  UserPlus,
  RefreshCw,
  Building2,
  Clock,
  ArrowUpDown,
  MoreVertical,
  KeyRound,
  ShieldAlert,
  ShieldCheck,
  ChevronLeft,
  ChevronRight,
  Eye,
  Check,
  AlertCircle,
  HelpCircle,
  Trash2,
  Loader2,
} from "lucide-react";
import { StudentRecord } from "@/lib/server/students";
import { AddStudentModal } from "@/components/students/add-student-modal";
import { CredentialModal } from "@/components/students/credential-modal";
import { StudentDrawer } from "@/components/students/student-drawer";

const CATEGORIES = ["1st Year", "2nd Year", "3rd Year", "4th Year"] as const;

const DEPARTMENTS = [
  "Computer Science & Engineering",
  "Electronics & Communication",
  "Electrical & Electronics",
  "Mechanical Engineering",
  "Information Technology",
  "Civil Engineering",
];

function StudentsContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // URL state
  const qParam = searchParams.get("q") || "";
  const catParam = searchParams.get("category") || "";
  const inLibParam = searchParams.get("in_library") || "";
  const deptParam = searchParams.get("department") || "";
  const activeParam = searchParams.get("active") || "";
  const sortByParam = searchParams.get("sortBy") || "name";
  const sortOrderParam = (searchParams.get("sortOrder") as "asc" | "desc") || "asc";
  const pageParam = parseInt(searchParams.get("page") || "1", 10);

  // Local filter states
  const [q, setQ] = useState(qParam);
  const [selectedCategory, setSelectedCategory] = useState<string>(catParam);
  const [inLibrary, setInLibrary] = useState<string>(inLibParam);
  const [department, setDepartment] = useState<string>(deptParam);
  const [activeFilter, setActiveFilter] = useState<string>(activeParam);
  const [sortBy, setSortBy] = useState<string>(sortByParam);
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">(sortOrderParam);
  const [currentPage, setCurrentPage] = useState<number>(pageParam);

  // Data states
  const [students, setStudents] = useState<StudentRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [counts, setCounts] = useState({ total: 0, inLibrary: 0, outside: 0 });
  const [pagination, setPagination] = useState({
    total: 0,
    page: 1,
    pageSize: 10,
    totalPages: 1,
  });

  // Modals & Drawer state
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [credentialModalData, setCredentialModalData] = useState<{
    isOpen: boolean;
    studentName: string;
    rollNumber: string;
    credentials: { username: string; hashCode: string } | null;
  }>({
    isOpen: false,
    studentName: "",
    rollNumber: "",
    credentials: null,
  });
  const [selectedStudentForDrawer, setSelectedStudentForDrawer] = useState<StudentRecord | null>(
    null
  );
  const [deleteConfirmStudent, setDeleteConfirmStudent] = useState<StudentRecord | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDeleteStudent = async (studentId: string) => {
    setIsDeleting(true);
    try {
      const res = await fetch(`/api/students/${studentId}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error?.message || "Failed to delete student");
      }
      setDeleteConfirmStudent(null);
      setStudents((prev) => prev.filter((s) => s.id !== studentId));
      setCounts((prev) => ({ ...prev, total: Math.max(0, prev.total - 1) }));
      fetchStudents();
    } catch (err: any) {
      alert(err.message || "Failed to delete student");
    } finally {
      setIsDeleting(false);
    }
  };

  // Update URL helper
  const updateUrl = useCallback(
    (newParams: Record<string, string | number | undefined>) => {
      const current = new URLSearchParams(searchParams.toString());
      for (const [key, val] of Object.entries(newParams)) {
        if (val === undefined || val === "" || val === "ALL") {
          current.delete(key);
        } else {
          current.set(key, String(val));
        }
      }
      router.push(`/admin/students?${current.toString()}`);
    },
    [router, searchParams]
  );

  // Fetch students from API
  const fetchStudents = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (q) params.set("q", q);
      if (selectedCategory && selectedCategory !== "ALL") params.set("category", selectedCategory);
      if (inLibrary && inLibrary !== "ALL") params.set("in_library", inLibrary);
      if (department && department !== "ALL") params.set("department", department);
      if (activeFilter && activeFilter !== "ALL") params.set("active", activeFilter);
      params.set("sortBy", sortBy);
      params.set("sortOrder", sortOrder);
      params.set("page", String(currentPage));
      params.set("pageSize", "10");

      const res = await fetch(`/api/students?${params.toString()}`);
      if (!res.ok) throw new Error("Failed to load students");

      const json = await res.json();
      setStudents(json.data || []);
      setPagination(json.pagination || { total: 0, page: 1, pageSize: 10, totalPages: 1 });
      setCounts(json.counts || { total: 0, inLibrary: 0, outside: 0 });
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [q, selectedCategory, inLibrary, department, activeFilter, sortBy, sortOrder, currentPage]);

  useEffect(() => {
    fetchStudents();
  }, [fetchStudents]);

  // Handlers
  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setCurrentPage(1);
    updateUrl({ q, page: 1 });
  };

  const handleCategoryChange = (cat: string) => {
    setSelectedCategory(cat);
    setCurrentPage(1);
    updateUrl({ category: cat, page: 1 });
  };

  const handleInLibraryChange = (status: string) => {
    setInLibrary(status);
    setCurrentPage(1);
    updateUrl({ in_library: status, page: 1 });
  };

  const handleDepartmentChange = (dept: string) => {
    setDepartment(dept);
    setCurrentPage(1);
    updateUrl({ department: dept, page: 1 });
  };

  const handleActiveChange = (act: string) => {
    setActiveFilter(act);
    setCurrentPage(1);
    updateUrl({ active: act, page: 1 });
  };

  const handleSort = (field: string) => {
    const nextOrder = sortBy === field && sortOrder === "asc" ? "desc" : "asc";
    setSortBy(field);
    setSortOrder(nextOrder);
    updateUrl({ sortBy: field, sortOrder: nextOrder });
  };

  const handleClearFilters = () => {
    setQ("");
    setSelectedCategory("");
    setInLibrary("");
    setDepartment("");
    setActiveFilter("");
    setSortBy("name");
    setSortOrder("asc");
    setCurrentPage(1);
    router.push("/admin/students");
  };

  const handleExportCSV = () => {
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (selectedCategory && selectedCategory !== "ALL") params.set("category", selectedCategory);
    if (inLibrary && inLibrary !== "ALL") params.set("in_library", inLibrary);
    if (department && department !== "ALL") params.set("department", department);
    if (activeFilter && activeFilter !== "ALL") params.set("active", activeFilter);

    window.location.href = `/api/export/students?${params.toString()}`;
  };

  const handleStudentRegistered = (
    student: StudentRecord,
    credentials: { username: string; hashCode: string }
  ) => {
    setIsAddModalOpen(false);
    setCredentialModalData({
      isOpen: true,
      studentName: student.fullName,
      rollNumber: student.rollNumber,
      credentials,
    });
    fetchStudents();
  };

  const handleCredentialsReset = (credentials: { username: string; hashCode: string }) => {
    if (selectedStudentForDrawer) {
      setCredentialModalData({
        isOpen: true,
        studentName: selectedStudentForDrawer.fullName,
        rollNumber: selectedStudentForDrawer.rollNumber,
        credentials,
      });
    }
  };

  const handleStatusUpdated = (updated: StudentRecord) => {
    setSelectedStudentForDrawer(updated);
    fetchStudents();
  };

  return (
    <div className="space-y-6">
      {/* Top Banner & KPI Cards */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-whitesmoke tracking-tight">
            Students Directory
          </h1>
          <p className="text-xs text-ash mt-1">
            Registered students, category filters, and live library occupancy status
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={handleExportCSV}
            className="flex items-center gap-2 px-3.5 py-2 rounded-lg bg-surface-raised border border-border text-xs font-semibold text-whitesmoke hover:bg-border transition-colors"
          >
            <Download className="w-4 h-4 text-sand" />
            <span>Export CSV</span>
          </button>

          <button
            onClick={() => setIsAddModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-accent text-bg font-bold text-xs hover:bg-accent-hover transition-colors shadow-lg shadow-accent/10"
          >
            <UserPlus className="w-4 h-4" />
            <span>Add Student</span>
          </button>
        </div>
      </div>

      {/* KPI Stats Row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="bg-surface border border-border p-4 rounded-xl flex items-center justify-between">
          <div>
            <span className="text-xs text-ash uppercase font-medium tracking-wider">
              Total Enrolled Students
            </span>
            <div className="text-2xl font-bold text-whitesmoke mt-0.5">{counts.total}</div>
          </div>
          <div className="w-9 h-9 rounded-lg bg-surface-raised border border-border flex items-center justify-center text-ash">
            <Users className="w-4 h-4" />
          </div>
        </div>

        <div className="bg-surface border border-accent/30 p-4 rounded-xl flex items-center justify-between relative overflow-hidden">
          <div className="absolute top-0 right-0 w-2 h-full bg-accent" />
          <div>
            <span className="text-xs text-accent uppercase font-bold tracking-wider flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-accent animate-ping" />
              Currently In Library
            </span>
            <div className="text-2xl font-bold text-whitesmoke mt-0.5">{counts.inLibrary}</div>
          </div>
          <span className="text-xs px-2.5 py-1 rounded bg-accent/20 border border-accent/40 text-accent font-semibold font-mono">
            Studying Inside
          </span>
        </div>

        <div className="bg-surface border border-border p-4 rounded-xl flex items-center justify-between">
          <div>
            <span className="text-xs text-ash uppercase font-medium tracking-wider">
              Currently Outside
            </span>
            <div className="text-2xl font-bold text-whitesmoke mt-0.5">{counts.outside}</div>
          </div>
          <span className="text-xs px-2.5 py-1 rounded bg-bg border border-border text-ash font-medium font-mono">
            Hostel / Off-Campus
          </span>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="bg-surface border border-border p-4 rounded-xl space-y-3.5">
        <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3">
          {/* Search Bar */}
          <form onSubmit={handleSearchSubmit} className="relative flex-1">
            <Search className="w-4 h-4 text-ash absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search by student name, roll number, or username..."
              className="w-full bg-bg border border-border rounded-lg pl-9 pr-20 py-2 text-xs text-whitesmoke placeholder-ash/60 focus:outline-none focus:border-accent"
            />
            <button
              type="submit"
              className="absolute right-1.5 top-1/2 -translate-y-1/2 px-3 py-1 bg-surface-raised border border-border hover:border-accent/40 text-[11px] font-medium text-whitesmoke rounded transition-colors"
            >
              Search
            </button>
          </form>

          {/* Status and Year Filter Pills */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Library Status Filter */}
            <select
              value={inLibrary}
              onChange={(e) => handleInLibraryChange(e.target.value)}
              className="bg-bg border border-border rounded-lg px-3 py-2 text-xs text-whitesmoke focus:outline-none focus:border-accent"
            >
              <option value="">All Locations (Inside & Outside)</option>
              <option value="1">Inside Library Only</option>
              <option value="0">Outside Library Only</option>
            </select>

            {/* Category Dropdown */}
            <select
              value={selectedCategory}
              onChange={(e) => handleCategoryChange(e.target.value)}
              className="bg-bg border border-border rounded-lg px-3 py-2 text-xs text-whitesmoke focus:outline-none focus:border-accent"
            >
              <option value="">All Cohorts (1st–4th Year)</option>
              {CATEGORIES.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>

            {/* Department Dropdown */}
            <select
              value={department}
              onChange={(e) => handleDepartmentChange(e.target.value)}
              className="bg-bg border border-border rounded-lg px-3 py-2 text-xs text-whitesmoke focus:outline-none focus:border-accent"
            >
              <option value="">All Departments</option>
              {DEPARTMENTS.map((dept) => (
                <option key={dept} value={dept}>
                  {dept}
                </option>
              ))}
            </select>

            {/* Active Status */}
            <select
              value={activeFilter}
              onChange={(e) => handleActiveChange(e.target.value)}
              className="bg-bg border border-border rounded-lg px-3 py-2 text-xs text-whitesmoke focus:outline-none focus:border-accent"
            >
              <option value="">All Accounts</option>
              <option value="true">Active Accounts</option>
              <option value="false">Suspended Accounts</option>
            </select>

            {(q || selectedCategory || inLibrary || department || activeFilter) && (
              <button
                onClick={handleClearFilters}
                className="px-3 py-2 text-xs text-ash hover:text-accent font-medium underline underline-offset-4 transition-colors"
              >
                Reset
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Students Data Table & Mobile List */}
      <div className="bg-surface border border-border rounded-xl overflow-hidden shadow-sm">
        {/* Mobile View: Touch-Friendly Student Cards (< md) */}
        <div className="md:hidden divide-y divide-border">
          {loading ? (
            <div className="py-12 text-center text-ash flex flex-col items-center justify-center gap-2">
              <RefreshCw className="w-5 h-5 animate-spin text-accent" />
              <span>Loading student records...</span>
            </div>
          ) : students.length === 0 ? (
            <div className="py-12 text-center text-ash p-4 space-y-2">
              <Users className="w-8 h-8 text-ash/60 mx-auto" />
              <p className="text-sm font-semibold text-whitesmoke">No students found</p>
              <p className="text-xs text-ash">Try adjusting your filters or register a new student.</p>
            </div>
          ) : (
            students.map((student) => (
              <div key={student.id} className="p-4 space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="font-bold text-sm text-whitesmoke">{student.fullName}</div>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="font-mono text-xs text-sand font-bold">{student.rollNumber}</span>
                      <span className="text-[11px] px-2 py-0.5 rounded-full bg-sand-muted/50 border border-sand/30 text-sand font-semibold">
                        {student.category}
                      </span>
                    </div>
                  </div>
                  <span
                    className={`text-[11px] px-2.5 py-1 rounded-full font-bold inline-flex items-center gap-1.5 ${
                      student.inLibrary === 1
                        ? "bg-accent/20 text-accent border border-accent/40"
                        : "bg-surface-raised text-ash border border-border"
                    }`}
                  >
                    <span className={`w-1.5 h-1.5 rounded-full ${student.inLibrary === 1 ? "bg-accent animate-pulse" : "bg-ash"}`} />
                    {student.inLibrary === 1 ? "In Library" : "Outside"}
                  </span>
                </div>

                <div className="text-xs text-ash flex items-center justify-between">
                  <span className="truncate max-w-[200px]">{student.department}</span>
                  <span>{student.hostel || "Day Scholar"}</span>
                </div>

                <div className="flex items-center gap-2 pt-1 border-t border-border/40">
                  <button
                    onClick={() => setSelectedStudentForDrawer(student)}
                    className="flex-1 py-2 px-3 rounded-lg bg-surface-raised border border-border text-xs font-semibold text-whitesmoke hover:bg-border flex items-center justify-center gap-1.5"
                  >
                    <Eye className="w-3.5 h-3.5 text-sand" />
                    <span>View Timeline</span>
                  </button>
                  <button
                    onClick={() => setDeleteConfirmStudent(student)}
                    className="py-2 px-3 rounded-lg bg-red-500/10 border border-red-500/30 text-xs font-semibold text-red-400 hover:bg-red-500/20 flex items-center justify-center gap-1.5"
                    title="Delete Student"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Delete</span>
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Desktop View: Full Table (md:) */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-surface-raised border-b border-border text-[11px] font-semibold text-ash uppercase tracking-wider">
                <th
                  onClick={() => handleSort("name")}
                  className="py-3 px-4 cursor-pointer hover:text-whitesmoke"
                >
                  <div className="flex items-center gap-1.5">
                    <span>Student / Name</span>
                    <ArrowUpDown className="w-3 h-3 text-sand" />
                  </div>
                </th>
                <th
                  onClick={() => handleSort("roll_number")}
                  className="py-3 px-4 cursor-pointer hover:text-whitesmoke"
                >
                  <div className="flex items-center gap-1.5">
                    <span>Roll Number</span>
                    <ArrowUpDown className="w-3 h-3 text-sand" />
                  </div>
                </th>
                <th className="py-3 px-4">Username</th>
                <th
                  onClick={() => handleSort("category")}
                  className="py-3 px-4 cursor-pointer hover:text-whitesmoke"
                >
                  <div className="flex items-center gap-1.5">
                    <span>Category</span>
                    <ArrowUpDown className="w-3 h-3 text-sand" />
                  </div>
                </th>
                <th
                  onClick={() => handleSort("department")}
                  className="py-3 px-4 cursor-pointer hover:text-whitesmoke"
                >
                  <div className="flex items-center gap-1.5">
                    <span>Department</span>
                    <ArrowUpDown className="w-3 h-3 text-sand" />
                  </div>
                </th>
                <th
                  onClick={() => handleSort("in_library")}
                  className="py-3 px-4 cursor-pointer hover:text-whitesmoke"
                >
                  <div className="flex items-center gap-1.5">
                    <span>Status (0 / 1)</span>
                    <ArrowUpDown className="w-3 h-3 text-sand" />
                  </div>
                </th>
                <th
                  onClick={() => handleSort("last_scan_at")}
                  className="py-3 px-4 cursor-pointer hover:text-whitesmoke"
                >
                  <div className="flex items-center gap-1.5">
                    <span>Last Scan</span>
                    <ArrowUpDown className="w-3 h-3 text-sand" />
                  </div>
                </th>
                <th className="py-3 px-4">Account</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-border text-xs">
              {loading ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-ash">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <RefreshCw className="w-5 h-5 animate-spin text-accent" />
                      <span>Loading students data...</span>
                    </div>
                  </td>
                </tr>
              ) : students.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-ash">
                    <div className="max-w-xs mx-auto space-y-2">
                      <Users className="w-8 h-8 text-ash/60 mx-auto" />
                      <p className="text-sm font-semibold text-whitesmoke">No students found</p>
                      <p className="text-xs text-ash">
                        Try adjusting your filters or register a new student using the button above.
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                students.map((student) => (
                  <tr
                    key={student.id}
                    className="hover:bg-surface-raised/60 transition-colors group"
                  >
                    {/* Name */}
                    <td className="py-3.5 px-4">
                      <div className="font-semibold text-whitesmoke group-hover:text-accent transition-colors">
                        {student.fullName}
                      </div>
                      <div className="text-[11px] text-ash mt-0.5">
                        {student.hostel || "Day Scholar"}
                      </div>
                    </td>

                    {/* Roll Number */}
                    <td className="py-3.5 px-4 font-mono font-medium text-sand">
                      {student.rollNumber}
                    </td>

                    {/* Monospace Username */}
                    <td className="py-3.5 px-4">
                      <span className="font-mono text-[11px] px-2 py-0.5 rounded bg-bg border border-border text-whitesmoke">
                        {student.username}
                      </span>
                    </td>

                    {/* Category Pill */}
                    <td className="py-3.5 px-4">
                      <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-sand-muted/50 border border-sand/30 text-sand">
                        {student.category}
                      </span>
                    </td>

                    {/* Department */}
                    <td className="py-3.5 px-4 text-whitesmoke max-w-[160px] truncate">
                      {student.department}
                    </td>

                    {/* Status Pill: 0 = Outside, 1 = In Library */}
                    <td className="py-3.5 px-4">
                      <div
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold tracking-tight cursor-help"
                        title={
                          student.inLibrary === 1
                            ? "Status 1 = Currently Inside Library"
                            : "Status 0 = Currently Outside Library"
                        }
                      >
                        {student.inLibrary === 1 ? (
                          <span className="flex items-center gap-1.5 text-accent bg-accent/15 border border-accent/40 px-2.5 py-0.5 rounded-full">
                            <span className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse" />
                            1 • In Library
                          </span>
                        ) : (
                          <span className="flex items-center gap-1.5 text-ash bg-bg border border-border px-2.5 py-0.5 rounded-full">
                            <span className="w-1.5 h-1.5 rounded-full bg-ash" />
                            0 • Outside
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Last Scan */}
                    <td className="py-3.5 px-4 text-ash text-[11px]">
                      {student.lastScanAt ? (
                        new Date(student.lastScanAt).toLocaleTimeString("en-IN", {
                          hour: "2-digit",
                          minute: "2-digit",
                          day: "numeric",
                          month: "short",
                        })
                      ) : (
                        <span className="text-ash/60">No scans yet</span>
                      )}
                    </td>

                    {/* Active Toggle / Status */}
                    <td className="py-3.5 px-4">
                      <span
                        className={`inline-flex items-center gap-1 text-[11px] font-medium ${
                          student.isActive ? "text-green-400" : "text-red-400"
                        }`}
                      >
                        {student.isActive ? (
                          <>
                            <ShieldCheck className="w-3.5 h-3.5" /> Active
                          </>
                        ) : (
                          <>
                            <ShieldAlert className="w-3.5 h-3.5" /> Suspended
                          </>
                        )}
                      </span>
                    </td>

                    {/* Actions */}
                    <td className="py-3.5 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => setSelectedStudentForDrawer(student)}
                          className="px-2.5 py-1 rounded-lg bg-surface-raised hover:bg-border text-whitesmoke text-xs font-semibold border border-border transition-colors flex items-center gap-1"
                          title="View student timeline and actions"
                        >
                          <Eye className="w-3.5 h-3.5 text-sand" />
                          <span>View</span>
                        </button>
                        <button
                          onClick={() => setDeleteConfirmStudent(student)}
                          className="p-1.5 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/30 transition-colors"
                          title="Delete student"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Server Pagination Controls */}
        <div className="p-4 border-t border-border flex flex-col sm:flex-row items-center justify-between gap-3 bg-surface-raised">
          <div className="text-xs text-ash">
            Showing{" "}
            <span className="font-semibold text-whitesmoke">
              {students.length > 0 ? (pagination.page - 1) * pagination.pageSize + 1 : 0}
            </span>{" "}
            to{" "}
            <span className="font-semibold text-whitesmoke">
              {Math.min(pagination.page * pagination.pageSize, pagination.total)}
            </span>{" "}
            of <span className="font-semibold text-whitesmoke">{pagination.total}</span> students
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                const prev = Math.max(1, currentPage - 1);
                setCurrentPage(prev);
                updateUrl({ page: prev });
              }}
              disabled={currentPage <= 1 || loading}
              className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-surface border border-border text-xs text-whitesmoke hover:bg-border disabled:opacity-40 transition-colors"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
              <span>Previous</span>
            </button>

            <span className="text-xs font-mono px-3 py-1 bg-bg border border-border rounded text-sand">
              Page {pagination.page} / {pagination.totalPages}
            </span>

            <button
              onClick={() => {
                const next = Math.min(pagination.totalPages, currentPage + 1);
                setCurrentPage(next);
                updateUrl({ page: next });
              }}
              disabled={currentPage >= pagination.totalPages || loading}
              className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-surface border border-border text-xs text-whitesmoke hover:bg-border disabled:opacity-40 transition-colors"
            >
              <span>Next</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Add Student Modal */}
      <AddStudentModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        onRegistered={handleStudentRegistered}
      />

      {/* One-Time Credential Modal */}
      <CredentialModal
        isOpen={credentialModalData.isOpen}
        onClose={() =>
          setCredentialModalData({
            isOpen: false,
            studentName: "",
            rollNumber: "",
            credentials: null,
          })
        }
        studentName={credentialModalData.studentName}
        rollNumber={credentialModalData.rollNumber}
        credentials={credentialModalData.credentials}
      />

      {/* Student Details / Movement History Drawer */}
      <StudentDrawer
        isOpen={Boolean(selectedStudentForDrawer)}
        onClose={() => setSelectedStudentForDrawer(null)}
        student={selectedStudentForDrawer}
        onCredentialsReset={handleCredentialsReset}
        onStatusUpdated={handleStatusUpdated}
        onStudentDeleted={(id) => {
          setStudents((prev) => prev.filter((s) => s.id !== id));
          setCounts((prev) => ({ ...prev, total: Math.max(0, prev.total - 1) }));
          setSelectedStudentForDrawer(null);
          fetchStudents();
        }}
      />

      {/* Delete Confirmation Modal Dialog */}
      {deleteConfirmStudent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xs p-4 animate-in fade-in duration-200">
          <div className="bg-surface border border-border rounded-2xl max-w-sm w-full p-5 space-y-4 shadow-2xl animate-in zoom-in-95">
            <div className="w-10 h-10 rounded-full bg-red-500/10 border border-red-500/30 flex items-center justify-center text-red-400">
              <Trash2 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-whitesmoke">Delete Student Record?</h3>
              <p className="text-xs text-ash mt-1 leading-relaxed">
                Are you sure you want to permanently delete <strong>{deleteConfirmStudent.fullName}</strong> ({deleteConfirmStudent.rollNumber})? This will remove their digital library pass and student profile.
              </p>
            </div>
            <div className="flex gap-2 pt-1">
              <button
                onClick={() => handleDeleteStudent(deleteConfirmStudent.id)}
                disabled={isDeleting}
                className="flex-1 py-2.5 bg-red-500 text-white font-bold text-xs rounded-xl hover:bg-red-600 transition-colors flex items-center justify-center gap-1.5 shadow-md shadow-red-500/20"
              >
                {isDeleting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                <span>Delete Student</span>
              </button>
              <button
                onClick={() => setDeleteConfirmStudent(null)}
                disabled={isDeleting}
                className="px-4 py-2.5 bg-surface-raised border border-border text-xs rounded-xl text-ash hover:text-whitesmoke transition-colors font-semibold"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function AdminStudentsPage() {
  return (
    <Suspense
      fallback={
        <div className="p-12 text-center text-ash text-xs flex items-center justify-center gap-2">
          <RefreshCw className="w-4 h-4 animate-spin text-accent" />
          <span>Loading students portal...</span>
        </div>
      }
    >
      <StudentsContent />
    </Suspense>
  );
}
