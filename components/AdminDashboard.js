"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";

export default function AdminDashboard() {
  const [services, setServices] = useState([]);
  const [selectedService, setSelectedService] = useState("");
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [message, setMessage] = useState("");
  const [rows, setRows] = useState([]);

  useEffect(() => {
    let alive = true;
    async function loadServices() {
      try {
        const response = await fetch("/api/bridge?action=services.list", { cache: "no-store" });
        const payload = await response.json();
        if (!alive) return;
        setServices(Array.isArray(payload.data) ? payload.data : []);
      } catch {
        if (alive) setServices([]);
      } finally {
        if (alive) setLoading(false);
      }
    }
    loadServices();
    return () => {
      alive = false;
    };
  }, []);

  const selectedMeta = useMemo(
    () => services.find((service) => service.serviceName === selectedService) || null,
    [services, selectedService]
  );

  async function downloadVolunteers() {
    if (!selectedService) {
      setMessage("Select a service first");
      return;
    }
    setWorking(true);
    setMessage("");
    try {
      const response = await fetch("/api/bridge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "volunteers.byService", serviceName: selectedService })
      });
      const payload = await response.json();
      if (!response.ok || payload.ok === false) throw new Error(payload.error || "Could not load volunteers");
      const list = Array.isArray(payload.data) ? payload.data : [];
      setRows(list);
      downloadExcel(list, selectedMeta);
      setMessage(`Downloaded ${list.length} volunteers for ${selectedService}`);
    } catch (error) {
      setMessage(error.message || "Could not download volunteers");
    } finally {
      setWorking(false);
    }
  }

  function downloadExcel(list, serviceMeta) {
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
    const rowsHtml = list.map((row, index) => `
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
      </tr>
    `).join("");
    const html = `
      <html>
        <head>
          <meta charset="UTF-8" />
        </head>
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

  return (
    <main className="page-shell">
      <header className="topbar">
        <div>
          <p className="eyebrow">Admin Dashboard</p>
          <h1>Service Volunteer Export</h1>
          <p className="subtle">Choose a service and download the allotted volunteers in Excel format.</p>
        </div>
        <nav className="topnav">
          <Link href="/">Home</Link>
        </nav>
      </header>

      <section className="panel">
        <div className="form-grid">
          <label className="field wide">
            <span>Service</span>
            <select value={selectedService} onChange={(event) => setSelectedService(event.target.value)}>
              <option value="">Select a service</option>
              {services.map((service) => (
                <option key={service.serviceName} value={service.serviceName}>
                  {service.serviceName}
                </option>
              ))}
            </select>
          </label>
          <div className="actions">
            <button type="button" onClick={downloadVolunteers} disabled={working || loading}>
              {working ? "Generating..." : "Get the volunteers allotted"}
            </button>
          </div>
        </div>
        {selectedMeta ? (
          <div className="metric-note" style={{ marginTop: 12 }}>
            Required: {Number(selectedMeta.requiredCount || 0)} | Allocated: {Number(selectedMeta.allocatedCount || 0)} | Pending: {Math.max(Number(selectedMeta.requiredCount || 0) - Number(selectedMeta.allocatedCount || 0), 0)}
          </div>
        ) : null}
      </section>

      {message ? <section className="notice">{message}</section> : null}

      <section className="panel">
        <div className="panel-head">
          <h2>Preview</h2>
          <p className="subtle">This is the live list that will be exported.</p>
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
    </main>
  );
}

function escapeHtml(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}
