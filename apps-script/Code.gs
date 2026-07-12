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
  if (action === "volunteers.search") return { ok: true, data: searchVolunteer(payload.mobile) };
  if (action === "volunteers.allocate") return { ok: true, data: allocateService(payload) };
  if (action === "volunteers.upsert") return { ok: true, data: upsertVolunteer(payload) };
  if (action === "setup") return { ok: true, data: setupSheets() };
  return { ok: false, error: "Unknown action: " + action };
}

function setupSheets() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const master = ss.getSheetByName(MASTER_SHEET_NAME) || ss.insertSheet(MASTER_SHEET_NAME);
  const service = ss.getSheetByName(SERVICE_SHEET_NAME) || ss.insertSheet(SERVICE_SHEET_NAME);
  if (master.getLastRow() === 0) {
    master.appendRow(["S No", "Name", "Mobile Number", "Gender", "Age", "College / Working", "Area of Stay", "Allocated Service"]);
  }
  if (service.getLastRow() === 0) {
    service.appendRow(["S No", "Service Name", "Coordinator Name", "Coordinator Contact Number", "Reporting Time"]);
  }
  return true;
}

function listServices() {
  const rows = serviceSheet().getDataRange().getValues();
  return rows.slice(1).map(function (row, index) {
    return {
      serviceName: String(row[1] || "").trim(),
      coordinatorName: String(row[2] || "").trim(),
      contactNumber: String(row[3] || "").trim(),
      reportingTime: String(row[4] || "").trim(),
      rowNumber: index + 2
    };
  }).filter(function (row) { return row.serviceName; });
}

function searchVolunteer(mobile) {
  const normalized = normalizeMobile(mobile);
  if (!normalized) throw new Error("Enter a valid mobile number");
  const sheet = masterSheet();
  const rows = sheet.getDataRange().getValues();
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (normalizeMobile(row[2]) === normalized) {
      const allocatedService = String(row[7] || "").trim();
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

  const sheet = masterSheet();
  const rows = sheet.getDataRange().getValues();
  const nextNo = Math.max(0, rows.length - 1) + 1;
  const volunteerRow = [
    nextNo,
    String(payload.name || "").trim(),
    String(payload.mobile || "").trim(),
    String(payload.gender || "").trim(),
    String(payload.age || "").trim(),
    String(payload.occupation || "").trim(),
    String(payload.areaOfStay || "").trim(),
    String(payload.service || "").trim()
  ];

  let rowIndex = -1;
  for (let i = 1; i < rows.length; i++) {
    if (normalizeMobile(rows[i][2]) === normalized) {
      rowIndex = i + 1;
      break;
    }
  }

  if (rowIndex > 0) {
    sheet.getRange(rowIndex, 1, 1, 8).setValues([volunteerRow]);
  } else {
    sheet.appendRow(volunteerRow);
    rowIndex = sheet.getLastRow();
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

function mapVolunteerRow(row, rowNumber) {
  return {
    rowNumber: rowNumber,
    name: String(row[1] || "").trim(),
    mobile: String(row[2] || "").trim(),
    gender: String(row[3] || "").trim(),
    age: String(row[4] || "").trim(),
    occupation: String(row[5] || "").trim(),
    areaOfStay: String(row[6] || "").trim(),
    allocatedService: String(row[7] || "").trim()
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

function jsonResponse(data) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}
