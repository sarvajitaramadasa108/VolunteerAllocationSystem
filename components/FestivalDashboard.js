"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";

const emptyFestivalForm = {
  festivalKey: "",
  festivalName: "",
  festivalDateText: "",
  locationText: "",
  active: true
};

export default function FestivalDashboard() {
  const [festivals, setFestivals] = useState([]);
  const [festivalsLoading, setFestivalsLoading] = useState(true);
  const [festivalMessage, setFestivalMessage] = useState("");
  const [savingFestival, setSavingFestival] = useState(false);
  const [festivalForm, setFestivalForm] = useState(emptyFestivalForm);
  const [selectedFestivalKey, setSelectedFestivalKey] = useState("");
  const [festivalServiceRows, setFestivalServiceRows] = useState([]);
  const [festivalServiceLoading, setFestivalServiceLoading] = useState(false);
  const [festivalServiceMessage, setFestivalServiceMessage] = useState("");
  const [savingServiceIds, setSavingServiceIds] = useState({});

  useEffect(() => {
    let alive = true;
    async function loadFestivals() {
      setFestivalsLoading(true);
      setFestivalMessage("");
      try {
        const payload = await fetchBridge("festivalMaster.list");
        if (!alive) return;
        const list = Array.isArray(payload) ? payload : [];
        setFestivals(list);
        const activeFestival = list.find((row) => row.active) || list[0] || null;
        if (activeFestival) {
          setSelectedFestivalKey(activeFestival.festivalKey || "");
          setFestivalForm({
            festivalKey: activeFestival.festivalKey || "",
            festivalName: activeFestival.festivalName || "",
            festivalDateText: activeFestival.festivalDateText || "",
            locationText: activeFestival.locationText || "",
            active: Boolean(activeFestival.active)
          });
        } else {
          setSelectedFestivalKey("");
          setFestivalForm(emptyFestivalForm);
        }
      } catch (error) {
        if (alive) {
          setFestivals([]);
          setFestivalMessage(error.message || "Could not load festival master");
        }
      } finally {
        if (alive) setFestivalsLoading(false);
      }
    }

    loadFestivals();
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    if (!selectedFestivalKey) {
      setFestivalServiceRows([]);
      return;
    }

    let alive = true;
    async function loadFestivalServices() {
      setFestivalServiceLoading(true);
      setFestivalServiceMessage("");
      try {
        const payload = await fetchBridge("festivalService.list", { festivalKey: selectedFestivalKey });
        if (!alive) return;
        const list = Array.isArray(payload) ? payload : [];
        setFestivalServiceRows(list.map((row, index) => normalizeFestivalServiceRow(row, index)));
      } catch (error) {
        if (alive) {
          setFestivalServiceRows([]);
          setFestivalServiceMessage(error.message || "Could not load service master");
        }
      } finally {
        if (alive) setFestivalServiceLoading(false);
      }
    }
    loadFestivalServices();
    return () => {
      alive = false;
    };
  }, [selectedFestivalKey]);

  const activeFestival = useMemo(
    () => festivals.find((row) => row.festivalKey === selectedFestivalKey) || festivals.find((row) => row.active) || null,
    [festivals, selectedFestivalKey]
  );

  async function loadFestivalsManually() {
    setFestivalsLoading(true);
    setFestivalMessage("");
    try {
      const payload = await fetchBridge("festivalMaster.list");
      const list = Array.isArray(payload) ? payload : [];
      setFestivals(list);
      const activeFestival = list.find((row) => row.active) || list[0] || null;
      if (activeFestival) {
        setSelectedFestivalKey(activeFestival.festivalKey || "");
        setFestivalForm({
          festivalKey: activeFestival.festivalKey || "",
          festivalName: activeFestival.festivalName || "",
          festivalDateText: activeFestival.festivalDateText || "",
          locationText: activeFestival.locationText || "",
          active: Boolean(activeFestival.active)
        });
      }
    } catch (error) {
      setFestivalMessage(error.message || "Could not load festival master");
    } finally {
      setFestivalsLoading(false);
    }
  }

  async function loadFestivalServicesManually(festivalKey = selectedFestivalKey) {
    if (!festivalKey) return;
    setFestivalServiceLoading(true);
    setFestivalServiceMessage("");
    try {
      const payload = await fetchBridge("festivalService.list", { festivalKey });
      const list = Array.isArray(payload) ? payload : [];
      setFestivalServiceRows(list.map((row, index) => normalizeFestivalServiceRow(row, index)));
    } catch (error) {
      setFestivalServiceMessage(error.message || "Could not load service master");
      setFestivalServiceRows([]);
    } finally {
      setFestivalServiceLoading(false);
    }
  }

  async function saveFestivalMaster() {
    setSavingFestival(true);
    setFestivalMessage("");
    try {
      const payload = await fetchBridge("festivalMaster.upsert", festivalForm);
      await loadFestivalsManually();
      if (payload?.festivalKey) {
        setSelectedFestivalKey(payload.festivalKey);
        setFestivalForm({
          festivalKey: payload.festivalKey,
          festivalName: payload.festivalName || "",
          festivalDateText: payload.festivalDateText || "",
          locationText: payload.locationText || "",
          active: Boolean(payload.active)
        });
        await loadFestivalServicesManually(payload.festivalKey);
      }
      setFestivalMessage("Festival saved successfully.");
    } catch (error) {
      setFestivalMessage(error.message || "Could not save festival");
    } finally {
      setSavingFestival(false);
    }
  }

  async function setActiveFestival(festivalKey) {
    setFestivalMessage("");
    try {
      await fetchBridge("festivalMaster.setActive", { festivalKey });
      await loadFestivalsManually();
      setSelectedFestivalKey(festivalKey);
      await loadFestivalServicesManually(festivalKey);
      setFestivalMessage("Active festival updated.");
    } catch (error) {
      setFestivalMessage(error.message || "Could not update active festival");
    }
  }

  function selectFestival(row) {
    setSelectedFestivalKey(row.festivalKey || "");
    setFestivalForm({
      festivalKey: row.festivalKey || "",
      festivalName: row.festivalName || "",
      festivalDateText: row.festivalDateText || "",
      locationText: row.locationText || "",
      active: Boolean(row.active)
    });
    setFestivalMessage("");
  }

  function createNewFestivalDraft() {
    setSelectedFestivalKey("");
    setFestivalForm(emptyFestivalForm);
    setFestivalMessage("");
    setFestivalServiceRows([]);
  }

  function updateFestivalForm(field, value) {
    setFestivalForm((current) => ({ ...current, [field]: value }));
  }

  function addServiceRow() {
    if (!selectedFestivalKey && !festivalForm.festivalName.trim()) {
      setFestivalServiceMessage("Save a festival first, then add services.");
      return;
    }
    setFestivalServiceRows((current) => [
      ...current,
      {
        _clientId: crypto.randomUUID(),
        id: "",
        serialNo: current.length + 1,
        festivalKey: selectedFestivalKey || festivalForm.festivalKey || "",
        serviceName: "",
        coordinatorName: "",
        coordinatorContactNumber: "",
        coordinatorPhotoLink: "",
        volunteersRequired: 0,
        active: true,
        allocatedCount: 0
      }
    ]);
  }

  function updateServiceRow(clientId, field, value) {
    setFestivalServiceRows((current) =>
      current.map((row) => (row._clientId === clientId ? { ...row, [field]: value } : row))
    );
  }

  async function saveServiceRow(row) {
    const festivalKey = selectedFestivalKey || festivalForm.festivalKey || row.festivalKey || "";
    if (!festivalKey) {
      setFestivalServiceMessage("Save the festival first before saving services.");
      return;
    }
    if (!String(row.serviceName || "").trim()) {
      setFestivalServiceMessage("Service name is required.");
      return;
    }

    setSavingServiceIds((current) => ({ ...current, [row._clientId]: true }));
    setFestivalServiceMessage("");
    try {
      await fetchBridge("festivalService.upsert", {
        festivalKey,
        serviceName: row.serviceName,
        coordinatorName: row.coordinatorName,
        coordinatorContactNumber: row.coordinatorContactNumber,
        coordinatorPhotoLink: row.coordinatorPhotoLink,
        volunteersRequired: Number(row.volunteersRequired || 0),
        active: Boolean(row.active)
      });
      await loadFestivalServicesManually(festivalKey);
      setFestivalServiceMessage("Service saved successfully.");
    } catch (error) {
      setFestivalServiceMessage(error.message || "Could not save service");
    } finally {
      setSavingServiceIds((current) => {
        const next = { ...current };
        delete next[row._clientId];
        return next;
      });
    }
  }

  async function deleteServiceRow(row) {
    const festivalKey = selectedFestivalKey || festivalForm.festivalKey || row.festivalKey || "";
    if (!festivalKey) {
      setFestivalServiceMessage("Select a festival first.");
      return;
    }
    setFestivalServiceMessage("");
    try {
      await fetchBridge("festivalService.delete", {
        id: row.id || "",
        festivalKey,
        serviceName: row.serviceName
      });
      await loadFestivalServicesManually(festivalKey);
      setFestivalServiceMessage("Service deleted.");
    } catch (error) {
      setFestivalServiceMessage(error.message || "Could not delete service");
    }
  }

  async function downloadFestivalServiceExcel() {
    if (!selectedFestivalKey) return;
    try {
      const headers = [
        "S No",
        "Service Name",
        "Coordinator Name",
        "Coordinator Number",
        "Coordinator Photo",
        "Required Volunteers",
        "Allocated Count",
        "Active"
      ];
      const rowsHtml = festivalServiceRows
        .map(
          (row, index) => `
          <tr>
            <td>${index + 1}</td>
            <td>${escapeHtml(row.serviceName || "")}</td>
            <td>${escapeHtml(row.coordinatorName || "")}</td>
            <td>${escapeHtml(row.coordinatorContactNumber || "")}</td>
            <td>${escapeHtml(row.coordinatorPhotoLink || "")}</td>
            <td>${escapeHtml(String(row.volunteersRequired ?? 0))}</td>
            <td>${escapeHtml(String(row.allocatedCount ?? 0))}</td>
            <td>${row.active ? "Yes" : "No"}</td>
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
      link.download = `${selectedFestivalKey || "festival"}-service-master.xls`;
      link.click();
      URL.revokeObjectURL(link.href);
    } catch (error) {
      setFestivalServiceMessage(error.message || "Could not download Excel");
    }
  }

  return (
    <main className="page-shell">
      <header className="topbar">
        <div>
          <p className="eyebrow">Service Master</p>
          <h1>Festival and Service Dashboard</h1>
          <p className="subtle">Create festivals, edit their services, and set the festival that should drive the live workflows.</p>
        </div>
        <nav className="topnav">
          <Link href="/">Home</Link>
          <Link href="/dashboard/registrations">Registrations</Link>
        </nav>
      </header>

      <section className="panel master-panel">
        <div className="panel-head">
          <div>
            <p className="eyebrow">Service Master</p>
            <h2>Festival and service setup</h2>
            <p className="subtle-dark">Maintain the festival details and the service rows that will drive registrations, lookups and allocations.</p>
          </div>
          <div className="row-actions">
            <button type="button" onClick={loadFestivalsManually} disabled={festivalsLoading}>
              {festivalsLoading ? "Loading..." : "Refresh festivals"}
            </button>
            <button type="button" onClick={createNewFestivalDraft}>
              New Festival
            </button>
          </div>
        </div>

        {festivalMessage ? <section className="notice">{festivalMessage}</section> : null}

        <div className="master-layout">
          <div className="master-column">
            <div className="soft-panel">
              <div className="form-grid festival-form-grid">
                <label className="field wide">
                  <span>Festival Name</span>
                  <input value={festivalForm.festivalName} onChange={(event) => updateFestivalForm("festivalName", event.target.value)} />
                </label>
                <label className="field">
                  <span>Festival Date</span>
                  <input value={festivalForm.festivalDateText} onChange={(event) => updateFestivalForm("festivalDateText", event.target.value)} />
                </label>
                <label className="field">
                  <span>Location</span>
                  <input value={festivalForm.locationText} onChange={(event) => updateFestivalForm("locationText", event.target.value)} />
                </label>
                <label className="field">
                  <span>Festival Key</span>
                  <input value={festivalForm.festivalKey} onChange={(event) => updateFestivalForm("festivalKey", event.target.value)} placeholder="auto-generated if left blank" />
                </label>
                <label className="field">
                  <span>Active</span>
                  <select value={festivalForm.active ? "yes" : "no"} onChange={(event) => updateFestivalForm("active", event.target.value === "yes")}>
                    <option value="yes">Yes</option>
                    <option value="no">No</option>
                  </select>
                </label>
              </div>

              <div className="row-actions master-actions">
                <button type="button" onClick={saveFestivalMaster} disabled={savingFestival}>
                  {savingFestival ? "Saving..." : "Save Festival"}
                </button>
              </div>
            </div>

            <div className="festival-list">
              {festivals.length ? festivals.map((festival) => (
                <button
                  type="button"
                  key={festival.festivalKey}
                  className={`festival-item${festival.festivalKey === selectedFestivalKey ? " active" : ""}`}
                  onClick={() => selectFestival(festival)}
                >
                  <strong>{festival.festivalName || festival.festivalKey}</strong>
                  <span>{festival.festivalDateText || "No date set"}</span>
                  <span>{festival.locationText || "No location set"}</span>
                  <span className="festival-item-actions">
                    <small>{festival.active ? "Active" : "Inactive"}</small>
                    <em>Tap to edit</em>
                  </span>
                  <span className="festival-item-actions">
                    <span className="chip">{festival.festivalKey}</span>
                    {!festival.active ? (
                      <span className="ghost-link" role="button" onClick={(event) => {
                        event.preventDefault();
                        event.stopPropagation();
                        setActiveFestival(festival.festivalKey);
                      }}>
                        Set active
                      </span>
                    ) : null}
                  </span>
                </button>
              )) : <div className="empty-state">{festivalsLoading ? "Loading festivals..." : "No festivals have been created yet."}</div>}
            </div>
          </div>

          <div className="master-column">
            <div className="soft-panel">
              <div className="panel-head">
                <div>
                  <h3>Services for {activeFestival?.festivalName || selectedFestivalKey || "the selected festival"}</h3>
                  <p className="subtle-dark">Add, edit, remove and publish the services for this festival.</p>
                </div>
                <div className="row-actions">
                  <button type="button" onClick={() => loadFestivalServicesManually(selectedFestivalKey)} disabled={festivalServiceLoading}>
                    {festivalServiceLoading ? "Loading..." : "Refresh services"}
                  </button>
                  <button type="button" onClick={addServiceRow}>
                    Add Service
                  </button>
                  <button type="button" onClick={downloadFestivalServiceExcel} disabled={!festivalServiceRows.length}>
                    Download Excel
                  </button>
                </div>
              </div>

              {festivalServiceMessage ? <section className="notice">{festivalServiceMessage}</section> : null}

              {festivalServiceRows.length ? (
                <div className="service-master-list">
                  {festivalServiceRows.map((row, index) => {
                    const key = row._clientId || row.id || `${row.serviceName || "service"}-${index}`;
                    const busy = Boolean(savingServiceIds[row._clientId]);
                    return (
                      <div className="service-row-card" key={key}>
                        <div className="service-row-head">
                          <strong>Service {index + 1}</strong>
                          <div className="row-actions">
                            <span className="chip">{row.allocatedCount || 0} allocated</span>
                            <button type="button" className="danger-button" onClick={() => deleteServiceRow(row)}>Delete</button>
                          </div>
                        </div>
                        <div className="service-row-grid">
                          <label className="field"><span>Service Name</span><input value={row.serviceName || ""} onChange={(event) => updateServiceRow(row._clientId, "serviceName", event.target.value)} /></label>
                          <label className="field"><span>Coordinator Name</span><input value={row.coordinatorName || ""} onChange={(event) => updateServiceRow(row._clientId, "coordinatorName", event.target.value)} /></label>
                          <label className="field"><span>Coordinator Number</span><input value={row.coordinatorContactNumber || ""} onChange={(event) => updateServiceRow(row._clientId, "coordinatorContactNumber", event.target.value)} /></label>
                          <label className="field"><span>Coordinator Photo</span><input value={row.coordinatorPhotoLink || ""} onChange={(event) => updateServiceRow(row._clientId, "coordinatorPhotoLink", event.target.value)} /></label>
                          <label className="field"><span>Required Volunteers</span><input type="number" min="0" value={row.volunteersRequired ?? 0} onChange={(event) => updateServiceRow(row._clientId, "volunteersRequired", event.target.value)} /></label>
                          <label className="field"><span>Active</span><select value={row.active ? "yes" : "no"} onChange={(event) => updateServiceRow(row._clientId, "active", event.target.value === "yes")}><option value="yes">Yes</option><option value="no">No</option></select></label>
                        </div>
                        <div className="row-actions master-actions">
                          <button type="button" onClick={() => saveServiceRow(row)} disabled={busy}>{busy ? "Saving..." : "Save Service"}</button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="empty-state">{festivalServiceLoading ? "Loading services..." : "No services have been added for this festival yet."}</div>
              )}
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}

function normalizeFestivalServiceRow(row, index) {
  return {
    _clientId: row?.id || `${row?.festivalKey || "festival"}-${row?.serviceName || "service"}-${index}`,
    id: row?.id || "",
    serialNo: Number(row?.serialNo || row?.serial_no || index + 1),
    festivalKey: String(row?.festivalKey || row?.festival_key || "").trim(),
    serviceName: String(row?.serviceName || row?.service_name || "").trim(),
    coordinatorName: String(row?.coordinatorName || row?.coordinator_name || "").trim(),
    coordinatorContactNumber: String(row?.coordinatorContactNumber || row?.coordinator_contact_number || "").trim(),
    coordinatorPhotoLink: String(row?.coordinatorPhotoLink || row?.coordinator_photo_link || "").trim(),
    volunteersRequired: Number(row?.volunteersRequired || row?.volunteers_required || 0),
    active: Boolean(row?.active ?? true),
    allocatedCount: Number(row?.allocatedCount || row?.allocated_count || 0)
  };
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
