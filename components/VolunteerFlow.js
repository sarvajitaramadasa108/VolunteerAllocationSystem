"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";

const emptySearchResult = {
  found: false,
  allocated: false,
  volunteer: null,
  serviceDetails: null
};

export default function VolunteerFlow({ mode, title, intro, actionLabel, successLabel }) {
  const [services, setServices] = useState([]);
  const [mobile, setMobile] = useState("");
  const [searching, setSearching] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [searchResult, setSearchResult] = useState(emptySearchResult);
  const [lookupSearched, setLookupSearched] = useState(false);
  const [form, setForm] = useState({
    name: "",
    age: "",
    gender: "",
    occupation: "",
    areaOfStay: "",
    service: ""
  });
  const canAllocate = mode === "allocate";
  const showRegistrationForm = canAllocate && (searchResult.found || (!searchResult.found && mobile));

  useEffect(() => {
    void loadServices();
  }, []);

  async function loadServices() {
    try {
      const response = await fetch("/api/bridge?action=services.list", { cache: "no-store" });
      const data = await response.json();
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
        body: JSON.stringify({ action: "volunteers.search", mobile: normalized })
      });
      const payload = await response.json();
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
      if (payload.data?.found) {
        setMessage(payload.data.allocated ? "Volunteer found" : "You have not been allocated any service yet.");
      } else {
        setMessage("Mobile number not found. Please register the volunteer.");
      }
    } catch (error) {
      setMessage(error.message || "Could not search this mobile number");
      setSearchResult(emptySearchResult);
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
        service: form.service
      };

      const response = await fetch("/api/bridge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      const data = await response.json();
      if (!response.ok || data.ok === false) throw new Error(data.error || "Save failed");

      setMessage(`${successLabel} for ${normalized}`);
      setMobile("");
      setSearchResult(emptySearchResult);
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

  const selectedService = useMemo(
    () => services.find((item) => item.serviceName === form.service) || null,
    [services, form.service]
  );

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
                if (mode === "lookup") {
                  setLookupSearched(false);
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
                {searchResult.allocated ? (
                  <div className="service-card">
                    <h2>Your Allocated Service</h2>
                    <div className="service-grid service-grid-single">
                      <div><span>Your Allocated Service</span><strong>{searchResult.volunteer?.allocatedService || "-"}</strong></div>
                      <div><span>Your Service Coordinator Name</span><strong>{searchResult.serviceDetails?.coordinatorName || "-"}</strong></div>
                      <div><span>Your Service Coordinator Contact Number</span><strong>{searchResult.serviceDetails?.contactNumber || "-"}</strong></div>
                      <div><span>Your Service Reporting Time</span><strong>{searchResult.serviceDetails?.reportingTime || "-"}</strong></div>
                    </div>
                  </div>
                ) : (
                  <div className="notice">You have not been allocated any service yet. Please report at Service allocation desk.</div>
                )}
              </>
            ) : lookupSearched && !searching ? (
              <div className="stack">
                <div className="notice">Mobile number not found. Please register first.</div>
              </div>
            ) : (
              <div className="empty-state">
                <p>Search a mobile number to view your allocation.</p>
              </div>
            )}
          </div>
        ) : showRegistrationForm ? (
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
