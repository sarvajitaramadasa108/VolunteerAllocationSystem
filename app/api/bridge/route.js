import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.SUPABASE_URL || "";
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const BAHUDA_EVENT_KEY = "BAHUDA_RATHAYATRA_2026";
const BAHUDA_EVENT_NAME = "Volunteer Service Registrations for Sri Jagannath Bahuda Rathayatra";
const DEFAULT_FESTIVAL_KEY = BAHUDA_EVENT_KEY;
const DEFAULT_FESTIVAL_NAME = "Jagannatha Bahuda Ratha Yatra";

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
  const bahudaAllocatedService = String(row?.bahuda_allocated_service_name || "").trim();
  const serviceDetails = allocatedService ? servicesByName[allocatedService] || null : null;
  const bahudaServiceDetails = bahudaAllocatedService ? servicesByName[bahudaAllocatedService] || null : null;
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
    bahudaAllocatedService,
    bahudaAllocatedServiceName: bahudaAllocatedService,
    attendance: Boolean(row?.attendance),
    tshirt: Boolean(row?.tshirt),
    serviceDetails: serviceDetails ? mapService(serviceDetails) : null,
    bahudaServiceDetails: bahudaServiceDetails ? mapService(bahudaServiceDetails) : null
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

function mapFestival(row) {
  return {
    id: row?.id || null,
    serialNo: Number(row?.serial_no || 0),
    festivalKey: String(row?.festival_key || "").trim(),
    festivalName: String(row?.festival_name || "").trim(),
    festivalDateText: String(row?.festival_date_text || "").trim(),
    locationText: String(row?.location_text || "").trim(),
    active: Boolean(row?.active),
    createdAt: row?.created_at || null,
    updatedAt: row?.updated_at || null
  };
}

function mapFestivalService(row) {
  return {
    id: row?.id || null,
    serialNo: Number(row?.serial_no || 0),
    festivalKey: String(row?.festival_key || "").trim(),
    serviceName: String(row?.service_name || "").trim(),
    coordinatorName: String(row?.coordinator_name || "").trim(),
    coordinatorContactNumber: String(row?.coordinator_contact_number || "").trim(),
    coordinatorPhotoLink: String(row?.coordinator_photo_link || "").trim(),
    volunteersRequired: Number(row?.volunteers_required || 0),
    active: Boolean(row?.active),
    createdAt: row?.created_at || null,
    updatedAt: row?.updated_at || null
  };
}

function mapFestivalAllocation(row) {
  return {
    id: row?.id || null,
    serialNo: Number(row?.serial_no || 0),
    festivalKey: String(row?.festival_key || "").trim(),
    mobileNumber: String(row?.mobile_number || "").trim(),
    serviceName: String(row?.service_name || "").trim(),
    allocationType: String(row?.allocation_type || "").trim(),
    attendance: Boolean(row?.attendance),
    tshirt: Boolean(row?.tshirt),
    createdAt: row?.created_at || null,
    updatedAt: row?.updated_at || null
  };
}

function mapFestivalServiceAsLegacy(row) {
  return {
    id: row?.id || null,
    serial_no: Number(row?.serial_no || 0),
    service_name: String(row?.service_name || "").trim(),
    coordinator_name: String(row?.coordinator_name || "").trim(),
    coordinator_contact_number: String(row?.coordinator_contact_number || "").trim(),
    coordinator_photo_link: String(row?.coordinator_photo_link || "").trim(),
    volunteers_required: Number(row?.volunteers_required || 0),
    active: Boolean(row?.active ?? true),
    reporting_time: "",
    created_at: row?.created_at || null,
    updated_at: row?.updated_at || null
  };
}

function buildFestivalKey(name = "", dateText = "") {
  const base = `${String(name || "").trim()} ${String(dateText || "").trim()}`.trim();
  const normalized = base
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
  return normalized ? normalized.slice(0, 64) : DEFAULT_FESTIVAL_KEY;
}

async function loadServiceCatalog(supabase, festivalKey = null) {
  const activeFestival = festivalKey ? { festivalKey } : await getActiveFestival(supabase);
  const activeFestivalKey = String(activeFestival?.festivalKey || DEFAULT_FESTIVAL_KEY).trim() || DEFAULT_FESTIVAL_KEY;

  const festivalResult = await supabase
    .from("festival_service_master")
    .select("*")
    .eq("festival_key", activeFestivalKey)
    .order("serial_no", { ascending: true });

  if (festivalResult.error && !String(festivalResult.error.message || "").includes("festival_service_master")) {
    throw festivalResult.error;
  }

  if ((festivalResult.data || []).length) {
    return {
      festivalKey: activeFestivalKey,
      source: "festival",
      rows: (festivalResult.data || []).map(mapFestivalServiceAsLegacy)
    };
  }

  const legacyResult = await supabase
    .from("volunteer_service_master")
    .select("*")
    .order("serial_no", { ascending: true });
  if (legacyResult.error) throw legacyResult.error;

  return {
    festivalKey: activeFestivalKey,
    source: "legacy",
    rows: (legacyResult.data || []).map((row) => ({
      id: row?.id || null,
      serial_no: Number(row?.serial_no || 0),
      service_name: String(row?.service_name || "").trim(),
      coordinator_name: String(row?.coordinator_name || "").trim(),
      coordinator_contact_number: String(row?.coordinator_contact_number || "").trim(),
      coordinator_photo_link: String(row?.coordinator_photo_link || "").trim(),
      volunteers_required: Number(row?.volunteers_required || 0),
      active: Boolean(row?.active ?? true),
      reporting_time: String(row?.reporting_time || "").trim(),
      created_at: row?.created_at || null,
      updated_at: row?.updated_at || null
    }))
  };
}

async function getActiveFestival(supabase) {
  const { data, error } = await supabase
    .from("festival_master")
    .select("*")
    .eq("active", true)
    .order("serial_no", { ascending: true })
    .limit(1);
  if (error) throw error;
  if (data && data[0]) return mapFestival(data[0]);
  return {
    festivalKey: DEFAULT_FESTIVAL_KEY,
    festivalName: DEFAULT_FESTIVAL_NAME,
    festivalDateText: "",
    locationText: "",
    active: true
  };
}

async function listFestivalMasters() {
  const supabase = getSupabase();
  const { data, error } = await supabase.from("festival_master").select("*").order("serial_no", { ascending: true });
  if (error) throw error;
  return (data || []).map(mapFestival);
}

async function nextFestivalSerialNo(supabase, tableName = "festival_master") {
  return nextSerialNo(tableName, "serial_no");
}

async function upsertFestivalMaster(payload = {}) {
  const supabase = getSupabase();
  const festivalName = String(payload.festivalName || payload.festival_name || "").trim();
  const festivalDateText = String(payload.festivalDateText || payload.festival_date_text || "").trim();
  const festivalKey = String(payload.festivalKey || payload.festival_key || "").trim() || buildFestivalKey(festivalName, festivalDateText);
  if (!festivalKey || !festivalName) {
    throw new Error("Festival name is required");
  }

  const existingResult = await supabase.from("festival_master").select("*").eq("festival_key", festivalKey).maybeSingle();
  if (existingResult.error) throw existingResult.error;
  const existing = existingResult.data;
  const row = {
    serial_no: existing ? Number(existing.serial_no || 0) : await nextFestivalSerialNo(supabase),
    festival_key: festivalKey,
    festival_name: festivalName,
    festival_date_text: festivalDateText,
    location_text: String(payload.locationText || payload.location_text || "").trim(),
    active: parseBool(payload.active)
  };

  const result = existing
    ? await supabase.from("festival_master").update(row).eq("festival_key", festivalKey).select("*").single()
    : await supabase.from("festival_master").insert(row).select("*").single();
  if (result.error) throw result.error;

  if (row.active) {
    await supabase.from("festival_master").update({ active: false }).neq("festival_key", festivalKey);
  }

  return mapFestival(result.data);
}

async function setActiveFestival(payload = {}) {
  const supabase = getSupabase();
  const festivalKey = String(payload.festivalKey || payload.festival_key || "").trim();
  if (!festivalKey) throw new Error("Select a festival");
  const { error: deactivateError } = await supabase.from("festival_master").update({ active: false }).neq("festival_key", festivalKey);
  if (deactivateError) throw deactivateError;
  const { error } = await supabase.from("festival_master").update({ active: true }).eq("festival_key", festivalKey);
  if (error) throw error;
  return { festivalKey, active: true };
}

async function listFestivalServices(payload = {}) {
  const supabase = getSupabase();
  const festivalKey = String(payload.festivalKey || payload.festival_key || "").trim() || (await getActiveFestival(supabase)).festivalKey;
  const catalog = await loadServiceCatalog(supabase, festivalKey);

  const allocationCounts = {};
  if (catalog.source === "festival") {
    const allocationsResult = await supabase
      .from("volunteer_festival_allocations")
      .select("service_name")
      .eq("festival_key", festivalKey);
    if (!allocationsResult.error) {
      for (const row of allocationsResult.data || []) {
        const serviceName = String(row?.service_name || "").trim();
        if (!serviceName) continue;
        allocationCounts[serviceName] = (allocationCounts[serviceName] || 0) + 1;
      }
    }
  } else {
    const allocationField = getAllocationFieldName(payload.allocationType);
    const volunteersResult = await supabase.from("volunteers").select("*");
    if (volunteersResult.error) throw volunteersResult.error;
    for (const row of volunteersResult.data || []) {
      const serviceName = String(row?.[allocationField] || row?.allocated_service_name || "").trim();
      if (!serviceName) continue;
      allocationCounts[serviceName] = (allocationCounts[serviceName] || 0) + 1;
    }
  }

  return (catalog.rows || [])
    .filter((row) => Boolean(row?.active ?? true))
    .map((row) => ({
      ...mapService(row, allocationCounts[String(row?.service_name || "").trim()] || 0),
      festivalKey: catalog.festivalKey,
      active: Boolean(row?.active ?? true)
    }));
}

async function upsertFestivalService(payload = {}) {
  const supabase = getSupabase();
  const festivalKey = String(payload.festivalKey || payload.festival_key || "").trim() || (await getActiveFestival(supabase)).festivalKey;
  const serviceName = String(payload.serviceName || payload.service_name || "").trim();
  if (!festivalKey || !serviceName) {
    throw new Error("Festival and service name are required");
  }

  const existingResult = await supabase
    .from("festival_service_master")
    .select("*")
    .eq("festival_key", festivalKey)
    .eq("service_name", serviceName)
    .maybeSingle();
  if (existingResult.error) throw existingResult.error;
  const existing = existingResult.data;
  const row = {
    serial_no: existing ? Number(existing.serial_no || 0) : await nextSerialNo("festival_service_master", "serial_no"),
    festival_key: festivalKey,
    service_name: serviceName,
    coordinator_name: String(payload.coordinatorName || payload.coordinator_name || "").trim(),
    coordinator_contact_number: String(payload.coordinatorContactNumber || payload.coordinator_contact_number || "").trim(),
    coordinator_photo_link: String(payload.coordinatorPhotoLink || payload.coordinator_photo_link || "").trim(),
    volunteers_required: Number.parseInt(payload.volunteersRequired ?? payload.volunteers_required ?? 0, 10) || 0,
    active: payload.active === undefined ? true : parseBool(payload.active)
  };

  const result = existing
    ? await supabase
        .from("festival_service_master")
        .update(row)
        .eq("festival_key", festivalKey)
        .eq("service_name", serviceName)
        .select("*")
        .single()
    : await supabase.from("festival_service_master").insert(row).select("*").single();
  if (result.error) throw result.error;
  return mapFestivalService(result.data);
}

async function deleteFestivalService(payload = {}) {
  const supabase = getSupabase();
  const id = String(payload.id || "").trim();
  const festivalKey = String(payload.festivalKey || payload.festival_key || "").trim() || (await getActiveFestival(supabase)).festivalKey;
  const serviceName = String(payload.serviceName || payload.service_name || "").trim();
  if (!id && (!festivalKey || !serviceName)) {
    throw new Error("Select a service to delete");
  }

  let query = supabase.from("festival_service_master").delete();
  if (id) {
    query = query.eq("id", id);
  } else {
    query = query.eq("festival_key", festivalKey).eq("service_name", serviceName);
  }
  const { error } = await query;
  if (error) throw error;
  return { deleted: true };
}

async function upsertFestivalAllocation(supabase, payload = {}) {
  const festivalKey = String(payload.festivalKey || payload.festival_key || "").trim();
  const mobileNumber = normalizeMobileNumber(payload.mobile || payload.mobileNumber || "");
  if (!festivalKey || !mobileNumber) return null;
  const row = {
    serial_no: await nextSerialNo("volunteer_festival_allocations", "serial_no"),
    festival_key: festivalKey,
    mobile_number: mobileNumber,
    service_name: String(payload.serviceName || payload.service || "").trim() || null,
    allocation_type: String(payload.allocationType || "").trim() || null,
    attendance: Boolean(payload.attendance),
    tshirt: Boolean(payload.tshirt)
  };
  const existing = await supabase
    .from("volunteer_festival_allocations")
    .select("*")
    .eq("festival_key", festivalKey)
    .eq("mobile_number", mobileNumber)
    .maybeSingle();
  if (existing.error) throw existing.error;
  const result = existing.data
    ? await supabase.from("volunteer_festival_allocations").update(row).eq("festival_key", festivalKey).eq("mobile_number", mobileNumber).select("*").single()
    : await supabase.from("volunteer_festival_allocations").insert(row).select("*").single();
  if (result.error) throw result.error;
  return mapFestivalAllocation(result.data);
}

async function getFestivalAllocation(supabase, festivalKey, mobileNumber) {
  const { data, error } = await supabase
    .from("volunteer_festival_allocations")
    .select("*")
    .eq("festival_key", festivalKey)
    .eq("mobile_number", mobileNumber)
    .maybeSingle();
  if (error && String(error.message || "").includes("volunteer_festival_allocations")) return null;
  if (error) throw error;
  return data ? mapFestivalAllocation(data) : null;
}

async function findVolunteerByMobile(supabase, mobileNumber) {
  const { data, error } = await supabase.from("volunteers").select("*");
  if (error) throw error;
  return (data || []).find((row) => normalizeMobileNumber(row?.mobile_number || "") === mobileNumber) || null;
}

function getAllocationFieldName(allocationType = "") {
  return String(allocationType || "").trim().toLowerCase() === "bahuda"
    ? "bahuda_allocated_service_name"
    : "allocated_service_name";
}

function getBahudaCaseTypeFromVolunteer(row) {
  if (!row) return "new_registration";
  return volunteerMissingFields(row).length === 0 ? "existing_complete" : "partial_profile";
}

function mapBahudaRegistrationToActivityRow(row, serialNo) {
  return {
    serial_no: serialNo,
    event_key: BAHUDA_EVENT_KEY,
    event_name: BAHUDA_EVENT_NAME,
    mobile_number: normalizeMobileNumber(row?.mobile_number || ""),
    stage: "submit",
    case_type: "backfilled_submission",
    found: true,
    complete: true,
    registration_saved: true,
    missing_fields: [],
    name: String(row?.name || "").trim() || null,
    gender: String(row?.gender || "").trim() || null,
    age: row?.age === null || row?.age === undefined ? null : Number(row.age),
    college_working: String(row?.college_working || "").trim() || null,
    area_of_stay: String(row?.area_of_stay || "").trim() || null
  };
}

async function recordRegistrationActivity(supabase, payload = {}) {
  const mobileNumber = normalizeMobileNumber(payload.mobile || payload.mobileNumber || "");
  if (!mobileNumber) return null;

  try {
    const serialNo = await nextSerialNo("volunteer_registration_activity_logs", "serial_no");
    const row = {
      serial_no: serialNo,
      event_key: payload.eventKey || BAHUDA_EVENT_KEY,
      event_name: payload.eventName || BAHUDA_EVENT_NAME,
      mobile_number: mobileNumber,
      stage: String(payload.stage || "lookup").trim(),
      case_type: String(payload.caseType || "new_registration").trim(),
      found: Boolean(payload.found),
      complete: Boolean(payload.complete),
      registration_saved: Boolean(payload.registrationSaved),
      missing_fields: Array.isArray(payload.missingFields) ? payload.missingFields : [],
      name: String(payload.name || "").trim() || null,
      gender: String(payload.gender || "").trim() || null,
      age: payload.age === null || payload.age === undefined || payload.age === "" ? null : Number.parseInt(payload.age, 10),
      college_working: String(payload.collegeWorking || payload.occupation || "").trim() || null,
      area_of_stay: String(payload.areaOfStay || "").trim() || null
    };

    if (row.age !== null && Number.isNaN(row.age)) {
      row.age = null;
    }

    const { error } = await supabase.from("volunteer_registration_activity_logs").insert(row);
    if (error && error.code !== "42P01") throw error;
    return row;
  } catch (error) {
    if (error?.code === "42P01") return null;
    throw error;
  }
}

async function ensureBahudaSubmissionBackfill(supabase) {
  const [logsResult, registrationsResult] = await Promise.all([
    supabase
      .from("volunteer_registration_activity_logs")
      .select("mobile_number, stage, event_key")
      .eq("event_key", BAHUDA_EVENT_KEY)
      .eq("stage", "submit"),
    supabase
      .from("volunteer_event_registrations")
      .select("*")
      .eq("event_key", BAHUDA_EVENT_KEY)
  ]);

  if (logsResult.error) throw logsResult.error;
  if (registrationsResult.error) throw registrationsResult.error;

  const existingMobiles = new Set(
    (logsResult.data || []).map((row) => normalizeMobileNumber(row?.mobile_number || ""))
  );
  const missingRegistrations = (registrationsResult.data || []).filter((row) => {
    const mobile = normalizeMobileNumber(row?.mobile_number || "");
    return mobile && !existingMobiles.has(mobile);
  });

  if (!missingRegistrations.length) {
    return { backfilled: 0 };
  }

  const inserts = [];
  let nextSerial = await nextSerialNo("volunteer_registration_activity_logs", "serial_no");
  for (const row of missingRegistrations) {
    inserts.push(mapBahudaRegistrationToActivityRow(row, nextSerial));
    nextSerial += 1;
  }

  const { error } = await supabase.from("volunteer_registration_activity_logs").insert(inserts);
  if (error) throw error;

  return { backfilled: inserts.length };
}

function volunteerMatchClause(row) {
  if (row?.id) {
    return { column: "id", value: row.id };
  }
  return { column: "serial_no", value: row?.serial_no };
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

async function listServices(payload = {}) {
  const supabase = getSupabase();
  const allocationField = getAllocationFieldName(payload.allocationType);
  try {
    const festivalKey = String(payload.festivalKey || payload.festival_key || "").trim() || (await getActiveFestival(supabase)).festivalKey;
    const [servicesResult, allocationsResult] = await Promise.all([
      supabase.from("festival_service_master").select("*").eq("festival_key", festivalKey).order("serial_no", { ascending: true }),
      supabase.from("volunteer_festival_allocations").select("service_name").eq("festival_key", festivalKey)
    ]);

    if (servicesResult.error) throw servicesResult.error;

    const allocationCounts = {};
    if (!allocationsResult.error) {
      for (const row of allocationsResult.data || []) {
        const serviceName = String(row?.service_name || "").trim();
        if (!serviceName) continue;
        allocationCounts[serviceName] = (allocationCounts[serviceName] || 0) + 1;
      }
    }

    const mapped = (servicesResult.data || [])
      .filter((row) => Boolean(row?.active ?? true))
      .map((row) => ({
        ...mapService({
          service_name: row.service_name,
          coordinator_name: row.coordinator_name,
          coordinator_contact_number: row.coordinator_contact_number,
          reporting_time: "",
          volunteers_required: row.volunteers_required,
          coordinator_photo_link: row.coordinator_photo_link
        }, allocationCounts[String(row?.service_name || "").trim()] || 0),
        festivalKey,
        active: Boolean(row?.active ?? true)
      }));
    if (mapped.length) return mapped;
  } catch (error) {
    if (!String(error?.message || "").includes("festival_service_master")) {
      throw error;
    }
  }

  const [servicesResult, volunteersResult] = await Promise.all([
    supabase.from("volunteer_service_master").select("*").order("serial_no", { ascending: true }),
    supabase.from("volunteers").select("*")
  ]);
  if (servicesResult.error) throw servicesResult.error;
  if (volunteersResult.error) throw volunteersResult.error;

  const allocationCounts = {};
  for (const row of volunteersResult.data || []) {
    const serviceName = String(row?.[allocationField] || row?.allocated_service_name || "").trim();
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
  const [serviceCatalog, volunteerRow] = await Promise.all([
    loadServiceCatalog(supabase, payload.festivalKey || payload.festival_key || ""),
    findVolunteerByMobile(supabase, mobileNumber)
  ]);

  const servicesByName = buildServiceMap(serviceCatalog.rows || []);
  if (!volunteerRow) {
    return {
      found: false,
      allocated: false,
      complete: false,
      missingFields: ["name", "gender", "age", "occupation", "areaOfStay"],
      volunteer: null,
      serviceDetails: null
    };
  }

  if (markAttendance && !volunteerRow.attendance) {
    const match = volunteerMatchClause(volunteerRow);
    const { error: attendanceError } = await supabase
      .from("volunteers")
      .update({ attendance: true })
      .eq(match.column, match.value);
    if (attendanceError) throw attendanceError;
    volunteerRow.attendance = true;
  }

  const volunteer = mapVolunteer(volunteerRow, servicesByName);
  const missingFields = volunteerMissingFields(volunteerRow);
  return {
    found: true,
    allocated: Boolean(volunteer.allocatedService || volunteer.bahudaAllocatedService),
    bahudaAllocated: Boolean(volunteer.bahudaAllocatedService),
    complete: missingFields.length === 0,
    missingFields,
    volunteer,
    serviceDetails: volunteer.serviceDetails,
    serviceCatalogFestivalKey: serviceCatalog.festivalKey
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
  const existing = await findVolunteerByMobile(supabase, mobileNumber);

  const allocationField = getAllocationFieldName(payload.allocationType || options.allocationType);
  const serviceName = String(payload.service || payload.allocatedService || payload.serviceName || "").trim();
  const serviceCatalog = await loadServiceCatalog(supabase, payload.festivalKey || payload.festival_key || "");
  const servicesByName = buildServiceMap(serviceCatalog.rows || []);
  if (serviceName && !servicesByName[serviceName]) {
    throw new Error("Select a valid service");
  }

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
    allocated_service_name: allocationField === "allocated_service_name"
      ? (serviceName || String(existing?.allocated_service_name || "").trim())
      : String(existing?.allocated_service_name || "").trim(),
    bahuda_allocated_service_name: allocationField === "bahuda_allocated_service_name"
      ? (serviceName || String(existing?.bahuda_allocated_service_name || "").trim())
      : String(existing?.bahuda_allocated_service_name || "").trim(),
    attendance: markAttendance ? true : Boolean(existing?.attendance),
    tshirt: parseBool(payload.tshirt || payload.tShirt) ? true : Boolean(existing?.tshirt)
  };

  if (merged.age !== null && merged.age !== undefined && Number.isNaN(merged.age)) {
    throw new Error("Age must be a number");
  }

  if (options.source !== "allocation_desk") {
    const eventPayload = {
      source_row_no: 0,
      mobile_number: merged.mobile_number,
      name: merged.name,
      gender: merged.gender,
      age: merged.age,
      college_working: merged.college_working,
      area_of_stay: merged.area_of_stay,
      allocated_service_name: merged.allocated_service_name || null,
      bahuda_allocated_service_name: merged.bahuda_allocated_service_name || null,
      attendance: merged.attendance,
      tshirt: merged.tshirt,
      event_name: "Jagannatha Bahuda Ratha Yatra 2026",
      source: options.source || "web_form"
    };

    const { error: eventError } = await supabase.from("volunteer_registration_events").insert(eventPayload);
    if (eventError) throw eventError;
  }

  const volunteerResult = existing
    ? await supabase.from("volunteers").update(merged).eq(volunteerMatchClause(existing).column, volunteerMatchClause(existing).value).select("*").single()
    : await supabase.from("volunteers").insert(merged).select("*").single();

  if (volunteerResult.error) throw volunteerResult.error;

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
  const supabase = getSupabase();
  const result = await upsertVolunteer({ ...payload, allocationType: "bahuda" }, { source: "allocation_desk", allocationType: "bahuda" });
  try {
    const activeFestival = await getActiveFestival(supabase);
    await upsertFestivalAllocation(supabase, {
      festivalKey: activeFestival.festivalKey,
      mobile: payload.mobile || payload.mobileNumber || payload.whatsappNumber || "",
      serviceName: String(payload.service || payload.allocatedService || payload.serviceName || "").trim(),
      allocationType: "bahuda",
      attendance: parseBool(payload.markAttendance),
      tshirt: parseBool(payload.tshirt || payload.tShirt)
    });
  } catch (error) {
    if (!String(error?.message || "").includes("volunteer_festival_allocations")) {
      throw error;
    }
  }
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

  const serviceCatalog = await loadServiceCatalog(supabase, payload.festivalKey || payload.festival_key || "");
  const servicesByName = buildServiceMap(serviceCatalog.rows || []);
  const volunteer = mapVolunteer({ ...existingResult.data, tshirt: true, attendance: true }, servicesByName);
  return { saved: true, volunteer };
}

async function volunteersByService(payload = {}) {
  const supabase = getSupabase();
  const serviceName = String(payload.serviceName || payload.service || "").trim();
  if (!serviceName) {
    throw new Error("Select a service");
  }

  const serviceCatalog = await loadServiceCatalog(supabase, payload.festivalKey || payload.festival_key || "");
  const serviceMap = buildServiceMap(serviceCatalog.rows || []);
  const allocationField = getAllocationFieldName(payload.allocationType);
  const volunteersResult = await supabase.from("volunteers").select("*").order("serial_no", { ascending: true });
  if (volunteersResult.error) throw volunteersResult.error;
  return (volunteersResult.data || [])
    .filter((row) => String(row?.[allocationField] || row?.allocated_service_name || "").trim() === serviceName || String(row?.bahuda_allocated_service_name || "").trim() === serviceName)
    .map((row) => mapVolunteer(row, serviceMap));
}

async function bahudaRegistrationLookup(payload = {}) {
  const supabase = getSupabase();
  const mobileNumber = normalizeMobileNumber(payload.mobile || payload.mobileNumber || payload.whatsappNumber || "");
  if (!mobileNumber) {
    throw new Error("Enter a valid mobile number");
  }

  const { data, error } = await supabase
    .from("volunteers")
    .select("*")
    .eq("mobile_number", mobileNumber)
    .maybeSingle();
  if (error) throw error;

  if (!data) {
    const response = {
      found: false,
      complete: false,
      missingFields: ["name", "gender", "age", "occupation", "areaOfStay"],
      registration: null
    };
    await recordRegistrationActivity(supabase, {
      mobileNumber,
      stage: "lookup",
      caseType: "new_registration",
      found: false,
      complete: false,
      registrationSaved: false,
      missingFields: response.missingFields
    });
    return response;
  }

  const missingFields = volunteerMissingFields(data);
  const response = {
    found: true,
    complete: missingFields.length === 0,
    missingFields,
    registration: {
      serialNo: Number(data.serial_no || 0),
      mobileNumber: String(data.mobile_number || "").trim(),
      name: String(data.name || "").trim(),
      gender: String(data.gender || "").trim(),
      age: data.age === null || data.age === undefined ? "" : Number(data.age),
      occupation: String(data.college_working || "").trim(),
      areaOfStay: String(data.area_of_stay || "").trim(),
      allocatedServiceName: String(data.allocated_service_name || "").trim(),
      bahudaAllocatedServiceName: String(data.bahuda_allocated_service_name || "").trim(),
      attendance: Boolean(data.attendance),
      tshirt: Boolean(data.tshirt)
    }
  };
  await recordRegistrationActivity(supabase, {
    mobileNumber,
    stage: "lookup",
    caseType: getBahudaCaseTypeFromVolunteer(data),
    found: true,
    complete: response.complete,
    registrationSaved: false,
    missingFields: missingFields,
    name: data.name,
    gender: data.gender,
    age: data.age,
    collegeWorking: data.college_working,
    areaOfStay: data.area_of_stay
  });
  return response;
}

async function nextEventRegistrationSerialNo(supabase) {
  const { data, error } = await supabase
    .from("volunteers")
    .select("serial_no")
    .order("serial_no", { ascending: false })
    .limit(1);
  if (error) throw error;
  const latest = data && data[0] ? Number(data[0].serial_no || 0) : 0;
  return latest + 1;
}

async function bahudaRegistrationUpsert(payload = {}) {
  const supabase = getSupabase();
  const mobileNumber = normalizeMobileNumber(payload.mobile || payload.mobileNumber || payload.whatsappNumber || "");
  if (!mobileNumber) {
    throw new Error("Enter a valid mobile number");
  }

  const existing = await findVolunteerByMobile(supabase, mobileNumber);
  const existingSerial = Number(existing?.serial_no || 0);
  const merged = {
    serial_no: existingSerial || await nextEventRegistrationSerialNo(supabase),
    mobile_number: mobileNumber,
    name: String(payload.name || existing?.name || "").trim(),
    gender: String(payload.gender || existing?.gender || "").trim(),
    age: payload.age === undefined || payload.age === null || payload.age === ""
      ? (existing?.age ?? null)
      : Number.parseInt(payload.age, 10),
    college_working: String(payload.collegeWorking || payload.occupation || existing?.college_working || "").trim(),
    area_of_stay: String(payload.areaOfStay || existing?.area_of_stay || "").trim(),
    allocated_service_name: String(existing?.allocated_service_name || "").trim(),
    bahuda_allocated_service_name: String(existing?.bahuda_allocated_service_name || "").trim(),
    attendance: Boolean(existing?.attendance),
    tshirt: Boolean(existing?.tshirt)
  };

  if (merged.age !== null && merged.age !== undefined && Number.isNaN(merged.age)) {
    throw new Error("Age must be a number");
  }

  const volunteerRow = {
    serial_no: merged.serial_no,
    mobile_number: merged.mobile_number,
    name: merged.name,
    gender: merged.gender,
    age: merged.age,
    college_working: merged.college_working,
    area_of_stay: merged.area_of_stay,
    allocated_service_name: merged.allocated_service_name || null,
    bahuda_allocated_service_name: merged.bahuda_allocated_service_name || null,
    attendance: merged.attendance,
    tshirt: merged.tshirt
  };

  const volunteerResult = existing
    ? await supabase.from("volunteers").update(volunteerRow).eq(volunteerMatchClause(existing).column, volunteerMatchClause(existing).value).select("*").single()
    : await supabase.from("volunteers").insert(volunteerRow).select("*").single();
  if (volunteerResult.error) throw volunteerResult.error;

  const eventRow = {
    serial_no: volunteerResult.data.serial_no,
    event_key: "BAHUDA_RATHAYATRA_2026",
    event_name: "Volunteer Service Registrations for Sri Jagannath Bahuda Rathayatra",
    mobile_number: volunteerResult.data.mobile_number,
    name: volunteerResult.data.name,
    gender: volunteerResult.data.gender,
    age: volunteerResult.data.age,
    college_working: volunteerResult.data.college_working,
    area_of_stay: volunteerResult.data.area_of_stay,
    allocated_service_name: null,
    attendance: false,
    tshirt: false
  };

  const { error } = await supabase
    .from("volunteer_event_registrations")
    .upsert(eventRow, { onConflict: "event_key,mobile_number" });
  if (error) throw error;

  const registration = {
    serialNo: volunteerResult.data.serial_no,
    mobileNumber: volunteerResult.data.mobile_number,
    name: volunteerResult.data.name,
    gender: volunteerResult.data.gender,
    age: volunteerResult.data.age === null || volunteerResult.data.age === undefined ? "" : volunteerResult.data.age,
    occupation: volunteerResult.data.college_working,
    areaOfStay: volunteerResult.data.area_of_stay,
    allocatedServiceName: String(volunteerResult.data.allocated_service_name || "").trim(),
    bahudaAllocatedServiceName: String(volunteerResult.data.bahuda_allocated_service_name || "").trim(),
    attendance: Boolean(volunteerResult.data.attendance),
    tshirt: Boolean(volunteerResult.data.tshirt)
  };

  await recordRegistrationActivity(supabase, {
    mobileNumber,
    stage: "submit",
    caseType: String(payload.caseType || getBahudaCaseTypeFromVolunteer(existing || volunteerResult.data)).trim(),
    found: true,
    complete: volunteerMissingFields(volunteerResult.data).length === 0,
    registrationSaved: true,
    missingFields: volunteerMissingFields(volunteerResult.data),
    name: volunteerResult.data.name,
    gender: volunteerResult.data.gender,
    age: volunteerResult.data.age,
    collegeWorking: volunteerResult.data.college_working,
    areaOfStay: volunteerResult.data.area_of_stay
  });

  return {
    saved: true,
    registration,
    complete: volunteerMissingFields(volunteerResult.data).length === 0,
    missingFields: volunteerMissingFields(volunteerResult.data)
  };
}

async function listRegistrationActivities(payload = {}) {
  const supabase = getSupabase();
  const eventKey = String(payload.eventKey || BAHUDA_EVENT_KEY).trim();
  let backfillCount = 0;
  if (eventKey === BAHUDA_EVENT_KEY) {
    const backfillResult = await ensureBahudaSubmissionBackfill(supabase);
    backfillCount = Number(backfillResult.backfilled || 0);
  }
  const { data, error } = await supabase
    .from("volunteer_registration_activity_logs")
    .select("*")
    .eq("event_key", eventKey)
    .order("created_at", { ascending: false });
  if (error) throw error;

  const rows = (data || []).map((row) => ({
    serialNo: Number(row.serial_no || 0),
    eventKey: String(row.event_key || "").trim(),
    eventName: String(row.event_name || "").trim(),
    mobileNumber: String(row.mobile_number || "").trim(),
    stage: String(row.stage || "").trim(),
    caseType: String(row.case_type || "").trim(),
    found: Boolean(row.found),
    complete: Boolean(row.complete),
    registrationSaved: Boolean(row.registration_saved),
    missingFields: Array.isArray(row.missing_fields) ? row.missing_fields : [],
    name: String(row.name || "").trim(),
    gender: String(row.gender || "").trim(),
    age: row.age === null || row.age === undefined ? "" : Number(row.age),
    occupation: String(row.college_working || "").trim(),
    areaOfStay: String(row.area_of_stay || "").trim(),
    createdAt: row.created_at,
    updatedAt: row.updated_at
  }));

  const summary = {
    totalSearches: rows.filter((row) => row.stage === "lookup").length,
    totalSubmissions: rows.filter((row) => row.stage === "submit").length,
    completeLookups: rows.filter((row) => row.stage === "lookup" && row.caseType === "existing_complete").length,
    partialLookups: rows.filter((row) => row.stage === "lookup" && row.caseType === "partial_profile").length,
    newLookups: rows.filter((row) => row.stage === "lookup" && row.caseType === "new_registration").length,
    registrationsSaved: rows.filter((row) => row.stage === "submit" && row.registrationSaved).length,
    backfilledSubmissions: rows.filter((row) => row.stage === "submit" && row.caseType === "backfilled_submission").length,
    backfilledOnRefresh: backfillCount
  };

  return { rows, summary };
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
        return Response.json({ ok: true, data: await listServices(payload) });
      case "festivalMaster.list":
        return Response.json({ ok: true, data: await listFestivalMasters(payload) });
      case "festivalMaster.upsert":
        return Response.json({ ok: true, data: await upsertFestivalMaster(payload) });
      case "festivalMaster.setActive":
        return Response.json({ ok: true, data: await setActiveFestival(payload) });
      case "festivalService.list":
        return Response.json({ ok: true, data: await listFestivalServices(payload) });
      case "festivalService.upsert":
        return Response.json({ ok: true, data: await upsertFestivalService(payload) });
      case "festivalService.delete":
        return Response.json({ ok: true, data: await deleteFestivalService(payload) });
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
      case "bahudaRegistrations.lookup":
        return Response.json({ ok: true, data: await bahudaRegistrationLookup(payload) });
      case "bahudaRegistrations.upsert":
        return Response.json({ ok: true, data: await bahudaRegistrationUpsert(payload) });
      case "bahudaRegistrations.activity.list":
        return Response.json({ ok: true, data: await listRegistrationActivities(payload) });
      default:
        return Response.json({ ok: false, error: `Unknown action: ${action}` }, { status: 400 });
    }
  } catch (error) {
    if (
      error?.code === "42P01" ||
      String(error?.message || "").includes("volunteer_event_registrations") ||
      String(error?.message || "").includes("volunteer_registration_activity_logs")
    ) {
      return Response.json({
        ok: false,
        error: "Bahuda registration schema is not applied yet. Please run supabase/bahuda_registration_schema.sql in Supabase."
      }, { status: 500 });
    }
    return Response.json({ ok: false, error: error.message || "Server error" }, { status: 500 });
  }
}

export async function GET(request) {
  return handler(request);
}

export async function POST(request) {
  return handler(request);
}
