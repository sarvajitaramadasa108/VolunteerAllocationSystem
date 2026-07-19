"use client";

import { useEffect, useMemo, useState } from "react";

const EVENT_TITLE = "Volunteer Service Registrations for Sri Jagannath Bahuda Rathayatra";
const EVENT_DATE = "24th July 2026, 4 PM Onwards";
const EVENT_VENUE = "Sri Vaibhava Venkateswara Swamy Temple, Madhavadhara";
const EVENT_THANK_YOU = "Thank you for registering,Please report at 3pm at the volunteer reception at the venue on the event date to know your allocated service.";

const fieldOrder = ["name", "gender", "age", "occupation", "areaOfStay"];
const fieldConfig = {
  name: { label: "Name", type: "text", placeholder: "Volunteer name" },
  gender: { label: "Gender", type: "text", placeholder: "Gender" },
  age: { label: "Age", type: "number", placeholder: "Age" },
  occupation: { label: "College / Working", type: "text", placeholder: "College or working" },
  areaOfStay: { label: "Area of Stay", type: "text", placeholder: "Area of stay" }
};

const emptyLookup = {
  found: false,
  complete: false,
  missingFields: [],
  registration: null
};

function normalizeMobile(value) {
  const digits = String(value || "").replace(/\D/g, "");
  if (!digits) return "";
  if (digits.length === 12 && digits.startsWith("91")) return digits.slice(-10);
  if (digits.length > 10) return digits.slice(-10);
  return digits;
}

async function readJsonResponse(response) {
  const text = await response.text();
  try {
    return JSON.parse(text);
  } catch {
    throw new Error(text?.startsWith("<!DOCTYPE") ? "Backend returned HTML instead of JSON" : text || "Backend returned an invalid response");
  }
}

function emptyForm() {
  return {
    name: "",
    gender: "",
    age: "",
    occupation: "",
    areaOfStay: ""
  };
}

export default function VolunteerRegistrationForm() {
  const [mobile, setMobile] = useState("");
  const [searching, setSearching] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [lookup, setLookup] = useState(emptyLookup);
  const [form, setForm] = useState(emptyForm());
  const [registrationComplete, setRegistrationComplete] = useState(false);

  useEffect(() => {
    document.title = EVENT_TITLE;
  }, []);

  const missingFields = useMemo(() => lookup.missingFields || [], [lookup.missingFields]);
  const visibleFields = lookup.found ? missingFields : fieldOrder;
  const isComplete = Boolean(lookup.found && lookup.complete);
  const showForm = !registrationComplete && (!lookup.found || !isComplete);

  function clearCurrentResult(nextMobile = "") {
    setMobile(nextMobile);
    setSearching(false);
    setSaving(false);
    setMessage("");
    setLookup(emptyLookup);
    setForm(emptyForm());
    setRegistrationComplete(false);
  }

  function seedFormFromRegistration(registration) {
    setForm({
      name: String(registration?.name || ""),
      gender: String(registration?.gender || ""),
      age: registration?.age === null || registration?.age === undefined || registration?.age === "" ? "" : String(registration.age),
      occupation: String(registration?.occupation || ""),
      areaOfStay: String(registration?.areaOfStay || "")
    });
  }

  async function searchRegistration(event) {
    event.preventDefault();
    const normalized = normalizeMobile(mobile);
    if (normalized.length !== 10) {
      setMessage("Please enter a valid mobile number.");
      return;
    }

    setSearching(true);
    setRegistrationComplete(false);
    setMessage("Searching...");
    try {
      const response = await fetch("/api/bridge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "bahudaRegistrations.lookup",
          mobile: normalized
        })
      });
      const payload = await readJsonResponse(response);
      if (!response.ok || payload.ok === false) {
        throw new Error(payload.error || "Could not search this mobile number");
      }

      const result = payload.data || emptyLookup;
      setLookup(result);
      setMobile(normalized);
      seedFormFromRegistration(result.registration);

      if (!result.found) {
        setMessage("Mobile number not found. Please complete your registration.");
      } else if (result.complete) {
        setMessage(`You are already registered for the services. Please report at 3pm at the volunteer reception at the venue on the event date to know your allocated service`);
      } else {
        const missingLabels = (result.missingFields || []).map((field) => fieldConfig[field]?.label || field);
        setMessage(`Please complete your registration. Missing fields: ${missingLabels.join(", ")}.`);
      }
    } catch (error) {
      setLookup(emptyLookup);
      setMessage(error.message || "Could not search this mobile number");
    } finally {
      setSearching(false);
    }
  }

  function mergePayload() {
    const registration = lookup.registration || {};
    return {
      mobileNumber: normalizeMobile(mobile),
      name: form.name || registration.name || "",
      gender: form.gender || registration.gender || "",
      age: form.age || registration.age || "",
      collegeWorking: form.occupation || registration.occupation || "",
      areaOfStay: form.areaOfStay || registration.areaOfStay || ""
    };
  }

  async function submitRegistration(event) {
    event.preventDefault();
    const normalized = normalizeMobile(mobile);
    if (normalized.length !== 10) {
      setMessage("Please search a valid mobile number first.");
      return;
    }

    const payload = mergePayload();
    const required = lookup.found ? missingFields : fieldOrder;
    const missingNow = required.filter((field) => {
      if (field === "name") return !String(payload.name || "").trim();
      if (field === "gender") return !String(payload.gender || "").trim();
      if (field === "age") return !String(payload.age || "").trim();
      if (field === "occupation") return !String(payload.collegeWorking || "").trim();
      if (field === "areaOfStay") return !String(payload.areaOfStay || "").trim();
      return false;
    });

    if (missingNow.length) {
      setMessage(`Please fill: ${missingNow.map((field) => fieldConfig[field]?.label || field).join(", ")}`);
      return;
    }

    setSaving(true);
    setMessage("Saving registration...");
    try {
      const response = await fetch("/api/bridge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "bahudaRegistrations.upsert",
          ...payload
        })
      });
      const result = await readJsonResponse(response);
      if (!response.ok || result.ok === false) {
        throw new Error(result.error || "Could not save registration");
      }

      setLookup({
        found: true,
        complete: Boolean(result.data?.complete),
        missingFields: result.data?.missingFields || [],
        registration: result.data?.registration || null
      });
      seedFormFromRegistration(result.data?.registration);
      setRegistrationComplete(true);
      setMessage(EVENT_THANK_YOU);
    } catch (error) {
      setMessage(error.message || "Could not save registration");
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="page-shell">
      <header className="topbar">
        <div>
          <p className="eyebrow">Volunteer Allocation System</p>
          <h1>{EVENT_TITLE}</h1>
          <p className="subtle">{EVENT_DATE} | {EVENT_VENUE}</p>
        </div>
      </header>

      <section className="panel">
        <form className="form-grid" onSubmit={searchRegistration}>
          <label className="field wide">
            <span>Mobile Number</span>
            <input
              type="tel"
              inputMode="numeric"
              placeholder="Enter mobile number"
              value={mobile}
              onChange={(event) => {
                clearCurrentResult(event.target.value);
              }}
            />
          </label>
          <div className="actions">
            <button type="submit" disabled={searching}>{searching ? "Searching..." : "Submit"}</button>
          </div>
        </form>
      </section>

      {message ? <section className="notice">{message}</section> : null}

      {showForm ? (
        <section className="panel">
          <div className="stack">
            <div className="service-card">
              <h2>{isComplete ? "You are already registered" : "Please complete your registration"}</h2>
              {!isComplete && lookup.found ? (
                <div className="summary-grid registration-summary">
                  {fieldOrder.map((field) => {
                    const value = lookup.registration?.[field === "occupation" ? "occupation" : field] || "";
                    const label = fieldConfig[field]?.label || field;
                    return (
                      <div key={field}>
                        <span>{label}</span>
                        <strong>{value || "-"}</strong>
                      </div>
                    );
                  })}
                </div>
              ) : null}
            </div>

            <form className="form-grid" onSubmit={submitRegistration}>
              {visibleFields.map((field) => {
                const config = fieldConfig[field];
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
                        value={field === "occupation" ? form.occupation : form[field]}
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
          </div>
        </section>
      ) : null}
    </main>
  );
}
