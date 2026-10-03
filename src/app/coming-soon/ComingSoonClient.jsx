"use client";
import React, { useState } from "react";
import { Icon } from "@/components/ui/Icons";
export function ComingSoonClient() {
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState("idle");
  const [message, setMessage] = useState("");

  async function handleSubmit(event) {
    event.preventDefault();
    if (!password.trim() || status === "loading") return;

    setStatus("loading");
    setMessage("");

    try {
      const response = await fetch("/api/coming-soon/unlock", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setStatus("error");
        setMessage(data?.error || "That passcode did not work.");
        return;
      }

      setStatus("success");
      setMessage("Access unlocked. Taking you in...");
      window.location.href = "/";
    } catch {
      setStatus("error");
      setMessage("Could not verify the passcode. Try again.");
    }
  }

  return (
    <form onSubmit={handleSubmit} className="coming-soon-form" aria-label="Preview access">
      <div className="coming-soon-input-wrap">
        <Icon name="shield" className="coming-soon-input-icon" />
        <input
          className="coming-soon-input"
          type="password"
          autoComplete="current-password"
          aria-label="Preview passcode" placeholder="Preview passcode"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
        />
      </div>
      <button className="coming-soon-button" type="submit" disabled={status === "loading"}>
        {status === "loading" ? "Checking" : "Enter Preview"}
        <Icon name="arrow" />
      </button>
      {message ? (
        <p role={status === "error" ? "alert" : "status"} className={`coming-soon-message ${status === "error" ? "is-error" : "is-success"}`}>
          {message}
        </p>
      ) : null}
    </form>
  );
}
