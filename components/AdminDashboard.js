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

const emptyFestivalForm = {
  festivalKey: "",
  festivalName: "",
  festivalDateText: "",
  locationText: "",
  active: true
};

export default function AdminDashboard() {
  const [services, setServices] = useState([]);
  const [selectedService, setSelectedService] = useState("");
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [message, setMessage] = useState("");
  const [rows, setRows] = useState([]);
  const [registrationRows, setRegistrationRows] = useState([]);
  const [registrationSummary, setRegistrationSummary] = useState(emptyRegistrationSummary);
  const [registrationLoading, setRegistrationLoading] = useState(true);
  const [registrationMessage, setRegistrationMessage] = useState("");

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
    async function loadServices() {
      try {
        const payload = await fetchBridge("services.list");
        if (!alive) return;
        setServices(Array.isArray(payload) ? payload : []);
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

  const selectedMeta = useMemo(
    () => services.find((service) => service.serviceName === selectedService) || null,
    [services, selectedService]
  );

  const activeFestival = useMemo(
    () => festivals.find((row) => row.festivalKey === selectedFestivalKey) || festivals.find((row) => row.active) || null,
    [festivals, selectedFestivalKey]
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
      await loadServicesFromBackend();
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
      await loadServicesFromBackend();
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
      await loadServicesFromBackend();
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
      await loadServicesFromBackend();
      setFestivalServiceMessage("Service deleted.");
    } catch (error) {
      setFestivalServiceMessage(error.message || "Could not delete service");
    }
  }

  async function loadServicesFromBackend() {
    try {
      const payload = await fetchBridge("services.list");
      setServices(Array.isArray(payload) ? payload : []);
    } catch {
      setServices([]);
    }
  }

  async function downloadFestivalServiceExcel() {
    if (!selectedFestivalKey) return;
    setFestivalServiceMessage("");
    try {
      const data = festivalServiceRows;
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
      const rowsHtml = data
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
          <p className="eyebrow">Admin Dashboard</p>
          <h1>Service Volunteer Export</h1>
          <p className="subtle">Choose a service, manage festival setup, and download the allotted volunteers in Excel format.</p>
        </div>
        <nav className="topnav">
          <Link href="/">Home</Link>
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
                  <input
                    value={festivalForm.festivalName}
                    onChange={(event) => updateFestivalForm("festivalName", event.target.value)}
                    placeholder="Jagannatha Bahuda Ratha Yatra"
                  />
                </label>
                <label className="field">
                  <span>Festival Date</span>
                  <input
                    value={festivalForm.festivalDateText}
                    onChange={(event) => updateFestivalForm("festivalDateText", event.target.value)}
                    placeholder="24 July 2026, 4 PM onwards"
                  />
                </label>
                <label className="field">
                  <span>Location</span>
                  <input
                    value={festivalForm.locationText}
                    onChange={(event) => updateFestivalForm("locationText", event.target.value)}
                    placeholder="Sri Vaibhava Venkateswara Swamy Temple, Madhavadhara"
                  />
                </label>
                <label className="field">
                  <span>Festival Key</span>
                  <input
                    value={festivalForm.festivalKey}
                    onChange={(event) => updateFestivalForm("festivalKey", event.target.value)}
                    placeholder="auto-generated if left blank"
                  />
                </label>
                <label className="field">
                  <span>Active</span>
                  <select
                    value={festivalForm.active ? "yes" : "no"}
                    onChange={(event) => updateFestivalForm("active", event.target.value === "yes")}
                  >
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
              <div className="hint">The active festival drives the current service catalog shown in registration and lookup flows.</div>
            </div>

            <div className="festival-list">
              {festivals.length ? (
                festivals.map((festival) => (
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
                ))
              ) : (
                <div className="empty-state">{festivalsLoading ? "Loading festivals..." : "No festivals have been created yet."}</div>
              )}
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
                            <button type="button" className="danger-button" onClick={() => deleteServiceRow(row)}>
                              Delete
                            </button>
                          </div>
                        </div>
                        <div className="service-row-grid">
                          <label className="field">
                            <span>Service Name</span>
                            <input
                              value={row.serviceName || ""}
                              onChange={(event) => updateServiceRow(row._clientId, "serviceName", event.target.value)}
                              placeholder="Prasadam Distribution"
                            />
                          </label>
                          <label className="field">
                            <span>Coordinator Name</span>
                            <input
                              value={row.coordinatorName || ""}
                              onChange={(event) => updateServiceRow(row._clientId, "coordinatorName", event.target.value)}
                              placeholder="Coordinator name"
                            />
                          </label>
                          <label className="field">
                            <span>Coordinator Number</span>
                            <input
                              value={row.coordinatorContactNumber || ""}
                              onChange={(event) => updateServiceRow(row._clientId, "coordinatorContactNumber", event.target.value)}
                              placeholder="10-digit number"
                            />
                          </label>
                          <label className="field">
                            <span>Coordinator Photo</span>
                            <input
                              value={row.coordinatorPhotoLink || ""}
                              onChange={(event) => updateServiceRow(row._clientId, "coordinatorPhotoLink", event.target.value)}
                              placeholder="Google Drive or image URL"
                            />
                          </label>
                          <label className="field">
                            <span>Required Volunteers</span>
                            <input
                              type="number"
                              min="0"
                              value={row.volunteersRequired ?? 0}
                              onChange={(event) => updateServiceRow(row._clientId, "volunteersRequired", event.target.value)}
                            />
                          </label>
                          <label className="field">
                            <span>Active</span>
                            <select
                              value={row.active ? "yes" : "no"}
                              onChange={(event) => updateServiceRow(row._clientId, "active", event.target.value === "yes")}
                            >
                              <option value="yes">Yes</option>
                              <option value="no">No</option>
                            </select>
                          </label>
                        </div>
                        <div className="row-actions master-actions">
                          <button type="button" onClick={() => saveServiceRow(row)} disabled={busy}>
                            {busy ? "Saving..." : "Save Service"}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="empty-state">
                  {festivalServiceLoading ? "Loading services..." : "No services have been added for this festival yet."}
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

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
            <h2>Bahuda Registration Activity</h2>
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
          <div className="empty-state">
            {registrationLoading ? "Loading registration activity..." : "No registration activity captured yet."}
          </div>
        )}
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

  let data = null;
  try {
    data = await response.json();
  } catch {
    throw new Error("Backend returned non-JSON response");
  }

  if (!response.ok || data.ok === false) {
    throw new Error(data.error || "Request failed");
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
