"use client";
import { useEffect } from "react";
import { track } from "@vercel/analytics";

// Sends one "utm_landing" event per campaign per browser session, so weekly
// visits can be counted by utm_campaign without Web Analytics Plus.
export default function UtmTracker() {
  useEffect(() => {
    try {
      const p = new URLSearchParams(window.location.search);
      const campaign = p.get("utm_campaign");
      if (!campaign) return;
      const key = "ac_utm_" + campaign;
      if (sessionStorage.getItem(key)) return;
      sessionStorage.setItem(key, "1");
      track("utm_landing", {
        campaign: campaign.slice(0, 60),
        source: (p.get("utm_source") || "none").slice(0, 60),
      });
    } catch (e) {}
  }, []);
  return null;
}
