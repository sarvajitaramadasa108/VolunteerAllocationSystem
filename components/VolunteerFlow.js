"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";

const emptySearchResult = {
  found: false,
  allocated: false,
  volunteer: null,
  serviceDetails: null
};

const tshirtServiceNames = new Set([
  "VIP Hospitality",
  "Ratha entourage",
  "Prasadam Distribution along the way",
  "Ratha coordinating"
]);

function buildDriveImageUrl(link) {
  const value = String(link || "").trim();
  if (!value) return "";
  if (/^https?:\/\//i.test(value) && value.includes("drive.google.com")) {
    const fileIdMatch = value.match(/\/d\/([a-zA-Z0-9_-]+)/) || value.match(/[?&]id=([a-zA-Z0-9_-]+)/);
    if (fileIdMatch && fileIdMatch[1]) {
      return `https://drive.google.com/thumbnail?id=${fileIdMatch[1]}&sz=w320`;
    }
  }
  return value;
}

async function readJsonResponse(response) {
  const text = await response.text();
  try {
    return JSON.parse(text);
  } catch {
    throw new Error(text?.startsWith("<!DOCTYPE") ? "Backend returned HTML instead of JSON" : text || "Backend returned an invalid response");
  }
}

export default function VolunteerFlow({ mode, title, intro, actionLabel, successLabel }) {
  const [services, setServices] = useState([]);
  const [mobile, setMobile] = useState("");
  const [searching, setSearching] = useState(false);
  const [saving, setSaving] = useState(false);
  const [tshirtSaving, setTshirtSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [searchResult, setSearchResult] = useState(emptySearchResult);
  const [lookupSearched, setLookupSearched] = useState(false);
  const [lookupStage, setLookupStage] = useState("idle");
  const [lookupServiceSelection, setLookupServiceSelection] = useState("");
  const [lookupServiceConfirmed, setLookupServiceConfirmed] = useState("");
  const [tshirtChecked, setTshirtChecked] = useState(false);
  const [form, setForm] = useState({
    name: "",
    age: "",
    gender: "",
    occupation: "",
    areaOfStay: "",
    service: ""
  });

  const canAllocate = mode === "allocate";
  const showAllocationForm = canAllocate && (searchResult.found || (!searchResult.found && mobile));
  const selectedService = useMemo(
    () => services.find((item) => item.serviceName === form.service) || null,
    [services, form.service]
  );
  const actualOrChosenService = searchResult.allocated
    ? searchResult.volunteer?.allocatedService || ""
    : lookupServiceConfirmed || "";
  const actualOrChosenServiceDetails = useMemo(
    () => services.find((service) => service.serviceName === actualOrChosenService) || null,
    [services, actualOrChosenService]
  );
  const tshirtEligible = tshirtServiceNames.has(String(actualOrChosenService || "").trim());
  const tshirtAlreadyMarked = String(searchResult.volunteer?.tshirt || "").trim().toLowerCase() === "yes";
  const showLookupRegistrationForm = mode === "lookup" && lookupStage === "needsRegistration" && !searching;
  const showLookupServiceChooser = mode === "lookup" && (lookupStage === "needsService" || lookupStage === "registered");
  const showLookupTshirtCard = mode === "lookup" && tshirtEligible && !tshirtAlreadyMarked && (
    searchResult.allocated || lookupStage === "serviceChosen" || lookupStage === "allocated"
  );
  const showLookupDetails = mode === "lookup" && (
    (searchResult.allocated && (!tshirtEligible || tshirtAlreadyMarked)) ||
    (lookupStage === "serviceChosen" && (!tshirtEligible || tshirtChecked))
  );

  useEffect(() => {
    void loadServices();
  }, []);

  async function loadServices() {
    try {
      const response = await fetch("/api/bridge?action=services.list", { cache: "no-store" });
      const data = await readJsonResponse(response);
      setServices(Array.isArray(data.data) ? data.data : []);
    } catch {
      setServices([]);
    }
  }

  function normalizeMobile(value) {
    const digits = String(value || "").replace(/\D/g, "");
    if (!digits) return "";
    if (digits.length === 12 && digits.startsWith("91")) return digits.slice(-10);
    if (digits.length > 10) return digits.slice(-10);
    return digits;
  }

  function resetLookupState(nextMobile = "") {
    setMobile(nextMobile);
    setLookupSearched(false);
    setLookupStage("idle");
    setLookupServiceSelection("");
    setLookupServiceConfirmed("");
    setTshirtChecked(false);
    setSearchResult(emptySearchResult);
  }

  async function searchVolunteer(event) {
    event.preventDefault();
    const normalized = normalizeMobile(mobile);
    if (!normalized) {
      setMessage("Enter a mobile number");
      return;
    }
    setLookupSearched(true);
    setSearching(true);
    setMessage("");
    try {
      const response = await fetch("/api/bridge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "volunteers.search", mobile: normalized, markAttendance: mode === "lookup" })
      });
      const payload = await readJsonResponse(response);
      if (!response.ok || payload.ok === false) throw new Error(payload.error || "Search failed");
      setSearchResult(payload.data || emptySearchResult);
      setForm((current) => ({
        ...current,
        name: payload.data?.volunteer?.name || "",
        age: payload.data?.volunteer?.age || "",
        gender: payload.data?.volunteer?.gender || "",
        occupation: payload.data?.volunteer?.occupation || "",
        areaOfStay: payload.data?.volunteer?.areaOfStay || "",
        service: payload.data?.volunteer?.allocatedService || ""
      }));
      setTshirtChecked(String(payload.data?.volunteer?.tshirt || "").trim().toLowerCase() === "yes");
      if (payload.data?.found) {
        setLookupStage(payload.data.allocated ? "allocated" : "needsService");
        setLookupServiceSelection(payload.data?.volunteer?.allocatedService || "");
        setLookupServiceConfirmed(payload.data.allocated ? payload.data?.volunteer?.allocatedService || "" : "");
        setMessage(payload.data.allocated ? "Volunteer found" : "You have not been allocated any service yet. Please report at Service allocation desk.");
      } else {
        setLookupStage("needsRegistration");
        setLookupServiceSelection("");
        setLookupServiceConfirmed("");
        setTshirtChecked(false);
        setForm({
          name: "",
          age: "",
          gender: "",
          occupation: "",
          areaOfStay: "",
          service: ""
        });
        setMessage("Mobile number not found. Please register the volunteer using the form below.");
      }
    } catch (error) {
      setMessage(error.message || "Could not search this mobile number");
      setSearchResult(emptySearchResult);
      setLookupStage("idle");
    } finally {
      setSearching(false);
    }
  }

  async function submitAllocation(event) {
    event.preventDefault();
    const normalized = normalizeMobile(mobile);
    if (!normalized) {
      setMessage("Enter a mobile number");
      return;
    }
    if (mode === "allocate" && !form.service) {
      setMessage("Please select a service to allocate");
      return;
    }

    setSaving(true);
    setMessage("");
    try {
      const payload = {
        action: searchResult.found ? "volunteers.allocate" : "volunteers.upsert",
        mobile: normalized,
        name: form.name,
        age: form.age,
        gender: form.gender,
        occupation: form.occupation,
        areaOfStay: form.areaOfStay,
        service: form.service,
        markAttendance: mode === "lookup"
      };

      const response = await fetch("/api/bridge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      const data = await readJsonResponse(response);
      if (!response.ok || data.ok === false) throw new Error(data.error || "Save failed");

      setMessage(
        mode === "lookup" && !searchResult.found
          ? "Registration successful. Please report at the desk for service allocation."
          : `${successLabel} for ${normalized}`
      );

      if (mode === "lookup" && !searchResult.found) {
        setLookupStage("registered");
        setSearchResult({
          found: true,
          allocated: false,
          volunteer: {
            name: form.name,
            age: form.age,
            gender: form.gender,
            occupation: form.occupation,
            areaOfStay: form.areaOfStay,
            mobile: normalized,
            allocatedService: "",
            tshirt: ""
          },
          serviceDetails: null
        });
        setLookupServiceSelection("");
        setLookupServiceConfirmed("");
        setTshirtChecked(false);
      } else {
        resetLookupState("");
      }

      setForm({
        name: "",
        age: "",
        gender: "",
        occupation: "",
        areaOfStay: "",
        service: ""
      });
    } catch (error) {
      setMessage(error.message || "Could not save this volunteer");
    } finally {
      setSaving(false);
    }
  }

  async function confirmServiceSelection() {
    const selected = String(lookupServiceSelection || "").trim();
    if (!selected) {
      setMessage("Please select your assigned service");
      return;
    }
    setLookupServiceConfirmed(selected);
    setLookupStage("serviceChosen");
    setTshirtChecked(false);
    setMessage("");
  }

  async function confirmTshirtCollection() {
    const tshirtMobile = normalizeMobile(mobile);
    if (!tshirtMobile) {
      setMessage("Enter a mobile number");
      return;
    }
    if (!tshirtEligible) {
      setMessage("Select an eligible service first");
      return;
    }
    if (!tshirtChecked) {
      setMessage("Please tick the box after collection");
      return;
    }

    setTshirtSaving(true);
    setMessage("");
    try {
      const response = await fetch("/api/bridge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "volunteers.tshirt", mobile: tshirtMobile, tShirt: "Yes" })
      });
      const payload = await readJsonResponse(response);
      if (!response.ok || payload.ok === false) throw new Error(payload.error || "Could not update T Shirt status");
      setSearchResult((current) => ({
        ...current,
        volunteer: current.volunteer ? { ...current.volunteer, tshirt: "Yes" } : current.volunteer
      }));
      setTshirtChecked(true);
      setMessage("T Shirt marked as collected.");
    } catch (error) {
      setMessage(error.message || "Could not update T Shirt status");
    } finally {
      setTshirtSaving(false);
    }
  }

  return (
    <main className="page-shell">
      <header className="topbar">
        <div>
          <p className="eyebrow">Volunteer Allocation System</p>
          <h1>{title}</h1>
          <p className="subtle">{intro}</p>
        </div>
        <nav className="topnav">
          {mode === "allocate" ? <Link href="/">Home</Link> : null}
          {mode === "allocate" ? <Link href="/allocate">Allocate</Link> : null}
          {mode === "allocate" ? <Link href="/lookup">Lookup</Link> : null}
        </nav>
      </header>

      <section className="panel">
        <form className="form-grid" onSubmit={searchVolunteer}>
          <label className="field wide">
            <span>Mobile Number</span>
            <input
              type="tel"
              inputMode="numeric"
              placeholder="Enter mobile number"
              value={mobile}
              onChange={(event) => {
                setMobile(event.target.value);
                setMessage("");
                setSearchResult(emptySearchResult);
                setLookupServiceSelection("");
                setLookupServiceConfirmed("");
                setTshirtChecked(false);
                if (mode === "lookup") {
                  setLookupSearched(false);
                  setLookupStage("idle");
                }
              }}
            />
          </label>
          <div className="actions">
            <button type="submit" disabled={searching}>{searching ? "Searching..." : "Search"}</button>
          </div>
        </form>
      </section>

      {message ? <section className="notice">{message}</section> : null}

      <section className="panel">
        {mode === "lookup" ? (
          <div className="stack">
            {searching ? (
              <div className="notice">Searching...</div>
            ) : searchResult.found ? (
              <>
                <div className="lookup-greeting">
                  <h2>Hare Krishna {searchResult.volunteer?.name || ""}</h2>
                </div>

                {showLookupTshirtCard ? (
                  <div className="service-card tshirt-card">
                    <h2>T Shirt Collection</h2>
                    <p className="subtle-dark">Please collect the T Shirt from the Volunteer Reception Desk and tick the box after collection.</p>
                    <label className="tshirt-check">
                      <input
                        type="checkbox"
                        checked={tshirtChecked}
                        onChange={(event) => setTshirtChecked(event.target.checked)}
                      />
                      <span>I have collected my T Shirt</span>
                    </label>
                    <button type="button" onClick={confirmTshirtCollection} disabled={tshirtSaving || !tshirtChecked}>
                      {tshirtSaving ? "Updating..." : "Confirm T Shirt Collection"}
                    </button>
                  </div>
                ) : null}

                {showLookupDetails ? (
                  <div className="service-card">
                    <h2>Your Allocated Service</h2>
                    <div className="service-grid service-grid-single lookup-service-grid">
                      <div><span>Your Allocated Service</span><strong>{actualOrChosenService || "-"}</strong></div>
                      <div className="coordinator-card">
                        <span>Your Service Coordinator Name</span>
                        <div className="coordinator-profile">
                          <div className="coordinator-photo-wrap">
                            {actualOrChosenServiceDetails?.photoUrl ? (
                              <img
                                className="coordinator-photo"
                                src={buildDriveImageUrl(actualOrChosenServiceDetails.photoUrl)}
                                alt={actualOrChosenServiceDetails?.coordinatorName || "Coordinator photo"}
                              />
                            ) : (
                              <div className="coordinator-photo coordinator-photo-placeholder">No Photo</div>
                            )}
                          </div>
                          <strong>{actualOrChosenServiceDetails?.coordinatorName || "-"}</strong>
                        </div>
                      </div>
                      <div><span>Your Service Coordinator Contact Number</span><strong>{actualOrChosenServiceDetails?.contactNumber || "-"}</strong></div>
                      <div><span>Your Service Reporting Time</span><strong>{actualOrChosenServiceDetails?.reportingTime || "-"}</strong></div>
                    </div>
                  </div>
                ) : null}

                {!searchResult.allocated ? (
                  <div className="stack">
                    <div className="notice">You have not been allocated any service yet. Please report at Service allocation desk.</div>
                    {showLookupServiceChooser ? (
                      <div className="service-card tshirt-card">
                        <h2>After Allocation, Select Your Service</h2>
                        <p className="subtle-dark">Choose the service you receive at the allocation desk, then continue.</p>
                        <label className="field wide">
                          <span>Assigned Service</span>
                          <select
                            value={lookupServiceSelection}
                            onChange={(event) => {
                              setLookupServiceSelection(event.target.value);
                              setLookupServiceConfirmed("");
                              setTshirtChecked(false);
                            }}
                          >
                            <option value="">Select service</option>
                            {services.map((service) => (
                              <option key={service.serviceName} value={service.serviceName}>
                                {service.serviceName}
                              </option>
                            ))}
                          </select>
                        </label>
                        <button type="button" onClick={confirmServiceSelection}>
                          Continue
                        </button>
                      </div>
                    ) : null}
                  </div>
                ) : null}
              </>
            ) : showLookupRegistrationForm ? (
              <div className="stack">
                <div className="notice">Mobile number not found. Please register the volunteer using the form below.</div>
                <form className="form-grid" onSubmit={submitAllocation}>
                  <div className="field wide">
                    <span>Mobile Number</span>
                    <div className="readonly-value">{mobile || "-"}</div>
                  </div>
                  <label className="field wide">
                    <span>Name</span>
                    <input value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} placeholder="Volunteer name" />
                  </label>
                  <label className="field">
                    <span>Age</span>
                    <input value={form.age} onChange={(event) => setForm((current) => ({ ...current, age: event.target.value }))} placeholder="Age" />
                  </label>
                  <label className="field">
                    <span>Gender</span>
                    <input value={form.gender} onChange={(event) => setForm((current) => ({ ...current, gender: event.target.value }))} placeholder="Gender" />
                  </label>
                  <label className="field wide">
                    <span>College / Working</span>
                    <input value={form.occupation} onChange={(event) => setForm((current) => ({ ...current, occupation: event.target.value }))} placeholder="College or working" />
                  </label>
                  <label className="field wide">
                    <span>Area of Stay</span>
                    <input value={form.areaOfStay} onChange={(event) => setForm((current) => ({ ...current, areaOfStay: event.target.value }))} placeholder="Area of stay" />
                  </label>
                  <div className="actions wide">
                    <button type="submit" disabled={saving}>{saving ? "Saving..." : "Register Volunteer"}</button>
                  </div>
                </form>
                {showLookupServiceChooser ? (
                  <div className="service-card tshirt-card">
                    <h2>After Allocation, Select Your Service</h2>
                    <p className="subtle-dark">Choose the service you receive at the allocation desk, then continue.</p>
                    <label className="field wide">
                      <span>Assigned Service</span>
                      <select
                        value={lookupServiceSelection}
                        onChange={(event) => {
                          setLookupServiceSelection(event.target.value);
                          setLookupServiceConfirmed("");
                          setTshirtChecked(false);
                        }}
                      >
                        <option value="">Select service</option>
                        {services.map((service) => (
                          <option key={service.serviceName} value={service.serviceName}>
                            {service.serviceName}
                          </option>
                        ))}
                      </select>
                    </label>
                    <button type="button" onClick={confirmServiceSelection}>
                      Continue
                    </button>
                  </div>
                ) : null}
              </div>
            ) : (
              <div className="empty-state">
                <p>Search a mobile number to view your allocation.</p>
              </div>
            )}
          </div>
        ) : showAllocationForm ? (
          <div className="stack">
            {searching ? (
              <div className="notice">Searching...</div>
            ) : searchResult.found ? (
              <div className="notice">Volunteer found. Edit the fields below and save the service allocation.</div>
            ) : lookupSearched && !searching ? (
              <div className="notice">Mobile number not found. Please register the volunteer using the form below.</div>
            ) : null}
            <form className="form-grid" onSubmit={submitAllocation}>
              <label className="field wide">
                <span>Name</span>
                <input value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} placeholder="Volunteer name" />
              </label>
              <label className="field">
                <span>Age</span>
                <input value={form.age} onChange={(event) => setForm((current) => ({ ...current, age: event.target.value }))} placeholder="Age" />
              </label>
              <label className="field">
                <span>Gender</span>
                <input value={form.gender} onChange={(event) => setForm((current) => ({ ...current, gender: event.target.value }))} placeholder="Gender" />
              </label>
              <label className="field wide">
                <span>College / Working</span>
                <input value={form.occupation} onChange={(event) => setForm((current) => ({ ...current, occupation: event.target.value }))} placeholder="College or working" />
              </label>
              <label className="field wide">
                <span>Area of Stay</span>
                <input value={form.areaOfStay} onChange={(event) => setForm((current) => ({ ...current, areaOfStay: event.target.value }))} placeholder="Area of stay" />
              </label>
              <label className="field wide">
                <span>Please Allocate Service</span>
                <select value={form.service} onChange={(event) => setForm((current) => ({ ...current, service: event.target.value }))}>
                  <option value="">Select a service</option>
                  {services.map((service) => (
                    <option key={service.serviceName} value={service.serviceName}>
                      {service.serviceName}
                    </option>
                  ))}
                </select>
              </label>
              {selectedService ? (
                <div className="hint wide">
                  Coordinator: {selectedService.coordinatorName || "-"} | Contact: {selectedService.contactNumber || "-"} | Time: {selectedService.reportingTime || "-"}
                </div>
              ) : null}
              <div className="actions wide">
                <button type="submit" disabled={saving}>{saving ? "Saving..." : actionLabel}</button>
              </div>
            </form>
          </div>
        ) : (
          <div className="empty-state">
            <p>Search a mobile number to view details or register a new volunteer.</p>
          </div>
        )}
      </section>
    </main>
  );
}
