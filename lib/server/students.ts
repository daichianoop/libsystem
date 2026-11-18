import crypto from "crypto";
import { generateUsername, generateCollisionResolvedUsername } from "../username";
import { generateHashCode } from "../hashcode";
import { hashPassword, verifyPassword } from "./passwords";
import { logAuditEvent } from "./audit";
import { getAdminSupabase, isSupabaseAvailable, markSupabaseUnreachable } from "./supabase";

export type StudentCategory = "1st Year" | "2nd Year" | "3rd Year" | "4th Year";

export interface StudentRecord {
  id: string;
  profileId: string;
  rollNumber: string;
  fullName: string;
  category: StudentCategory;
  department: string;
  hostel?: string | null;
  phone?: string | null;
  guardianContact?: string | null;
  inLibrary: 0 | 1;
  lastScanAt?: string | null;
  isActive: boolean;
  username: string;
  credentialVersion: number;
  credentialIssuedAt: string;
  createdAt: string;
  updatedAt: string;
}

export interface StudentFilterParams {
  category?: string[];
  inLibrary?: 0 | 1;
  department?: string;
  isActive?: boolean;
  q?: string;
  lastScanFrom?: string;
  lastScanTo?: string;
  sortBy?: "name" | "roll_number" | "category" | "department" | "last_scan_at" | "in_library" | "created_at";
  sortOrder?: "asc" | "desc";
  page?: number;
  pageSize?: number;
}

export interface CreateStudentInput {
  fullName: string;
  rollNumber: string;
  category: StudentCategory;
  department: string;
  hostel?: string;
  phone?: string;
  guardianContact?: string;
}

interface StoredStudentData extends StudentRecord {
  passwordHash: string;
  cardSecret: string;
}

export interface CheckpointRecord {
  id: string;
  name: string;
  type: "LIBRARY_ENTRY" | "LIBRARY_EXIT" | "LIBRARY_BOTH";
  isActive: boolean;
}

export interface MovementEventRecord {
  id: string;
  studentId: string;
  studentName: string;
  rollNumber: string;
  category: StudentCategory;
  eventType: "LIBRARY_ENTRY" | "LIBRARY_EXIT" | "REJECTED_SCAN";
  checkpointId: string;
  checkpointName: string;
  reasonCode: string;
  message: string;
  recordedAt: string;
}

const CHECKPOINTS_STORE: CheckpointRecord[] = [
  { id: "11111111-1111-1111-1111-111111111111", name: "Central Library Main Gate (Both)", type: "LIBRARY_BOTH", isActive: true },
  { id: "22222222-2222-2222-2222-222222222222", name: "North Turnstile Entrance (Entry Only)", type: "LIBRARY_ENTRY", isActive: true },
  { id: "33333333-3333-3333-3333-333333333333", name: "South Turnstile Exit (Exit Only)", type: "LIBRARY_EXIT", isActive: true },
];

const movementEventsLog: MovementEventRecord[] = [];

// ------------------------------------------------------------------------------
// Helper: Map Supabase database row to StudentRecord
// ------------------------------------------------------------------------------
function mapSupabaseRowToStudent(row: any): StudentRecord {
  const profile = Array.isArray(row.profiles) ? row.profiles[0] : row.profiles;
  return {
    id: row.id,
    profileId: row.profile_id,
    rollNumber: row.roll_number,
    fullName: row.full_name,
    category: row.category,
    department: row.department,
    hostel: row.hostel,
    phone: row.phone,
    guardianContact: row.guardian_contact,
    inLibrary: (row.in_library === 1 ? 1 : 0) as 0 | 1,
    lastScanAt: row.last_scan_at,
    isActive: Boolean(row.is_active && (profile ? profile.is_active : true)),
    username: profile?.username || `student_${row.roll_number.toLowerCase()}`,
    credentialVersion: profile?.credential_version || 1,
    credentialIssuedAt: profile?.credential_issued_at || row.created_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// ------------------------------------------------------------------------------
// In-Memory Fallback Cache (resilient when offline or testing)
// ------------------------------------------------------------------------------
const DEMO_NAMES_BY_YEAR: Record<StudentCategory, string[]> = {
  "1st Year": [
    "Aarav Sharma", "Aditi Rao", "Ananya Verma", "Arjun Patel", "Bhavna Mishra",
    "Chirag Reddy", "Deepika Sen", "Divyansh Gupta", "Esha Nair", "Farhan Khan"
  ],
  "2nd Year": [
    "Gaurav Jha", "Ishita Chatterjee", "Kabir Roy", "Kavya Iyer", "Manish Tiwari",
    "Neha Deshmukh", "Nikhil Pillai", "Pooja Hegde", "Pranav Joshi", "Rhea Kapoor"
  ],
  "3rd Year": [
    "Rohan Saxena", "Sakshi Dubey", "Sameer Bhatt", "Sanya Malhotra", "Siddharth Das",
    "Sneha Kulkarni", "Tanvi Agrawal", "Utkarsh Singh", "Varun Chopra", "Vidya Nambiar"
  ],
  "4th Year": [
    "Vikramaditya Bose", "Yashwant Meena", "Zara Merchant", "Abhishek Yadav", "Archana Prasad",
    "Bhavesh Chawla", "Devendra Chauhan", "Gitanjali Swamy", "Harish Natarajan", "Jaspreet Kaur"
  ],
};

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

const studentsMap = new Map<string, StoredStudentData>();

function initializeDemoStudents() {
  if (studentsMap.size > 0) return;

  const years: StudentCategory[] = ["1st Year", "2nd Year", "3rd Year", "4th Year"];
  let yearIdx = 0;

  for (const year of years) {
    const names = DEMO_NAMES_BY_YEAR[year];
    const yearPrefix = (26 - (4 - yearIdx)).toString().padStart(2, "0");

    for (let i = 0; i < names.length; i++) {
      const name = names[i];
      const roll = `${yearPrefix}CS${(1001 + i + yearIdx * 20).toString()}`;
      const dept = DEPARTMENTS[(i + yearIdx) % DEPARTMENTS.length];
      const hostel = HOSTELS[(i + yearIdx) % HOSTELS.length];
      const username = i === 0 && yearIdx === 0 ? "student" : generateUsername(name, roll);
      const studentId = `44444444-0000-0000-0000-${(100000000000 + i + yearIdx * 10).toString().slice(1)}`;
      const profileId = `33333333-0000-0000-0000-${(100000000000 + i + yearIdx * 10).toString().slice(1)}`;
      const inLibrary: 0 | 1 = i % 4 === 0 ? 1 : 0;
      const lastScanDate = new Date(Date.now() - (i * 3600000 + yearIdx * 86400000)).toISOString();

      studentsMap.set(studentId, {
        id: studentId,
        profileId,
        rollNumber: roll,
        fullName: name,
        category: year,
        department: dept,
        hostel,
        phone: `+91 98765 ${10000 + i + yearIdx * 20}`,
        guardianContact: null,
        inLibrary,
        lastScanAt: lastScanDate,
        isActive: true,
        username,
        credentialVersion: 1,
        credentialIssuedAt: new Date(Date.now() - 30 * 86400000).toISOString(),
        createdAt: new Date(Date.now() - 30 * 86400000).toISOString(),
        updatedAt: new Date().toISOString(),
        passwordHash: hashPassword(username === "student" ? "student123" : "pass123456"),
        cardSecret: "a1b2c3d4e5f67890123456789abcdef0",
      });
    }
    yearIdx++;
  }
}

if (!isSupabaseAvailable()) {
  initializeDemoStudents();
}

// ------------------------------------------------------------------------------
// Dynamic Supabase Query: listStudents
// ------------------------------------------------------------------------------
export async function listStudents(params: StudentFilterParams = {}): Promise<{
  students: StudentRecord[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  counts: {
    total: number;
    inLibrary: number;
    outside: number;
  };
}> {
  // 1. Try Supabase Postgres if available
  if (isSupabaseAvailable()) {
    try {
      const supabase = getAdminSupabase();
      let query = supabase.from("students").select("*, profiles(*)", { count: "exact" });

      if (params.category && params.category.length > 0) {
        query = query.in("category", params.category);
      }
      if (params.inLibrary !== undefined) {
        query = query.eq("in_library", params.inLibrary);
      }
      if (params.department && params.department !== "ALL") {
        query = query.ilike("department", params.department);
      }
      if (params.isActive !== undefined) {
        query = query.eq("is_active", params.isActive);
      }
      if (params.q && params.q.trim()) {
        const q = params.q.trim();
        query = query.or(`full_name.ilike.%${q}%,roll_number.ilike.%${q}%`);
      }
      if (params.lastScanFrom) {
        query = query.gte("last_scan_at", params.lastScanFrom);
      }
      if (params.lastScanTo) {
        query = query.lte("last_scan_at", params.lastScanTo);
      }

      const sortBy = params.sortBy === "name" ? "full_name" : params.sortBy || "full_name";
      const ascending = params.sortOrder !== "desc";
      query = query.order(sortBy, { ascending });

      const page = Math.max(1, params.page || 1);
      const pageSize = Math.max(1, Math.min(100, params.pageSize || 10));
      const from = (page - 1) * pageSize;
      const to = from + pageSize - 1;
      query = query.range(from, to);

      const { data, count, error } = await query;

      if (!error && data) {
        const [{ count: totalCount }, { count: inLibCount }] = await Promise.all([
          supabase.from("students").select("*", { count: "exact", head: true }),
          supabase.from("students").select("*", { count: "exact", head: true }).eq("in_library", 1),
        ]);

        const totalStudents = totalCount ?? data.length;
        const insideStudents = inLibCount ?? 0;

        return {
          students: data.map(mapSupabaseRowToStudent),
          total: count ?? data.length,
          page,
          pageSize,
          totalPages: Math.ceil((count ?? data.length) / pageSize) || 1,
          counts: {
            total: totalStudents,
            inLibrary: insideStudents,
            outside: Math.max(0, totalStudents - insideStudents),
          },
        };
      }
    } catch {
      markSupabaseUnreachable();
    }
  }

  // 2. In-Memory Fallback
  return listStudentsFromMemory(params);
}

function listStudentsFromMemory(params: StudentFilterParams = {}) {
  if (!isSupabaseAvailable()) {
  initializeDemoStudents();
}
  const allRecords = Array.from(studentsMap.values());
  const counts = {
    total: allRecords.length,
    inLibrary: allRecords.filter((s) => s.inLibrary === 1).length,
    outside: allRecords.filter((s) => s.inLibrary === 0).length,
  };

  let filtered = allRecords.map((s) => {
    const { passwordHash: _, cardSecret: __, ...safe } = s;
    return safe;
  });

  if (params.category && params.category.length > 0) {
    const cats = new Set(params.category);
    filtered = filtered.filter((s) => cats.has(s.category));
  }
  if (params.inLibrary !== undefined) {
    filtered = filtered.filter((s) => s.inLibrary === params.inLibrary);
  }
  if (params.department && params.department !== "ALL") {
    filtered = filtered.filter((s) => s.department.toLowerCase() === params.department!.toLowerCase());
  }
  if (params.isActive !== undefined) {
    filtered = filtered.filter((s) => s.isActive === params.isActive);
  }
  if (params.q && params.q.trim()) {
    const query = params.q.trim().toLowerCase();
    filtered = filtered.filter(
      (s) =>
        s.fullName.toLowerCase().includes(query) ||
        s.rollNumber.toLowerCase().includes(query) ||
        s.username.toLowerCase().includes(query)
    );
  }
  if (params.lastScanFrom) {
    const from = new Date(params.lastScanFrom).getTime();
    filtered = filtered.filter((s) => s.lastScanAt && new Date(s.lastScanAt).getTime() >= from);
  }
  if (params.lastScanTo) {
    const to = new Date(params.lastScanTo).getTime();
    filtered = filtered.filter((s) => s.lastScanAt && new Date(s.lastScanAt).getTime() <= to);
  }

  const sortBy = params.sortBy || "name";
  const sortOrder = params.sortOrder === "desc" ? -1 : 1;

  filtered.sort((a, b) => {
    let cmp = 0;
    if (sortBy === "name") cmp = a.fullName.localeCompare(b.fullName);
    else if (sortBy === "roll_number") cmp = a.rollNumber.localeCompare(b.rollNumber);
    else if (sortBy === "category") cmp = a.category.localeCompare(b.category);
    else if (sortBy === "department") cmp = a.department.localeCompare(b.department);
    else if (sortBy === "in_library") cmp = a.inLibrary - b.inLibrary;
    else if (sortBy === "last_scan_at") {
      const aTime = a.lastScanAt ? new Date(a.lastScanAt).getTime() : 0;
      const bTime = b.lastScanAt ? new Date(b.lastScanAt).getTime() : 0;
      cmp = aTime - bTime;
    } else if (sortBy === "created_at") {
      cmp = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
    }
    return cmp * sortOrder;
  });

  const page = Math.max(1, params.page || 1);
  const pageSize = Math.max(1, Math.min(100, params.pageSize || 10));
  const total = filtered.length;
  const totalPages = Math.ceil(total / pageSize) || 1;
  const paginated = filtered.slice((page - 1) * pageSize, page * pageSize);

  return {
    students: paginated,
    total,
    page,
    pageSize,
    totalPages,
    counts,
  };
}

// ------------------------------------------------------------------------------
// Dynamic Supabase Mutation: createStudent
// ------------------------------------------------------------------------------
export async function createStudent(
  input: CreateStudentInput,
  actorProfileId: string,
  clientIp?: string
): Promise<{
  student: StudentRecord;
  credentials: { username: string; hashCode: string };
}> {
  if (!isSupabaseAvailable()) {
  initializeDemoStudents();
}

  // Check duplicate roll in memory
  for (const s of studentsMap.values()) {
    if (s.rollNumber.trim().toUpperCase() === input.rollNumber.trim().toUpperCase()) {
      throw new Error(`Roll number ${input.rollNumber} is already registered.`);
    }
  }

  let username = generateUsername(input.fullName, input.rollNumber);
  const existingUsernames = new Set(Array.from(studentsMap.values()).map((s) => s.username));
  while (existingUsernames.has(username)) {
    username = generateCollisionResolvedUsername(username);
  }

  const existingBatchCodes = Array.from(studentsMap.values()).map((s) => s.username);
  const hashCode = generateHashCode(existingBatchCodes);
  const passwordHash = hashPassword(hashCode);
  const cardSecret = crypto.randomBytes(32).toString("hex");
  const now = new Date().toISOString();

  // Attempt Supabase insert if available
  if (isSupabaseAvailable()) {
    try {
      const supabase = getAdminSupabase();
      const { data: profile, error: pErr } = await supabase
        .from("profiles")
        .insert({
          clerk_user_id: `user-${username}`,
          username,
          password_hash: passwordHash,
          role: "student",
          full_name: input.fullName.trim(),
          is_active: true,
          must_change_password: true,
          credential_version: 1,
        })
        .select()
        .single();

      if (!pErr && profile) {
        const { data: std, error: sErr } = await supabase
          .from("students")
          .insert({
            profile_id: profile.id,
            roll_number: input.rollNumber.trim().toUpperCase(),
            full_name: input.fullName.trim(),
            category: input.category,
            department: input.department.trim(),
            hostel: input.hostel?.trim() || null,
            phone: input.phone?.trim() || null,
            guardian_contact: input.guardianContact?.trim() || null,
            in_library: 0,
            card_secret: cardSecret,
          })
          .select()
          .single();

        if (!sErr && std) {
          await logAuditEvent({
            actorProfileId,
            action: "STUDENT_REGISTERED",
            entityType: "student",
            entityId: std.id,
            metadata: {
              username,
              rollNumber: std.roll_number,
              category: std.category,
              department: std.department,
            },
            ip: clientIp,
          });

          const safeStudent = mapSupabaseRowToStudent({ ...std, profiles: profile });
          studentsMap.set(safeStudent.id, { ...safeStudent, passwordHash, cardSecret });

          return {
            student: safeStudent,
            credentials: { username, hashCode },
          };
        }
      }
    } catch {
      markSupabaseUnreachable();
    }
  }

  // In-Memory Fallback
  const studentId = `std_${Date.now()}_${crypto.randomBytes(4).toString("hex")}`;
  const profileId = `prof_${Date.now()}_${crypto.randomBytes(4).toString("hex")}`;

  const studentData: StoredStudentData = {
    id: studentId,
    profileId,
    rollNumber: input.rollNumber.trim().toUpperCase(),
    fullName: input.fullName.trim(),
    category: input.category,
    department: input.department.trim(),
    hostel: input.hostel?.trim() || null,
    phone: input.phone?.trim() || null,
    guardianContact: input.guardianContact?.trim() || null,
    inLibrary: 0,
    lastScanAt: null,
    isActive: true,
    username,
    credentialVersion: 1,
    credentialIssuedAt: now,
    createdAt: now,
    updatedAt: now,
    passwordHash,
    cardSecret,
  };

  studentsMap.set(studentId, studentData);

  await logAuditEvent({
    actorProfileId,
    action: "STUDENT_REGISTERED",
    entityType: "student",
    entityId: studentId,
    metadata: {
      username,
      rollNumber: studentData.rollNumber,
      category: studentData.category,
      department: studentData.department,
    },
    ip: clientIp,
  });

  const { passwordHash: _, cardSecret: __, ...safeStudent } = studentData;

  return {
    student: safeStudent,
    credentials: { username, hashCode },
  };
}

// ------------------------------------------------------------------------------
// Dynamic Supabase Queries & Actions
// ------------------------------------------------------------------------------
export async function getStudentById(studentId: string): Promise<StudentRecord | null> {
  if (isSupabaseAvailable()) {
    try {
      const supabase = getAdminSupabase();
      const { data: std, error } = await supabase
        .from("students")
        .select("*, profiles(*)")
        .eq("id", studentId)
        .maybeSingle();

      if (!error) {
        return std ? mapSupabaseRowToStudent(std) : null;
      }
    } catch {
      markSupabaseUnreachable();
    }
  }

  if (!isSupabaseAvailable()) {
  initializeDemoStudents();
}
  const s = studentsMap.get(studentId);
  if (!s) return null;
  const { passwordHash: _, cardSecret: __, ...safeStudent } = s;
  return safeStudent;
}

export async function getStudentByRoll(rollNumber: string): Promise<StudentRecord | null> {
  const cleanRoll = rollNumber.trim().toUpperCase();
  if (isSupabaseAvailable()) {
    try {
      const supabase = getAdminSupabase();
      const { data: std, error } = await supabase
        .from("students")
        .select("*, profiles(*)")
        .ilike("roll_number", cleanRoll)
        .maybeSingle();

      if (!error) {
        return std ? mapSupabaseRowToStudent(std) : null;
      }
    } catch {
      markSupabaseUnreachable();
    }
  }

  if (!isSupabaseAvailable()) {
  initializeDemoStudents();
}
  for (const s of studentsMap.values()) {
    if (s.rollNumber.toUpperCase() === cleanRoll) {
      const { passwordHash: _, cardSecret: __, ...safe } = s;
      return safe;
    }
  }
  return null;
}

export async function getStudentCardSecret(studentId: string): Promise<string | null> {
  if (isSupabaseAvailable()) {
    try {
      const supabase = getAdminSupabase();
      const { data: std, error } = await supabase
        .from("students")
        .select("card_secret")
        .eq("id", studentId)
        .maybeSingle();

      if (!error) {
        return std?.card_secret || null;
      }
    } catch {
      markSupabaseUnreachable();
    }
  }

  if (!isSupabaseAvailable()) {
  initializeDemoStudents();
}
  const s = studentsMap.get(studentId);
  return s ? s.cardSecret : null;
}

export async function authenticateStudent(
  username: string,
  password: string
): Promise<StudentRecord | null> {
  const cleanUser = username.trim().toLowerCase();

  if (isSupabaseAvailable()) {
    try {
      const supabase = getAdminSupabase();
      const { data: profile, error } = await supabase
        .from("profiles")
        .select("*, students(*)")
        .eq("username", cleanUser)
        .maybeSingle();

      if (!error) {
        if (profile && profile.is_active && profile.password_hash) {
          const isValid = verifyPassword(password, profile.password_hash);
          if (isValid) {
            const std = Array.isArray(profile.students) ? profile.students[0] : profile.students;
            if (std) {
              return mapSupabaseRowToStudent({ ...std, profiles: profile });
            }
          }
        }
        return null;
      }
    } catch {
      markSupabaseUnreachable();
    }
  }

  if (!isSupabaseAvailable()) {
  initializeDemoStudents();
}
  for (const s of studentsMap.values()) {
    if (s.username.toLowerCase() === cleanUser) {
      if (!s.isActive) return null;
      if (verifyPassword(password, s.passwordHash)) {
        const { passwordHash: _, cardSecret: __, ...safeStudent } = s;
        return safeStudent;
      }
    }
  }
  return null;
}

export async function resetStudentCredentials(
  studentId: string,
  actorProfileId: string,
  clientIp?: string
): Promise<{ username: string; hashCode: string }> {
  const hashCode = generateHashCode();
  const passwordHash = hashPassword(hashCode);
  const now = new Date().toISOString();

  if (isSupabaseAvailable()) {
    try {
      const supabase = getAdminSupabase();
      const { data: std, error: findErr } = await supabase
        .from("students")
        .select("*, profiles(*)")
        .eq("id", studentId)
        .maybeSingle();

      if (!findErr && std && std.profile_id) {
        const profile = Array.isArray(std.profiles) ? std.profiles[0] : std.profiles;
        const targetUsername = profile.username;
        const newVersion = (profile.credential_version || 1) + 1;

        await supabase
          .from("profiles")
          .update({
            password_hash: passwordHash,
            credential_version: newVersion,
            credential_issued_at: now,
            updated_at: now,
          })
          .eq("id", std.profile_id);

        await logAuditEvent({
          actorProfileId,
          action: "CREDENTIALS_RESET",
          entityType: "student",
          entityId: studentId,
          metadata: { username: targetUsername, rollNumber: std.roll_number, credentialVersion: newVersion },
          ip: clientIp,
        });

        return { username: targetUsername, hashCode };
      }
    } catch {
      markSupabaseUnreachable();
    }
  }

  if (!isSupabaseAvailable()) {
  initializeDemoStudents();
}
  const student = studentsMap.get(studentId);
  if (!student) throw new Error(`Student with ID ${studentId} not found.`);

  student.passwordHash = passwordHash;
  student.credentialVersion += 1;
  student.credentialIssuedAt = now;
  student.updatedAt = now;
  studentsMap.set(studentId, student);

  await logAuditEvent({
    actorProfileId,
    action: "CREDENTIALS_RESET",
    entityType: "student",
    entityId: studentId,
    metadata: {
      username: student.username,
      rollNumber: student.rollNumber,
      credentialVersion: student.credentialVersion,
    },
    ip: clientIp,
  });

  return { username: student.username, hashCode };
}

export async function toggleStudentActive(
  studentId: string,
  isActive: boolean,
  actorProfileId: string,
  clientIp?: string
): Promise<StudentRecord> {
  const now = new Date().toISOString();

  if (isSupabaseAvailable()) {
    try {
      const supabase = getAdminSupabase();
      const { data: std, error: stdErr } = await supabase
        .from("students")
        .update({ is_active: isActive, updated_at: now })
        .eq("id", studentId)
        .select("*, profiles(*)")
        .maybeSingle();

      if (!stdErr && std) {
        if (std.profile_id) {
          await supabase.from("profiles").update({ is_active: isActive, updated_at: now }).eq("id", std.profile_id);
        }
        await logAuditEvent({
          actorProfileId,
          action: isActive ? "STUDENT_ACTIVATED" : "STUDENT_DEACTIVATED",
          entityType: "student",
          entityId: studentId,
          metadata: { rollNumber: std.roll_number, isActive },
          ip: clientIp,
        });

        return mapSupabaseRowToStudent(std);
      }
    } catch {
      markSupabaseUnreachable();
    }
  }

  if (!isSupabaseAvailable()) {
  initializeDemoStudents();
}
  const student = studentsMap.get(studentId);
  if (!student) throw new Error(`Student with ID ${studentId} not found.`);
  student.isActive = isActive;
  student.updatedAt = now;
  studentsMap.set(studentId, student);

  await logAuditEvent({
    actorProfileId,
    action: isActive ? "STUDENT_ACTIVATED" : "STUDENT_DEACTIVATED",
    entityType: "student",
    entityId: studentId,
    metadata: { username: student.username, rollNumber: student.rollNumber, isActive },
    ip: clientIp,
  });

  const { passwordHash: _, cardSecret: __, ...safeStudent } = student;
  return safeStudent;
}

export async function updateStudent(
  studentId: string,
  updates: Partial<{
    category: StudentCategory;
    department: string;
    hostel: string;
    phone: string;
  }>,
  actorProfileId: string,
  clientIp?: string
): Promise<StudentRecord> {
  const now = new Date().toISOString();

  if (isSupabaseAvailable()) {
    try {
      const supabase = getAdminSupabase();
      const dbUpdates: Record<string, any> = { updated_at: now };
      if (updates.category !== undefined) dbUpdates.category = updates.category;
      if (updates.department !== undefined) dbUpdates.department = updates.department;
      if (updates.hostel !== undefined) dbUpdates.hostel = updates.hostel;
      if (updates.phone !== undefined) dbUpdates.phone = updates.phone;

      const { data: std, error } = await supabase
        .from("students")
        .update(dbUpdates)
        .eq("id", studentId)
        .select("*, profiles(*)")
        .maybeSingle();

      if (!error && std) {
        await logAuditEvent({
          actorProfileId,
          action: "STUDENT_UPDATED",
          entityType: "student",
          entityId: studentId,
          metadata: updates,
          ip: clientIp,
        });
        return mapSupabaseRowToStudent(std);
      }
    } catch {
      markSupabaseUnreachable();
    }
  }

  const s = studentsMap.get(studentId);
  if (!s) throw new Error(`Student ${studentId} not found`);

  if (updates.category !== undefined) s.category = updates.category;
  if (updates.department !== undefined) s.department = updates.department;
  if (updates.hostel !== undefined) s.hostel = updates.hostel;
  if (updates.phone !== undefined) s.phone = updates.phone;
  s.updatedAt = now;
  studentsMap.set(studentId, s);

  await logAuditEvent({
    actorProfileId,
    action: "STUDENT_UPDATED",
    entityType: "student",
    entityId: studentId,
    metadata: updates,
    ip: clientIp,
  });

  const { passwordHash: _, cardSecret: __, ...safe } = s;
  return safe;
}

export async function updateStudentScanStatus(
  studentId: string,
  inLibrary: 0 | 1
): Promise<StudentRecord> {
  const now = new Date().toISOString();

  if (isSupabaseAvailable()) {
    try {
      const supabase = getAdminSupabase();
      const { data: std, error } = await supabase
        .from("students")
        .update({ in_library: inLibrary, last_scan_at: now, updated_at: now })
        .eq("id", studentId)
        .select("*, profiles(*)")
        .maybeSingle();

      if (!error && std) {
        return mapSupabaseRowToStudent(std);
      }
    } catch {
      markSupabaseUnreachable();
    }
  }

  if (!isSupabaseAvailable()) {
  initializeDemoStudents();
}
  const s = studentsMap.get(studentId);
  if (s) {
    s.inLibrary = inLibrary;
    s.lastScanAt = now;
    s.updatedAt = now;
    studentsMap.set(studentId, s);
    const { passwordHash: _, cardSecret: __, ...safe } = s;
    return safe;
  }
  throw new Error(`Student ${studentId} not found`);
}

export async function getCheckpoints(): Promise<CheckpointRecord[]> {
  if (isSupabaseAvailable()) {
    try {
      const supabase = getAdminSupabase();
      const { data, error } = await supabase.from("checkpoints").select("*").eq("is_active", true);
      if (!error && data) {
        return data.map((cp) => ({
          id: cp.id,
          name: cp.name,
          type: cp.type,
          isActive: cp.is_active,
        }));
      }
    } catch {
      markSupabaseUnreachable();
    }
  }
  return [...CHECKPOINTS_STORE];
}

export async function recordMovementEvent(params: {
  studentId: string;
  studentName: string;
  rollNumber: string;
  category: StudentCategory;
  eventType: "LIBRARY_ENTRY" | "LIBRARY_EXIT" | "REJECTED_SCAN";
  checkpointId: string;
  checkpointName: string;
  reasonCode: string;
  message: string;
}): Promise<MovementEventRecord> {
  const now = new Date().toISOString();
  const event: MovementEventRecord = {
    id: `ev_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    ...params,
    recordedAt: now,
  };

  if (isSupabaseAvailable()) {
    try {
      const supabase = getAdminSupabase();
      const validCheckpointId = params.checkpointId.includes("-")
        ? params.checkpointId
        : "11111111-1111-1111-1111-111111111111";

      await supabase.from("movement_events").insert({
        student_id: params.studentId,
        checkpoint_id: validCheckpointId,
        event_type: params.eventType,
        recorded_at: now,
        reason_code: params.reasonCode,
        notes: params.message,
      });
    } catch {
      markSupabaseUnreachable();
    }
  }

  movementEventsLog.unshift(event);
  if (movementEventsLog.length > 200) movementEventsLog.pop();
  return event;
}

export async function getRecentMovementEvents(params?: {
  studentId?: string;
  limit?: number;
}): Promise<MovementEventRecord[]> {
  if (isSupabaseAvailable()) {
    try {
      const supabase = getAdminSupabase();
      let q = supabase
        .from("movement_events")
        .select("*, students(*)")
        .order("recorded_at", { ascending: false })
        .limit(params?.limit || 20);

      if (params?.studentId) {
        q = q.eq("student_id", params.studentId);
      }

      const { data, error } = await q;
      if (!error && data) {
        return data.map((ev: any) => ({
          id: ev.id,
          studentId: ev.student_id,
          studentName: ev.students?.full_name || "Unknown Student",
          rollNumber: ev.students?.roll_number || "N/A",
          category: ev.students?.category || "1st Year",
          eventType: ev.event_type,
          checkpointId: ev.checkpoint_id,
          checkpointName:
            ev.checkpoint_id === "22222222-2222-2222-2222-222222222222"
              ? "North Turnstile (Entry Only)"
              : ev.checkpoint_id === "33333333-3333-3333-3333-333333333333"
              ? "South Turnstile (Exit Only)"
              : "Central Library Main Gate (Both)",
          reasonCode: ev.reason_code,
          message: ev.notes || (ev.event_type === "LIBRARY_ENTRY" ? "Library Entry Verified" : "Library Exit Verified"),
          recordedAt: ev.recorded_at,
        }));
      }
    } catch {
      markSupabaseUnreachable();
    }
  }

  let list = [...movementEventsLog];
  if (params?.studentId) {
    list = list.filter((e) => e.studentId === params.studentId);
  }
  return list.slice(0, params?.limit || 20);
}

export async function getOccupancyStats() {
  if (isSupabaseAvailable()) {
    try {
      const supabase = getAdminSupabase();
      const [
        { count: totalCount, error: totalError },
        { count: inLibCount },
        { data: inLibStudents },
        { data: recentEvents },
      ] = await Promise.all([
        supabase.from("students").select("*", { count: "exact", head: true }),
        supabase.from("students").select("*", { count: "exact", head: true }).eq("in_library", 1),
        supabase.from("students").select("category").eq("in_library", 1),
        supabase.from("movement_events").select("*, students(*)").order("recorded_at", { ascending: false }).limit(15),
      ]);

      if (!totalError && totalCount !== null && totalCount !== undefined) {
        const categoryBreakdown: Record<StudentCategory, number> = {
          "1st Year": inLibStudents?.filter((s) => s.category === "1st Year").length || 0,
          "2nd Year": inLibStudents?.filter((s) => s.category === "2nd Year").length || 0,
          "3rd Year": inLibStudents?.filter((s) => s.category === "3rd Year").length || 0,
          "4th Year": inLibStudents?.filter((s) => s.category === "4th Year").length || 0,
        };

        const mappedEvents: MovementEventRecord[] = (recentEvents || []).map((ev: any) => ({
          id: ev.id,
          studentId: ev.student_id,
          studentName: ev.students?.full_name || "Unknown Student",
          rollNumber: ev.students?.roll_number || "N/A",
          category: ev.students?.category || "1st Year",
          eventType: ev.event_type,
          checkpointId: ev.checkpoint_id,
          checkpointName:
            ev.checkpoint_id === "22222222-2222-2222-2222-222222222222"
              ? "North Turnstile (Entry Only)"
              : ev.checkpoint_id === "33333333-3333-3333-3333-333333333333"
              ? "South Turnstile (Exit Only)"
              : "Central Library Main Gate (Both)",
          reasonCode: ev.reason_code,
          message: ev.notes || (ev.event_type === "LIBRARY_ENTRY" ? "Library Entry Verified" : "Library Exit Verified"),
          recordedAt: ev.recorded_at,
        }));

        const total = totalCount || 0;
        const inside = inLibCount || 0;

        return {
          totalStudents: total,
          inLibraryCount: inside,
          outsideCount: Math.max(0, total - inside),
          categoryBreakdown,
          recentEvents: mappedEvents,
        };
      }
    } catch {
      markSupabaseUnreachable();
    }
  }

  if (!isSupabaseAvailable()) {
  initializeDemoStudents();
}
  const all = Array.from(studentsMap.values());
  const inLib = all.filter((s) => s.inLibrary === 1);

  const categoryBreakdown: Record<StudentCategory, number> = {
    "1st Year": inLib.filter((s) => s.category === "1st Year").length,
    "2nd Year": inLib.filter((s) => s.category === "2nd Year").length,
    "3rd Year": inLib.filter((s) => s.category === "3rd Year").length,
    "4th Year": inLib.filter((s) => s.category === "4th Year").length,
  };

  return {
    totalStudents: all.length,
    inLibraryCount: inLib.length,
    outsideCount: all.length - inLib.length,
    categoryBreakdown,
    recentEvents: movementEventsLog.slice(0, 15),
  };
}

export async function exportStudentsCSV(params: StudentFilterParams = {}): Promise<string> {
  const result = await listStudents({ ...params, page: 1, pageSize: 10000 });
  const headers = [
    "Roll Number",
    "Full Name",
    "Username",
    "Category",
    "Department",
    "Hostel",
    "In Library Status",
    "Active Status",
    "Last Scan At",
    "Created At",
  ];

  const escapeCSV = (val: string | number | null | undefined) => {
    if (val === null || val === undefined) return '""';
    const str = String(val).replace(/"/g, '""');
    return `"${str}"`;
  };

  const rows = result.students.map((s) => [
    escapeCSV(s.rollNumber),
    escapeCSV(s.fullName),
    escapeCSV(s.username),
    escapeCSV(s.category),
    escapeCSV(s.department),
    escapeCSV(s.hostel || "N/A"),
    escapeCSV(s.inLibrary === 1 ? "1 (In Library)" : "0 (Outside)"),
    escapeCSV(s.isActive ? "Active" : "Inactive"),
    escapeCSV(s.lastScanAt || "Never"),
    escapeCSV(s.createdAt),
  ]);

  return [headers.join(","), ...rows.map((r) => r.join(","))].join("\r\n");
}
