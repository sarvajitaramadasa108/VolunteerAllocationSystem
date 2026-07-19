import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.SUPABASE_URL || "";
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

function getSupabase() {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error("SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY is not configured");
  }

  return createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });
}

function normalizeMobileNumber(value) {
  const digits = String(value || "").replace(/\D/g, "");
  if (!digits) return "";
  return digits.length > 10 ? digits.slice(-10) : digits;
}

function parseBool(value) {
  if (typeof value === "boolean") return value;
  const normalized = String(value || "").trim().toLowerCase();
  return ["1", "true", "yes", "y", "on"].includes(normalized);
}

function mapService(row, allocatedCount = 0) {
  return {
    serviceName: String(row?.service_name || "").trim(),
    coordinatorName: String(row?.coordinator_name || "").trim(),
    contactNumber: String(row?.coordinator_contact_number || "").trim(),
    reportingTime: String(row?.reporting_time || "").trim(),
    requiredCount: Number(row?.volunteers_required || 0),
    photoUrl: row?.coordinator_photo_link || "",
    allocatedCount: Number(allocatedCount || 0),
    rowNumber: null
  };
}

function mapVolunteer(row, servicesByName = {}) {
  const allocatedService = String(row?.allocated_service_name || "").trim();
  const serviceDetails = allocatedService ? servicesByName[allocatedService] || null : null;
  return {
    serialNo: Number(row?.serial_no || 0),
    name: String(row?.name || "").trim(),
    mobile: String(row?.mobile_number || "").trim(),
    mobileNumber: String(row?.mobile_number || "").trim(),
    gender: String(row?.gender || "").trim(),
    age: row?.age === null || row?.age === undefined ? "" : Number(row.age),
    occupation: String(row?.college_working || "").trim(),
    collegeWorking: String(row?.college_working || "").trim(),
    areaOfStay: String(row?.area_of_stay || "").trim(),
    allocatedService,
    allocatedServiceName: allocatedService,
    attendance: Boolean(row?.attendance),
    tshirt: Boolean(row?.tshirt),
    serviceDetails: serviceDetails ? mapService(serviceDetails) : null
  };
}

function buildServiceMap(rows) {
  const map = {};
  for (const row of rows || []) {
    const serviceName = String(row?.service_name || "").trim();
    if (serviceName) {
      map[serviceName] = row;
    }
  }
  return map;
}

function volunteerMissingFields(row = {}) {
  const missing = [];
  if (!String(row?.name || "").trim()) missing.push("name");
  if (!String(row?.gender || "").trim()) missing.push("gender");
  if (row?.age === null || row?.age === undefined || String(row?.age || "").trim() === "") missing.push("age");
  if (!String(row?.college_working || "").trim()) missing.push("occupation");
  if (!String(row?.area_of_stay || "").trim()) missing.push("areaOfStay");
  return missing;
}

async function listServices() {
  const supabase = getSupabase();
  const [servicesResult, volunteersResult] = await Promise.all([
    supabase.from("volunteer_service_master").select("*").order("serial_no", { ascending: true }),
    supabase.from("volunteers").select("allocated_service_name")
  ]);

  if (servicesResult.error) throw servicesResult.error;
  if (volunteersResult.error) throw volunteersResult.error;

  const allocationCounts = {};
  for (const row of volunteersResult.data || []) {
    const serviceName = String(row?.allocated_service_name || "").trim();
    if (!serviceName) continue;
    allocationCounts[serviceName] = (allocationCounts[serviceName] || 0) + 1;
  }

  return (servicesResult.data || [])
    .map((row) => mapService(row, allocationCounts[String(row?.service_name || "").trim()] || 0))
    .filter((row) => row.serviceName);
}

async function searchVolunteer(payload = {}) {
  const supabase = getSupabase();
  const mobileNumber = normalizeMobileNumber(payload.mobile || payload.mobileNumber || payload.whatsappNumber || "");
  if (!mobileNumber) {
    throw new Error("Enter a valid mobile number");
  }

  const markAttendance = parseBool(payload.markAttendance);
  const [servicesResult, volunteerResult] = await Promise.all([
    supabase.from("volunteer_service_master").select("*"),
    supabase.from("volunteers").select("*").eq("mobile_number", mobileNumber).maybeSingle()
  ]);

  if (servicesResult.error) throw servicesResult.error;
  if (volunteerResult.error) throw volunteerResult.error;

  const servicesByName = buildServiceMap(servicesResult.data || []);
  if (!volunteerResult.data) {
    return {
      found: false,
      allocated: false,
      complete: false,
      missingFields: ["name", "gender", "age", "occupation", "areaOfStay"],
      volunteer: null,
      serviceDetails: null
    };
  }

  const volunteerRow = volunteerResult.data;
  if (markAttendance && !volunteerRow.attendance) {
    const { error: attendanceError } = await supabase
      .from("volunteers")
      .update({ attendance: true })
      .eq("mobile_number", mobileNumber);
    if (attendanceError) throw attendanceError;
    volunteerRow.attendance = true;
  }

  const volunteer = mapVolunteer(volunteerRow, servicesByName);
  const missingFields = volunteerMissingFields(volunteerRow);
  return {
    found: true,
    allocated: Boolean(volunteer.allocatedService),
    complete: missingFields.length === 0,
    missingFields,
    volunteer,
    serviceDetails: volunteer.serviceDetails
  };
}

async function nextSerialNo(tableName, columnName) {
  const supabase = getSupabase();
  const { data, error } = await supabase.from(tableName).select(columnName).order(columnName, { ascending: false }).limit(1);
  if (error) throw error;
  const latest = data && data[0] ? Number(data[0][columnName] || 0) : 0;
  return latest + 1;
}

async function upsertVolunteer(payload = {}, options = {}) {
  const supabase = getSupabase();
  const mobileNumber = normalizeMobileNumber(payload.mobile || payload.mobileNumber || payload.whatsappNumber || "");
  if (!mobileNumber) {
    throw new Error("Enter a valid mobile number");
  }

  const markAttendance = parseBool(payload.markAttendance);
  const existingResult = await supabase.from("volunteers").select("*").eq("mobile_number", mobileNumber).maybeSingle();
  if (existingResult.error) throw existingResult.error;

  const serviceName = String(payload.service || payload.allocatedService || payload.serviceName || "").trim();
  const serviceLookupResult = serviceName
    ? await supabase.from("volunteer_service_master").select("*").eq("service_name", serviceName).maybeSingle()
    : { data: null, error: null };
  if (serviceLookupResult.error) throw serviceLookupResult.error;
  if (serviceName && !serviceLookupResult.data) {
    throw new Error("Select a valid service");
  }

  const existing = existingResult.data;
  const serialNo = existing ? Number(existing.serial_no || 0) : await nextSerialNo("volunteers", "serial_no");
  const merged = {
    serial_no: serialNo,
    mobile_number: mobileNumber,
    name: String(payload.name || existing?.name || "").trim(),
    gender: String(payload.gender || existing?.gender || "").trim(),
    age: payload.age === undefined || payload.age === null || payload.age === ""
      ? (existing?.age ?? null)
      : Number.parseInt(payload.age, 10),
    college_working: String(payload.occupation || payload.collegeWorking || existing?.college_working || "").trim(),
    area_of_stay: String(payload.areaOfStay || existing?.area_of_stay || "").trim(),
    allocated_service_name: serviceName || String(existing?.allocated_service_name || "").trim(),
    attendance: markAttendance ? true : Boolean(existing?.attendance),
    tshirt: parseBool(payload.tshirt || payload.tShirt) ? true : Boolean(existing?.tshirt)
  };

  if (merged.age !== null && merged.age !== undefined && Number.isNaN(merged.age)) {
    throw new Error("Age must be a number");
  }

  const eventPayload = {
    source_row_no: 0,
    mobile_number: merged.mobile_number,
    name: merged.name,
    gender: merged.gender,
    age: merged.age,
    college_working: merged.college_working,
    area_of_stay: merged.area_of_stay,
    allocated_service_name: merged.allocated_service_name || null,
    attendance: merged.attendance,
    tshirt: merged.tshirt,
    event_name: "Jagannatha Bahuda Ratha Yatra 2026",
    source: options.source || "web_form"
  };

  const { error: eventError } = await supabase.from("volunteer_registration_events").insert(eventPayload);
  if (eventError) throw eventError;

  const volunteerResult = existing
    ? await supabase.from("volunteers").update(merged).eq("mobile_number", mobileNumber).select("*").single()
    : await supabase.from("volunteers").insert(merged).select("*").single();

  if (volunteerResult.error) throw volunteerResult.error;

  const servicesResult = await supabase.from("volunteer_service_master").select("*");
  if (servicesResult.error) throw servicesResult.error;
  const servicesByName = buildServiceMap(servicesResult.data || []);
  const volunteer = mapVolunteer(volunteerResult.data, servicesByName);

  return {
    saved: true,
    volunteer,
    complete: volunteerMissingFields(volunteerResult.data).length === 0,
    missingFields: volunteerMissingFields(volunteerResult.data),
    allocated: Boolean(volunteer.allocatedService),
    serviceDetails: volunteer.serviceDetails
  };
}

async function allocateVolunteer(payload = {}) {
  const result = await upsertVolunteer(payload, { source: "allocation_desk" });
  return result;
}

async function markTshirt(payload = {}) {
  const supabase = getSupabase();
  const mobileNumber = normalizeMobileNumber(payload.mobile || payload.mobileNumber || payload.whatsappNumber || "");
  if (!mobileNumber) {
    throw new Error("Enter a valid mobile number");
  }

  const existingResult = await supabase.from("volunteers").select("*").eq("mobile_number", mobileNumber).maybeSingle();
  if (existingResult.error) throw existingResult.error;
  if (!existingResult.data) {
    throw new Error("Volunteer not found");
  }

  const { error } = await supabase.from("volunteers").update({ tshirt: true, attendance: true }).eq("mobile_number", mobileNumber);
  if (error) throw error;

  const servicesResult = await supabase.from("volunteer_service_master").select("*");
  if (servicesResult.error) throw servicesResult.error;
  const servicesByName = buildServiceMap(servicesResult.data || []);
  const volunteer = mapVolunteer({ ...existingResult.data, tshirt: true, attendance: true }, servicesByName);
  return { saved: true, volunteer };
}

async function volunteersByService(payload = {}) {
  const supabase = getSupabase();
  const serviceName = String(payload.serviceName || payload.service || "").trim();
  if (!serviceName) {
    throw new Error("Select a service");
  }

  const [volunteersResult, servicesResult] = await Promise.all([
    supabase.from("volunteers").select("*").eq("allocated_service_name", serviceName).order("serial_no", { ascending: true }),
    supabase.from("volunteer_service_master").select("*").eq("service_name", serviceName).maybeSingle()
  ]);

  if (volunteersResult.error) throw volunteersResult.error;
  if (servicesResult.error) throw servicesResult.error;

  const serviceMap = buildServiceMap(servicesResult.data ? [servicesResult.data] : []);
  return (volunteersResult.data || []).map((row) => mapVolunteer(row, serviceMap));
}

async function handler(request) {
  const url = new URL(request.url);
  const actionFromQuery = String(url.searchParams.get("action") || "").trim();
  const body = request.method === "GET" || request.method === "HEAD"
    ? {}
    : await request.json().catch(() => ({}));
  const action = String(body.action || actionFromQuery || "services.list").trim();
  const payload = {
    ...Object.fromEntries(url.searchParams.entries()),
    ...body
  };

  try {
    switch (action) {
      case "services.list":
        return Response.json({ ok: true, data: await listServices() });
      case "volunteers.search":
        return Response.json({ ok: true, data: await searchVolunteer(payload) });
      case "volunteers.upsert":
        return Response.json({ ok: true, data: await upsertVolunteer(payload, { source: "lookup_registration" }) });
      case "volunteers.allocate":
        return Response.json({ ok: true, data: await allocateVolunteer(payload) });
      case "volunteers.tshirt":
        return Response.json({ ok: true, data: await markTshirt(payload) });
      case "volunteers.byService":
        return Response.json({ ok: true, data: await volunteersByService(payload) });
      default:
        return Response.json({ ok: false, error: `Unknown action: ${action}` }, { status: 400 });
    }
  } catch (error) {
    return Response.json({ ok: false, error: error.message || "Server error" }, { status: 500 });
  }
}

export async function GET(request) {
  return handler(request);
}

export async function POST(request) {
  return handler(request);
}
