"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";

const EVENT_TITLE = "Jagannatha Bahuda Ratha Yatra";
const EVENT_DETAILS = "24th July 2026, 4 PM onwards · Sri Vaibhava Venkateswara Swamy Temple, Madhavadhara";
const EVENT_NOTE = "Pre-register now so your volunteer details are ready before the event day.";
const FIELD_ORDER = ["name", "gender", "age", "occupation", "areaOfStay"];

const FIELD_CONFIG = {
  name: { label: "Name", type: "text", placeholder: "Volunteer name" },
  gender: { label: "Gender", type: "text", placeholder: "Gender" },
  age: { label: "Age", type: "number", placeholder: "Age" },
  occupation: { label: "College / Working", type: "text", placeholder: "College or working" },
  areaOfStay: { label: "Area of Stay", type: "text", placeholder: "Area of stay" }
};

const emptyLookup = {
  found: false,
  complete: false,
  allocated: false,
  missingFields: [],
  volunteer: null
};

export default function VolunteerRegistrationForm() {
  const [mobile, setMobile] = useState("");
  const [searching, setSearching] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [lookup, setLookup] = useState(emptyLookup);
  const [form, setForm] = useState({
    name: "",
    gender: "",
    age: "",
    occupation: "",
    areaOfStay: ""
  });

  useEffect(() => {
    document.title = `${EVENT_TITLE} - Pre Registration`;
  }, []);

  const missingFields = useMemo(() => lookup.missingFields || [], [lookup.missingFields]);
  const visibleFields = lookup.found ? missingFields : FIELD_ORDER;
  const isComplete = Boolean(lookup.found && lookup.complete);

  function normalizeMobile(value) {
    const digits = String(value || "").replace(/\D/g, "");
    if (!digits) return "";
    if (digits.length === 12 && digits.startsWith("91")) return digits.slice(-10);
    if (digits.length > 10) return digits.slice(-10);
    return digits;
  }

  function escapeHtml(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  async function readJsonResponse(response) {
    const text = await response.text();
    try {
      return JSON.parse(text);
    } catch {
      throw new Error(text?.startsWith("<!DOCTYPE") ? "Backend returned HTML instead of JSON" : text || "Backend returned an invalid response");
    }
  }

  function resetAll(nextMobile = "") {
    setMobile(nextMobile);
    setSearching(false);
    setSaving(false);
    setMessage("");
    setLookup(emptyLookup);
    setForm({
      name: "",
      gender: "",
      age: "",
      occupation: "",
      areaOfStay: ""
    });
  }

  function seedFormFromVolunteer(volunteer) {
    setForm({
      name: String(volunteer?.name || ""),
      gender: String(volunteer?.gender || ""),
      age: volunteer?.age === null || volunteer?.age === undefined || volunteer?.age === "" ? "" : String(volunteer.age),
      occupation: String(volunteer?.occupation || volunteer?.collegeWorking || ""),
      areaOfStay: String(volunteer?.areaOfStay || "")
    });
  }

  async function searchVolunteer(event) {
    event.preventDefault();
    const normalized = normalizeMobile(mobile);
    if (normalized.length !== 10) {
      setMessage("Please enter a valid mobile number.");
      return;
    }

    setSearching(true);
    setMessage("Searching...");
    try {
      const response = await fetch("/api/bridge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "volunteers.search",
          mobile: normalized,
          markAttendance: false
        })
      });
      const payload = await readJsonResponse(response);
      if (!response.ok || payload.ok === false) {
        throw new Error(payload.error || "Could not search this mobile number");
      }

      const result = payload.data || emptyLookup;
      setLookup(result);
      setMobile(normalized);
      seedFormFromVolunteer(result.volunteer);

      if (!result.found) {
        setMessage("Mobile number not found. Please complete the registration form below.");
      } else if (result.complete) {
        setMessage("You have already registered for the services.");
      } else {
        const missingLabels = (result.missingFields || []).map((field) => FIELD_CONFIG[field]?.label || field);
        setMessage(`Please complete your registration. Missing fields: ${missingLabels.join(", ")}.`);
      }
    } catch (error) {
      setLookup(emptyLookup);
      setMessage(error.message || "Could not search this mobile number");
    } finally {
      setSearching(false);
    }
  }

  function mergePayloadFromCurrentState() {
    const volunteer = lookup.volunteer || {};
    return {
      mobileNumber: normalizeMobile(mobile),
      name: form.name || volunteer.name || "",
      gender: form.gender || volunteer.gender || "",
      age: form.age || volunteer.age || "",
      collegeWorking: form.occupation || volunteer.occupation || volunteer.collegeWorking || "",
      areaOfStay: form.areaOfStay || volunteer.areaOfStay || ""
    };
  }

  async function submitRegistration(event) {
    event.preventDefault();
    const normalized = normalizeMobile(mobile);
    if (normalized.length !== 10) {
      setMessage("Please search a valid mobile number first.");
      return;
    }

    const required = lookup.found ? missingFields : FIELD_ORDER;
    const payload = mergePayloadFromCurrentState();
    const missingNow = required.filter((field) => {
      if (field === "name") return !String(payload.name || "").trim();
      if (field === "gender") return !String(payload.gender || "").trim();
      if (field === "age") return !String(payload.age || "").trim();
      if (field === "occupation") return !String(payload.collegeWorking || "").trim();
      if (field === "areaOfStay") return !String(payload.areaOfStay || "").trim();
      return false;
    });
    if (missingNow.length) {
      setMessage(`Please fill: ${missingNow.map((field) => FIELD_CONFIG[field]?.label || field).join(", ")}`);
      return;
    }

    setSaving(true);
    setMessage("Saving registration...");
    try {
      const response = await fetch("/api/bridge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "volunteers.upsert",
          ...payload,
          markAttendance: false
        })
      });
      const result = await readJsonResponse(response);
      if (!response.ok || result.ok === false) {
        throw new Error(result.error || "Could not save registration");
      }

      setLookup({
        found: true,
        complete: true,
        allocated: Boolean(result.data?.allocated),
        missingFields: [],
        volunteer: result.data?.volunteer || null
      });
      seedFormFromVolunteer(result.data?.volunteer);
      setMessage("Registration successful. Thank you for pre-registering for the volunteer services.");
    } catch (error) {
      setMessage(error.message || "Could not save registration");
    } finally {
      setSaving(false);
    }
  }

  const existingRows = lookup.volunteer ? [
    { label: "Name", value: lookup.volunteer.name },
    { label: "Gender", value: lookup.volunteer.gender },
    { label: "Age", value: lookup.volunteer.age },
    { label: "College / Working", value: lookup.volunteer.occupation || lookup.volunteer.collegeWorking },
    { label: "Area of Stay", value: lookup.volunteer.areaOfStay },
    { label: "Allocated Service", value: lookup.volunteer.allocatedServiceName || "-" }
  ] : [];

  return (
    <main className="page-shell">
      <header className="topbar">
        <div>
          <p className="eyebrow">Volunteer Allocation System</p>
          <h1>Volunteer Pre Registration</h1>
          <p className="subtle">{EVENT_DETAILS}</p>
        </div>
        <nav className="topnav">
          <Link href="/">Home</Link>
          <Link href="/lookup">Day-of Lookup</Link>
          <Link href="/dashboard">Dashboard</Link>
        </nav>
      </header>

      <section className="hero registration-hero">
        <p className="eyebrow">{EVENT_TITLE}</p>
        <h1>Pre-register volunteer details</h1>
        <p className="hero-copy">
          Mobile-first registration for the Bahuda Ratha Yatra volunteer list.
          Search your number first, complete only the missing details, and save your profile in Supabase.
        </p>
      </section>

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
              }}
            />
          </label>
          <div className="actions">
            <button type="submit" disabled={searching}>{searching ? "Searching..." : "Search"}</button>
            <button type="button" className="home-button" onClick={() => resetAll("")}>Reset</button>
          </div>
        </form>
      </section>

      {message ? <section className="notice">{message}</section> : null}

      <section className="panel">
        {lookup.found && lookup.volunteer ? (
          <div className="stack">
            <div className="service-card">
              <h2>{isComplete ? "You have already registered" : "Existing details found"}</h2>
              <div className="summary-grid registration-summary">
                <div><span>Mobile Number</span><strong>{lookup.volunteer.mobileNumber || mobile || "-"}</strong></div>
                {existingRows.map((row) => (
                  <div key={row.label}>
                    <span>{row.label}</span>
                    <strong>{row.value || "-"}</strong>
                  </div>
                ))}
              </div>
            </div>

            {!isComplete ? (
              <form className="form-grid" onSubmit={submitRegistration}>
                {visibleFields.map((field) => {
                  const config = FIELD_CONFIG[field];
                  if (!config) return null;
                  return (
                    <label className={`field ${field === "areaOfStay" ? "wide" : ""}`} key={field}>
                      <span>{config.label}</span>
                      {field === "gender" ? (
                        <select
                          value={form.gender}
                          onChange={(event) => setForm((current) => ({ ...current, gender: event.target.value }))}
                        >
                          <option value="">Select gender</option>
                          <option value="Male">Male</option>
                          <option value="Female">Female</option>
                          <option value="Other">Other</option>
                        </select>
                      ) : (
                        <input
                          type={config.type}
                          value={form[field === "occupation" ? "occupation" : field]}
                          onChange={(event) => setForm((current) => ({
                            ...current,
                            [field === "occupation" ? "occupation" : field]: event.target.value
                          }))}
                          placeholder={config.placeholder}
                        />
                      )}
                    </label>
                  );
                })}
                <div className="actions wide">
                  <button type="submit" disabled={saving}>{saving ? "Saving..." : "Submit Registration"}</button>
                </div>
              </form>
            ) : null}
          </div>
        ) : lookup.found === false && mobile ? (
          <form className="form-grid" onSubmit={submitRegistration}>
            {FIELD_ORDER.map((field) => {
              const config = FIELD_CONFIG[field];
              return (
                <label className={`field ${field === "areaOfStay" ? "wide" : ""}`} key={field}>
                  <span>{config.label}</span>
                  {field === "gender" ? (
                    <select
                      value={form.gender}
                      onChange={(event) => setForm((current) => ({ ...current, gender: event.target.value }))}
                    >
                      <option value="">Select gender</option>
                      <option value="Male">Male</option>
                      <option value="Female">Female</option>
                      <option value="Other">Other</option>
                    </select>
                  ) : (
                    <input
                      type={config.type}
                      value={form[field === "occupation" ? "occupation" : field]}
                      onChange={(event) => setForm((current) => ({
                        ...current,
                        [field === "occupation" ? "occupation" : field]: event.target.value
                      }))}
                      placeholder={config.placeholder}
                    />
                  )}
                </label>
              );
            })}
            <div className="actions wide">
              <button type="submit" disabled={saving}>{saving ? "Saving..." : "Submit Registration"}</button>
            </div>
          </form>
        ) : (
          <div className="empty-state">
            <p>Search a mobile number to start the pre-registration flow.</p>
          </div>
        )}
      </section>

      <section className="panel">
        <div className="panel-head">
          <h2>Event Details</h2>
        </div>
        <div className="summary-grid registration-summary">
          <div><span>Event</span><strong>{EVENT_TITLE}</strong></div>
          <div><span>Schedule</span><strong>{EVENT_DETAILS}</strong></div>
          <div><span>Note</span><strong>{EVENT_NOTE}</strong></div>
        </div>
      </section>
    </main>
  );
}
