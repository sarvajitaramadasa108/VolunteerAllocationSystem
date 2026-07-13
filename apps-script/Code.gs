const SPREADSHEET_ID = "1hmlQzqvloOuOALPYiOmX-tn3HhOeeCLssF9Z5AOEQ6s";
const MASTER_SHEET_NAME = "Master Data";
const SERVICE_SHEET_NAME = "Service Master";

function doGet(e) {
  const action = String(e && e.parameter && e.parameter.action || "services.list");
  return jsonResponse(route(action, e ? e.parameter : {}, null));
}

function doPost(e) {
  const body = JSON.parse((e && e.postData && e.postData.contents) || "{}");
  const action = String(body.action || "volunteers.search");
  return jsonResponse(route(action, body, e));
}

function route(action, payload) {
  if (action === "services.list") return { ok: true, data: listServices() };
  if (action === "volunteers.search") return { ok: true, data: searchVolunteer(payload.mobile, payload.markAttendance) };
  if (action === "volunteers.allocate") return { ok: true, data: allocateService(payload) };
  if (action === "volunteers.upsert") return { ok: true, data: upsertVolunteer(payload) };
  if (action === "volunteers.byService") return { ok: true, data: volunteersByService(payload.serviceName) };
  if (action === "sync.formResponses") return { ok: true, data: syncFormResponsesToMaster() };
  if (action === "setup") return { ok: true, data: setupSheets() };
  return { ok: false, error: "Unknown action: " + action };
}

function setupSheets() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const master = ss.getSheetByName(MASTER_SHEET_NAME) || ss.insertSheet(MASTER_SHEET_NAME);
  const service = ss.getSheetByName(SERVICE_SHEET_NAME) || ss.insertSheet(SERVICE_SHEET_NAME);
  ensureMasterHeader(master);
  ensureServiceHeader(service);
  ensureFormSubmitTrigger(ss);
  return true;
}

function installFormSubmitTrigger() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  ensureFormSubmitTrigger(ss);
  return { installed: true };
}

function onFormSubmit(e) {
  try {
    syncFormResponseEvent(e);
  } catch (error) {
    console.error(error);
  }
}

function syncFormResponsesToMaster() {
  const sheet = formResponsesSheet();
  const rows = sheet.getDataRange().getValues();
  let synced = 0;
  for (let i = 1; i < rows.length; i++) {
    if (syncFormResponseRow(rows[i])) {
      synced += 1;
    }
  }
  return { synced: synced };
}

function syncFormResponseEvent(e) {
  if (!e || !e.values || !e.values.length) return false;
  return syncFormResponseRow(e.values);
}

function syncFormResponseRow(row) {
  if (!row || !row.length) return false;
  const master = masterSheet();
  const rows = master.getDataRange().getValues();
  const name = String(row[1] || "").trim();
  const gender = String(row[2] || "").trim();
  const age = String(row[3] || "").trim();
  const mobile = String(row[4] || "").trim();
  const occupation = String(row[5] || "").trim();
  const areaOfStay = String(row[6] || "").trim();
  const normalized = normalizeMobile(mobile);
  if (!normalized) return false;

  let rowIndex = -1;
  let allocatedService = "";
  let attendance = "";
  for (let i = 1; i < rows.length; i++) {
    if (normalizeMobile(rows[i][2]) === normalized) {
      rowIndex = i + 1;
      allocatedService = String(rows[i][7] || "").trim();
      attendance = String(rows[i][8] || "").trim();
      break;
    }
  }

  const serial = rowIndex > 0
    ? Number(rows[rowIndex - 1][0] || rowIndex)
    : nextMasterSerial_(rows);
  const updatedRow = [
    serial,
    name,
    mobile,
    gender,
    age,
    occupation,
    areaOfStay,
    allocatedService,
    attendance
  ];

  if (rowIndex > 0) {
    master.getRange(rowIndex, 1, 1, 9).setValues([updatedRow]);
  } else {
    master.appendRow(updatedRow);
  }
  return true;
}

function nextMasterSerial_(rows) {
  let maxSerial = 0;
  for (let i = 1; i < rows.length; i++) {
    const serial = Number(rows[i][0] || 0);
    if (serial > maxSerial) maxSerial = serial;
  }
  return maxSerial + 1;
}

function listServices() {
  ensureServiceHeader(serviceSheet());
  const serviceRows = serviceSheet().getDataRange().getValues();
  const masterRows = masterSheet().getDataRange().getValues();
  const allocationCounts = {};
  for (let i = 1; i < masterRows.length; i++) {
    const allocatedService = String(masterRows[i][7] || "").trim();
    if (!allocatedService) continue;
    allocationCounts[allocatedService] = (allocationCounts[allocatedService] || 0) + 1;
  }

  return serviceRows.slice(1).map(function (row, index) {
    const serviceName = String(row[1] || "").trim();
    return {
      serviceName: serviceName,
      coordinatorName: String(row[2] || "").trim(),
      contactNumber: String(row[3] || "").trim(),
      reportingTime: String(row[4] || "").trim(),
      requiredCount: Number(row[5] || 0),
      photoUrl: String(row[6] || "").trim(),
      allocatedCount: Number(allocationCounts[serviceName] || 0),
      rowNumber: index + 2
    };
  }).filter(function (row) { return row.serviceName; });
}

function searchVolunteer(mobile, markAttendance) {
  const normalized = normalizeMobile(mobile);
  if (!normalized) throw new Error("Enter a valid mobile number");
  const sheet = masterSheet();
  const rows = sheet.getDataRange().getValues();
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (normalizeMobile(row[2]) === normalized) {
      const allocatedService = String(row[7] || "").trim();
      if (markAttendance) {
        sheet.getRange(i + 1, 9).setValue("Yes");
      }
      return {
        found: true,
        allocated: Boolean(allocatedService),
        volunteer: mapVolunteerRow(row, i + 1),
        serviceDetails: allocatedService ? getServiceDetails(allocatedService) : null
      };
    }
  }
  return {
    found: false,
    allocated: false,
    volunteer: null,
    serviceDetails: null
  };
}

function allocateService(payload) {
  const normalized = normalizeMobile(payload.mobile);
  if (!normalized) throw new Error("Enter a valid mobile number");
  const serviceName = String(payload.service || "").trim();
  if (!serviceName) throw new Error("Select a service");
  const result = upsertVolunteer(payload);
  return Object.assign({}, result, { allocatedService: serviceName });
}

function upsertVolunteer(payload) {
  const normalized = normalizeMobile(payload.mobile);
  if (!normalized) throw new Error("Enter a valid mobile number");
  const markAttendance = Boolean(payload.markAttendance);

  const sheet = masterSheet();
  const rows = sheet.getDataRange().getValues();
  let rowIndex = findVolunteerRowIndex_(rows, normalized);
  const nextNo = rowIndex > 0 ? Number(rows[rowIndex - 1][0] || 0) : nextMasterSerial_(rows);
  const volunteerRow = [
    nextNo,
    String(payload.name || "").trim(),
    String(payload.mobile || "").trim(),
    String(payload.gender || "").trim(),
    String(payload.age || "").trim(),
    String(payload.occupation || "").trim(),
    String(payload.areaOfStay || "").trim(),
    String(payload.service || "").trim(),
    markAttendance ? "Yes" : (rowIndex > 0 ? String(rows[rowIndex - 1][8] || "").trim() : "")
  ];

  if (rowIndex > 0) {
    sheet.getRange(rowIndex, 1, 1, 9).setValues([volunteerRow]);
  } else {
    sheet.appendRow(volunteerRow);
    rowIndex = sheet.getLastRow();
    appendManualRegistrationToFormResponses_(payload);
  }

  return {
    found: true,
    allocated: Boolean(volunteerRow[7]),
    volunteer: mapVolunteerRow(volunteerRow, rowIndex),
    serviceDetails: volunteerRow[7] ? getServiceDetails(volunteerRow[7]) : null
  };
}

function getServiceDetails(serviceName) {
  const service = listServices().find(function (row) { return row.serviceName === serviceName; });
  return service || null;
}

function volunteersByService(serviceName) {
  const targetService = String(serviceName || "").trim();
  if (!targetService) throw new Error("Select a service");
  const rows = masterSheet().getDataRange().getValues();
  const result = [];
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (String(row[7] || "").trim() !== targetService) continue;
    result.push({
      rowNumber: i + 1,
      name: String(row[1] || "").trim(),
      mobile: String(row[2] || "").trim(),
      gender: String(row[3] || "").trim(),
      age: String(row[4] || "").trim(),
      occupation: String(row[5] || "").trim(),
      areaOfStay: String(row[6] || "").trim(),
      allocatedService: String(row[7] || "").trim()
    });
  }
  return result;
}

function mapVolunteerRow(row, rowNumber) {
  return {
    rowNumber: rowNumber,
    name: String(row[1] || "").trim(),
    mobile: String(row[2] || "").trim(),
    gender: String(row[3] || "").trim(),
    age: String(row[4] || "").trim(),
    occupation: String(row[5] || "").trim(),
    areaOfStay: String(row[6] || "").trim(),
    allocatedService: String(row[7] || "").trim(),
    attendance: String(row[8] || "").trim()
  };
}

function normalizeMobile(value) {
  const digits = String(value || "").replace(/\D/g, "");
  if (!digits) return "";
  if (digits.length === 12 && digits.indexOf("91") === 0) return digits.slice(-10);
  if (digits.length > 10) return digits.slice(-10);
  return digits;
}

function masterSheet() {
  return SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(MASTER_SHEET_NAME);
}

function serviceSheet() {
  return SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(SERVICE_SHEET_NAME);
}

function ensureMasterHeader(sheet) {
  const headers = ["S No", "Name", "Mobile Number", "Gender", "Age", "College / Working", "Area of Stay", "Allocated Service", "Attendance"];
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(headers);
    return;
  }
  const current = sheet.getRange(1, 1, 1, headers.length).getValues()[0];
  const changed = headers.some(function (header, index) {
    return String(current[index] || "").trim() !== header;
  });
  if (changed) {
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  }
}

function ensureServiceHeader(sheet) {
  const headers = ["S No", "Service Name", "Coordinator Name", "Coordinator Contact Number", "Reporting Time", "Number of Volunteers Required", "Coordinator Photo Link"];
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(headers);
    return;
  }
  const current = sheet.getRange(1, 1, 1, headers.length).getValues()[0];
  const changed = headers.some(function (header, index) {
    return String(current[index] || "").trim() !== header;
  });
  if (changed) {
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  }
}

function formResponsesSheet() {
  const sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName("Form Responses 1");
  if (!sheet) throw new Error('Sheet "Form Responses 1" not found');
  return sheet;
}

function appendManualRegistrationToFormResponses_(payload) {
  const sheet = formResponsesSheet();
  const headers = getHeaderRow_(sheet);
  const timestamp = Utilities.formatDate(new Date(), Session.getScriptTimeZone() || "Asia/Calcutta", "yyyy-MM-dd HH:mm:ss");
  const row = new Array(Math.max(headers.length, 7)).fill("");
  row[0] = timestamp;
  row[1] = String(payload.name || "").trim();
  row[2] = String(payload.gender || "").trim();
  row[3] = String(payload.age || "").trim();
  row[4] = String(payload.mobile || "").trim();
  row[5] = String(payload.occupation || "").trim();
  row[6] = String(payload.areaOfStay || "").trim();
  sheet.appendRow(row);
}

function getHeaderRow_(sheet) {
  if (!sheet || sheet.getLastRow() === 0) return [];
  return sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
}

function findVolunteerRowIndex_(rows, normalizedMobile) {
  for (let i = 1; i < rows.length; i++) {
    if (normalizeMobile(rows[i][2]) === normalizedMobile) {
      return i + 1;
    }
  }
  return -1;
}

function ensureFormSubmitTrigger(ss) {
  const triggers = ScriptApp.getProjectTriggers();
  const hasTrigger = triggers.some(function (trigger) {
    return trigger.getHandlerFunction() === "onFormSubmit";
  });
  if (hasTrigger) return;
  ScriptApp.newTrigger("onFormSubmit").forSpreadsheet(ss).onFormSubmit().create();
}

function jsonResponse(data) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}
