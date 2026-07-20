"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";

const emptyRegistrationSummary = {
  totalSearches: 0,
  totalSubmissions: 0,
  completeLookups: 0,
  partialLookups: 0,
  newLookups: 0,
  registrationsSaved: 0,
  backfilledSubmissions: 0,
  backfilledOnRefresh: 0
};

export default function RegistrationsDashboard() {
  const [services, setServices] = useState([]);
  const [festivals, setFestivals] = useState([]);
  const [selectedService, setSelectedService] = useState("");
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [message, setMessage] = useState("");
  const [rows, setRows] = useState([]);
  const [registrationRows, setRegistrationRows] = useState([]);
  const [registrationSummary, setRegistrationSummary] = useState(emptyRegistrationSummary);
  const [registrationLoading, setRegistrationLoading] = useState(true);
  const [registrationMessage, setRegistrationMessage] = useState("");

  useEffect(() => {
    let alive = true;
    async function loadInitialData() {
      try {
        const [servicePayload, festivalPayload] = await Promise.all([
          fetchBridge("services.list"),
          fetchBridge("festivalMaster.list")
        ]);
        if (!alive) return;
        setServices(Array.isArray(servicePayload) ? servicePayload : []);
        setFestivals(Array.isArray(festivalPayload) ? festivalPayload : []);
      } catch {
        if (alive) {
          setServices([]);
          setFestivals([]);
        }
      } finally {
        if (alive) setLoading(false);
      }
    }
    loadInitialData();
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    let alive = true;
    let timer = null;

    async function loadRegistrationActivity() {
      try {
        const payload = await fetchBridge("bahudaRegistrations.activity.list");
        if (!alive) return;
        setRegistrationRows(Array.isArray(payload?.rows) ? payload.rows : []);
        setRegistrationSummary(payload?.summary || emptyRegistrationSummary);
      } catch (error) {
        if (alive) {
          setRegistrationRows([]);
          setRegistrationSummary(emptyRegistrationSummary);
          setRegistrationMessage(error.message || "Could not load registration activity");
        }
      } finally {
        if (alive) setRegistrationLoading(false);
      }
    }

    loadRegistrationActivity();
    timer = window.setInterval(loadRegistrationActivity, 20000);
    return () => {
      alive = false;
      if (timer) window.clearInterval(timer);
    };
  }, []);

  const selectedMeta = useMemo(
    () => services.find((service) => service.serviceName === selectedService) || null,
    [services, selectedService]
  );

  const activeFestival = useMemo(
    () => festivals.find((row) => row.active) || festivals[0] || null,
    [festivals]
  );

  function getCaseLabel(row) {
    if (row.stage === "submit") return "Submission";
    if (row.caseType === "existing_complete") return "Already registered";
    if (row.caseType === "partial_profile") return "Partial registration";
    if (row.caseType === "new_registration") return "New registration";
    return row.caseType || "-";
  }

  async function loadVolunteers() {
    if (!selectedService) {
      setMessage("Select a service first");
      return;
    }
    setWorking(true);
    setMessage("");
    try {
      const payload = await fetchBridge("volunteers.byService", { serviceName: selectedService });
      setRows(Array.isArray(payload) ? payload : []);
      setMessage(`Loaded volunteers for ${selectedService}`);
    } catch (error) {
      setMessage(error.message || "Could not load volunteers");
    } finally {
      setWorking(false);
    }
  }

  function downloadVolunteerExcel(list, serviceMeta) {
    const headers = [
      "S No",
      "Name",
      "Mobile Number",
      "Gender",
      "Age",
      "College / Working",
      "Area of Stay",
      "Allocated Service",
      "Coordinator Name",
      "Coordinator Contact Number",
      "Reporting Time"
    ];
    const rowsHtml = list
      .map(
        (row, index) => `
      <tr>
        <td>${index + 1}</td>
        <td>${escapeHtml(row.name || "")}</td>
        <td>${escapeHtml(row.mobile || "")}</td>
        <td>${escapeHtml(row.gender || "")}</td>
        <td>${escapeHtml(String(row.age || ""))}</td>
        <td>${escapeHtml(row.occupation || "")}</td>
        <td>${escapeHtml(row.areaOfStay || "")}</td>
        <td>${escapeHtml(row.allocatedService || "")}</td>
        <td>${escapeHtml(serviceMeta?.coordinatorName || "")}</td>
        <td>${escapeHtml(serviceMeta?.contactNumber || "")}</td>
        <td>${escapeHtml(serviceMeta?.reportingTime || "")}</td>
      </tr>`
      )
      .join("");
    const html = `
      <html>
        <head><meta charset="UTF-8" /></head>
        <body>
          <table border="1">
            <tr>${headers.map((header) => `<th>${header}</th>`).join("")}</tr>
            ${rowsHtml}
          </table>
        </body>
      </html>
    `;
    const blob = new Blob([html], { type: "application/vnd.ms-excel" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `${selectedService || "service"}-volunteers.xls`;
    link.click();
    URL.revokeObjectURL(link.href);
  }

  function downloadRegistrationExcel() {
    const headers = [
      "S No",
      "Timestamp",
      "Mobile Number",
      "Stage",
      "Case",
      "Found",
      "Complete",
      "Registration Saved",
      "Missing Fields",
      "Name",
      "Gender",
      "Age",
      "College / Working",
      "Area of Stay"
    ];
    const rowsHtml = registrationRows
      .map(
        (row, index) => `
      <tr>
        <td>${index + 1}</td>
        <td>${escapeHtml(row.createdAt ? new Date(row.createdAt).toLocaleString() : "")}</td>
        <td>${escapeHtml(row.mobileNumber || "")}</td>
        <td>${escapeHtml(row.stage || "")}</td>
        <td>${escapeHtml(getCaseLabel(row))}</td>
        <td>${row.found ? "Yes" : "No"}</td>
        <td>${row.complete ? "Yes" : "No"}</td>
        <td>${row.registrationSaved ? "Yes" : "No"}</td>
        <td>${escapeHtml((row.missingFields || []).join(", "))}</td>
        <td>${escapeHtml(row.name || "")}</td>
        <td>${escapeHtml(row.gender || "")}</td>
        <td>${escapeHtml(String(row.age || ""))}</td>
        <td>${escapeHtml(row.occupation || "")}</td>
        <td>${escapeHtml(row.areaOfStay || "")}</td>
      </tr>`
      )
      .join("");
    const html = `
      <html>
        <head><meta charset="UTF-8" /></head>
        <body>
          <table border="1">
            <tr>${headers.map((header) => `<th>${header}</th>`).join("")}</tr>
            ${rowsHtml}
          </table>
        </body>
      </html>
    `;
    const blob = new Blob([html], { type: "application/vnd.ms-excel" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = "bahuda-registration-activity.xls";
    link.click();
    URL.revokeObjectURL(link.href);
  }

  return (
    <main className="page-shell">
      <header className="topbar">
        <div>
          <p className="eyebrow">Registrations Dashboard</p>
          <h1>Registrations and Service Allocations</h1>
          <p className="subtle">View service-wise allotments, live registration activity, and exports for the active festival.</p>
        </div>
        <nav className="topnav">
          <Link href="/">Home</Link>
          <Link href="/dashboard/festival">Festival Master</Link>
        </nav>
      </header>

      <section className="panel">
        <div className="form-grid">
          <label className="field wide">
            <span>Service</span>
            <select
              value={selectedService}
              onChange={(event) => {
                setSelectedService(event.target.value);
                setRows([]);
                setMessage("");
              }}
            >
              <option value="">Select a service</option>
              {services.map((service) => (
                <option key={service.serviceName} value={service.serviceName}>
                  {service.serviceName}
                </option>
              ))}
            </select>
          </label>
          <div className="actions">
            <button type="button" onClick={loadVolunteers} disabled={working || loading}>
              {working ? "Loading..." : "Get volunteer details"}
            </button>
          </div>
        </div>
        {activeFestival ? <div className="metric-note" style={{ marginTop: 12 }}>Active festival: {activeFestival.festivalName || activeFestival.festivalKey}</div> : null}
        {selectedMeta ? (
          <div className="metric-note" style={{ marginTop: 12 }}>
            Required: {Number(selectedMeta.requiredCount || 0)} | Allocated: {Number(selectedMeta.allocatedCount || 0)} | Pending: {Math.max(Number(selectedMeta.requiredCount || 0) - Number(selectedMeta.allocatedCount || 0), 0)}
          </div>
        ) : null}
      </section>

      {message ? <section className="notice">{message}</section> : null}

      <section className="panel">
        <div className="panel-head">
          <h2>Service-wise allotted data</h2>
          <div className="row-actions">
            {rows.length ? (
              <button type="button" onClick={() => downloadVolunteerExcel(rows, selectedMeta)} disabled={working}>
                Download as Excel
              </button>
            ) : null}
          </div>
        </div>
        {rows.length ? (
          <div className="table-wrap">
            <table className="summary-table">
              <thead>
                <tr>
                  <th>S No</th>
                  <th>Name</th>
                  <th>Mobile</th>
                  <th>Gender</th>
                  <th>Age</th>
                  <th>Occupation</th>
                  <th>Area</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row, index) => (
                  <tr key={`${row.mobile}-${index}`}>
                    <td>{index + 1}</td>
                    <td>{row.name || "-"}</td>
                    <td>{row.mobile || "-"}</td>
                    <td>{row.gender || "-"}</td>
                    <td>{row.age || "-"}</td>
                    <td>{row.occupation || "-"}</td>
                    <td>{row.areaOfStay || "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="empty-state">Select a service to preview the volunteers.</div>
        )}
      </section>

      <section className="panel">
        <div className="panel-head">
          <div>
            <h2>Registration activity</h2>
            <p className="subtle-dark">Live feed of lookups and submissions from the registration page.</p>
          </div>
          <div className="row-actions">
            <button
              type="button"
              onClick={async () => {
                setRegistrationLoading(true);
                setRegistrationMessage("");
                try {
                  const payload = await fetchBridge("bahudaRegistrations.activity.list");
                  setRegistrationRows(Array.isArray(payload?.rows) ? payload.rows : []);
                  setRegistrationSummary(payload?.summary || emptyRegistrationSummary);
                } catch (error) {
                  setRegistrationMessage(error.message || "Could not load registration activity");
                } finally {
                  setRegistrationLoading(false);
                }
              }}
              disabled={registrationLoading}
            >
              {registrationLoading ? "Loading..." : "Refresh"}
            </button>
            {registrationRows.length ? (
              <button type="button" onClick={downloadRegistrationExcel} disabled={registrationLoading}>
                Download Excel
              </button>
            ) : null}
          </div>
        </div>

        <div className="metric-note" style={{ marginBottom: 12 }}>
          Searches: {registrationSummary.totalSearches} | Submissions: {registrationSummary.totalSubmissions} | Existing: {registrationSummary.completeLookups} | Partial: {registrationSummary.partialLookups} | New: {registrationSummary.newLookups} | Backfilled: {registrationSummary.backfilledSubmissions}
        </div>

        {registrationMessage ? <section className="notice">{registrationMessage}</section> : null}

        {registrationRows.length ? (
          <div className="table-wrap">
            <table className="summary-table">
              <thead>
                <tr>
                  <th>S No</th>
                  <th>Time</th>
                  <th>Mobile</th>
                  <th>Stage</th>
                  <th>Case</th>
                  <th>Found</th>
                  <th>Complete</th>
                  <th>Saved</th>
                  <th>Missing Fields</th>
                  <th>Name</th>
                  <th>Gender</th>
                  <th>Age</th>
                  <th>College / Working</th>
                  <th>Area of Stay</th>
                </tr>
              </thead>
              <tbody>
                {registrationRows.map((row, index) => (
                  <tr key={`${row.mobileNumber}-${row.stage}-${row.createdAt}-${index}`}>
                    <td>{index + 1}</td>
                    <td>{row.createdAt ? new Date(row.createdAt).toLocaleString() : "-"}</td>
                    <td>{row.mobileNumber || "-"}</td>
                    <td>{row.stage || "-"}</td>
                    <td>{getCaseLabel(row)}</td>
                    <td>{row.found ? "Yes" : "No"}</td>
                    <td>{row.complete ? "Yes" : "No"}</td>
                    <td>{row.registrationSaved ? "Yes" : "No"}</td>
                    <td>{(row.missingFields || []).join(", ") || "-"}</td>
                    <td>{row.name || "-"}</td>
                    <td>{row.gender || "-"}</td>
                    <td>{row.age || "-"}</td>
                    <td>{row.occupation || "-"}</td>
                    <td>{row.areaOfStay || "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="empty-state">{registrationLoading ? "Loading registration activity..." : "No registration activity captured yet."}</div>
        )}
      </section>
    </main>
  );
}

async function fetchBridge(action, payload = {}) {
  const response = await fetch("/api/bridge", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action, ...payload })
  });
  const data = await response.json().catch(() => null);
  if (!response.ok || data?.ok === false) {
    throw new Error(data?.error || "Request failed");
  }
  return data.data;
}

function escapeHtml(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}
