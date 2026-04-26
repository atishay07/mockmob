"use client";

import React, { useEffect, useMemo, useState } from "react";
import { Icon } from "@/components/ui/Icons";

function getFallbackLaunchTime() {
  const launch = new Date();
  launch.setDate(launch.getDate() + 1);
  return launch;
}

function getTimeLeft(targetDate) {
  const distance = Math.max(0, targetDate.getTime() - Date.now());
  const hours = Math.floor(distance / (1000 * 60 * 60));
  const minutes = Math.floor((distance / (1000 * 60)) % 60);
  const seconds = Math.floor((distance / 1000) % 60);

  return {
    hours: String(hours).padStart(2, "0"),
    minutes: String(minutes).padStart(2, "0"),
    seconds: String(seconds).padStart(2, "0"),
  };
}

export function ComingSoonCountdown() {
  const targetDate = useMemo(() => {
    const configuredDate = process.env.NEXT_PUBLIC_CUET_LAUNCH_AT
      ? new Date(process.env.NEXT_PUBLIC_CUET_LAUNCH_AT)
      : null;

    return configuredDate && !Number.isNaN(configuredDate.getTime())
      ? configuredDate
      : getFallbackLaunchTime();
  }, []);

  const [timeLeft, setTimeLeft] = useState(() => getTimeLeft(targetDate));

  useEffect(() => {
    const timer = window.setInterval(() => {
      setTimeLeft(getTimeLeft(targetDate));
    }, 1000);

    return () => window.clearInterval(timer);
  }, [targetDate]);

  return (
    <div className="coming-soon-countdown" aria-label="CUET 2026 launch countdown">
      <div className="coming-soon-countdown-head">
        <Icon name="clock" />
        <span>CUET 2026 platform live in</span>
      </div>
      <div className="coming-soon-countdown-grid">
        <span>
          <strong>{timeLeft.hours}</strong>
          Hrs
        </span>
        <span>
          <strong>{timeLeft.minutes}</strong>
          Min
        </span>
        <span>
          <strong>{timeLeft.seconds}</strong>
          Sec
        </span>
      </div>
    </div>
  );
}

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
          placeholder="Preview passcode"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
        />
      </div>
      <button className="coming-soon-button" type="submit" disabled={status === "loading"}>
        {status === "loading" ? "Checking" : "Enter Preview"}
        <Icon name="arrow" />
      </button>
      {message ? (
        <p className={`coming-soon-message ${status === "error" ? "is-error" : "is-success"}`}>
          {message}
        </p>
      ) : null}
    </form>
  );
}
