import { clerk } from "../lib/server/clerk";
import { getAdminSupabase } from "../lib/server/supabase";
import { generateUsername } from "../lib/username";
import { generateHashCode } from "../lib/hashcode";

interface DemoStudentRaw {
  fullName: string;
  category: "1st Year" | "2nd Year" | "3rd Year" | "4th Year";
  department: string;
  hostel: string;
  rollNumber: string;
}

const DEMO_STUDENT_NAMES: Record<"1st Year" | "2nd Year" | "3rd Year" | "4th Year", string[]> = {
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
  "Civil Engineering"
];

const HOSTELS = ["Aryabhatta Hall (Hostel 1)", "Ramanujan Hall (Hostel 2)", "Sarojini Naidu Hall (Hostel 3)", "Kalpana Chawla Hall (Hostel 4)"];

async function seedDemoData() {
  console.log("=== Seeding Demo Students across 1st Year to 4th Year ===");
  const supabase = getAdminSupabase();

  // 1. Ensure Checkpoints Exist
  console.log("[1/3] Ensuring Checkpoints are seeded...");
  const checkpoints = [
    { name: "Central Library Main Gate (Both)", type: "LIBRARY_BOTH", is_active: true },
    { name: "North Turnstile Entrance (Entry Only)", type: "LIBRARY_ENTRY", is_active: true },
    { name: "South Turnstile Exit (Exit Only)", type: "LIBRARY_EXIT", is_active: true },
  ];

  for (const cp of checkpoints) {
    await supabase.from("checkpoints").upsert(cp, { onConflict: "name" });
  }

  // 2. Ensure Access Windows Exist
  console.log("[2/3] Ensuring Default Access Windows are seeded...");
  const windows = [
    { role: "student", day_of_week: null, open_time: "17:00", close_time: "23:30", is_active: true },
    { role: "scanner", day_of_week: null, open_time: "16:00", close_time: "23:59", is_active: true },
    { role: "admin", day_of_week: null, open_time: "00:00", close_time: "23:59", is_active: true },
  ];

  for (const win of windows) {
    await supabase.from("access_windows").upsert(win, { onConflict: "role" });
  }

  // 3. Generate 40 Demo Students
  console.log("[3/3] Generating 40 Demo Students across Y1–Y4 with CSPRNG hash codes...");
  const issuedCredentials: Array<{
    rollNumber: string;
    fullName: string;
    category: string;
    username: string;
    hashCode: string;
    department: string;
  }> = [];

  const existingCodes: string[] = [];
  const years: Array<"1st Year" | "2nd Year" | "3rd Year" | "4th Year"> = ["1st Year", "2nd Year", "3rd Year", "4th Year"];

  let yearIndex = 0;
  for (const category of years) {
    const studentNames = DEMO_STUDENT_NAMES[category];
    const yearPrefix = (2026 - (4 - yearIndex)).toString().slice(-2); // 23, 24, 25, 26

    for (let i = 0; i < studentNames.length; i++) {
      const name = studentNames[i];
      const rollNumber = `${yearPrefix}CS${1001 + i + yearIndex * 20}`;
      const department = DEPARTMENTS[(i + yearIndex) % DEPARTMENTS.length];
      const hostel = HOSTELS[(i + yearIndex) % HOSTELS.length];

      const username = generateUsername(name, rollNumber);
      const hashCode = generateHashCode(existingCodes);
      existingCodes.push(hashCode);

      let clerkUserId = `mock_clerk_${username}_${Date.now()}`;

      // If valid Clerk keys are present, attempt creating in Clerk
      try {
        const createdClerkUser = await clerk.users.createUser({
          username,
          password: hashCode,
          firstName: name.split(" ")[0],
          lastName: name.split(" ").slice(1).join(" "),
          publicMetadata: {
            role: "student",
          },
          skipPasswordChecks: true,
        });
        clerkUserId = createdClerkUser.id;
      } catch (err: any) {
        // Fallback for offline/test environments without active Clerk internet connectivity
        console.warn(`[Notice] Clerk online registration skipped for ${username} (using simulated ID).`);
      }

      // Insert profile into Supabase
      const { data: profile, error: profileErr } = await supabase
        .from("profiles")
        .upsert(
          {
            clerk_user_id: clerkUserId,
            username,
            role: "student",
            full_name: name,
            is_active: true,
            must_change_password: true,
            credential_version: 1,
          },
          { onConflict: "username" }
        )
        .select()
        .single();

      if (profileErr) {
        console.error(`Error inserting profile for ${username}:`, profileErr);
        continue;
      }

      // Insert student record into Supabase
      const { error: studentErr } = await supabase
        .from("students")
        .upsert(
          {
            profile_id: profile.id,
            roll_number: rollNumber,
            full_name: name,
            category,
            department,
            hostel,
            in_library: i % 4 === 0 ? 1 : 0, // Seed a few students as currently inside (in_library = 1)
          },
          { onConflict: "roll_number" }
        );

      if (studentErr) {
        console.error(`Error inserting student record for ${rollNumber}:`, studentErr);
        continue;
      }

      issuedCredentials.push({
        rollNumber,
        fullName: name,
        category,
        username,
        hashCode,
        department,
      });
    }

    yearIndex++;
  }

  // 4. Print Credentials Report Table ONCE
  console.log("\n==========================================================================================");
  console.log("            DEMO STUDENT CREDENTIALS SHEET (SHOWN EXACTLY ONCE UPON SEEDING)             ");
  console.log("==========================================================================================");
  console.log(
    "Roll No".padEnd(12) +
    "Name".padEnd(22) +
    "Category".padEnd(12) +
    "Username".padEnd(20) +
    "Initial Password (Hash Code)"
  );
  console.log("-".repeat(90));

  for (const cred of issuedCredentials) {
    console.log(
      cred.rollNumber.padEnd(12) +
      cred.fullName.slice(0, 20).padEnd(22) +
      cred.category.padEnd(12) +
      cred.username.padEnd(20) +
      cred.hashCode
    );
  }

  console.log("==========================================================================================");
  console.log(`Successfully registered and seeded ${issuedCredentials.length} students across 1st Year to 4th Year.`);
  console.log("Note: Hash codes are not stored in plaintext in the database.");
  console.log("==========================================================================================\n");
}

seedDemoData();
