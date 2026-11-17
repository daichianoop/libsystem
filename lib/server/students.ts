import crypto from "crypto";
import { generateUsername, generateCollisionResolvedUsername } from "../username";
import { generateHashCode } from "../hashcode";
import { hashPassword, verifyPassword } from "./passwords";
import { logAuditEvent } from "./audit";
import { getAdminSupabase } from "./supabase";

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

// ------------------------------------------------------------------------------
// 40 REALISTIC DEMO STUDENTS ACROSS Y1 - Y4
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

// In-memory student store
const studentsMap = new Map<string, StoredStudentData>();

// Initialize 40 demo students
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
      const studentId = `std_${yearIdx}_${i}_${roll.toLowerCase()}`;
      const profileId = `prof_${yearIdx}_${i}_${username}`;

      // In library: 10 students inside (i % 4 === 0), others outside
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
        cardSecret: crypto.randomBytes(32).toString("hex"),
      });
    }
    yearIdx++;
  }
}

// Ensure demo data is ready
initializeDemoStudents();

/**
 * Creates a student record with server-generated username & random high-entropy hashcode.
 * Password hash is stored; plaintext hashcode is returned ONLY ONCE in the result.
 */
export async function createStudent(
  input: CreateStudentInput,
  actorProfileId: string,
  clientIp?: string
): Promise<{
  student: StudentRecord;
  credentials: { username: string; hashCode: string };
}> {
  initializeDemoStudents();

  // 1. Check duplicate roll number
  for (const s of studentsMap.values()) {
    if (s.rollNumber.trim().toUpperCase() === input.rollNumber.trim().toUpperCase()) {
      throw new Error(`Roll number ${input.rollNumber} is already registered.`);
    }
  }

  // 2. Generate unique username
  let username = generateUsername(input.fullName, input.rollNumber);
  const existingUsernames = new Set(Array.from(studentsMap.values()).map((s) => s.username));
  while (existingUsernames.has(username)) {
    username = generateCollisionResolvedUsername(username);
  }

  // 3. Generate high-entropy CSPRNG hash code (initial password)
  const existingBatchCodes = Array.from(studentsMap.values()).map((s) => s.username);
  const hashCode = generateHashCode(existingBatchCodes);

  // 4. Compute password hash (never store plaintext)
  const passwordHash = hashPassword(hashCode);
  const studentId = `std_${Date.now()}_${crypto.randomBytes(4).toString("hex")}`;
  const profileId = `prof_${Date.now()}_${crypto.randomBytes(4).toString("hex")}`;
  const now = new Date().toISOString();

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
    cardSecret: crypto.randomBytes(32).toString("hex"),
  };

  // 5. Save to store
  studentsMap.set(studentId, studentData);

  // 6. Log audit event (Plaintext hashCode is NOT included!)
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

  // Attempt Supabase insert if available
  try {
    const supabase = getAdminSupabase();
    const { data: profile } = await supabase
      .from("profiles")
      .insert({
        id: profileId,
        clerk_user_id: `local_student_${username}`,
        username,
        role: "student",
        full_name: studentData.fullName,
        is_active: true,
        must_change_password: true,
        credential_version: 1,
      })
      .select()
      .single();

    if (profile) {
      await supabase.from("students").insert({
        id: studentId,
        profile_id: profile.id,
        roll_number: studentData.rollNumber,
        full_name: studentData.fullName,
        category: studentData.category,
        department: studentData.department,
        hostel: studentData.hostel,
        phone: studentData.phone,
        in_library: 0,
        card_secret: studentData.cardSecret,
      });
    }
  } catch {
    // If Supabase is offline, the in-memory store keeps working seamlessly
  }

  // 7. Strip sensitive credentials from student object
  const { passwordHash: _, cardSecret: __, ...safeStudent } = studentData;

  // Return the credentials ONLY ONCE
  return {
    student: safeStudent,
    credentials: {
      username,
      hashCode,
    },
  };
}

/**
 * Resets student credentials: generates a new CSPRNG hashcode, updates hash,
 * invalidates old password, and returns new code once.
 */
export async function resetStudentCredentials(
  studentId: string,
  actorProfileId: string,
  clientIp?: string
): Promise<{ username: string; hashCode: string }> {
  initializeDemoStudents();

  const student = studentsMap.get(studentId);
  if (!student) {
    throw new Error(`Student with ID ${studentId} not found.`);
  }

  const hashCode = generateHashCode();
  const passwordHash = hashPassword(hashCode);
  const now = new Date().toISOString();

  student.passwordHash = passwordHash;
  student.credentialVersion += 1;
  student.credentialIssuedAt = now;
  student.updatedAt = now;

  studentsMap.set(studentId, student);

  // Log audit event
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

  return {
    username: student.username,
    hashCode,
  };
}

/**
 * Toggles or updates the active status of a student.
 */
export async function toggleStudentActive(
  studentId: string,
  isActive: boolean,
  actorProfileId: string,
  clientIp?: string
): Promise<StudentRecord> {
  initializeDemoStudents();

  const student = studentsMap.get(studentId);
  if (!student) {
    throw new Error(`Student with ID ${studentId} not found.`);
  }

  student.isActive = isActive;
  student.updatedAt = new Date().toISOString();
  studentsMap.set(studentId, student);

  await logAuditEvent({
    actorProfileId,
    action: isActive ? "STUDENT_ACTIVATED" : "STUDENT_DEACTIVATED",
    entityType: "student",
    entityId: studentId,
    metadata: {
      username: student.username,
      rollNumber: student.rollNumber,
      isActive,
    },
    ip: clientIp,
  });

  const { passwordHash: _, cardSecret: __, ...safeStudent } = student;
  return safeStudent;
}

/**
 * Updates non-identity fields of a student.
 */
export async function updateStudent(
  studentId: string,
  updates: Partial<Pick<StudentRecord, "department" | "hostel" | "phone" | "category">>,
  actorProfileId: string,
  clientIp?: string
): Promise<StudentRecord> {
  initializeDemoStudents();

  const student = studentsMap.get(studentId);
  if (!student) {
    throw new Error(`Student with ID ${studentId} not found.`);
  }

  if (updates.department) student.department = updates.department.trim();
  if (updates.hostel !== undefined) student.hostel = updates.hostel ? updates.hostel.trim() : null;
  if (updates.phone !== undefined) student.phone = updates.phone ? updates.phone.trim() : null;
  if (updates.category) student.category = updates.category;
  student.updatedAt = new Date().toISOString();

  studentsMap.set(studentId, student);

  await logAuditEvent({
    actorProfileId,
    action: "STUDENT_UPDATED",
    entityType: "student",
    entityId: studentId,
    metadata: updates,
    ip: clientIp,
  });

  const { passwordHash: _, cardSecret: __, ...safeStudent } = student;
  return safeStudent;
}

/**
 * Retrieves a single student record by ID (sanitized, no password hash).
 */
export async function getStudentById(studentId: string): Promise<StudentRecord | null> {
  initializeDemoStudents();
  const student = studentsMap.get(studentId);
  if (!student) return null;
  const { passwordHash: _, cardSecret: __, ...safeStudent } = student;
  return safeStudent;
}

/**
 * Retrieves a student by username.
 */
export async function getStudentByUsername(username: string): Promise<StudentRecord | null> {
  initializeDemoStudents();
  for (const s of studentsMap.values()) {
    if (s.username.toLowerCase() === username.toLowerCase()) {
      const { passwordHash: _, cardSecret: __, ...safeStudent } = s;
      return safeStudent;
    }
  }
  return null;
}

/**
 * Validates login credentials for a student against password hash.
 */
export async function authenticateStudent(
  username: string,
  password: string
): Promise<StudentRecord | null> {
  initializeDemoStudents();
  const cleanUser = username.trim().toLowerCase();
  for (const s of studentsMap.values()) {
    if (s.username.toLowerCase() === cleanUser) {
      if (!s.isActive) return null;
      const isValid = verifyPassword(password, s.passwordHash);
      if (isValid) {
        const { passwordHash: _, cardSecret: __, ...safeStudent } = s;
        return safeStudent;
      }
    }
  }
  return null;
}

/**
 * Lists students matching combinable filters with pagination and counts.
 */
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
  initializeDemoStudents();

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

  // 1. Filter by category (multi-select)
  if (params.category && params.category.length > 0) {
    const cats = new Set(params.category);
    filtered = filtered.filter((s) => cats.has(s.category));
  }

  // 2. Filter by in_library (0 or 1)
  if (params.inLibrary !== undefined) {
    filtered = filtered.filter((s) => s.inLibrary === params.inLibrary);
  }

  // 3. Filter by department
  if (params.department && params.department !== "ALL") {
    filtered = filtered.filter(
      (s) => s.department.toLowerCase() === params.department!.toLowerCase()
    );
  }

  // 4. Filter by active status
  if (params.isActive !== undefined) {
    filtered = filtered.filter((s) => s.isActive === params.isActive);
  }

  // 5. Search query (fuzzy across name, rollNumber, username)
  if (params.q && params.q.trim()) {
    const query = params.q.trim().toLowerCase();
    filtered = filtered.filter(
      (s) =>
        s.fullName.toLowerCase().includes(query) ||
        s.rollNumber.toLowerCase().includes(query) ||
        s.username.toLowerCase().includes(query)
    );
  }

  // 6. Last scan date range
  if (params.lastScanFrom) {
    const from = new Date(params.lastScanFrom).getTime();
    filtered = filtered.filter((s) => s.lastScanAt && new Date(s.lastScanAt).getTime() >= from);
  }
  if (params.lastScanTo) {
    const to = new Date(params.lastScanTo).getTime();
    filtered = filtered.filter((s) => s.lastScanAt && new Date(s.lastScanAt).getTime() <= to);
  }

  // 7. Sorting
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

  // 8. Pagination
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

/**
 * Generates RFC 4180 compliant CSV content for filtered students.
 */
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
