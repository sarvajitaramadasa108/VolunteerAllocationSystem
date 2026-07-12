"use client";

import { useEffect, useState } from "react";

export default function HomeServiceSummary() {
  const [services, setServices] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    let timerId = null;

    async function load() {
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

    async function refresh() {
      await load();
    }

    function handleFocus() {
      void refresh();
    }

    load();
    timerId = window.setInterval(() => {
      void refresh();
    }, 15000);
    window.addEventListener("focus", handleFocus);

    return () => {
      alive = false;
      if (timerId) window.clearInterval(timerId);
      window.removeEventListener("focus", handleFocus);
    };
  }, []);

  return (
    <section className="panel summary-panel">
      <div className="panel-head">
        <h2>Service Requirement Summary</h2>
        <p className="subtle">Required vs already allocated by service.</p>
      </div>
      {loading ? (
        <div className="empty-state">Loading service summary...</div>
      ) : services.length ? (
        <div className="table-wrap">
          <table className="summary-table">
            <thead>
              <tr>
                <th>Service</th>
                <th>Coordinator</th>
                <th>Contact</th>
                <th>Reporting Time</th>
                <th>Required</th>
                <th>Allocated</th>
                <th>Pending</th>
              </tr>
            </thead>
            <tbody>
              {services.map((service) => {
                const required = Number(service.requiredCount || 0);
                const allocated = Number(service.allocatedCount || 0);
                return (
                  <tr key={service.serviceName}>
                    <td><strong>{service.serviceName || "-"}</strong></td>
                    <td>{service.coordinatorName || "-"}</td>
                    <td>{service.contactNumber || "-"}</td>
                    <td>{service.reportingTime || "-"}</td>
                    <td>{required}</td>
                    <td>{allocated}</td>
                    <td><strong>{Math.max(required - allocated, 0)}</strong></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="empty-state">No services found in Service Master.</div>
      )}
    </section>
  );
}
